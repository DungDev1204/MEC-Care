# Clienté Admin trên điện thoại

Bản review đã có bộ cài riêng tên **Clienté Admin**, biểu tượng khiên chữ A. Mở http://admin.localhost:5180/admin?tab=device trên máy chạy review, đăng nhập `review_admin` / `Review123!`. Review dùng dữ liệu riêng và tắt Web Push thật.

## Trang Admin trên domain hiện tại

Trang `https://care.tranie-mua.io.vn/admin` dùng logo khiên chữ A, tên **Clienté Admin**, favicon và biểu tượng màn hình chính Admin. Giao diện chọn nhận diện theo trang đang mở, kể cả khi chưa cấu hình hostname Admin riêng. Chuyển về trang khách hàng sẽ khôi phục nhận diện Clienté.

Trong **Ứng dụng & thông báo**, đường dẫn cài mặc định là `/admin?tab=device` trên domain hiện tại. HTML của trang này trỏ manifest Admin có `id: /admin`, `start_url: /admin?tab=orders`, scope `/admin` và bộ icon riêng. Manifest người dùng vẫn giữ `id: /`, scope `/` và icon Clienté. Khi mở trang đăng nhập để trở lại `/admin`, metadata cũng dùng nhận diện Admin. Việc chọn nhận diện không cấp thêm quyền: API quản trị vẫn yêu cầu tài khoản admin.

Hai app trên cùng domain chia sẻ phiên đăng nhập, service worker và quyền trình duyệt. Nếu đã cài Clienté, trình duyệt có thể không hiện nút cài Admin; dùng menu trình duyệt để thêm biểu tượng từ trang Admin. Đây là giới hạn của scope lồng nhau được mô tả trong [hướng dẫn của web.dev](https://web.dev/articles/building-multiple-pwas-on-the-same-domain#additional_challenges_for_overlapping_and_nested_paths). Bản sửa không tự đổi biểu tượng Clienté đã cài trước đó thành Admin.

## Tùy chọn hostname Admin riêng

Dùng hostname riêng khi cần tách phiên đăng nhập, service worker và quyền thông báo của hai ứng dụng. Đây là cách được [web.dev khuyến nghị khi triển khai nhiều PWA](https://web.dev/articles/building-multiple-pwas-on-the-same-domain#use_separate_origins). Hai app vẫn dùng cùng backend, SQL Server và dữ liệu. Trên hostname Admin, đăng nhập và mọi API yêu cầu tài khoản có quyền quản trị. Giữ nguyên các VAPID keys đã dùng.

Địa chỉ dự kiến: `https://admin-care.tranie-mua.io.vn`. Chưa tạo DNS/route hay cập nhật website public trong lần làm này.

1. Triển khai release đã được review, sao lưu và kiểm tra migration/health theo hướng dẫn hiện có. Giữ release trước để rollback đến khi bản mới đạt health Node + SQL Server.
2. Bổ sung hai dòng vào `/etc/cliente/.env` bằng `sudoedit /etc/cliente/.env`, giữ các cấu hình còn lại:

   ```dotenv
   USER_APP_URL=https://care.tranie-mua.io.vn
   ADMIN_APP_URL=https://admin-care.tranie-mua.io.vn
   ```

   Hai giá trị phải là HTTPS origin, không có đường dẫn, thuộc hai hostname khác nhau. Hostnames được bổ sung vào danh sách cho phép qua cấu hình này.
3. Trong tunnel Cloudflare đang chạy, thêm **Published application route** với hostname `admin-care.tranie-mua.io.vn`, service `http://127.0.0.1:5180`. Nếu cấu hình có `HTTP Host Header` cố định, bỏ override cho route Admin để backend nhận hostname Admin. Giữ nguyên route `care.tranie-mua.io.vn` và các dịch vụ khác. Cloudflare cần DNS hostname trỏ tới tunnel; xem [hướng dẫn route ứng dụng](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).
4. Người dùng tự chạy `sudo systemctl restart cliente`. Kiểm tra cả hai địa chỉ bằng HTTPS: `/health`, `/app/config`, `/manifest.webmanifest`. Manifest của hostname Admin phải có `name: Clienté Admin`, `id: /admin`, `start_url: /admin?tab=orders`; hostname người dùng giữ `id: /`.
5. Bật Web Push khi cấu hình máy chủ/VAPID/contact hợp lệ, giữ keys hiện có. Gửi thử một đơn từ tài khoản mẫu được chọn; admin nhận thông báo trên app Admin khi khóa máy và bấm để mở đúng đơn. Kiểm tra logout tắt thiết bị của phiên vừa đăng xuất.
6. Sau khi xác nhận service chạy release mới và Node + SQL health đạt, dùng `deployment/cleanup-old-releases.sh` dọn release/archive cũ, giữ gói mới và không xóa config/backup/script theo `AGENTS.md`.

## Cài app sau khi hostname Admin hoạt động

**iPhone (iOS 16.4 trở lên để nhận Web Push):** mở địa chỉ Admin bằng Safari → đăng nhập admin → Chia sẻ → Thêm vào Màn hình chính → kiểm tra tên **Clienté Admin** và biểu tượng khiên → Thêm. Bật **Mở dưới dạng ứng dụng web** nếu Safari có tùy chọn. Mở app từ biểu tượng vừa cài, đăng nhập lại nếu được yêu cầu, vào **Ứng dụng & thông báo → Bật thông báo**, chọn **Cho phép**. Quyền phải được yêu cầu từ thao tác người dùng trong app đã cài, theo [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

**Android:** mở địa chỉ Admin bằng Chrome → đăng nhập admin → chọn **Cài Clienté Admin** nếu nút hiện, hoặc menu ba chấm → Cài đặt ứng dụng/Thêm vào màn hình chính. Mở biểu tượng Admin, vào **Ứng dụng & thông báo → Bật thông báo**, cấp quyền.

Thông báo phát sinh khi khách **báo đã chuyển khoản**; admin vẫn phải đối soát giao dịch ngân hàng trước khi kích hoạt. Âm báo theo cài đặt hệ điều hành/Không làm phiền, chưa thêm âm thanh tùy chỉnh.

## Kiểm tra đã thực hiện

- 57 kiểm thử API và 13 frontend đạt; build TypeScript/React đạt.
- Kiểm tra hostname chung như production: logo khiên chữ A và tên Clienté Admin hiện đúng khi mở `/admin` trực tiếp và khi chuyển từ menu tài khoản. Chuyển về khách hàng khôi phục logo và manifest người dùng. Không còn thông báo thiếu địa chỉ Admin khi dùng đường dẫn trên cùng domain.
- HTTP đầu tiên trả metadata Admin đúng cả `/`, `/index.html`, `/login` và các đường dẫn quản trị. Kiểm tra PNG 192/512, manifest và app người dùng giữ danh tính cũ.
- Kiểm tra API từ chối tài khoản thường trên hostname Admin, không tạo phiên; cookies không chia sẻ sang subdomain, kiểm tra nguồn yêu cầu vẫn có hiệu lực.
- Mô phỏng service worker nhận push và bấm thông báo: dùng icon Admin, mở đúng đơn trên origin Admin, chặn URL khác origin.
- Chrome nhận diện nút **Cài Clienté Admin** trên origin review; đã xem hướng dẫn iPhone/Android, biểu tượng Admin và trang thiết bị ở 390 × 844. Trang quản trị trong app thường hiển thị đúng nút dẫn sang origin Admin, không dùng nút cài app thường cho Admin.
- Chưa xác nhận cài đặt và push nền trên iPhone/Android thật; cần kiểm tra sau khi hostname HTTPS và máy chủ Web Push hoạt động.
