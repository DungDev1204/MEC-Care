# Đặc tả app quản lí và chăm sóc khách hàng xe sang

**Phiên bản:** 1.0 — 06/10/2026  
**Mục đích:** Giao tài liệu này cho Codex để xây dựng ứng dụng đúng yêu cầu đã thống nhất.  
**Người dùng chính:** Một nhân viên bán xe Mercedes-Benz; thiết kế có thể sử dụng cho Audi và các hãng xe sang khác.  
**Tên tạm:** Client Studio. Có thể đổi tên sau; không coi đây là thương hiệu chính thức của hãng xe.

## 1. Mục tiêu và yêu cầu đã chốt

Ứng dụng lưu hồ sơ riêng của từng khách hàng và hỗ trợ nhân viên chăm sóc khách cả trước lẫn sau khi mua xe.

Các yêu cầu bắt buộc:

1. Khi mở ứng dụng, màn hình chính hiện **danh sách khách hàng đã lưu**.
2. Mỗi khách có **avatar riêng** để dễ nhận diện.
3. Chỉ sau khi chọn một khách, mới mở hồ sơ và các thông tin liên quan của khách đó.
4. Hồ sơ gồm tên, điện thoại, ngày sinh, tuổi, sở thích, thông tin xe, biển số và ghi chú.
5. Lưu hình ảnh riêng cho từng khách, ngoài ảnh đại diện.
6. Đặt ngày, giờ và nội dung lời nhắc cho từng khách.
7. Lời nhắc phải hiện thành **thông báo trên điện thoại của nhân viên đang sử dụng app**.
8. Tiếp tục chăm sóc sau mua: hỏi thăm, hỗ trợ sử dụng xe, sinh nhật, kỷ niệm giao xe, liên hệ về bảo dưỡng và các dịp tự đặt.
9. Có lịch sử các lần liên hệ và kết quả chăm sóc, có thể hẹn lần tiếp theo.
10. UI chuyên nghiệp, tối giản, phù hợp với bán xe sang; đồng bộ cả bố cục, màu sắc, kiểu chữ, nút bấm, tab và ô nhập liệu.
11. Dữ liệu thật phải được lưu bền vững, không mất khi đóng app hoặc tải lại.
12. Thiết kế thuận tiện để bổ sung yêu cầu về sau.

**Không được thay đổi luồng chính thành dashboard, trang thống kê hoặc màn hình chọn các chức năng ngay khi mở app.** Màn hình đầu vẫn là danh sách khách đã lưu. Nếu cần đăng nhập, sau khi đăng nhập thành công đi thẳng đến danh sách khách.

## 2. Hướng giao diện đã chọn

### 2.1. Mẫu tham khảo

- Link: https://dribbble.com/shots/24911825-Travel-Mobile-App
- Tên mẫu: Travel Mobile App.
- Tác giả: Ronas IT | UI/UX Team.
- Chỉ tham khảo **phong cách UI**, không sử dụng nghiệp vụ du lịch của mẫu.
- Định hướng được mô tả trên trang: đen–trắng tối giản, tập trung vào hình ảnh và cách trình bày chữ, ảnh rõ ràng.
- Demo đã trao đổi là bản lấy cảm hứng từ hướng này, không phải bản sao chính xác từng pixel của thiết kế gốc.

Codex cần xem hình mẫu nếu công cụ truy cập cho phép. Nếu không xem được ảnh, nói rõ giới hạn và triển khai theo mô tả dưới đây; không tự khẳng định đã xem hay sao chép chính xác mẫu.

### 2.2. Nguyên tắc thiết kế

- Nền sáng, nội dung đen và xám; có thể hỗ trợ giao diện tối sau.
- Ảnh khách là điểm nhấn, thay cho ảnh địa điểm của mẫu tham khảo.
- Tiêu đề rõ, khoảng cách thoáng, ít đường viền trang trí.
- Font sans-serif hiện đại, hỗ trợ đầy đủ tiếng Việt.
- Màu sắc tiết chế. Không mặc định thêm vàng kim, gradient, hiệu ứng phát sáng hay đồ họa trang trí cầu kỳ.
- Nội dung app dùng tiếng Việt. Tên Client Studio có thể giữ ở phần nhận diện.
- Ảnh minh họa và hồ sơ mẫu phải được phân biệt với dữ liệu thật.
- Không dùng logo Mercedes/Audi làm logo app khi chưa có yêu cầu và tài nguyên phù hợp.

### 2.3. Nút bấm và các thành phần UI

| Thành phần | Hướng thiết kế | Hành vi |
| --- | --- | --- |
| Nút chính | Nền đen, chữ trắng, bo tròn dạng viên thuốc | Thêm khách, lưu hồ sơ, lưu kết quả, lưu lịch |
| Nút phụ | Nền sáng, viền mảnh, chữ đen | Sửa thông tin, hủy, xem thông báo mẫu trong demo |
| Nút quay lại | Bo tròn, icon mũi tên và nhãn ngắn | Quay về đúng màn hình trước đó |
| Tab hồ sơ | Nhóm tab bo tròn, tab được chọn nền đen | Chuyển nội dung của cùng khách đang xem |
| Ô tìm kiếm | Bo tròn, nền xám nhẹ, icon tìm kiếm | Tìm theo tên, điện thoại, biển số |
| Ô nhập liệu | Cùng kiểu bo tròn và khoảng cách nhất quán | Nhập, sửa dữ liệu; có trạng thái lỗi |
| Ô nội dung dài | Bo góc, đủ cao để đọc và nhập | Sở thích, ghi chú, nội dung nhắc, kết quả liên hệ |
| Chọn ảnh | Vùng chọn có icon máy ảnh hoặc ảnh | Chọn avatar hoặc ảnh hồ sơ |
| Icon | Cùng một bộ icon nét đơn giản | Luôn có nhãn hoặc tên truy cập rõ ràng |

Nút phải có trạng thái nhấn, đang lưu, vô hiệu hóa và lỗi khi phù hợp. Không để các nút quan trọng chỉ thay đổi màu mà không thực hiện chức năng. Vùng bấm đủ lớn để dùng bằng ngón tay, mục tiêu khoảng 44–48 px hoặc đơn vị tương đương trên nền tảng.

## 3. Điều hướng và màn hình

### 3.1. Màn hình chính: Khách hàng đã lưu

Hiển thị ngay sau khi vào app:

- Phần nhận diện app gọn.
- Tiêu đề Khách hàng.
- Ô tìm kiếm theo tên, điện thoại và biển số; nên hỗ trợ tìm tên không dấu.
- Nút **Thêm khách**.
- Danh sách/thẻ khách có ảnh rõ và tên dễ đọc.
- Mỗi thẻ có tên, avatar, dòng xe ngắn gọn, trạng thái và lần liên hệ gần nhất.
- Một khách chưa có ảnh hiển thị chữ cái tên hoặc avatar mặc định trung tính; không tự dùng ảnh của người khác.

Hướng bố cục demo: trên điện thoại đủ rộng có thể dùng hai thẻ mỗi hàng, ảnh khách chiếm phần lớn thẻ. Ở chiều rộng nhỏ hoặc khi chữ quá dài, chuyển một cột nếu cần. Ưu tiên nhận diện khách và khả năng đọc, không ép lưới hai cột làm chữ bị cắt.

Nhấn vào một thẻ → mở hồ sơ của **đúng khách đó**, mặc định ở tab Thông tin.

Trạng thái cần có:

- Chưa có khách: thông báo ngắn và nút Thêm khách.
- Không tìm thấy: thông báo và cách xóa nội dung tìm kiếm.
- Đang tải, lỗi tải: phản hồi rõ và cho phép thử lại.

Không hiển thị các nút chọn tất cả màn hình demo phía trên app. Đó chỉ là cách trình bày bản thử trước đây, không phải luồng sản phẩm đã chốt.

### 3.2. Thêm khách

Form nhập hồ sơ với tên và số điện thoại bắt buộc. Các dữ liệu khác có thể bổ sung sau.

- Cho chọn avatar.
- Có Lưu hồ sơ và Hủy/Quay lại.
- Kiểm tra dữ liệu ngay tại trường liên quan.
- Ngày sinh không ở tương lai.
- Nếu trùng số điện thoại, cảnh báo hồ sơ có thể trùng; không âm thầm ghi đè. Cho xem hồ sơ đã có hoặc tiếp tục khi đã xác nhận.
- Lưu thành công: khách xuất hiện trong danh sách và có thể mở hồ sơ.

### 3.3. Hồ sơ khách hàng

Đầu màn hình:

- Nút **← Danh sách khách**.
- Avatar, tên, trạng thái và thông tin xe tóm tắt.
- Các tab **Thông tin | Hình ảnh | Chăm sóc | Lịch nhắc**.

Mọi tab đều thuộc cùng khách đang chọn. Chuyển tab không làm đổi khách. Chọn khách khác không giữ lại ảnh, lịch hay form của khách trước.

### 3.4. Tab Thông tin

Hiển thị:

- Họ tên.
- Điện thoại.
- Ngày tháng năm sinh.
- Tuổi hiện tại, tính tự động theo ngày sinh, không lưu một giá trị tuổi cố định phải sửa mỗi năm.
- Sở thích cá nhân.
- Ghi chú riêng và cách liên hệ thuận tiện nếu có.
- Dòng xe quan tâm hoặc đã mua.
- Biển số.
- Ngày giao xe.
- Trạng thái: Mới tiếp nhận, Đang tư vấn, Đã mua / Đang chăm sóc.

Nút **Sửa thông tin** mở form đã điền dữ liệu hiện tại. Lưu cập nhật hồ sơ; hủy giữ nguyên dữ liệu trước đó. Không lưu ghi chú hay tuổi bằng giá trị hard-code theo khách mẫu.

**Đề xuất cấu trúc:** cho phép một khách có nhiều xe. MVP có thể hiển thị một xe trước, nhưng không thiết kế quan hệ dữ liệu khiến mở rộng nhiều xe phải sửa lại toàn bộ hồ sơ. Đây là đề xuất kỹ thuật, không phải yêu cầu giao diện nhiều xe đã được người dùng chốt.

### 3.5. Tab Hình ảnh

- Avatar và album ảnh là hai khái niệm riêng.
- Đổi avatar không xóa ảnh album; thêm ảnh album không tự đổi avatar.
- Lưu ảnh riêng theo khách: ảnh khách, ảnh giao xe, ảnh xe/biển số và các ảnh liên quan.
- Cho chọn một hoặc nhiều ảnh.
- Hiển thị dạng lưới, nhấn ảnh để xem lớn, có thể quay lại hồ sơ.
- Có thể thêm mô tả ngắn và xóa ảnh khi xác nhận.
- Xử lý ảnh lớn, sai định dạng và lỗi tải lên bằng thông báo rõ ràng.
- Ảnh phải tồn tại sau khi khởi động lại ứng dụng.

### 3.6. Tab Chăm sóc

Chăm sóc xuyên suốt, không kết thúc khi khách mua xe.

Hiển thị:

- Ngày liên hệ gần nhất; được lấy từ lịch sử liên hệ thực tế.
- Nút **Ghi nhận lần chăm sóc**.
- Các việc chăm sóc tiếp theo của khách.
- Nút **Đặt lịch chăm sóc**.
- Lịch sử liên hệ, mới nhất trước.

Mỗi lần liên hệ gồm:

- Ngày và giờ thực hiện; mặc định hiện tại, có thể sửa để ghi nhận việc đã làm trước đó.
- Kênh: Gọi điện, Nhắn tin, Gặp trực tiếp.
- Nội dung / phản hồi của khách / nhu cầu cần hỗ trợ.
- Ngày, giờ và nội dung liên hệ tiếp theo, nếu muốn.

Khi lưu:

1. Thêm bản ghi vào lịch sử của khách.
2. Cập nhật lần liên hệ gần nhất.
3. Nếu mở từ một lịch nhắc, ghi nhận hoàn thành đúng lần nhắc đó.
4. Nếu có hẹn tiếp theo, tạo lịch nhắc mới gắn với cùng khách.

Không tự gửi SMS, Zalo, email hay gọi điện chỉ vì người dùng lưu kết quả. MVP là công cụ nhắc nhân viên và ghi nhận việc đã thực hiện.

Ví dụ chăm sóc sau mua: hỏi trải nghiệm sử dụng, hỗ trợ tính năng xe, chúc sinh nhật, kỷ niệm ngày giao xe, liên hệ xác nhận lịch bảo dưỡng theo thông tin của khách. Không tự áp một lịch bảo dưỡng chung cho mọi dòng xe.

### 3.7. Tab Lịch nhắc

- Chỉ hiển thị lời nhắc của khách đang mở.
- Hiển thị nội dung, ngày giờ, lặp lại, nhắc trước và trạng thái.
- Thêm, sửa, hủy lịch nhắc.
- Có Ghi nhận kết quả / Hoàn thành và Dời lịch khi phù hợp.
- Nút tạo mới mở form gắn sẵn với khách hiện tại; không mặc định chọn khách khác.

Form lời nhắc:

| Trường | Yêu cầu |
| --- | --- |
| Khách hàng | Chính khách đang xem |
| Loại | Sinh nhật, Hỏi thăm sau mua, Bảo dưỡng, Kỷ niệm giao xe, Tư vấn trước mua, Dịp khác |
| Nội dung | Người dùng tự nhập và sửa được |
| Ngày | Người dùng chọn |
| Giờ | Người dùng chọn |
| Lặp lại | Tối thiểu Một lần và Hằng năm |
| Nhắc trước | Đúng thời điểm; có thể thêm trước 1 hoặc 3 ngày |

Hằng tháng và mỗi 3 tháng đã xuất hiện trong demo như lựa chọn mở rộng; không cần làm trước các yêu cầu bắt buộc nếu ảnh hưởng tiến độ.

Khi chọn Sinh nhật hoặc Kỷ niệm giao xe, có thể gợi ý ngày từ hồ sơ và lặp hằng năm, nhưng người dùng vẫn sửa được. Không tự tạo vô hạn các lịch trùng nhau mỗi lần mở hồ sơ.

### 3.8. Thông báo điện thoại

Đây là yêu cầu thật của sản phẩm, không được thay thế bằng toast trong app hay một card giả lập.

- Thông báo gửi đến thiết bị của nhân viên dùng app, không gửi đến khách.
- Nội dung có tên khách và lời nhắc, ví dụ: “Sinh nhật Nguyễn Minh Anh — Gọi điện chúc mừng và hỏi thăm”.
- Chạm thông báo mở đúng hồ sơ khách và lời nhắc tương ứng.
- Xin quyền thông báo đúng lúc, giải thích ngắn vì sao cần quyền.
- Khi bị từ chối quyền, app báo trạng thái và hướng dẫn bật lại; vẫn cho lưu lịch.
- Sửa giờ, dời hoặc hủy lịch phải cập nhật/hủy thông báo cũ.
- Hoàn thành một lần nhắc hằng năm không được tắt toàn bộ lịch các năm sau.
- Mặc định giờ địa phương của người dùng, ban đầu Asia/Ho_Chi_Minh. Lưu đủ thông tin múi giờ để không sai giờ.
- Quy tắc ngày 29/02 khi lặp hằng năm phải được xác định và ghi rõ trước khi hoàn thiện; không tự suy đoán mà không thông báo.

**Chưa chốt nền tảng:** Android, iPhone hay cả hai; app cài đặt hay web/PWA. Codex phải hỏi điểm này trước khi chọn cơ chế thông báo. Chọn giải pháp có thể đáp ứng trên thiết bị mục tiêu, kiểm tra tài liệu nền tảng hiện hành và nêu rõ hạn chế về quyền, mạng, trạng thái app và thiết bị.

Không hứa thông báo luôn đúng tuyệt đối hoặc chạy trong mọi tình huống mà chưa kiểm tra. Không dùng riêng bộ đếm thời gian của trang đang mở để coi như đã hoàn thành yêu cầu nhắc trên điện thoại.

## 4. Luồng sử dụng mẫu

### 4.1. Tiếp nhận và tư vấn

1. Mở app → thấy danh sách khách.
2. Thêm khách: tên, điện thoại, avatar, dòng xe quan tâm.
3. Mở hồ sơ → bổ sung sở thích và ghi chú.
4. Đặt lịch gọi lại / hẹn lái thử.
5. Nhận thông báo → mở hồ sơ → liên hệ → ghi nhận kết quả.

### 4.2. Giao xe và chăm sóc lâu dài

1. Cập nhật trạng thái đã mua, xe, biển số, ngày giao xe.
2. Lưu ảnh giao xe trong Hình ảnh.
3. Đặt lịch hỏi thăm sau mua, sinh nhật, kỷ niệm giao xe.
4. Đến lịch → nhận thông báo → mở đúng khách.
5. Xem các lần liên hệ trước để biết bối cảnh.
6. Liên hệ, ghi nhận phản hồi, hoàn thành việc hiện tại.
7. Hẹn lần tiếp theo nếu cần.

## 5. Cấu trúc dữ liệu đề xuất

Đây là mô hình logic để định hướng, không bắt buộc một cơ sở dữ liệu hay framework cụ thể.

| Thực thể | Dữ liệu chính |
| --- | --- |
| Khách hàng | ID, tên, điện thoại, ngày sinh, sở thích, ghi chú, trạng thái, tham chiếu avatar, ngày tạo/cập nhật |
| Xe của khách | ID, customer_id, hãng/dòng xe, biển số, ngày giao, trạng thái quan tâm/đã mua |
| Ảnh khách | ID, customer_id, tham chiếu file ảnh, mô tả, ngày tạo |
| Lịch nhắc | ID, customer_id, loại, nội dung, ngày giờ địa phương, múi giờ, lặp lại, nhắc trước, đang bật/hủy |
| Lần nhắc | ID, reminder_id, thời điểm dự kiến, trạng thái, thời điểm hoàn thành; hoặc mô hình tương đương |
| Lịch sử liên hệ | ID, customer_id, ngày giờ, kênh, nội dung/kết quả, lần nhắc liên quan nếu có |

Nguyên tắc:

- Liên kết bằng ID ổn định; không dùng tên khách làm khóa. Hai khách cùng tên phải độc lập.
- Không tính tuổi từ dữ liệu mẫu; lấy ngày sinh và ngày hiện tại.
- Ảnh và thông báo cũng gắn theo ID khách/lịch, không theo vị trí thẻ trong giao diện.
- Không dùng mảng mẫu trong bộ nhớ làm nơi lưu dữ liệu thật.
- Tách lịch lặp với từng lần thực hiện để xử lý hoàn thành, dời lịch và tránh nhắc trùng.
- Nếu backend phục vụ nhiều tài khoản, dữ liệu phải có chủ sở hữu và kiểm tra quyền trên server; một người không truy cập hồ sơ của người khác chỉ bằng đổi ID.

## 6. Phạm vi và các điểm chưa chốt

### 6.1. Phải có trong MVP

- Danh sách khách, tìm kiếm, thêm và sửa hồ sơ.
- Avatar và album ảnh theo khách.
- Chăm sóc trước/sau mua và lịch sử liên hệ.
- Lời nhắc theo ngày giờ; sinh nhật lặp hằng năm.
- Thông báo thật trên nền tảng điện thoại đã chọn.
- Lưu dữ liệu bền vững và luồng UI đã thống nhất.

### 6.2. Chưa yêu cầu

- CRM cho cả đại lý, phân công khách, quyền nhiều cấp.
- Báo giá, hợp đồng, tồn kho xe, doanh thu, KPI, dashboard thống kê.
- Tự động gửi lời chúc hoặc tin nhắn cho khách.
- Tích hợp hệ thống Mercedes/Audi, Zalo, SMS hay email.
- AI đánh giá khách, gợi ý mua xe hoặc chấm điểm khách.
- Công bố lên App Store/Google Play, mua dịch vụ hoặc triển khai production.

Không tự thêm các chức năng này vào MVP. Chuẩn bị cấu trúc để mở rộng khi cần.

### 6.3. Cần hỏi trước khi chọn công nghệ

1. Dùng trên Android, iPhone hay cả hai? Có cần máy tính không?
2. Một người dùng trên một máy hay cần đồng bộ nhiều thiết bị? Dữ liệu lưu cục bộ hay trên server?
3. Có repository/stack đã chọn hoặc backend sẵn có không?

Nếu repository có sẵn, Codex đọc cấu trúc và quy tắc dự án trước, tận dụng công nghệ hiện có nếu phù hợp. Chỉ hỏi các điểm chưa có câu trả lời. Không tự coi Blazor, Flutter, React Native, PWA hoặc bất kỳ stack nào là đã được người dùng chốt.

Việc lưu dữ liệu, sao lưu/khôi phục và truy cập tài khoản cần được thống nhất theo cách triển khai. Không làm cơ chế đăng nhập/đồng bộ phức tạp nếu phạm vi chỉ là app cá nhân cục bộ.

## 7. Tiêu chí nghiệm thu

### Điều hướng và UI

- [ ] Mở app hiện danh sách khách đã lưu.
- [ ] Không có màn hình chọn các mẫu UI hay các màn hình demo trong sản phẩm.
- [ ] Bấm khách A mở đúng khách A; bấm khách B mở đúng khách B.
- [ ] Mặc định hồ sơ mở tab Thông tin.
- [ ] Có đủ Thông tin, Hình ảnh, Chăm sóc, Lịch nhắc trong hồ sơ.
- [ ] Quay lại danh sách hoạt động từ hồ sơ; hủy form không tự lưu dữ liệu.
- [ ] Nút, tab, tìm kiếm và nhập liệu đồng bộ theo hướng đen–trắng bo tròn.
- [ ] Màn hình nhỏ không tràn ngang, cắt nút hoặc làm nội dung không đọc được.
- [ ] Có trạng thái rỗng, đang tải, lỗi và đang lưu phù hợp.

### Hồ sơ và ảnh

- [ ] Thêm/sửa khách lưu thật; đóng mở app không mất dữ liệu.
- [ ] Hai khách cùng tên vẫn có hồ sơ độc lập.
- [ ] Tuổi tính đúng trước và sau ngày sinh nhật; không có ngày sinh thì không bịa tuổi.
- [ ] Tìm đúng theo tên, số điện thoại và biển số.
- [ ] Đổi avatar cập nhật danh sách và hồ sơ đúng khách.
- [ ] Thêm ảnh khách A không xuất hiện trong album khách B.
- [ ] Ảnh vẫn xem được sau khi mở lại app.

### Chăm sóc và lịch nhắc

- [ ] Khách đã mua xe vẫn đặt lịch và ghi nhận chăm sóc bình thường.
- [ ] Lưu kết quả tạo lịch sử và cập nhật liên hệ gần nhất đúng khách.
- [ ] Ngày giờ ghi nhận lấy từ dữ liệu người dùng/đồng hồ, không cố định theo ngày demo.
- [ ] Đặt lần tiếp theo tạo lời nhắc đúng khách và đúng nội dung.
- [ ] Lưu lặp hằng năm, nhắc trước, sửa/hủy/dời lịch đúng.
- [ ] Hoàn thành một lần của lịch lặp không làm mất các lần tiếp theo.

### Thông báo thật

- [ ] Kiểm tra trên điện thoại mục tiêu với quyền thông báo được bật.
- [ ] Tạo lịch gần hiện tại, nhận được thông báo ngoài giao diện app.
- [ ] Kiểm tra khi app ở nền hoặc đóng theo tình huống nền tảng hỗ trợ; ghi rõ kết quả và giới hạn.
- [ ] Chạm thông báo mở đúng khách/lời nhắc.
- [ ] Sửa hoặc hủy lời nhắc không còn thông báo cũ không mong muốn.
- [ ] Từ chối quyền thông báo không làm app lỗi; có hướng dẫn bật lại.
- [ ] Không coi toast, ảnh mockup hay nút “Xem thông báo mẫu” là bằng chứng tính năng đã hoàn thành.

## 8. Cách Codex triển khai

1. Đọc đặc tả và repository hiện có nếu có.
2. Xác nhận nền tảng, lưu dữ liệu/đồng bộ và stack nếu chưa rõ.
3. Đề xuất kiến trúc ngắn gọn đáp ứng thông báo trên điện thoại, nêu các giới hạn thực tế.
4. Xây màn hình danh sách khách → hồ sơ theo hướng UI này.
5. Hoàn thiện lưu hồ sơ, avatar và album theo đúng ID khách.
6. Hoàn thiện lịch sử chăm sóc và lịch nhắc.
7. Tích hợp cơ chế thông báo thật, kiểm tra trên thiết bị mục tiêu.
8. Chạy kiểm tra phù hợp; kiểm tra luồng giữa hai khách, lưu bền vững, ngày sinh và lịch lặp.
9. Bàn giao cách chạy/build, cấu hình cần thiết và những mục còn thiếu hoặc chưa kiểm tra được.

Không chỉ dựng màn hình đẹp rồi coi tác vụ đã hoàn thành. Chức năng, lưu dữ liệu và thông báo phải hoạt động. Những bước cần tài khoản, thiết bị hoặc môi trường chưa có phải được báo rõ; không mô phỏng rồi báo thành công.

## 9. Prompt khởi động để dán vào Codex

```text
Hãy đọc toàn bộ file đặc tả này và xây dựng app quản lí, chăm sóc khách hàng
cho một nhân viên bán xe sang theo đúng yêu cầu.

Luồng bắt buộc: mở app hiện danh sách khách đã lưu có avatar; chọn một khách
mới mở hồ sơ riêng, gồm Thông tin, Hình ảnh, Chăm sóc và Lịch nhắc.
Chăm sóc phải tiếp tục sau khi khách mua xe.

UI lấy cảm hứng từ Travel Mobile App của Ronas IT trên Dribbble theo link
trong tài liệu: đen–trắng tối giản, ảnh nổi bật, đồng bộ nút bo tròn, icon,
tab và ô nhập liệu. Không đưa chức năng du lịch vào app.

Trước khi chọn công nghệ, kiểm tra repository hiện có. Nếu chưa rõ, hỏi
nền tảng điện thoại, cách lưu/đồng bộ dữ liệu và stack đã chọn. Không tự
đổi luồng sang dashboard hoặc mở rộng thành CRM đại lý.

Triển khai dữ liệu bền vững, từng khách độc lập và thông báo thật trên
điện thoại. Không thay thông báo bằng toast hoặc mockup. Thực hiện và
kiểm tra theo checklist nghiệm thu. Báo rõ các giới hạn và phần chưa kiểm
tra được trên thiết bị thật.
```
