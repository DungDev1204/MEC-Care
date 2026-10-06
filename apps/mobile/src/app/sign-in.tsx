import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Brand, Page, Field, Button, colors, s } from '../components/ui';
import { Icon } from '../components/icon';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { getLocalItem } from '../lib/storage';
import { isReviewMode } from '../lib/review';

export default function SignIn() {
  const { save } = useSession(); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function login() { setBusy(true); setError(''); try { const pushToken = await getLocalItem('pushToken'); await save(await api('/auth/login', 'POST', { email, password, pushToken })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Page><Brand />
    <View style={{ backgroundColor: colors.dark, borderRadius: 30, padding: 27, paddingTop: 32, gap: 24, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 270, height: 270, borderRadius: 150, borderWidth: 1, borderColor: '#FFFFFF0C', top: -120, right: -120 }} />
      <View style={[s.row, { gap: 7 }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#C0CDB7' }} /><Text style={[s.eyebrow, { color: '#B7C1B3', fontSize: 9 }]}>MỖI KẾT NỐI ĐỀU ĐÁNG TRÂN TRỌNG</Text></View>
      <Text style={[s.title, { color: 'white', fontSize: 36, lineHeight: 44 }]}>Chăm sóc bằng{'\n'}sự thấu hiểu.</Text>
      <Text style={{ color: '#B7BFB5', fontSize: 13, lineHeight: 21, maxWidth: 280 }}>Một không gian riêng để lưu giữ thông tin, theo dõi và chăm sóc từng khách hàng.</Text>
      <View style={{ height: 1, backgroundColor: '#FFFFFF18' }} /><View style={[s.row, { gap: 8 }]}><Icon name="shield" size={16} color="#CBD5C6" /><Text style={{ color: '#CBD5C6', fontSize: 11 }}>Dành cho đội ngũ tư vấn chuyên nghiệp</Text></View>
    </View>
    <View style={{ gap: 20 }}><View style={{ gap: 5 }}><Text style={[s.heading, { fontSize: 23 }]}>Chào mừng trở lại</Text><Text style={s.subtitle}>Đăng nhập để mở hồ sơ khách hàng của bạn.</Text></View>
      <Field label="Email nhân viên" icon="mail" placeholder="ten@congty.vn" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Mật khẩu" icon="lock" placeholder="Nhập mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      {!!error && <Text style={s.error}>{error}</Text>}<Button title="Đăng nhập" icon="arrow" onPress={login} busy={busy} disabled={!email || !password} />
    </View>
    {isReviewMode && <View style={[s.card, { backgroundColor: '#E9EDE4', padding: 16, gap: 6 }]}><Text style={s.eyebrow}>TÀI KHOẢN REVIEW</Text><Text style={{ fontSize: 12, lineHeight: 20, color: colors.muted }}>review@clientstudio.local · Review123!</Text></View>}
    <Text style={[s.subtitle, { fontSize: 11, textAlign: 'center' }]}>Tài khoản được cấp bởi người quản lý hệ thống.</Text>
  </Page>;
}
