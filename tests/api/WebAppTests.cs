using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using ClientStudio;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace ClientStudio.Tests;
public class WebAppTests(SqliteStudioFactory factory) : IClassFixture<SqliteStudioFactory>
{
    static SubscriptionInput Subscription(string suffix) {
        using var ec = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var p = ec.ExportParameters(false);
        static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return new($"https://fcm.googleapis.com/fcm/send/{suffix}", new(Encode([4, ..p.Q.X!, ..p.Q.Y!]), Encode(RandomNumberGenerator.GetBytes(16))));
    }
    [Fact] public async Task BrowserCookiePersistsAndLogoutRevokesSessionAndDevice() {
        using var seed = factory.Client(); using var browser = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        var login = await browser.PostAsJsonAsync("/auth/login", new LoginInput("alice@example.test", "test-password-long")); login.EnsureSuccessStatusCode();
        var cookie = Assert.Single(login.Headers.GetValues("Set-Cookie"));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase); Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase); Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.OK, (await browser.GetAsync("/api/session")).StatusCode);
        var sub = Subscription(Guid.NewGuid().ToString()); (await browser.PostAsJsonAsync("/api/push/subscribe", sub)).EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
        Assert.True((await db.Devices.SingleAsync(d => d.PushToken == Auth.Hash(sub.Endpoint))).Enabled);
        (await browser.PostAsJsonAsync("/api/logout", new { })).EnsureSuccessStatusCode(); db.ChangeTracker.Clear();
        Assert.False((await db.Devices.SingleAsync(d => d.PushToken == Auth.Hash(sub.Endpoint))).Enabled);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/customers")).StatusCode);
    }
    [Theory]
    [InlineData("https://localhost/private")]
    [InlineData("https://fcm.googleapis.com.attacker.invalid/push")]
    [InlineData("http://fcm.googleapis.com/push")]
    [InlineData("https://fcm.googleapis.com:444/push")]
    [InlineData("https://user:pass@fcm.googleapis.com/push")]
    public async Task PushRejectsNonVendorEndpoints(string endpoint) {
        using var alice = factory.Client(); var sub = Subscription("bad") with { Endpoint = endpoint };
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PostAsJsonAsync("/api/push/subscribe", sub)).StatusCode);
    }
    [Fact] public async Task PushRejectsMalformedPublicKeyBeforeItCanBlockTheScheduler() {
        using var alice = factory.Client(); var sub = Subscription("invalid-key");
        var malformed = Convert.ToBase64String(new byte[65]);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PostAsJsonAsync("/api/push/subscribe", sub with { Keys = sub.Keys with { P256dh = malformed } })).StatusCode);
    }
    [Fact] public async Task DeviceRegistrationIsIdempotentAndAnotherOwnerCannotUnsubscribeIt() {
        using var alice = factory.Client(); using var bob = factory.Client("bob"); var sub = Subscription(Guid.NewGuid().ToString());
        (await alice.PostAsJsonAsync("/api/push/subscribe", sub)).EnsureSuccessStatusCode();
        (await alice.PostAsJsonAsync("/api/push/subscribe", sub)).EnsureSuccessStatusCode();
        (await bob.PostAsJsonAsync("/api/push/unsubscribe", new UnsubscribeInput(sub.Endpoint))).EnsureSuccessStatusCode();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
        var device = Assert.Single(await db.Devices.Where(d => d.PushToken == Auth.Hash(sub.Endpoint)).ToListAsync()); Assert.True(device.Enabled); Assert.Equal(factory.Alice, device.OwnerId);
    }
    [Fact] public async Task CrossOriginCookieWritesAreRejected() {
        using var alice = factory.Client(); alice.DefaultRequestHeaders.Add("Origin", "https://unrelated.invalid");
        Assert.Equal(HttpStatusCode.Forbidden, (await alice.PostAsJsonAsync("/api/logout", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await alice.PostAsJsonAsync("/auth/login", new LoginInput("alice@example.test", "test-password-long"))).StatusCode);
    }
    [Fact] public async Task AgendaOnlyContainsOwnedPendingOccurrences() {
        using var alice = factory.Client(); using var bob = factory.Client("bob");
        var create = await alice.PostAsJsonAsync("/api/customers", new CustomerInput("Khách lịch chung", "0911111122", null, "", "", "", "new", [])); create.EnsureSuccessStatusCode(); var c = (await create.Content.ReadFromJsonAsync<Customer>())!;
        (await alice.PostAsJsonAsync($"/api/customers/{c.Id}/reminders", new ReminderInput("other", "Lịch riêng", DateTime.Now.AddDays(1), "Asia/Ho_Chi_Minh", "once", 0, null))).EnsureSuccessStatusCode();
        using var a = JsonDocument.Parse(await alice.GetStringAsync("/api/agenda")); using var b = JsonDocument.Parse(await bob.GetStringAsync("/api/agenda"));
        var item = Assert.Single(a.RootElement.EnumerateArray(), e => e.GetProperty("customerId").GetGuid() == c.Id);
        Assert.DoesNotContain(b.RootElement.EnumerateArray(), e => e.GetProperty("customerId").GetGuid() == c.Id);
        (await alice.PostAsJsonAsync($"/api/occurrences/{item.GetProperty("occurrence").GetProperty("id").GetGuid()}/complete", new { })).EnsureSuccessStatusCode();
        using var after = JsonDocument.Parse(await alice.GetStringAsync("/api/agenda")); Assert.DoesNotContain(after.RootElement.EnumerateArray(), e => e.GetProperty("customerId").GetGuid() == c.Id);
    }
    sealed class RecordingSender : IWebPushSender {
        public readonly List<string> Payloads = []; public bool Fail;
        public Task Send(Device device, string payload, CancellationToken ct) { if (Fail) throw new HttpRequestException("Temporary push outage"); Payloads.Add(payload); return Task.CompletedTask; }
    }
    sealed class WireHandler : HttpMessageHandler {
        public string? Encoding, Authorization, Ttl; public byte[] Body = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Encoding = string.Join(",", request.Content!.Headers.ContentEncoding);
            Authorization = request.Headers.Authorization?.Scheme;
            Ttl = string.Join(",", request.Headers.GetValues("TTL"));
            Body = await request.Content.ReadAsByteArrayAsync(ct);
            return new HttpResponseMessage(HttpStatusCode.Created);
        }
    }
    [Fact] public async Task SenderUsesModernEncryptedWebPushAndVapidForSafariAndAndroid() {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256); var p = key.ExportParameters(true);
        static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Push:PublicKey"] = Encode([4, ..p.Q.X!, ..p.Q.Y!]), ["Push:PrivateKey"] = Encode(p.D!), ["Push:Subject"] = "mailto:admin@example.test"
        }).Build();
        var sub = Subscription("wire-format"); var handler = new WireHandler();
        using var sender = new WebPushSender(config, new HttpClient(handler));
        await sender.Send(new Device { Endpoint = sub.Endpoint, P256dh = sub.Keys.P256dh, AuthKey = sub.Keys.Auth }, "{\"body\":\"Encrypted reminder\"}", default);
        Assert.Equal("aes128gcm", handler.Encoding); Assert.Equal("vapid", handler.Authorization); Assert.Equal("86400", handler.Ttl);
        Assert.True(handler.Body.Length > 86); Assert.DoesNotContain("Encrypted reminder", System.Text.Encoding.UTF8.GetString(handler.Body));
    }
    [Fact] public async Task WorkerRetriesThenSendsOnceAndDoesNotLeakPrivateCustomerDetails() {
        // Dedicated DB avoids unrelated due jobs from other fixture tests.
        await using var isolated = new SqliteStudioFactory(); using var alice = isolated.Client();
        var sub = Subscription("worker"); (await alice.PostAsJsonAsync("/api/push/subscribe", sub)).EnsureSuccessStatusCode();
        using var scope = isolated.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
        var customer = new Customer { OwnerId = isolated.Alice, Name = "PRIVATE CUSTOMER NAME", Phone = "0912345678" }; db.Customers.Add(customer);
        var reminder = new Reminder { CustomerId = customer.Id, Content = "PRIVATE NOTES", LocalDateTime = DateTime.Now.AddDays(1) }; db.Reminders.Add(reminder);
        var occurrence = new Occurrence { ReminderId = reminder.Id, ScheduledAt = DateTimeOffset.UtcNow, OriginalAt = DateTimeOffset.UtcNow, NotifyAt = DateTimeOffset.UtcNow.AddMinutes(-1) }; db.Occurrences.Add(occurrence); await db.SaveChangesAsync();
        var sender = new RecordingSender { Fail = true }; var worker = new PushWorker(isolated.Services.GetRequiredService<IServiceScopeFactory>(), sender, NullLogger<PushWorker>.Instance);
        await worker.RunCycle(db); var job = Assert.Single(await db.Deliveries.ToListAsync()); Assert.Equal("pending", job.State); Assert.Equal(1, job.Attempts); Assert.True(job.RetryAt > DateTimeOffset.UtcNow);
        sender.Fail = false; job.RetryAt = DateTimeOffset.UtcNow.AddSeconds(-1); await db.SaveChangesAsync(); await worker.RunCycle(db); await worker.RunCycle(db);
        var payload = Assert.Single(sender.Payloads); Assert.DoesNotContain("PRIVATE", payload); Assert.Contains(customer.Id.ToString(), payload); Assert.Equal("providerAccepted", job.State);
    }
    [Fact] public async Task ExpiredSessionsNeverReceiveScheduledPush() {
        await using var isolated = new SqliteStudioFactory(); using var alice = isolated.Client();
        (await alice.PostAsJsonAsync("/api/push/subscribe", Subscription("expired"))).EnsureSuccessStatusCode();
        using var scope = isolated.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
        var c = new Customer { OwnerId = isolated.Alice, Name = "Private" }; db.Customers.Add(c); var r = new Reminder { CustomerId = c.Id }; db.Reminders.Add(r);
        db.Occurrences.Add(new Occurrence { ReminderId = r.Id, NotifyAt = DateTimeOffset.UtcNow.AddSeconds(-1) });
        foreach (var s in await db.Sessions.ToListAsync()) s.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1); await db.SaveChangesAsync();
        var sender = new RecordingSender(); var worker = new PushWorker(isolated.Services.GetRequiredService<IServiceScopeFactory>(), sender, NullLogger<PushWorker>.Instance);
        await worker.RunCycle(db); Assert.Empty(sender.Payloads); Assert.Empty(await db.Deliveries.ToListAsync());
    }
}
