using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace ClientStudio;

// Run one worker instance for the MVP. Delivery state survives restarts in SQL Server.
public sealed class PushWorker(IServiceScopeFactory scopes, IHttpClientFactory clients, ILogger<PushWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do {
            try {
                using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
                await Expand(db, stop); await Enqueue(db, stop); await Send(db, stop); await Receipts(db, stop);
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogError(ex, "Notification worker failed; persistent jobs will be retried."); }
        } while (await timer.WaitForNextTickAsync(stop));
    }
    static async Task Expand(StudioDb db, CancellationToken ct)
    {
        var annual = await db.Reminders.Where(r => r.Active && r.Repeat == "annual").ToListAsync(ct);
        foreach (var r in annual) {
            var known = await db.Occurrences.Where(o => o.ReminderId == r.Id && o.Revision == r.Revision).Select(o => o.OriginalAt).ToListAsync(ct);
            db.Occurrences.AddRange(Schedule.Generate(r, DateTimeOffset.UtcNow).Where(o => !known.Contains(o.OriginalAt)));
        }
        await db.SaveChangesAsync(ct);
    }
    static async Task Enqueue(StudioDb db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var jobs = await (from o in db.Occurrences join r in db.Reminders on o.ReminderId equals r.Id
            join c in db.Customers on r.CustomerId equals c.Id join d in db.Devices on c.OwnerId equals d.OwnerId
            join u in db.Employees on c.OwnerId equals u.Id
            where o.State == "pending" && r.Active && u.Enabled && d.Enabled && o.NotifyAt <= now
                && !db.Deliveries.Any(j => j.OccurrenceId == o.Id && j.DeviceId == d.Id)
            select new { OccurrenceId = o.Id, DeviceId = d.Id }).Take(100).ToListAsync(ct);
        db.Deliveries.AddRange(jobs.Select(j => new Delivery { OccurrenceId = j.OccurrenceId, DeviceId = j.DeviceId }));
        await db.SaveChangesAsync(ct);
    }
    async Task Send(StudioDb db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var ids = await db.Deliveries.Where(j => j.State == "pending" && j.RetryAt <= now && (j.LeaseUntil == null || j.LeaseUntil < now))
            .OrderBy(j => j.RetryAt).Select(j => j.Id).Take(50).ToListAsync(ct);
        foreach (var id in ids) {
            if (await db.Deliveries.Where(j => j.Id == id && j.State == "pending" && (j.LeaseUntil == null || j.LeaseUntil < now))
                .ExecuteUpdateAsync(s => s.SetProperty(j => j.LeaseUntil, now.AddMinutes(2)), ct) == 0) continue;
            var job = await db.Deliveries.SingleAsync(j => j.Id == id, ct);
            var data = await (from o in db.Occurrences join r in db.Reminders on o.ReminderId equals r.Id
                join c in db.Customers on r.CustomerId equals c.Id join d in db.Devices on job.DeviceId equals d.Id
                join u in db.Employees on c.OwnerId equals u.Id
                where o.Id == job.OccurrenceId && o.State == "pending" && r.Active && d.Enabled && u.Enabled && d.OwnerId == c.OwnerId && o.NotifyAt <= DateTimeOffset.UtcNow
                select new { c.Name, CustomerId = c.Id, r.Content, ReminderId = r.Id, d.PushToken }).SingleOrDefaultAsync(ct);
            if (data is null) { job.State = "cancelled"; job.LeaseUntil = null; await db.SaveChangesAsync(ct); continue; }
            job.Attempts++;
            try {
                using var response = await clients.CreateClient("expo").PostAsJsonAsync("send", new {
                    to = data.PushToken, title = data.Name, body = data.Content, sound = "default", channelId = "care",
                    data = new { customerId = data.CustomerId, reminderId = data.ReminderId, occurrenceId = job.OccurrenceId }
                }, ct);
                response.EnsureSuccessStatusCode();
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var ticket = json.RootElement.GetProperty("data");
                if (ticket.ValueKind == JsonValueKind.Array) ticket = ticket[0];
                if (ticket.GetProperty("status").GetString() == "ok") {
                    job.State = "accepted"; job.ReceiptId = ticket.GetProperty("id").GetString(); job.RetryAt = DateTimeOffset.UtcNow.AddMinutes(15);
                } else if (ticket.TryGetProperty("details", out var details) && details.TryGetProperty("error", out var error) && error.GetString() == "DeviceNotRegistered") {
                    await Disable(db, job.DeviceId, ct); job.State = "failed";
                } else Retry(job);
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException or InvalidOperationException or KeyNotFoundException) {
                if (ct.IsCancellationRequested) throw; log.LogWarning("Push attempt failed for delivery {Id}.", job.Id); Retry(job);
            }
            job.LeaseUntil = null; await db.SaveChangesAsync(ct);
        }
    }
    async Task Receipts(StudioDb db, CancellationToken ct)
    {
        var jobs = await db.Deliveries.Where(j => j.State == "accepted" && j.RetryAt <= DateTimeOffset.UtcNow && j.ReceiptId != null).Take(100).ToListAsync(ct);
        if (jobs.Count == 0) return;
        using var response = await clients.CreateClient("expo").PostAsJsonAsync("getReceipts", new { ids = jobs.Select(j => j.ReceiptId).ToArray() }, ct);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var data = json.RootElement.GetProperty("data");
        foreach (var job in jobs) {
            if (!data.TryGetProperty(job.ReceiptId!, out var receipt)) { job.RetryAt = DateTimeOffset.UtcNow.AddMinutes(15); continue; }
            if (receipt.GetProperty("status").GetString() == "ok") job.State = "providerConfirmed";
            else {
                if (receipt.TryGetProperty("details", out var details) && details.TryGetProperty("error", out var error) && error.GetString() == "DeviceNotRegistered") await Disable(db, job.DeviceId, ct);
                job.State = "failed";
            }
        }
        await db.SaveChangesAsync(ct);
    }
    static void Retry(Delivery j) { j.State = j.Attempts >= 5 ? "failed" : "pending"; j.RetryAt = DateTimeOffset.UtcNow.AddSeconds(Math.Pow(2, j.Attempts) * 15); }
    static Task<int> Disable(StudioDb db, Guid deviceId, CancellationToken ct) => db.Devices.Where(d => d.Id == deviceId).ExecuteUpdateAsync(s => s.SetProperty(d => d.Enabled, false), ct);
}
