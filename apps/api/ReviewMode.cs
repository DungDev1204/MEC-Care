using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace ClientStudio;
public static class ReviewMode
{
    public static string[] BrowserOrigins() => new[] { "localhost", "127.0.0.1" }.Concat(
        NetworkInterface.GetAllNetworkInterfaces().SelectMany(n => n.GetIPProperties().UnicastAddresses)
            .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork).Select(a => a.Address.ToString()))
        .Distinct().Select(host => $"http://{host}:8081").ToArray();

    public static async Task Initialize(StudioDb db)
    {
        if (!db.Database.IsSqlite()) throw new InvalidOperationException("Review initialization requires the isolated SQLite database.");
        await db.Database.EnsureCreatedAsync();
        // Additive upgrade for an existing local Review database; never reset saved review records.
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();
        var columns = new HashSet<string>();
        using (var command = connection.CreateCommand()) {
            command.CommandText = "PRAGMA table_info('Devices')";
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) columns.Add(reader.GetString(1));
        }
        foreach (var (column, sql) in new[] {
            ("Endpoint", "ALTER TABLE Devices ADD COLUMN Endpoint TEXT NULL"),
            ("P256dh", "ALTER TABLE Devices ADD COLUMN P256dh TEXT NULL"),
            ("AuthKey", "ALTER TABLE Devices ADD COLUMN AuthKey TEXT NULL"),
            ("SessionId", "ALTER TABLE Devices ADD COLUMN SessionId TEXT NULL") })
            if (!columns.Contains(column)) await db.Database.ExecuteSqlRawAsync(sql);
        await connection.CloseAsync();
        await connection.OpenAsync();
        columns.Clear();
        using (var command = connection.CreateCommand()) {
            command.CommandText = "PRAGMA table_info('Employees')";
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) columns.Add(reader.GetString(1));
        }
        foreach (var (column, sql) in new[] {
            ("DisplayName", "ALTER TABLE Employees ADD COLUMN DisplayName TEXT NOT NULL DEFAULT ''"),
            ("Phone", "ALTER TABLE Employees ADD COLUMN Phone TEXT NOT NULL DEFAULT ''") })
            if (!columns.Contains(column)) await db.Database.ExecuteSqlRawAsync(sql);
        await connection.CloseAsync();
        for (var i = 1; i <= 2; i++) {
            var email = i == 1 ? "review@clientstudio.local" : "review2@clientstudio.local";
            if (await db.Employees.AnyAsync(e => e.Email == email)) continue;
            var employee = new Employee { Email = email };
            employee.PasswordHash = new PasswordHasher<Employee>().HashPassword(employee, "Review123!");
            db.Employees.Add(employee);
            var c = new Customer { OwnerId = employee.Id, Name = i == 1 ? "Nguyễn Minh Anh · Mẫu" : "Lê Quang Huy · Mẫu", Phone = i == 1 ? "0900000001" : "0900000002",
                BirthDate = new DateOnly(1990, 10, 20), Status = "purchased", Interests = "Golf, du lịch. Đây là hồ sơ hư cấu để review.",
                Notes = "DỮ LIỆU THỬ — không phải khách hàng thật.", PreferredContact = "Gọi điện buổi chiều" };
            var v = new Vehicle { CustomerId = c.Id, Model = "Mercedes-Benz C 200", Plate = "MẪU-001", DeliveryDate = DateOnly.FromDateTime(DateTime.Now.AddMonths(-1)) };
            c.Vehicles.Add(v); c.SearchText = TextRules.Search($"{c.Name} {c.Phone} {v.Plate}");
            db.Customers.Add(c);
            db.Contacts.Add(new Contact { CustomerId = c.Id, At = DateTimeOffset.UtcNow.AddDays(-2), Channel = "call", Content = "Bản ghi mẫu: khách hài lòng với xe, hẹn trao đổi thêm về tính năng." });
            CareEndpoints.AddReminder(db, new Reminder { CustomerId = c.Id, Content = "Lịch mẫu: hỏi thăm trải nghiệm sử dụng xe", Kind = "afterPurchase",
                LocalDateTime = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Asia/Ho_Chi_Minh").DateTime.AddDays(2), TimeZone = "Asia/Ho_Chi_Minh" });
            await db.SaveChangesAsync();
        }
        var owner = await db.Employees.SingleAsync(e => e.Email == "review@clientstudio.local");
        var samples = new[] {
            ("Trần Hoàng Nam · Mẫu", "0900000003", "Mercedes-Benz E 300 AMG", "purchased", "Golf, nhiếp ảnh", "Chăm sóc sau giao xe", "afterPurchase", 0),
            ("Lê Thảo Nguyên · Mẫu", "0900000004", "Mercedes-Benz GLC 300", "consulting", "Du lịch cùng gia đình", "Tư vấn phiên bản và màu xe", "consulting", 0),
            ("Phạm Quốc Bảo · Mẫu", "0900000005", "Mercedes-Benz S 450", "purchased", "Âm nhạc, công nghệ", "Hẹn kiểm tra bảo dưỡng định kỳ", "maintenance", 1),
            ("Đỗ Khánh Linh · Mẫu", "0900000006", "Mercedes-Benz C 200", "new", "Thiết kế, cà phê", "Trao đổi nhu cầu sử dụng xe", "consulting", 2),
            ("Vũ Đức Minh · Mẫu", "0900000007", "Mercedes-Benz GLE 450", "purchased", "Tennis, khám phá", "Hỏi thăm chuyến đi cùng gia đình", "afterPurchase", 4)
        };
        var index = 2;
        foreach (var (name, phone, model, status, interests, content, kind, days) in samples) {
            if (await db.Customers.AnyAsync(c => c.OwnerId == owner.Id && c.Name == name)) continue;
            var c = new Customer { OwnerId = owner.Id, Name = name, Phone = phone, Status = status,
                BirthDate = new DateOnly(1985 + index, 4 + index, 10 + index), Interests = interests,
                Notes = "DỮ LIỆU THỬ — hồ sơ hư cấu để xem giao diện web.", PreferredContact = "Ưu tiên gọi điện trong giờ làm việc" };
            c.Vehicles.Add(new Vehicle { CustomerId = c.Id, Model = model, Plate = $"MẪU-{index:000}", DeliveryDate = status == "purchased" ? DateOnly.FromDateTime(DateTime.Now.AddMonths(-index)) : null });
            c.SearchText = TextRules.Search($"{name} {phone} {c.Vehicles[0].Plate}"); db.Customers.Add(c);
            db.Contacts.Add(new Contact { CustomerId = c.Id, At = DateTimeOffset.UtcNow.AddDays(-index * 3), Channel = index % 2 == 0 ? "call" : "message", Content = "Bản ghi hư cấu: đã trao đổi nhu cầu và hẹn tiếp tục chăm sóc." });
            var local = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Asia/Ho_Chi_Minh").DateTime.Date.AddDays(days).AddHours(16 + index % 2);
            if (local <= TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Asia/Ho_Chi_Minh").DateTime) local = local.AddDays(1);
            CareEndpoints.AddReminder(db, new Reminder { CustomerId = c.Id, Content = content, Kind = kind, LocalDateTime = local });
            index++; await db.SaveChangesAsync();
        }
    }
}
