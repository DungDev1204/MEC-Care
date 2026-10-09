export const commerceMigration = [
  `IF COL_LENGTH('dbo.Employees','UserCode') IS NULL ALTER TABLE dbo.Employees ADD UserCode varchar(10) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Employees_UserCode' AND object_id=OBJECT_ID('dbo.Employees')) CREATE UNIQUE INDEX IX_Employees_UserCode ON dbo.Employees(UserCode) WHERE UserCode IS NOT NULL`,
  `IF OBJECT_ID('dbo.PaymentSettings','U') IS NULL CREATE TABLE dbo.PaymentSettings (
    Id varchar(32) NOT NULL PRIMARY KEY, BankCode varchar(6) NOT NULL, BankName nvarchar(100) NOT NULL,
    AccountNumber varchar(32) NOT NULL, AccountName nvarchar(100) NOT NULL, MonthlyPrice int NOT NULL,
    ZaloUrl nvarchar(200) NOT NULL, CONSTRAINT CK_PaymentSettings_Price CHECK (MonthlyPrice>0))`,
  `IF OBJECT_ID('dbo.PurchaseOrders','U') IS NULL CREATE TABLE dbo.PurchaseOrders (
    Id uniqueidentifier NOT NULL PRIMARY KEY, Code varchar(12) NOT NULL UNIQUE, EmployeeId uniqueidentifier NOT NULL,
    UserCode varchar(10) NOT NULL, Username nvarchar(32) NOT NULL, Months int NOT NULL, Amount int NOT NULL,
    CreatedAt datetimeoffset NOT NULL, ReportedAt datetimeoffset NULL, PaidAt datetimeoffset NULL,
    ReviewedAt datetimeoffset NULL, ReviewerId uniqueidentifier NULL, State varchar(32) NOT NULL, PaymentState varchar(32) NOT NULL,
    BankCode varchar(6) NOT NULL, BankName nvarchar(100) NOT NULL, AccountNumber varchar(32) NOT NULL,
    AccountName nvarchar(100) NOT NULL, ZaloUrl nvarchar(200) NOT NULL, TransferContent nvarchar(100) NOT NULL,
    TransactionReference nvarchar(100) NULL, RejectionReason nvarchar(500) NULL,
    ActiveBefore datetimeoffset NULL, ActiveAfter datetimeoffset NULL,
    CONSTRAINT FK_PurchaseOrders_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(Id),
    CONSTRAINT CK_PurchaseOrders_Amount CHECK (Amount>0 AND Months BETWEEN 1 AND 12))`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PurchaseOrders_Open' AND object_id=OBJECT_ID('dbo.PurchaseOrders')) CREATE UNIQUE INDEX IX_PurchaseOrders_Open ON dbo.PurchaseOrders(EmployeeId) WHERE State IN ('pending_payment','pending_review','rejected','payment_issue')`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PurchaseOrders_Reference' AND object_id=OBJECT_ID('dbo.PurchaseOrders')) CREATE UNIQUE INDEX IX_PurchaseOrders_Reference ON dbo.PurchaseOrders(TransactionReference) WHERE TransactionReference IS NOT NULL`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PurchaseOrders_CreatedAt' AND object_id=OBJECT_ID('dbo.PurchaseOrders')) CREATE INDEX IX_PurchaseOrders_CreatedAt ON dbo.PurchaseOrders(CreatedAt DESC) INCLUDE (EmployeeId,State)`,
  `IF OBJECT_ID('dbo.AdminOrderNotifications','U') IS NULL CREATE TABLE dbo.AdminOrderNotifications (
    Id uniqueidentifier NOT NULL PRIMARY KEY, EmployeeId uniqueidentifier NOT NULL, OrderId uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset NOT NULL, ReadAt datetimeoffset NULL,
    CONSTRAINT FK_AdminOrderNotifications_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(Id),
    CONSTRAINT FK_AdminOrderNotifications_Order FOREIGN KEY (OrderId) REFERENCES dbo.PurchaseOrders(Id))`,
  `IF OBJECT_ID('dbo.OrderPushDeliveries','U') IS NULL CREATE TABLE dbo.OrderPushDeliveries (
    Id uniqueidentifier NOT NULL PRIMARY KEY, NotificationId uniqueidentifier NOT NULL, DeviceId uniqueidentifier NOT NULL,
    State varchar(32) NOT NULL, Attempts int NOT NULL, RetryAt datetimeoffset NOT NULL, LeaseUntil datetimeoffset NULL,
    CONSTRAINT FK_OrderPushDeliveries_Notification FOREIGN KEY (NotificationId) REFERENCES dbo.AdminOrderNotifications(Id),
    CONSTRAINT FK_OrderPushDeliveries_Device FOREIGN KEY (DeviceId) REFERENCES dbo.Devices(Id),
    CONSTRAINT UQ_OrderPushDeliveries UNIQUE (NotificationId,DeviceId))`
];
