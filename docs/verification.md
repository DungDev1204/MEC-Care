# Kết quả kiểm tra — Web/PWA 07/10/2026

- `dotnet test tests/api -c Release`: **27/27 pass**. Bao gồm quyền owner hồ sơ/ảnh/lịch, search không dấu, phone duplicate, annual/leap-day, chăm sóc + followup, SQLite bền vững, cookie HttpOnly/Secure/SameSite, logout thu hồi đăng ký, từ chối Origin khác, allowlist push, từ chối public key sai, đăng ký idempotent, lịch chung riêng từng owner, retry worker, gửi một lần, payload không lộ chi tiết khách và phiên hết hạn không gửi. Test transport thực qua HTTP handler xác nhận mã hóa `aes128gcm`, VAPID và TTL; không gửi đến vendor thật. Hai bài mới xác nhận sửa hồ sơ/session theo owner, chuẩn hóa điện thoại, dữ liệu sai/unauth; ZIP gồm đúng quan hệ và bytes ảnh/checksum, không lộ owner khác/credentials, tùy chọn bỏ ảnh và lỗi khi thiếu ảnh.
- `npm test` trong `apps/web`: **5/5 pass**. Search tiếng Việt, tuổi, UTC+7 trên thiết bị timezone khác, initials Review, deep-link return an toàn.
- `npm run build`: TypeScript và Vite production build thành công.
- `scripts/build-web.ps1`: chuẩn bị frontend vào `apps/api/wwwroot` để chạy/publish cùng API.
- `dotnet build apps/api` và `dotnet publish apps/api -c Release -o artifacts/web-app`: thành công, không cảnh báo/lỗi. Bản publish có web assets, không chứa cấu hình Local có secret.
- Dependency web audit ở thời điểm cài: **0 vulnerabilities**. Restore .NET không báo cảnh báo vulnerability.
- SQL migration `WebPushSubscriptions`, `EmployeePersonalInfo` và script SQL idempotent đã sinh. **Chưa thực thi trên SQL công ty**.
- Browser QA trên Chrome local: đăng nhập, tìm không dấu, thêm khách kèm xe, chăm sóc kèm followup, hồ sơ bốn tab, dời lần nhắc bằng bàn phím, màn hình tài khoản và thông báo tắt trong Review. Bố cục điện thoại không tràn ngang ở viewport 390×844 (375px nội dung sau scrollbar). Lỗi serializer trường vehicle id được phát hiện và sửa trong QA.
- Upload qua file chooser tự động bị Chrome extension từ chối vì chưa cấp quyền truy cập file URL. API ảnh được kiểm thử riêng; chưa xác nhận end-to-end upload/nén ảnh từ trình duyệt tự động trong phiên này.

## Rà UI sau phản hồi

- Đồng bộ ô nhập/ngày/chọn ở 46px; nút và chữ phụ có kích thước, độ tương phản thống nhất. Cửa sổ form giữ tiêu đề và nút lưu, chỉ cuộn vùng trường nhập.
- Chrome QA ở 320×740, 390×844, tablet 820×900 và desktop 1366×900: danh sách/thẻ khách, lịch, tài khoản, hồ sơ/tab ảnh và form khách/lời nhắc. Đã sửa `body min-width` gây tràn ngang khi scrollbar chiếm chỗ trên màn hình 320px.
- Đo DOM trên màn hình 320px sau sửa: chiều rộng nội dung bằng viewport 305px ở danh sách/thẻ, lịch và tài khoản; các dòng lịch không tràn. Form không tràn, nút lưu nằm trong viewport; ô input/select cao đều 46px trên desktop và điện thoại.
- Bộ lọc Đã mua xe hiển thị đúng 4/7 hồ sơ thử; toolbar đổi kiểu xem/sắp xếp được gom một hàng, bộ lọc nhỏ có thể cuộn ngang. TypeScript/Vite build thành công.
- Sau ảnh phản hồi dropdown: thay native select sắp xếp bằng combobox/listbox theo theme, hiển thị menu qua portal để không bị workspace cắt. Chrome QA xác nhận menu rộng 240px, nằm trong viewport 305px/375px ở màn hình 320px/390px; lựa chọn Cập nhật mới nhất/Lâu chưa liên hệ đổi đúng khách đầu danh sách. Mũi tên, Home/End, Enter, Escape hoạt động; Escape giữ focus ở combobox. Build/publish thành công.

## Menu avatar và cài đặt tài khoản

- Chrome QA desktop: avatar trên thanh trên mở đủ bốn mục; ba trang điều hướng đúng. Thông tin cá nhân có tên/điện thoại và email chỉ đọc; thông báo/PWA chuyển sang trang Cài đặt, Review vẫn tắt push thật.
- Màn hình 390×844 và 320×740: avatar trên cùng và tài khoản dưới màn hình đều mở menu; menu nằm trong viewport. Ở 320px, nội dung rộng 305px, menu từ thanh dưới có bounds x=12..293, y=360..665; không tràn ngang. Biểu mẫu cá nhân có input rộng 223px trong card.
- ArrowDown/ArrowUp mở và focus mục; Escape đóng, Home/End đổi mục; Tab đóng menu và tiếp tục thứ tự focus của trang. Chọn Đăng xuất mở dialog và chọn Ở lại đóng dialog, giữ phiên, focus quay về avatar.
- Nút tải ZIP trả về blob thành công và UI hiển thị Bản sao sẵn sàng. Browser automation không nhận sự kiện download; trang nội bộ lịch sử tải xuống Chrome bị chính sách URL chặn nên không kiểm tra được tệp trong thư mục tải qua browser. API test đã mở ZIP và xác minh đầy đủ nội dung/tệp ảnh.
- Review đang có dữ liệu cũ được nâng schema thêm trường nhân viên, không reset hồ sơ. Build mới cần migration `EmployeePersonalInfo` trước khi chạy trên SQL.

## Đồng bộ dialog sau phản hồi

- Thay toàn bộ `window.confirm` trong hồ sơ khách, ghi nhận chăm sóc, lịch nhắc và ảnh bằng `ConfirmationProvider` / `ConfirmationDialog`; đăng xuất dùng cùng component. Màu, font, bo góc, backdrop và nút theo theme web. Nút nêu hành động cụ thể, focus ban đầu ở lựa chọn giữ nội dung.
- Modal có ID tiêu đề/mô tả riêng cho mỗi instance, alertdialog cho xác nhận, giữ focus trong dialog bằng native top layer. Bộ đếm khóa cuộn giữ trang khóa khi xác nhận đóng nhưng form bên dưới vẫn mở; đóng hết trả focus về nút mở.
- Chrome QA đúng tình huống trong ảnh: nhập chăm sóc và chọn followup, đóng form mở xác nhận riêng của app; Tiếp tục chỉnh sửa / Escape giữ nguyên textarea và checkbox. Chỉ đổi kênh liên hệ bằng bàn phím cũng mở xác nhận, quay lại giữ kênh Nhắn tin. Bỏ thay đổi đóng cả form và xác nhận, bỏ khóa cuộn, trả focus về Ghi nhận.
- QA hồ sơ khách và lịch nhắc: bản nháp được giữ khi quay lại, bỏ thay đổi mới đóng. Dời lịch bằng bàn phím thực bảo vệ thời điểm vừa sửa. Hoàn thành/hủy lịch hiển thị nội dung đúng; chỉ thử lựa chọn quay lại/giữ lịch, không sửa các lần nhắc trong QA. Đăng xuất/Ở lại dùng cùng giao diện và trả focus về avatar.
- QA màn hình 320×740: dialog bounds x=17..303, y=177.8..562.2, scrollWidth bằng clientWidth 284px; nút cao 46px. Ở 390×844: bounds x=17..373, không tràn ngang. Tab chuyển tới nút Bỏ thay đổi; Escape chỉ đóng xác nhận, giữ form bên dưới.
- TypeScript/Vite build và 5/5 test web qua. Backend không thay đổi trong lần rà dialog này. Các luồng ảnh được rà mã và dùng chung component; không thử xóa ảnh thật trong browser.

## Hướng dẫn cài đặt có hình minh họa

- Trang Cài đặt luôn có nút Hướng dẫn cài đặt, kể cả khi đang mở ở chế độ ứng dụng. Khi Chrome cung cấp install prompt, Cài Clienté là nút riêng; hướng dẫn không tự mở hộp cài native. Hủy/lỗi prompt dẫn tới hướng dẫn thay vì chỉ hiện toast.
- Dialog có tab iPhone/iOS (Safari) và Android/Samsung (Chrome), bốn bước cùng bốn hình vector mô phỏng cho mỗi tab. Tổng cộng bảy cảnh minh họa gốc, dùng chung cảnh mở biểu tượng; nút cần bấm được đánh dấu. Không dùng ảnh chụp thiết bị giả hoặc tài nguyên ảnh ngoài.
- Nội dung được đối chiếu với [Apple](https://support.apple.com/vi-vn/guide/iphone/iphea86e5236/ios) và [Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=vi): Safari chia sẻ/thêm màn hình chính/bật dạng web app nếu có; Chrome menu cài đặt và tạo lối tắt/cài đặt, kèm tên mục ở phiên bản khác. Có nguồn chính thức, mẹo không thấy mục cài, mở từ trình duyệt ngoài ứng dụng, và bật lời nhắc sau cài. Review vẫn ghi rõ thông báo thật tắt.
- Chrome QA desktop: hai tab hiển thị đúng bốn hình và nội dung tương ứng. Mũi tên/Home/End chuyển tab và reset vùng cuộn về đầu; mẹo mở được và URL nguồn đúng. Tiêu đề, tab và nút Đã hiểu giữ vị trí, chỉ cuộn phần hướng dẫn.
- QA 390×844 và 320×740 không tràn ngang. 320px: dialog x=17..303, rộng trong 284px bằng scrollWidth; nút đóng cao 44px, nằm trong viewport. Escape đóng dialog, bỏ khóa cuộn và trả focus về Hướng dẫn cài đặt.
- Đây là kiểm tra nội dung và responsive trên Chrome desktop; chưa thực hiện cài PWA hoặc cấp quyền thông báo trên điện thoại thật trong lần này.

## Cần kiểm chứng ở môi trường triển khai

1. SQL Server: migrations và các luồng CRUD/ảnh/worker thật; test SQLite/InMemory không thay thế kiểm thử SQL.
2. Domain HTTPS, cấu hình VAPID với email vận hành, public/private key và bật worker. Private key đã tạo trong cấu hình Local bị ignore; không hiển thị hay commit.
3. Push thực trên iPhone và Samsung: khóa máy/đóng app, permission, bấm deep link, dời/hủy, đổi tài khoản. Provider accepted không chứng minh điện thoại hiển thị.
4. Chạy một worker. Retry có thể trùng nếu process dừng sau vendor chấp nhận nhưng trước SQL commit; chưa nghiệm thu nhiều worker.
5. Backup SQL + kho ảnh và phục hồi, quyền service account, dung lượng upload/proxy, theo dõi lỗi.

## Giới hạn rõ ràng

- Review dùng dữ liệu hư cấu, thông báo thật tắt; HTTP LAN không đủ cho PWA/push trên điện thoại.
- App cần mạng để xem/lưu; Service Worker chỉ giữ trang offline và icon, không cache hồ sơ hay ảnh. Chưa có ghi offline.
- Phiên hiệu lực 7 ngày; hết phiên cần đăng nhập lại và đồng bộ subscription. Logout ngừng push của phiên đó.
- Push phụ thuộc kết nối, browser vendor và thiết lập OS; không phải báo thức offline chính xác tuyệt đối.
- Bản web được xây tại workspace, chưa triển khai lên server công ty hay đưa dữ liệu khách lên dịch vụ hosting ngoài.
