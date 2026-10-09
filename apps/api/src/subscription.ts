import { Router } from 'express';
import type { Database } from './db.js';
import { accessStatus, canUseApp } from './auth.js';
import { HttpError } from './validation.js';
import { paymentSettings, openOrder } from './orders.js';
import { renewalAllowed, subscriptionZone } from './subscription-dates.js';
import { DateTime } from 'luxon';
import { settings } from './system-settings.js';

export function subscriptionRouter(db: Database) {
  const router = Router();
  router.get('/subscription', async (_req, res) => {
    const row = await db.one('SubscriptionRequests', 'Id=@id', { id: res.locals.user.id });
    const user = (await db.one('Employees', 'Id=@id', { id: res.locals.user.id }))!;
    const subscriptionEnabled = (await settings(db)).subscriptionEnabled;
    res.json({ userCode: user.userCode, accessStatus: accessStatus(user), activeUntil: user.activeUntil, subscriptionEnabled, canUseApp: canUseApp(user, subscriptionEnabled), canPurchase: subscriptionEnabled && renewalAllowed(user),
      renewalOpensAt: user.activeUntil ? DateTime.fromISO(user.activeUntil).setZone(subscriptionZone).startOf('day').toUTC().toISO() : null,
      settings: await paymentSettings(db), openOrder: await openOrder(db, user.id), requestedAt: row?.state === 'pending' ? row.createdAt : null });
  });
  router.post('/subscription/request', async (_req, res) => {
    const row = await db.transaction(async tx => {
      if (!(await settings(tx)).subscriptionEnabled) throw new HttpError(409, 'Đăng ký gói đang tắt. Bạn có thể sử dụng ứng dụng bình thường.', { code: 'SUBSCRIPTION_DISABLED' });
      if (accessStatus(res.locals.user) === 'active') throw new HttpError(409, 'Gói của bạn đang hoạt động.');
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
