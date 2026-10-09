import { NavLink } from 'react-router-dom';
import { Settings, ShieldCheck, UserRound, ReceiptText } from 'lucide-react';
export function AccountNavigation() {
  return <nav className="account-section-nav" aria-label="Cài đặt tài khoản">
    <NavLink to="/account" end><UserRound size={18}/><span>Thông tin cá nhân</span></NavLink>
    <NavLink to="/orders"><ReceiptText size={18}/><span>Đơn mua</span></NavLink>
    <NavLink to="/account/settings"><Settings size={18}/><span>Cài đặt</span></NavLink>
    <NavLink to="/account/advanced"><ShieldCheck size={18}/><span>Cài đặt nâng cao</span></NavLink>
  </nav>;
}
