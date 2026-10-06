IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE TABLE [Devices] (
        [Id] uniqueidentifier NOT NULL,
        [OwnerId] uniqueidentifier NOT NULL,
        [PushToken] nvarchar(300) NOT NULL,
        [Enabled] bit NOT NULL,
        CONSTRAINT [PK_Devices] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE TABLE [Employees] (
        [Id] uniqueidentifier NOT NULL,
        [Email] nvarchar(254) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [Enabled] bit NOT NULL,
        CONSTRAINT [PK_Employees] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE TABLE [Sessions] (
        [Id] uniqueidentifier NOT NULL,
        [EmployeeId] uniqueidentifier NOT NULL,
        [TokenHash] nvarchar(64) NOT NULL,
        [ExpiresAt] datetimeoffset NOT NULL,
        CONSTRAINT [PK_Sessions] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
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

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Contacts_CustomerId] ON [Contacts] ([CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Customers_OwnerId_Phone] ON [Customers] ([OwnerId], [Phone]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Deliveries_DeviceId] ON [Deliveries] ([DeviceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Deliveries_OccurrenceId_DeviceId] ON [Deliveries] ([OccurrenceId], [DeviceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Devices_PushToken] ON [Devices] ([PushToken]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Employees_Email] ON [Employees] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Occurrences_ReminderId_Revision_OriginalAt] ON [Occurrences] ([ReminderId], [Revision], [OriginalAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Occurrences_State_NotifyAt] ON [Occurrences] ([State], [NotifyAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Photos_CustomerId] ON [Photos] ([CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Reminders_CustomerId] ON [Reminders] ([CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Sessions_TokenHash] ON [Sessions] ([TokenHash]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Vehicles_CustomerId] ON [Vehicles] ([CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006033753_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261006033753_InitialCreate', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    CREATE INDEX [IX_Sessions_EmployeeId] ON [Sessions] ([EmployeeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    CREATE INDEX [IX_Devices_OwnerId] ON [Devices] ([OwnerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    CREATE INDEX [IX_Contacts_OccurrenceId] ON [Contacts] ([OccurrenceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    ALTER TABLE [Contacts] ADD CONSTRAINT [FK_Contacts_Occurrences_OccurrenceId] FOREIGN KEY ([OccurrenceId]) REFERENCES [Occurrences] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    ALTER TABLE [Customers] ADD CONSTRAINT [FK_Customers_Employees_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    ALTER TABLE [Devices] ADD CONSTRAINT [FK_Devices_Employees_OwnerId] FOREIGN KEY ([OwnerId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    ALTER TABLE [Sessions] ADD CONSTRAINT [FK_Sessions_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261006034525_OwnershipConstraints'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261006034525_OwnershipConstraints', N'10.0.12');
END;

COMMIT;
GO

