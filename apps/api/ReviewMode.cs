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
    }
}
