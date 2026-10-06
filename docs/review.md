# Chạy bản Review trên máy hiện tại

Để mở giao diện native trong **Expo Go trên iPhone/Samsung**, xem [hướng dẫn mở app trên điện thoại](review-phone.md).

Bản Review dùng SQLite cục bộ, chưa kết nối SQL Server công ty. Khi chuyển sang kiểm thử tích hợp SQL, dùng SQL Server 2022 Developer Edition đã kiểm tra ở bước trước. Hiện tại không cần mở SSMS, tạo database hay chạy `database update`.

## 1. Chạy bằng hai terminal PowerShell trong VS Code

Máy hiện tại đã có .NET SDK, Node và các dependency. Nếu đang có bản Review chạy sẵn, mở đường dẫn ở bước 2; không chạy thêm tiến trình trùng cổng.

Terminal thứ nhất — chạy API:

```powershell
cd D:\MEC-Care
dotnet run --project apps/api --launch-profile review
```

Giữ terminal mở. Chờ dòng `Now listening on: http://0.0.0.0:5180`.

Terminal thứ hai — chạy giao diện:

```powershell
cd D:\MEC-Care
.\scripts\start-review-mobile.ps1
```

Giữ terminal này mở. Nếu PowerShell chặn script do execution policy, chạy script trong một tiến trình riêng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-review-mobile.ps1
```

Lệnh này chỉ áp dụng cho tiến trình chạy script, không đổi execution policy của máy.

## 2. Mở và đăng nhập

Trên máy tính mở **http://localhost:8081**. Phía trên màn hình phải có dòng **REVIEW**.

| Tài khoản thử | Mật khẩu | Dữ liệu riêng |
| --- | --- | --- |
| `review@clientstudio.local` | `Review123!` | Nguyễn Minh Anh · Mẫu |
| `review2@clientstudio.local` | `Review123!` | Lê Quang Huy · Mẫu |

Đây là tài khoản và hồ sơ hư cấu dành cho review. Không dùng mật khẩu SQL để đăng nhập app. Đóng tab sẽ kết thúc phiên lưu trên trình duyệt; hồ sơ vẫn còn trên API.

## 3. Review trên iPhone hoặc Samsung

Kết nối điện thoại vào cùng mạng nội bộ với máy đang chạy API. Trên iPhone dùng Safari, trên Samsung dùng Chrome, mở:

**http://172.20.235.186:8081**

Đây là IP hiện tại của **máy phát triển**, không phải IP SQL Server. Máy phát triển phải bật và hai terminal phải đang chạy. Nếu IP thay đổi, dùng `ipconfig` để tìm IPv4 của card mạng đang dùng và thay IP trong đường dẫn.

Nếu máy tính mở được nhưng điện thoại không vào được, thử **http://172.20.235.186:5180/health** trên điện thoại. Kết quả đúng là `{"status":"running","mode":"review"}`. Nếu không truy cập được, kiểm tra cùng mạng, mạng khách có cách ly thiết bị hay không, và quy tắc Windows Firewall cho Node/API trên mạng nội bộ. Dự án chưa tự thay đổi firewall.

Review trên trình duyệt điện thoại giúp kiểm tra giao diện và các thao tác. Để đánh giá bản cài native, SecureStore, photo picker và thông báo khi khóa máy, cần development build ở bước tiếp theo. Expo Go chỉ dùng được khi phiên bản trên điện thoại tương thích SDK 57 của dự án; không cần cài Expo Go để review bằng đường dẫn này.

## 4. Các thao tác nên thử

1. Mở hồ sơ mẫu và xem bốn tab: thông tin, hình ảnh, chăm sóc, lịch nhắc.
2. Thêm một khách thử, sửa thông tin xe, ngày sinh, ghi chú; thử tìm tên không dấu hoặc biển số.
3. Thêm ảnh đại diện và ảnh album, mô tả ảnh và xem ảnh lớn.
4. Ghi nhận chăm sóc bằng gọi điện/tin nhắn/gặp mặt, hẹn lần tiếp theo.
5. Tạo lịch nhắc một lần và hằng năm; thử dời hoặc hoàn thành một lần nhắc.
6. Vào Tài khoản → Đăng xuất, đăng nhập tài khoản thứ hai để xem dữ liệu tách riêng.

Thông báo thật bị tắt trong Review. Chỉ nhập dữ liệu hư cấu khi thử.

## 5. Dừng và chạy lại

Nhấn **Ctrl+C** trong mỗi terminal để dừng. Chạy lại hai lệnh ở bước 1 khi cần.

Dữ liệu nằm ở `apps/api/review-data/review.db`, ảnh ở `apps/api/review-data/photos/`; cả thư mục bị bỏ qua bởi Git và output/publish. Chạy lại giữ các thay đổi đã lưu, không tạo trùng hồ sơ mẫu. SQLite chỉ phục vụ Review; bước kiểm thử tích hợp SQL Server và thông báo vẫn cần thực hiện riêng.

Nếu thiết lập trên một máy khác, cài .NET 10 SDK và Node phù hợp Expo SDK 57, chạy `dotnet restore ClientStudio.sln` và `npm ci` trong `apps/mobile`, sau đó làm theo bước 1.
