using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ClientStudio;
public static class Auth
{
    public const string CookieName = "cliente-session";
    public static string Token(HttpContext ctx) {
        var header = ctx.Request.Headers.Authorization.ToString();
        return header.StartsWith("Bearer ", StringComparison.Ordinal) ? header[7..] : ctx.Request.Cookies[CookieName] ?? "";
    }
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    public static Guid Owner(this HttpContext ctx) => Guid.Parse(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static async Task Populate(HttpContext ctx, StudioDb db, RequestDelegate next)
    {
        var token = Token(ctx);
        if (token.Length > 0)
        {
            var hash = Hash(token);
            var now = DateTimeOffset.UtcNow;
            var owner = await (from s in db.Sessions join u in db.Employees on s.EmployeeId equals u.Id
                where s.TokenHash == hash && s.ExpiresAt > now && u.Enabled select new { u.Id, u.Email })
                .SingleOrDefaultAsync(ctx.RequestAborted);
            if (owner is not null) ctx.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, owner.Id.ToString()), new Claim(ClaimTypes.Email, owner.Email)], "Session"));
        }
        await next(ctx);
    }
    public static async Task Provision(StudioDb db)
    {
        Console.Write("Email nhân viên: ");
        var email = (Console.ReadLine() ?? "").Trim().ToLowerInvariant();
        if (!System.Net.Mail.MailAddress.TryCreate(email, out _) || await db.Employees.AnyAsync(x => x.Email == email))
            throw new InvalidOperationException("Email không hợp lệ hoặc đã tồn tại.");
        Console.Write("Mật khẩu (tối thiểu 12 ký tự): ");
        var password = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace) { if (password.Length > 0) password.Length--; }
            else if (!char.IsControl(key.KeyChar)) password.Append(key.KeyChar);
        }
        Console.WriteLine();
        if (password.Length < 12) throw new InvalidOperationException("Mật khẩu quá ngắn.");
        var user = new Employee { Email = email };
        user.PasswordHash = new PasswordHasher<Employee>().HashPassword(user, password.ToString());
        db.Employees.Add(user); await db.SaveChangesAsync();
        Console.WriteLine("Đã tạo tài khoản nhân viên.");
    }
}
