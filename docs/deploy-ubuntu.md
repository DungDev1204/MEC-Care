# Triển khai Clienté Node.js trên Ubuntu

Backend TypeScript + Express, frontend React + TypeScript. Runtime Node.js 24 LTS; không cần .NET. Database SQL Server MEC và ảnh hiện có được giữ nguyên. Domain care.tranie-mua.io.vn; Ubuntu 24.04 x64 tại 172.20.235.176. Cập nhật 08/10/2026.

## Cấu hình .env

Local: apps/api/.env. Ubuntu: /etc/cliente/.env. Mẫu: deploy/ubuntu/.env.example. CLIENTE_ENV_FILE chọn file; biến tiến trình cùng tên ưu tiên hơn file. Không cần source/export .env. Gói ứng dụng không chứa file cấu hình riêng.

APP_ENV=Production, PORT=5180, BIND_ADDRESS=127.0.0.1, TRUST_LOCAL_PROXY=true. ALLOWED_HOSTS chứa care.tranie-mua.io.vn;localhost;127.0.0.1. DB_SERVER, DB_PORT, DB_NAME=MEC, DB_USER, DB_PASSWORD giữ thông tin SQL hiện có. STORAGE_PATH=/var/lib/cliente/photos. REVIEW_ENABLED=false trên production.

DB_ENCRYPT=true giữ mã hóa. DB_TRUST_SERVER_CERTIFICATE=false xác minh chứng chỉ SQL; true bỏ xác minh chứng chỉ. Nếu SQL và web cùng máy và đã chọn tin cậy chứng chỉ nội bộ, dùng DB_SERVER=127.0.0.1 cùng flag true. Bản cập nhật giữ nguyên file trên máy chủ, không tự đổi lựa chọn này. DB_CERTIFICATE_HOST đặt hostname trong chứng chỉ nếu khác DB_SERVER.

PUSH_ENABLED, PUSH_SUBJECT, PUSH_PUBLIC_KEY, PUSH_PRIVATE_KEY quản lý Web Push. Giữ VAPID keys sau cập nhật. Đặt mật khẩu chứa ký tự đặc biệt trong nháy đơn. Ứng dụng không mở rộng biến $ trong .env.

## Cập nhật bản đã chuẩn bị hoặc đang chạy

Nếu terminal đang hỏi Email nhân viên từ installer cũ, bấm Ctrl+C. Không cần tạo tài khoản bằng terminal; bản mới có trang đăng ký.

Trên Windows PowerShell:

```powershell
cd D:\MEC-Care
.\scripts\package-ubuntu.ps1
scp .\artifacts\cliente-node.tar.gz robotics@172.20.235.176:cliente-upload/
```

Trên Ubuntu:

```bash
tar -xzf ~/cliente-upload/cliente-node.tar.gz -C ~/cliente-upload ./deployment
sudo bash ~/cliente-upload/deployment/update.sh ~/cliente-upload/cliente-node.tar.gz
```

Script cài riêng Node 24 từ nodejs.org, kiểm tra SHA-256 và đặt tại /opt/cliente/node. Nó không thay Node của dự án khác. Gói có JavaScript đã build, web assets và package lock; dependency production được cài bằng npm ci --omit=dev --ignore-scripts. Script kiểm tra SQL trước khi đổi release, giữ /etc/cliente/.env, database và /var/lib/cliente/photos. Nếu service đang chạy, script cập nhật, khởi động lại và khôi phục release trước khi kiểm tra health thất bại. Khi bản mới hoạt động và vượt qua kiểm tra Node + SQL Server, script tự xóa mọi release cũ và chỉ giữ bản đang chạy, theo yêu cầu người dùng ngày 08/10/2026.

Script đóng gói trên Windows tự dọn thư mục staging sau khi tạo archive. Trong `artifacts/` chỉ cần giữ `cliente-node.tar.gz` và file `.env` riêng để vận hành.

Bản sửa 08/10 xử lý đường dẫn liên kết `/opt/cliente/current` khi Node khởi động. Gói Node đầu tiên có thể thoát mà chưa mở cổng 5180 dù kiểm tra SQL đạt; nếu đã thấy `Update failed; previous release restored.`, upload lại gói mới rồi chạy lại hai lệnh cập nhật ở trên. Script mới in trạng thái và log service trước khi rollback nếu health vẫn thất bại.

Nếu service chưa chạy, hoàn tất bằng:

```bash
sudo bash /opt/cliente/current/deployment/finish-setup.sh
```

Setup hỏi email liên hệ cho Web Push, giữ khóa cũ và bật service. Bản đăng ký OTP/admin cần nâng cấp schema và cấu hình SMTP theo [hướng dẫn đăng ký và admin](registration-admin.md) **trước khi chạy update.sh**. Mở `/register` để đăng ký, xác minh OTP email rồi đăng nhập bằng username. Trang chủ yêu cầu đăng ký gói; tài khoản mới có dữ liệu riêng sau khi admin kích hoạt. Admin đăng nhập tài khoản hiện có tại `/admin` sau khi chạy script nâng cấp; xem username thực tế trong kết quả migration.

`update.sh`, `upgrade-auth.sh` và `finish-setup.sh` tự dọn release cũ sau khi kiểm tra service mới thành công. Nếu cần chạy lại riêng bước dọn:

```bash
sudo bash /opt/cliente/current/deployment/cleanup-old-releases.sh
```

Script xác nhận tiến trình service đang chạy đúng release hiện tại và health đạt Node + SQL Server trước khi xóa. Các thư mục release cũ trực tiếp trong `/opt/cliente/releases` được xóa; database, ảnh, `.env` và bản sao lưu được giữ. Nếu nâng cấp thất bại trước bước này, bản cũ vẫn còn để rollback. Nếu dọn thất bại sau khi nâng cấp thành công, script báo rõ để chạy lại bước dọn và giữ bản mới đang chạy.

Sau mỗi cập nhật, giữ đúng gói vừa triển khai và xóa các gói ứng dụng cũ trong `/home/robotics/cliente-upload`. `update.sh` tự truyền đường dẫn gói; nếu `upgrade-auth.sh` dùng bản sao trong thư mục tạm, truyền đường dẫn gói tải lên gốc ở tham số thứ năm. Cleanup kiểm tra gói giữ lại là file thường trực tiếp trong thư mục tải lên và frontend trong gói khớp bản đang chạy trước khi xóa. Chỉ tên gói ứng dụng đã nhận diện được dọn; file cấu hình SMTP, `.env`, script tiện ích, gói backup và gói dịch vụ khác được giữ. Quy ước cho gói mới: `cliente-release-YYYYMMDDTHHMMSSZ.tar.gz`.

Để dọn lại cả gói tải lên, dùng đường dẫn gói thực tế vừa triển khai:

```bash
sudo bash /opt/cliente/current/deployment/cleanup-old-releases.sh \
  "$(readlink -f /opt/cliente/current)" \
  /home/robotics/cliente-upload/cliente-release-YYYYMMDDTHHMMSSZ.tar.gz
```

## Kiểm tra SQL và service

```bash
cd /opt/cliente/current
sudo -u cliente env CLIENTE_ENV_FILE=/etc/cliente/.env \
  /opt/cliente/node/bin/node dist/server.js --check-database
systemctl is-active cliente
sudo journalctl -u cliente -n 60 --no-pager
curl -fsS -H 'Host: care.tranie-mua.io.vn' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5180/health
```

Health trả runtime=node, mode=sqlServer. Sau khi sửa .env: sudo systemctl restart cliente. File thuộc root:cliente, mode 0640; ảnh ngoài release thuộc cliente.

Nếu lỗi CA SQL, kiểm tra tạm thời, giữ mã hóa và không sửa file:

```bash
cd /opt/cliente/current
sudo -u cliente env CLIENTE_ENV_FILE=/etc/cliente/.env \
  DB_SERVER=127.0.0.1 DB_ENCRYPT=true DB_TRUST_SERVER_CERTIFICATE=true \
  /opt/cliente/node/bin/node dist/server.js --check-database
```

Nếu đạt, cấu hình chứng chỉ trong .env theo lựa chọn vận hành rồi kiểm tra lại. Không tạo lại MEC hoặc giảm TLS toàn hệ thống.

## Cài mới

Upload archive và .env riêng vào ~/cliente-upload. Chỉ chạy khi chưa có /opt/cliente/current:

```bash
sudo bash ~/cliente-upload/deployment/install-first.sh \
  ~/cliente-upload/cliente-node.tar.gz ~/cliente-upload/.env
```

`docs/database.sql` là SQL thuần, idempotent cho cài mới/nâng cấp. Bản đăng ký OTP/admin có thêm cột và bảng; với MEC hiện có, chạy CLI `--migrate-auth` bằng tài khoản có quyền DDL để nâng schema và cấp username. `docs/auth-migration.sql` chỉ chứa phần schema. Service chỉ kiểm tra schema, không tự chạy migration và không cần quyền db_owner. Bảng lịch sử backend cũ được giữ; Node không phụ thuộc vào bảng đó.

## Cloudflare Tunnel

Cloudflare dashboard → Networking → Tunnels → tunnel đang chạy → Routes → Add route → Published application. Hostname care.tranie-mua.io.vn, service URL http://127.0.0.1:5180. Giữ route của web app khác. Nếu tunnel dùng YAML, thêm ingress vào cấu hình hiện có. [Cloudflare](https://developers.cloudflare.com/tunnel/get-started/).

```bash
curl -fsS https://care.tranie-mua.io.vn/health
```

Kiểm tra đăng ký, đăng nhập, ảnh, lịch nhắc và sao lưu ZIP. Cài PWA trên iOS/Android và thử thông báo khi khóa máy. Đổi domain sau này: thêm route, sửa ALLOWED_HOSTS và restart; giữ database, ảnh và VAPID keys. Người dùng cần đăng nhập/cài PWA/bật thông báo lại theo origin mới.

## Xác nhận và giới hạn

TypeScript/backend và React/frontend build đạt. Bản username, đăng ký gói, giao diện gọn/thông báo admin và sửa cuộn hộp thoại đang chạy trên `care.tranie-mua.io.vn`; DNS và Cloudflare Tunnel hiện có được giữ. Ngày 2026-10-08 đã xác nhận release `20261008T084400Z-auth-node`, asset công khai `index-Vy_HOBGF.js` / `index-B-nP8M4A.css`, hai service active và health Node + SQL Server đạt. CSS trên domain khớp file trong release. Thư mục releases chỉ còn bản hiện tại; `~/cliente-upload` chỉ còn gói ứng dụng mới `cliente-release-20261008T084152Z.tar.gz`. Bản đăng ký/thông báo có 30 kiểm thử API và 7 kiểm thử frontend đạt; bản sửa cuộn đạt build, 7 kiểm thử frontend, 9 kiểm thử dọn file trên Linux cùng QA trình duyệt trên điện thoại và desktop. Phục hồi mật khẩu và thanh toán tự động chưa thuộc bản này.
