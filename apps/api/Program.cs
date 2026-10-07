using System.Threading.RateLimiting;
using ClientStudio;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
if (args.Contains("--create-push-keys")) { WebPushSettings.CreateKeys(builder.Environment.ContentRootPath); return; }
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
builder.Services.AddSingleton<IWebPushSender, WebPushSender>();
if (!review && builder.Configuration.GetValue<bool>("Push:Enabled")) {
    WebPushSettings.Validate(builder.Configuration);
    builder.Services.AddHostedService<PushWorker>();
}
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
    if (ctx.Request.Path.StartsWithSegments("/api") || ctx.Request.Path.StartsWithSegments("/auth"))
        ctx.Response.Headers.CacheControl = "no-store";
    await next(ctx);
});
app.Use(async (ctx, next) => {
    try { await next(ctx); }
    catch (DbUpdateConcurrencyException) { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { message = "Dữ liệu đã thay đổi ở thiết bị khác. Tải lại để xem trạng thái mới." }); }
});
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseRateLimiter();
// Cookie-authenticated writes are same-origin only. JSON APIs also reject form posts.
app.Use(async (ctx, next) => {
    if (ctx.Request.Method is not ("GET" or "HEAD" or "OPTIONS") && ctx.Request.Headers.TryGetValue("Origin", out var origin)
        && !(review && ReviewMode.BrowserOrigins().Contains(origin.ToString()))
        && (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Authority != ctx.Request.Host.Value || uri.Scheme != ctx.Request.Scheme)) {
        ctx.Response.StatusCode = 403; return;
    }
    await next(ctx);
});
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = ctx => {
    if (ctx.File.Name is "sw.js" or "index.html") ctx.Context.Response.Headers.CacheControl = "no-cache";
}});
app.Use(async (ctx, next) => await Auth.Populate(ctx, ctx.RequestServices.GetRequiredService<StudioDb>(), next));
app.MapGet("/health", () => Results.Ok(new { status = "running", mode = review ? "review" : "sqlServer" }));
app.MapPost("/auth/login", async (LoginInput input, HttpContext ctx, StudioDb db) => {
    if (input.Email.Length > 254 || input.Password.Length > 256) return Results.Unauthorized();
    var user = await db.Employees.SingleOrDefaultAsync(x => x.Email == input.Email.Trim().ToLowerInvariant() && x.Enabled);
    var hasher = new PasswordHasher<Employee>();
    if (user is null) { hasher.HashPassword(new Employee(), input.Password); return Results.Unauthorized(); }
    var result = hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password);
    if (result == PasswordVerificationResult.Failed) return Results.Unauthorized();
    if (result == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, input.Password);
    var previousHash = Auth.Hash(Auth.Token(ctx));
    var previous = await db.Sessions.SingleOrDefaultAsync(s => s.TokenHash == previousHash);
    if (previous is not null) {
        foreach (var device in await db.Devices.Where(d => d.SessionId == previous.Id).ToListAsync()) device.Enabled = false;
        previous.ExpiresAt = DateTimeOffset.UtcNow;
    }
    var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
    var expiry = DateTimeOffset.UtcNow.AddDays(7);
    db.Sessions.Add(new LoginSession { EmployeeId = user.Id, TokenHash = Auth.Hash(token), ExpiresAt = expiry });
    await db.SaveChangesAsync();
    ctx.Response.Cookies.Append(Auth.CookieName, token, new CookieOptions { HttpOnly = true, Secure = !app.Environment.IsDevelopment(), SameSite = SameSiteMode.Strict, Expires = expiry, Path = "/" });
    return Results.Ok(new { token, expiresAt = expiry, email = user.Email, displayName = user.DisplayName });
}).RequireRateLimiting("login");
var api = app.MapGroup("/api");
api.AddEndpointFilter(async (ctx, next) => ctx.HttpContext.User.Identity?.IsAuthenticated == true
    ? await next(ctx) : Results.Unauthorized());
api.MapGet("/session", async (HttpContext ctx, StudioDb db) => Results.Ok(await db.Employees.AsNoTracking().Where(e => e.Id == ctx.Owner()).Select(e => new { e.Email, e.DisplayName }).SingleAsync()));
api.MapPost("/logout", async (HttpContext ctx, StudioDb db) => {
    var hash = Auth.Hash(Auth.Token(ctx));
    var session = await db.Sessions.SingleAsync(s => s.TokenHash == hash);
    foreach (var device in await db.Devices.Where(d => d.SessionId == session.Id).ToListAsync()) device.Enabled = false;
    session.ExpiresAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();
    ctx.Response.Cookies.Delete(Auth.CookieName, new CookieOptions { Path = "/", Secure = !app.Environment.IsDevelopment(), SameSite = SameSiteMode.Strict });
    return Results.NoContent();
});
WebPushEndpoints.Map(api);
AccountEndpoints.Map(api);
CustomerEndpoints.Map(api); CareEndpoints.Map(api);
app.MapFallback(async ctx => {
    var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
    if (ctx.Request.Path.StartsWithSegments("/api") || ctx.Request.Path.StartsWithSegments("/auth") || !File.Exists(index)) { ctx.Response.StatusCode = 404; return; }
    ctx.Response.ContentType = "text/html; charset=utf-8"; ctx.Response.Headers.CacheControl = "no-cache";
    await ctx.Response.SendFileAsync(index);
});
app.Run();
public partial class Program;
