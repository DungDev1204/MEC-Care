import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { PhotoImage } from './photo-image';
import { Icon, IconName } from './icon';
import { BrandMark } from './brand-mark';
import { dateOnly, localDateTime, statuses } from '../lib/types';

export const colors = { ink: '#1B1E1C', muted: '#727872', background: '#F4F5F2', paper: '#FFFFFF', line: '#E2E5DF', soft: '#EBEDE7', dark: '#232824', error: '#A43D3D' };
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 22, paddingTop: 24, paddingBottom: 48, gap: 24 },
  title: { fontSize: 36, lineHeight: 43, fontWeight: '600', color: colors.ink, letterSpacing: -1.5 },
  subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted }, heading: { fontSize: 19, lineHeight: 26, fontWeight: '600', color: colors.ink, letterSpacing: -0.45 },
  text: { fontSize: 15, lineHeight: 24, color: colors.ink }, label: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.muted, marginBottom: 8 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.9, color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: 20, gap: 18, borderWidth: 1, borderColor: '#E9EBE6' },
  input: { backgroundColor: '#F6F7F4', borderWidth: 1, borderColor: colors.line, borderRadius: 16, minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, color: colors.ink, fontSize: 15 },
  button: { minHeight: 50, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 25, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, buttonText: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: 'white' },
  error: { color: colors.error, fontSize: 13, lineHeight: 21, backgroundColor: '#FAEEEE', padding: 12, borderRadius: 12 },
  badge: { backgroundColor: colors.soft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' }, divider: { height: 1, backgroundColor: colors.line },
});
export function Page({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={s.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView testID="cliente-page-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, Platform.OS === 'web' && { width: '100%', maxWidth: 560, alignSelf: 'center' }]}>{children}</ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
export function Brand({ light = false }: { light?: boolean }) { return <View style={[s.row, { gap: 10 }]}>
  <View style={{ width: 37, height: 37, borderRadius: 12, backgroundColor: light ? '#FFFFFF15' : colors.ink, alignItems: 'center', justifyContent: 'center' }}><BrandMark /></View>
  <View style={{ gap: 3 }}><Text style={{ color: light ? 'white' : colors.ink, fontSize: 16, fontWeight: '600', letterSpacing: 0.4 }}>Clienté</Text><Text style={[s.eyebrow, { fontSize: 8, letterSpacing: 1.7, color: light ? '#BEC7BE' : colors.muted }]}>CHĂM SÓC KHÁCH HÀNG</Text></View>
</View>; }
export function Button({ title, onPress, secondary = false, busy = false, disabled = false, icon, compact = false }: { title: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean; icon?: IconName; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled, busy }} aria-disabled={busy || disabled} aria-busy={busy} onPress={onPress} disabled={busy || disabled}
    style={({ pressed }) => [s.button, secondary && s.secondary, compact && { minHeight: 44, paddingHorizontal: 14, paddingVertical: 11 }, { opacity: busy || disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? colors.ink : 'white'} /> : icon && <Icon name={icon} size={17} color={secondary ? colors.ink : 'white'} />}<Text style={[s.buttonText, compact && { fontSize: 12 }, secondary && { color: colors.ink }]}>{title}</Text>
  </Pressable>;
}
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
  style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Icon name={icon} /></Pressable>; }
export function Back({ title = 'Quay lại' }: { title?: string }) { return <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={[s.row, { minHeight: 44, alignSelf: 'flex-start' }]}><Icon name="back" size={19} /><Text style={{ fontSize: 13, fontWeight: '500', color: colors.ink }}>{title}</Text></Pressable>; }
export function Section({ title, icon, children }: { title: string; icon?: IconName; children: React.ReactNode }) { return <View style={s.card}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>{icon && <Icon name={icon} size={18} />}<Text style={[s.heading, { flexShrink: 1 }]}>{title}</Text></View><View style={s.divider} />{children}</View>; }
export function Field({ label, error, icon, ...props }: TextInputProps & { label: string; error?: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return <View><Text style={s.label}>{label}</Text><View style={{ justifyContent: 'center' }}>{icon && <View pointerEvents="none" style={{ position: 'absolute', left: 16, zIndex: 1 }}><Icon name={icon} size={18} color={colors.muted} /></View>}
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#989E97" onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={[s.input, props.multiline && { minHeight: 112, textAlignVertical: 'top' }, icon && { paddingLeft: 44 }, focused && { borderColor: colors.ink, backgroundColor: colors.paper }, error && { borderColor: colors.error }, props.style]} />
    </View>{error && <Text style={[s.error, { marginTop: 8 }]}>{error}</Text>}</View>;
}
export function Choices({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (value: string) => void }) {
  return <View><Text style={s.label}>{label}</Text><View style={[s.row, { gap: 8 }]}>{Object.entries(options).map(([key, text]) =>
    <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: key === value }} aria-checked={key === value} onPress={() => onChange(key)} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: key === value ? colors.ink : colors.soft, opacity: pressed ? 0.65 : 1 })}>
      <Text style={{ fontSize: 13, fontWeight: '500', color: key === value ? 'white' : colors.muted }}>{text}</Text></Pressable>)}</View></View>;
}
export function ProfileTabs({ value, onChange }: { value: string; onChange: (tab: string) => void }) {
  const tabs: { key: string; title: string; icon: IconName }[] = [{ key: 'info', title: 'Thông tin', icon: 'user' }, { key: 'photos', title: 'Hình ảnh', icon: 'image' }, { key: 'care', title: 'Chăm sóc', icon: 'heart' }, { key: 'reminders', title: 'Lịch nhắc', icon: 'calendar' }];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ backgroundColor: '#E8EBE4', padding: 5, borderRadius: 22, flexGrow: 1, gap: 4 }}>
    {tabs.map(t => <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: value === t.key }} aria-selected={value === t.key} onPress={() => onChange(t.key)}
      style={{ flex: 1, minWidth: 72, paddingHorizontal: 10, minHeight: 65, paddingVertical: 10, gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: value === t.key ? colors.ink : 'transparent' }}>
      <Icon name={t.icon} size={18} color={value === t.key ? 'white' : colors.muted} /><Text style={{ fontSize: 11, fontWeight: '600', color: value === t.key ? 'white' : colors.muted }}>{t.title}</Text>
    </Pressable>)}
  </ScrollView>;
}
export function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const title = compact ? ({ new: 'Mới tiếp nhận', consulting: 'Đang tư vấn', purchased: 'Đang chăm sóc' }[status] || status) : statuses[status as keyof typeof statuses] || status;
  return <View style={[s.row, { gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.soft }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#657363' }} /><Text style={{ fontSize: 10, lineHeight: 15, fontWeight: '500', color: '#445042' }}>{title}</Text></View>;
}
export function EmptyState({ title, description, icon = 'user', action }: { title: string; description: string; icon?: IconName; action?: React.ReactNode }) { return <View style={[s.card, { alignItems: 'center', paddingVertical: 34 }]}>
  <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={25} /></View><Text style={[s.heading, { textAlign: 'center' }]}>{title}</Text><Text style={[s.subtitle, { textAlign: 'center', maxWidth: 270 }]}>{description}</Text>{action}
</View>; }
export function DateField({ label, value, onChange, time = false, optional = false }: { label: string; value: Date | null; onChange: (date: Date | null) => void; time?: boolean; optional?: boolean }) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  if (Platform.OS === 'web') return <View><Text style={s.label}>{label}</Text>{React.createElement('input', {
    type: time ? 'datetime-local' : 'date', 'aria-label': label, value: value ? (time ? localDateTime(value).slice(0, 16) : dateOnly(value)) : '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => { const raw = event.target.value; if (!raw) { onChange(null); return; }
      const next = new Date(time ? raw : `${raw}T12:00:00`); if (!Number.isNaN(next.getTime())) onChange(next); },
    style: { minHeight: 52, minWidth: 0, boxSizing: 'border-box', width: '100%', border: `1px solid ${colors.line}`, borderRadius: 16, padding: '14px 16px', background: '#F6F7F4', color: colors.ink, fontFamily: 'inherit', fontSize: 15 },
  })}{optional && value && <Button secondary title="Xóa ngày" onPress={() => onChange(null)} />}</View>;
  return <View><Text style={s.label}>{label}</Text><View style={s.row}>
    <Button secondary icon="calendar" title={value ? value.toLocaleDateString('vi-VN') : 'Chọn ngày'} onPress={() => setMode('date')} />
    {time && <Button secondary icon="clock" title={(value || new Date()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} onPress={() => setMode('time')} />}
    {optional && value && <Button secondary title="Xóa ngày" onPress={() => onChange(null)} />}</View>
    {mode && <><DateTimePicker value={value || new Date()} mode={mode} display={Platform.OS === 'ios' ? 'spinner' : 'default'} locale="vi-VN" is24Hour onChange={(event, date) => {
      if (Platform.OS !== 'ios') setMode(null);
      if (event.type !== 'dismissed' && date) onChange(date);
    }} />{Platform.OS === 'ios' && <Button secondary title="Xong" onPress={() => setMode(null)} />}</>}
  </View>;
}
export function Avatar({ id, name, size = 90 }: { id?: string | null; name: string; size?: number }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  if (id && failedId !== id) return <PhotoImage key={id} accessibilityLabel={`Ảnh của ${name}`} id={id} onFailure={() => setFailedId(id)} style={{ width: size, height: size, borderRadius: size * 0.28 }} />;
  const initials = name.trim().split(/\s+/).filter(x => /[\p{L}\p{N}]/u.test(x)).slice(-2).map(x => x[0]).join('').toUpperCase() || 'KH';
  return <View style={{ width: size, height: size, borderRadius: size * 0.25, backgroundColor: '#DFE4DB', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
    <View style={{ position: 'absolute', width: size * 1.1, height: size * 1.1, borderRadius: size, borderWidth: 1, borderColor: '#C9D2C4', top: size * 0.43, left: -size * 0.1 }} />
    <View style={{ position: 'absolute', width: size * 0.75, height: size * 0.75, borderRadius: size, borderWidth: 1, borderColor: '#C9D2C4', top: -size * 0.42, right: -size * 0.1 }} />
    <Text style={{ fontSize: size * 0.29, color: '#586651', fontWeight: '500', letterSpacing: -size * 0.015 }}>{initials}</Text></View>;
}
export function Info({ label, value }: { label: string; value?: string | null }) { return <View style={{ gap: 3 }}><Text style={[s.label, { marginBottom: 0 }]}>{label}</Text><Text style={[s.text, !value && { color: '#989E97' }]}>{value || 'Chưa bổ sung'}</Text></View>; }
