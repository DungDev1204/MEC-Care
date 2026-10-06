using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClientStudio;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ClientStudio.Tests;

public class StudioFactory : WebApplicationFactory<Program>
{
    readonly bool sqlite;
    public StudioFactory() { }
    protected StudioFactory(bool sqlite) { this.sqlite = sqlite; }
    readonly string database = Guid.NewGuid().ToString();
    readonly string storage = Path.Combine(Path.GetTempPath(), "client-studio-tests", Guid.NewGuid().ToString());
    public Guid Alice { get; } = Guid.NewGuid();
    public Guid Bob { get; } = Guid.NewGuid();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> {
            ["Push:Enabled"] = "false", ["Storage:Path"] = storage
        }));
        builder.ConfigureServices(services => {
            services.RemoveAll<StudioDb>(); services.RemoveAll<DbContextOptions<StudioDb>>(); services.RemoveAll<IDbContextOptionsConfiguration<StudioDb>>();
            if (sqlite) {
                Directory.CreateDirectory(storage);
                services.AddDbContext<StudioDb>(o => o.UseSqlite($"Data Source={Path.Combine(storage, "review.db")};Pooling=False"));
            } else services.AddDbContext<StudioDb>(o => o.UseInMemoryDatabase(database));
        });
    }
    public HttpClient Client(string token = "alice")
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
        if (sqlite) db.Database.EnsureCreated();
        if (!db.Employees.Any()) {
            foreach (var (id, name) in new[] { (Alice, "alice"), (Bob, "bob") }) {
                var employee = new Employee { Id = id, Email = name + "@example.test" };
                employee.PasswordHash = new PasswordHasher<Employee>().HashPassword(employee, "test-password-long");
                db.Employees.Add(employee); db.Sessions.Add(new LoginSession { EmployeeId = id, TokenHash = Auth.Hash(name), ExpiresAt = DateTimeOffset.UtcNow.AddDays(1) });
            }
            db.SaveChanges();
        }
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token); return client;
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(storage)) Directory.Delete(storage, true);
    }
}
public class ApiTests : IClassFixture<StudioFactory>
{
    readonly StudioFactory factory;
    public ApiTests(StudioFactory factory) { this.factory = factory; }
    static CustomerInput Customer(string phone) => new("Nguyễn Minh Ánh", phone, new DateOnly(1990, 10, 7), "Golf", "Ghi chú riêng", "Buổi chiều", "purchased", [new(null, "Mercedes C200", "51A-12345", new DateOnly(2025, 1, 1))]);
    static ReminderInput Annual() => new("birthday", "Gọi điện chúc sinh nhật", DateTime.Now.AddDays(3), "Asia/Ho_Chi_Minh", "annual", 1, null);
    async Task<ClientStudio.Customer> Create(HttpClient client) {
        var response = await client.PostAsJsonAsync("/api/customers", Customer(Random.Shared.NextInt64(100000000, 999999999).ToString())); response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ClientStudio.Customer>())!;
    }
    [Fact] public async Task LoginAndUnauthenticatedRequests()
    {
        using var client = factory.Client(); client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/customers")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/login", new LoginInput("alice@example.test", "wrong"))).StatusCode);
        var response = await client.PostAsJsonAsync("/auth/login", new LoginInput("alice@example.test", "test-password-long")); response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        client.DefaultRequestHeaders.Authorization = new("Bearer", json.RootElement.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/customers")).StatusCode);
    }
    [Fact] public async Task EmployeesCannotReadOrMutateEachOthersCustomersPhotosAndReminders()
    {
        using var alice = factory.Client(); using var bob = factory.Client("bob"); var customer = await Create(alice);
        var reminderResponse = await alice.PostAsJsonAsync($"/api/customers/{customer.Id}/reminders", Annual()); reminderResponse.EnsureSuccessStatusCode();
        var reminder = (await reminderResponse.Content.ReadFromJsonAsync<Reminder>())!;
        foreach (var suffix in new[] { "", "/photos", "/contacts", "/reminders" }) Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/customers/{customer.Id}{suffix}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"/api/customers/{customer.Id}", Customer("0901234567"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/api/reminders/{reminder.Id}")).StatusCode);
        var list = (await bob.GetFromJsonAsync<List<ClientStudio.Customer>>("/api/customers"))!;
        Assert.DoesNotContain(list, c => c.Id == customer.Id);
        using var photo = new MultipartFormDataContent();
        photo.Add(new ByteArrayContent(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4X8AAAAASUVORK5CYII=")), "file", "test.png");
        var photoResponse = await alice.PostAsync($"/api/customers/{customer.Id}/photos", photo); photoResponse.EnsureSuccessStatusCode();
        var uploaded = (await photoResponse.Content.ReadFromJsonAsync<Photo>())!;
        Assert.Equal(HttpStatusCode.OK, (await alice.GetAsync($"/api/photos/{uploaded.Id}/file")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/photos/{uploaded.Id}/file")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/api/photos/{uploaded.Id}")).StatusCode);
    }
    [Fact] public async Task SameNamesStayIndependentAndSearchSupportsVietnameseWithoutAccents()
    {
        using var client = factory.Client(); var a = await Create(client); var b = await Create(client);
        Assert.NotEqual(a.Id, b.Id);
        var response = await client.PutAsJsonAsync($"/api/customers/{a.Id}", Customer(a.Phone) with { Notes = "Chỉ cập nhật A" }); response.EnsureSuccessStatusCode();
        Assert.Equal("Ghi chú riêng", (await client.GetFromJsonAsync<ClientStudio.Customer>($"/api/customers/{b.Id}"))!.Notes);
        var found = (await client.GetFromJsonAsync<List<ClientStudio.Customer>>("/api/customers?search=nguyen%20minh%20anh"))!;
        Assert.Contains(found, c => c.Id == a.Id); Assert.Contains(found, c => c.Id == b.Id);
        Assert.Contains((await client.GetFromJsonAsync<List<ClientStudio.Customer>>("/api/customers?search=51a-12345"))!, c => c.Id == a.Id);
    }
    [Fact] public async Task DuplicatePhoneRequiresExplicitConfirmationAndDoesNotOverwrite()
    {
        using var client = factory.Client(); var original = await Create(client);
        var input = Customer(original.Phone) with { Name = "Người khác" };
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/customers", input)).StatusCode);
        var response = await client.PostAsJsonAsync("/api/customers", input with { ConfirmDuplicate = true }); response.EnsureSuccessStatusCode();
        Assert.NotEqual(original.Id, (await response.Content.ReadFromJsonAsync<ClientStudio.Customer>())!.Id);
        Assert.Equal(original.Name, (await client.GetFromJsonAsync<ClientStudio.Customer>($"/api/customers/{original.Id}"))!.Name);
    }
    [Fact] public async Task CompletingAnnualOccurrencePreservesFutureYearsAndCreatesFollowup()
    {
        using var client = factory.Client(); var customer = await Create(client);
        (await client.PostAsJsonAsync($"/api/customers/{customer.Id}/reminders", Annual())).EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
        var reminder = db.Reminders.Single(r => r.CustomerId == customer.Id);
        var first = db.Occurrences.Where(o => o.ReminderId == reminder.Id).OrderBy(o => o.ScheduledAt).First();
        var next = Annual() with { Repeat = "once", Kind = "afterPurchase", Content = "Hỏi thăm trải nghiệm sử dụng" };
        var response = await client.PostAsJsonAsync($"/api/customers/{customer.Id}/contacts", new ContactInput(DateTimeOffset.UtcNow, "call", "Khách dùng xe tốt", first.Id, next)); response.EnsureSuccessStatusCode();
        db.ChangeTracker.Clear();
        Assert.Equal("completed", db.Occurrences.Single(o => o.Id == first.Id).State);
        Assert.True(db.Reminders.Single(r => r.Id == reminder.Id).Active);
        Assert.True(db.Occurrences.Any(o => o.ReminderId == reminder.Id && o.State == "pending" && o.Id != first.Id));
        Assert.Equal(2, db.Reminders.Count(r => r.CustomerId == customer.Id)); Assert.Single(db.Contacts.Where(c => c.CustomerId == customer.Id));
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/occurrences/{first.Id}/complete", new { })).StatusCode);
    }
    [Fact] public async Task NullOrMissingRequiredInputIsRejected()
    {
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/customers", new { name = (string?)null })).StatusCode);
    }
}
