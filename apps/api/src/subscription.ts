import { Router } from 'express';
import type { Database } from './db.js';
import { accessStatus } from './auth.js';
import { HttpError } from './validation.js';

export function subscriptionRouter(db: Database) {
  const router = Router();
  router.get('/subscription', async (_req, res) => {
    const row = await db.one('SubscriptionRequests', 'Id=@id', { id: res.locals.user.id });
    res.json({ accessStatus: accessStatus(res.locals.user), activeUntil: res.locals.user.activeUntil, requestedAt: row?.state === 'pending' ? row.createdAt : null });
  });
  router.post('/subscription/request', async (_req, res) => {
    if (accessStatus(res.locals.user) === 'active') throw new HttpError(409, 'Gói của bạn đang hoạt động.');
    const row = await db.transaction(async tx => {
      const id = res.locals.user.id; const previous = await tx.one('SubscriptionRequests', 'Id=@id', { id });
      if (previous?.state === 'pending') return previous;
      const data = { state: 'pending', createdAt: new Date() };
      if (previous) await tx.update('SubscriptionRequests', data, 'Id=@id', { id });
      else await tx.insert('SubscriptionRequests', { id, ...data });
      return (await tx.one('SubscriptionRequests', 'Id=@id', { id }))!;
    });
    res.json({ requestedAt: row.createdAt, message: 'Đã gửi yêu cầu đăng ký gói 1 tháng. Quản trị viên sẽ liên hệ và kích hoạt gói của bạn.' });
  });
  return router;
}
