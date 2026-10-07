import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, LoaderCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { FormError, Modal } from './ui';

export type ConfirmOptions = {
  title: string; description: string; confirmLabel: string; cancelLabel?: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
};
export function ConfirmationDialog({ options, onConfirm, onCancel, busy = false, error = '', icon }: { options: ConfirmOptions; onConfirm: () => void; onCancel: () => void; busy?: boolean; error?: string; icon?: ReactNode }) {
  const tone = options.tone || 'neutral';
  const symbol = icon || (tone === 'danger' ? <Trash2 size={23}/> : tone === 'success' ? <Check size={23}/> : <ShieldAlert size={23}/>);
  return <Modal title={options.title} description={options.description} onClose={onCancel} busy={busy} variant="confirmation" tone={tone} icon={symbol}>
    <FormError message={error}/>
    <footer className="confirmation-actions"><button type="button" className="button secondary" data-dialog-initial-focus disabled={busy} onClick={onCancel}>{options.cancelLabel || 'Quay lại'}</button><button type="button" className={`button primary ${tone === 'danger' ? 'destructive' : ''}`} disabled={busy} onClick={onConfirm}>{busy && <LoaderCircle size={16} className="spin"/>}{busy ? 'Đang xử lý…' : options.confirmLabel}</button></footer>
  </Modal>;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions>();
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const confirm = useCallback((value: ConfirmOptions) => {
    // The current top-layer dialog owns the decision; ignore duplicate requests.
    if (resolver.current) return Promise.resolve(false);
    return new Promise<boolean>(resolve => { resolver.current = resolve; setOptions(value); });
  }, []);
  const finish = useCallback((confirmed: boolean) => { const resolve = resolver.current; resolver.current = null; setOptions(undefined); resolve?.(confirmed); }, []);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  return <ConfirmContext.Provider value={confirm}>{children}{options && createPortal(<ConfirmationDialog options={options} onConfirm={() => finish(true)} onCancel={() => finish(false)}/>, document.body)}</ConfirmContext.Provider>;
}
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('ConfirmationProvider is required.');
  return confirm;
}
export function useDiscardChanges({ dirty, busy, onClose, description }: { dirty: boolean; busy: boolean; onClose: () => void; description: string }) {
  const confirm = useConfirm();
  return async () => {
    if (busy) return;
    if (!dirty || await confirm({ title: 'Bỏ thay đổi chưa lưu?', description, confirmLabel: 'Bỏ thay đổi', cancelLabel: 'Tiếp tục chỉnh sửa', tone: 'warning' })) onClose();
  };
}
