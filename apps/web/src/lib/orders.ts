export type PaymentSettings = { bankCode: string; bankName: string; accountNumber: string; accountName: string; monthlyPrice: number; contactUrl: string; zaloUrl?: string };
export type Order = {
  id: string; code: string; employeeId: string; userCode: string; username: string; months: number; amount: number;
  createdAt: string; reportedAt: string | null; paidAt: string | null; reviewedAt: string | null; reviewerId: string | null; reviewerName?: string | null;
  state: string; paymentState: string; bankCode: string; bankName: string; accountNumber: string; accountName: string;
  contactUrl: string; zaloUrl?: string; transferContent: string; transactionReference: string | null; rejectionReason: string | null;
  activeBefore: string | null; activeAfter: string | null; history?: { action: string; createdAt: string; reason: string | null }[];
};
export type SubscriptionInfo = { userCode: string; accessStatus: string; activeUntil: string | null; subscriptionEnabled: boolean; canUseApp: boolean; canPurchase: boolean; renewalOpensAt: string | null; settings: PaymentSettings | null; openOrder: Order | null };
export const orderLabels: Record<string, string> = { pending_payment: 'Chờ thanh toán', pending_review: 'Chờ admin xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy', rejected: 'Từ chối — cần kiểm tra lại', payment_issue: 'Cần đối soát tiền đã nhận' };
export const paymentLabels: Record<string, string> = { unconfirmed: 'Chưa xác nhận tiền', reviewing: 'Đang đối soát', paid: 'Đã thanh toán', received_issue: 'Đã nhận tiền — có sai lệch' };
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
export const orderDate = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—';
export const expiryDate = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Không giới hạn';
export function qrUrl(order: Order) {
  const query = new URLSearchParams({ amount: String(order.amount), addInfo: order.transferContent, accountName: order.accountName });
  return `https://img.vietqr.io/image/${order.bankCode}-${order.accountNumber}-compact2.png?${query}`;
}
