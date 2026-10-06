using System.Text.Json;
using Microsoft.Data.SqlClient;

var configPath = Path.GetFullPath(args.FirstOrDefault(a => !a.StartsWith("--")) ?? "apps/api/appsettings.Local.json");
using var config = JsonDocument.Parse(await File.ReadAllTextAsync(configPath));
var connectionString = new SqlConnectionStringBuilder(config.RootElement.GetProperty("ConnectionStrings").GetProperty("SqlServer").GetString()) {
    InitialCatalog = "master", ConnectTimeout = 8
};
if (args.Contains("--trust-server-certificate")) connectionString.TrustServerCertificate = true;
try {
    await using var connection = new SqlConnection(connectionString.ConnectionString);
    await connection.OpenAsync();
    await using var command = connection.CreateCommand(); command.CommandTimeout = 8;
    command.CommandText = """
        SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS Version,
               CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS Edition,
               CASE WHEN DB_ID(N'ClientStudio') IS NULL THEN 0 ELSE 1 END AS AppDatabaseExists;
        """;
    bool appDatabaseExists;
    await using (var reader = await command.ExecuteReaderAsync()) {
        await reader.ReadAsync();
        appDatabaseExists = reader.GetInt32(2) == 1;
        Console.WriteLine(JsonSerializer.Serialize(new {
            connected = true, version = reader.GetString(0), edition = reader.GetString(1),
            appDatabaseExists, certificateValidation = !connectionString.TrustServerCertificate,
        }));
    }
    // Read metadata only; never create databases, tables or users.
    if (appDatabaseExists) {
        command.CommandText = "USE [ClientStudio]; SELECT COUNT(*) AS UserTableCount FROM sys.tables WHERE is_ms_shipped = 0;";
        var count = await command.ExecuteScalarAsync();
        Console.WriteLine("App database user table count: " + count);
    }
}
catch (SqlException ex) {
    Console.WriteLine("SQL connection failed (code " + ex.Number + "): " + ex.Message);
    Environment.ExitCode = 1;
}
