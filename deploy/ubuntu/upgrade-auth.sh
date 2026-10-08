#!/usr/bin/env bash
# Explicit operator-triggered upgrade, with a database backup and release rollback.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
archive=${1:?Supply the prepared application archive}
smtp_file=${2:?Supply the protected SMTP configuration file}
expected_hash=${3:?Supply the verified archive SHA-256}
expected_previous=${4:?Supply the release verified during preflight}
upload_archive=${5:-$archive}
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ -f "$archive" && -f "$smtp_file" && -f /etc/cliente/.env && -L /opt/cliente/current ]] || { echo 'Missing prepared deployment files.' >&2; exit 1; }
[[ $expected_hash =~ ^[a-fA-F0-9]{64}$ ]] || { echo 'Invalid archive checksum.' >&2; exit 1; }
printf '%s  %s\n' "$expected_hash" "$archive" | sha256sum --check --status
if [[ $upload_archive != "$archive" ]]; then
  [[ -f "$upload_archive" && ! -L "$upload_archive" ]] || { echo 'Missing original upload archive.' >&2; exit 1; }
  printf '%s  %s\n' "$expected_hash" "$upload_archive" | sha256sum --check --status
fi
previous=$(readlink -f /opt/cliente/current)
[[ $previous == /opt/cliente/releases/* && $previous == "$expected_previous" && -f "$previous/dist/server.js" ]] || { echo 'Current release changed; rerun deployment preflight.' >&2; exit 1; }
systemctl is-active --quiet cliente || { echo 'Existing service is not active; deployment stopped.' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="/opt/cliente/releases/${stamp}-auth-node"
backup="/var/backups/cliente/${stamp}-auth"
install -d -m 0700 "$backup"
cp -a /etc/cliente/.env "$backup/server.env"
cp -a /etc/systemd/system/cliente.service "$backup/cliente.service"
printf '%s\n' "$previous" > "$backup/previous-release.txt"
stopped=false
finished=false
rollback() {
  result=$?
  trap - EXIT
  if ! $finished && $stopped; then
    echo 'Deployment failed. Restoring previous application and configuration.' >&2
    systemctl stop cliente || true
    cp -a "$backup/server.env" /etc/cliente/.env
    cp -a "$backup/cliente.service" /etc/systemd/system/cliente.service
    ln -sfn "$previous" /opt/cliente/current
    systemctl daemon-reload
    systemctl reset-failed cliente || true
    if [[ -f "$backup/account-access-before.json" ]]; then
      if ! CLIENTE_RELEASE="$release" CLIENTE_BACKUP="$backup" /opt/cliente/node/bin/node "$script_dir/rollback-auth-access.mjs"; then
        echo 'Account access rollback failed. Service remains stopped; restore account access before restarting the older application.' >&2
        echo "Protected database and account snapshots: $backup" >&2
        exit 1
      fi
    fi
    systemctl start cliente || true
    echo "Database backup retained at $backup/MEC.bak. Additive SQL schema changes are retained." >&2
  fi
  exit "$result"
}
trap rollback EXIT
mkdir "$release"
tar -xzf "$archive" -C "$release"
[[ -f "$release/dist/auth-schema.js" && -f "$release/wwwroot/index.html" && -f "$release/package-lock.json" && -f "$release/deployment/cliente.service" && -f "$release/deployment/cleanup-old-releases.sh" ]] || { echo 'Incomplete authentication release.' >&2; exit 1; }
(cd "$release"; PATH="/opt/cliente/node/bin:$PATH" /opt/cliente/node/bin/npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
chown -R root:root "$release"
chmod -R a+rX,go-w "$release"
ln -s /etc/cliente/.env "$release/.env"
echo 'Release staged. Briefly stopping service for consistent backup and migration.'
systemctl stop cliente
stopped=true
tar -czf "$backup/photos.tar.gz" -C /var/lib/cliente photos
tar -tzf "$backup/photos.tar.gz" >/dev/null
CLIENTE_RELEASE="$release" CLIENTE_PREVIOUS="$previous" CLIENTE_BACKUP="$backup" CLIENTE_STAMP="$stamp" CLIENTE_SMTP_FILE="$smtp_file" \
  /opt/cliente/node/bin/node "$script_dir/upgrade-auth.mjs"
chown root:cliente /etc/cliente/.env
chmod 0640 /etc/cliente/.env
(cd "$release"; runuser -u cliente -- env CLIENTE_ENV_FILE=/etc/cliente/.env /opt/cliente/node/bin/node dist/server.js --check-database)
ln -sfn "$release" /opt/cliente/current
install -o root -g root -m 0644 "$release/deployment/cliente.service" /etc/systemd/system/cliente.service
systemctl daemon-reload
systemctl reset-failed cliente || true
systemctl start cliente
healthy=false
for attempt in $(seq 1 20); do
  if curl -fsS -H 'Host: care.tranie-mua.io.vn' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5180/health >/dev/null; then healthy=true; break; fi
  sleep 1
done
$healthy && systemctl is-active --quiet cliente || { echo 'New service failed health verification.' >&2; exit 1; }
curl -fsS -H 'Host: care.tranie-mua.io.vn' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5180/auth/registration/config
echo
finished=true
if ! bash "$release/deployment/cleanup-old-releases.sh" "$release" "$upload_archive"; then
  echo 'New release is running, but old release cleanup failed. Retry cleanup after checking the service.' >&2; exit 1
fi
echo "DEPLOYMENT_OK release=$release backup=$backup"
echo 'Open https://care.tranie-mua.io.vn/admin with the existing administrator password.'
