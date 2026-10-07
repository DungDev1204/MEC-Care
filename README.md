# Clienté · Web app / PWA

Không gian quản lý và chăm sóc khách hàng xe sang, dùng trên máy tính, iPhone và Samsung. **Ngày 07/10/2026, dự án chuyển hoàn toàn từ mobile Expo sang web/PWA.** Mã mobile và script build native đã được gỡ; backend nghiệp vụ, SQL và kho ảnh được giữ lại. Dependency mobile cũ không còn dùng nằm trong `artifacts/mobile-dependencies-legacy/` (không đưa vào Git).

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

Yêu cầu .NET 10 SDK và Node 22.12+ / 24 LTS tương thích Vite. Dữ liệu Review dùng SQLite riêng; thông báo thật tắt.

Terminal 1, tại thư mục gốc:

```powershell
dotnet run --project apps/api --launch-profile review
```

Terminal 2:

```powershell
.\scripts\start-review-web.ps1
```

Mở **http://localhost:8081**. Nút **Điền tài khoản thử** có trong màn hình đăng nhập Review. Tài khoản `review@clientstudio.local` / `Review123!` có sáu hồ sơ hư cấu ban đầu. Tài khoản `review2@clientstudio.local` cùng mật khẩu có dữ liệu riêng. Các thao tác thử được lưu bền vững trong `apps/api/review-data/`; không trộn với SQL công ty. Chi tiết: [Review](docs/review.md), [điện thoại](docs/review-phone.md).

## Build và triển khai cùng API

```powershell
.\scripts\build-web.ps1
dotnet publish apps/api -c Release -o artifacts/web-app
```

Script build tạo frontend trong `apps/api/wwwroot`; ASP.NET phục vụ cả web và API trên cùng domain. Bản Review cũng có thể mở ở **http://localhost:5180** sau khi build rồi khởi động lại API. Build/publish không triển khai lên máy chủ công ty và không chạy migrations trên SQL.

Production: dùng SQL Server 2019+ (server đã kiểm tra là SQL Server 2022), database riêng `ClientStudio`, HTTPS, thư mục ảnh bền vững và tài khoản service có quyền cần thiết. Cấp connection string qua secret hoặc `ConnectionStrings__SqlServer`; không đưa secret vào Git. `appsettings.Local.json`, Review data, `wwwroot` sinh từ build và artifacts bị ignore. File cấu hình Local không được publish: phải cấp cấu hình ở máy chủ.

IT xem [script SQL idempotent](docs/database.sql) hoặc chạy `dotnet ef database update --project apps/api` **sau khi chọn đúng database**. Migration `WebPushSubscriptions` bổ sung metadata đăng ký web; `EmployeePersonalInfo` thêm tên hiển thị và điện thoại nhân viên; không xóa hồ sơ. Cần áp dụng các migration này trước khi chạy bản API mới trên SQL. Tạo tài khoản nhân viên bằng `dotnet run --project apps/api -- --provision-user`.

## Web Push thật

```powershell
dotnet run --project apps/api -- --create-push-keys
```

Lệnh tạo cặp VAPID vào file Local bị ignore, không in private key; giữ nguyên khóa đã có. Đặt `Push:Subject` thành email vận hành dạng `mailto:...`, cấp PublicKey / PrivateKey qua secret ở máy chủ rồi bật `Push:Enabled=true`. Không đổi cặp khóa sau khi người dùng đăng ký nếu chưa có kế hoạch đăng ký lại.

Không còn Expo, APNs signing, Firebase project hoặc bản IPA/APK. Chrome/Samsung Internet và Safari PWA dùng Web Push tiêu chuẩn. iPhone cần iOS 16.4+, Safari → Thêm vào Màn hình chính → mở từ biểu tượng → Bật thông báo. Samsung dùng Chrome hoặc Samsung Internet qua HTTPS, cấp quyền thông báo. `/api/push/config` chỉ trả public key và trạng thái.

Worker xử lý mỗi 15 giây, lưu công việc và retry trong SQL, vô hiệu đăng ký bị dịch vụ trả 404/410. Chạy **một worker** trong giai đoạn hiện tại. Thông báo màn hình khóa dùng nội dung chung; bấm vào mới mở hồ sơ có đăng nhập. Phiên có hiệu lực 7 ngày: đăng nhập lại sau khi hết hạn và kiểm tra đăng ký trong Tài khoản. Khi đăng xuất hoặc phiên hết hạn, thiết bị của phiên không còn nhận push. HTTP qua IP LAN chỉ để review giao diện, không dùng kiểm thử PWA/push.

Push cần mạng, quyền thông báo và server hoạt động; Không làm phiền / tiết kiệm pin có thể ảnh hưởng thời điểm hiển thị. Provider chấp nhận thông báo không chứng minh điện thoại đã hiển thị. Chưa xác nhận push thật của **bản web mới này** trên iPhone/Samsung. Cần cấu hình domain, SQL và thử khóa máy / đóng app / bấm thông báo trước khi nghiệm thu.

## Kiểm tra

```powershell
dotnet test ClientStudio.sln
cd apps/web
npm test
npm run build
```

Chạy test .NET khi tiến trình API dùng cùng output đã dừng, hoặc dùng `dotnet test -c Release` nếu đang preview Debug. Test dùng InMemory và SQLite riêng, không truy cập SQL công ty. Xem [kết quả và giới hạn kiểm tra](docs/verification.md), [kiến trúc](docs/architecture.md).

Tham khảo triển khai: [Samsung Web Push](https://developer.samsung.com/browser/android/web-developer-guide.html), [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Lib.Net.Http.WebPush](https://github.com/tpeczek/Lib.Net.Http.WebPush).
