import type { Database } from './db.js';
import { commerceMigration } from './commerce-schema.js';
import { assignUserCodes } from './user-code.js';

// Explicit, additive migration. Existing passwords, access and data remain intact.
export const authMigration = [
  `IF COL_LENGTH('dbo.Employees','Username') IS NULL ALTER TABLE dbo.Employees ADD Username nvarchar(32) NULL`,
  `IF COL_LENGTH('dbo.Employees','EmailVerified') IS NULL ALTER TABLE dbo.Employees ADD EmailVerified bit NOT NULL CONSTRAINT DF_Employees_EmailVerified DEFAULT 1`,
  `IF COL_LENGTH('dbo.Employees','IsAdmin') IS NULL ALTER TABLE dbo.Employees ADD IsAdmin bit NOT NULL CONSTRAINT DF_Employees_IsAdmin DEFAULT 0`,
  `IF COL_LENGTH('dbo.Employees','ActiveUntil') IS NULL ALTER TABLE dbo.Employees ADD ActiveUntil datetimeoffset NULL`,
  `IF COL_LENGTH('dbo.Employees','AccessGranted') IS NULL BEGIN
    ALTER TABLE dbo.Employees ADD AccessGranted bit NOT NULL CONSTRAINT DF_Employees_AccessGranted DEFAULT 1;
    EXEC(N'UPDATE dbo.Employees SET Enabled=1, AccessGranted=0 WHERE Username IS NOT NULL AND Enabled=0 AND ActiveUntil IS NULL AND EmailVerified=1 AND IsAdmin=0');
  END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Employees_Username' AND object_id=OBJECT_ID('dbo.Employees')) CREATE UNIQUE INDEX IX_Employees_Username ON dbo.Employees(Username) WHERE Username IS NOT NULL`,
  `IF OBJECT_ID('dbo.Registrations','U') IS NULL CREATE TABLE dbo.Registrations (
    Id uniqueidentifier NOT NULL PRIMARY KEY, Email nvarchar(254) NOT NULL UNIQUE, Username nvarchar(32) NOT NULL,
    PasswordHash nvarchar(256) NOT NULL, CodeHash nvarchar(256) NOT NULL, ExpiresAt datetimeoffset NOT NULL,
    CreatedAt datetimeoffset NOT NULL, SentAt datetimeoffset NOT NULL, Attempts int NOT NULL, Sends int NOT NULL)`,
  `IF OBJECT_ID('dbo.SystemSettings','U') IS NULL CREATE TABLE dbo.SystemSettings (
    Id nvarchar(32) NOT NULL PRIMARY KEY, RegistrationEnabled bit NOT NULL, DefaultActivationMonths int NOT NULL,
    SubscriptionEnabled bit NOT NULL CONSTRAINT DF_SystemSettings_SubscriptionEnabled DEFAULT 1,
    TelegramCommunityUrl nvarchar(300) NOT NULL CONSTRAINT DF_SystemSettings_TelegramCommunityUrl DEFAULT N'')`,
  `IF COL_LENGTH('dbo.SystemSettings','SubscriptionEnabled') IS NULL ALTER TABLE dbo.SystemSettings ADD SubscriptionEnabled bit NOT NULL CONSTRAINT DF_SystemSettings_SubscriptionEnabled DEFAULT 1`,
  `IF COL_LENGTH('dbo.SystemSettings','TelegramCommunityUrl') IS NULL ALTER TABLE dbo.SystemSettings ADD TelegramCommunityUrl nvarchar(300) NOT NULL CONSTRAINT DF_SystemSettings_TelegramCommunityUrl DEFAULT N''`,
  `IF OBJECT_ID('dbo.AdminAudit','U') IS NULL CREATE TABLE dbo.AdminAudit (
    Id uniqueidentifier NOT NULL PRIMARY KEY, ActorId uniqueidentifier NOT NULL, TargetId uniqueidentifier NULL,
    Action nvarchar(32) NOT NULL, CreatedAt datetimeoffset NOT NULL, Details nvarchar(max) NOT NULL)`,
  `IF OBJECT_ID('dbo.SubscriptionRequests','U') IS NULL CREATE TABLE dbo.SubscriptionRequests (
    Id uniqueidentifier NOT NULL PRIMARY KEY, CreatedAt datetimeoffset NOT NULL, State nvarchar(32) NOT NULL,
    CONSTRAINT FK_SubscriptionRequests_Employees FOREIGN KEY (Id) REFERENCES dbo.Employees(Id))`,
  `IF OBJECT_ID('dbo.Announcements','U') IS NULL CREATE TABLE dbo.Announcements (
    Id uniqueidentifier NOT NULL PRIMARY KEY, Title nvarchar(120) NOT NULL, Content nvarchar(max) NOT NULL,
    StartsAt datetimeoffset NOT NULL, EndsAt datetimeoffset NOT NULL, Enabled bit NOT NULL,
    CreatedAt datetimeoffset NOT NULL, CreatedBy uniqueidentifier NOT NULL,
    CONSTRAINT FK_Announcements_Employees FOREIGN KEY (CreatedBy) REFERENCES dbo.Employees(Id),
    CONSTRAINT CK_Announcements_Window CHECK (EndsAt > StartsAt))`,
  `IF OBJECT_ID('dbo.AnnouncementDismissals','U') IS NULL CREATE TABLE dbo.AnnouncementDismissals (
    Id uniqueidentifier NOT NULL PRIMARY KEY, AnnouncementId uniqueidentifier NOT NULL, EmployeeId uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset NOT NULL,
    CONSTRAINT FK_AnnouncementDismissals_Announcements FOREIGN KEY (AnnouncementId) REFERENCES dbo.Announcements(Id),
    CONSTRAINT FK_AnnouncementDismissals_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(Id),
    CONSTRAINT UQ_AnnouncementDismissals_User UNIQUE (EmployeeId, AnnouncementId))`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Announcements_Window' AND object_id=OBJECT_ID('dbo.Announcements')) CREATE INDEX IX_Announcements_Window ON dbo.Announcements(Enabled, StartsAt, EndsAt)`,
  `UPDATE dbo.Employees SET IsAdmin=1, EmailVerified=1 WHERE LOWER(LTRIM(RTRIM(Email)))='admin@admin.com' AND Enabled=1`,
  ...commerceMigration
];
export async function migrateAuth(db: Database) {
  await db.transaction(async tx => { for (const statement of authMigration) await tx.exec(statement); await assignLegacyUsernames(tx); await assignUserCodes(tx); });
  const admin = await db.one('Employees', 'Email=@email', { email: 'admin@admin.com' });
  console.log('Authentication schema migration complete.');
  console.log(admin?.isAdmin ? 'Existing administrator account promoted; password preserved.' : 'No active admin@admin.com account found; no administrator was created.');
}

export async function assignLegacyUsernames(db: Database) {
  return db.transaction(async tx => {
    const users = await tx.rows('Employees', '1=1', {}, 'Email, Id');
    const used = new Set(users.filter(u => u.username).map(u => String(u.username).toLowerCase()));
    const assigned = [];
    for (const user of users.filter(u => !u.username)) {
      let base = String(user.email).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
      if (base.length < 3) base = `user_${base || String(user.id).replace(/-/g, '').slice(0, 8)}`;
      base = base.slice(0, 32);
      let username = base; let suffix = 1;
      while (used.has(username)) { const ending = `_${suffix++}`; username = base.slice(0, 32 - ending.length) + ending; }
      await tx.update('Employees', { username }, 'Id=@id AND (Username IS NULL OR Username=@empty)', { id: user.id, empty: '' });
      used.add(username); assigned.push({ id: user.id, username });
    }
    return assigned;
  });
}
