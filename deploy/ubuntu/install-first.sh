#!/usr/bin/env bash
# First installation only. Configuration and data stay outside the release.
set -Eeuo pipefail
umask 077

[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
archive=${1:-/tmp/cliente-node.tar.gz}
configuration=${2:-/tmp/cliente-production.env}
[[ -f "$archive" && -f "$configuration" ]] || { echo 'Upload the application archive and production configuration first.' >&2; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo 'This installation expects linux-x64.' >&2; exit 1; }
[[ ! -e /opt/cliente/current && ! -L /opt/cliente/current && ! -e /etc/cliente/.env && ! -e /etc/systemd/system/cliente.service ]] || {
  echo 'Cliente is already prepared. Stop here and inspect the existing deployment before updating.' >&2; exit 1;
}
if ss -ltnH 'sport = :5180' | grep -q .; then
  echo 'Port 5180 is in use; choose another port before installation.' >&2; exit 1
fi
. /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || { echo 'This script expects Ubuntu 24.04.' >&2; exit 1; }

apt-get update
apt-get install -y curl ca-certificates xz-utils
bash "$(dirname "$0")/install-node.sh"

getent passwd cliente >/dev/null || useradd --system --home /var/lib/cliente --shell /usr/sbin/nologin cliente
install -d -o root -g root -m 0755 /opt/cliente/releases
install -d -o root -g cliente -m 0750 /etc/cliente
install -d -o cliente -g cliente -m 0700 /var/lib/cliente /var/lib/cliente/photos
release="/opt/cliente/releases/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$release"
tar -xzf "$archive" -C "$release"
[[ -f "$release/dist/server.js" && -f "$release/wwwroot/index.html" && -f "$release/deployment/cliente.service" ]] || {
  echo 'The archive does not contain the complete application.' >&2; exit 1;
}
chown -R root:root "$release"
chmod -R a+rX,go-w "$release"
install -o root -g cliente -m 0640 "$configuration" /etc/cliente/.env
ln -s /etc/cliente/.env "$release/.env"
ln -s "$release" /opt/cliente/current
cd /opt/cliente/current
PATH="/opt/cliente/node/bin:$PATH" /opt/cliente/node/bin/npm ci --omit=dev --ignore-scripts --no-audit --no-fund
if ! runuser -u cliente -- env CLIENTE_ENV_FILE=/etc/cliente/.env /opt/cliente/node/bin/node dist/server.js --check-database; then
  echo 'Installation files are ready, but SQL verification failed. Fix SQL connectivity/certificate configuration before finishing. No service was started.' >&2
  echo 'Then run: sudo bash /opt/cliente/current/deployment/finish-setup.sh' >&2
  exit 1
fi
bash /opt/cliente/current/deployment/finish-setup.sh
