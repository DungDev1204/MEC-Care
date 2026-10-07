# Xem web app trên iPhone / Samsung

Không còn dùng Expo Go hoặc development build native. Hai thiết bị mở cùng web app bằng trình duyệt.

## Review giao diện qua mạng LAN

Chạy API Review + Vite theo [hướng dẫn Review](review.md), kết nối điện thoại cùng mạng với máy phát triển. IP máy phát triển ở lần kiểm tra này là `172.20.235.186`.

Mở **http://172.20.235.186:8081** bằng Safari trên iPhone hoặc Chrome/Samsung Internet. API được proxy trên cùng cổng; điện thoại không cần cấu hình địa chỉ API riêng. IP có thể đổi: xem `ipconfig` và dùng IPv4 mạng đang kết nối. Đây không phải IP SQL Server.

Nếu dùng bản build cùng API thay vì Vite: mở **http://172.20.235.186:5180** sau khi build và khởi động lại API.

Máy phát triển phải bật, tiến trình phải chạy. Nếu không vào được, kiểm tra cùng mạng, mạng khách có cách ly thiết bị không, và quy tắc Firewall hiện có. Dự án không tự thay đổi Firewall. `/health` trên cổng5180 giúp kiểm tra API.

HTTP qua IP LAN chỉ để kiểm tra bố cục và thao tác. Service Worker / cài đặt PWA / Web Push cần **HTTPS** trên điện thoại.

## Khi triển khai HTTPS

- **iPhone (iOS 16.4+):** Safari → Chia sẻ → Thêm vào Màn hình chính → mở Clienté từ biểu tượng → đăng nhập → Tài khoản → Bật thông báo.
- **Samsung:** Chrome hoặc Samsung Internet → mở domain HTTPS → đăng nhập → cấp quyền thông báo ở Tài khoản. Dùng menu Cài ứng dụng / Thêm vào màn hình chính để mở như app.
- Mỗi thiết bị đăng ký riêng. Không làm phiền, quyền trình duyệt và kết nối mạng ảnh hưởng việc nhận. Phiên hết hạn sau 7 ngày: đăng nhập lại và kiểm tra thông báo.

Kiểm thử push thật: đặt nhắc gần hiện tại, khóa máy/đóng web, nhận thông báo, bấm mở đúng khách/lần nhắc; thử từ chối quyền, dời/sửa/hủy, đăng xuất và đổi tài khoản. **Bản web mới chưa được kiểm tra push thật trên hai điện thoại trong lần chuyển đổi này.**
