import { currentSession } from './session';
import type { ImagePickerAsset } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { isReviewMode } from './review';

export const apiUrl = (isReviewMode && Platform.OS === 'web' && typeof window !== 'undefined'
  ? `http://${window.location.hostname}:5180` : process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(public status: number, public data: { message?: string; errors?: Record<string, string[]>; duplicate?: { id: string; name: string } }) {
    super(data.message || (status === 401 ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' : status === 404 ? 'Không tìm thấy dữ liệu.' : 'Không thể thực hiện. Hãy thử lại.'));
  }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ máy chủ. Liên hệ người cài đặt ứng dụng.');
  if (!apiUrl.startsWith('https://') && !__DEV__) throw new Error('Máy chủ cần kết nối HTTPS.');
  const token = currentSession()?.token;
  let response: Response;
  try { response = await fetch(`${apiUrl}${path}`, { method, headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
  }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(25000) }); }
  catch { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'); }
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new ApiError(response.status, data); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const photoSource = (id: string) => ({ uri: `${apiUrl}/api/photos/${id}/file`, headers: { Authorization: `Bearer ${currentSession()?.token || ''}` } });
export async function uploadPhoto(customerId: string, asset: ImagePickerAsset, avatar = false) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1800 || asset.height > 1800) context.resize(asset.width >= asset.height ? { width: 1800, height: null } : { width: null, height: 1800 });
  const image = await context.renderAsync();
  const jpg = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const data = new FormData();
  if (Platform.OS === 'web') data.append('file', await (await fetch(jpg.uri)).blob(), 'photo.jpg');
  else data.append('file', { uri: jpg.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  data.append('avatar', String(avatar));
  return api(`/api/customers/${customerId}/photos`, 'POST', data);
}
