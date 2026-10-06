using System.Threading.RateLimiting;
using ClientStudio;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true);
if (builder.Environment.IsDevelopment()) builder.Configuration.AddUserSecrets<Program>(optional: true);
builder.Configuration.AddEnvironmentVariables();
var review = builder.Configuration.GetValue<bool>("Review:Enabled");
if (review && !builder.Environment.IsDevelopment()) throw new InvalidOperationException("Review mode is only available in Development.");
if (review) {
    var reviewDirectory = Path.Combine(builder.Environment.ContentRootPath, "review-data");
    Directory.CreateDirectory(reviewDirectory);
    builder.Configuration["Storage:Path"] = Path.Combine(reviewDirectory, "photos");
    builder.Services.AddDbContext<StudioDb>(o => o.UseSqlite($"Data Source={Path.Combine(reviewDirectory, "review.db")}"));
    builder.Services.AddCors(o => o.AddPolicy("review", p => p.WithOrigins(ReviewMode.BrowserOrigins()).AllowAnyHeader().AllowAnyMethod()));
} else {
var sqlConnection = new SqlConnectionStringBuilder(builder.Configuration.GetConnectionString("SqlServer")
    ?? "Server=localhost;Database=ClientStudio;Integrated Security=true;Encrypt=true");
if (builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("SqlServer:TrustServerCertificateInDevelopment"))
    sqlConnection.TrustServerCertificate = true;
builder.Services.AddDbContext<StudioDb>(o => o.UseSqlServer(sqlConnection.ConnectionString,
    sql => sql.EnableRetryOnFailure()));
}
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o => {
    o.SerializerOptions.RespectNullableAnnotations = true;
    o.SerializerOptions.RespectRequiredConstructorParameters = true;
});
builder.Services.AddRateLimiter(o => o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
    ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions {
        PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })));
builder.Services.AddHttpClient("expo", c => {
    c.BaseAddress = new Uri("https://exp.host/--/api/v2/push/"); c.Timeout = TimeSpan.FromSeconds(20);
    var accessToken = builder.Configuration["Push:AccessToken"];
    if (!string.IsNullOrWhiteSpace(accessToken)) c.DefaultRequestHeaders.Authorization = new("Bearer", accessToken);
});
if (!review && builder.Configuration.GetValue<bool>("Push:Enabled")) builder.Services.AddHostedService<PushWorker>();
var app = builder.Build();
if (review) {
    using var scope = app.Services.CreateScope();
    await ReviewMode.Initialize(scope.ServiceProvider.GetRequiredService<StudioDb>());
    app.UseCors("review");
    app.Logger.LogInformation("REVIEW MODE: isolated local data, sample accounts, remote notifications disabled.");
}
if (args.Contains("--provision-user")) {
    using var scope = app.Services.CreateScope();
    await Auth.Provision(scope.ServiceProvider.GetRequiredService<StudioDb>()); return;
}
app.UseExceptionHandler();
app.Use(async (ctx, next) => {
    try { await next(ctx); }
    catch (DbUpdateConcurrencyException) { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { message = "Dữ liệu đã thay đổi ở thiết bị khác. Tải lại để xem trạng thái mới." }); }
});
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseRateLimiter();
app.Use(async (ctx, next) => await Auth.Populate(ctx, ctx.RequestServices.GetRequiredService<StudioDb>(), next));
app.MapGet("/health", () => Results.Ok(new { status = "running", mode = review ? "review" : "sqlServer" }));
app.MapPost("/auth/login", async (LoginInput input, StudioDb db) => {
    if (input.Email.Length > 254 || input.Password.Length > 256) return Results.Unauthorized();
    var user = await db.Employees.SingleOrDefaultAsync(x => x.Email == input.Email.Trim().ToLowerInvariant() && x.Enabled);
    var hasher = new PasswordHasher<Employee>();
    if (user is null) { hasher.HashPassword(new Employee(), input.Password); return Results.Unauthorized(); }
    var result = hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password);
    if (result == PasswordVerificationResult.Failed) return Results.Unauthorized();
    if (result == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, input.Password);
    if (input.PushToken is not null) {
        var device = await db.Devices.SingleOrDefaultAsync(d => d.PushToken == input.PushToken);
        if (device is not null) { device.OwnerId = user.Id; device.Enabled = false; }
    }
    var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
    var expiry = DateTimeOffset.UtcNow.AddDays(7);
    db.Sessions.Add(new LoginSession { EmployeeId = user.Id, TokenHash = Auth.Hash(token), ExpiresAt = expiry });
    await db.SaveChangesAsync(); return Results.Ok(new { token, expiresAt = expiry, email = user.Email });
}).RequireRateLimiting("login");
var api = app.MapGroup("/api");
api.AddEndpointFilter(async (ctx, next) => ctx.HttpContext.User.Identity?.IsAuthenticated == true
    ? await next(ctx) : Results.Unauthorized());
api.MapPost("/logout", async (HttpContext ctx, StudioDb db) => {
    var hash = Auth.Hash(ctx.Request.Headers.Authorization.ToString()[7..]);
    await db.Sessions.Where(s => s.TokenHash == hash).ExecuteDeleteAsync(); return Results.NoContent();
});
api.MapPost("/devices", async (DeviceInput input, HttpContext ctx, StudioDb db) => {
    if (!(input.PushToken.StartsWith("ExponentPushToken[") || input.PushToken.StartsWith("ExpoPushToken[")) || input.PushToken.Length > 300)
        return Results.BadRequest(new { message = "Token thông báo không hợp lệ." });
    var device = await db.Devices.SingleOrDefaultAsync(x => x.PushToken == input.PushToken);
    if (device is null) db.Devices.Add(new Device { OwnerId = ctx.Owner(), PushToken = input.PushToken });
    else { device.OwnerId = ctx.Owner(); device.Enabled = true; }
    await db.SaveChangesAsync(); return Results.NoContent();
});
api.MapPost("/devices/unregister", async (DeviceInput input, HttpContext ctx, StudioDb db) => {
    await db.Devices.Where(d => d.OwnerId == ctx.Owner() && d.PushToken == input.PushToken).ExecuteUpdateAsync(s => s.SetProperty(d => d.Enabled, false));
    return Results.NoContent();
});
CustomerEndpoints.Map(api); CareEndpoints.Map(api);
app.Run();
public partial class Program;
