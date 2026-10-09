import { Router } from 'express';
import { ZipArchive } from 'archiver';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import type { Database } from './db.js';
import type { Config } from './config.js';
import { personalSchema, HttpError } from './validation.js';
import { photoPath } from './customers.js';

export function accountRouter(db: Database, config: Config) {
  const router = Router();
  router.get('/account', async (_req, res) => {
    const owner = res.locals.user.id; const employee = await db.one('Employees', 'Id=@owner', { owner });
    const session = await db.one('Sessions', 'Id=@id AND EmployeeId=@owner', { id: res.locals.user.sessionId, owner });
    const customers = await db.rows('Customers', 'OwnerId=@owner', { owner });
    const counts = await db.query('SELECT (SELECT COUNT(*) FROM Photos WHERE CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)) AS Photos, (SELECT COUNT(*) FROM Contacts WHERE CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)) AS Contacts, (SELECT COUNT(*) FROM Reminders WHERE Active=@active AND CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)) AS Reminders', { owner, active: true });
    res.json({ userCode: employee!.userCode, username: employee!.username, email: employee!.email, displayName: employee!.displayName, phone: employee!.phone, expiresAt: session!.expiresAt, timeZone: 'Asia/Ho_Chi_Minh', customers: customers.length, ...counts[0] });
  });
  router.put('/account', async (req, res) => {
    const data = personalSchema.parse(req.body); await db.update('Employees', data, 'Id=@owner', { owner: res.locals.user.id });
    res.json({ ...data, email: res.locals.user.email });
  });
  router.get('/account/backup', async (req, res) => {
    const includePhotos = req.query.includePhotos !== 'false'; const owner = res.locals.user.id;
    const snapshot = await db.transaction(async tx => {
      const employee = await tx.one('Employees', 'Id=@owner', { owner });
      return { account: { email: employee!.email, displayName: employee!.displayName, phone: employee!.phone },
        customers: await tx.rows('Customers', 'OwnerId=@owner', { owner }),
        vehicles: await tx.rows('Vehicles', 'CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { owner }),
        contacts: await tx.rows('Contacts', 'CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { owner }),
        reminders: await tx.rows('Reminders', 'CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { owner }),
        occurrences: await tx.rows('Occurrences', 'ReminderId IN (SELECT r.Id FROM Reminders r JOIN Customers c ON c.Id=r.CustomerId WHERE c.OwnerId=@owner)', { owner }),
        photos: await tx.rows('Photos', 'CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { owner }) };
    });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cliente-backup-')); const target = path.join(directory, 'backup.zip');
    let zip: ZipArchive | undefined; let output: ReturnType<typeof createWriteStream> | undefined;
    try {
      zip = new ZipArchive({ zlib: { level: 6 } }); output = createWriteStream(target); zip.pipe(output);
      const complete = finished(output); void complete.catch(() => {}); zip.on('error', error => output!.destroy(error));
      const photos = [];
      for (const photo of snapshot.photos) {
        const archivePath = includePhotos ? `photos/${photo.id}${path.extname(photo.fileName)}` : null; let checksum = null;
        if (includePhotos) {
          const bytes = await fs.readFile(photoPath(config, photo.fileName)); checksum = createHash('sha256').update(bytes).digest('hex').toUpperCase();
          zip.append(bytes, { name: archivePath! });
        }
        const { fileName, ...metadata } = photo; photos.push({ ...metadata, archivePath, sha256: checksum });
      }
      const exportedAt = new Date().toISOString();
      const data = { format: 'cliente-personal-backup', version: 1, exportedAt, timeZone: 'Asia/Ho_Chi_Minh', includePhotos, account: snapshot.account,
        customers: snapshot.customers.map(({ ownerId, searchText, ...c }) => ({ ...c, vehicles: snapshot.vehicles.filter(v => v.customerId === c.id) })),
        contacts: snapshot.contacts, reminders: snapshot.reminders, occurrences: snapshot.occurrences.map(({ rowVersion, ...o }) => o), photos };
      zip.append(JSON.stringify(data, null, 2), { name: 'data.json' }); await zip.finalize(); await complete;
      res.download(target, `cliente-${exportedAt.slice(0,10).replace(/-/g,'')}.zip`, () => { void fs.rm(directory, { recursive: true, force: true }); });
    } catch (error) {
      zip?.abort(); output?.destroy(); if (output) await finished(output).catch(() => {});
      await fs.rm(directory, { recursive: true, force: true });
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(409, 'Một ảnh đã thay đổi hoặc không còn trên máy chủ. Hãy thử lại.');
      throw error;
    }
  }); return router;
}
