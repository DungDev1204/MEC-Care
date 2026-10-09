import { useEffect, useState, type FormEvent } from 'react';
import { MessageCircle, Save } from 'lucide-react';
import { put, request } from '../lib/api';
import { useToast } from '../lib/hooks';
import { FormError, Loading } from '../components/ui';

type CommunitySettings = { telegramCommunityUrl: string };

export function AdminCommunitySettings() {
  const [saved, setSaved] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const toast = useToast(); const changed = saved !== null && url.trim() !== saved;

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    request<CommunitySettings>('/api/admin/community-settings', { signal: controller.signal })
      .then(settings => { if (!controller.signal.aborted) { setSaved(settings.telegramCommunityUrl); setUrl(settings.telegramCommunityUrl); } })
      .catch(err => { if (!controller.signal.aborted) setError((err as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (loading || saving || !changed) return;
    setSaving(true); setError('');
    try {
      const settings = await put<CommunitySettings>('/api/admin/community-settings', { telegramCommunityUrl: url.trim() });
      setSaved(settings.telegramCommunityUrl); setUrl(settings.telegramCommunityUrl);
      toast(settings.telegramCommunityUrl ? 'Đã lưu đường dẫn cộng đồng.' : 'Đã ẩn đường dẫn cộng đồng.');
      window.dispatchEvent(new Event('community-settings-changed'));
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="panel admin-settings" aria-labelledby="admin-community-title" aria-busy={loading || saving}>
    <div className="setting-heading"><h2 id="admin-community-title"><MessageCircle size={22}/> Cộng đồng Clienté</h2></div>
    <p>Người dùng có thể tham gia cộng đồng để góp ý và cùng phát triển Clienté.</p>
    {loading && <Loading/>}
    <form onSubmit={save}>
      <fieldset disabled={loading || saving || saved === null}>
        <label htmlFor="admin-community-url">Đường dẫn cộng đồng Telegram <span className="optional-label">(không bắt buộc)</span></label>
        <input id="admin-community-url" type="url" maxLength={300} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://t.me/cong_dong_cliente" aria-describedby="admin-community-hint"/>
        <p className="auth-field-hint" id="admin-community-hint">Dùng đường dẫn https://t.me/ten_nhom hoặc lời mời https://t.me/+ma_moi, https://t.me/joinchat/ma_moi. Để trống để ẩn mục “Tham gia góp ý phát triển Clienté”.</p>
      </fieldset>
      <FormError message={error}/>
      {error && saved === null && <button className="button secondary" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Thử tải lại</button>}
      <p className="auth-field-hint" role="status" aria-live="polite">{saving ? 'Đang lưu thay đổi…' : changed ? 'Thay đổi chưa được lưu.' : saved !== null ? saved ? 'Đường dẫn cộng đồng đang được hiển thị.' : 'Đường dẫn cộng đồng đang được ẩn.' : ''}</p>
      <button className="button primary" type="submit" disabled={loading || saving || !changed}><Save size={17}/>{saving ? 'Đang lưu…' : error && changed ? 'Thử lưu lại' : 'Lưu đường dẫn cộng đồng'}</button>
    </form>
  </section>;
}
