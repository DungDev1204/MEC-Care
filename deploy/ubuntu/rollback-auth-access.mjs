// Preserve the older application's access rules when a subscription upgrade fails.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export async function restoreAccountAccess(db, users) {
  if (!Array.isArray(users) || users.some(u => !/^[a-f0-9-]{36}$/i.test(u.id) || typeof u.enabled !== 'boolean')) throw new Error('Invalid account access snapshot.');
  await db.transaction(async tx => {
    // Accounts created during the attempted release must also require activation.
    await tx.exec('UPDATE Employees SET Enabled=0 WHERE AccessGranted=0');
    for (const user of users) await tx.update('Employees', { enabled: user.enabled }, 'Id=@id', { id: user.id });
  });
}

async function main() {
  const release = process.env.CLIENTE_RELEASE;
  const backup = process.env.CLIENTE_BACKUP;
  if (!release || !backup) throw new Error('Missing rollback paths.');
  const snapshot = JSON.parse(fs.readFileSync(path.join(backup, 'account-access-before.json'), 'utf8'));
  if (snapshot.previousUsesAccessGranted) return;
  const load = file => import(pathToFileURL(path.join(release, 'dist', file)).href);
  const { readConfig } = await load('config.js');
  const { Database } = await load('db.js');
  const config = readConfig('/etc/cliente/.env', {});
  if (config.review || config.environment !== 'Production' || config.db.database !== 'MEC') throw new Error('Expected production MEC database.');
  let db;
  try {
    db = await Database.connect(config);
    if (!(await db.query("SELECT COL_LENGTH('dbo.Employees','AccessGranted') AS ColumnSize"))[0].columnSize) return;
    const permission = (await db.query("SELECT HAS_PERMS_BY_NAME('dbo.Employees','OBJECT','UPDATE') AS CanUpdate"))[0];
    if (!permission.canUpdate) {
      await db.close(); db = undefined;
      if (!['127.0.0.1', 'localhost', '172.20.235.176'].includes(config.db.server) || config.db.port !== 1433) throw new Error('Unexpected SQL server.');
      const entries = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Config.Env}}', 'robotnet-database'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      const assignment = entries.find(e => e.startsWith('MSSQL_SA_PASSWORD=')) || entries.find(e => e.startsWith('SA_PASSWORD='));
      if (!assignment) throw new Error('SQL administrative credentials unavailable.');
      db = await Database.connect({ ...config, db: { ...config.db, user: 'sa', password: assignment.slice(assignment.indexOf('=') + 1) } });
    }
    await restoreAccountAccess(db, snapshot.users);
    console.log('Previous account access restored; unactivated accounts remain restricted.');
  } finally { await db?.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch(error => { console.error(`Account access rollback failed (${error?.code || error?.name || 'unknown'}).`); process.exitCode = 1; });
}
