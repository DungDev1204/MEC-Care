-- Idempotent SQL Server schema. Apply manually with a deployment login; the app never runs DDL.
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL
BEGIN
CREATE TABLE [Customers] (
        [Id] uniqueidentifier NOT NULL,
        [OwnerId] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [SearchText] nvarchar(1000) NOT NULL,
        [Phone] nvarchar(32) NOT NULL,
        [BirthDate] date NULL,
        [Interests] nvarchar(max) NOT NULL,
        [Notes] nvarchar(max) NOT NULL,
        [PreferredContact] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [AvatarId] uniqueidentifier NULL,
        [UpdatedAt] datetimeoffset NOT NULL,
        CONSTRAINT [PK_Customers] PRIMARY KEY ([Id])
    );
END;
GO

IF OBJECT_ID(N'dbo.Devices', N'U') IS NULL
BEGIN
CREATE TABLE [Devices] (
        [Id] uniqueidentifier NOT NULL,
        [OwnerId] uniqueidentifier NOT NULL,
        [PushToken] nvarchar(300) NOT NULL,
        [Enabled] bit NOT NULL,
        CONSTRAINT [PK_Devices] PRIMARY KEY ([Id])
    );
END;
GO

IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
BEGIN
CREATE TABLE [Employees] (
        [Id] uniqueidentifier NOT NULL,
        [Email] nvarchar(254) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [Enabled] bit NOT NULL,
        CONSTRAINT [PK_Employees] PRIMARY KEY ([Id])
    );
END;
GO

IF OBJECT_ID(N'dbo.Sessions', N'U') IS NULL
BEGIN
CREATE TABLE [Sessions] (
        [Id] uniqueidentifier NOT NULL,
        [EmployeeId] uniqueidentifier NOT NULL,
        [TokenHash] nvarchar(64) NOT NULL,
        [ExpiresAt] datetimeoffset NOT NULL,
        CONSTRAINT [PK_Sessions] PRIMARY KEY ([Id])
    );
END;
GO

IF OBJECT_ID(N'dbo.Contacts', N'U') IS NULL
BEGIN
CREATE TABLE [Contacts] (
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [At] datetimeoffset NOT NULL,
        [Channel] nvarchar(max) NOT NULL,
        [Content] nvarchar(max) NOT NULL,
        [OccurrenceId] uniqueidentifier NULL,
        CONSTRAINT [PK_Contacts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Contacts_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID(N'dbo.Photos', N'U') IS NULL
BEGIN
CREATE TABLE [Photos] (
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [FileName] nvarchar(max) NOT NULL,
        [ContentType] nvarchar(max) NOT NULL,
        [Caption] nvarchar(max) NOT NULL,
        [IsAvatar] bit NOT NULL,
        [CreatedAt] datetimeoffset NOT NULL,
        CONSTRAINT [PK_Photos] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Photos_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID(N'dbo.Reminders', N'U') IS NULL
BEGIN
CREATE TABLE [Reminders] (
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [Kind] nvarchar(max) NOT NULL,
        [Content] nvarchar(max) NOT NULL,
        [LocalDateTime] datetime2 NOT NULL,
        [TimeZone] nvarchar(max) NOT NULL,
        [Repeat] nvarchar(max) NOT NULL,
        [LeadDays] int NOT NULL,
        [LeapDayPolicy] nvarchar(max) NULL,
        [Active] bit NOT NULL,
        [Revision] int NOT NULL,
        CONSTRAINT [PK_Reminders] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Reminders_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID(N'dbo.Vehicles', N'U') IS NULL
BEGIN
CREATE TABLE [Vehicles] (
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [Model] nvarchar(max) NOT NULL,
        [Plate] nvarchar(max) NOT NULL,
        [DeliveryDate] date NULL,
        CONSTRAINT [PK_Vehicles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Vehicles_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.Occurrences', N'U') IS NULL
BEGIN
CREATE TABLE [Occurrences] (
        [Id] uniqueidentifier NOT NULL,
        [RowVersion] rowversion NOT NULL,
        [ReminderId] uniqueidentifier NOT NULL,
        [Revision] int NOT NULL,
        [OriginalAt] datetimeoffset NOT NULL,
        [ScheduledAt] datetimeoffset NOT NULL,
        [NotifyAt] datetimeoffset NOT NULL,
        [State] nvarchar(450) NOT NULL,
        [CompletedAt] datetimeoffset NULL,
        CONSTRAINT [PK_Occurrences] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Occurrences_Reminders_ReminderId] FOREIGN KEY ([ReminderId]) REFERENCES [Reminders] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID(N'dbo.Deliveries', N'U') IS NULL
BEGIN
CREATE TABLE [Deliveries] (
        [Id] uniqueidentifier NOT NULL,
        [OccurrenceId] uniqueidentifier NOT NULL,
        [DeviceId] uniqueidentifier NOT NULL,
        [State] nvarchar(max) NOT NULL,
        [Attempts] int NOT NULL,
        [RetryAt] datetimeoffset NOT NULL,
        [LeaseUntil] datetimeoffset NULL,
        [ReceiptId] nvarchar(max) NULL,
        CONSTRAINT [PK_Deliveries] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Deliveries_Devices_DeviceId] FOREIGN KEY ([DeviceId]) REFERENCES [Devices] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Deliveries_Occurrences_OccurrenceId] FOREIGN KEY ([OccurrenceId]) REFERENCES [Occurrences] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Contacts_CustomerId' AND object_id=OBJECT_ID(N'dbo.Contacts'))
BEGIN
CREATE INDEX [IX_Contacts_CustomerId] ON [Contacts] ([CustomerId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Customers_OwnerId_Phone' AND object_id=OBJECT_ID(N'dbo.Customers'))
BEGIN
CREATE INDEX [IX_Customers_OwnerId_Phone] ON [Customers] ([OwnerId], [Phone]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Deliveries_DeviceId' AND object_id=OBJECT_ID(N'dbo.Deliveries'))
BEGIN
CREATE INDEX [IX_Deliveries_DeviceId] ON [Deliveries] ([DeviceId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Deliveries_OccurrenceId_DeviceId' AND object_id=OBJECT_ID(N'dbo.Deliveries'))
BEGIN
CREATE UNIQUE INDEX [IX_Deliveries_OccurrenceId_DeviceId] ON [Deliveries] ([OccurrenceId], [DeviceId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Devices_PushToken' AND object_id=OBJECT_ID(N'dbo.Devices'))
BEGIN
CREATE UNIQUE INDEX [IX_Devices_PushToken] ON [Devices] ([PushToken]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Employees_Email' AND object_id=OBJECT_ID(N'dbo.Employees'))
BEGIN
CREATE UNIQUE INDEX [IX_Employees_Email] ON [Employees] ([Email]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Occurrences_ReminderId_Revision_OriginalAt' AND object_id=OBJECT_ID(N'dbo.Occurrences'))
BEGIN
CREATE UNIQUE INDEX [IX_Occurrences_ReminderId_Revision_OriginalAt] ON [Occurrences] ([ReminderId], [Revision], [OriginalAt]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Occurrences_State_NotifyAt' AND object_id=OBJECT_ID(N'dbo.Occurrences'))
BEGIN
CREATE INDEX [IX_Occurrences_State_NotifyAt] ON [Occurrences] ([State], [NotifyAt]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Photos_CustomerId' AND object_id=OBJECT_ID(N'dbo.Photos'))
BEGIN
CREATE INDEX [IX_Photos_CustomerId] ON [Photos] ([CustomerId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Reminders_CustomerId' AND object_id=OBJECT_ID(N'dbo.Reminders'))
BEGIN
CREATE INDEX [IX_Reminders_CustomerId] ON [Reminders] ([CustomerId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Sessions_TokenHash' AND object_id=OBJECT_ID(N'dbo.Sessions'))
BEGIN
CREATE UNIQUE INDEX [IX_Sessions_TokenHash] ON [Sessions] ([TokenHash]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Vehicles_CustomerId' AND object_id=OBJECT_ID(N'dbo.Vehicles'))
BEGIN
CREATE INDEX [IX_Vehicles_CustomerId] ON [Vehicles] ([CustomerId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Sessions_EmployeeId' AND object_id=OBJECT_ID(N'dbo.Sessions'))
BEGIN
CREATE INDEX [IX_Sessions_EmployeeId] ON [Sessions] ([EmployeeId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Devices_OwnerId' AND object_id=OBJECT_ID(N'dbo.Devices'))
BEGIN
CREATE INDEX [IX_Devices_OwnerId] ON [Devices] ([OwnerId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Contacts_OccurrenceId' AND object_id=OBJECT_ID(N'dbo.Contacts'))
BEGIN
CREATE INDEX [IX_Contacts_OccurrenceId] ON [Contacts] ([OccurrenceId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Contacts_Occurrences_OccurrenceId' AND parent_object_id=OBJECT_ID(N'dbo.Contacts'))
BEGIN
ALTER TABLE [Contacts] ADD CONSTRAINT [FK_Contacts_Occurrences_OccurrenceId] FOREIGN KEY ([OccurrenceId]) REFERENCES [Occurrences] ([Id]) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Customers_Employees_OwnerId' AND parent_object_id=OBJECT_ID(N'dbo.Customers'))
BEGIN
ALTER TABLE [Customers] ADD CONSTRAINT [FK_Customers_Employees_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Devices_Employees_OwnerId' AND parent_object_id=OBJECT_ID(N'dbo.Devices'))
BEGIN
ALTER TABLE [Devices] ADD CONSTRAINT [FK_Devices_Employees_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Sessions_Employees_EmployeeId' AND parent_object_id=OBJECT_ID(N'dbo.Sessions'))
BEGIN
ALTER TABLE [Sessions] ADD CONSTRAINT [FK_Sessions_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION;
END;
GO

IF COL_LENGTH(N'dbo.Devices', N'AuthKey') IS NULL
BEGIN
ALTER TABLE [Devices] ADD [AuthKey] nvarchar(64) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Devices', N'Endpoint') IS NULL
BEGIN
ALTER TABLE [Devices] ADD [Endpoint] nvarchar(2048) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Devices', N'P256dh') IS NULL
BEGIN
ALTER TABLE [Devices] ADD [P256dh] nvarchar(128) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Devices', N'SessionId') IS NULL
BEGIN
ALTER TABLE [Devices] ADD [SessionId] uniqueidentifier NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Devices_SessionId' AND object_id=OBJECT_ID(N'dbo.Devices'))
BEGIN
CREATE INDEX [IX_Devices_SessionId] ON [Devices] ([SessionId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Devices_Sessions_SessionId' AND parent_object_id=OBJECT_ID(N'dbo.Devices'))
BEGIN
ALTER TABLE [Devices] ADD CONSTRAINT [FK_Devices_Sessions_SessionId] FOREIGN KEY ([SessionId]) REFERENCES [Sessions] ([Id]) ON DELETE NO ACTION;
END;
GO

IF COL_LENGTH(N'dbo.Employees', N'DisplayName') IS NULL
BEGIN
ALTER TABLE [Employees] ADD [DisplayName] nvarchar(200) NOT NULL DEFAULT N'';
END;
GO

IF COL_LENGTH(N'dbo.Employees', N'Phone') IS NULL
BEGIN
ALTER TABLE [Employees] ADD [Phone] nvarchar(32) NOT NULL DEFAULT N'';
END;
GO


-- Registration OTP and admin upgrade (2026-10-08).
-- Includes scheduled announcements; run CLI --migrate-auth to assign legacy usernames.
IF COL_LENGTH('dbo.Employees','Username') IS NULL ALTER TABLE dbo.Employees ADD Username nvarchar(32) NULL;
GO

IF COL_LENGTH('dbo.Employees','EmailVerified') IS NULL ALTER TABLE dbo.Employees ADD EmailVerified bit NOT NULL CONSTRAINT DF_Employees_EmailVerified DEFAULT 1;
GO

IF COL_LENGTH('dbo.Employees','IsAdmin') IS NULL ALTER TABLE dbo.Employees ADD IsAdmin bit NOT NULL CONSTRAINT DF_Employees_IsAdmin DEFAULT 0;
GO

IF COL_LENGTH('dbo.Employees','ActiveUntil') IS NULL ALTER TABLE dbo.Employees ADD ActiveUntil datetimeoffset NULL;
GO

IF COL_LENGTH('dbo.Employees','AccessGranted') IS NULL BEGIN
    ALTER TABLE dbo.Employees ADD AccessGranted bit NOT NULL CONSTRAINT DF_Employees_AccessGranted DEFAULT 1;
    EXEC(N'UPDATE dbo.Employees SET Enabled=1, AccessGranted=0 WHERE Username IS NOT NULL AND Enabled=0 AND ActiveUntil IS NULL AND EmailVerified=1 AND IsAdmin=0');
  END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Employees_Username' AND object_id=OBJECT_ID('dbo.Employees')) CREATE UNIQUE INDEX IX_Employees_Username ON dbo.Employees(Username) WHERE Username IS NOT NULL;
GO

IF OBJECT_ID('dbo.Registrations','U') IS NULL CREATE TABLE dbo.Registrations (
    Id uniqueidentifier NOT NULL PRIMARY KEY, Email nvarchar(254) NOT NULL UNIQUE, Username nvarchar(32) NOT NULL,
    PasswordHash nvarchar(256) NOT NULL, CodeHash nvarchar(256) NOT NULL, ExpiresAt datetimeoffset NOT NULL,
    CreatedAt datetimeoffset NOT NULL, SentAt datetimeoffset NOT NULL, Attempts int NOT NULL, Sends int NOT NULL);
GO

IF OBJECT_ID('dbo.SystemSettings','U') IS NULL CREATE TABLE dbo.SystemSettings (
    Id nvarchar(32) NOT NULL PRIMARY KEY, RegistrationEnabled bit NOT NULL, DefaultActivationMonths int NOT NULL);
GO

IF OBJECT_ID('dbo.AdminAudit','U') IS NULL CREATE TABLE dbo.AdminAudit (
    Id uniqueidentifier NOT NULL PRIMARY KEY, ActorId uniqueidentifier NOT NULL, TargetId uniqueidentifier NULL,
    Action nvarchar(32) NOT NULL, CreatedAt datetimeoffset NOT NULL, Details nvarchar(max) NOT NULL);
GO

IF OBJECT_ID('dbo.SubscriptionRequests','U') IS NULL CREATE TABLE dbo.SubscriptionRequests (
    Id uniqueidentifier NOT NULL PRIMARY KEY, CreatedAt datetimeoffset NOT NULL, State nvarchar(32) NOT NULL,
    CONSTRAINT FK_SubscriptionRequests_Employees FOREIGN KEY (Id) REFERENCES dbo.Employees(Id));
GO

IF OBJECT_ID('dbo.Announcements','U') IS NULL CREATE TABLE dbo.Announcements (
    Id uniqueidentifier NOT NULL PRIMARY KEY, Title nvarchar(120) NOT NULL, Content nvarchar(max) NOT NULL,
    StartsAt datetimeoffset NOT NULL, EndsAt datetimeoffset NOT NULL, Enabled bit NOT NULL,
    CreatedAt datetimeoffset NOT NULL, CreatedBy uniqueidentifier NOT NULL,
    CONSTRAINT FK_Announcements_Employees FOREIGN KEY (CreatedBy) REFERENCES dbo.Employees(Id),
    CONSTRAINT CK_Announcements_Window CHECK (EndsAt > StartsAt));
GO

IF OBJECT_ID('dbo.AnnouncementDismissals','U') IS NULL CREATE TABLE dbo.AnnouncementDismissals (
    Id uniqueidentifier NOT NULL PRIMARY KEY, AnnouncementId uniqueidentifier NOT NULL, EmployeeId uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset NOT NULL,
    CONSTRAINT FK_AnnouncementDismissals_Announcements FOREIGN KEY (AnnouncementId) REFERENCES dbo.Announcements(Id),
    CONSTRAINT FK_AnnouncementDismissals_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(Id),
    CONSTRAINT UQ_AnnouncementDismissals_User UNIQUE (EmployeeId, AnnouncementId));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Announcements_Window' AND object_id=OBJECT_ID('dbo.Announcements')) CREATE INDEX IX_Announcements_Window ON dbo.Announcements(Enabled, StartsAt, EndsAt);
GO

UPDATE dbo.Employees SET IsAdmin=1, EmailVerified=1 WHERE LOWER(LTRIM(RTRIM(Email)))='admin@admin.com' AND Enabled=1;
GO
