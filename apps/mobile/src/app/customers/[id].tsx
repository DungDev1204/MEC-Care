import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Back, Button, colors, EmptyState, IconButton, Info, Page, ProfileTabs, Section, s, StatusBadge } from '../../components/ui';
import { Icon } from '../../components/icon';
import { api, uploadPhoto } from '../../lib/api';
import { appAlert as Alert } from '../../components/dialog';
import { PhotoImage } from '../../components/photo-image';
import { age, channels, Contact, Customer, formatDate, formatTime, kinds, label, Photo, ReminderRow } from '../../lib/types';

export default function Profile() {
  const { id, tab: initialTab, reminderId, occurrenceId } = useLocalSearchParams<{ id: string; tab?: string; reminderId?: string; occurrenceId?: string }>();
  const [tab, setTab] = useState(initialTab || 'info'); const [customer, setCustomer] = useState<Customer | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]); const [contacts, setContacts] = useState<Contact[]>([]); const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [version, refresh] = useState(0); const [uploading, setUploading] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null); const [caption, setCaption] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true; setBusy(true); setError('');
    Promise.all([api<Customer>(`/api/customers/${id}`), api<Photo[]>(`/api/customers/${id}/photos`), api<Contact[]>(`/api/customers/${id}/contacts`), api<ReminderRow[]>(`/api/customers/${id}/reminders`)]).then(([c, p, h, r]) => {
      if (alive) { setCustomer(c); setPhotos(p); setContacts(h); setReminders(r); }
    }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  // Changing version intentionally refreshes the profile after a mutation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version]));
  async function mutate(path: string, method: string, body?: unknown) { try { await api(path, method, body); refresh(x => x + 1); return true; } catch (e) { Alert.alert('Chưa thực hiện được', (e as Error).message); return false; } }
  async function addImages(avatar = false) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: !avatar, selectionLimit: avatar ? 1 : 10, quality: 0.85 });
      if (result.canceled) return;
      setUploading(true);
      for (const asset of result.assets) await uploadPhoto(id, asset, avatar);
    } catch (e) { Alert.alert('Chưa tải đủ ảnh', (e as Error).message); }
    finally { setUploading(false); refresh(x => x + 1); }
  }
  const pending = reminders.filter(r => r.reminder.active).flatMap(r => r.occurrences.filter(o => o.state === 'pending').map(o => ({ r: r.reminder, o }))).sort((a, b) => a.o.scheduledAt.localeCompare(b.o.scheduledAt));
  return <Page><View style={[s.row, { justifyContent: 'space-between' }]}><Back title="Danh sách khách" /><Text style={s.eyebrow}>HỒ SƠ RIÊNG</Text></View>
    {busy ? <ActivityIndicator color={colors.ink} /> : error ? <EmptyState icon="user" title="Chưa mở được hồ sơ" description={error} action={<Button secondary title="Thử lại" onPress={() => refresh(x => x + 1)} />} /> : customer && <>
      <View style={[s.card, { padding: 22, gap: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}><Avatar key={customer.avatarId} id={customer.avatarId} name={customer.name} size={88} /><View style={{ flex: 1, gap: 10 }}><Text style={{ fontSize: 25, lineHeight: 31, letterSpacing: -0.8, fontWeight: '600', color: colors.ink }}>{customer.name}</Text><StatusBadge status={customer.status} compact /></View></View>
        <View style={s.divider} /><View style={{ gap: 12 }}><View style={s.row}><Icon name="phone" size={16} color={colors.muted} /><Text style={s.text}>{customer.phone}</Text></View><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="car" size={16} color={colors.muted} /><Text style={[s.subtitle, { flex: 1 }]}>{customer.vehicles[0]?.model || 'Chưa bổ sung thông tin xe'}</Text></View></View>
        <Button secondary icon="edit" title="Sửa thông tin" onPress={() => router.push({ pathname: '/customer-form', params: { id } })} />
      </View>
      <ProfileTabs value={tab} onChange={setTab} />
      {tab === 'info' && <>
        <Section title="Thông tin cá nhân" icon="user"><View style={[s.row, { gap: 22, alignItems: 'flex-start' }]}><View style={{ flex: 1, minWidth: 110 }}><Info label="Điện thoại" value={customer.phone} /></View><View style={{ flex: 1, minWidth: 110 }}><Info label="Ngày sinh" value={customer.birthDate ? formatDate(customer.birthDate) : null} /></View></View>
          <View style={s.divider} /><View style={[s.row, { gap: 22, alignItems: 'flex-start' }]}><View style={{ flex: 1, minWidth: 110 }}><Info label="Tuổi hiện tại" value={customer.birthDate ? age(customer.birthDate) + ' tuổi' : null} /></View><View style={{ flex: 1, minWidth: 110 }}><Info label="Liên hệ thuận tiện" value={customer.preferredContact} /></View></View>
        </Section>
        <Section title="Hiểu khách hàng hơn" icon="heart"><Info label="Sở thích cá nhân" value={customer.interests} /><View style={s.divider} /><Info label="Ghi chú riêng" value={customer.notes} /></Section>
        {customer.vehicles.map((v, i) => <Section key={v.id || i} title="Thông tin xe" icon="car"><Text style={[s.heading, { fontSize: 22 }]}>{v.model || 'Chưa bổ sung dòng xe'}</Text><View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}><Info label="Biển số" value={v.plate} /><Info label="Ngày giao xe" value={v.deliveryDate ? formatDate(v.deliveryDate) : null} /></View></Section>)}
      </>}
      {tab === 'photos' && <>
        <View style={{ gap: 12 }}><View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 4 }}><Text style={s.heading}>Album khách hàng</Text><Text style={s.subtitle}>{photos.length} ảnh được lưu riêng</Text></View><Button icon="plus" title="Thêm ảnh" onPress={() => addImages()} busy={uploading} /></View><Button secondary icon="camera" title="Đổi ảnh đại diện" onPress={() => addImages(true)} busy={uploading} /></View>
        {photos.length === 0 && <EmptyState icon="image" title="Lưu giữ những khoảnh khắc" description="Thêm ảnh khách hàng, ngày giao xe hoặc những hình ảnh đáng nhớ. Ảnh đại diện được lưu riêng." />}
        <View style={[s.row, { gap: 12, alignItems: 'flex-start' }]}>{photos.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.caption || 'Xem ảnh lớn'} onPress={() => { setPhoto(p); setCaption(p.caption); }} style={{ width: '47%', gap: 9 }}>
          <PhotoImage id={p.id} style={{ width: '100%', aspectRatio: 0.9, borderRadius: 20, backgroundColor: colors.soft }} /><Text style={[s.subtitle, { fontSize: 12, paddingHorizontal: 3 }]}>{p.caption || formatDate(p.createdAt)}</Text></Pressable>)}</View>
      </>}
      {tab === 'care' && <>
        <View style={{ backgroundColor: colors.dark, padding: 22, gap: 18, borderRadius: 25 }}><View style={[s.row, { gap: 8 }]}><Icon name="heart" size={18} color="#C8D3C1" /><Text style={[s.eyebrow, { color: '#B7C1B3' }]}>CHĂM SÓC TỪNG KẾT NỐI</Text></View>
          <View style={{ gap: 4 }}><Text style={{ color: '#B7BFB5', fontSize: 12 }}>Liên hệ gần nhất</Text><Text style={{ color: 'white', fontSize: 22, fontWeight: '500', letterSpacing: -0.5 }}>{contacts[0] ? formatTime(contacts[0].at) : 'Chưa ghi nhận'}</Text></View>
          <Button secondary icon="plus" title="Ghi nhận lần chăm sóc" onPress={() => router.push({ pathname: '/contact-form', params: { customerId: id } })} />
        </View>
        <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.heading}>Việc tiếp theo</Text><Button secondary icon="calendar" title="Đặt lịch" onPress={() => router.push({ pathname: '/reminder-form', params: { customerId: id } })} /></View>
        {pending.length === 0 ? <EmptyState icon="calendar" title="Chưa có lịch tiếp theo" description="Đặt một lời nhắc để giữ kết nối đúng lúc." /> : pending.slice(0, 5).map(({ r, o }) => <View key={o.id} style={s.card}>
          <View style={s.row}><Icon name="calendar" size={16} color={colors.muted} /><Text style={[s.label, { marginBottom: 0 }]}>{formatTime(o.scheduledAt)}</Text></View><Text style={s.heading}>{r.content}</Text>
          <Button secondary icon="edit" title="Ghi nhận kết quả" onPress={() => router.push({ pathname: '/contact-form', params: { customerId: id, occurrenceId: o.id } })} /></View>)}
        <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.heading}>Lịch sử liên hệ</Text><Text style={s.subtitle}>{contacts.length} lần</Text></View>
        {contacts.length === 0 && <EmptyState icon="message" title="Bắt đầu câu chuyện" description="Ghi nhận lần liên hệ đầu tiên để lưu lại nhu cầu và phản hồi của khách." />}
        <View>{contacts.map((c, i) => <View key={c.id} style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center', width: 36 }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3E9DF', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.channel === 'call' ? 'phone' : c.channel === 'message' ? 'message' : 'user'} size={15} color="#576950" /></View>{i < contacts.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: colors.line }} />}</View>
          <View style={[s.card, { flex: 1, marginBottom: 16, padding: 16, gap: 8 }]}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.ink }}>{label(channels, c.channel)}</Text><Text style={[s.subtitle, { fontSize: 11 }]}>{formatTime(c.at)}</Text><Text style={s.text}>{c.content}</Text></View>
        </View>)}</View>
      </>}
      {tab === 'reminders' && <>
        <View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 4 }}><Text style={s.heading}>Lịch của khách hàng</Text><Text style={s.subtitle}>{reminders.filter(r => r.reminder.active).length} lịch đang bật</Text></View><Button icon="plus" title="Thêm lịch" onPress={() => router.push({ pathname: '/reminder-form', params: { customerId: id } })} /></View>
        {reminders.length === 0 && <EmptyState icon="calendar" title="Những dịp đáng nhớ" description="Đặt lịch sinh nhật, hỏi thăm sau mua hoặc một dịp riêng của khách." />}
        {reminders.map(({ reminder: r, occurrences }) => {
          const next = occurrences.find(o => o.id === occurrenceId && o.state === 'pending') || occurrences.find(o => o.state === 'pending');
          return <View key={r.id} style={[s.card, r.id === reminderId && { borderWidth: 2, borderColor: colors.ink }]}>
            <View style={[s.row, { justifyContent: 'space-between' }]}><View style={[s.row, { gap: 8 }]}><Icon name="calendar" size={17} /><Text style={[s.label, { marginBottom: 0 }]}>{label(kinds, r.kind)}</Text></View><View style={s.badge}><Text style={{ fontSize: 10, color: colors.muted }}>{r.repeat === 'annual' ? 'Hằng năm' : 'Một lần'}</Text></View></View>
            <Text style={s.heading}>{r.content}</Text><View style={{ gap: 5 }}><Text style={s.text}>{next ? formatTime(next.scheduledAt) : formatTime(r.localDateTime)}</Text><Text style={[s.subtitle, { fontSize: 11 }]}>{r.timeZone} · {r.leadDays ? 'Nhắc trước ' + r.leadDays + ' ngày' : 'Nhắc đúng thời điểm'}</Text></View>
            <View style={s.badge}><Text style={{ fontSize: 11, color: colors.muted }}>{!r.active ? 'Đã hủy' : next ? 'Chưa hoàn thành' : 'Đã hoàn thành'}</Text></View>
            {r.active && <><View style={s.divider} /><View style={s.row}><Button secondary icon="edit" title="Sửa lịch" onPress={() => router.push({ pathname: '/reminder-form', params: { customerId: id, reminderId: r.id } })} />
              <Button secondary title="Hủy lịch" onPress={() => Alert.alert('Hủy lịch nhắc?', 'Các lần chưa hoàn thành của lịch này sẽ được hủy.', [{ text: 'Giữ lịch', style: 'cancel' }, { text: 'Hủy lịch', style: 'destructive', onPress: () => mutate('/api/reminders/' + r.id, 'DELETE') }])} /></View>
              {next && <><Button icon="edit" title="Ghi nhận kết quả" onPress={() => router.push({ pathname: '/contact-form', params: { customerId: id, occurrenceId: next.id } })} /><View style={s.row}>
                <Button secondary icon="check" title="Hoàn thành" onPress={() => mutate('/api/occurrences/' + next.id + '/complete', 'POST')} /><Button secondary icon="clock" title="Dời lần nhắc" onPress={() => router.push({ pathname: '/snooze-form', params: { customerId: id, occurrenceId: next.id } })} /></View></>}</>}
            {occurrences.some(o => o.state === 'completed') && <Text style={[s.label, { marginBottom: 0 }]}>Đã hoàn thành {occurrences.filter(o => o.state === 'completed').length} lần</Text>}
          </View>;
        })}
      </>}
    </>}
    <Modal visible={!!photo} animationType="slide" onRequestClose={() => setPhoto(null)}>{photo && <Page><View style={s.row}><IconButton icon="back" label="Quay lại hồ sơ khách" onPress={() => setPhoto(null)} /><Text style={s.heading}>Khoảnh khắc đã lưu</Text></View>
      <PhotoImage id={photo.id} resizeMode="contain" style={{ width: '100%', height: 380, borderRadius: 24, backgroundColor: colors.soft }} /><Text style={s.label}>Mô tả ảnh</Text><TextInput accessibilityLabel="Mô tả ảnh" style={s.input} value={caption} onChangeText={setCaption} maxLength={500} />
      <Button icon="check" title="Lưu mô tả" onPress={async () => { if (await mutate('/api/photos/' + photo.id, 'PUT', { caption })) setPhoto(null); }} />
      <Button secondary title="Xóa ảnh" onPress={() => Alert.alert('Xóa ảnh?', 'Ảnh này sẽ bị xóa khỏi hồ sơ khách.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: async () => { if (await mutate('/api/photos/' + photo.id, 'DELETE')) setPhoto(null); } }])} />
    </Page>}</Modal>
  </Page>;
}
