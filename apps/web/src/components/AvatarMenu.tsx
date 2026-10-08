import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useSession } from '../session';
import { Avatar } from './ui';

const sections = [
  { label: 'Thông tin cá nhân', path: '/account', icon: UserRound },
  { label: 'Cài đặt', path: '/account/settings', icon: Settings },
  { label: 'Cài đặt nâng cao', path: '/account/advanced', icon: ShieldCheck },
];
export function AvatarMenu({ variant, onLogout }: { variant: 'top' | 'sidebar' | 'mobile'; onLogout: () => void }) {
  const { email, displayName, isAdmin } = useSession(); const location = useLocation(); const id = useId();
  const menuSections = isAdmin ? [...sections, { label: 'Quản trị hệ thống', path: '/admin', icon: ShieldCheck }] : sections;
  const itemCount = menuSections.length + 1;
  const name = displayName || email?.split('@')[0] || 'Bạn';
  const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); const [position, setPosition] = useState({ top: 0, left: 0, width: 288, maxHeight: 400 });
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useLayoutEffect(() => {
    if (!open) return;
    const align = () => {
      const bounds = trigger.current!.getBoundingClientRect(); const width = Math.min(288, document.documentElement.clientWidth - 24);
      const height = popup.current?.offsetHeight || 304; const below = window.innerHeight - bounds.bottom - 12;
      const top = below >= height ? bounds.bottom + 8 : Math.max(12, bounds.top - height - 8);
      setPosition({ top, width, left: Math.max(12, Math.min(bounds.right - width, document.documentElement.clientWidth - width - 12)), maxHeight: window.innerHeight - top - 12 });
    };
    align(); window.addEventListener('resize', align); window.addEventListener('scroll', align, true);
    return () => { window.removeEventListener('resize', align); window.removeEventListener('scroll', align, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  function focusItem(index: number) { popup.current?.querySelectorAll<HTMLElement>('[role=menuitem]')[index]?.focus(); }
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const items = Array.from(popup.current?.querySelectorAll<HTMLElement>('[role=menuitem]') || []);
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? itemCount - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + itemCount) % itemCount;
      focusItem(next);
    } else if (event.key === 'Tab') { trigger.current?.focus(); setOpen(false); }
  }
  return <>
    <button ref={trigger} type="button" className={`avatar-menu-trigger ${variant === 'top' ? 'top-avatar' : variant === 'sidebar' ? 'sidebar-account' : 'mobile-account-button'} ${location.pathname.startsWith('/account') ? 'active' : ''}`} aria-label="Mở menu tài khoản" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setOpen(v => !v); if (!open) requestAnimationFrame(() => focusItem(0)); }} onKeyDown={event => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOpen(true); requestAnimationFrame(() => focusItem(event.key === 'ArrowUp' ? itemCount - 1 : 0)); } else if (event.key === 'Escape' || event.key === 'Tab') setOpen(false); }}>
      <Avatar name={name}/>{variant === 'sidebar' ? <><div><strong>{displayName || 'Tài khoản của bạn'}</strong><span>{email}</span></div><ChevronRight size={16}/></> : variant === 'mobile' ? <span>Tài khoản</span> : null}
    </button>
    {open && createPortal(<div ref={popup} className="account-menu" style={position} onKeyDown={keyboard}>
      <div className="account-menu-heading"><Avatar name={name}/><div><strong>{displayName || 'Không gian của bạn'}</strong><span>{email}</span></div></div>
      <div id={id} role="menu" aria-label="Menu tài khoản" className="account-menu-items">
        {menuSections.map(({ label, path, icon: Icon }) => <Link key={path} to={path} role="menuitem" tabIndex={-1} className={location.pathname === path ? 'selected' : ''} onClick={() => setOpen(false)}><Icon size={18}/><span>{label}</span><ChevronRight size={14}/></Link>)}
        <div className="account-menu-divider"/>
        <button type="button" role="menuitem" tabIndex={-1} className="danger" onClick={() => { trigger.current?.focus(); setOpen(false); onLogout(); }}><LogOut size={18}/><span>Đăng xuất</span></button>
      </div>
    </div>, document.body)}
  </>;
}
