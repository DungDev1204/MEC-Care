import { Router } from 'express';
import webpush from 'web-push';
import { z } from 'zod';
import { randomUUID, ECDH } from 'node:crypto';
import type { Database, Row } from './db.js';
import type { Config } from './config.js';
import { hash } from './auth.js';
import { HttpError, generate } from './validation.js';
import { runOrderNotifications } from './order-notifications.js';
import { settings } from './system-settings.js';

export function endpointAllowed(endpoint: string) {
  try { const u = new URL(endpoint); return endpoint.length <= 2048 && u.protocol === 'https:' && (!u.port || u.port === '443') && !u.username && !u.password && !u.hash &&
    (u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.push.apple.com') || u.hostname.endsWith('.notify.windows.com')); } catch { return false; }
}
export function keyValid(key: string, size: number) {
  try { if (!/^[A-Za-z0-9_-]+$/.test(key)) return false; const bytes = Buffer.from(key, 'base64url'); if (bytes.length !== size) return false;
    if (size === 65) { if (bytes[0] !== 4) return false; ECDH.convertKey(bytes,'prime256v1'); } return true; } catch { return false; }
}
export function validatePush(config: Config) {
  if (!keyValid(config.push.publicKey,65) || !keyValid(config.push.privateKey,32) || !/^(mailto:|https:\/\/)/.test(config.push.subject)) throw new Error('Set PUSH_PUBLIC_KEY, PUSH_PRIVATE_KEY and PUSH_SUBJECT in .env before enabling push.');
}
export function pushRouter(db: Database, config: Config) {
  const router = Router();
  router.get('/push/config', (_req, res) => { res.json({ enabled: config.push.enabled, publicKey: config.push.enabled ? config.push.publicKey : null }); });
  router.post('/push/subscribe', async (req, res) => {
    if (!config.push.enabled) throw new HttpError(409, 'Thông báo chưa được bật trên máy chủ.');
    const input = z.object({ endpoint: z.string().max(2048).refine(endpointAllowed), keys: z.object({ p256dh: z.string().max(128).refine(v => keyValid(v,65)), auth: z.string().max(64).refine(v => keyValid(v,16)) }) }).parse(req.body);
    await db.transaction(async tx => {
      const pushToken = hash(input.endpoint); const previous = await tx.one('Devices', 'PushToken=@hash', { hash: pushToken });
      const device = { ownerId: res.locals.user.id, sessionId: res.locals.user.sessionId, enabled: true, endpoint: input.endpoint, p256dh: input.keys.p256dh, authKey: input.keys.auth, pushToken };
      if (previous) {
        if (previous.ownerId !== device.ownerId) {
          await tx.remove('Deliveries', 'DeviceId=@id', { id: previous.id });
          await tx.remove('OrderPushDeliveries', 'DeviceId=@id', { id: previous.id });
        }
        await tx.update('Devices', device, 'Id=@id', { id: previous.id });
      } else await tx.insert('Devices', { ...device, id: randomUUID() });
    }); res.sendStatus(204);
  });
  router.post('/push/unsubscribe', async (req, res) => {
    const endpoint = z.object({ endpoint: z.string().max(2048) }).parse(req.body).endpoint;
    await db.update('Devices', { enabled: false }, 'OwnerId=@owner AND PushToken=@hash', { owner: res.locals.user.id, hash: hash(endpoint) }); res.sendStatus(204);
  }); return router;
}
export type PushSender = (device: Row, payload: string) => Promise<unknown>;
export function sender(config: Config): PushSender {
  validatePush(config);
  return (d, payload) => {
    if (!endpointAllowed(d.endpoint)) throw new Error('Blocked notification endpoint.');
    return webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.authKey } }, payload, { timeout: 20000, TTL: 86400, urgency: 'normal', vapidDetails: { subject: config.push.subject, publicKey: config.push.publicKey, privateKey: config.push.privateKey } });
  };
}
export async function runCycle(db: Database, send: PushSender, now = new Date()) {
  await runOrderNotifications(db, send, now);
  const subscriptionEnabled = (await settings(db)).subscriptionEnabled;
  for (const reminder of await db.rows('Reminders', 'Active=@active AND Repeat=@repeat', { active: true, repeat: 'annual' })) {
    await db.transaction(async tx => {
      const existing = await tx.rows('Occurrences', 'ReminderId=@id AND Revision=@revision', { id: reminder.id, revision: reminder.revision });
      for (const o of generate(reminder, now.getTime())) if (!existing.some(e => Date.parse(e.originalAt) === Date.parse(o.originalAt))) await tx.insert('Occurrences', o);
    });
  }
  const ready = await db.query(`SELECT o.Id AS OccurrenceId, d.Id AS DeviceId FROM Occurrences o JOIN Reminders r ON r.Id=o.ReminderId
    JOIN Customers c ON c.Id=r.CustomerId JOIN Employees e ON e.Id=c.OwnerId JOIN Devices d ON d.OwnerId=c.OwnerId
    WHERE o.State=@pending AND o.NotifyAt<=@now AND r.Active=@enabled AND e.Enabled=@enabled AND COALESCE(e.EmailVerified,1)=1 AND (@subscriptionEnabled=0 OR e.IsAdmin=1 OR (COALESCE(e.AccessGranted,1)=1 AND (e.ActiveUntil IS NULL OR e.ActiveUntil>@now))) AND d.Enabled=@enabled AND d.Endpoint IS NOT NULL
    AND EXISTS (SELECT 1 FROM Sessions s WHERE s.Id=d.SessionId AND s.EmployeeId=d.OwnerId AND s.ExpiresAt>@now)
    AND NOT EXISTS (SELECT 1 FROM Deliveries j WHERE j.OccurrenceId=o.Id AND j.DeviceId=d.Id)`, { pending: 'pending', now, enabled: true, subscriptionEnabled });
  for (const job of ready.slice(0,100)) await db.transaction(async tx => {
    if (!await tx.one('Deliveries', 'OccurrenceId=@occurrenceId AND DeviceId=@deviceId', job)) await tx.insert('Deliveries', { id: randomUUID(), ...job, state: 'pending', attempts: 0, retryAt: now, leaseUntil: null, receiptId: null });
  });
  const jobs = await db.rows('Deliveries', 'State=@pending AND RetryAt<=@now AND (LeaseUntil IS NULL OR LeaseUntil<@now)', { pending: 'pending', now }, 'RetryAt');
  for (const job of jobs.slice(0,50)) {
    if (!await db.update('Deliveries', { leaseUntil: new Date(now.getTime()+120000) }, 'Id=@id AND State=@pending AND (LeaseUntil IS NULL OR LeaseUntil<@now)', { id: job.id, pending: 'pending', now })) continue;
    const current = await db.query(`SELECT d.*, c.Id AS CustomerId FROM Devices d JOIN Customers c ON c.OwnerId=d.OwnerId
      JOIN Reminders r ON r.CustomerId=c.Id JOIN Occurrences o ON o.ReminderId=r.Id JOIN Employees e ON e.Id=c.OwnerId
      WHERE d.Id=@deviceId AND o.Id=@occurrenceId AND o.State=@pending AND o.NotifyAt<=@now AND d.Enabled=@enabled AND r.Active=@enabled AND e.Enabled=@enabled AND COALESCE(e.EmailVerified,1)=1 AND (@subscriptionEnabled=0 OR e.IsAdmin=1 OR (COALESCE(e.AccessGranted,1)=1 AND (e.ActiveUntil IS NULL OR e.ActiveUntil>@now)))
      AND EXISTS (SELECT 1 FROM Sessions s WHERE s.Id=d.SessionId AND s.EmployeeId=d.OwnerId AND s.ExpiresAt>@now)`, { deviceId: job.deviceId, occurrenceId: job.occurrenceId, pending: 'pending', now: new Date(), enabled: true, subscriptionEnabled: (await settings(db)).subscriptionEnabled });
    const device = current[0]; const updates: Row = { leaseUntil: null };
    if (!device?.endpoint) updates.state = 'cancelled';
    else {
      updates.attempts = job.attempts + 1;
      try { await send(device, JSON.stringify({ title: 'Clienté · Lịch chăm sóc', body: 'Bạn có một lịch chăm sóc đến hạn.', url: `/customers/${device.customerId}?tab=reminders&occurrence=${job.occurrenceId}`, tag: job.occurrenceId })); updates.state = 'providerAccepted'; }
      catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) { updates.state = 'failed'; await db.update('Devices', { enabled: false }, 'Id=@id', { id: device.id }); }
        else { updates.state = updates.attempts >= 5 ? 'failed' : 'pending'; updates.retryAt = new Date(Date.now() + 2 ** updates.attempts * 15000); }
        console.warn(`Notification attempt failed for delivery ${job.id}.`);
      }
    }
    await db.update('Deliveries', updates, 'Id=@id', { id: job.id });
  }
}
export function startWorker(db: Database, send: PushSender) {
  let stopped = false; let timer: NodeJS.Timeout | undefined;
  const cycle = async () => { try { await runCycle(db,send); } catch { console.error('Reminder worker failed; queued jobs will be retried.'); }
    if (!stopped) timer = setTimeout(cycle,15000); };
  void cycle(); return () => { stopped = true; if (timer) clearTimeout(timer); };
}
