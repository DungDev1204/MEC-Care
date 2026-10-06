# Quyết định kiến trúc — 06/10/2026

Đã xác nhận từ người dùng: iPhone là thiết bị chính, vẫn hỗ trợ Android; nhiều nhân viên và dữ liệu riêng; SQL Server nằm trên máy chủ công ty; SSMS 19 đang được sử dụng. Kiểm tra trực tiếp xác nhận engine SQL Server 2022 (`16.0.4215.2`, Developer Edition), đăng nhập được bằng SQL Authentication. Database `ClientStudio` chưa tồn tại. Chưa có thông tin truy cập API từ điện thoại bên ngoài công ty.

Chọn React Native + Expo + TypeScript vì một codebase cho hai nền tảng, vẫn truy cập được photo picker, secure storage và thông báo hệ điều hành. Expo SDK 57 / React Native 0.86 theo template ổn định và các phiên bản tương thích do `expo install` chọn.

Chọn ASP.NET Core .NET 10 LTS + EF Core SQL Server để dùng SQL hiện có; API kiểm tra owner của từng customer và các bản ghi con. Điện thoại không lưu thông tin kết nối SQL. Backend chạy cạnh SQL hoặc trên máy có đường mạng nội bộ tới SQL, cung cấp HTTPS cho thiết bị qua phương án truy cập của IT.

Không xây CRM đại lý hay phân công khách. Tài khoản chỉ là ranh giới sở hữu dữ liệu. Cùng tài khoản dùng trên nhiều máy truy cập cùng dữ liệu qua server. Tạo tài khoản bằng CLI vận hành; giao diện quản trị ngoài phạm vi MVP.

Thông báo chọn lịch server + remote push, tránh lịch đã lưu cục bộ trên thiết bị bị lỗi thời khi nhân viên sửa từ thiết bị khác. Đánh đổi: cần mạng ở cả server và điện thoại, phụ thuộc APNs/FCM/Expo và các cài đặt OS. Chưa có chế độ local notification offline. Không dùng bộ đếm JavaScript để thay lịch hệ điều hành.

Reminder là lịch gốc; Occurrence là từng lần thực hiện. Lịch annual sinh các lần tương lai với khóa duy nhất (reminder, revision, thời điểm gốc). Hoàn thành hoặc dời một occurrence không hủy cả chuỗi. Sửa lịch tăng revision, hủy các lần chưa làm ở revision cũ. 29/02 bắt buộc quy tắc do người dùng chọn. Múi giờ IANA và wall time được giữ trong SQL, thời điểm thực thi được đổi sang UTC.

Delivery là công việc gửi tới một thiết bị cụ thể, có unique key, lease và retry. Trước gửi kiểm tra lại owner thiết bị, trạng thái lịch, occurrence và nhân viên. MVP triển khai một worker; chưa nghiệm thu xử lý nhiều worker / các trường hợp tranh chấp trên SQL thật.

Ảnh là file có tên UUID, không công khai thư mục ảnh. Metadata là SQL và endpoint đọc/xóa phải có owner. Khi mở rộng có thể thay kho file bằng object storage qua service riêng. Sao lưu phải bao gồm cả SQL và ảnh.

Các điểm còn phụ thuộc môi trường: SQL engine / compatibility level, domain HTTPS hoặc VPN, service account của API, certificate, Apple signing, Firebase, Expo project, thiết bị thử nghiệm, backup và monitoring. Không triển khai production hay dùng credentials chưa được cung cấp.
