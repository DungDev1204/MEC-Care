namespace ClientStudio;

public record LoginInput(string Email, string Password, string? PushToken = null);
public record VehicleInput(Guid? Id, string Model, string Plate, DateOnly? DeliveryDate);
public record CustomerInput(string Name, string Phone, DateOnly? BirthDate, string Interests, string Notes,
    string PreferredContact, string Status, List<VehicleInput> Vehicles, bool ConfirmDuplicate = false);
public record ReminderInput(string Kind, string Content, DateTime LocalDateTime, string TimeZone,
    string Repeat, int LeadDays, string? LeapDayPolicy);
public record ContactInput(DateTimeOffset At, string Channel, string Content, Guid? OccurrenceId, ReminderInput? NextReminder);
public record SnoozeInput(DateTime LocalDateTime, string TimeZone);
public record DeviceInput(string PushToken);
public record CaptionInput(string Caption);

public static class Validation
{
    public static Dictionary<string, string[]> Customer(CustomerInput x)
    {
        var e = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(x.Name) || x.Name.Length > 200) e["name"] = ["Nhập họ tên, tối đa 200 ký tự."];
        if (TextRules.Phone(x.Phone).Length is < 8 or > 15) e["phone"] = ["Số điện thoại cần từ 8 đến 15 chữ số."];
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Asia/Ho_Chi_Minh").DateTime);
        if (x.BirthDate > today) e["birthDate"] = ["Ngày sinh không được ở tương lai."];
        if (x.Status is not ("new" or "consulting" or "purchased")) e["status"] = ["Trạng thái không hợp lệ."];
        if (x.Vehicles.Count > 20 || x.Vehicles.Any(v => v.Model.Length > 200 || v.Plate.Length > 32)) e["vehicles"] = ["Thông tin xe quá dài hoặc quá nhiều xe."];
        if (x.Notes.Length > 10000 || x.Interests.Length > 10000 || x.PreferredContact.Length > 500) e["notes"] = ["Nội dung quá dài."];
        return e;
    }
    public static Dictionary<string, string[]> Reminder(ReminderInput x)
    {
        var e = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(x.Content) || x.Content.Length > 2000) e["content"] = ["Nhập nội dung nhắc, tối đa 2000 ký tự."];
        if (x.Kind is not ("birthday" or "afterPurchase" or "maintenance" or "delivery" or "consulting" or "other")) e["kind"] = ["Loại nhắc không hợp lệ."];
        if (x.Repeat is not ("once" or "annual")) e["repeat"] = ["Lặp lại không hợp lệ."];
        if (x.LeadDays is not (0 or 1 or 3)) e["leadDays"] = ["Chọn nhắc trước 0, 1 hoặc 3 ngày."];
        if (x.Repeat == "annual" && x.LocalDateTime.Month == 2 && x.LocalDateTime.Day == 29 && x.LeapDayPolicy is not ("feb28" or "mar1"))
            e["leapDayPolicy"] = ["Chọn 28/02 hoặc 01/03 cho năm không nhuận."];
        try { if (Schedule.ToUtc(x.LocalDateTime, x.TimeZone) <= DateTimeOffset.UtcNow) e["localDateTime"] = ["Chọn ngày giờ trong tương lai."]; }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException)
        { e["localDateTime"] = ["Ngày giờ hoặc múi giờ không hợp lệ."]; }
        return e;
    }
    public static Reminder NewReminder(Guid customerId, ReminderInput x) => new() { CustomerId = customerId,
        Kind = x.Kind, Content = x.Content.Trim(), LocalDateTime = DateTime.SpecifyKind(x.LocalDateTime, DateTimeKind.Unspecified),
        TimeZone = x.TimeZone, Repeat = x.Repeat, LeadDays = x.LeadDays, LeapDayPolicy = x.LeapDayPolicy };
}
