using Microsoft.EntityFrameworkCore;

namespace ClientStudio;
public static class CustomerEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/customers", async (HttpContext ctx, StudioDb db, string? search) => {
            var query = db.Customers.AsNoTracking().Where(x => x.OwnerId == ctx.Owner());
            if (!string.IsNullOrWhiteSpace(search)) {
                var term = TextRules.Search(search.Trim()); var digits = TextRules.Phone(search);
                query = query.Where(x => x.SearchText.Contains(term) || (digits.Length >= 3 && x.Phone.Contains(digits)));
            }
            var customers = await query.Include(x => x.Vehicles).OrderBy(x => x.Name).ToListAsync();
            var ids = customers.Select(x => x.Id).ToList();
            var latest = await db.Contacts.Where(x => ids.Contains(x.CustomerId)).GroupBy(x => x.CustomerId)
                .Select(x => new { Id = x.Key, At = x.Max(c => c.At) }).ToDictionaryAsync(x => x.Id, x => x.At);
            return Results.Ok(customers.Select(c => new { c.Id, c.Name, c.Phone, c.Status, c.AvatarId, c.Vehicles,
                lastContactAt = latest.TryGetValue(c.Id, out var at) ? (DateTimeOffset?)at : null }));
        });
        api.MapGet("/customers/{id:guid}", async (Guid id, HttpContext ctx, StudioDb db) => {
            var c = await db.Customers.AsNoTracking().Include(x => x.Vehicles).SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == ctx.Owner());
            return c is null ? Results.NotFound() : Results.Ok(c);
        });
        api.MapPost("/customers", async (CustomerInput input, HttpContext ctx, StudioDb db) => await Save(null, input, ctx, db));
        api.MapPut("/customers/{id:guid}", async (Guid id, CustomerInput input, HttpContext ctx, StudioDb db) => await Save(id, input, ctx, db));
        api.MapGet("/customers/{id:guid}/photos", async (Guid id, HttpContext ctx, StudioDb db) =>
            await Owned(db, ctx, id) ? Results.Ok(await db.Photos.AsNoTracking().Where(p => p.CustomerId == id && !p.IsAvatar)
                .OrderByDescending(p => p.CreatedAt).ToListAsync()) : Results.NotFound());
        api.MapPost("/customers/{id:guid}/photos", Upload).DisableAntiforgery();
        api.MapGet("/photos/{id:guid}/file", async (Guid id, HttpContext ctx, StudioDb db, IConfiguration config) => {
            var p = await (from photo in db.Photos join c in db.Customers on photo.CustomerId equals c.Id
                where photo.Id == id && c.OwnerId == ctx.Owner() select photo).SingleOrDefaultAsync();
            if (p is null) return Results.NotFound();
            var path = Path.Combine(Storage(config), p.FileName);
            return File.Exists(path) ? Results.File(path, p.ContentType, enableRangeProcessing: true) : Results.NotFound();
        });
        api.MapPut("/photos/{id:guid}", async (Guid id, CaptionInput input, HttpContext ctx, StudioDb db) => {
            var p = await (from photo in db.Photos join c in db.Customers on photo.CustomerId equals c.Id
                where photo.Id == id && c.OwnerId == ctx.Owner() select photo).SingleOrDefaultAsync();
            if (p is null) return Results.NotFound();
            if (input.Caption.Length > 500) return Results.BadRequest(new { message = "Mô tả tối đa 500 ký tự." });
            p.Caption = input.Caption.Trim(); await db.SaveChangesAsync(); return Results.Ok(p);
        });
        api.MapDelete("/photos/{id:guid}", async (Guid id, HttpContext ctx, StudioDb db, IConfiguration config) => {
            var p = await (from photo in db.Photos join c in db.Customers on photo.CustomerId equals c.Id
                where photo.Id == id && c.OwnerId == ctx.Owner() select photo).SingleOrDefaultAsync();
            if (p is null) return Results.NotFound();
            var customer = await db.Customers.SingleAsync(x => x.Id == p.CustomerId);
            if (customer.AvatarId == p.Id) customer.AvatarId = null;
            db.Photos.Remove(p); await db.SaveChangesAsync(); File.Delete(Path.Combine(Storage(config), p.FileName));
            return Results.NoContent();
        });
    }
    public static Task<bool> Owned(StudioDb db, HttpContext ctx, Guid id) => db.Customers.AnyAsync(c => c.Id == id && c.OwnerId == ctx.Owner());
    public static string Storage(IConfiguration config) => Path.GetFullPath(config["Storage:Path"] ?? "storage");
    static async Task<IResult> Save(Guid? id, CustomerInput input, HttpContext ctx, StudioDb db)
    {
        Customer? c = null;
        if (id.HasValue) { c = await db.Customers.Include(x => x.Vehicles).SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == ctx.Owner()); if (c is null) return Results.NotFound(); }
        var errors = Validation.Customer(input); if (errors.Count > 0) return Results.ValidationProblem(errors);
        var phone = TextRules.Phone(input.Phone);
        var duplicate = await db.Customers.Where(x => x.OwnerId == ctx.Owner() && x.Phone == phone && x.Id != id)
            .Select(x => new { x.Id, x.Name }).FirstOrDefaultAsync();
        if (duplicate is not null && !input.ConfirmDuplicate) return Results.Conflict(new { message = "Số điện thoại đã có hồ sơ. Xác nhận nếu đây là khách khác.", duplicate });
        if (c is null) { c = new Customer { OwnerId = ctx.Owner() }; db.Customers.Add(c); }
        c.Name = input.Name.Trim(); c.Phone = phone; c.BirthDate = input.BirthDate;
        c.Interests = input.Interests.Trim(); c.Notes = input.Notes.Trim(); c.PreferredContact = input.PreferredContact.Trim(); c.Status = input.Status;
        c.UpdatedAt = DateTimeOffset.UtcNow;
        foreach (var old in c.Vehicles.Where(v => !input.Vehicles.Any(i => i.Id == v.Id)).ToList()) { c.Vehicles.Remove(old); db.Vehicles.Remove(old); }
        foreach (var v in input.Vehicles) {
            var car = c.Vehicles.FirstOrDefault(x => x.Id == v.Id);
            if (car is null) { car = new Vehicle { CustomerId = c.Id }; c.Vehicles.Add(car); db.Vehicles.Add(car); }
            car.Model = v.Model.Trim(); car.Plate = v.Plate.Trim(); car.DeliveryDate = v.DeliveryDate;
        }
        c.SearchText = TextRules.Search($"{c.Name} {c.Phone} {string.Join(' ', c.Vehicles.Select(v => v.Plate))}");
        await db.SaveChangesAsync(); return Results.Ok(c);
    }
    static async Task<IResult> Upload(Guid id, HttpContext ctx, StudioDb db, IConfiguration config)
    {
        if (!await Owned(db, ctx, id)) return Results.NotFound();
        if (!ctx.Request.HasFormContentType) return Results.BadRequest(new { message = "Chọn một file ảnh." });
        var form = await ctx.Request.ReadFormAsync(); var file = form.Files.FirstOrDefault();
        if (file is null || file.Length is < 8 or > 10 * 1024 * 1024) return Results.BadRequest(new { message = "Ảnh phải nhỏ hơn 10 MB." });
        byte[] bytes;
        using (var memory = new MemoryStream()) { await file.CopyToAsync(memory); bytes = memory.ToArray(); }
        var png = bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var jpeg = bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255;
        var webp = bytes.Length >= 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP";
        if (!png && !jpeg && !webp) return Results.BadRequest(new { message = "Chỉ nhận ảnh JPEG, PNG hoặc WebP. Hãy xuất HEIC thành JPEG." });
        var p = new Photo { CustomerId = id, IsAvatar = form["avatar"] == "true", Caption = form["caption"].ToString(),
            ContentType = png ? "image/png" : jpeg ? "image/jpeg" : "image/webp" };
        if (p.Caption.Length > 500) return Results.BadRequest(new { message = "Mô tả tối đa 500 ký tự." });
        p.FileName = p.Id + (png ? ".png" : jpeg ? ".jpg" : ".webp");
        Directory.CreateDirectory(Storage(config)); var path = Path.Combine(Storage(config), p.FileName);
        await File.WriteAllBytesAsync(path, bytes); Photo? old = null;
        try {
            db.Photos.Add(p);
            if (p.IsAvatar) {
                var customer = await db.Customers.SingleAsync(c => c.Id == id && c.OwnerId == ctx.Owner());
                if (customer.AvatarId.HasValue) old = await db.Photos.SingleOrDefaultAsync(x => x.Id == customer.AvatarId);
                customer.AvatarId = p.Id; if (old is not null) db.Photos.Remove(old);
            }
            await db.SaveChangesAsync();
        } catch { File.Delete(path); throw; }
        if (old is not null) File.Delete(Path.Combine(Storage(config), old.FileName)); return Results.Ok(p);
    }
}
