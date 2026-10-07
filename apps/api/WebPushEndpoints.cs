using Microsoft.EntityFrameworkCore;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace ClientStudio;
public record SubscriptionKeys(string P256dh, string Auth);
public record SubscriptionInput(string Endpoint, SubscriptionKeys Keys);
public record UnsubscribeInput(string Endpoint);

public static class WebPushSettings
{
    public static void CreateKeys(string root) {
        var path = Path.Combine(root, "appsettings.Local.json");
        var settings = File.Exists(path) ? JsonNode.Parse(File.ReadAllText(path))!.AsObject() : new JsonObject();
        var push = settings["Push"] as JsonObject ?? new JsonObject();
        if (!string.IsNullOrWhiteSpace(push["PublicKey"]?.GetValue<string>()) || !string.IsNullOrWhiteSpace(push["PrivateKey"]?.GetValue<string>())) {
            Console.WriteLine("Web Push keys already exist. Existing subscriptions depend on these keys; no change was made."); return;
        }
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parameters = key.ExportParameters(true);
        push["PublicKey"] = Encode([4, .. parameters.Q.X!, .. parameters.Q.Y!]);
        push["PrivateKey"] = Encode(parameters.D!);
        push["Subject"] ??= ""; push["Enabled"] = false;
        settings["Push"] = push;
        File.WriteAllText(path, settings.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine("Web Push keys saved to ignored appsettings.Local.json. Set Push:Subject before enabling push. Private key was not printed.");
    }
    public static void Validate(IConfiguration config) {
        if (!KeyValid(config["Push:PublicKey"] ?? "", 65) || !KeyValid(config["Push:PrivateKey"] ?? "", 32) ||
            !(config["Push:Subject"]?.StartsWith("mailto:") == true || config["Push:Subject"]?.StartsWith("https://") == true))
            throw new InvalidOperationException("Web Push requires Push:PublicKey, Push:PrivateKey and Push:Subject (mailto: or HTTPS).");
    }
    // Restrict outgoing requests to browser vendors; arbitrary URLs can expose the internal network.
    public static bool EndpointAllowed(string endpoint) => endpoint.Length <= 2048 && Uri.TryCreate(endpoint, UriKind.Absolute, out var u)
        && u.Scheme == "https" && u.IsDefaultPort && string.IsNullOrEmpty(u.UserInfo) && string.IsNullOrEmpty(u.Fragment)
        && (u.Host == "fcm.googleapis.com" || u.Host == "updates.push.services.mozilla.com" || u.Host.EndsWith(".push.apple.com", StringComparison.Ordinal)
            || u.Host.EndsWith(".notify.windows.com", StringComparison.Ordinal));
    public static bool KeyValid(string key, int size) {
        try {
            var decoded = Convert.FromBase64String(key.Replace('-', '+').Replace('_', '/').PadRight((key.Length + 3) / 4 * 4, '='));
            if (decoded.Length != size) return false;
            if (size == 65) {
                if (decoded[0] != 4) return false;
                using var keyPair = ECDiffieHellman.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = decoded[1..33], Y = decoded[33..65] } });
            }
            return true;
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException or ArgumentException) { return false; }
    }
    static string Encode(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
public static class WebPushEndpoints
{
    public static void Map(RouteGroupBuilder api) {
        api.MapGet("/push/config", (IConfiguration config) => Results.Ok(new {
            enabled = config.GetValue<bool>("Push:Enabled") && !config.GetValue<bool>("Review:Enabled"),
            publicKey = config.GetValue<bool>("Push:Enabled") ? config["Push:PublicKey"] : null
        }));
        api.MapPost("/push/subscribe", async (SubscriptionInput input, HttpContext ctx, StudioDb db) => {
            if (!WebPushSettings.EndpointAllowed(input.Endpoint) || input.Keys.P256dh.Length > 128 || input.Keys.Auth.Length > 64
                || !WebPushSettings.KeyValid(input.Keys.P256dh, 65) || !WebPushSettings.KeyValid(input.Keys.Auth, 16))
                return Results.BadRequest(new { message = "Đăng ký thông báo không hợp lệ. Hãy thử đăng ký lại trên trình duyệt." });
            var hash = Auth.Hash(input.Endpoint);
            var device = await db.Devices.SingleOrDefaultAsync(d => d.PushToken == hash);
            var sessionHash = Auth.Hash(Auth.Token(ctx));
            var session = await db.Sessions.SingleAsync(s => s.TokenHash == sessionHash);
            if (device is null) { device = new Device { PushToken = hash }; db.Devices.Add(device); }
            else if (device.OwnerId != ctx.Owner()) db.Deliveries.RemoveRange(await db.Deliveries.Where(d => d.DeviceId == device.Id).ToListAsync());
            device.OwnerId = ctx.Owner(); device.Endpoint = input.Endpoint; device.P256dh = input.Keys.P256dh;
            device.AuthKey = input.Keys.Auth; device.Enabled = true; device.SessionId = session.Id;
            await db.SaveChangesAsync(); return Results.NoContent();
        });
        api.MapPost("/push/unsubscribe", async (UnsubscribeInput input, HttpContext ctx, StudioDb db) => {
            var hash = Auth.Hash(input.Endpoint);
            foreach (var device in await db.Devices.Where(d => d.OwnerId == ctx.Owner() && d.PushToken == hash).ToListAsync()) device.Enabled = false;
            await db.SaveChangesAsync(); return Results.NoContent();
        });
    }
}
public interface IWebPushSender { Task Send(Device device, string payload, CancellationToken ct); }
public sealed class WebPushSender : IWebPushSender, IDisposable
{
    readonly IConfiguration config;
    readonly HttpClient http;
    readonly PushServiceClient client;
    public WebPushSender(IConfiguration config) : this(config, new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(20) }) { }
    public WebPushSender(IConfiguration config, HttpClient http) {
        this.config = config; this.http = http;
        // The durable worker owns retry scheduling; the HTTP client must not retry indefinitely.
        client = new PushServiceClient(http) { AutoRetryAfter = false };
    }
    public async Task Send(Device device, string payload, CancellationToken ct) {
        using var authentication = new VapidAuthentication(config["Push:PublicKey"]!, config["Push:PrivateKey"]!) { Subject = config["Push:Subject"]! };
        var subscription = new PushSubscription { Endpoint = device.Endpoint!, Keys = new Dictionary<string, string> { ["p256dh"] = device.P256dh!, ["auth"] = device.AuthKey! } };
        var message = new PushMessage(payload) { TimeToLive = 86400, Urgency = PushMessageUrgency.High };
        await client.RequestPushMessageDeliveryAsync(subscription, message, authentication, VapidAuthenticationScheme.Vapid, ct);
    }
    public void Dispose() => http.Dispose();
}
