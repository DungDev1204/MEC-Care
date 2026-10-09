import { useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, Save } from 'lucide-react';
import { put, request } from '../lib/api';
import { useToast } from '../lib/hooks';
import { useSession } from '../session';
import { FormError, Loading } from '../components/ui';

type SubscriptionSettings = { subscriptionEnabled: boolean };

export function AdminSubscriptionSettings() {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const toast = useToast(); const { refreshSession } = useSession();
  const changed = saved !== null && enabled !== saved;

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    request<SubscriptionSettings>('/api/admin/subscription-settings', { signal: controller.signal })
      .then(settings => { if (!controller.signal.aborted) { setSaved(settings.subscriptionEnabled); setEnabled(settings.subscriptionEnabled); } })
      .catch(err => { if (!controller.signal.aborted) setError((err as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (loading || saving || !changed) return;
    setSaving(true); setError('');
    try {
      const settings = await put<SubscriptionSettings>('/api/admin/subscription-settings', { subscriptionEnabled: enabled });
      setSaved(settings.subscriptionEnabled); setEnabled(settings.subscriptionEnabled);
      toast(settings.subscriptionEnabled ? 'Đã bật yêu cầu đăng ký gói.' : 'Đã tắt yêu cầu đăng ký gói. Người dùng có thể sử dụng bình thường.');
      await refreshSession().catch(() => {});
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="panel admin-settings" aria-labelledby="admin-subscription-title" aria-busy={loading || saving}>
    <div className="setting-heading"><h2 id="admin-subscription-title"><BadgeCheck size={22}/> Quản lý gói đăng ký</h2></div>
    {loading ? <Loading/> : saved !== null && <p role="status" aria-live="polite"><strong>{saved ? 'Đang bật yêu cầu đăng ký gói.' : 'Đang tắt yêu cầu đăng ký gói.'}</strong></p>}
    <form onSubmit={save}>
      <fieldset disabled={loading || saving || saved === null}>
        <label className="admin-toggle"><input type="checkbox" role="switch" checked={enabled} aria-describedby="admin-subscription-description" onChange={event => setEnabled(event.target.checked)}/><span>Yêu cầu đăng ký gói để sử dụng</span></label>
        <div id="admin-subscription-description">
          <p className="auth-field-hint">Khi tắt, người dùng có tài khoản đang hoạt động và đã xác minh email được sử dụng bình thường mà không cần đăng ký gói.</p>
          <p className="auth-field-hint">Khi bật, người dùng cần có gói còn hạn để tiếp tục sử dụng.</p>
          <p className="auth-field-hint">Gói đã đăng ký và ngày hết hạn được giữ nguyên khi bật hoặc tắt. Tài khoản đang có gói còn hạn vẫn sử dụng bình thường.</p>
        </div>
      </fieldset>
      <FormError message={error}/>
      {error && saved === null && <button className="button secondary" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Thử tải lại</button>}
      <p className="auth-field-hint" role="status" aria-live="polite">{saving ? 'Đang lưu thay đổi…' : changed ? 'Thay đổi chưa được lưu.' : ''}</p>
      <button className="button primary" type="submit" disabled={loading || saving || !changed}><Save size={17}/>{saving ? 'Đang lưu…' : error && changed ? 'Thử lưu lại' : 'Lưu cài đặt gói'}</button>
    </form>
  </section>;
}
