# Clienté

**Review ngay, chưa cần SQL:** xem [hướng dẫn chạy bản Review](docs/review.md). Chế độ riêng này dùng SQLite cục bộ và hai tài khoản mẫu, tắt thông báo thật; chạy bằng profile `review`.

Ứng dụng chăm sóc khách hàng xe sang cho **iPhone và Android**. Sau đăng nhập mở trực tiếp danh sách khách. Mỗi nhân viên có dữ liệu riêng và có thể dùng cùng tài khoản trên nhiều điện thoại.

## Công nghệ đã chọn

- App cài trên điện thoại: React Native, Expo SDK 57, TypeScript và Expo Router.
- API: ASP.NET Core / .NET 10 LTS, Entity Framework Core.
- Cơ sở dữ liệu: SQL Server 2022 trên máy chủ công ty, đã kiểm tra đăng nhập thành công. **SSMS 19 là công cụ quản lý.** EF Core 10 dùng SQL Server 2019 trở lên theo tài liệu hiện hành.
- Ảnh: file trên ổ lưu trữ bền vững của máy chủ; SQL lưu ID, mô tả và tham chiếu. Ảnh chỉ được tải qua API có kiểm tra chủ sở hữu.
- Thông báo: máy chủ xử lý lịch, lưu công việc gửi trong SQL và gọi Expo Push Service → APNs cho iPhone / FCM cho Android. Không cần trang web đang mở để chạy lịch.

Sơ đồ kết nối: `iPhone / Android → API HTTPS → SQL Server + kho ảnh`.

API và app tách biệt; model xe tách khỏi khách, lịch lặp tách khỏi lần nhắc. MVP là một API có các module riêng, một tiến trình xử lý thông báo, thuận tiện mở rộng mà chưa cần microservices.

## Mã đã có

- Đăng nhập bằng tài khoản nhân viên, phiên lưu trong SecureStore; kiểm tra chủ sở hữu ở phía API.
- Danh sách khách, tìm tên không dấu / điện thoại / biển số, thêm và sửa, xác nhận trùng điện thoại.
- Hồ sơ 4 tab: thông tin, hình ảnh, chăm sóc và lịch nhắc; tuổi tính từ ngày sinh.
- Avatar riêng với album, chọn nhiều ảnh, nén và chuyển JPEG trên điện thoại, xem lớn / mô tả / xóa có xác nhận.
- Lịch sử chăm sóc, thời gian và kênh thực tế, hẹn lần tiếp theo; hoàn thành đúng lần nhắc nếu mở từ lịch.
- Thêm / sửa / hủy lịch, dời một lần, hoàn thành một lần; lịch hằng năm vẫn giữ các lần sau.
- Quy tắc 29/02 bắt buộc chọn 28/02 hoặc 01/03 trong năm không nhuận.
- Đăng ký điện thoại nhận push, mở đúng khách và lịch khi chạm thông báo; worker có retry, kiểm tra receipt, vô hiệu hóa token không còn đăng ký.
- EF migrations và [script SQL](docs/database.sql) cho database mới của app.

**Đây là mã nguồn bản đầu, chưa phải bản cài đã được nghiệm thu trên điện thoại.** Đã xác thực kết nối SQL công ty và đọc phiên bản; chưa có database `ClientStudio` và chưa chạy migrations. Chưa có cấu hình Apple / Firebase / Expo hoặc API HTTPS thật. Không có dữ liệu khách mẫu trộn với dữ liệu thật.

## Chạy API

Yêu cầu .NET 10 SDK. Từ thư mục gốc:

```powershell
dotnet tool restore
if (-not (Test-Path apps/api/appsettings.Local.json)) {
    Copy-Item apps/api/appsettings.Local.example.json apps/api/appsettings.Local.json
}
```

Nếu đã có `apps/api/appsettings.Local.json` được cấu hình, không chép đè file đó bằng mẫu. Sửa cấu hình cục bộ với tên máy chủ SQL và thư mục ảnh. Có thể dùng Windows Authentication nếu tài khoản chạy API được cấp quyền vào database. Nếu dùng SQL Authentication, giữ connection string trong cấu hình cục bộ, secret hoặc biến môi trường `ConnectionStrings__SqlServer`; không ghi mật khẩu vào git. Cấu hình cục bộ bị loại khỏi output/publish; khi triển khai phải cấp secret tại máy chủ. Dùng database riêng `ClientStudio`.

Máy chủ hiện có chứng chỉ chưa được máy phát triển tin cậy. `appsettings.Development.json` bật `SqlServer:TrustServerCertificateInDevelopment` để kiểm thử kết nối có mã hóa trong Development. Tùy chọn bị bỏ qua ở môi trường khác; khi triển khai cần chứng chỉ SQL hợp lệ/được tin cậy.

Kiểm tra chỉ đọc từ thư mục gốc, không thay đổi SQL:

```powershell
dotnet run --project tools/sql-probe -- --trust-server-certificate
```

Chỉ khi đã chọn đúng database của app và có quyền tạo bảng, thực hiện:

```powershell
dotnet ef database update --project apps/api
```

Hoặc IT xem và chạy script `docs/database.sql` trong database dành riêng cho app. Script tạo các bảng app, không phải script chuyển đổi hệ thống CRM có sẵn. Chưa có lệnh nào được chạy trên SQL Server công ty trong quá trình xây mã.

Tạo từng tài khoản nhân viên trên máy chạy API:

```powershell
dotnet run --project apps/api -- --provision-user
```

Lệnh hỏi email và mật khẩu tối thiểu 12 ký tự, không hiển thị mật khẩu. Không có đăng ký công khai. Phiên đăng nhập có hiệu lực 7 ngày. Có thể vô hiệu hóa nhân viên bằng trường `Employees.Enabled` trong database; cần quy trình quản trị tài khoản khi đưa vào sử dụng thật.

```powershell
dotnet run --project apps/api
dotnet publish apps/api -c Release -o artifacts/api
```

`/health` kiểm tra tiến trình API; không xác nhận rằng SQL và thông báo đang hoạt động. Chưa triển khai hoặc mở cổng trên máy chủ công ty.

## Chạy app và tạo bản cài

Yêu cầu Node.js 22 LTS trở lên tương thích SDK. Môi trường xây mã hiện dùng Node 25; kiểm tra lại với bản LTS của môi trường build khi triển khai.

```powershell
cd apps/mobile
npm ci
Copy-Item .env.example .env
```

Điền `EXPO_PUBLIC_API_URL` bằng địa chỉ API HTTPS mà điện thoại truy cập được. Không dùng `localhost` trên điện thoại để chỉ máy chủ công ty. Biến `EXPO_PUBLIC_*` là dữ liệu công khai trong bản cài, chỉ chứa URL và ID dự án, không chứa mật khẩu SQL hay khóa bí mật.

```powershell
npx expo start --dev-client
```

Native project được sinh từ config; không sửa thủ công thư mục `ios/` / `android/`. Dùng development build để kiểm tra đầy đủ, không lấy Expo Go làm bằng chứng nghiệm thu push.

Để build trên Windows cho iPhone, có thể dùng EAS Build chạy trên máy macOS của dịch vụ. Cần tài khoản Expo và cấu hình ký Apple; không tự mua dịch vụ hoặc gửi bản build lên cloud trong lần xây mã này.

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

Đăng ký iPhone thử nghiệm trước khi build nội bộ. SDK 57 hướng tới iOS 16.4+; xác nhận phiên bản hệ điều hành của iPhone thực tế. Bundle ID tạm `vn.clientstudio.care` cần kiểm tra và đổi theo định danh công ty trước khi tạo credentials.

## Cấu hình và giới hạn thông báo

1. Có Expo project ID (`eas init` hoặc `EXPO_PUBLIC_EAS_PROJECT_ID`).
2. Cấu hình APNs / tài khoản Apple Developer cho iOS, FCM v1 / Firebase cho Android theo tài liệu Expo.
3. API được phép kết nối outbound HTTPS đến Expo. Bật `Push:Enabled=true` chỉ sau khi database và credentials đã sẵn sàng. Nếu bật bảo vệ push token trên Expo, đặt secret `Push:AccessToken` ở máy chủ.
4. Chạy **một** worker/API instance với `Push:Enabled=true`; các API instance khác tắt worker. Trước khi chạy nhiều worker cần phối hợp phần tạo occurrence / delivery và kiểm thử tranh chấp trên SQL thật.
5. Nhân viên vào Tài khoản → Bật thông báo. Từ chối quyền vẫn cho lưu lịch. Mỗi thiết bị đăng ký riêng; dùng cùng tài khoản trên nhiều máy sẽ nhận trên các máy đã bật thông báo.

Worker kiểm tra lịch mỗi 15 giây, có retry hữu hạn và trạng thái gửi lưu trong SQL. Receipt xác nhận phía dịch vụ nhận, không phải bằng chứng người dùng đã thấy thông báo. Push cần mạng, máy chủ đang hoạt động và quyền thông báo; Tập trung / Không làm phiền, trạng thái ứng dụng và chính sách tiết kiệm pin có thể ảnh hưởng. Không hứa nhắc tuyệt đối chính xác mọi tình huống.

Sửa/hủy lịch ngăn các công việc chưa gửi theo trạng thái mới. Thông báo đã được chuyển sang APNs/FCM hoặc đã hiển thị không thể thu hồi chắc chắn từ máy chủ; có thể có giao nhau nếu sửa đúng lúc đang gửi. Nếu tiến trình bị ngắt sau khi dịch vụ nhận nhưng trước khi ghi trạng thái SQL, retry có thể tạo thông báo trùng. Cần kiểm thử các tình huống này trên thiết bị mục tiêu.

App hiện cần mạng để đọc và lưu dữ liệu; dữ liệu lưu bền vững trên server. Chưa có hàng đợi ghi offline. Lịch nhắc vẫn được xử lý ở server khi app không mở.

## Kiểm tra

```powershell
dotnet test ClientStudio.sln
cd apps/mobile
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform ios --platform android
```

Kiểm tra API dùng **EF InMemory chỉ trong test**, không thay thế lưu dữ liệu thật. Cần chạy migrations và các luồng CRUD / ảnh / worker trên SQL Server công ty trước nghiệm thu. Export là kiểm tra đóng gói JavaScript/Hermes cho hai nền tảng, không phải file IPA/APK đã ký.

Trước bàn giao sử dụng thật: kiểm tra trên iPhone và Samsung, thông báo khi khóa máy / nền / đóng app, chạm mở đúng lịch, từ chối quyền, sửa / hủy / dời lịch, đổi tài khoản trên cùng điện thoại, đóng mở app và khôi phục dữ liệu từ backup.

Sao lưu SQL **và** thư mục ảnh, kiểm tra khôi phục cùng nhau. Không dùng thư mục tạm của container cho ảnh. Giới hạn ảnh server là 10 MB / file, nhận JPEG / PNG / WebP; client chuyển ảnh chọn thành JPEG tối đa cạnh 1800 px. Khi chạy thật cần cấu hình giới hạn upload tương ứng ở reverse proxy và kiểm tra dung lượng ảnh.

Xem [tình trạng kiểm tra và các việc còn thiếu](docs/verification.md), bao gồm các cảnh báo dependency còn phải xử lý trước production.

## Tham khảo

- [Đặc tả gốc](Yeu_cau_app_quan_ly_khach_hang_xe_sang_Codex.md)
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo Push reliability / receipts](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Microsoft SQL Server provider](https://learn.microsoft.com/ef/core/providers/sql-server/)
- [.NET support](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core)
- [Travel Mobile App](https://dribbble.com/shots/24911825-Travel-Mobile-App): đọc được mô tả đen–trắng tối giản; chưa xem được ảnh thiết kế gốc qua công cụ. UI triển khai theo mô tả đặc tả, không khẳng định sao chép chính xác mẫu.
