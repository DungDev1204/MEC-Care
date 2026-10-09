import { randomInt } from 'node:crypto';
import type { Database } from './db.js';

export function randomCode(length = 10) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}
export async function newUserCode(db: Database) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    if (!/[A-Z]/.test(code) || !/\d/.test(code)) continue;
    if (!await db.one('Employees', 'UserCode=@code', { code })) return code;
  }
  throw new Error('Could not allocate a unique user code.');
}
export async function assignUserCodes(db: Database) {
  await db.transaction(async tx => {
    for (const user of await tx.rows('Employees', 'UserCode IS NULL')) {
      await tx.update('Employees', { userCode: await newUserCode(tx) }, 'Id=@id AND UserCode IS NULL', { id: user.id });
    }
  });
}
