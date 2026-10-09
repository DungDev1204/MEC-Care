import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Database, Row, Params } from './db.js';
import { HttpError, uuid } from './validation.js';
import { renewalAllowed, subscriptionExpiry, subscriptionZone } from './subscription-dates.js';
import { randomCode } from './user-code.js';
import { notifyAdmins } from './order-notifications.js';
import { settings as systemSettings } from './system-settings.js';

export const openStates = "State IN ('pending_payment','pending_review','rejected','payment_issue')";
export function contactUrlAllowed(value: string) {
  if (!value) return true;
  const authority = /^https:\/\/([^/?#]+)/i.exec(value);
  if (!authority || authority[1].includes('@') || /[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
const legacyZaloUrlAllowed = (value: string) => {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'zalo.me' && !u.username && !u.password && !u.port && /^\/[a-zA-Z0-9]+\/?$/.test(u.pathname) && !u.search && !u.hash; } catch { return false; }
};
export function withContactUrl<T extends Row>(row: T) {
  return { ...row, contactUrl: String(row.contactUrl ?? row.zaloUrl ?? '') };
}
export const paymentSettingsSchema = z.object({
  bankCode: z.string().regex(/^\d{6}$/, 'Nhập mã BIN ngân hàng gồm 6 chữ số.'), bankName: z.string().trim().min(1).max(100),
  accountNumber: z.string().trim().regex(/^\d{6,32}$/, 'Số tài khoản cần gồm 6–32 chữ số.'), accountName: z.string().trim().min(5).max(50).transform(v => v.toUpperCase()),
  monthlyPrice: z.number().int().min(1000).max(100000000),
  contactUrl: z.string().trim().max(200).refine(contactUrlAllowed, 'Nhập liên kết HTTPS để liên hệ với admin hoặc để trống.').optional(),
  zaloUrl: z.string().trim().max(200).optional()
}).superRefine((input, ctx) => {
  if (input.contactUrl === undefined && input.zaloUrl !== undefined && !legacyZaloUrlAllowed(input.zaloUrl)) ctx.addIssue({ code: 'custom', path: ['zaloUrl'], message: 'Nhập liên kết Zalo dạng https://zalo.me/0901234567.' });
}).transform(input => {
  const contactUrl = input.contactUrl ?? input.zaloUrl ?? '';
  return { ...input, contactUrl, zaloUrl: contactUrl };
});
export async function paymentSettings(db: Database) {
  const row = await db.one('PaymentSettings', 'Id=@id', { id: 'payment' });
  return row ? paymentSettingsSchema.parse(withContactUrl(row)) : null;
}
export async function openOrder(db: Database, employeeId: string) {
  const row = await db.one('PurchaseOrders', `EmployeeId=@employeeId AND ${openStates}`, { employeeId });
  return row ? withContactUrl(row) : undefined;
}
function requireAdmin(user: Row) { if (!user.isAdmin) throw new HttpError(403, 'Chỉ quản trị viên mới có quyền truy cập.'); }
function audit(db: Database, actor: string, target: string | null, action: string, details: Row) {
  return db.insert('AdminAudit', { id: randomUUID(), actorId: actor, targetId: target, action, createdAt: new Date(), details: JSON.stringify(details) });
}
const uniqueConflict = (error: any) => [2601, 2627].includes(error.number) || String(error.code).startsWith('ERR_SQLITE') && String(error.message).includes('UNIQUE');

export function ordersRouter(db: Database) {
  const router = Router();
  router.get('/admin/payment-settings', async (_req, res) => { requireAdmin(res.locals.user); res.json({ settings: await paymentSettings(db) }); });
  router.put('/admin/payment-settings', async (req, res) => {
    requireAdmin(res.locals.user); const input = paymentSettingsSchema.parse(req.body);
    await db.transaction(async tx => {
      if (await tx.one('PaymentSettings', 'Id=@id', { id: 'payment' })) await tx.update('PaymentSettings', input, 'Id=@id', { id: 'payment' });
      else await tx.insert('PaymentSettings', { id: 'payment', ...input });
      await audit(tx, res.locals.user.id, null, 'payment_settings', input);
    }); res.json({ settings: input });
  });
  router.post('/orders', async (_req, res) => {
    const order = await db.transaction(async tx => {
      const user = (await tx.oneLocked('Employees', 'Id=@id', { id: res.locals.user.id }))!;
      const existing = await openOrder(tx, user.id); if (existing) return existing;
      if (!(await systemSettings(tx)).subscriptionEnabled) throw new HttpError(409, 'Đăng ký gói đang tắt. Bạn có thể sử dụng ứng dụng bình thường.', { code: 'SUBSCRIPTION_DISABLED' });
      if (!renewalAllowed(user)) throw new HttpError(409, user.activeUntil ? 'Chỉ được gia hạn từ ngày hết hạn theo giờ Việt Nam.' : 'Tài khoản này không cần mua gói.');
      const settings = await paymentSettings(tx); if (!settings) throw new HttpError(409, 'Admin chưa cấu hình thông tin thanh toán.');
      let code: string;
      do { code = `DH${randomCode(6)}`; } while (await tx.one('PurchaseOrders', 'Code=@code', { code }));
      const username = user.username || 'taikhoancu';
      // Keep VietQR's transfer description within 50 characters; the complete username is kept on the order.
      const transferContent = `${code} ${user.userCode} ${username.replace(/_/g, ' ').slice(0, 30)}`;
      return await tx.insert('PurchaseOrders', { id: randomUUID(), code, employeeId: user.id, userCode: user.userCode, username, months: 1, amount: settings.monthlyPrice,
        createdAt: new Date(), reportedAt: null, paidAt: null, reviewedAt: null, reviewerId: null, state: 'pending_payment', paymentState: 'unconfirmed',
        ...settings, transferContent, transactionReference: null, rejectionReason: null, activeBefore: null, activeAfter: null });
    }); res.status(200).json(withContactUrl(order));
  });
  for (const admin of [false, true]) {
    router.get(admin ? '/admin/orders' : '/orders', async (req, res) => {
      if (admin) requireAdmin(res.locals.user);
      const input = z.object({ search: z.string().trim().max(100).default(''), state: z.enum(['','pending_payment','pending_review','completed','cancelled','rejected','payment_issue']).default(''),
        paymentState: z.enum(['','unconfirmed','reviewing','paid','received_issue']).default(''), page: z.coerce.number().int().min(1).max(100000).default(1),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.query);
      const where: string[] = []; const params: Params = {};
      if (!admin) { where.push('EmployeeId=@owner'); params.owner = res.locals.user.id; }
      if (input.search) {
        where.push(admin ? "(Code LIKE @search ESCAPE '!' OR UserCode LIKE @search ESCAPE '!' OR Username LIKE @search ESCAPE '!')" : "Code LIKE @search ESCAPE '!'");
        params.search = `%${input.search.replace(/[!%_\[\]]/g, '!$&')}%`;
      }
      if (input.state) { where.push('State=@state'); params.state = input.state; }
      if (input.paymentState) { where.push('PaymentState=@payment'); params.payment = input.paymentState; }
      for (const key of ['from','to'] as const) if (input[key]) {
        const date = DateTime.fromISO(input[key]!, { zone: subscriptionZone });
        if (!date.isValid) throw new HttpError(400, 'Ngày lọc chưa hợp lệ.');
        where.push(key === 'from' ? 'CreatedAt>=@from' : 'CreatedAt<@to'); params[key] = (key === 'from' ? date.startOf('day') : date.plus({ days: 1 }).startOf('day')).toUTC().toJSDate();
      }
      if (input.from && input.to && input.from > input.to) throw new HttpError(400, 'Ngày bắt đầu cần trước hoặc bằng ngày kết thúc.');
      const clause = where.join(' AND ') || '1=1';
      const total = Number((await db.query(`SELECT COUNT(*) AS Total FROM PurchaseOrders WHERE ${clause}`, params))[0].total);
      res.json({ orders: (await db.page('PurchaseOrders', clause, params, 'CreatedAt DESC, Id', (input.page - 1) * 20, 20)).map(withContactUrl), total, page: input.page });
    });
    router.get(admin ? '/admin/orders/:id' : '/orders/:id', async (req, res) => {
      if (admin) requireAdmin(res.locals.user);
      const id = uuid.parse(req.params.id); const order = await db.one('PurchaseOrders', admin ? 'Id=@id' : 'Id=@id AND EmployeeId=@owner', { id, owner: res.locals.user.id });
      if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
      const auditRows = await db.page('AdminAudit', 'TargetId=@owner AND Action LIKE @action AND Details LIKE @orderId', { owner: order.employeeId, action: 'order_%', orderId: `%${id}%` }, 'CreatedAt DESC, Id', 0, 1000);
      const history = auditRows.flatMap(row => {
        try { const details = JSON.parse(row.details); return details.orderId === id ? [{ action: row.action, createdAt: row.createdAt, reason: details.rejectionReason || null }] : []; } catch { return []; }
      });
      const reviewer = order.reviewerId ? await db.one('Employees', 'Id=@id', { id: order.reviewerId }) : null;
      res.json({ ...withContactUrl(order), reviewerName: reviewer?.username || reviewer?.displayName || null, history });
    });
  }
  router.post('/orders/:id/report', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const order = await db.transaction(async tx => {
      const current = await tx.oneLocked('PurchaseOrders', 'Id=@id AND EmployeeId=@owner', { id, owner: res.locals.user.id });
      if (!current) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
      if (current.state === 'pending_review') return current;
      if (!['pending_payment','rejected'].includes(current.state)) throw new HttpError(409, 'Đơn này không thể báo thanh toán lại.');
      const now = new Date();
      await tx.update('PurchaseOrders', { state: 'pending_review', paymentState: 'reviewing', reportedAt: now }, 'Id=@id', { id });
      await notifyAdmins(tx, current, now);
      await audit(tx, res.locals.user.id, res.locals.user.id, 'order_report', { orderId: id });
      return (await tx.one('PurchaseOrders', 'Id=@id', { id }))!;
    }); res.json(withContactUrl(order));
  });
  router.post('/orders/:id/cancel', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const order = await db.transaction(async tx => {
      const current = await tx.oneLocked('PurchaseOrders', 'Id=@id AND EmployeeId=@owner', { id, owner: res.locals.user.id });
      if (!current) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
      if (current.state === 'cancelled') return current;
      if (current.state !== 'pending_payment') throw new HttpError(409, 'Chỉ được hủy đơn trước khi báo đã chuyển khoản. Liên hệ admin để đối soát.');
      await tx.update('PurchaseOrders', { state: 'cancelled' }, 'Id=@id', { id });
      await audit(tx, res.locals.user.id, res.locals.user.id, 'order_cancel', { orderId: id });
      return (await tx.one('PurchaseOrders', 'Id=@id', { id }))!;
    }); res.json(withContactUrl(order));
  });
  router.post('/admin/orders/:id/review', async (req, res) => {
    requireAdmin(res.locals.user); const id = uuid.parse(req.params.id);
    const input = z.discriminatedUnion('action', [
      z.object({ action: z.literal('approve'), transactionReference: z.string().trim().min(3).max(100).transform(v => v.toUpperCase()) }),
      z.object({ action: z.literal('reject'), reason: z.string().trim().min(5).max(500) }),
      z.object({ action: z.literal('payment_issue'), reason: z.string().trim().min(5).max(500), transactionReference: z.string().trim().min(3).max(100).transform(v => v.toUpperCase()) })
    ]).parse(req.body);
    try {
      const order = await db.transaction(async tx => {
        const current = await tx.oneLocked('PurchaseOrders', 'Id=@id', { id });
        if (!current) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
        if (!['pending_review','rejected','payment_issue'].includes(current.state)) throw new HttpError(409, 'Đơn đã kết thúc hoặc khách chưa báo chuyển khoản.');
        const now = new Date(); const updates: Row = { reviewedAt: now, reviewerId: res.locals.user.id };
        if (input.action === 'approve') {
          const user = (await tx.oneLocked('Employees', 'Id=@id', { id: current.employeeId }))!;
          if (!user.enabled || user.emailVerified === false || user.isAdmin) throw new HttpError(409, 'Tài khoản bị khóa hoặc chưa đủ điều kiện. Hãy xử lý tài khoản trước.');
          if (current.transactionReference && current.transactionReference !== input.transactionReference) throw new HttpError(409, 'Cần dùng đúng mã giao dịch đã ghi nhận trên đơn.');
          if (await tx.one('PurchaseOrders', 'TransactionReference=@reference AND Id<>@id', { reference: input.transactionReference, id })) throw new HttpError(409, 'Giao dịch ngân hàng đã được sử dụng cho đơn khác.');
          const activeUntil = subscriptionExpiry(user.activeUntil, current.months);
          await tx.update('Employees', { accessGranted: true, activeUntil }, 'Id=@id', { id: user.id });
          await tx.update('SubscriptionRequests', { state: 'fulfilled' }, 'Id=@id', { id: user.id });
          Object.assign(updates, { state: 'completed', paymentState: 'paid', paidAt: current.paidAt || now, transactionReference: input.transactionReference, rejectionReason: null, activeBefore: user.activeUntil, activeAfter: activeUntil });
        } else if (input.action === 'payment_issue') {
          if (current.transactionReference && current.transactionReference !== input.transactionReference) throw new HttpError(409, 'Mã giao dịch không khớp giao dịch đã ghi nhận.');
          if (await tx.one('PurchaseOrders', 'TransactionReference=@reference AND Id<>@id', { reference: input.transactionReference, id })) throw new HttpError(409, 'Giao dịch ngân hàng đã được sử dụng cho đơn khác.');
          Object.assign(updates, { state: 'payment_issue', paymentState: 'received_issue', paidAt: current.paidAt || now, transactionReference: input.transactionReference, rejectionReason: input.reason });
        } else {
          if (current.paymentState === 'received_issue') throw new HttpError(409, 'Đơn đã ghi nhận tiền. Cần giải quyết sai lệch, không thể từ chối là chưa nhận tiền.');
          Object.assign(updates, { state: 'rejected', paymentState: 'unconfirmed', rejectionReason: input.reason });
        }
        await tx.update('PurchaseOrders', updates, 'Id=@id', { id });
        await tx.update('AdminOrderNotifications', { readAt: now }, 'OrderId=@id AND ReadAt IS NULL', { id });
        await audit(tx, res.locals.user.id, current.employeeId, `order_${input.action}`, { orderId: id, ...updates });
        return (await tx.one('PurchaseOrders', 'Id=@id', { id }))!;
      }); res.json(withContactUrl(order));
    } catch (error) { if (uniqueConflict(error)) throw new HttpError(409, 'Giao dịch này đã được ghi nhận. Vui lòng tải lại để kiểm tra.'); throw error; }
  });
  router.get('/admin/order-notifications', async (_req, res) => {
    requireAdmin(res.locals.user); const params = { owner: res.locals.user.id };
    const total = Number((await db.query('SELECT COUNT(*) AS Total FROM AdminOrderNotifications WHERE EmployeeId=@owner AND ReadAt IS NULL', params))[0].total);
    const rows = await db.page('AdminOrderNotifications', 'EmployeeId=@owner', params, 'CreatedAt DESC, Id', 0, 10,
      'AdminOrderNotifications.*, (SELECT Code FROM PurchaseOrders o WHERE o.Id=AdminOrderNotifications.OrderId) AS OrderCode');
    res.json({ notifications: rows, unread: total });
  });
  router.post('/admin/order-notifications/read', async (req, res) => {
    requireAdmin(res.locals.user); const { id } = z.object({ id: uuid.optional() }).parse(req.body || {});
    await db.update('AdminOrderNotifications', { readAt: new Date() }, id ? 'Id=@id AND EmployeeId=@owner AND ReadAt IS NULL' : 'EmployeeId=@owner AND ReadAt IS NULL', { id, owner: res.locals.user.id }); res.sendStatus(204);
  });
  return router;
}
