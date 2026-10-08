# Clienté · Web app / PWA

Không gian quản lý và chăm sóc khách hàng xe sang, dùng trên máy tính, iPhone và Samsung. Dự án đã chuyển từ mobile Expo sang web/PWA; backend hiện dùng Node.js + TypeScript + Express, frontend React + TypeScript. SQL Server MEC và kho ảnh được giữ khi cập nhật. Mã mobile, mã C# và cấu hình JSON .NET cũ đã được gỡ khỏi mã nguồn.

Sau đăng nhập mở thẳng **danh sách khách hàng**. Thiết kế mới dùng trắng ngà, xanh trầm, chữ serif cho tiêu đề và Be Vietnam Pro cho nội dung; font được đóng gói tại chỗ. Desktop có thanh điều hướng và lịch cạnh danh sách, điện thoại có điều hướng dưới màn hình.

## Tính năng

- Tìm tên không dấu, điện thoại, dòng xe, biển số; lọc trạng thái, sắp xếp A–Z / cập nhật / lâu chưa liên hệ; xem danh sách hoặc thẻ.
- Thêm/sửa hồ sơ, nhiều xe, ngày sinh và tuổi, sở thích, ghi chú; xác nhận riêng khi trùng điện thoại.
- Hồ sơ bốn mục: thông tin, hình ảnh, chăm sóc, lịch nhắc. Gọi / nhắn tin bằng ứng dụng của thiết bị.
- Avatar riêng, album nhiều ảnh, nén JPEG trước khi tải; ảnh được đọc qua API kiểm tra chủ sở hữu; xem lớn, sửa mô tả, xóa có xác nhận.
- Ghi nhận kênh, thời điểm thực tế và kết quả chăm sóc; đặt lần tiếp theo trong cùng thao tác. Mở từ lời nhắc có thể đồng thời hoàn thành đúng lần đó.
- Lịch chăm sóc chung có bộ lọc hôm nay, 7 ngày tới, quá hạn; thêm/sửa/hủy lịch, dời và hoàn thành từng lần. Lặp hằng năm, nhắc trước 1/3 ngày, quy tắc 29/02.
- PWA có manifest, icon, Service Worker, hướng dẫn cài vào màn hình chính, đăng ký Web Push theo thiết bị và link thông báo đến đúng hồ sơ.
- Hướng dẫn cài đặt trong Cài đặt có hai tab iPhone/Safari và Android/Samsung/Chrome, bốn bước có hình vector đánh dấu vị trí cần bấm, mẹo khi không thấy mục cài và hướng dẫn bật lời nhắc sau cài.
- Bấm avatar mở menu Thông tin cá nhân / Cài đặt / Cài đặt nâng cao / Đăng xuất trên desktop và điện thoại. Sửa tên hiển thị, điện thoại; cài thông báo và PWA ở trang riêng.
- Cài đặt nâng cao tải ZIP dữ liệu của tài khoản hiện tại: hồ sơ, xe, chăm sóc, lịch nhắc và tùy chọn kèm ảnh đã lưu. ZIP có `data.json` và ảnh kèm checksum; không chứa mật khẩu hoặc phiên đăng nhập. Đây là bản xuất cá nhân; phục hồi và sao lưu toàn bộ SQL + kho ảnh vẫn do quản trị vận hành.
- Cookie phiên HttpOnly / SameSite Strict, Secure trong production; dữ liệu riêng từng nhân viên. Đăng xuất ngừng thông báo của phiên đó. Không lưu token hay hồ sơ vào localStorage.
- Trạng thái tải, rỗng, lỗi, lưu, ngoại tuyến; form giữ nội dung khi lỗi mạng, cảnh báo bỏ thay đổi, hỗ trợ bàn phím và giảm chuyển động.

## Xem ngay trên máy này

Yêu cầu Node.js 24 LTS. Backend Express và frontend React cùng dùng TypeScript; cấu hình vận hành bằng .env. Dữ liệu Review dùng SQLite riêng; thông báo thật tắt.

Tại thư mục gốc, cài dependency và build lần đầu:

```powershell
npm --prefix apps/api ci
npm --prefix apps/web ci
npm run build
npm run review
```

Mở **http://localhost:5180**; một cổng phục vụ cả web và API. Nút **Điền tài khoản thử** có trong màn hình đăng nhập Review. Tài khoản `review@clientstudio.local` / `Review123!` có sáu hồ sơ hư cấu ban đầu. Tài khoản `review2@clientstudio.local` cùng mật khẩu có dữ liệu riêng. Các thao tác thử được lưu bền vững trong `apps/api/review-data/`; không trộn với SQL công ty. Khi cần frontend tự cập nhật lúc sửa mã, dùng các lệnh npm theo [hướng dẫn phát triển](docs/review.md); [thử trên điện thoại](docs/review-phone.md).

## Build và triển khai cùng API

```powershell
npm run build
```

Script build tạo frontend trong `apps/api/wwwroot`; Node.js phục vụ cả web và API trên cùng domain. Bản Review cũng có thể mở ở **http://localhost:5180** sau khi build rồi khởi động lại API. Build/publish không triển khai lên máy chủ công ty và không chạy migrations trên SQL.

Production dùng SQL Server 2019+ (server đã kiểm tra là SQL Server 2022), database `MEC`, HTTPS và thư mục ảnh bền vững. Toàn bộ cấu hình vận hành đọc từ **`.env`**, theo mẫu [deploy/ubuntu/.env.example](deploy/ubuntu/.env.example): `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`, `BIND_ADDRESS`, `ALLOWED_HOSTS`, `PUSH_*`. Ubuntu dùng `/etc/cliente/.env`, local dùng `apps/api/.env`; có thể chọn đường dẫn bằng `CLIENTE_ENV_FILE`. File secret `.env` không đưa vào Git hoặc gói publish. Biến môi trường thực tế ưu tiên hơn giá trị trong file. Các lệnh CLI và service cùng đọc một file `.env`.

Backend Node kết nối SQL Server MEC; [script SQL idempotent](docs/database.sql) dùng khi cài mới hoặc nâng cấp. Bản đăng ký OTP/admin cần chạy CLI `--migrate-auth` trước khi cập nhật máy chủ để nâng schema và gán username cho tài khoản cũ. Người dùng đăng ký username, email và mật khẩu tối thiểu 6 ký tự tại `/register`, xác minh OTP email rồi đăng nhập bằng username. Trang chủ hiển thị yêu cầu đăng ký gói; admin kích hoạt thì mới sử dụng các chức năng chăm sóc khách hàng. Trang `/admin` có giao diện riêng để quản lý người dùng, kích hoạt/gia hạn theo tháng, khóa tài khoản, cài đặt đăng ký và tạo thông báo cho mọi người dùng với lịch bắt đầu/kết thúc. Người dùng có thể ẩn từng thông báo cho các lần truy cập sau. Tài khoản `admin@admin.com` hiện có được cấp quyền bằng script, giữ nguyên mật khẩu. Xem [hướng dẫn đăng ký và admin](docs/registration-admin.md).

## Web Push thật

Triển khai Ubuntu + Cloudflare, hostname `care.tranie-mua.io.vn` và SQL database `MEC`: xem [hướng dẫn và lệnh máy chủ](docs/deploy-ubuntu.md). Có mẫu systemd, cấu hình production và script `scripts/package-ubuntu.ps1`; cấu hình/ảnh nằm ngoài thư mục release để giữ dữ liệu khi cập nhật hoặc đổi domain.

```powershell
cd apps/api
node dist/server.js --create-push-keys
```

Lệnh tạo cặp VAPID vào `.env` bị ignore, không in private key; giữ nguyên khóa đã có. Đặt `PUSH_SUBJECT=mailto:...`, `PUSH_PUBLIC_KEY`, `PUSH_PRIVATE_KEY` và bật `PUSH_ENABLED=true` trong `.env`. CLI `--set-push-contact email@domain.vn` lưu email và bật push sau khi kiểm tra khóa. Không đổi cặp khóa sau khi người dùng đăng ký nếu chưa có kế hoạch đăng ký lại.

Không còn Expo, APNs signing, Firebase project hoặc bản IPA/APK. Chrome/Samsung Internet và Safari PWA dùng Web Push tiêu chuẩn. iPhone cần iOS 16.4+, Safari → Thêm vào Màn hình chính → mở từ biểu tượng → Bật thông báo. Samsung dùng Chrome hoặc Samsung Internet qua HTTPS, cấp quyền thông báo. `/api/push/config` chỉ trả public key và trạng thái.

Worker xử lý mỗi 15 giây, lưu công việc và retry trong SQL, vô hiệu đăng ký bị dịch vụ trả 404/410. Chạy **một worker** trong giai đoạn hiện tại. Thông báo màn hình khóa dùng nội dung chung; bấm vào mới mở hồ sơ có đăng nhập. Phiên có hiệu lực 7 ngày: đăng nhập lại sau khi hết hạn và kiểm tra đăng ký trong Tài khoản. Khi đăng xuất hoặc phiên hết hạn, thiết bị của phiên không còn nhận push. HTTP qua IP LAN chỉ để review giao diện, không dùng kiểm thử PWA/push.

Push cần mạng, quyền thông báo và server hoạt động; Không làm phiền / tiết kiệm pin có thể ảnh hưởng thời điểm hiển thị. Provider chấp nhận thông báo không chứng minh điện thoại đã hiển thị. Chưa xác nhận push thật của **bản web mới này** trên iPhone/Samsung. Cần cấu hình domain, SQL và thử khóa máy / đóng app / bấm thông báo trước khi nghiệm thu.

## Kiểm tra

```powershell
npm --prefix apps/api test
cd apps/web
npm test
npm run build
```

Test API Node dùng SQLite riêng, không truy cập SQL công ty. Kiểm tra SQL thật chỉ chạy riêng bằng test/sql-smoke.ts và dữ liệu thử được rollback. Xem [kết quả kiểm tra](docs/verification.md), [kiến trúc](docs/architecture.md).

Tham khảo triển khai: [Samsung Web Push](https://developer.samsung.com/browser/android/web-developer-guide.html), [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [web-push](https://github.com/web-push-libs/web-push).
