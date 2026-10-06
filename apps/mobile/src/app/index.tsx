import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Avatar, Brand, Button, colors, EmptyState, IconButton, Page, s, StatusBadge } from '../components/ui';
import { Icon } from '../components/icon';
import { api, ApiError } from '../lib/api';
import { Customer, formatDate } from '../lib/types';
import { useSession } from '../lib/session';

export default function Customers() {
  const { save } = useSession(); const [customers, setCustomers] = useState<Customer[]>([]); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0); const { width, fontScale } = useWindowDimensions();
  useFocusEffect(useCallback(() => {
    let alive = true; const timer = setTimeout(() => {
      setBusy(true); setError(''); api<Customer[]>('/api/customers?search=' + encodeURIComponent(search)).then(data => { if (alive) setCustomers(data); }).catch(e => {
        if (alive) setError(e.message); if (e instanceof ApiError && e.status === 401) save(null);
      }).finally(() => { if (alive) setBusy(false); });
    }, 200); return () => { alive = false; clearTimeout(timer); };
  // The revision deliberately refreshes the same query after tapping Retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, save, revision]));
  const contentWidth = Platform.OS === 'web' ? Math.min(width, 560) : width;
  const visible = customers.filter(c => filter === 'all' || c.status === filter);
  const twoColumns = visible.length > 1 && contentWidth >= 390 && fontScale < 1.25;
  const cardWidth = twoColumns ? (contentWidth - 56) / 2 : contentWidth - 44;
  const filtered = !!search.trim() || filter !== 'all';
  const filters = [{ key: 'all', title: 'Tất cả' }, { key: 'consulting', title: 'Đang tư vấn' }, { key: 'purchased', title: 'Đang chăm sóc' }, { key: 'new', title: 'Mới tiếp nhận' }];
  return <Page><View style={[s.row, { justifyContent: 'space-between' }]}><Brand /><IconButton icon="user" label="Tài khoản" onPress={() => router.push('/account')} /></View>
    <View style={{ gap: 12, paddingTop: 10 }}><View style={[s.row, { gap: 7 }]}><Icon name="shield" size={13} color={colors.muted} /><Text style={s.eyebrow}>KHÔNG GIAN CỦA BẠN</Text></View>
      <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}><Text style={[s.title, { fontSize: contentWidth >= 390 ? 36 : 32 }]}>Khách hàng.</Text><Button compact icon="plus" title="Thêm khách" onPress={() => router.push('/customer-form')} /></View>
      <Text style={s.subtitle}>Lưu giữ câu chuyện. Chăm sóc từng kết nối.</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16 }}>
      <Icon name="search" size={19} color={colors.muted} /><TextInput accessibilityLabel="Tìm khách hàng" placeholder="Tên, điện thoại hoặc biển số" placeholderTextColor="#92998F" value={search} onChangeText={setSearch} style={{ flex: 1, minHeight: 54, fontSize: 14, color: colors.ink }} />
      {!!search && <IconButton icon="close" label="Xóa tìm kiếm" onPress={() => setSearch('')} />}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>{filters.map(f => <Pressable key={f.key} accessibilityRole="radio" accessibilityState={{ checked: f.key === filter }} aria-checked={f.key === filter} onPress={() => setFilter(f.key)}
      style={{ minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: filter === f.key ? colors.ink : '#E8EBE4' }}><Text style={{ fontSize: 12, fontWeight: '600', color: filter === f.key ? 'white' : colors.muted }}>{f.title}</Text></Pressable>)}</ScrollView>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.eyebrow}>{search.trim() ? 'KẾT QUẢ TÌM KIẾM' : 'HỒ SƠ KHÁCH HÀNG'}</Text><Text style={s.subtitle}>{busy ? 'Đang tải…' : visible.length + ' hồ sơ'}</Text></View>
    {busy ? <View style={{ paddingVertical: 40 }}><ActivityIndicator color={colors.ink} accessibilityLabel="Đang tải khách hàng" /></View> : error ? <EmptyState icon="clock" title="Chưa tải được hồ sơ" description={error} action={<Button secondary title="Thử lại" onPress={() => setRevision(x => x + 1)} />} /> : visible.length === 0 ?
      <EmptyState icon="user" title={filtered ? 'Chưa tìm thấy khách hàng' : 'Kết nối đầu tiên của bạn'} description={filtered ? 'Thử thay đổi từ khóa hoặc chọn tất cả hồ sơ.' : 'Thêm một hồ sơ để bắt đầu hành trình chăm sóc khách hàng.'}
        action={<Button icon={filtered ? 'search' : 'plus'} title={filtered ? 'Xem tất cả khách' : 'Thêm khách hàng'} onPress={() => { if (filtered) { setSearch(''); setFilter('all'); } else router.push('/customer-form'); }} />} /> :
      <View style={[s.row, { alignItems: 'stretch', gap: 12 }]}>{visible.map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={'Mở hồ sơ ' + c.name} onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })}
        style={({ pressed }) => ({ width: cardWidth, flexDirection: twoColumns ? 'column' : 'row', alignItems: twoColumns ? 'stretch' : 'center', backgroundColor: colors.paper, borderRadius: 25, borderWidth: 1, borderColor: '#E6E9E2', padding: twoColumns ? 10 : 16, gap: 14, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ alignItems: 'center', backgroundColor: '#DFE4DB', borderRadius: 19, overflow: 'hidden' }}><Avatar id={c.avatarId} name={c.name} size={twoColumns ? cardWidth - 22 : 86} /></View>
        <View style={{ paddingHorizontal: 4, gap: 10, flex: 1 }}><Text style={{ fontSize: 17, lineHeight: 23, letterSpacing: -0.4, fontWeight: '600', color: colors.ink }}>{c.name}</Text>
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-start' }}><Icon name="car" size={14} color={colors.muted} /><Text style={{ flex: 1, fontSize: 11, lineHeight: 17, color: colors.muted }}>{c.vehicles[0]?.model || 'Chưa bổ sung xe'}</Text></View><StatusBadge status={c.status} compact />
          <View style={{ flex: 1 }} /><View style={s.divider} /><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 9, color: colors.muted }}>LIÊN HỆ GẦN NHẤT</Text><Text style={{ fontSize: 11, fontWeight: '500', color: colors.ink }}>{c.lastContactAt ? formatDate(c.lastContactAt) : 'Chưa ghi nhận'}</Text></View><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow" size={15} /></View></View>
        </View>
      </Pressable>)}</View>}
    <View style={[s.row, { justifyContent: 'center', gap: 6, paddingTop: 6 }]}><Icon name="lock" size={12} color={colors.muted} /><Text style={{ fontSize: 10, color: colors.muted }}>Hồ sơ được lưu riêng theo tài khoản của bạn</Text></View>
  </Page>;
}
