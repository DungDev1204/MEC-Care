export class ApiError extends Error { constructor(message: string, public status: number, public data: Record<string, unknown> = {}) { super(message); } }
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: 'same-origin', headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
  catch { throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; nội dung đang nhập vẫn được giữ.', 0); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'));
    if (response.status === 403 && data.code === 'SUBSCRIPTION_REQUIRED') window.dispatchEvent(new CustomEvent('subscription-required', { detail: data }));
    const errors = data.errors ? Object.values(data.errors as Record<string, string[]>).flat().join(' ') : null;
    throw new ApiError(errors || data.message || (response.status === 401 ? 'Username hoặc mật khẩu không đúng, hoặc phiên đăng nhập đã hết hạn.' : response.status === 404 ? 'Không tìm thấy dữ liệu này. Hãy tải lại.' : response.status === 400 ? 'Dữ liệu chưa hợp lệ. Kiểm tra các trường rồi thử lại.' : 'Chưa thực hiện được. Hãy thử lại.'), response.status, data);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
export const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T,>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const remove = (path: string) => request<void>(path, { method: 'DELETE' });
export async function photoBlob(id: string, signal: AbortSignal) {
  const response = await fetch(`/api/photos/${id}/file`, { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('Không tải được ảnh');
  return URL.createObjectURL(await response.blob());
}
export async function compressPhoto(file: File): Promise<Blob> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Chọn ảnh nhỏ hơn 25 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url;
    await img.decode().catch(() => { throw new Error('Trình duyệt không đọc được ảnh. Hãy chọn JPEG, PNG hoặc WebP.'); });
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Không xử lý được ảnh.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không xử lý được ảnh.')), 'image/jpeg', .86));
  } finally { URL.revokeObjectURL(url); }
}
