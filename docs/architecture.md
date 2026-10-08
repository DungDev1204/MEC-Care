# Kiến trúc web/PWA — 08/10/2026

Frontend React + TypeScript + Vite; backend Node.js 24 + TypeScript + Express. SQL Server MEC và kho ảnh hiện có được giữ. Cấu hình duy nhất cho vận hành là .env; không cần runtime .NET.

Luồng triển khai: `Safari PWA / Chrome / Samsung Internet / desktop → HTTPS cùng domain → Node.js / Express → SQL Server + kho ảnh`. Frontend build vào `wwwroot`; deep link có fallback đến index, các đường dẫn `/api` và `/auth` không fallback. Dev dùng Vite proxy, không cần đưa URL SQL hoặc secret vào frontend.

Authentication dùng cookie HttpOnly, SameSite Strict, Secure ở production, thời hạn 7 ngày. Giữ Bearer cho test và API client hiện có. Các thao tác trình duyệt từ Origin khác bị chặn. Tài khoản và dữ liệu kiểm tra theo owner ở mọi endpoint, ảnh không public và không cache trong Service Worker. Session ID liên kết đăng ký push; đăng xuất disable thiết bị của phiên, worker chỉ gửi khi nhân viên và phiên còn hiệu lực. Khôi phục sau hết phiên yêu cầu đăng nhập; deep link từ thông báo được giữ trong URL login.

Web Push dùng VAPID và `web-push` với mã hóa `aes128gcm` (RFC 8291), thay hoàn toàn Expo Push. `Devices.PushToken` chứa SHA-256 của endpoint để giữ index nhỏ; Endpoint, P256dh, AuthKey và SessionId là metadata mới. Các endpoint push chỉ được phép trỏ đến dịch vụ browser vendor trong allowlist, tránh gọi URL nội bộ tùy ý. Frontend xin quyền bằng thao tác trực tiếp của người dùng, đăng ký Service Worker, lưu subscription ở API; iPhone cần standalone PWA. Public key công khai, private key chỉ ở cấu hình server. Khóa được tạo bằng CLI không in secret.

Lịch gốc và từng lần nhắc vẫn tách `Reminder` / `Occurrence`: annual giữ những lần năm sau khi hoàn thành một lần; sửa lịch tăng revision và hủy pending cũ. Dời một lần cập nhật NotifyAt và ScheduledAt, bỏ delivery cũ để gửi đúng giờ mới. Giờ lưu theo Asia/Ho_Chi_Minh, thời điểm thực thi UTC; form web giữ UTC+7 dù timezone thiết bị khác.

Delivery có unique key occurrence/device, lease, tối đa 5 lần retry. Worker recheck chủ sở hữu, lịch và phiên ngay trước gửi; payload không có tên/số điện thoại/nội dung riêng của khách. Provider accepted khác với đã hiển thị. Hiện dùng một worker; chưa nghiệm thu race đa worker, restart đúng lúc gửi có thể trùng thông báo. Thông báo đã được vendor nhận không thu hồi chắc chắn khi sửa/hủy sau đó.

Review là Development + SQLite trong `review-data/`, sample accounts, push tắt; nâng schema local theo hướng bổ sung mà không reset dữ liệu. Production vẫn SQL Server. Migration SQL mới thêm metadata push và hai trường hồ sơ nhân viên; không tự động chạy trên server công ty.

Menu avatar có ba đường dẫn `/account`, `/account/settings`, `/account/advanced` và đăng xuất qua dialog. `/api/account` chỉ đọc/sửa hồ sơ của owner trong phiên; email không đổi qua API này. Session trả tên hiển thị để avatar đồng bộ sau đăng nhập/tải lại.

`GET /api/account/backup?includePhotos=true|false` tạo bản xuất ZIP cá nhân. Các bảng được đọc trong transaction Serializable, lọc owner; SQL execution strategy retry trước khi tạo tệp. Bản xuất chứa dữ liệu, liên kết ID, ảnh đã lưu và SHA-256; không có PasswordHash, token, push credentials hay đường dẫn kho ảnh. File ZIP tạm có DeleteOnClose và được streaming từ API, không lưu bản xuất trong wwwroot. Nếu thiếu ảnh, API trả 409 thay vì tạo bản sao ảnh không đầy đủ; người dùng có thể xuất chỉ dữ liệu. Response no-store. Chưa có API nhập/khôi phục ZIP; bản xuất cá nhân không thay thế backup SQL và kho ảnh toàn hệ thống.

PWA có manifest và icon192/512, offline page không chứa hồ sơ, notificationclick mở đúng khách và lần nhắc. Service Worker không cache API, ảnh, credential hoặc trang hồ sơ; app cần mạng để xem/lưu. Font đóng gói local, không phụ thuộc CDN. Không có hàng đợi ghi offline hoặc báo thức local khi thiết bị mất mạng.

Frontend dùng `Modal` chung cho form, chọn khách, xem ảnh và `ConfirmationDialog` cho các xác nhận. `ConfirmationProvider` trả Promise<boolean>, chỉ cho một yêu cầu xác nhận hoạt động; `useDiscardChanges` bảo vệ bản nháp. Native `<dialog>` cung cấp top layer/focus trap, nội dung và nút do app render; không dùng `window.confirm`. ID aria riêng từng instance và bộ đếm khóa cuộn hỗ trợ xác nhận chồng lên form. Không xin quyết định từ người dùng trong dialog bằng nhãn OK/Cancel mặc định.

Phụ thuộc vận hành còn lại: domain HTTPS, SQL database/migrations, cấu hình VAPID email và keys, service account, thư mục ảnh bền vững, backup SQL + ảnh, monitoring và kiểm thử iPhone/Samsung.
