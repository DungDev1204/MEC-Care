import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SessionProvider, useSession } from '../lib/session';
import { registerNotifications } from '../lib/notifications';
import { isReviewMode } from '../lib/review';
import { DialogHost } from '../components/dialog';
import { colors } from '../components/ui';
import '../styles/scrollbars.css';

function Navigation() {
  const { session, ready } = useSession(); const segments = useSegments();
  useEffect(() => {
    if (!ready) return;
    if (!session && segments[0] !== 'sign-in') router.replace('/sign-in');
    if (session && segments[0] === 'sign-in') router.replace('/');
  }, [session, ready, segments]);
  useEffect(() => {
    if (!session || isReviewMode || Platform.OS === 'web') return;
    registerNotifications(false).catch(() => {});
    function open(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data || {};
      if (typeof data.customerId === 'string' && typeof data.reminderId === 'string') {
        router.push({ pathname: '/customers/[id]', params: { id: data.customerId, reminderId: data.reminderId,
          ...(typeof data.occurrenceId === 'string' ? { occurrenceId: data.occurrenceId } : {}), tab: 'reminders' } });
        Notifications.clearLastNotificationResponse();
      }
    }
    const last = Notifications.getLastNotificationResponse(); if (last) open(last);
    const sub = Notifications.addNotificationResponseReceivedListener(open); return () => sub.remove();
  }, [session]);
  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;
  return <View style={{ flex: 1 }}><StatusBar style="dark" />{isReviewMode && <View style={{ padding: 7, backgroundColor: '#E5E9DF' }}><Text style={{ textAlign: 'center', fontSize: 10, color: '#52614B', letterSpacing: 0.1 }}>REVIEW · Dữ liệu thử · Thông báo thật đang tắt</Text></View>}
    <Stack screenOptions={{ title: 'Clienté', headerShown: false, contentStyle: { backgroundColor: colors.background } }} /></View>;
}
export default function Root() { return <SessionProvider><Navigation /><DialogHost /></SessionProvider>; }
