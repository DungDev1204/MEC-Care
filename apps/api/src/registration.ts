import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database, Row } from './db.js';
import { hashPassword, verifyPassword } from './auth.js';
import { HttpError, registerSchema, uuid } from './validation.js';
import type { SendOtp } from './mail.js';

export async function settings(db: Database) {
  const row = await db.one('SystemSettings', 'Id=@id', { id: 'auth' });
  return { registrationEnabled: row ? !!row.registrationEnabled : true, defaultActivationMonths: row ? Number(row.defaultActivationMonths) : 1 };
}
const uniqueConflict = (error: any) => [2601,2627].includes(error.number) || error.code?.startsWith('ERR_SQLITE') && error.message?.includes('UNIQUE constraint');
const pendingValid = (pending: Row | undefined) => pending && Date.parse(pending.createdAt) + 30 * 60000 > Date.now();
export function registrationRouter(db: Database, send: SendOtp) {
  const router = Router();
  router.use(rateLimit({ windowMs: 10 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Bạn đã thử nhiều lần. Vui lòng chờ rồi thử lại.' } }));
  router.get('/registration/config', async (_req, res) => { res.json({ registrationEnabled: (await settings(db)).registrationEnabled }); });
  router.post('/register', rateLimit({ windowMs: 10 * 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Vui lòng chờ 10 phút trước khi đăng ký lại.' } }), async (req, res) => {
    if (!(await settings(db)).registrationEnabled) throw new HttpError(403, 'Đăng ký mới đang tạm đóng.');
    const input = registerSchema.parse(req.body);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const now = new Date();
    const pending = { id: randomUUID(), email: input.email, username: input.username, passwordHash: await hashPassword(input.password),
      codeHash: await hashPassword(code), createdAt: now, sentAt: now, expiresAt: new Date(now.getTime() + 10 * 60000), attempts: 0, sends: 1 };
    try {
      await db.transaction(async tx => {
        await tx.remove('Registrations', 'CreatedAt<=@cutoff', { cutoff: new Date(now.getTime() - 30 * 60000) });
        if (await tx.one('Employees', 'Email=@email OR Username=@username', input)) throw new HttpError(409, 'Email hoặc username đã được sử dụng.');
        // Never allow the bootstrap administrator address to be self-registered.
        if (input.email === 'admin@admin.com') throw new HttpError(409, 'Email này dành cho quản trị viên.');
        const previous = await tx.one('Registrations', 'Email=@email', input);
        if (previous && (Date.parse(previous.sentAt) + 60000 > now.getTime() || previous.attempts >= 5 && Date.parse(previous.createdAt) + 30 * 60000 > now.getTime())) throw new HttpError(429, 'Vui lòng chờ trước khi đăng ký lại.');
        if (previous) await tx.remove('Registrations', 'Id=@id', { id: previous.id });
        await tx.insert('Registrations', pending);
      });
    } catch (error) { if (uniqueConflict(error)) throw new HttpError(409, 'Email hoặc username đã được sử dụng.'); throw error; }
    try { await send(input.email, code); }
    catch (error) { await db.remove('Registrations', 'Id=@id', { id: pending.id }); throw error; }
    res.status(202).json({ registrationId: pending.id, email: input.email, expiresAt: pending.expiresAt.toISOString(), resendAfterSeconds: 60 });
  });
  router.post('/register/resend', async (req, res) => {
    const { registrationId } = z.object({ registrationId: uuid }).parse(req.body);
    if (!(await settings(db)).registrationEnabled) throw new HttpError(403, 'Đăng ký mới đang tạm đóng.');
    const code = String(randomInt(0, 1000000)).padStart(6, '0'); const codeHash = await hashPassword(code); const now = new Date();
    const pending = await db.transaction(async tx => {
      const p = await tx.one('Registrations', 'Id=@id', { id: registrationId });
      if (!pendingValid(p) || p!.attempts >= 5 || p!.sends >= 5) throw new HttpError(400, 'Phiên xác minh đã hết hạn hoặc hết lượt thử. Vui lòng đăng ký lại.');
      if (Date.parse(p!.sentAt) + 60000 > now.getTime()) throw new HttpError(429, 'Vui lòng chờ 60 giây giữa các lần gửi mã.');
      await tx.update('Registrations', { codeHash, expiresAt: new Date(Math.min(now.getTime() + 10 * 60000, Date.parse(p!.createdAt) + 30 * 60000)), sentAt: now, sends: p!.sends + 1 }, 'Id=@id', { id: registrationId });
      return p!;
    });
    await send(pending.email, code);
    res.json({ message: 'Đã gửi mã xác minh mới.', resendAfterSeconds: 60 });
  });
  router.post('/register/verify', async (req, res) => {
    const input = z.object({ registrationId: uuid, code: z.string().regex(/^\d{6}$/, 'Nhập đúng 6 chữ số.') }).parse(req.body);
    if (!(await settings(db)).registrationEnabled) throw new HttpError(403, 'Đăng ký mới đang tạm đóng.');
    try {
      const result = await db.transaction(async tx => {
        const p = await tx.one('Registrations', 'Id=@id', { id: input.registrationId });
        if (!pendingValid(p) || Date.parse(p!.expiresAt) <= Date.now() || p!.attempts >= 5) return 'expired';
        if (!await verifyPassword(input.code, p!.codeHash)) {
          await tx.update('Registrations', { attempts: p!.attempts + 1 }, 'Id=@id', { id: p!.id }); return 'wrong';
        }
        await tx.insert('Employees', { id: randomUUID(), email: p!.email, username: p!.username, displayName: p!.username, phone: '',
          passwordHash: p!.passwordHash, enabled: true, accessGranted: false, emailVerified: true, isAdmin: false, activeUntil: null });
        await tx.remove('Registrations', 'Id=@id', { id: p!.id }); return 'verified';
      });
      if (result === 'expired') throw new HttpError(400, 'Mã đã hết hạn hoặc hết lượt thử. Vui lòng gửi lại mã hoặc đăng ký lại.');
      if (result === 'wrong') throw new HttpError(400, 'Mã xác minh không đúng. Tối đa 5 lần thử.');
    } catch (error) { if (uniqueConflict(error)) throw new HttpError(409, 'Email hoặc username đã được sử dụng. Vui lòng đăng ký lại.'); throw error; }
    res.status(201).json({ status: 'pendingActivation', message: 'Email đã được xác minh. Bạn có thể đăng nhập và đăng ký gói để sử dụng.' });
  });
  return router;
}
