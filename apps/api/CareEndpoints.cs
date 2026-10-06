using Microsoft.EntityFrameworkCore;

namespace ClientStudio;
public static class CareEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/customers/{id:guid}/contacts", async (Guid id, HttpContext ctx, StudioDb db) =>
            await CustomerEndpoints.Owned(db, ctx, id) ? Results.Ok(await db.Contacts.AsNoTracking().Where(x => x.CustomerId == id)
                .OrderByDescending(x => x.At).ToListAsync()) : Results.NotFound());
        api.MapGet("/customers/{id:guid}/reminders", async (Guid id, HttpContext ctx, StudioDb db) => {
            if (!await CustomerEndpoints.Owned(db, ctx, id)) return Results.NotFound();
            var reminders = await db.Reminders.AsNoTracking().Where(x => x.CustomerId == id).OrderByDescending(x => x.LocalDateTime).ToListAsync();
            var ids = reminders.Select(x => x.Id).ToList();
            var occurrences = await db.Occurrences.AsNoTracking().Where(x => ids.Contains(x.ReminderId)).OrderBy(x => x.ScheduledAt).ToListAsync();
            return Results.Ok(reminders.Select(r => new { reminder = r, occurrences = occurrences.Where(o => o.ReminderId == r.Id) }));
        });
        api.MapPost("/customers/{id:guid}/reminders", async (Guid id, ReminderInput input, HttpContext ctx, StudioDb db) => {
            if (!await CustomerEndpoints.Owned(db, ctx, id)) return Results.NotFound();
            var errors = Validation.Reminder(input); if (errors.Count > 0) return Results.ValidationProblem(errors);
            var r = Validation.NewReminder(id, input); AddReminder(db, r); await db.SaveChangesAsync(); return Results.Ok(r);
        });
        api.MapPut("/reminders/{id:guid}", async (Guid id, ReminderInput input, HttpContext ctx, StudioDb db) => {
            var r = await OwnedReminder(id, ctx, db); if (r is null) return Results.NotFound();
            var errors = Validation.Reminder(input); if (errors.Count > 0) return Results.ValidationProblem(errors);
            foreach (var o in await db.Occurrences.Where(x => x.ReminderId == id && x.State == "pending").ToListAsync()) o.State = "cancelled";
            r.Kind = input.Kind; r.Content = input.Content.Trim(); r.LocalDateTime = input.LocalDateTime; r.TimeZone = input.TimeZone;
            r.Repeat = input.Repeat; r.LeadDays = input.LeadDays; r.LeapDayPolicy = input.LeapDayPolicy; r.Active = true; r.Revision++;
            db.Occurrences.AddRange(Schedule.Generate(r, DateTimeOffset.UtcNow)); await db.SaveChangesAsync(); return Results.Ok(r);
        });
        api.MapDelete("/reminders/{id:guid}", async (Guid id, HttpContext ctx, StudioDb db) => {
            var r = await OwnedReminder(id, ctx, db); if (r is null) return Results.NotFound(); r.Active = false;
            foreach (var o in await db.Occurrences.Where(x => x.ReminderId == id && x.State == "pending").ToListAsync()) o.State = "cancelled";
            await db.SaveChangesAsync(); return Results.NoContent();
        });
        api.MapPost("/occurrences/{id:guid}/complete", async (Guid id, HttpContext ctx, StudioDb db) => {
            var o = await OwnedOccurrence(id, ctx, db); if (o is null) return Results.NotFound();
            if (o.State != "pending") return Results.Conflict(new { message = "Lần nhắc đã được xử lý." });
            o.State = "completed"; o.CompletedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync(); return Results.NoContent();
        });
        api.MapPost("/occurrences/{id:guid}/snooze", async (Guid id, SnoozeInput input, HttpContext ctx, StudioDb db) => {
            var o = await OwnedOccurrence(id, ctx, db); if (o is null) return Results.NotFound();
            if (o.State != "pending") return Results.Conflict(new { message = "Lần nhắc đã được xử lý." });
            DateTimeOffset at;
            try { at = Schedule.ToUtc(input.LocalDateTime, input.TimeZone); }
            catch (Exception ex) when (ex is ArgumentException or TimeZoneNotFoundException or InvalidTimeZoneException) { return Results.BadRequest(new { message = "Ngày giờ hoặc múi giờ không hợp lệ." }); }
            if (at <= DateTimeOffset.UtcNow) return Results.BadRequest(new { message = "Chọn giờ trong tương lai." });
            o.ScheduledAt = at; o.NotifyAt = at;
            db.Deliveries.RemoveRange(await db.Deliveries.Where(d => d.OccurrenceId == id).ToListAsync());
            await db.SaveChangesAsync(); return Results.Ok(o);
        });
        api.MapPost("/customers/{id:guid}/contacts", async (Guid id, ContactInput input, HttpContext ctx, StudioDb db) => {
            if (!await CustomerEndpoints.Owned(db, ctx, id)) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(input.Content) || input.Content.Length > 10000 || input.Channel is not ("call" or "message" or "meeting") || input.At > DateTimeOffset.UtcNow.AddMinutes(1))
                return Results.BadRequest(new { message = "Nhập nội dung, kênh liên hệ và thời điểm đã thực hiện hợp lệ." });
            Occurrence? o = null;
            if (input.OccurrenceId.HasValue) {
                o = await OwnedOccurrence(input.OccurrenceId.Value, ctx, db);
                if (o is null || !await db.Reminders.AnyAsync(r => r.Id == o.ReminderId && r.CustomerId == id)) return Results.NotFound();
                if (o.State != "pending") return Results.Conflict(new { message = "Lần nhắc đã được xử lý." });
            }
            if (input.NextReminder is not null) {
                var errors = Validation.Reminder(input.NextReminder); if (errors.Count > 0) return Results.ValidationProblem(errors);
                AddReminder(db, Validation.NewReminder(id, input.NextReminder));
            }
            if (o is not null) { o.State = "completed"; o.CompletedAt = input.At; }
            var contact = new Contact { CustomerId = id, At = input.At, Channel = input.Channel, Content = input.Content.Trim(), OccurrenceId = o?.Id };
            db.Contacts.Add(contact); await db.SaveChangesAsync(); return Results.Ok(contact);
        });
    }
    public static void AddReminder(StudioDb db, Reminder r) { db.Reminders.Add(r); db.Occurrences.AddRange(Schedule.Generate(r, DateTimeOffset.UtcNow)); }
    static Task<Reminder?> OwnedReminder(Guid id, HttpContext ctx, StudioDb db) =>
        (from r in db.Reminders join c in db.Customers on r.CustomerId equals c.Id where r.Id == id && c.OwnerId == ctx.Owner() select r).SingleOrDefaultAsync();
    static Task<Occurrence?> OwnedOccurrence(Guid id, HttpContext ctx, StudioDb db) =>
        (from o in db.Occurrences join r in db.Reminders on o.ReminderId equals r.Id join c in db.Customers on r.CustomerId equals c.Id
            where o.Id == id && c.OwnerId == ctx.Owner() && r.Active select o).SingleOrDefaultAsync();
}
