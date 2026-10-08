# Kiểm tra backend Node.js — 08/10/2026

## Giao diện gọn và thông báo admin

- 30 kiểm thử API và 7 kiểm thử frontend đạt; build TypeScript/Vite đạt. 5 kiểm thử mới xác nhận quyền admin, lịch hiển thị, người dùng chưa có gói, ẩn theo tài khoản giữa các phiên, gửi đồng thời không tạo bản ghi ẩn trùng, dừng thông báo và audit. Nội dung HTML được giữ như văn bản thuần; dữ liệu của người khác không bị thay đổi.
- Chrome QA trên database SQLite trong bộ nhớ: trang khách hàng có một tiêu đề và thanh tìm kiếm/lọc gọn; màn hình 390×844 hiển thị nhiều khách ngay khi mở app. Đã kiểm tra cả 320×740; chiều rộng nội dung bằng viewport và không tràn ngang. Admin không có sidebar hay thanh điều hướng khách hàng, có tab tạo/lên lịch thông báo và danh sách trạng thái.
- Đã tạo thông báo qua UI admin trong môi trường thử, đăng nhập tài khoản khác và thấy dialog. Nút Đóng cho phép thông báo xuất hiện lại khi tải lại app. Nút Không hiện lại lưu thành công và dialog không xuất hiện sau khi tải lại. Hộp thoại 390×844 hiển thị đầy đủ nội dung và các nút. Không tạo thông báo cho người dùng thật và không gửi email trong QA.
- Gói mới cần migration thêm hai bảng thông báo trên MEC trước khi đổi release. Tự dọn các release cũ chỉ chạy sau khi bản mới vượt qua health.

## Bản username và đăng ký gói

- 25 kiểm thử API và 7 kiểm thử frontend đạt; build TypeScript/Vite đạt. Bao gồm mật khẩu đúng 6 ký tự, username không phân biệt hoa/thường, xác minh OTP, tài khoản chưa có gói đăng nhập được, yêu cầu gói không trùng, admin kích hoạt, gia hạn sau hết hạn và khóa tài khoản. Tài khoản chưa có gói/hết hạn bị chặn API dữ liệu, ảnh, backup và Web Push; thông tin cá nhân vẫn truy cập được.
- Chrome QA với database SQLite trong bộ nhớ: đăng nhập username `pending`, gửi yêu cầu gói, admin thấy yêu cầu và kích hoạt 1 tháng, người dùng đăng nhập lại thấy trang khách hàng. Trang gói được xem ở desktop và 390×844, không tràn ngang và các nút đều truy cập được. Database thử không gửi email hoặc truy cập MEC thật.
- Kiểm tra rollback với SQLite: giữ nguyên trạng thái và mật khẩu tài khoản cũ, khóa lại tài khoản chưa có gói khi quay về backend cũ, kể cả tài khoản mới trong lần triển khai. Script triển khai tạo bản sao SQL `COPY_ONLY` có checksum cùng ảnh/cấu hình trước migration.
- Bản OTP/admin trước đang chạy ở `care.tranie-mua.io.vn`, service và Cloudflare Tunnel hoạt động. Gói username/đăng ký gói cần người vận hành chạy sudo để cập nhật release và schema. Các kết quả bên dưới thuộc những bản trước.

## Tự dọn release sau cập nhật

- Yêu cầu ngày 08/10/2026: mỗi lần cập nhật thành công chỉ giữ release đang chạy trên Ubuntu. `update.sh`, `upgrade-auth.sh` và `finish-setup.sh` gọi bước dọn tự động sau kiểm tra service/health; vẫn giữ bản trước khi cập nhật thất bại để rollback.
- 6 kiểm thử trên Ubuntu/Node 24 đạt, dùng thư mục thử riêng và giả lập service/health. Xác nhận không xóa khi HTTP health lỗi, JSON không hợp lệ, sai mode production, service còn chạy release trước hoặc current không đúng bản dự kiến. Khi health đạt, xóa hết thư mục release cũ, giữ bản hiện tại, cấu hình và đích của symlink bên ngoài.
- Chạy lại: `CLIENTE_CLEANUP_SCRIPT=/path/to/cleanup-old-releases.sh node --test scripts/test-ubuntu-cleanup.mjs` trên Linux. Kiểm thử không thao tác thư mục production.

- Backend TypeScript và frontend React build đạt. 13 kiểm thử API Node đạt, bao gồm đăng ký/đăng nhập, dữ liệu riêng theo owner, CRUD khách/xe, search, số điện thoại trùng, ảnh/avatar, backup ZIP, chăm sóc + followup, complete/snooze/cancel, lịch annual/29-02/DST, session/logout, forwarded HTTPS và allowlist Web Push.
- Đã tái hiện và sửa lỗi Node thoát với mã 0 khi CLI được gọi qua symlink của thư mục release. Kiểm thử regression chạy tiến trình thật qua liên kết, kiểm tra mã lỗi của lệnh không hợp lệ, việc ghi VAPID vào file tạm và HTTP health trên cổng thử được cấp tự động. HTTP test dùng SQLite Testing riêng, không truy cập SQL công ty. Script cập nhật in log service trước rollback nếu health thất bại.
- Frontend có 5 kiểm thử đạt. Trang đăng ký/đăng nhập đã xem trực tiếp trong Chrome; tài khoản Review cũ đăng nhập được và thấy 7 khách cùng lịch đã lưu.
- SQL Server MEC thật: schema và quyền đọc/ghi kiểm tra bằng test/sql-smoke.ts; có Unicode, GUID, date/datetimeoffset, foreign keys và conditional update. Toàn bộ dữ liệu smoke được rollback. Tin cậy chứng chỉ chỉ ghi đè tạm cho tiến trình chẩn đoán, .env giữ nguyên lựa chọn.
- Dữ liệu Review cũ được chuẩn hóa UTC ticks và GUID viết hoa sang kiểu Node dùng. Snapshot SQLite review.db.before-node được tạo trước chuyển đổi; không reset hồ sơ, ảnh hoặc mật khẩu.
- npm audit backend: còn 3 cảnh báo mức moderate qua mssql → tedious → sprintf-js; registry chưa có bản sprintf-js đã sửa. Không hạ mssql xuống bản 4 cũ theo gợi ý --force. Tedious dùng format nội bộ; không truyền format từ request của người dùng. Các cảnh báo high ban đầu trong rate limiter đã được xử lý bằng bản 8.7.1.
- Chưa chạy bản Node trên Ubuntu, chưa đổi Cloudflare route, chưa gửi push thật đến thiết bị. SQL kiểm thử chạy từ máy Windows; môi trường triển khai Node 24/Linux cần kiểm tra qua script update và health.

## Lịch sử kiểm tra UI trước khi đổi backend

Các mục bên dưới là kết quả QA giao diện trước đó, không phải toàn bộ xác nhận cho bản Node.

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
# 2026-10-08: modal scrolling and upload package retention

- Live verification: user supplied DEPLOYMENT_OK and the current release is `20261008T084400Z-auth-node`. Cliente and Cloudflare Tunnel are active; public health returns Node + SQL Server. Public HTML references `index-Vy_HOBGF.js` / `index-B-nP8M4A.css`; public CSS checksum matches the release. Only the current release and the newly deployed application upload archive remain.
- Production build and 7 existing frontend tests pass.
- Chrome QA with an isolated in-memory database: customer form at 1366x768 has a visible scrollbar; mouse scrolling reaches the Notes field while heading/actions remain fixed. At 390x844, keyboard End reaches all final fields without horizontal overflow. At 844x390, customer/reminder form actions remain inside the viewport and their field area scrolls.
- Created a fictional customer through the UI and verified the saved note from the end of the form. Closing the reminder dialog restores page scrolling (body lock removed, page scroll position changes).
- All 9 Linux cleanup tests pass. Healthy deployment removes old application packages and retains the uploaded current package. Failed health, running an older release, a mismatched frontend, or a symlinked upload path prevents deletion. Config, backup files and external symlink targets remain.
- Rollout uses the original uploaded archive path alongside the staged archive checksum. Old upload packages are removed only after the new release passes production health.
