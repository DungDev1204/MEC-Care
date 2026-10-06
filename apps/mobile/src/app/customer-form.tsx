import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { appAlert as Alert } from '../components/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Back, Button, Choices, DateField, Field, Page, Section, s } from '../components/ui';
import { api, ApiError, uploadPhoto } from '../lib/api';
import { Customer, dateOnly, statuses, Vehicle } from '../lib/types';

const empty = { name: '', phone: '', birthDate: null, interests: '', notes: '', preferredContact: '', status: 'new', vehicles: [{ model: '', plate: '', deliveryDate: null }] };
export default function CustomerForm() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const [form, setForm] = useState<Omit<Customer, 'id' | 'avatarId'>>(empty); const [current, setCurrent] = useState<Customer | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(id); const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(!!id); const [error, setError] = useState(''); const [errors, setErrors] = useState<Record<string, string[]>>({});
  useEffect(() => { if (!id) return; let alive = true; api<Customer>(`/api/customers/${id}`).then(c => { if (alive) { setCurrent(c); setForm({ ...c, vehicles: c.vehicles.length ? c.vehicles : empty.vehicles }); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [id]);
  function update(key: string, value: unknown) { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: [] })); }
  function vehicle(key: string, value: unknown) { setForm(f => ({ ...f, vehicles: f.vehicles.map((v, i) => i === 0 ? { ...v, [key]: value } : v) })); }
  async function pick() { try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 }); if (!result.canceled) setAvatar(result.assets[0]); } catch (e) { setError((e as Error).message); } }
  async function save(confirmDuplicate = false) {
    const clientErrors: Record<string, string[]> = {};
    if (!form.name.trim()) clientErrors.name = ['Nhập họ tên khách hàng.'];
    if (form.phone.replace(/\D/g, '').length < 8) clientErrors.phone = ['Nhập số điện thoại hợp lệ.'];
    if (form.birthDate && form.birthDate > dateOnly(new Date())) clientErrors.birthDate = ['Ngày sinh không ở tương lai.'];
    if (Object.keys(clientErrors).length) { setErrors(clientErrors); return; }
    setBusy(true); setError(''); setErrors({});
    try {
      const c = await api<Customer>(savedId ? `/api/customers/${savedId}` : '/api/customers', savedId ? 'PUT' : 'POST', { ...form, confirmDuplicate });
      setSavedId(c.id); setForm(c); setCurrent(c);
      if (avatar) { try { await uploadPhoto(c.id, avatar, true); } catch (e) { throw new Error(`Hồ sơ đã lưu. Avatar chưa tải lên: ${(e as Error).message} Bạn có thể bấm Lưu để thử lại.`); } }
      if (id) router.back(); else router.replace({ pathname: '/customers/[id]', params: { id: c.id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data.duplicate) {
        const duplicate = e.data.duplicate;
        Alert.alert('Có thể trùng hồ sơ', `Số điện thoại đã có ở hồ sơ ${duplicate.name}.`, [{ text: 'Hủy', style: 'cancel' },
          { text: 'Xem hồ sơ đã có', onPress: () => router.push({ pathname: '/customers/[id]', params: { id: duplicate.id } }) }, { text: 'Vẫn lưu khách này', onPress: () => save(true) }]);
      } else { setError((e as Error).message); if (e instanceof ApiError) setErrors(e.data.errors || {}); }
    } finally { setBusy(false); }
  }
  const v: Vehicle = form.vehicles[0] || empty.vehicles[0];
  return <Page><Back /><View style={{ gap: 8 }}><Text style={s.eyebrow}>HỒ SƠ KHÁCH HÀNG</Text><Text style={s.title}>{id ? 'Sửa hồ sơ' : 'Kết nối mới.'}</Text><Text style={s.subtitle}>Bắt đầu từ thông tin cơ bản. Bổ sung câu chuyện của khách bất cứ lúc nào.</Text></View>{loading ? <ActivityIndicator /> : id && !current ? <Text style={s.error}>{error}</Text> : <>
    <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 18 }]}>{avatar ? <Image source={{ uri: avatar.uri }} style={{ width: 82, height: 82, borderRadius: 22 }} /> : <Avatar size={82} name={form.name} id={current?.avatarId} />}<View style={{ flex: 1, gap: 8 }}><Text style={s.heading}>Ảnh đại diện</Text><Text style={[s.subtitle, { fontSize: 12 }]}>Dễ nhận ra khách trong mỗi lần kết nối.</Text><Button secondary icon="camera" title="Chọn ảnh" onPress={pick} /></View></View>
    <Section title="Thông tin cơ bản" icon="user"><Field label="Họ tên *" placeholder="Tên khách hàng" value={form.name} onChangeText={x => update('name', x)} error={errors.name?.[0]} maxLength={200} />
    <Field label="Điện thoại *" icon="phone" placeholder="Số điện thoại liên hệ" value={form.phone} onChangeText={x => update('phone', x)} keyboardType="phone-pad" error={errors.phone?.[0]} />
    <DateField label="Ngày sinh" value={form.birthDate ? new Date(form.birthDate + 'T12:00:00') : null} onChange={d => update('birthDate', d ? dateOnly(d) : null)} optional />{errors.birthDate?.[0] && <Text style={s.error}>{errors.birthDate[0]}</Text>}
    <Choices label="Trạng thái" value={form.status} options={statuses} onChange={x => update('status', x)} /></Section>
    <Section title="Hiểu khách hàng hơn" icon="heart"><Field label="Sở thích" placeholder="Những điều khách quan tâm…" multiline value={form.interests} onChangeText={x => update('interests', x)} /><Field label="Ghi chú riêng" placeholder="Thông tin hữu ích cho lần gặp tiếp theo…" multiline value={form.notes} onChangeText={x => update('notes', x)} />
    <Field label="Cách liên hệ thuận tiện" placeholder="Ví dụ: gọi điện sau 16 giờ" value={form.preferredContact} onChangeText={x => update('preferredContact', x)} /></Section>
    <Section title="Thông tin xe" icon="car"><Field label="Dòng xe quan tâm / đã mua" placeholder="Ví dụ: Mercedes-Benz C 200" value={v.model} onChangeText={x => vehicle('model', x)} /><Field label="Biển số" placeholder="Nhập biển số nếu đã có" value={v.plate} onChangeText={x => vehicle('plate', x)} />
    <DateField label="Ngày giao xe" value={v.deliveryDate ? new Date(v.deliveryDate + 'T12:00:00') : null} onChange={d => vehicle('deliveryDate', d ? dateOnly(d) : null)} optional />
    </Section>{!!error && <Text style={s.error}>{error}</Text>}<Button icon="check" title="Lưu hồ sơ" onPress={() => save()} busy={busy} /><Button secondary title="Hủy" disabled={busy} onPress={() => router.back()} />
  </>}</Page>;
}
