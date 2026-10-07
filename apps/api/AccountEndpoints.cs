using System.Data;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace ClientStudio;
public record PersonalInfoInput(string DisplayName, string Phone);
public static class AccountEndpoints
{
    public static void Map(RouteGroupBuilder api) {
        api.MapGet("/account", async (HttpContext ctx, StudioDb db) => {
            var owner = ctx.Owner(); var token = Auth.Hash(Auth.Token(ctx));
            var employee = await db.Employees.AsNoTracking().SingleAsync(e => e.Id == owner);
            var expiry = await db.Sessions.Where(s => s.TokenHash == token).Select(s => s.ExpiresAt).SingleAsync();
            var ids = db.Customers.Where(c => c.OwnerId == owner).Select(c => c.Id);
            return Results.Ok(new { employee.Email, employee.DisplayName, employee.Phone, expiresAt = expiry, timeZone = "Asia/Ho_Chi_Minh",
                customers = await ids.CountAsync(), photos = await db.Photos.CountAsync(p => ids.Contains(p.CustomerId)),
                contacts = await db.Contacts.CountAsync(c => ids.Contains(c.CustomerId)),
                reminders = await db.Reminders.CountAsync(r => ids.Contains(r.CustomerId) && r.Active) });
        });
        api.MapPut("/account", async (PersonalInfoInput input, HttpContext ctx, StudioDb db) => {
            var phone = TextRules.Phone(input.Phone ?? "");
            if (string.IsNullOrWhiteSpace(input.DisplayName) || input.DisplayName.Length > 200 || input.Phone is null || input.Phone.Length > 32
                || (input.Phone.Trim().Length > 0 && (phone.Length < 8 || phone.Length > 15)))
                return Results.BadRequest(new { message = "Nhập tên hiển thị (tối đa 200 ký tự) và số điện thoại hợp lệ, hoặc để trống điện thoại." });
            var employee = await db.Employees.SingleAsync(e => e.Id == ctx.Owner());
            employee.DisplayName = input.DisplayName.Trim(); employee.Phone = phone;
            await db.SaveChangesAsync(); return Results.Ok(new { employee.Email, employee.DisplayName, employee.Phone });
        });
        api.MapGet("/account/backup", Export);
    }

    static async Task<IResult> Export(bool? includePhotos, HttpContext ctx, StudioDb db, IConfiguration config) {
        var ct = ctx.RequestAborted; var owner = ctx.Owner(); var withPhotos = includePhotos ?? true;
        // Capture related rows in one consistent read transaction; SQL retry stays before writing the response.
        var snapshot = await db.Database.CreateExecutionStrategy().ExecuteAsync(async () => {
            await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;
            var employee = await db.Employees.AsNoTracking().Where(e => e.Id == owner).Select(e => new { e.Email, e.DisplayName, e.Phone }).SingleAsync(ct);
            var customers = await db.Customers.AsNoTracking().Where(c => c.OwnerId == owner).Include(c => c.Vehicles).ToListAsync(ct);
            var ids = customers.Select(c => c.Id).ToArray();
            var contacts = await db.Contacts.AsNoTracking().Where(c => ids.Contains(c.CustomerId)).ToListAsync(ct);
            var reminders = await db.Reminders.AsNoTracking().Where(r => ids.Contains(r.CustomerId)).ToListAsync(ct);
            var reminderIds = reminders.Select(r => r.Id).ToArray();
            var occurrences = await db.Occurrences.AsNoTracking().Where(o => reminderIds.Contains(o.ReminderId)).ToListAsync(ct);
            var photos = await db.Photos.AsNoTracking().Where(p => ids.Contains(p.CustomerId)).ToListAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return new { Employee = employee, Customers = customers, Contacts = contacts, Reminders = reminders, Occurrences = occurrences, Photos = photos };
        });
        var archiveStream = new FileStream(Path.Combine(Path.GetTempPath(), $"cliente-{Guid.NewGuid():N}.zip"), FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.DeleteOnClose);
        try {
            var exportedAt = DateTimeOffset.UtcNow;
            using (var archive = new ZipArchive(archiveStream, ZipArchiveMode.Create, true)) {
                var photoFiles = new List<object>();
                foreach (var photo in snapshot.Photos) {
                    string? entryName = null; string? hash = null;
                    if (withPhotos) {
                        var root = CustomerEndpoints.Storage(config);
                        var path = Path.GetFullPath(Path.Combine(root, photo.FileName));
                        if (!path.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
                            throw new IOException("Invalid stored photo path.");
                        entryName = $"photos/{photo.Id}{Path.GetExtension(photo.FileName)}";
                        await using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete, 65536, FileOptions.Asynchronous);
                        hash = Convert.ToHexString(await SHA256.HashDataAsync(file, ct)); file.Position = 0;
                        await using var entry = archive.CreateEntry(entryName, CompressionLevel.NoCompression).Open();
                        await file.CopyToAsync(entry, ct);
                    }
                    photoFiles.Add(new { photo.Id, photo.CustomerId, photo.ContentType, photo.Caption, photo.IsAvatar, photo.CreatedAt, archivePath = entryName, sha256 = hash });
                }
                var data = new { format = "cliente-personal-backup", version = 1, exportedAt, timeZone = "Asia/Ho_Chi_Minh", includePhotos = withPhotos, account = snapshot.Employee,
                    customers = snapshot.Customers.Select(c => new { c.Id, c.Name, c.Phone, c.BirthDate, c.Interests, c.Notes, c.PreferredContact, c.Status, c.AvatarId, c.UpdatedAt,
                        vehicles = c.Vehicles.Select(v => new { v.Id, v.Model, v.Plate, v.DeliveryDate }) }),
                    contacts = snapshot.Contacts, reminders = snapshot.Reminders,
                    occurrences = snapshot.Occurrences.Select(o => new { o.Id, o.ReminderId, o.Revision, o.OriginalAt, o.ScheduledAt, o.NotifyAt, o.State, o.CompletedAt }), photos = photoFiles };
                await using var jsonEntry = archive.CreateEntry("data.json", CompressionLevel.Fastest).Open();
                await JsonSerializer.SerializeAsync(jsonEntry, data, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }, ct);
            }
            archiveStream.Position = 0;
            return Results.File(archiveStream, "application/zip", $"cliente-{exportedAt.ToOffset(TimeSpan.FromHours(7)):yyyyMMdd-HHmmss}.zip");
        } catch (IOException) {
            await archiveStream.DisposeAsync();
            return Results.Conflict(new { message = "Không tạo được bản sao đầy đủ. Một ảnh có thể đã thay đổi hoặc không còn trên máy chủ. Hãy thử lại hoặc liên hệ quản trị." });
        } catch { await archiveStream.DisposeAsync(); throw; }
    }
}
