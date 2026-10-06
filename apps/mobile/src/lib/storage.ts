import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { isReviewMode } from './review';

// Browser session storage is used only for the explicit local review mode.
export async function getLocalItem(key: string) {
  if (Platform.OS === 'web') return isReviewMode && typeof window !== 'undefined' ? window.sessionStorage.getItem(`clientstudio-review-${key}`) : null;
  return SecureStore.getItemAsync(key);
}
export async function setLocalItem(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (!isReviewMode || typeof window === 'undefined') throw new Error('Bản web này chỉ hỗ trợ chế độ review cục bộ.');
    if (value === null) window.sessionStorage.removeItem(`clientstudio-review-${key}`); else window.sessionStorage.setItem(`clientstudio-review-${key}`, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key); else await SecureStore.setItemAsync(key, value);
}
