import { useId } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, MoreVertical, PlusSquare, Share } from 'lucide-react';

export type InstallPicture = 'ios-share' | 'ios-home' | 'ios-add' | 'android-menu' | 'android-install' | 'android-confirm' | 'home-launch';
function Mark({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={10} fill="#edf5e6" stroke="#71935c" strokeWidth={2}/>;
}
function BrandIcon({ x, y, size = 36 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size / 100})`}><rect width={100} height={100} rx={24} fill="#1d3530"/><path d="M68 28c-24-15-47 3-47 22s23 37 47 22M65 35c-18-11-35 2-35 15s17 26 35 15M60 14l12-5" fill="none" stroke="#eee9dc" strokeWidth={4}/></g>;
}
function CustomerPage() {
  return <><BrandIcon x={16} y={82} size={26}/><text x={52} y={101} fontSize={19} fontFamily="Georgia,serif">Clienté.</text><text x={16} y={130} fontSize={16}>Khách hàng</text>{[150, 188].map(y => <g key={y}><circle cx={30} cy={y + 8} r={12} fill="#e8eddf"/><rect x={51} y={y} width={105} height={6} rx={3} fill="#d8e0d1"/><rect x={51} y={y + 12} width={78} height={5} rx={2} fill="#e5e9df"/></g>)}</>;
}
/** Original schematic illustrations; labels and highlighted controls are intentionally simplified. */
export function InstallIllustration({ picture, label }: { picture: InstallPicture; label: string }) {
  const id = useId();
  return <svg className="install-illustration" viewBox="0 0 320 300" role="img" aria-label={label}>
    <defs><clipPath id={id}><rect x={56} y={16} width={208} height={268} rx={18}/></clipPath></defs>
    <ellipse cx={160} cy={288} rx={112} ry={7} fill="#e1e8d9"/>
    <rect x={48} y={8} width={224} height={284} rx={26} fill="#fff" stroke="#cbd5c2" strokeWidth={2}/>
    <g clipPath={`url(#${id})`}><g transform="translate(56 16)" fill="#263c32" fontFamily="'Be Vietnam Pro',system-ui,sans-serif">
      <rect width={208} height={268} fill={picture === 'home-launch' ? '#edf2e4' : '#fafbf7'}/>
      <text x={14} y={21} fontSize={11}>9:41</text><path d="M163 17v-3m5 3v-5m5 5v-7" stroke="#53654e" strokeWidth={2}/><rect x={180} y={11} width={15} height={7} rx={2} fill="none" stroke="#53654e"/>
      {picture === 'ios-share' && <><CustomerPage/><rect y={208} width={208} height={60} fill="#eef1eb"/><rect x={10} y={214} width={188} height={23} rx={8} fill="#fff"/><text x={104} y={230} textAnchor="middle" fontSize={12}>Đường dẫn Clienté</text><Mark x={85} y={241} width={38} height={25}/><ArrowLeft x={20} y={244} size={18}/><Share x={94} y={245} size={18}/><BookOpen x={149} y={245} size={18}/><path d="M103 190v42m-5-6 5 6 5-6" fill="none" stroke="#71935c" strokeWidth={2}/></>}
      {picture === 'ios-home' && <><rect x={10} y={43} width={188} height={25} rx={8} fill="#e9eee4"/><text x={104} y={60} textAnchor="middle" fontSize={12}>Safari · Chia sẻ</text><rect x={8} y={77} width={192} height={179} rx={16} fill="#fff" stroke="#e1e7dc"/><BrandIcon x={22} y={91} size={27}/><text x={59} y={110} fontSize={16}>Clienté</text><path d="M21 128h166" stroke="#e7ebe2"/><text x={24} y={151} fontSize={13}>Sao chép</text><Mark x={17} y={168} width={174} height={56}/><text x={28} y={191} fontSize={14}>Thêm vào</text><text x={28} y={212} fontSize={14}>Màn hình chính</text><PlusSquare x={165} y={183} size={17}/><text x={24} y={246} fontSize={12} fill="#6b7e63">Sửa tác vụ</text></>}
      {picture === 'ios-add' && <><text x={14} y={59} fontSize={12}>Hủy</text><text x={56} y={59} fontSize={12}>Màn hình chính</text><Mark x={156} y={39} width={43} height={32}/><text x={178} y={60} textAnchor="middle" fontSize={13}>Thêm</text><BrandIcon x={23} y={91} size={40}/><text x={77} y={117} fontSize={18}>Clienté</text><rect x={16} y={144} width={176} height={1} fill="#e1e7dc"/><Mark x={14} y={165} width={180} height={61}/><text x={24} y={188} fontSize={12}>Mở dưới dạng</text><text x={24} y={208} fontSize={12}>ứng dụng web</text><rect x={146} y={184} width={37} height={23} rx={12} fill="#547b40"/><circle cx={172} cy={195.5} r={8.5} fill="#fff"/><text x={18} y={247} fontSize={11} fill="#6b7e63">Bật tùy chọn này nếu có</text></>}
      {(picture === 'android-menu' || picture === 'android-install') && <><rect x={10} y={39} width={162} height={30} rx={15} fill="#e9eee4"/><text x={22} y={59} fontSize={12}>Đường dẫn Clienté</text><CustomerPage/>{picture === 'android-menu' ? <><Mark x={177} y={38} width={24} height={32}/><MoreVertical x={180} y={45} size={18}/><path d="M177 85l10-12m-8 3 8-3-1 8" fill="none" stroke="#71935c" strokeWidth={2}/></> : <><MoreVertical x={180} y={45} size={18}/><rect x={23} y={73} width={179} height={189} rx={13} fill="#fff" stroke="#dde5d5"/><text x={37} y={100} fontSize={13}>Tab mới</text><text x={37} y={126} fontSize={13}>Nhật ký</text><text x={37} y={152} fontSize={13}>Tải xuống</text><Mark x={31} y={165} width={162} height={54}/><text x={42} y={186} fontSize={13}>Cài đặt và</text><text x={42} y={206} fontSize={13}>tạo lối tắt</text><ArrowDownToLine x={169} y={181} size={15}/><text x={45} y={246} fontSize={14} fill="#416936">→ Cài đặt</text></>}</>}
      {picture === 'android-confirm' && <><rect width={208} height={268} fill="#e3e9de"/><rect x={14} y={80} width={180} height={155} rx={16} fill="#fff"/><text x={27} y={107} fontSize={15}>Cài đặt Clienté?</text><BrandIcon x={28} y={125} size={35}/><text x={76} y={147} fontSize={17}>Clienté</text><text x={28} y={210} fontSize={13} fill="#697b62">Hủy</text><Mark x={103} y={184} width={78} height={36}/><text x={142} y={207} fontSize={13} textAnchor="middle">Cài đặt</text></>}
      {picture === 'home-launch' && <><Mark x={21} y={53} width={67} height={84}/><BrandIcon x={32} y={64} size={45}/><text x={54} y={127} textAnchor="middle" fontSize={12}>Clienté</text>{[[114, 67], [163, 67], [32, 151], [114, 151], [163, 151]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={30} height={30} rx={9} fill="#d4deca"/>)}<path d="M95 155l-23-36m1 8-1-8 8 3" fill="none" stroke="#71935c" strokeWidth={2}/><text x={111} y={211} textAnchor="middle" fontSize={14}>Mở từ biểu tượng</text><ArrowRight x={145} y={229} size={17}/></>}
    </g></g>
  </svg>;
}
