using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClientStudio;
using Microsoft.Extensions.DependencyInjection;

namespace ClientStudio.Tests;

public sealed class SqliteStudioFactory() : StudioFactory(sqlite: true);

public class ReviewStorageTests(SqliteStudioFactory factory) : IClassFixture<SqliteStudioFactory>
{
    [Fact]
    public async Task ReviewSeedIsIdempotentAndLoginReadsPersistedPrivateData()
    {
        using var bootstrap = factory.Client();
        using (var scope = factory.Services.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
            await ReviewMode.Initialize(db);
            await ReviewMode.Initialize(db);
        }
        using var first = factory.CreateClient();
        var login = await first.PostAsJsonAsync("/auth/login", new LoginInput("review@clientstudio.local", "Review123!"));
        login.EnsureSuccessStatusCode();
        using var session = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        var token = session.RootElement.GetProperty("token").GetString();
        first.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var customers = (await first.GetFromJsonAsync<List<Customer>>("/api/customers"))!;
        var customer = Assert.Single(customers);
        Assert.Contains("Mẫu", customer.Name);
        var contact = await first.PostAsJsonAsync($"/api/customers/{customer.Id}/contacts", new ContactInput(DateTimeOffset.UtcNow, "call", "Kiểm thử SQLite", null, null));
        contact.EnsureSuccessStatusCode();
        var reminder = await first.PostAsJsonAsync($"/api/customers/{customer.Id}/reminders",
            new ReminderInput("birthday", "Kiểm thử annual", DateTime.Now.AddDays(3), "Asia/Ho_Chi_Minh", "annual", 1, null));
        reminder.EnsureSuccessStatusCode();
        var created = (await reminder.Content.ReadFromJsonAsync<Reminder>())!;
        using var second = factory.CreateClient();
        second.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        Assert.Contains((await second.GetFromJsonAsync<List<Contact>>($"/api/customers/{customer.Id}/contacts"))!, c => c.Content == "Kiểm thử SQLite");
        using var schedules = JsonDocument.Parse(await second.GetStringAsync($"/api/customers/{customer.Id}/reminders"));
        var annual = schedules.RootElement.EnumerateArray().Single(r => r.GetProperty("reminder").GetProperty("id").GetGuid() == created.Id);
        var occurrenceId = annual.GetProperty("occurrences")[0].GetProperty("id").GetGuid();
        (await first.PostAsJsonAsync($"/api/occurrences/{occurrenceId}/complete", new { })).EnsureSuccessStatusCode();
        using var updated = JsonDocument.Parse(await second.GetStringAsync($"/api/customers/{customer.Id}/reminders"));
        var completedAnnual = updated.RootElement.EnumerateArray().Single(r => r.GetProperty("reminder").GetProperty("id").GetGuid() == created.Id);
        Assert.Contains(completedAnnual.GetProperty("occurrences").EnumerateArray(), o => o.GetProperty("state").GetString() == "completed" && o.GetProperty("completedAt").ValueKind == JsonValueKind.String);
        Assert.Contains(completedAnnual.GetProperty("occurrences").EnumerateArray(), o => o.GetProperty("state").GetString() == "pending");
        using var bob = factory.Client("bob");
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/customers/{customer.Id}")).StatusCode);
        (await first.PostAsJsonAsync("/api/logout", new { })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await second.GetAsync("/api/customers")).StatusCode);
    }
}
