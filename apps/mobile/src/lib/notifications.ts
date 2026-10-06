import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { isReviewMode } from './review';

if (Platform.OS !== 'web' && !isReviewMode) Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
export async function registerNotifications(request = false): Promise<string> {
  if (isReviewMode) return 'Chế độ review: lịch được lưu cục bộ; thông báo điện thoại chưa được bật trong bản này.';
  if (Platform.OS === 'web') return 'Thông báo được kiểm thử trên bản cài iPhone/Android.';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Lịch chăm sóc', importance: Notifications.AndroidImportance.HIGH });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && request && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'Thông báo chưa bật. Bạn vẫn lưu được lịch; hãy bật thông báo trong Cài đặt điện thoại.';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'Bản cài chưa được cấu hình nhận thông báo từ máy chủ. Liên hệ người cài đặt.';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/api/devices', 'POST', { pushToken: token });
  await SecureStore.setItemAsync('pushToken', token);
  return 'Đã đăng ký nhận lịch nhắc trên điện thoại này.';
}
export async function unregisterNotifications() {
  if (Platform.OS === 'web' || isReviewMode) return;
  const token = await SecureStore.getItemAsync('pushToken');
  if (token) await api('/api/devices/unregister', 'POST', { pushToken: token });
  await SecureStore.deleteItemAsync('pushToken');
}
