#!/usr/bin/env bash
# Replace the app release, preserving .env, database, photos and other services.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
archive=${1:?Supply the Node.js application archive}
[[ -f "$archive" && -f /etc/cliente/.env && -L /opt/cliente/current ]] || { echo 'Missing archive or prepared .env installation.' >&2; exit 1; }
previous=$(readlink -f /opt/cliente/current)
[[ $previous == /opt/cliente/releases/* ]] || { echo 'Unexpected current release path.' >&2; exit 1; }
bash "$(dirname "$0")/install-node.sh"
release="/opt/cliente/releases/$(date -u +%Y%m%dT%H%M%SZ)-node"
mkdir "$release"
tar -xzf "$archive" -C "$release"
[[ -f "$release/dist/server.js" && -f "$release/wwwroot/index.html" && -f "$release/package-lock.json" && -f "$release/deployment/cleanup-old-releases.sh" ]] || { echo 'Incomplete Node.js release.' >&2; exit 1; }
ln -s /etc/cliente/.env "$release/.env"
(cd "$release"; PATH="/opt/cliente/node/bin:$PATH" /opt/cliente/node/bin/npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
chown -R root:root "$release"
chmod -R a+rX,go-w "$release"
install -d -o cliente -g cliente -m 0700 /var/lib/cliente/photos
(cd "$release"; runuser -u cliente -- env CLIENTE_ENV_FILE=/etc/cliente/.env /opt/cliente/node/bin/node dist/server.js --check-database)
was_active=false
if systemctl is-active --quiet cliente; then was_active=true; systemctl stop cliente; fi
ln -sfn "$release" /opt/cliente/current
install -o root -g root -m 0644 "$release/deployment/cliente.service" /etc/systemd/system/cliente.service
systemctl daemon-reload
if $was_active; then
  systemctl reset-failed cliente || true
  if ! systemctl start cliente || ! curl --retry 10 --retry-connrefused --retry-delay 1 -fsS -H 'Host: care.tranie-mua.io.vn' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5180/health; then
    echo 'New release did not pass health verification. Service diagnostics:' >&2
    systemctl status cliente --no-pager -l || true
    journalctl -u cliente -n 40 --no-pager || true
    systemctl stop cliente || true
    ln -sfn "$previous" /opt/cliente/current
    install -o root -g root -m 0644 "$previous/deployment/cliente.service" /etc/systemd/system/cliente.service
    systemctl daemon-reload
    systemctl reset-failed cliente || true
    systemctl start cliente
    echo 'Update failed; previous release restored.' >&2; exit 1
  fi
  if ! bash "$release/deployment/cleanup-old-releases.sh" "$release" "$archive"; then
    echo 'New release is running, but old release cleanup failed. Retry cleanup after checking the service.' >&2; exit 1
  fi
  echo; echo 'Node.js update complete; old releases removed.'
else
  echo 'Node.js release prepared. Run: sudo bash /opt/cliente/current/deployment/finish-setup.sh'
fi
