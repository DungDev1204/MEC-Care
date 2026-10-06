import React, { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { appAlert as Alert } from '../components/dialog';
import { router } from 'expo-router';
import { Back, Brand, Button, colors, Info, Page, Section, s } from '../components/ui';
import { Icon } from '../components/icon';
import { useSession } from '../lib/session';
import { api, ApiError } from '../lib/api';
import { registerNotifications, unregisterNotifications } from '../lib/notifications';
export default function Account() {
  const { session, save } = useSession(); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  async function enable() { setBusy(true); try { setStatus(await registerNotifications(true)); } catch (e) { setStatus((e as Error).message); } finally { setBusy(false); } }
  async function logout() {
    setBusy(true); try { await unregisterNotifications(); await api('/api/logout', 'POST'); await save(null); router.replace('/sign-in'); }
    catch (e) { if (e instanceof ApiError && e.status === 401) { await save(null); router.replace('/sign-in'); } else Alert.alert('Chưa đăng xuất được', (e as Error).message); }
    finally { setBusy(false); }
  }
  return <Page><Back /><Brand /><View style={{ gap: 8 }}><Text style={s.eyebrow}>KHÔNG GIAN CÁ NHÂN</Text><Text style={s.title}>Tài khoản.</Text><Text style={s.subtitle}>Quản lý kết nối và tùy chọn chăm sóc của bạn.</Text></View>
    <Section title="Tài khoản nhân viên" icon="user"><Info label="Email đăng nhập" value={session?.email} /><View style={s.divider} /><View style={s.row}><Icon name="shield" size={17} color={colors.muted} /><Text style={[s.subtitle, { flex: 1, fontSize: 12 }]}>Dữ liệu khách hàng được lưu riêng theo tài khoản.</Text></View></Section>
    <Section title="Thông báo chăm sóc" icon="bell"><Text style={s.subtitle}>Cho phép thông báo để nhận lịch chăm sóc. Máy chủ và kết nối mạng cần hoạt động; chế độ Tập trung và cài đặt điện thoại có thể ảnh hưởng việc hiển thị.</Text>
    <Button icon="bell" title="Bật thông báo" onPress={enable} busy={busy} />{!!status && <Text style={s.subtitle}>{status}</Text>}
    {Platform.OS !== 'web' && <Button secondary title="Mở cài đặt điện thoại" onPress={() => Linking.openSettings()} />}
    </Section><Button secondary icon="logout" title="Đăng xuất" onPress={logout} busy={busy} />
  </Page>;
}
