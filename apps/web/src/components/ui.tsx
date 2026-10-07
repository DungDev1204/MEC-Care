import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, UsersRound, LoaderCircle, AlertCircle } from 'lucide-react';
import { photoBlob } from '../lib/api';
import { initials } from '../lib/utils';
import { statuses } from '../lib/types';
export function PhotoImage({ id, alt, className = '' }: { id: string; alt: string; className?: string }) {
  const [src, setSrc] = useState(''); const [failed, setFailed] = useState(false);
  useEffect(() => { const c = new AbortController(); let url = ''; setSrc(''); setFailed(false); photoBlob(id, c.signal).then(value => { url = value; if (c.signal.aborted) URL.revokeObjectURL(value); else setSrc(value); }).catch(() => { if (!c.signal.aborted) setFailed(true); }); return () => { c.abort(); if (url) URL.revokeObjectURL(url); }; }, [id]);
  return src ? <img className={className} src={src} alt={alt}/> : <span className={`photo-placeholder ${className}`} role="img" aria-label={failed ? 'Không tải được ảnh' : 'Đang tải ảnh'}>{failed ? <AlertCircle size={20}/> : <LoaderCircle size={20} className="spin"/>}</span>;
}
export function Avatar({ name, id, large = false }: { name: string; id?: string | null; large?: boolean }) {
  const tone = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
  return <span className={`avatar tone-${tone} ${large ? 'large' : ''}`}>{id ? <PhotoImage id={id} alt={`Ảnh đại diện ${name}`}/> : initials(name)}</span>;
}
export const Status = ({ value }: { value: string }) => <span className={`status ${value}`}><i/>{statuses[value] || value}</span>;
let activeDialogs = 0;
export function Modal({ title, subtitle, description, children, onClose, wide = false, busy = false, variant = 'form', icon, tone = 'neutral', className = '' }: { title: string; subtitle?: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean; busy?: boolean; variant?: 'form' | 'confirmation'; icon?: ReactNode; tone?: 'neutral' | 'warning' | 'danger' | 'success'; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const dialog = ref.current;
    dialog?.showModal();
    const field = dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus]') || dialog?.querySelector<HTMLElement>('[autofocus],input:not([type=checkbox]):not([type=date]):not([type=datetime-local]),textarea') || dialog?.querySelector<HTMLElement>('input,select');
    field?.focus({ preventScroll: true }); activeDialogs++; document.body.classList.add('modal-open');
    return () => { dialog?.close(); activeDialogs--; document.body.classList.toggle('modal-open', activeDialogs > 0); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''} ${variant === 'confirmation' ? `confirmation-modal confirmation-${tone}` : ''} ${className}`} role={variant === 'confirmation' ? 'alertdialog' : 'dialog'} onCancel={e => { e.preventDefault(); e.stopPropagation(); if (!busy) onClose(); }} onClick={e => { if (e.target === ref.current && !busy) onClose(); }} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : subtitle ? `${id}-subtitle` : undefined} aria-busy={busy || undefined}><div className="modal-body"><header className="modal-header">{icon && <span className="confirmation-icon">{icon}</span>}<div><span className="eyebrow">{variant === 'confirmation' ? 'CLIENTÉ / XÁC NHẬN THAO TÁC' : 'CLIENTÉ / CHĂM SÓC KHÁCH HÀNG'}</span><h2 id={`${id}-title`}>{title}</h2>{subtitle && <p id={`${id}-subtitle`}>{subtitle}</p>}</div><button type="button" className="icon-button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20}/></button></header><div className="modal-content">{description && <p className="confirmation-description" id={`${id}-description`}>{description}</p>}{children}</div></div></dialog>;
}
export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="empty"><div className="empty-icon"><UsersRound size={28} strokeWidth={1.3}/></div><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" size={22}/> Đang tải dữ liệu…</div>; }
export function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="error-state" role="alert"><AlertCircle size={22}/><p>{message}</p><button className="button secondary" onClick={retry}>Thử lại</button></div>; }
export const FormError = ({ message }: { message: string }) => message ? <div className="form-error" role="alert"><AlertCircle size={17}/>{message}</div> : null;
export function FormActions({ busy, onCancel, label = 'Lưu thay đổi' }: { busy: boolean; onCancel: () => void; label?: string }) { return <footer className="form-actions"><span>Thông tin được lưu vào hồ sơ riêng của bạn.</span><button className="button secondary" type="button" onClick={onCancel} disabled={busy}>Hủy</button><button className="button primary" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={16}/>} {busy ? 'Đang lưu…' : label}</button></footer>; }
