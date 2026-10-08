import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database, Row } from './db.js';
import { ownedCustomer } from './customers.js';
import { uuid, reminderSchema, contactSchema, generate, localTime, HttpError } from './validation.js';

export async function addReminder(db: Database, customerId: string, data: Row) {
  const reminder = await db.insert('Reminders', { ...data, id: randomUUID(), customerId, active: true, revision: 1 });
  for (const o of generate(reminder)) await db.insert('Occurrences', o); return reminder;
}
export function careRouter(db: Database) {
  const router = Router();
  const owned = (owner: string) => ({ owner });
  async function reminder(id: string, owner: string, source = db) {
    uuid.parse(id); const row = await source.one('Reminders', 'Id=@id AND CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { id, owner });
    if (!row) throw new HttpError(404, 'Không tìm thấy lịch nhắc.'); return row;
  }
  async function occurrence(id: string, owner: string, source = db) {
    uuid.parse(id); const row = await source.one('Occurrences', 'Id=@id AND ReminderId IN (SELECT r.Id FROM Reminders r JOIN Customers c ON c.Id=r.CustomerId WHERE c.OwnerId=@owner AND r.Active=@active)', { id, owner, active: true });
    if (!row) throw new HttpError(404, 'Không tìm thấy lần nhắc.'); return row;
  }
  router.get('/agenda', async (_req, res) => {
    const params = owned(res.locals.user.id);
    const customers = await db.rows('Customers', 'OwnerId=@owner', params);
    const reminders = await db.rows('Reminders', 'Active=@active AND CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { ...params, active: true });
    const occurrences = await db.rows('Occurrences', 'State=@state AND ScheduledAt<=@end AND ReminderId IN (SELECT r.Id FROM Reminders r JOIN Customers c ON c.Id=r.CustomerId WHERE c.OwnerId=@owner AND r.Active=@active)', { ...params, state: 'pending', end: new Date(Date.now()+366*86400000), active: true }, 'ScheduledAt');
    res.json(occurrences.slice(0,1000).map(o => { const r = reminders.find(r => r.id === o.reminderId)!; const c = customers.find(c => c.id === r.customerId)!;
      return { occurrence: o, reminder: r, customerId: c.id, customerName: c.name, phone: c.phone, avatarId: c.avatarId }; }));
  });
  router.get('/customers/:id/contacts', async (req, res) => {
    const c = await ownedCustomer(db, res.locals.user.id, String(req.params.id)); res.json(await db.rows('Contacts', 'CustomerId=@id', { id: c.id }, 'At DESC'));
  });
  router.get('/customers/:id/reminders', async (req, res) => {
    const c = await ownedCustomer(db, res.locals.user.id, String(req.params.id));
    const reminders = await db.rows('Reminders', 'CustomerId=@id', { id: c.id }, 'LocalDateTime DESC');
    const occurrences = await db.rows('Occurrences', 'ReminderId IN (SELECT Id FROM Reminders WHERE CustomerId=@id)', { id: c.id }, 'ScheduledAt');
    res.json(reminders.map(r => ({ reminder: r, occurrences: occurrences.filter(o => o.reminderId === r.id) })));
  });
  router.post('/customers/:id/reminders', async (req, res) => {
    const c = await ownedCustomer(db, res.locals.user.id, String(req.params.id)); const data = reminderSchema.parse(req.body);
    res.json(await db.transaction(tx => addReminder(tx, c.id, data)));
  });
  router.put('/reminders/:id', async (req, res) => {
    const data = reminderSchema.parse(req.body); res.json(await db.transaction(async tx => {
      const r = await reminder(String(req.params.id), res.locals.user.id, tx);
      await tx.update('Occurrences', { state: 'cancelled' }, 'ReminderId=@id AND State=@state', { id: r.id, state: 'pending' });
      const updated = { ...r, ...data, active: true, revision: r.revision + 1 }; await tx.update('Reminders', updated, 'Id=@id', { id: r.id });
      for (const o of generate(updated)) await tx.insert('Occurrences', o); return updated;
    }));
  });
  router.delete('/reminders/:id', async (req, res) => {
    await db.transaction(async tx => {
      const r = await reminder(String(req.params.id), res.locals.user.id, tx);
      await tx.update('Reminders', { active: false }, 'Id=@id', { id: r.id });
      await tx.update('Occurrences', { state: 'cancelled' }, 'ReminderId=@id AND State=@state', { id: r.id, state: 'pending' });
    }); res.sendStatus(204);
  });
  router.post('/occurrences/:id/complete', async (req, res) => {
    await db.transaction(async tx => {
      const o = await occurrence(String(req.params.id), res.locals.user.id, tx);
      if (!await tx.update('Occurrences', { state: 'completed', completedAt: new Date() }, 'Id=@id AND State=@state', { id: o.id, state: 'pending' })) throw new HttpError(409, 'Lần nhắc đã được xử lý.');
    }); res.sendStatus(204);
  });
  router.post('/occurrences/:id/snooze', async (req, res) => {
    const input = z.object({ localDateTime: z.string(), timeZone: z.string().max(100) }).parse(req.body);
    const time = localTime(input.localDateTime, input.timeZone).toUTC(); if (time.toMillis() <= Date.now()) throw new HttpError(400, 'Chọn giờ trong tương lai.');
    res.json(await db.transaction(async tx => {
      const o = await occurrence(String(req.params.id), res.locals.user.id, tx);
      if (!await tx.update('Occurrences', { scheduledAt: time.toISO(), notifyAt: time.toISO() }, 'Id=@id AND State=@state', { id: o.id, state: 'pending' })) throw new HttpError(409, 'Lần nhắc đã được xử lý.');
      await tx.remove('Deliveries', 'OccurrenceId=@id', { id: o.id }); return tx.one('Occurrences', 'Id=@id', { id: o.id });
    }));
  });
  router.post('/customers/:id/contacts', async (req, res) => {
    const c = await ownedCustomer(db, res.locals.user.id, String(req.params.id)); const input = contactSchema.parse(req.body);
    res.json(await db.transaction(async tx => {
      if (input.occurrenceId) {
        const o = await occurrence(input.occurrenceId, res.locals.user.id, tx); const r = await reminder(o.reminderId, res.locals.user.id, tx);
        if (r.customerId !== c.id) throw new HttpError(404, 'Không tìm thấy lịch nhắc của khách này.');
        if (!await tx.update('Occurrences', { state: 'completed', completedAt: input.at }, 'Id=@id AND State=@state', { id: o.id, state: 'pending' })) throw new HttpError(409, 'Lần nhắc đã được xử lý.');
      }
      if (input.nextReminder) await addReminder(tx, c.id, input.nextReminder);
      return tx.insert('Contacts', { id: randomUUID(), customerId: c.id, at: input.at, channel: input.channel, content: input.content, occurrenceId: input.occurrenceId ?? null });
    }));
  }); return router;
}
