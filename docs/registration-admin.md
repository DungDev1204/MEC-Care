# Đăng ký, OTP email và quản trị

Trang người dùng: `/register`, `/login`. Trang admin: `/admin` tại `https://care.tranie-mua.io.vn/admin`. Người dùng đã chọn giữ domain đang hoạt động này khi triển khai.

Luồng đăng ký: username 3–32 ký tự (chữ không dấu, số, `_`), email và mật khẩu ít nhất 6 ký tự → gửi OTP 6 số ngẫu nhiên → xác minh email → đăng nhập bằng username → đăng ký gói nếu admin đang bật yêu cầu gói, hoặc sử dụng ngay nếu đang tắt. Email dùng để xác minh tài khoản. OTP có hạn 10 phút, tối đa 5 lần thử; gửi lại cách nhau ít nhất 60 giây và không đặt lại số lượt thử. Phiên đăng ký hết hạn sau 30 phút, tối đa 5 lần gửi. Không trả OTP, password hash hoặc SMTP password qua API.

Tài khoản đã xác minh có thể đăng nhập và cập nhật thông tin cá nhân. Khi yêu cầu gói đang bật, người dùng có thể đăng ký gói 1 tháng; yêu cầu được lưu một lần và hiển thị cho admin. Chỉ tài khoản có quyền sử dụng còn hạn mới được truy cập khách hàng, ảnh, lịch chăm sóc, xuất dữ liệu và Web Push ở chế độ này. Hết hạn vẫn đăng nhập được để gia hạn. Sau khi admin kích hoạt, quyền mới tự cập nhật trong phiên hiện tại; người dùng cũng có thể bấm “Kiểm tra gói”.

Admin kích hoạt mặc định 1 tháng, có thể chọn 1–12 tháng. Gia hạn cộng từ ngày hết hạn nếu còn hạn, hoặc từ thời điểm hiện tại nếu đã hết hạn. Tháng được tính theo lịch, xử lý đúng ngày cuối tháng. Khóa tài khoản kết thúc mọi phiên, chặn đăng nhập và tắt các thiết bị thông báo.

Tài khoản cũ giữ mật khẩu và quyền truy cập hiện có; chưa áp thời hạn hàng tháng hồi tố. Migration cấp username từ phần trước `@` của email, thay ký tự không hợp lệ bằng `_`, thêm hậu tố nếu trùng và giữ username đã có. Admin xem username trong danh sách quản lý. Tài khoản admin thông thường nhận username `admin`; script triển khai in username thực tế. Đăng nhập bằng email vẫn được hỗ trợ cho tài khoản cũ. Những tài khoản đăng ký ở bản OTP trước đang chờ kích hoạt được chuyển sang đăng nhập được và chưa có gói.

Sau khi admin kích hoạt/gia hạn một tài khoản cũ, thời hạn bắt đầu được áp dụng. Script nâng cấp cấp quyền admin cho **tài khoản `admin@admin.com` đang hoạt động**, không tạo tài khoản hay đổi mật khẩu. Đăng ký công khai không được dùng địa chỉ này hoặc tự cấp quyền admin.

Admin có tìm kiếm/phân trang người dùng, kích hoạt/gia hạn/khóa, bật/tắt đăng ký tài khoản, quản lý yêu cầu gói và cài thời hạn mặc định. Thao tác được ghi vào `AdminAudit`. Cấu hình SMTP và Push vẫn nằm trong `.env` trên máy chủ. Chưa có thanh toán tự động, phục hồi mật khẩu hoặc thu tiền định kỳ.

## Bật/tắt yêu cầu gói đăng ký

Mở `/admin?tab=subscription`, chọn mục **Gói đăng ký**, thay đổi công tắc **Yêu cầu đăng ký gói để sử dụng**, rồi bấm **Lưu cài đặt gói**. Khi nâng cấp, mặc định giữ chế độ bật như bản hiện tại; admin có thể tắt để mở ứng dụng cho mọi tài khoản đang hoạt động và đã xác minh email.

- **Tắt:** người dùng chưa có gói hoặc đã hết hạn vẫn dùng khách hàng, ảnh, lịch chăm sóc, xuất dữ liệu và Web Push bình thường. Không tạo đơn mua gói mới; các đơn đã tạo vẫn xem, báo thanh toán và được admin xử lý.
- **Bật:** tài khoản chưa có gói hoặc đã hết hạn cần đăng ký/gia hạn để tiếp tục. Tài khoản đang có gói còn hạn, admin và tài khoản cũ có quyền không giới hạn vẫn sử dụng bình thường.
- Chuyển chế độ chỉ thay đổi yêu cầu truy cập, giữ nguyên các gói đã cấp, ngày hết hạn, dữ liệu và phiên đăng nhập. Thời hạn gói vẫn tính theo ngày hết hạn đã lưu. Tài khoản bị khóa hoặc chưa xác minh email vẫn bị chặn.

Cài đặt được lưu trong `SystemSettings.SubscriptionEnabled`, có hiệu lực ở API ngay từ yêu cầu tiếp theo. Giao diện tự kiểm tra phiên mỗi 10 giây khi đang mở và khi quay lại ứng dụng. Cài đặt này độc lập với bật/tắt đăng ký tài khoản mới. Mỗi thay đổi gói được ghi vào `AdminAudit` với action `subscription_settings`; cần migration `--migrate-auth` trước khi chạy bản mới trên SQL Server.

## Liên hệ admin và cộng đồng Telegram

Mục **Thanh toán** có trường **Đường dẫn liên hệ admin**, nhận đường dẫn HTTPS và không bắt buộc chọn dịch vụ liên hệ cụ thể. Người dùng thấy nút **Liên hệ với admin** trong các đơn cần hỗ trợ; hướng dẫn chờ đối soát nhắc cung cấp mã đơn. Để trống đường dẫn thì ẩn nút liên hệ. Các đơn đã tạo giữ nguyên đường dẫn hỗ trợ đã lưu cùng thông tin thanh toán.

Mở `/admin?tab=community`, vào mục **Cộng đồng** để nhập đường dẫn Telegram rồi bấm **Lưu đường dẫn cộng đồng**. Chấp nhận đường dẫn nhóm `https://t.me/ten_nhom` hoặc lời mời `https://t.me/+ma_moi`, `https://t.me/joinchat/ma_moi`. Khi có cấu hình, cuối trang người dùng hiển thị icon Telegram và dòng **Tham gia góp ý phát triển Clienté**, mở cộng đồng trong tab mới. Người dùng chưa có gói hoặc đã hết hạn cũng có thể tham gia. Xóa đường dẫn và lưu để ẩn nút.

Đường dẫn được lưu ở `SystemSettings.TelegramCommunityUrl`, mặc định trống và độc lập với cấu hình thanh toán, đăng ký tài khoản và yêu cầu gói. Cần migration bổ sung trước khi chạy bản mới trên SQL Server. Giao diện người dùng kiểm tra lại đường dẫn mỗi 30 giây và khi quay lại tab; thay đổi cộng đồng không sửa các đơn mua hoặc gói đã cấp.

## Thông báo toàn thể người dùng

Trang `/admin` có giao diện riêng, không có thanh bên hay thanh điều hướng khách hàng. Trong tab **Thông báo**, nhập tiêu đề (tùy chọn), nội dung tối đa 5.000 ký tự, thời gian bắt đầu và kết thúc theo giờ Việt Nam (UTC+7), rồi chọn **Gửi / lên lịch thông báo**. Thông báo áp dụng cho mọi tài khoản đã đăng nhập, kể cả chưa có gói hoặc hết hạn. Tài khoản tạo sau đó cũng nhận được thông báo đang trong thời gian hiển thị.

Thông báo xuất hiện trong dialog khi mở ứng dụng, chỉ trong khoảng `bắt đầu <= hiện tại < kết thúc`. Hệ thống kiểm tra lại khi quay vào app và mỗi phút trong lúc app mở; hộp thoại tự đóng khi hết hạn. Nếu có nhiều thông báo, lần lượt hiển thị từng thông báo. Nội dung là văn bản thuần, giữ xuống dòng.

**Đóng** chỉ ẩn trong lần mở app hiện tại. **Không hiện lại thông báo này** lưu lựa chọn theo tài khoản trên server, có hiệu lực cả sau khi đăng nhập lại hoặc đổi thiết bị và không ảnh hưởng thông báo mới. Admin có thể dừng một thông báo đã lên lịch/đang hiển thị; lịch sử và thao tác quản trị được giữ lại. Thông báo trong app không gửi email hay Web Push.

Bản này thêm bảng `Announcements` và `AnnouncementDismissals`; cần chạy migration trước khi đổi release. Script triển khai có sao lưu và kiểm tra database như các bản trước.

## Nâng cấp máy chủ hiện có

1. Sao lưu database MEC trước khi nâng cấp. CLI `--migrate-auth` của bản mới thêm cột/bảng/index, cấp quyền cho admin hiện có và gán username cho tài khoản cũ; có thể chạy lại. [auth-migration.sql](auth-migration.sql) là phần schema SQL cho SSMS, vẫn cần CLI để gán username.
2. Cập nhật `/etc/cliente/.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=robotics.gitlab.2fa@gmail.com`, `SMTP_FROM=robotics.gitlab.2fa@gmail.com`, `SMTP_PASS` là app password được cung cấp. Không đưa mật khẩu vào Git, archive hay tài liệu. Mã tự bỏ khoảng trắng trong app password. Giữ quyền file `root:cliente`, mode `0640`.
3. Đóng gói bằng `powershell -File scripts/package-ubuntu.ps1`. Script `deployment/upgrade-auth.sh` thực hiện sao lưu MEC bằng `COPY_ONLY` và kiểm tra checksum, sao lưu ảnh/cấu hình, chạy migration, xác thực SMTP rồi đổi release. Nếu thất bại trước khi bản mới qua kiểm tra health, script khôi phục release/cấu hình và trạng thái truy cập tài khoản khi quay về backend cũ. Khi bản mới chạy thành công, script tự xóa các release cũ theo yêu cầu người dùng; bản sao SQL và ảnh/cấu hình vẫn được giữ. Không tự phục hồi toàn database. Không dùng `update.sh` trước khi schema được nâng cấp.
4. Giữ domain `care.tranie-mua.io.vn` và route Cloudflare Tunnel hiện có tới `http://127.0.0.1:5180`; không cần đổi DNS. Router `/admin` dùng cùng domain với ứng dụng.
5. Đăng nhập tài khoản admin hiện có tại `/admin`. Đăng ký bằng một email bạn kiểm soát, xác minh OTP và đăng nhập bằng username với mật khẩu 6 ký tự. Kiểm tra trang chủ yêu cầu đăng ký gói, gửi yêu cầu, kích hoạt 1 tháng ở admin rồi bấm “Kiểm tra gói”. Kiểm tra khóa tài khoản chặn đăng nhập.

Ngoài SSMS, bản API mới có CLI nâng cấp, cần quyền DDL trên SQL:

```bash
cd /path/to/new-release
CLIENTE_ENV_FILE=/etc/cliente/.env node dist/server.js --migrate-auth
```

Service thường chỉ cần quyền đọc/ghi; không tự chạy migration khi khởi động. Không cấp thêm quyền DDL lâu dài cho tài khoản chạy ứng dụng.

Gửi Gmail dùng Nodemailer qua TLS cổng 465 và app password, theo [tài liệu Nodemailer](https://nodemailer.com/guides/using-gmail). Kiểm thử tự động dùng SMTP giả lập và SQLite riêng; không gửi email hay sửa MEC thật.
