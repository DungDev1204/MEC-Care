export type Vehicle = { id?: string; model: string; plate: string; deliveryDate: string | null };
export type Customer = { id: string; name: string; phone: string; birthDate: string | null; interests: string; notes: string;
  preferredContact: string; status: string; avatarId: string | null; vehicles: Vehicle[]; lastContactAt?: string | null };
export type Photo = { id: string; caption: string; createdAt: string };
export type Reminder = { id: string; customerId: string; kind: string; content: string; localDateTime: string; timeZone: string;
  repeat: string; leadDays: number; leapDayPolicy: string | null; active: boolean };
export type Occurrence = { id: string; reminderId: string; scheduledAt: string; notifyAt: string; state: string };
export type ReminderRow = { reminder: Reminder; occurrences: Occurrence[] };
export type Contact = { id: string; at: string; channel: string; content: string };
export const statuses = { new: 'Mới tiếp nhận', consulting: 'Đang tư vấn', purchased: 'Đã mua / Đang chăm sóc' };
export const kinds = { birthday: 'Sinh nhật', afterPurchase: 'Hỏi thăm sau mua', maintenance: 'Bảo dưỡng', delivery: 'Kỷ niệm giao xe', consulting: 'Tư vấn trước mua', other: 'Dịp khác' };
export const channels = { call: 'Gọi điện', message: 'Nhắn tin', meeting: 'Gặp trực tiếp' };
export const label = (map: Record<string, string>, value: string) => map[value] || value;
export function age(birth: string | null, today = new Date()) {
  if (!birth) return null;
  const [year, month, day] = birth.split('-').map(Number);
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}
export function dateOnly(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function localDateTime(d: Date) { return `${dateOnly(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`; }
export const formatDate = (date?: string | null) => date ? new Date(date).toLocaleDateString('vi-VN') : 'Chưa bổ sung';
export const formatTime = (date: string) => new Date(date).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
