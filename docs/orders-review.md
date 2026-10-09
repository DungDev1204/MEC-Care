# Review đăng ký gói, thanh toán và gia hạn

Bản này chưa triển khai lên `care.tranie-mua.io.vn`. Dữ liệu review nằm trong SQLite riêng, không chạy migration hay thay đổi dữ liệu SQL Server đang dùng.

## Mở review

Chạy `npm run build`, sau đó `npm run review` tại thư mục dự án. Mở http://localhost:5180/login trên máy chạy ứng dụng.

Review ứng dụng Admin riêng: http://admin.localhost:5180/admin?tab=device. Đăng nhập `review_admin` để xem biểu tượng khiên chữ A, mục **Ứng dụng & thông báo** và hướng dẫn cài iPhone/Android. Hai địa chỉ có phiên đăng nhập riêng. Địa chỉ `localhost` chỉ dùng để xem trên máy chạy review.

Các tài khoản mẫu đều có mật khẩu `Review123!`:

| Username | Mục đích |
| --- | --- |
| `review_admin` | Cấu hình ngân hàng, giá tháng, liên hệ admin và cộng đồng Telegram; tìm kiếm và duyệt đơn; xem chuông thông báo |
| `review_new` | Thử mua gói lần đầu, xem QR, báo chuyển khoản và chờ duyệt |
| `review_due` | Gói hết hạn hôm nay; đơn mẫu `DHREVIEW` chờ đối soát quá 10 phút |
| `review_buyer` | Xem đơn đã duyệt trong lần kiểm tra giao diện này |

Tài khoản, đơn hàng và trạng thái được giữ lại khi khởi động lại review. Chỉ sử dụng thông tin ngân hàng mẫu; không chuyển tiền thật.

## Luồng đã triển khai

1. Mỗi tài khoản có ID riêng 10 ký tự chữ hoa và số. Tài khoản cũ được bổ sung ID khi migration, giữ nguyên mật khẩu và dữ liệu.
2. Admin thiết lập ngân hàng, tài khoản, chủ tài khoản, giá gói 1 tháng và đường dẫn liên hệ admin (không bắt buộc). Đơn lưu lại thông tin tại thời điểm tạo, nên đổi giá, ngân hàng hoặc liên hệ không sửa đơn đang xử lý.
3. Người dùng tạo đơn có mã riêng, QR, số tiền và nội dung chuyển khoản gồm mã đơn + ID + username. Nội dung được chuẩn hóa và giới hạn 50 ký tự để dùng VietQR; username đầy đủ vẫn lưu trên đơn.
4. Bấm **Tôi đã chuyển khoản** chuyển đơn sang chờ đối soát, tạo thông báo cho admin và bắt đầu tính thời gian chờ. Sau 10 phút hiện hướng dẫn liên hệ với admin và cung cấp mã đơn. Đơn vẫn được giữ, quyền sử dụng chưa được cấp.
5. Admin kiểm tra giao dịch ngân hàng, ghi mã giao dịch và xác nhận đã đối chiếu. Duyệt thành công ghi nhận thanh toán và cấp thời hạn trong cùng một transaction. Duyệt lại hoặc dùng cùng mã giao dịch cho đơn khác bị chặn.
6. Có cách xử lý riêng cho chưa xác nhận tiền hoặc đã nhận tiền nhưng sai lệch. Đơn bị từ chối có thể được báo và kiểm tra lại. Không tự mở khóa tài khoản bị admin khóa.
7. Gia hạn mở từ 00:00 ngày hết hạn theo giờ Việt Nam, và tiếp tục mở sau khi hết hạn. Gia hạn sớm bị chặn ở cả giao diện và API. Gói tính theo tháng lịch và hết hạn cuối ngày; ngày cuối tháng được điều chỉnh sang ngày hợp lệ.
8. Admin có tìm kiếm theo mã đơn, ID, username; bộ lọc trạng thái đơn/thanh toán, ngày tạo và phân trang. Mục Người dùng có lọc Quản trị viên, Đang hoạt động, Chưa có gói, Hết hạn, Đã khóa, kết hợp tìm kiếm và phân trang. Người dùng chỉ xem và tìm đơn của mình, kể cả khi chưa có gói hoặc đã hết hạn. Chi tiết có ngày tạo, ngày ghi nhận tiền, ngày/người duyệt, thời hạn trước/sau và lịch sử.
9. Khi yêu cầu gói đang bật, tài khoản chưa có gói hoặc đã hết hạn đăng nhập vào thẳng `/subscription`, kể cả khi có đường dẫn trở lại được lưu từ lần trước. Khi được kích hoạt, trang này tự đưa người dùng vào phần mềm. Trang tài khoản và đơn mua vẫn có thể truy cập để theo dõi thanh toán.
10. Admin mở **Gói đăng ký** để bật/tắt **Yêu cầu đăng ký gói để sử dụng** rồi lưu. Khi tắt, tài khoản đang hoạt động và đã xác minh email sử dụng bình thường, không tạo đơn mua mới; đơn hiện có vẫn được xử lý. Bật lại yêu cầu gói còn hạn, giữ nguyên gói đã cấp và ngày hết hạn. Giao diện kiểm tra lại phiên mỗi 10 giây khi đang mở và khi quay lại ứng dụng; API áp dụng ngay ở yêu cầu tiếp theo.
11. Admin sửa đường dẫn Telegram tại **Cộng đồng**. Cuối trang người dùng có icon Telegram và nhãn **Tham gia góp ý phát triển Clienté**, kể cả tài khoản chưa có gói. Để trống và lưu để ẩn nút cộng đồng. Cấu hình cộng đồng độc lập với đường dẫn liên hệ admin trong mục Thanh toán.

## Thông báo

Admin có chuông và số thông báo chưa đọc trong ứng dụng. Bấm thông báo mở danh sách lọc đúng mã đơn.

Đã nối hàng đợi thông báo đơn hàng vào Web Push hiện có, có kiểm tra quyền admin, phiên đăng nhập và thiết bị, chống gửi lại và thử lại khi nhà cung cấp lỗi tạm thời. Khi triển khai thật cần bật Web Push của máy chủ, giữ nguyên VAPID keys hiện có, sau đó admin bấm **Bật thông báo trên thiết bị** và cấp quyền trình duyệt. Trên iPhone cần mở ứng dụng đã thêm vào Màn hình chính. Khả năng hiển thị và âm báo theo quyền/cài đặt hệ điều hành; chưa thêm âm thanh riêng.

Review tắt gửi Web Push thật. Nút **Thử thông báo** dưới chuông dùng thông báo cục bộ sau khi được cấp quyền; không chứng minh việc nhận push khi đóng ứng dụng.

Admin có bộ cài PWA riêng tên **Clienté Admin**, dùng hostname riêng, manifest/biểu tượng và service worker riêng theo origin. App mở thẳng trang đơn hàng. Tài khoản thường không đăng nhập được vào origin Admin; quyền API vẫn được kiểm tra trên máy chủ. Trong trang quản trị ở app Clienté hiện có, mục **Ứng dụng & thông báo** dẫn tới địa chỉ cài Admin, tránh cài nhầm app người dùng. Cấu hình và bước đưa lên điện thoại được ghi trong [admin-pwa.md](admin-pwa.md).

## Kiểm tra và bước triển khai sau review

- `npm test`: 56 API + 8 frontend, bao gồm quy tắc ngày, chống tạo/duyệt trùng, phân quyền, đối soát, mã giao dịch, hàng đợi thông báo, lọc trạng thái người dùng với tìm kiếm/phân trang, chuyển trang sau đăng nhập, lỗi lịch nhắc trên điện thoại, metadata/biểu tượng Admin theo hostname, chặn đăng nhập tài khoản thường trên Admin và mở đúng đơn từ push. Có 6 kiểm thử bật/tắt yêu cầu gói: áp dụng cho phiên hiện tại, giữ quyền và thời hạn đã cấp, lưu cấu hình qua khởi động lại, migration SQLite cũ, phân quyền, xử lý đơn cũ và nhắc lịch khi tắt yêu cầu gói. Có thêm 7 kiểm thử cộng đồng Telegram và liên hệ admin: lưu/ẩn/sửa link, phân quyền, kiểm tra đường dẫn, giữ các cài đặt khác, migration và dữ liệu đơn cũ.
- `npm run build`: thành công.
- Đã kiểm tra trực tiếp trong Chrome: tạo đơn, QR, báo chuyển khoản, chuông admin, mở từ thông báo, duyệt, hiển thị người duyệt và hạn `23:59:59 08/11/2026`; bố cục thanh toán ở 390 × 844.
- Đã kiểm tra trực tiếp trong Chrome luồng bật/tắt gói trên server thử riêng: tài khoản chưa có gói tự vào ứng dụng khi tắt, quay về đăng ký gói khi bật lại trong cùng phiên; trang đơn mua khi tắt không hiển thị tạo đơn mới. Không sửa database hay cấu hình production.
- Đã kiểm tra trực tiếp trong Chrome trên server thử riêng: admin lưu/sửa/xóa đường dẫn cộng đồng; icon Telegram và nhãn góp ý hiển thị đúng đường dẫn mới; chi tiết đơn chờ quá 10 phút có nút **Liên hệ với admin** và nhắc mã đơn.
- Đã kiểm tra cú pháp DDL mới trên SQL Server bằng `SET PARSEONLY`, xác nhận schema hiện tại không bị thay đổi. Chưa chạy migration và toàn bộ luồng đơn trên SQL Server production.
- Khi được yêu cầu public: tạo gói đã kiểm tra LF/checksum; sao lưu database/config/photos, chạy migration bổ sung bằng `--migrate-auth` với quyền phù hợp, bật/kiểm tra Web Push, kiểm tra Node + SQL health rồi mới dọn release/archive cũ theo `AGENTS.md`. Người dùng tự chạy sudo. Cần nhập ngân hàng và giá thật trước khi nhận thanh toán; đường dẫn liên hệ admin và cộng đồng là tùy chọn.
