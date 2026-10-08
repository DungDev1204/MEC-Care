#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run this script with sudo.' >&2; exit 1; }
cd /opt/cliente/current
export CLIENTE_ENV_FILE=/etc/cliente/.env
if systemctl is-active --quiet cliente; then
  echo 'Cliente is already running. Use normal maintenance commands rather than initial setup.' >&2; exit 1
fi
runuser -u cliente -- env CLIENTE_ENV_FILE=/etc/cliente/.env /opt/cliente/node/bin/node dist/server.js --check-database
/opt/cliente/node/bin/node dist/server.js --create-push-keys
chown root:cliente /etc/cliente/.env
chmod 0640 /etc/cliente/.env
read -r -p 'Web Push contact email: ' push_contact
/opt/cliente/node/bin/node dist/server.js --set-push-contact "$push_contact"
install -o root -g root -m 0644 deployment/cliente.service /etc/systemd/system/cliente.service
systemctl daemon-reload
systemctl enable --now cliente
systemctl is-active --quiet cliente
curl --retry 10 --retry-connrefused --retry-delay 1 -fsS \
  -H 'Host: care.tranie-mua.io.vn' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5180/health
echo
bash /opt/cliente/current/deployment/cleanup-old-releases.sh "$(readlink -f /opt/cliente/current)"
echo 'Local service is ready. Add care.tranie-mua.io.vn -> http://127.0.0.1:5180 to the existing Cloudflare Tunnel.'
