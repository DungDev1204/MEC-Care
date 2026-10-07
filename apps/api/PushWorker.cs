using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Lib.Net.Http.WebPush;

namespace ClientStudio;

// One active scheduler. Persistent jobs survive restarts; browser vendors deliver Web Push.
public sealed class PushWorker(IServiceScopeFactory scopes, IWebPushSender sender, ILogger<PushWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop) {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        try {
            do {
                try {
                    using var scope = scopes.CreateScope();
                    await RunCycle(scope.ServiceProvider.GetRequiredService<StudioDb>(), stop);
                } catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
                catch (Exception ex) { log.LogError(ex, "Web Push scheduler failed; persisted jobs will be retried."); }
            } while (await timer.WaitForNextTickAsync(stop));
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
    }
    public async Task RunCycle(StudioDb db, CancellationToken ct = default) {
        var now = DateTimeOffset.UtcNow;
        foreach (var r in await db.Reminders.Where(r => r.Active && r.Repeat == "annual").ToListAsync(ct)) {
            var known = await db.Occurrences.Where(o => o.ReminderId == r.Id && o.Revision == r.Revision).Select(o => o.OriginalAt).ToListAsync(ct);
            db.Occurrences.AddRange(Schedule.Generate(r, now).Where(o => !known.Contains(o.OriginalAt)));
        }
        await db.SaveChangesAsync(ct);
        var jobs = await (from o in db.Occurrences join r in db.Reminders on o.ReminderId equals r.Id
            join c in db.Customers on r.CustomerId equals c.Id join d in db.Devices on c.OwnerId equals d.OwnerId
            join u in db.Employees on c.OwnerId equals u.Id
            where o.State == "pending" && r.Active && u.Enabled && d.Enabled && d.Endpoint != null && o.NotifyAt <= now
                && db.Sessions.Any(s => s.Id == d.SessionId && s.EmployeeId == d.OwnerId && s.ExpiresAt > now)
                && !db.Deliveries.Any(j => j.OccurrenceId == o.Id && j.DeviceId == d.Id)
            select new { OccurrenceId = o.Id, DeviceId = d.Id }).Take(100).ToListAsync(ct);
        db.Deliveries.AddRange(jobs.Select(j => new Delivery { OccurrenceId = j.OccurrenceId, DeviceId = j.DeviceId, RetryAt = now }));
        await db.SaveChangesAsync(ct);
        var ids = await db.Deliveries.Where(j => j.State == "pending" && j.RetryAt <= now && (j.LeaseUntil == null || j.LeaseUntil < now))
            .OrderBy(j => j.RetryAt).Select(j => j.Id).Take(50).ToListAsync(ct);
        foreach (var id in ids) {
            if (await db.Deliveries.Where(j => j.Id == id && j.State == "pending" && (j.LeaseUntil == null || j.LeaseUntil < now))
                .ExecuteUpdateAsync(s => s.SetProperty(j => j.LeaseUntil, now.AddMinutes(2)), ct) == 0) continue;
            var job = await db.Deliveries.SingleAsync(j => j.Id == id, ct);
            // ExecuteUpdate bypasses tracking; refresh the lease so clearing it is persisted.
            await db.Entry(job).ReloadAsync(ct);
            var current = DateTimeOffset.UtcNow;
            var data = await (from o in db.Occurrences join r in db.Reminders on o.ReminderId equals r.Id
                join c in db.Customers on r.CustomerId equals c.Id join d in db.Devices on job.DeviceId equals d.Id
                join u in db.Employees on c.OwnerId equals u.Id
                where o.Id == job.OccurrenceId && o.State == "pending" && r.Active && d.Enabled && u.Enabled && d.OwnerId == c.OwnerId
                    && d.Endpoint != null && o.NotifyAt <= current
                    && db.Sessions.Any(s => s.Id == d.SessionId && s.EmployeeId == d.OwnerId && s.ExpiresAt > current)
                select new { Device = d, CustomerId = c.Id, ReminderId = r.Id }).SingleOrDefaultAsync(ct);
            if (data is null) job.State = "cancelled";
            else {
                job.Attempts++;
                try {
                    // Keep customer details off the lock screen; open the authenticated profile on tap.
                    await sender.Send(data.Device, JsonSerializer.Serialize(new { title = "Clienté · Lịch chăm sóc", body = "Bạn có một lịch chăm sóc đến hạn.",
                        url = $"/customers/{data.CustomerId}?tab=reminders&occurrence={job.OccurrenceId}", tag = job.OccurrenceId.ToString() }), ct);
                    job.State = "providerAccepted";
                } catch (PushServiceClientException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound) {
                    data.Device.Enabled = false; job.State = "failed";
                } catch (Exception ex) when (ex is PushServiceClientException or HttpRequestException or TaskCanceledException) {
                    if (ct.IsCancellationRequested) throw;
                    log.LogWarning("Web Push attempt failed for delivery {Id}.", job.Id);
                    job.State = job.Attempts >= 5 ? "failed" : "pending";
                    job.RetryAt = DateTimeOffset.UtcNow.AddSeconds(Math.Pow(2, job.Attempts) * 15);
                }
            }
            job.LeaseUntil = null; await db.SaveChangesAsync(ct);
        }
    }
}
