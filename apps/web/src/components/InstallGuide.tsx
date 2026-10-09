import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Apple, ArrowUpRight, Bell, Check, CircleHelp, Smartphone } from 'lucide-react';
import { isIOS } from '../lib/pwa';
import { Modal } from './ui';
import { InstallIllustration, type InstallPicture } from './InstallIllustration';

type Platform = 'ios' | 'android';
type Step = { title: string; description: ReactNode; picture: InstallPicture; imageLabel: string };
const guides: Record<Platform, Step[]> = {
  ios: [
    { title: 'Mở Clienté bằng Safari', description: <>Truy cập đường dẫn Clienté. Bấm biểu tượng <strong>Chia sẻ</strong> (ô vuông có mũi tên lên). Một số bố cục Safari cần mở menu trước rồi chọn Chia sẻ.</>, picture: 'ios-share', imageLabel: 'Minh họa Safari: nút Chia sẻ có mũi tên lên được khoanh xanh.' },
    { title: 'Thêm vào Màn hình chính', description: <>Cuộn bảng chia sẻ và chọn <strong>Thêm vào Màn hình chính</strong>.</>, picture: 'ios-home', imageLabel: 'Minh họa bảng chia sẻ iPhone: chọn Thêm vào Màn hình chính.' },
    { title: 'Xác nhận thêm Clienté', description: <>Giữ tên Clienté. Bật <strong>Mở dưới dạng ứng dụng web</strong> nếu có, rồi bấm <strong>Thêm</strong>.</>, picture: 'ios-add', imageLabel: 'Minh họa iPhone: bật Mở dưới dạng ứng dụng web và bấm Thêm ở góc trên.' },
    { title: 'Mở từ biểu tượng mới', description: <>Về Màn hình chính, bấm biểu tượng <strong>Clienté</strong> để sử dụng và đăng nhập nếu được yêu cầu.</>, picture: 'home-launch', imageLabel: 'Minh họa Màn hình chính: biểu tượng Clienté được đánh dấu để mở ứng dụng.' },
  ],
  android: [
    { title: 'Mở Clienté bằng Chrome', description: <>Truy cập đường dẫn Clienté trong <strong>Chrome</strong>, rồi bấm menu <strong>ba chấm ⋮</strong> bên cạnh thanh địa chỉ.</>, picture: 'android-menu', imageLabel: 'Minh họa Chrome Android: menu ba chấm ở bên phải thanh địa chỉ được khoanh xanh.' },
    { title: 'Chọn cài ứng dụng', description: <>Chọn <strong>Cài đặt và tạo lối tắt → Cài đặt</strong>. Tùy phiên bản, mục này có thể tên <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>.</>, picture: 'android-install', imageLabel: 'Minh họa menu Chrome Android: Cài đặt và tạo lối tắt, sau đó chọn Cài đặt.' },
    { title: 'Xác nhận cài Clienté', description: <>Bấm <strong>Cài đặt</strong> hoặc <strong>Thêm</strong> trong hộp xác nhận của Chrome và làm theo hướng dẫn trên điện thoại.</>, picture: 'android-confirm', imageLabel: 'Minh họa hộp cài Clienté trên Android: nút Cài đặt được đánh dấu.' },
    { title: 'Mở từ biểu tượng mới', description: <>Tìm biểu tượng <strong>Clienté</strong> trên màn hình chính hoặc trong danh sách ứng dụng, rồi mở và đăng nhập nếu được yêu cầu.</>, picture: 'home-launch', imageLabel: 'Minh họa Android: mở Clienté từ biểu tượng ứng dụng đã cài.' },
  ],
};
export function InstallGuide({ onClose, installed, pushEnabled, admin = false, adminInstallUrl }: { onClose: () => void; installed: boolean; pushEnabled?: boolean; admin?: boolean; adminInstallUrl?: string }) {
  const name = admin ? 'Clienté Admin' : 'Clienté';
  const installUrl = adminInstallUrl || new URL('/admin?tab=device', window.location.origin).href;
  const [platform, setPlatform] = useState<Platform>(() => isIOS() ? 'ios' : 'android'); const id = useId();
  const scroll = useRef<HTMLDivElement>(null); const tabs = useRef<Partial<Record<Platform, HTMLButtonElement | null>>>({});
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [platform]);
  function keyboard(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'ios' : event.key === 'End' ? 'android' : platform === 'ios' ? 'android' : 'ios';
    setPlatform(next); tabs.current[next]?.focus();
  }
  return <Modal title={admin ? "Cài Clienté Admin" : "Cài Clienté trên điện thoại"} subtitle="Thêm vào màn hình chính, mở nhanh như một ứng dụng." onClose={onClose} wide className="install-guide-modal">
    <div className="install-guide-switcher" role="tablist" aria-label="Hệ điều hành điện thoại" onKeyDown={keyboard}>
      <button type="button" ref={node => { tabs.current.ios = node; }} role="tab" id={`${id}-ios`} aria-controls={`${id}-panel-ios`} aria-selected={platform === 'ios'} tabIndex={platform === 'ios' ? 0 : -1} onClick={() => setPlatform('ios')}><Apple size={21}/><span><strong>iPhone / iOS</strong><small>Trình duyệt Safari</small></span></button>
      <button type="button" ref={node => { tabs.current.android = node; }} role="tab" id={`${id}-android`} aria-controls={`${id}-panel-android`} aria-selected={platform === 'android'} tabIndex={platform === 'android' ? 0 : -1} onClick={() => setPlatform('android')}><Smartphone size={21}/><span><strong>Android / Samsung</strong><small>Trình duyệt Chrome</small></span></button>
    </div>
    <div ref={scroll} className="install-guide-scroll"><section role="tabpanel" id={`${id}-panel-${platform}`} aria-labelledby={`${id}-${platform}`} tabIndex={0}>
      <div className="install-guide-intro">{admin && <p>Địa chỉ cài: <a href={installUrl} target="_blank" rel="noopener noreferrer">{installUrl}</a></p>}<span className="eyebrow">4 BƯỚC ĐƠN GIẢN</span>{admin && <p>Đăng nhập bằng <strong>tài khoản admin</strong> trước khi cài. Sau khi mở từ biểu tượng, Clienté Admin sẽ đưa bạn vào trang quản trị. Nếu điện thoại yêu cầu đăng nhập lại, dùng đúng tài khoản admin.</p>}<p>{platform === 'ios' ? 'Dùng Safari trên iPhone. Nếu đang mở từ Zalo, Facebook hoặc ứng dụng khác, hãy mở đường dẫn bằng Safari trước.' : 'Dùng Chrome trên Samsung hoặc các điện thoại Android khác. Nếu đang mở trong ứng dụng khác, hãy mở đường dẫn bằng Chrome trước.'}</p><small>Hình minh họa mô phỏng thao tác. Vị trí nút và tên mục có thể khác theo phiên bản.</small></div>
      <ol className="install-guide-steps">{guides[platform].map((step, index) => <li key={`${platform}-${index}`}><div className="install-step-heading"><span>{String(index + 1).padStart(2, '0')}</span><h3>{step.title.replace('Clienté', name)}</h3></div><figure><InstallIllustration picture={step.picture} label={step.imageLabel.replaceAll("Clienté", name)} admin={admin}/></figure><p>{admin && index === 0 ? <>Mở đường dẫn <strong>Clienté Admin</strong> bằng {platform === "ios" ? "Safari" : "Chrome"}. Đăng nhập admin, rồi bấm {platform === "ios" ? "Chia sẻ" : "menu ba chấm ⋮"}.</> : admin && index === 2 && platform === "ios" ? <>Giữ tên <strong>Clienté Admin</strong>. Bật <strong>Mở dưới dạng ứng dụng web</strong> nếu có, rồi bấm <strong>Thêm</strong>.</> : admin && index === 3 ? <>Bấm biểu tượng <strong>Clienté Admin</strong> trên Màn hình chính. Đăng nhập admin nếu được yêu cầu.</> : step.description}</p></li>)}</ol>
      <section className="install-notifications"><span className="setting-icon"><Bell size={23}/></span><div><h3>{admin ? 'Bật thông báo đơn hàng sau khi cài' : 'Bật lời nhắc sau khi cài'}</h3>{admin ? <p>Mở Clienté Admin từ biểu tượng → đăng nhập admin → <strong>Ứng dụng & thông báo → Bật thông báo</strong>. Chọn <strong>Cho phép</strong> khi điện thoại hỏi. Bạn cũng có thể bật từ chuông ở đầu trang quản trị.</p> : <p>Mở Clienté từ biểu tượng → đăng nhập → bấm avatar → <strong>Cài đặt → Bật thông báo</strong>. Chọn <strong>Cho phép</strong> khi điện thoại hỏi.</p>}{pushEnabled === false && <small>{admin ? 'Thông báo thật đang tắt ở môi trường hiện tại. Chuông trong ứng dụng vẫn hiển thị đơn chờ duyệt.' : 'Thông báo thật đang tắt ở môi trường hiện tại. Lịch chăm sóc của bạn vẫn được lưu.'}</small>}</div></section>
      <details className="install-guide-help"><summary><CircleHelp size={17}/> Không thấy mục cài đặt?</summary><div>{platform === 'ios' ? <p>Trong bảng Chia sẻ, cuộn xuống và bấm <strong>Sửa tác vụ</strong> để thêm mục Thêm vào Màn hình chính. Nếu có tùy chọn Mở dưới dạng ứng dụng web, hãy bật tùy chọn đó.</p> : <p>Kiểm tra bạn đang dùng Chrome, mở menu ba chấm và tìm mục Cài đặt hoặc Thêm vào màn hình chính. Nếu đã cài, hãy tìm {name} trong danh sách ứng dụng.</p>}<p>Dùng đường dẫn HTTPS do quản trị cung cấp để cài và bật lời nhắc trên điện thoại. Hướng dẫn này vẫn xem được ở bản thử trên máy tính.</p><a href={platform === 'ios' ? 'https://support.apple.com/vi-vn/guide/iphone/iphea86e5236/ios' : 'https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=vi'} target="_blank" rel="noopener noreferrer">Hướng dẫn chính thức từ {platform === 'ios' ? 'Apple' : 'Google Chrome'}<ArrowUpRight size={14}/></a></div></details>
    </section></div>
    <footer className="install-guide-footer"><span><Check size={15}/>{installed ? `Bạn đang mở ${name} ở dạng ứng dụng.` : 'Chỉ cần cài một lần trên mỗi thiết bị.'}</span><button type="button" className="button primary" onClick={onClose}>Đã hiểu</button></footer>
  </Modal>;
}
