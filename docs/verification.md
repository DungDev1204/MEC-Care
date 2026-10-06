# Tình trạng kiểm tra bản đầu

## Thương hiệu Clienté — 06/10/2026

- Đổi tên hiển thị thành **Clienté** trong giao diện, cấu hình Expo, tiêu đề web, lời xin quyền chọn ảnh và hướng dẫn review. Logo **É** trắng trên nền đen dùng chung hình học vector cho giao diện và bộ icon.
- Cập nhật icon 1024×1024, favicon, các lớp adaptive/monochrome Android và asset splash. Icon chính và nền Android không có pixel trong suốt; chữ và dấu sắc của lớp adaptive nằm trong vùng trung tâm để tránh bị cắt.
- Nguồn hình học: `apps/mobile/assets/brand-mark.json`; chạy `scripts/generate-brand-assets.ps1` trên Windows để tái tạo PNG và SVG. Không cần cài thêm dependency để sinh ảnh.
- TypeScript và lint đạt. Đã xem icon PNG và xác nhận tên/logo trên giao diện Review. Manifest iOS từ Metro sau khởi động lại trả đúng tên Unicode Clienté.
- Tên database, tài khoản review và định danh bundle/package hiện có được giữ để bảo toàn dữ liệu/cấu hình. Bộ icon/tên cài đặt mới sẽ được đưa vào lần build native tiếp theo; chưa tạo bản cài đã ký trong bước này.

## Thiết kế lại giao diện — 06/10/2026

- Cập nhật giao diện trực tiếp trong app: màn hình đăng nhập, danh sách khách với tìm kiếm/bộ lọc trạng thái, hồ sơ bốn tab, album ảnh, timeline chăm sóc, lịch nhắc và các form. Dùng chung màu sắc, typography, icon SVG, thẻ nội dung và trạng thái chọn có nhãn trợ năng.
- Giữ trang đầu là danh sách khách hàng. Thẻ khách thích ứng theo chiều rộng và cỡ chữ; các form chia nhóm thông tin và có vùng chạm rõ ràng.
- TypeScript và lint đạt; Expo Doctor 21/21 đạt sau khi thêm `react-native-svg` theo phiên bản SDK. Export JavaScript/Hermes iOS và Android thành công với mã giao diện cuối cùng; đây không phải IPA/APK đã ký.
- Kiểm tra bản Review trên trình duyệt ở chiều rộng 393 và 320 px: đăng nhập, lọc trạng thái/trạng thái rỗng, chuyển tab hồ sơ, album rỗng, timeline, mở form sửa khách, ghi nhận chăm sóc và lịch nhắc. Các ô nhập/ngày giờ của form khách và lịch nằm trong màn hình ở 320 px; trạng thái radio/tab được thể hiện qua ARIA. Xác nhận số điện thoại có sẵn hiển thị trong form sửa khách bằng ảnh chụp.
- Chưa xác nhận toàn bộ CRUD/ảnh hoặc giao diện native trên điện thoại thật. Các thao tác kiểm tra giao diện lần này không lưu/sửa dữ liệu khách hay lịch nhắc. Không kết nối SQL Server trong lần thiết kế lại này.
- Mở `http://localhost:8081` trong Mobile Preview rồi tải lại để review giao diện mới; hướng dẫn khởi động vẫn ở [review-phone.md](review-phone.md).

## Bản Review cục bộ — 06/10/2026

- Profile `review` chạy API với SQLite riêng trong `apps/api/review-data/`, chỉ cho phép môi trường Development; tắt worker push. Không kết nối hoặc thay đổi SQL Server công ty trong bước này.
- 12 test đạt, gồm 11 test trước và một test SQLite: tạo dữ liệu mẫu không trùng khi khởi tạo lại, đăng nhập/đọc phiên từ database, giữ dữ liệu qua các HTTP client và DbContext riêng, ghi nhận chăm sóc, hoàn thành annual với `CompletedAt` rồi giữ các năm tiếp theo, giới hạn quyền theo nhân viên và thu hồi phiên khi đăng xuất.
- TypeScript và lint đạt. Model SQL Server không thay đổi so với migration đã có (`has-pending-model-changes --no-build`).
- API Review khởi động thực tế, `/health` trả `mode: review`; trình duyệt đăng nhập và tải danh sách khách mẫu thành công. Đã bổ sung phần tương thích web cho ngày giờ, phiên đăng nhập, hộp thoại xác nhận và ảnh có xác thực. Chưa xác nhận toàn bộ CRUD/ảnh qua giao diện hoặc trên điện thoại thật.
- Lần build test dùng `UseAppHost=false` khi API đang chạy có cảnh báo không xóa được exe bị khóa; build DLL và toàn bộ test vẫn thành công.
- Xem [hướng dẫn chạy và các thao tác review](review.md). SQLite Review không thay thế kiểm thử tích hợp SQL Server hoặc kiểm thử thông báo native.

Ngày: 06/10/2026. Đây là bằng chứng kiểm tra mã nguồn, chưa phải nghiệm thu sản phẩm trên thiết bị.

Đã chạy:

- API biên dịch, không có cảnh báo / lỗi biên dịch.
- 11 test API / lịch đạt: xác thực, dữ liệu nhân viên độc lập, kiểm tra quyền ảnh, hai khách trùng tên, tìm tên không dấu / biển số, trùng điện thoại cần xác nhận, hoàn thành annual giữ năm sau, lịch chăm sóc tiếp theo, dữ liệu đầu vào thiếu/null, tuổi và ranh giới sinh nhật, 29/02 và quy đổi múi giờ Việt Nam.
- TypeScript và lint không có lỗi ở lần kiểm tra sau khi sửa.
- Expo Doctor: 21/21 đạt.
- Đóng gói JavaScript/Hermes cho iOS và Android thành công. Không tạo IPA/APK đã ký.
- Sinh EF migration và script SQL idempotent; chưa chạy trên SQL công ty.

Các test tích hợp dùng EF InMemory, chỉ để kiểm tra hành vi HTTP/quyền. Chưa kiểm tra trên SQL thật: SQL translation, ràng buộc khóa ngoại, upload sau khởi động lại, tranh chấp rowversion, worker / lease / retry và khôi phục backup.

Chưa kiểm tra trên điện thoại: hiển thị các màn hình và bàn phím, photo picker / SecureStore, nhận push, chạm notification, khóa máy / nền / đóng app, nhiều thiết bị, chuyển tài khoản, ngày giờ/múi giờ trên thiết bị. Chưa có Apple signing / Firebase / Expo project ID để làm các bước này.

`npm audit` hiện báo 30 mục (20 high, 10 moderate), chủ yếu đi theo chuỗi dependency Expo / Metro / công cụ build, cùng `decode-uri-component` và `uuid`. Đã chạy cập nhật tương thích qua `npm audit fix`; các mục này vẫn còn. Registry hiện trả bản mới nhất `braces=3.0.3` và `node-forge=1.4.0`, vẫn nằm trong vùng cảnh báo. Công cụ gợi ý force về Expo 44 hoặc thay Router 58, không phải bản sửa tương thích với bộ SDK 57 đã chọn. Chưa áp thay đổi major/override chưa kiểm thử; cần giải quyết và đánh giá lại trước production. Không tuyên bố dependency audit sạch.

Không deploy server, không gửi cloud build và không mua dịch vụ trong lần làm này.

## Cập nhật kết nối SQL — 06/10/2026

- Cổng TCP 1433 của máy chủ do người dùng cung cấp truy cập được từ máy phát triển.
- Đã đăng nhập SQL Authentication thành công và đọc metadata trong `master`: SQL Server 2022, version `16.0.4215.2`, `Developer Edition (64-bit)`.
- Database `ClientStudio` chưa tồn tại. Chưa tạo database, chạy migrations hoặc thay đổi dữ liệu trên máy chủ công ty.
- Kết nối có kiểm tra chứng chỉ bị lỗi chuỗi chứng chỉ không được tin cậy. Lần chẩn đoán thành công sử dụng `TrustServerCertificate=true`, vẫn giữ mã hóa. API cho phép tùy chọn này **chỉ trong Development**; cấu hình mặc định vẫn kiểm tra chứng chỉ.
- Thông tin đăng nhập chỉ ở `apps/api/appsettings.Local.json`, được bỏ qua bởi Git và loại khỏi output/publish. Không lưu mật khẩu trong tài liệu hoặc mã công cụ chẩn đoán.
- Công cụ `tools/sql-probe` chỉ đọc phiên bản và metadata database, không tạo database, bảng hay tài khoản.

Developer Edition dùng cho phát triển/kiểm thử; cần phiên bản phù hợp khi đưa vào production theo [tài liệu Microsoft](https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2022).
