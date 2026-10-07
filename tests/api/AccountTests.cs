using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using ClientStudio;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

namespace ClientStudio.Tests;
public class AccountTests
{
    [Fact] public async Task PersonalInfoIsPersistedAndOnlyUpdatesTheCurrentEmployee() {
        await using var factory = new SqliteStudioFactory(); using var alice = factory.Client(); using var bob = factory.Client("bob");
        (await alice.PutAsJsonAsync("/api/account", new PersonalInfoInput("Alice Care", "090 123 4567"))).EnsureSuccessStatusCode();
        using var account = JsonDocument.Parse(await alice.GetStringAsync("/api/account"));
        Assert.Equal("Alice Care", account.RootElement.GetProperty("displayName").GetString());
        Assert.Equal("0901234567", account.RootElement.GetProperty("phone").GetString());
        Assert.Equal("alice@example.test", account.RootElement.GetProperty("email").GetString());
        using var session = JsonDocument.Parse(await alice.GetStringAsync("/api/session"));
        Assert.Equal("Alice Care", session.RootElement.GetProperty("displayName").GetString());
        using var other = JsonDocument.Parse(await bob.GetStringAsync("/api/account"));
        Assert.Equal("", other.RootElement.GetProperty("displayName").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/api/account", new PersonalInfoInput("", ""))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/api/account", new PersonalInfoInput("Alice", "12"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PutAsJsonAsync("/api/account", new { displayName = "Alice", phone = (string?)null })).StatusCode);
        alice.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await alice.GetAsync("/api/account")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await alice.GetAsync("/api/account/backup")).StatusCode);
    }

    [Fact] public async Task BackupContainsOwnedRelationsAndExactPhotosWithoutCredentialsOrOtherOwners() {
        await using var factory = new SqliteStudioFactory(); using var alice = factory.Client(); using var bob = factory.Client("bob");
        var create = await alice.PostAsJsonAsync("/api/customers", new CustomerInput("Alice customer", "0901234567", null, "Golf", "Private notes", "Call", "purchased", [new(null, "C200", "51A-12345", null)])); create.EnsureSuccessStatusCode();
        var customer = (await create.Content.ReadFromJsonAsync<Customer>())!;
        var bytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4X8AAAAASUVORK5CYII=");
        using var upload = new MultipartFormDataContent(); upload.Add(new ByteArrayContent(bytes), "file", "test.png");
        var uploaded = await alice.PostAsync($"/api/customers/{customer.Id}/photos", upload); uploaded.EnsureSuccessStatusCode();
        var photo = (await uploaded.Content.ReadFromJsonAsync<Photo>())!;
        using (var scope = factory.Services.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<StudioDb>();
            db.Customers.Add(new Customer { OwnerId = factory.Bob, Name = "BOB_SECRET" });
            db.Contacts.Add(new Contact { CustomerId = customer.Id, Content = "Care record" });
            var reminder = new Reminder { CustomerId = customer.Id, Content = "Annual care", Repeat = "annual", LocalDateTime = DateTime.Now.AddDays(2) }; db.Reminders.Add(reminder);
            db.Occurrences.Add(new Occurrence { ReminderId = reminder.Id, State = "completed", CompletedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }
        var response = await alice.GetAsync("/api/account/backup"); response.EnsureSuccessStatusCode();
        Assert.Equal("application/zip", response.Content.Headers.ContentType!.MediaType);
        Assert.True(response.Headers.CacheControl!.NoStore);
        using var archive = new ZipArchive(new MemoryStream(await response.Content.ReadAsByteArrayAsync()));
        using var reader = new StreamReader(archive.GetEntry("data.json")!.Open()); var text = await reader.ReadToEndAsync();
        Assert.DoesNotContain("BOB_SECRET", text); Assert.DoesNotContain("passwordHash", text); Assert.DoesNotContain("tokenHash", text); Assert.DoesNotContain("ownerId", text); Assert.DoesNotContain("fileName", text);
        using var data = JsonDocument.Parse(text); var root = data.RootElement;
        Assert.Equal(customer.Id, Assert.Single(root.GetProperty("customers").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal("C200", root.GetProperty("customers")[0].GetProperty("vehicles")[0].GetProperty("model").GetString());
        Assert.Single(root.GetProperty("contacts").EnumerateArray()); Assert.Single(root.GetProperty("reminders").EnumerateArray());
        Assert.Equal("completed", Assert.Single(root.GetProperty("occurrences").EnumerateArray()).GetProperty("state").GetString());
        var metadata = Assert.Single(root.GetProperty("photos").EnumerateArray()); Assert.Equal(photo.Id, metadata.GetProperty("id").GetGuid());
        using var photoStream = archive.GetEntry(metadata.GetProperty("archivePath").GetString()!)!.Open(); using var copied = new MemoryStream(); await photoStream.CopyToAsync(copied);
        Assert.Equal(bytes, copied.ToArray()); Assert.Equal(Convert.ToHexString(SHA256.HashData(bytes)), metadata.GetProperty("sha256").GetString());
        using var withoutImages = new ZipArchive(new MemoryStream(await alice.GetByteArrayAsync("/api/account/backup?includePhotos=false")));
        Assert.Single(withoutImages.Entries); using var json = JsonDocument.Parse(withoutImages.GetEntry("data.json")!.Open());
        Assert.False(json.RootElement.GetProperty("includePhotos").GetBoolean()); Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("photos")[0].GetProperty("archivePath").ValueKind);
        using var bobZip = new ZipArchive(new MemoryStream(await bob.GetByteArrayAsync("/api/account/backup")));
        using var bobJson = JsonDocument.Parse(bobZip.GetEntry("data.json")!.Open());
        Assert.Equal("BOB_SECRET", Assert.Single(bobJson.RootElement.GetProperty("customers").EnumerateArray()).GetProperty("name").GetString()); Assert.Empty(bobJson.RootElement.GetProperty("photos").EnumerateArray());
        using (var scope = factory.Services.CreateScope()) {
            var storage = CustomerEndpoints.Storage(scope.ServiceProvider.GetRequiredService<IConfiguration>());
            File.Delete(Path.Combine(storage, photo.FileName));
        }
        Assert.Equal(HttpStatusCode.Conflict, (await alice.GetAsync("/api/account/backup")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await alice.GetAsync("/api/account/backup?includePhotos=false")).StatusCode);
    }
}
