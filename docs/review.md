# Xem bản web Review

Bản Review dùng SQLite riêng, dữ liệu hư cấu, không kết nối SQL công ty. Khi khởi động lại giữ hồ sơ và ảnh đã lưu. Thông báo thật luôn tắt.

## Chạy bản build trên một cổng

Tại thư mục gốc, cài dependency lần đầu rồi chạy:

```powershell
npm --prefix apps/api ci
npm --prefix apps/web ci
npm run build
npm run review
```

Mở **http://localhost:5180**. Một tiến trình phục vụ cả giao diện và API. Nếu đã cài dependency thì các lần sau chỉ cần build rồi chạy Review. Dừng tiến trình cũ bằng Ctrl+C trước khi chạy lại.

## Frontend tự cập nhật khi phát triển

Khi cần Vite cập nhật giao diện ngay lúc sửa mã, mở hai terminal tại thư mục gốc. Terminal 1:

```powershell
npm run review
```

Terminal 2:

```powershell
npm --prefix apps/web run dev
```

Mở **http://localhost:8081**; Vite proxy API sang 5180. Cách này dùng hai cổng để phát triển; bản build thông thường dùng một cổng 5180.

## Tài khoản

| Email | Mật khẩu | Dữ liệu |
| --- | --- | --- |
| review@clientstudio.local | Review123! | Sáu khách hư cấu ban đầu, cộng hồ sơ bạn đã thêm |
| review2@clientstudio.local | Review123! | Một khách hư cấu riêng |

Màn hình đăng nhập Review có nút **Điền tài khoản thử**. Không dùng mật khẩu SQL. Cookie giữ phiên qua tải lại/đóng tab trong 7 ngày; Đăng xuất thu hồi phiên. Trên giao diện có nhãn REVIEW.

## Luồng kiểm tra

1. Đăng nhập → danh sách khách, tìm tên không dấu / dòng xe / biển số, lọc và đổi chế độ xem.
2. Mở từng khách và bốn tab; chỉnh sửa hồ sơ, nhiều xe, ngày sinh, avatar, ghi chú.
3. Thêm khách cùng điện thoại: cần xác nhận riêng để lưu hồ sơ khác.
4. Chọn nhiều ảnh, xem lớn, sửa mô tả, xóa có xác nhận.
5. Ghi nhận chăm sóc, chọn thời điểm thực tế, hẹn lần tiếp theo; tải lại và kiểm tra bền vững.
6. Tạo nhắc một lần / annual, lead days, 29/02, dời / hoàn thành đúng lần / hủy chuỗi.
7. Lịch chung lọc hôm nay, 7 ngày tới, quá hạn; mở đúng hồ sơ.
8. Tài khoản hướng dẫn cài PWA và giải thích push tắt trong Review.
9. Đăng xuất, dùng tài khoản hai: không thấy dữ liệu của tài khoản một.

`/health` trả `{"status":"running","mode":"review","runtime":"node"}`. Dữ liệu và ảnh nằm trong `apps/api/review-data/`, bị ignore và không publish. Để dừng, Ctrl+C trong terminal. Mạng LAN xem [hướng dẫn điện thoại](review-phone.md); HTTPS và push production xem README.
