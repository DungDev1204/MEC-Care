import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { post } from '../lib/api';
import { pushSupported } from '../lib/pwa';
import { useToast } from '../lib/hooks';
import { useSession } from '../session';
import { ConfirmationDialog } from './confirmation';
export function LogoutDialog({ onClose }: { onClose: () => void }) {
  const { setEmail, setDisplayName } = useSession(); const toast = useToast();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try {
      await post('/api/logout');
      if (pushSupported()) navigator.serviceWorker.getRegistration().then(r => r?.getNotifications()).then(items => items?.forEach(n => n.close())).catch(() => {});
      setDisplayName(''); setEmail(null); toast('Đã đăng xuất.');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <ConfirmationDialog options={{ title: 'Đăng xuất khỏi Clienté?', description: 'Các hồ sơ đã lưu vẫn nằm trong tài khoản của bạn. Lời nhắc trên phiên đăng nhập này sẽ dừng cho đến khi bạn đăng nhập lại.', confirmLabel: 'Đăng xuất', cancelLabel: 'Ở lại' }} icon={<LogOut size={23}/>} onCancel={onClose} onConfirm={logout} busy={busy} error={error}/>;
}
