import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getCalendars } from 'expo-localization';
import { Avatar, Back, Button, Choices, DateField, Field, Page, Section, s } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { channels, Customer, localDateTime } from '../lib/types';

export default function ContactForm() {
  const { customerId, occurrenceId } = useLocalSearchParams<{ customerId: string; occurrenceId?: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [date, setDate] = useState(() => new Date()); const [channel, setChannel] = useState('call'); const [content, setContent] = useState('');
  const [next, setNext] = useState('no'); const [nextDate, setNextDate] = useState(() => new Date(Date.now() + 86400000)); const [nextContent, setNextContent] = useState('');
  useEffect(() => { let alive = true; api<Customer>(`/api/customers/${customerId}`).then(c => { if (alive) setCustomer(c); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [customerId]);
  async function save() {
    if (!content.trim()) { setError('Nhập nội dung và kết quả liên hệ.'); return; }
    setBusy(true); setError('');
    try { await api(`/api/customers/${customerId}/contacts`, 'POST', { at: date.toISOString(), channel, content, occurrenceId: occurrenceId || null,
      nextReminder: next === 'yes' ? { kind: 'other', content: nextContent, localDateTime: localDateTime(nextDate), timeZone: getCalendars()[0]?.timeZone || 'Asia/Ho_Chi_Minh', repeat: 'once', leadDays: 0, leapDayPolicy: null } : null }); router.back(); }
    catch (e) { const detail = e instanceof ApiError && e.data.errors ? Object.values(e.data.errors).flat().join('\n') : (e as Error).message; setError(detail); }
    finally { setBusy(false); }
  }
  return <Page><Back /><View style={{ gap: 8 }}><Text style={s.eyebrow}>MỖI CUỘC TRÒ CHUYỆN ĐỀU CÓ Ý NGHĨA</Text><Text style={s.title}>Lần chăm sóc.</Text></View>{loading ? <ActivityIndicator /> : <>
    {customer && <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }]}><Avatar name={customer.name} id={customer.avatarId} size={48} /><View style={{ flex: 1, gap: 3 }}><Text style={s.label}>KHÁCH HÀNG</Text><Text style={s.heading}>{customer.name}</Text></View></View>}
    {!!occurrenceId && <Text style={s.subtitle}>Lưu kết quả sẽ hoàn thành đúng lần nhắc đang chọn.</Text>}
    <Section title="Cuộc trò chuyện" icon="message"><DateField label="Ngày và giờ đã thực hiện" value={date} onChange={d => d && setDate(d)} time /><Choices label="Kênh liên hệ" value={channel} options={channels} onChange={setChannel} />
    <Field label="Nội dung / Phản hồi / Kết quả *" placeholder="Khách chia sẻ điều gì? Bạn đã hỗ trợ như thế nào?" value={content} onChangeText={setContent} multiline maxLength={10000} /></Section>
    <Section title="Giữ kết nối" icon="calendar"><Choices label="Hẹn lần tiếp theo?" value={next} options={{ no: 'Chưa hẹn', yes: 'Đặt lịch tiếp theo' }} onChange={setNext} />
    {next === 'yes' && <><DateField label="Ngày và giờ tiếp theo" value={nextDate} onChange={d => d && setNextDate(d)} time /><Field label="Nội dung lần tiếp theo *" value={nextContent} onChangeText={setNextContent} multiline /></>}
    </Section>{!!error && <Text style={s.error}>{error}</Text>}<Button icon="check" title="Lưu kết quả" onPress={save} busy={busy} disabled={!customer} /><Button secondary title="Hủy" disabled={busy} onPress={() => router.back()} />
  </>}</Page>;
}
