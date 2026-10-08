export type AccountInfo = {
  username: string | null; email: string; displayName: string; phone: string; expiresAt: string; timeZone: string;
  customers: number; photos: number; contacts: number; reminders: number;
};
export async function downloadBackup(includePhotos: boolean) {
  let response: Response;
  try { response = await fetch(`/api/account/backup?includePhotos=${includePhotos}`, { credentials: 'same-origin' }); }
  catch { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Chưa tạo được bản sao. Hãy thử lại.');
  }
  const blob = await response.blob(); const url = URL.createObjectURL(blob);
  const filename = response.headers.get('content-disposition')?.match(/filename="?([a-zA-Z0-9-]+\.zip)/)?.[1] || 'cliente-backup.zip';
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
