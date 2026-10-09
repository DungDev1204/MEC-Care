import type { Database } from './db.js';

export async function settings(db: Database) {
  const row = await db.one('SystemSettings', 'Id=@id', { id: 'auth' });
  return {
    registrationEnabled: row ? !!row.registrationEnabled : true,
    defaultActivationMonths: row ? Number(row.defaultActivationMonths) : 1,
    subscriptionEnabled: row?.subscriptionEnabled !== false
  };
}
