using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ClientStudio;

public sealed class Employee
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool Enabled { get; set; } = true;
}
public sealed class LoginSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EmployeeId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
}
public sealed class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = "";
    public string SearchText { get; set; } = "";
    public string Phone { get; set; } = "";
    public DateOnly? BirthDate { get; set; }
    public string Interests { get; set; } = "";
    public string Notes { get; set; } = "";
    public string PreferredContact { get; set; } = "";
    public string Status { get; set; } = "new";
    public Guid? AvatarId { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<Vehicle> Vehicles { get; set; } = [];
}
public sealed class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public string Model { get; set; } = "";
    public string Plate { get; set; } = "";
    public DateOnly? DeliveryDate { get; set; }
}
public sealed class Photo
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string Caption { get; set; } = "";
    public bool IsAvatar { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Reminder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public string Kind { get; set; } = "other";
    public string Content { get; set; } = "";
    public DateTime LocalDateTime { get; set; }
    public string TimeZone { get; set; } = "Asia/Ho_Chi_Minh";
    public string Repeat { get; set; } = "once";
    public int LeadDays { get; set; }
    public string? LeapDayPolicy { get; set; }
    public bool Active { get; set; } = true;
    public int Revision { get; set; } = 1;
}
public sealed class Occurrence
{
    public byte[] RowVersion { get; set; } = [];
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReminderId { get; set; }
    public int Revision { get; set; }
    public DateTimeOffset OriginalAt { get; set; }
    public DateTimeOffset ScheduledAt { get; set; }
    public DateTimeOffset NotifyAt { get; set; }
    public string State { get; set; } = "pending";
    public DateTimeOffset? CompletedAt { get; set; }
}
public sealed class Contact
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public DateTimeOffset At { get; set; }
    public string Channel { get; set; } = "call";
    public string Content { get; set; } = "";
    public Guid? OccurrenceId { get; set; }
}
public sealed class Device
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerId { get; set; }
    public string PushToken { get; set; } = "";
    public string? Endpoint { get; set; }
    public string? P256dh { get; set; }
    public string? AuthKey { get; set; }
    public Guid? SessionId { get; set; }
    public bool Enabled { get; set; } = true;
}
public sealed class Delivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OccurrenceId { get; set; }
    public Guid DeviceId { get; set; }
    public string State { get; set; } = "pending";
    public int Attempts { get; set; }
    public DateTimeOffset RetryAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LeaseUntil { get; set; }
    public string? ReceiptId { get; set; }
}
public sealed class StudioDb(DbContextOptions<StudioDb> options) : DbContext(options)
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<LoginSession> Sessions => Set<LoginSession>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<Occurrence> Occurrences => Set<Occurrence>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Employee>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<Employee>().Property(x => x.DisplayName).HasMaxLength(200);
        b.Entity<Employee>().Property(x => x.Phone).HasMaxLength(32);
        b.Entity<Employee>().HasIndex(x => x.Email).IsUnique();
        b.Entity<LoginSession>().Property(x => x.TokenHash).HasMaxLength(64);
        b.Entity<LoginSession>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<LoginSession>().HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Customer>().HasOne<Employee>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Device>().HasOne<Employee>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Customer>().Property(x => x.Name).HasMaxLength(200);
        b.Entity<Customer>().Property(x => x.Phone).HasMaxLength(32);
        b.Entity<Customer>().HasIndex(x => new { x.OwnerId, x.Phone });
        b.Entity<Customer>().Property(x => x.SearchText).HasMaxLength(1000);
        b.Entity<Customer>().HasMany(x => x.Vehicles).WithOne().HasForeignKey(x => x.CustomerId);
        b.Entity<Photo>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Reminder>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Contact>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Contact>().HasOne<Occurrence>().WithMany().HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Occurrence>().HasOne<Reminder>().WithMany().HasForeignKey(x => x.ReminderId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Occurrence>().HasIndex(x => new { x.ReminderId, x.Revision, x.OriginalAt }).IsUnique();
        b.Entity<Occurrence>().HasIndex(x => new { x.State, x.NotifyAt });
        if (Database.IsSqlite()) b.Entity<Occurrence>().Property(x => x.RowVersion).IsConcurrencyToken().ValueGeneratedNever();
        else b.Entity<Occurrence>().Property(x => x.RowVersion).IsRowVersion();
        b.Entity<Device>().Property(x => x.PushToken).HasMaxLength(300);
        b.Entity<Device>().HasIndex(x => x.PushToken).IsUnique();
        b.Entity<Device>().Property(x => x.Endpoint).HasMaxLength(2048);
        b.Entity<Device>().Property(x => x.P256dh).HasMaxLength(128);
        b.Entity<Device>().Property(x => x.AuthKey).HasMaxLength(64);
        b.Entity<Device>().HasOne<LoginSession>().WithMany().HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Delivery>().HasIndex(x => new { x.OccurrenceId, x.DeviceId }).IsUnique();
        b.Entity<Delivery>().HasOne<Occurrence>().WithMany().HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Delivery>().HasOne<Device>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict);
        if (Database.IsSqlite()) {
            var utcTicks = new ValueConverter<DateTimeOffset, long>(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            foreach (var property in b.Model.GetEntityTypes().SelectMany(e => e.GetProperties()))
                if (property.ClrType == typeof(DateTimeOffset) || property.ClrType == typeof(DateTimeOffset?)) property.SetValueConverter(utcTicks);
        }
    }
    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        if (Database.IsSqlite())
            foreach (var entry in ChangeTracker.Entries<Occurrence>().Where(e => e.State is EntityState.Added or EntityState.Modified)) entry.Entity.RowVersion = Guid.NewGuid().ToByteArray();
        return base.SaveChangesAsync(ct);
    }
}
public static class TextRules
{
    public static string Search(string input) => string.Concat(input.Normalize(NormalizationForm.FormD)
        .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark))
        .Replace('đ', 'd').Replace('Đ', 'D').ToLowerInvariant();
    public static string Phone(string input) => string.Concat(input.Where(char.IsDigit));
    public static int? Age(DateOnly? birth, DateOnly today) => birth is null ? null :
        today.Year - birth.Value.Year - (today.Month < birth.Value.Month || (today.Month == birth.Value.Month && today.Day < birth.Value.Day) ? 1 : 0);
}
public static class Schedule
{
    public static DateTimeOffset ToUtc(DateTime local, string zone)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(zone);
        local = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        if (tz.IsInvalidTime(local) || tz.IsAmbiguousTime(local))
            throw new ArgumentException("Giờ này không rõ ràng trong múi giờ đã chọn. Hãy chọn giờ khác.");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, tz));
    }
    public static DateTime ForYear(Reminder r, int year)
    {
        var d = r.LocalDateTime;
        if (d.Month == 2 && d.Day == 29 && !DateTime.IsLeapYear(year))
        {
            if (r.LeapDayPolicy is not ("feb28" or "mar1")) throw new ArgumentException("Cần chọn quy tắc ngày 29/02.");
            return new DateTime(year, r.LeapDayPolicy == "feb28" ? 2 : 3, r.LeapDayPolicy == "feb28" ? 28 : 1, d.Hour, d.Minute, 0);
        }
        return new DateTime(year, d.Month, d.Day, d.Hour, d.Minute, 0);
    }
    public static IEnumerable<Occurrence> Generate(Reminder r, DateTimeOffset now)
    {
        var localNow = TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(r.TimeZone));
        var start = r.Repeat == "once" ? r.LocalDateTime.Year : Math.Max(r.LocalDateTime.Year, localNow.Year);
        for (var y = start; y <= (r.Repeat == "once" ? start : start + 2); y++)
        {
            var local = r.Repeat == "once" ? r.LocalDateTime : ForYear(r, y);
            var at = ToUtc(local, r.TimeZone);
            if (at < ToUtc(r.LocalDateTime, r.TimeZone) || (r.Repeat == "annual" && at < now)) continue;
            yield return new Occurrence { ReminderId = r.Id, Revision = r.Revision, OriginalAt = at, ScheduledAt = at,
                NotifyAt = ToUtc(local.AddDays(-r.LeadDays), r.TimeZone) };
        }
    }
}
