import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { appAlert as Alert } from '../components/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { getCalendars } from 'expo-localization';
import { Avatar, Back, Button, Choices, DateField, Field, Page, Section, s } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { Customer, kinds, localDateTime, ReminderRow } from '../lib/types';
import { registerNotifications } from '../lib/notifications';

export default function ReminderForm() {
  const { customerId, reminderId } = useLocalSearchParams<{ customerId: string; reminderId?: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('other'); const [content, setContent] = useState(''); const [date, setDate] = useState(() => new Date(Date.now() + 3600000));
  const [repeat, setRepeat] = useState('once'); const [leadDays, setLeadDays] = useState('0'); const [zone, setZone] = useState(getCalendars()[0]?.timeZone || 'Asia/Ho_Chi_Minh');
  const [leap, setLeap] = useState(''); const [error, setError] = useState(''); const [errors, setErrors] = useState<Record<string, string[]>>({});
  useEffect(() => { let alive = true;
    Promise.all([api<Customer>(`/api/customers/${customerId}`), reminderId ? api<ReminderRow[]>(`/api/customers/${customerId}/reminders`) : Promise.resolve([])]).then(([c, rows]) => {
      if (!alive) return; setCustomer(c);
      if (reminderId) { const r = rows.find(x => x.reminder.id === reminderId)?.reminder; if (!r) throw new Error('Không tìm thấy lịch nhắc.');
        setKind(r.kind); setContent(r.content); setDate(new Date(r.localDateTime)); setRepeat(r.repeat); setLeadDays(String(r.leadDays)); setZone(r.timeZone); setLeap(r.leapDayPolicy || ''); }
    }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; };
  }, [customerId, reminderId]);
  function chooseKind(value: string) {
    setKind(value);
    const source = value === 'birthday' ? customer?.birthDate : value === 'delivery' ? customer?.vehicles[0]?.deliveryDate : null;
    if (source) {
      const [, month, day] = source.split('-').map(Number); let year = new Date().getFullYear(); let next: Date;
      do { next = new Date(year, month - 1, day, 9); year++; } while (next <= new Date() || next.getMonth() !== month - 1);
      setDate(next); setRepeat('annual');
    }
  }
  async function save() {
    setBusy(true); setError(''); setErrors({});
    try {
      await api(reminderId ? `/api/reminders/${reminderId}` : `/api/customers/${customerId}/reminders`, reminderId ? 'PUT' : 'POST', {
        kind, content, localDateTime: localDateTime(date), timeZone: zone, repeat, leadDays: Number(leadDays), leapDayPolicy: leap || null,
      });
      // Reminder is already safely stored, even if notification permission or device setup fails.
      let status: string; try { status = await registerNotifications(false); } catch { status = 'Lịch đã lưu. Chưa đăng ký được điện thoại nhận thông báo; thử lại trong Tài khoản.'; }
      if (!status.startsWith('Đã đăng ký')) Alert.alert('Đã lưu lịch', status, [{ text: 'Để sau', onPress: () => router.back() }, { text: 'Thiết lập thông báo', onPress: () => router.replace('/account') }]);
      else router.back();
    } catch (e) { setError((e as Error).message); if (e instanceof ApiError) setErrors(e.data.errors || {}); }
    finally { setBusy(false); }
  }
  const feb29 = repeat === 'annual' && date.getMonth() === 1 && date.getDate() === 29;
  return <Page><Back /><View style={{ gap: 8 }}><Text style={s.eyebrow}>HIỆN DIỆN ĐÚNG LÚC</Text><Text style={s.title}>{reminderId ? 'Sửa lịch nhắc' : 'Lịch chăm sóc.'}</Text><Text style={s.subtitle}>Một lời hỏi thăm đúng lúc, một kết nối bền lâu.</Text></View>{loading ? <ActivityIndicator /> : <>
    {customer && <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }]}><Avatar name={customer.name} id={customer.avatarId} size={48} /><View style={{ flex: 1, gap: 3 }}><Text style={s.label}>KHÁCH HÀNG</Text><Text style={s.heading}>{customer.name}</Text></View></View>}
    <Section title="Lời nhắc của bạn" icon="bell"><Choices label="Loại lịch" value={kind} options={kinds} onChange={chooseKind} />
    <Field label="Nội dung nhắc *" placeholder="Bạn muốn nhớ điều gì khi liên hệ khách?" value={content} onChangeText={setContent} multiline error={errors.content?.[0]} maxLength={2000} /></Section>
    <Section title="Thời gian & lặp lại" icon="calendar"><DateField label="Ngày và giờ *" value={date} onChange={d => d && setDate(d)} time />{errors.localDateTime?.[0] && <Text style={s.error}>{errors.localDateTime[0]}</Text>}
    <Field label="Múi giờ" value={zone} onChangeText={setZone} autoCapitalize="none" />
    <Choices label="Lặp lại" value={repeat} options={{ once: 'Một lần', annual: 'Hằng năm' }} onChange={setRepeat} />
    <Choices label="Nhắc trước" value={leadDays} options={{ '0': 'Đúng thời điểm', '1': 'Trước 1 ngày', '3': 'Trước 3 ngày' }} onChange={setLeadDays} />
    {feb29 && <><Text style={s.subtitle}>Ngày 29/02: chọn ngày nhắc trong năm không nhuận.</Text><Choices label="Quy tắc năm không nhuận *" value={leap} options={{ feb28: '28/02', mar1: '01/03' }} onChange={setLeap} />{errors.leapDayPolicy?.[0] && <Text style={s.error}>{errors.leapDayPolicy[0]}</Text>}</>}
    </Section>{!!error && <Text style={s.error}>{error}</Text>}<Button icon="check" title="Lưu lịch nhắc" onPress={save} busy={busy} disabled={!customer || (feb29 && !leap)} /><Button secondary title="Hủy" disabled={busy} onPress={() => router.back()} />
  </>}</Page>;
}
