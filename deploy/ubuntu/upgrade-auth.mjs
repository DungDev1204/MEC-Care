// Run by upgrade-auth.sh as root; all credentials stay in memory or protected files.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const release = process.env.CLIENTE_RELEASE;
const backup = process.env.CLIENTE_BACKUP;
const stamp = process.env.CLIENTE_STAMP;
if (!release || !backup || !/^\d{8}T\d{6}Z$/.test(stamp || '')) throw new Error('Missing deployment paths.');
const load = file => import(pathToFileURL(path.join(release, 'dist', file)).href);
const { readConfig, updateEnv } = await load('config.js');
const { Database } = await load('db.js');
const { migrateAuth } = await load('auth-schema.js');
const nodemailer = createRequire(path.join(release, 'package.json'))('nodemailer');
const config = readConfig('/etc/cliente/.env', {});
if (config.review || config.environment !== 'Production' || config.db.database !== 'MEC') throw new Error('Expected production MEC database.');
const smtp = JSON.parse(fs.readFileSync(process.env.CLIENTE_SMTP_FILE, 'utf8'));
if (smtp.SMTP_USER !== 'robotics.gitlab.2fa@gmail.com' || smtp.SMTP_FROM !== smtp.SMTP_USER || !smtp.SMTP_PASS) throw new Error('Unexpected SMTP configuration.');
config.db.requestTimeout = 180000;
let db;
try {
  db = await Database.connect(config);
  const permissions = (await db.query(`SELECT HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','BACKUP DATABASE') AS CanBackup,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS CanCreate,
    HAS_PERMS_BY_NAME('dbo.Employees','OBJECT','ALTER') AS CanAlter`))[0];
  if (!permissions.canBackup || !permissions.canCreate || !permissions.canAlter) {
    await db.close(); db = undefined;
    if (!['127.0.0.1','localhost','172.20.235.176'].includes(config.db.server) || config.db.port !== 1433) throw new Error('Database permissions insufficient; unexpected SQL server.');
    // Use the SQL container's existing administrator only for backup and migration.
    // Do not grant DDL rights to the application's regular database account.
    const entries = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Config.Env}}', 'robotnet-database'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
    const assignment = entries.find(e => e.startsWith('MSSQL_SA_PASSWORD=')) || entries.find(e => e.startsWith('SA_PASSWORD='));
    if (!assignment) throw new Error('SQL administrative credentials unavailable.');
    db = await Database.connect({ ...config, db: { ...config.db, user: 'sa', password: assignment.slice(assignment.indexOf('=') + 1) } });
    console.log('Using existing SQL administrator for migration only.');
  }
  const counts = async () => (await db.query(`SELECT
    (SELECT COUNT(*) FROM dbo.Employees) AS Employees,
    (SELECT COUNT(*) FROM dbo.Customers) AS Customers,
    (SELECT COUNT(*) FROM dbo.Photos) AS Photos,
    (SELECT COUNT(*) FROM dbo.Reminders) AS Reminders,
    (SELECT COUNT(*) FROM dbo.Employees WHERE Email='admin@admin.com' AND Enabled=1) AS ActiveAdmin`))[0];
  const before = await counts();
  if (before.activeAdmin !== 1) throw new Error('Expected one existing active admin@admin.com account.');
  const mounts = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Mounts}}', 'robotnet-database'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
  if (!mounts.some(m => m.Destination === '/var/opt/mssql/data' && m.Source === '/home/robotics/robotnet/database')) throw new Error('Unexpected SQL data volume.');
  const sqlBackup = `/var/opt/mssql/data/MEC-before-auth-${stamp}.bak`;
  await db.exec('BACKUP DATABASE [MEC] TO DISK=@backup WITH COPY_ONLY, CHECKSUM, COMPRESSION', { backup: sqlBackup });
  await db.exec('RESTORE VERIFYONLY FROM DISK=@backup WITH CHECKSUM', { backup: sqlBackup });
  // SQL's data volume is mounted from this host path; verified during preflight.
  const hostBackup = `/home/robotics/robotnet/database/MEC-before-auth-${stamp}.bak`;
  fs.chmodSync(hostBackup, 0o600);
  fs.copyFileSync(hostBackup, path.join(backup, 'MEC.bak'));
  fs.chmodSync(path.join(backup, 'MEC.bak'), 0o600);
  fs.writeFileSync(path.join(backup, 'database-before.json'), JSON.stringify(before, null, 2), { mode: 0o600 });
  const previousUsesAccessGranted = fs.readFileSync(path.join(process.env.CLIENTE_PREVIOUS, 'dist/auth.js'), 'utf8').includes('AccessGranted');
  const accessBefore = { previousUsesAccessGranted, users: await db.query('SELECT Id, Enabled FROM dbo.Employees') };
  fs.writeFileSync(path.join(backup, 'account-access-before.json'), JSON.stringify(accessBefore), { mode: 0o600 });
  console.log('MEC COPY_ONLY backup created, checksum verified and protected.');
  await migrateAuth(db);
  // A failed attempt can retain the new column while restoring old Enabled values.
  // Only an upgrade from the older backend converts pending accounts again.
  if (!previousUsesAccessGranted) await db.exec('UPDATE dbo.Employees SET Enabled=1 WHERE AccessGranted=0 AND Enabled=0 AND ActiveUntil IS NULL');
  await db.check();
  const after = await counts();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Data counts changed during migration.');
  const admin = await db.one('Employees', 'Email=@email', { email: 'admin@admin.com' });
  if (!admin?.isAdmin) throw new Error('Existing administrator was not promoted.');
  const appDb = await Database.connect(config);
  try { await appDb.check(); } finally { await appDb.close(); }
  const transport = nodemailer.createTransport({ host: smtp.SMTP_HOST, port: Number(smtp.SMTP_PORT), secure: smtp.SMTP_SECURE === 'true',
    auth: { user: smtp.SMTP_USER, pass: smtp.SMTP_PASS.replace(/\s/g, '') }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
  try { await transport.verify(); } finally { transport.close(); }
  console.log('Server SMTP authentication verified; no email sent.');
  updateEnv('/etc/cliente/.env', { ...smtp, ALLOWED_HOSTS: [...new Set([...config.allowedHosts, 'care.tranie-mua.io.vn', 'localhost', '127.0.0.1'])].join(';') });
  console.log(`Authentication migration ready. Existing data preserved: ${JSON.stringify(after)}; admin username=${admin.username}`);
} catch (error) {
  // Never print SQL/container or SMTP errors that could include credentials.
  console.error(`Upgrade preflight/migration failed (${error?.code || error?.name || 'unknown'}). Server configuration backup retained.`);
  process.exitCode = 1;
} finally { await db?.close(); }
