import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { subscriptionExpiry } from './subscription-dates.js';
import type { Database, Row } from './db.js';
import type { Config } from './config.js';
import { HttpError, uuid } from './validation.js';
import { settings } from './system-settings.js';
import { accessStatus } from './auth.js';

function publicUser(u: Row) {
  return { id: u.id, userCode: u.userCode, email: u.email, username: u.username, displayName: u.displayName, enabled: !!u.enabled,
    emailVerified: u.emailVerified !== false, isAdmin: !!u.isAdmin, activeUntil: u.activeUntil,
    subscriptionRequestedAt: u.subscriptionRequestedAt || null,
    status: u.isAdmin ? 'admin' : !u.enabled ? 'inactive' : accessStatus(u) };
}
export function adminRouter(db: Database, config: Config) {
  const router = Router();
  router.use('/admin', (_req, res, next) => { if (!res.locals.user.isAdmin) throw new HttpError(403, 'Chỉ quản trị viên mới có quyền truy cập.'); next(); });
  router.get('/admin/users', async (req, res) => {
    const { search, page, status } = z.object({ search: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(100000).default(1),
      status: z.enum(['', 'admin', 'active', 'pending', 'expired', 'inactive']).default('') }).parse(req.query);
    const params = { search: `%${search.replace(/[!%_\[\]]/g, '!$&')}%`, offset: (page - 1) * 50, limit: 50, status, now: new Date() };
    const statusFilter = `CASE WHEN IsAdmin=1 THEN 'admin' WHEN Enabled=0 THEN 'inactive' WHEN COALESCE(AccessGranted,1)=0 THEN 'pending'
      WHEN ActiveUntil IS NOT NULL AND ActiveUntil<=@now THEN 'expired' ELSE 'active' END`;
    const where = `(Email LIKE @search ESCAPE '!' OR Username LIKE @search ESCAPE '!' OR DisplayName LIKE @search ESCAPE '!' OR UserCode LIKE @search ESCAPE '!')${status ? ` AND (${statusFilter})=@status` : ''}`;
    const users = await db.page('Employees', where, { ...params, pending: 'pending' }, 'IsAdmin DESC, Email', params.offset, params.limit,
      'Employees.*, (SELECT CreatedAt FROM SubscriptionRequests sr WHERE sr.Id=Employees.Id AND sr.State=@pending) AS SubscriptionRequestedAt');
    const total = (await db.query(`SELECT COUNT(*) AS Total FROM Employees WHERE ${where}`, params))[0].total;
    res.json({ users: users.map(publicUser), total: Number(total), page });
  });
  router.post('/admin/users/:id/activation', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const input = z.object({ enabled: z.boolean(), months: z.number().int().min(1).max(12).optional() }).parse(req.body);
    const defaults = await settings(db);
    const user = await db.transaction(async tx => {
      const current = await tx.one('Employees', 'Id=@id', { id });
      if (!current) throw new HttpError(404, 'Không tìm thấy người dùng.');
      if (current.isAdmin) throw new HttpError(409, 'Không thay đổi kích hoạt của tài khoản quản trị viên.');
      if (input.enabled && current.emailVerified === false) throw new HttpError(409, 'Email chưa được xác minh.');
      const months = input.months ?? defaults.defaultActivationMonths;
      const activeUntil = input.enabled ? subscriptionExpiry(current.activeUntil, months) : current.activeUntil;
      await tx.update('Employees', { enabled: input.enabled, ...(input.enabled ? { accessGranted: true } : {}), activeUntil }, 'Id=@id', { id });
      if (input.enabled) await tx.update('SubscriptionRequests', { state: 'fulfilled' }, 'Id=@id', { id });
      if (!input.enabled) {
        await tx.update('Sessions', { expiresAt: new Date() }, 'EmployeeId=@id', { id });
        await tx.update('Devices', { enabled: false }, 'OwnerId=@id', { id });
      }
      await tx.insert('AdminAudit', { id: randomUUID(), actorId: res.locals.user.id, targetId: id, action: input.enabled ? 'activate' : 'deactivate',
        createdAt: new Date(), details: JSON.stringify({ months: input.enabled ? months : null, activeUntil }) });
      return (await tx.one('Employees', 'Id=@id', { id }))!;
    });
    res.json(publicUser(user));
  });
  router.get('/admin/settings', async (_req, res) => {
    res.json({ ...await settings(db), smtpConfigured: !config.review && !!(config.smtp.user && config.smtp.pass && config.smtp.from), smtpSender: config.smtp.from,
      pushEnabled: config.push.enabled });
  });
  router.get('/admin/subscription-settings', async (_req, res) => {
    res.json({ subscriptionEnabled: (await settings(db)).subscriptionEnabled });
  });
  router.put('/admin/subscription-settings', async (req, res) => {
    const input = z.object({ subscriptionEnabled: z.boolean() }).strict().parse(req.body);
    await db.transaction(async tx => {
      if (await tx.oneLocked('SystemSettings', 'Id=@id', { id: 'auth' })) await tx.update('SystemSettings', input, 'Id=@id', { id: 'auth' });
      else await tx.insert('SystemSettings', { id: 'auth', registrationEnabled: true, defaultActivationMonths: 1, ...input });
      await tx.insert('AdminAudit', { id: randomUUID(), actorId: res.locals.user.id, targetId: null, action: 'subscription_settings', createdAt: new Date(), details: JSON.stringify(input) });
    });
    res.json(input);
  });
  router.put('/admin/settings', async (req, res) => {
    const input = z.object({ registrationEnabled: z.boolean(), defaultActivationMonths: z.number().int().min(1).max(12) }).parse(req.body);
    await db.transaction(async tx => {
      if (await tx.one('SystemSettings', 'Id=@id', { id: 'auth' })) await tx.update('SystemSettings', input, 'Id=@id', { id: 'auth' });
      else await tx.insert('SystemSettings', { id: 'auth', ...input });
      await tx.insert('AdminAudit', { id: randomUUID(), actorId: res.locals.user.id, targetId: null, action: 'settings', createdAt: new Date(), details: JSON.stringify(input) });
    });
    res.json(input);
  });
  return router;
}
