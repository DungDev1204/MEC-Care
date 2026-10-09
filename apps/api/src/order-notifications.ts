import { randomUUID } from 'node:crypto';
import type { Database, Row } from './db.js';
import type { PushSender } from './push.js';

export async function notifyAdmins(db: Database, order: Row, now = new Date()) {
  for (const admin of await db.rows('Employees', 'IsAdmin=@yes AND Enabled=@yes AND COALESCE(EmailVerified,1)=1', { yes: true })) {
    await db.insert('AdminOrderNotifications', { id: randomUUID(), employeeId: admin.id, orderId: order.id, createdAt: now, readAt: null });
  }
}

export async function runOrderNotifications(db: Database, send: PushSender, now = new Date()) {
  const ready = await db.query(`SELECT n.Id AS NotificationId, d.Id AS DeviceId FROM AdminOrderNotifications n
    JOIN Employees e ON e.Id=n.EmployeeId JOIN Devices d ON d.OwnerId=e.Id JOIN PurchaseOrders o ON o.Id=n.OrderId
    WHERE e.Enabled=@yes AND e.IsAdmin=@yes AND COALESCE(e.EmailVerified,1)=1 AND d.Enabled=@yes AND d.Endpoint IS NOT NULL
    AND n.ReadAt IS NULL AND o.State=@review AND n.CreatedAt>=@cutoff
    AND EXISTS (SELECT 1 FROM Sessions s WHERE s.Id=d.SessionId AND s.EmployeeId=e.Id AND s.ExpiresAt>@now)
    AND NOT EXISTS (SELECT 1 FROM OrderPushDeliveries j WHERE j.NotificationId=n.Id AND j.DeviceId=d.Id)`,
  { yes: true, review: 'pending_review', cutoff: new Date(now.getTime() - 86400000), now });
  for (const job of ready.slice(0, 100)) await db.transaction(async tx => {
    if (!await tx.one('OrderPushDeliveries', 'NotificationId=@notificationId AND DeviceId=@deviceId', job)) {
      await tx.insert('OrderPushDeliveries', { id: randomUUID(), ...job, state: 'pending', attempts: 0, retryAt: now, leaseUntil: null });
    }
  });
  const jobs = await db.rows('OrderPushDeliveries', 'State=@pending AND RetryAt<=@now AND (LeaseUntil IS NULL OR LeaseUntil<@now)', { pending: 'pending', now }, 'RetryAt');
  for (const job of jobs.slice(0, 50)) {
    if (!await db.update('OrderPushDeliveries', { leaseUntil: new Date(now.getTime() + 120000) }, 'Id=@id AND State=@pending AND (LeaseUntil IS NULL OR LeaseUntil<@now)', { id: job.id, pending: 'pending', now })) continue;
    const current = (await db.query(`SELECT d.*, n.Id AS NotificationId, o.Code AS OrderCode FROM Devices d
      JOIN Employees e ON e.Id=d.OwnerId JOIN AdminOrderNotifications n ON n.EmployeeId=e.Id JOIN PurchaseOrders o ON o.Id=n.OrderId
      WHERE d.Id=@device AND n.Id=@notification AND d.Enabled=@yes AND e.Enabled=@yes AND e.IsAdmin=@yes
      AND COALESCE(e.EmailVerified,1)=1 AND n.ReadAt IS NULL AND o.State=@review
      AND EXISTS (SELECT 1 FROM Sessions s WHERE s.Id=d.SessionId AND s.EmployeeId=e.Id AND s.ExpiresAt>@now)`,
    { device: job.deviceId, notification: job.notificationId, yes: true, review: 'pending_review', now }))[0];
    const updates: Row = { leaseUntil: null };
    if (!current?.endpoint) updates.state = 'cancelled';
    else {
      updates.attempts = job.attempts + 1;
      try {
        await send(current, JSON.stringify({ title: 'Clienté · Đơn hàng chờ duyệt', body: `Đơn ${current.orderCode} đã báo chuyển khoản. Mở để đối soát.`, url: `/admin?tab=orders&order=${encodeURIComponent(current.orderCode)}`, tag: `order-${job.notificationId}` }));
        updates.state = 'providerAccepted';
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) { updates.state = 'failed'; await db.update('Devices', { enabled: false }, 'Id=@id', { id: current.id }); }
        else { updates.state = updates.attempts >= 5 ? 'failed' : 'pending'; updates.retryAt = new Date(now.getTime() + 2 ** updates.attempts * 15000); }
      }
    }
    await db.update('OrderPushDeliveries', updates, 'Id=@id', { id: job.id });
  }
}
