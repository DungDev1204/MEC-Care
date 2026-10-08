# Project instructions

## Ubuntu deployment

User preference recorded on 2026-10-08: “từ lần sau mỗi lần update bản mới hãy xóa cả những bản cũ trên ubuntu”.

- After every successful update, automatically remove superseded application directories in `/opt/cliente/releases` using `deploy/ubuntu/cleanup-old-releases.sh`. Keep only the current release.
- Also remove old application `.tar.gz` packages from `/home/robotics/cliente-upload` after successful deployment, keeping the newly deployed package. Pass its original upload path as the second cleanup argument (or fifth `upgrade-auth.sh` argument when the archive is staged in a temporary directory). Do not remove config files, backup archives or utility scripts. Use `cliente-release-YYYYMMDDTHHMMSSZ.tar.gz` for future packages; cleanup also recognizes legacy `cliente-node.tar.gz`, `cliente-linux-x64.tar.gz`, and dated auth/subscription/announcements/scroll/node/ui packages.
- Verify the service is running the new release and its Node + SQL Server health passes before cleanup. Preserve the previous release until that point so failed updates can roll back.
- Preserve the database, `/var/lib/cliente/photos`, `/etc/cliente/.env`, database backups, shared runtimes and other services.
- The domain is `care.tranie-mua.io.vn`. Keep its existing Cloudflare Tunnel route.
- The user chose to run sudo commands themselves. Prepare and verify the deployment, then provide the exact sudo command when root access is required; do not ask again for the sudo password.
