using ClientStudio;
namespace ClientStudio.Tests;
public class ScheduleTests
{
    [Fact] public void VietnameseSearchAndAgeBoundaries()
    {
        Assert.Equal("dang thi anh", TextRules.Search("Đặng Thị Ánh"));
        Assert.Equal(35, TextRules.Age(new(1990, 10, 7), new(2026, 10, 6)));
        Assert.Equal(36, TextRules.Age(new(1990, 10, 7), new(2026, 10, 7)));
        Assert.Null(TextRules.Age(null, new(2026, 10, 6)));
    }
    [Theory]
    [InlineData("feb28", 2, 28)] [InlineData("mar1", 3, 1)]
    public void LeapDayUsesExplicitPolicy(string policy, int month, int day)
    {
        var reminder = new Reminder { LocalDateTime = new DateTime(2028, 2, 29, 9, 15, 0), Repeat = "annual", LeapDayPolicy = policy };
        Assert.Equal(new DateTime(2029, month, day, 9, 15, 0), Schedule.ForYear(reminder, 2029));
        Assert.Equal(new DateTime(2032, 2, 29, 9, 15, 0), Schedule.ForYear(reminder, 2032));
    }
    [Fact] public void LeapDayCannotBeSilentlyGuessed() => Assert.Throws<ArgumentException>(() => Schedule.ForYear(new Reminder { LocalDateTime = new(2028, 2, 29) }, 2029));
    [Fact] public void RemindersUseVietnamTimeZoneAndCalendarLeadDays()
    {
        var r = new Reminder { LocalDateTime = new(2027, 1, 1, 9, 0, 0), TimeZone = "Asia/Ho_Chi_Minh", LeadDays = 3 };
        var occurrence = Assert.Single(Schedule.Generate(r, DateTimeOffset.Parse("2026-10-06T00:00:00Z")));
        Assert.Equal(DateTimeOffset.Parse("2027-01-01T02:00:00Z"), occurrence.ScheduledAt);
        Assert.Equal(DateTimeOffset.Parse("2026-12-29T02:00:00Z"), occurrence.NotifyAt);
    }
}
