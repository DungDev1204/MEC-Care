import React, { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getCalendars } from 'expo-localization';
import { Back, Button, DateField, Page, Section, s } from '../components/ui';
import { api } from '../lib/api';
import { localDateTime } from '../lib/types';
export default function Snooze() {
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>(); const [date, setDate] = useState(() => new Date(Date.now() + 86400000)); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api(`/api/occurrences/${occurrenceId}/snooze`, 'POST', { localDateTime: localDateTime(date), timeZone: getCalendars()[0]?.timeZone || 'Asia/Ho_Chi_Minh' }); router.back(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Page><Back /><Text style={s.title}>Dời lịch</Text><Text style={s.subtitle}>Lần nhắc này sẽ nhắc đúng giờ mới. Lịch hằng năm vẫn tiếp tục vào ngày đã đặt ban đầu.</Text>
    <Section title="Thời điểm mới" icon="clock"><DateField label="Ngày giờ mới" value={date} onChange={d => d && setDate(d)} time /></Section>{!!error && <Text style={s.error}>{error}</Text>}<Button icon="check" title="Lưu giờ mới" onPress={save} busy={busy} />
  </Page>;
}
