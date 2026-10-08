import sql from 'mssql';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';

export type Row = Record<string, any>;
export type Params = Record<string, string | number | boolean | Date | Buffer | null | undefined>;
const tables = {
  Employees: 'Id Email DisplayName Phone PasswordHash Enabled Username EmailVerified IsAdmin ActiveUntil AccessGranted', Sessions: 'Id EmployeeId TokenHash ExpiresAt',
  SubscriptionRequests: 'Id CreatedAt State',
  Announcements: 'Id Title Content StartsAt EndsAt Enabled CreatedAt CreatedBy',
  AnnouncementDismissals: 'Id AnnouncementId EmployeeId CreatedAt',
  Registrations: 'Id Email Username PasswordHash CodeHash ExpiresAt CreatedAt SentAt Attempts Sends',
  SystemSettings: 'Id RegistrationEnabled DefaultActivationMonths',
  AdminAudit: 'Id ActorId TargetId Action CreatedAt Details',
  Customers: 'Id OwnerId Name SearchText Phone BirthDate Interests Notes PreferredContact Status AvatarId UpdatedAt',
  Vehicles: 'Id CustomerId Model Plate DeliveryDate', Photos: 'Id CustomerId FileName ContentType Caption IsAvatar CreatedAt',
  Contacts: 'Id CustomerId At Channel Content OccurrenceId',
  Reminders: 'Id CustomerId Kind Content LocalDateTime TimeZone Repeat LeadDays LeapDayPolicy Active Revision',
  Occurrences: 'Id RowVersion ReminderId Revision OriginalAt ScheduledAt NotifyAt State CompletedAt',
  Devices: 'Id OwnerId PushToken Endpoint P256dh AuthKey SessionId Enabled',
  Deliveries: 'Id OccurrenceId DeviceId State Attempts RetryAt LeaseUntil ReceiptId'
} as const;
export type Table = keyof typeof tables;
const timeColumns = ['At','ExpiresAt','ActiveUntil','StartsAt','EndsAt','SentAt','UpdatedAt','CreatedAt','OriginalAt','ScheduledAt','NotifyAt','CompletedAt','RetryAt','LeaseUntil'];
function normalize(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([key, raw]) => {
    const name = key[0].toLowerCase() + key.slice(1); let value = raw;
    if (raw instanceof Date) value = ['BirthDate', 'DeliveryDate'].includes(key) ? raw.toISOString().slice(0, 10) : key === 'LocalDateTime' ? raw.toISOString().slice(0, 19) : raw.toISOString();
    if (typeof raw === 'number' && timeColumns.includes(key)) value = new Date(raw).toISOString();
    if (typeof raw === 'string' && (key === 'Id' || key.endsWith('Id')) && /^[0-9a-f-]{36}$/i.test(raw)) value = raw.toLowerCase();
    if (['Enabled', 'Active', 'IsAvatar', 'EmailVerified', 'IsAdmin', 'AccessGranted', 'RegistrationEnabled'].includes(key)) value = !!raw;
    if (['EmailVerified', 'AccessGranted'].includes(key) && raw == null) value = true;
    if (raw instanceof Uint8Array) value = Buffer.from(raw).toString('base64');
    return [name, value];
  }));
}
export class Database {
  constructor(private pool?: sql.ConnectionPool, private sqlite?: DatabaseSync, private sqlTransaction?: sql.Transaction) {}
  static async connect(config: Config) {
    if (config.review || config.environment === 'Testing') {
      if (config.reviewDatabase !== ':memory:') fs.mkdirSync(path.dirname(config.reviewDatabase), { recursive: true });
      const sqlite = new DatabaseSync(config.reviewDatabase);
      for (const [table, columns] of Object.entries(tables)) {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS [${table}] (${columns.split(' ').map(c => `[${c}] ${c === 'Id' ? 'TEXT PRIMARY KEY' : ['Enabled','Active','IsAvatar','LeadDays','Revision','Attempts','Sends','EmailVerified','IsAdmin','AccessGranted','RegistrationEnabled','DefaultActivationMonths'].includes(c) ? 'INTEGER' : 'TEXT'}`).join(',')})`);
      }
      const employeeColumns = sqlite.prepare('PRAGMA table_info(Employees)').all().map(row => row.name);
      for (const [column, definition] of Object.entries({ Username: 'TEXT', EmailVerified: 'INTEGER DEFAULT 1', IsAdmin: 'INTEGER DEFAULT 0', ActiveUntil: 'TEXT', AccessGranted: 'INTEGER DEFAULT 1' })) {
        if (!employeeColumns.includes(column)) sqlite.exec(`ALTER TABLE Employees ADD COLUMN ${column} ${definition}`);
      }
      if (!employeeColumns.includes('AccessGranted')) sqlite.exec('UPDATE Employees SET Enabled=1, AccessGranted=0 WHERE Username IS NOT NULL AND Enabled=0 AND ActiveUntil IS NULL AND EmailVerified=1 AND IsAdmin=0');
      sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_Employees_Username ON Employees(Username) WHERE Username IS NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_Registrations_Email ON Registrations(Email);');
      sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_AnnouncementDismissals_User ON AnnouncementDismissals(EmployeeId, AnnouncementId);');
      // Review databases created by the old backend stored UTC ticks, not Unix milliseconds.
      // Convert only those columns; keep a consistent SQLite snapshot before changing saved data.
      const legacyColumns = Object.entries(tables).flatMap(([table, columns]) => columns.split(' ').filter(column => timeColumns.includes(column)).map(column => ({table,column})))
        .filter(({table,column}) => Number(sqlite.prepare(`SELECT COUNT(*) AS Count FROM [${table}] WHERE typeof([${column}])='integer' AND [${column}]>=621355968000000000`).get()!.Count) > 0);
      const legacyIds = Object.entries(tables).flatMap(([table,columns]) => columns.split(' ').filter(column => column === 'Id' || column.endsWith('Id') && column !== 'ReceiptId').map(column => ({table,column})))
        .filter(({table,column}) => Number(sqlite.prepare(`SELECT COUNT(*) AS Count FROM [${table}] WHERE [${column}]<>lower([${column}])`).get()!.Count) > 0);
      if (legacyColumns.length || legacyIds.length) {
        const backup = config.reviewDatabase + '.before-node';
        if (config.reviewDatabase !== ':memory:' && !fs.existsSync(backup)) sqlite.exec(`VACUUM INTO '${backup.replace(/'/g,"''")}'`);
        sqlite.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
        try {
          for (const {table,column} of legacyColumns) sqlite.exec(`UPDATE [${table}] SET [${column}]=strftime('%Y-%m-%dT%H:%M:%fZ', ([${column}]-621355968000000000)/10000000.0, 'unixepoch') WHERE typeof([${column}])='integer' AND [${column}]>=621355968000000000`);
          for (const {table,column} of legacyIds) sqlite.exec(`UPDATE [${table}] SET [${column}]=lower([${column}]) WHERE [${column}]<>lower([${column}])`);
          if (sqlite.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Review migration failed foreign-key verification; original data retained.');
          sqlite.exec('COMMIT');
        } catch (error) { sqlite.exec('ROLLBACK'); sqlite.close(); throw error; }
        sqlite.exec('PRAGMA foreign_keys=ON');
      }
      sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_Employees_Email ON Employees(Email); CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_Sessions_TokenHash ON Sessions(TokenHash); CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_Deliveries_Unique ON Deliveries(OccurrenceId,DeviceId); CREATE UNIQUE INDEX IF NOT EXISTS IX_Node_Occurrences_Unique ON Occurrences(ReminderId,Revision,OriginalAt);');
      return new Database(undefined, sqlite);
    }
    const pool = await new sql.ConnectionPool(config.db).connect();
    pool.on('error', () => console.error('SQL connection pool error.'));
    return new Database(pool);
  }
  async query(text: string, params: Params = {}): Promise<Row[]> {
    if (this.sqlite) {
      const statement = this.sqlite.prepare(text); statement.setAllowUnknownNamedParameters(true);
      const mapped = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value instanceof Date ? value.toISOString() : value ?? null]));
      return statement.all(mapped as any).map(normalize);
    }
    const request = this.sqlTransaction ? new sql.Request(this.sqlTransaction) : this.pool!.request();
    for (const [key, value] of Object.entries(params)) {
      if (value instanceof Date) request.input(key, sql.DateTimeOffset, value);
      else if (typeof value === 'string') request.input(key, sql.NVarChar(sql.MAX), value);
      else request.input(key, value ?? null);
    }
    return (await request.query(text)).recordset?.map(normalize) ?? [];
  }
  async exec(text: string, params: Params = {}): Promise<number> {
    if (this.sqlite) {
      const mapped = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value instanceof Date ? value.toISOString() : value ?? null]));
      const statement = this.sqlite.prepare(text); statement.setAllowUnknownNamedParameters(true);
      return Number(statement.run(mapped as any).changes);
    }
    const request = this.sqlTransaction ? new sql.Request(this.sqlTransaction) : this.pool!.request();
    for (const [key, value] of Object.entries(params)) {
      if (value instanceof Date) request.input(key, sql.DateTimeOffset, value);
      else if (typeof value === 'string') request.input(key, sql.NVarChar(sql.MAX), value);
      else request.input(key, value ?? null);
    }
    return (await request.query(text)).rowsAffected.reduce((sum, count) => sum + count, 0);
  }
  rows(table: Table, where = '1=1', params: Params = {}, order = '') { return this.query(`SELECT * FROM [${table}] WHERE ${where}${order ? ` ORDER BY ${order}` : ''}`, params); }
  page(table: Table, where: string, params: Params, order: string, offset: number, limit: number, select = '*') {
    return this.query(`SELECT ${select} FROM [${table}] WHERE ${where} ORDER BY ${order} ${this.sqlite ? 'LIMIT @pageLimit OFFSET @pageOffset' : 'OFFSET @pageOffset ROWS FETCH NEXT @pageLimit ROWS ONLY'}`, { ...params, pageOffset: offset, pageLimit: limit });
  }
  async one(table: Table, where: string, params: Params = {}) { return (await this.rows(table, where, params))[0]; }
  private fields(table: Table, data: Row) {
    return Object.entries(data).filter(([key]) => key !== 'rowVersion' && tables[table].split(' ').includes(key[0].toUpperCase() + key.slice(1)));
  }
  async insert(table: Table, data: Row) {
    if (table === 'Employees') data = { emailVerified: true, isAdmin: false, accessGranted: true, ...data };
    const fields = this.fields(table, data); const params = Object.fromEntries(fields);
    if (table === 'Occurrences' && this.sqlite) { fields.push(['rowVersion', randomUUID()]); params.rowVersion = fields.at(-1)![1]; }
    await this.exec(`INSERT INTO [${table}] (${fields.map(([k]) => `[${k[0].toUpperCase() + k.slice(1)}]`).join(',')}) VALUES (${fields.map(([k]) => `@${k}`).join(',')})`, params);
    return (await this.one(table, 'Id=@id', { id: data.id }))!;
  }
  async update(table: Table, data: Row, where: string, params: Params) {
    const fields = this.fields(table, data).filter(([key]) => key !== 'id');
    if (table === 'Occurrences' && this.sqlite) fields.push(['rowVersion', randomUUID()]);
    return this.exec(`UPDATE [${table}] SET ${fields.map(([key]) => `[${key[0].toUpperCase() + key.slice(1)}]=@set_${key}`).join(',')} WHERE ${where}`, { ...params, ...Object.fromEntries(fields.map(([key, value]) => [`set_${key}`, value])) });
  }
  remove(table: Table, where: string, params: Params) { return this.exec(`DELETE FROM [${table}] WHERE ${where}`, params); }
  private tail: Promise<unknown> = Promise.resolve();
  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    if (this.sqlTransaction) return fn(this);
    if (this.sqlite) {
      const task = this.tail.then(async () => {
        this.sqlite!.exec('BEGIN IMMEDIATE');
        try { const result = await fn(this); this.sqlite!.exec('COMMIT'); return result; }
        catch (error) { this.sqlite!.exec('ROLLBACK'); throw error; }
      });
      this.tail = task.catch(() => {}); return task;
    }
    const tx = new sql.Transaction(this.pool!); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try { const result = await fn(new Database(this.pool, undefined, tx)); await tx.commit(); return result; }
    catch (error) { await tx.rollback().catch(() => {}); throw error; }
  }
  async check() {
    for (const [table, columns] of Object.entries(tables)) await this.query(`SELECT ${columns.split(' ').map(c => `[${c}]`).join(',')} FROM [${table}] WHERE 1=0`);
    console.log('Database connection and required schema are ready.');
  }
  async close() { this.sqlite?.close(); await this.pool?.close(); }
}
