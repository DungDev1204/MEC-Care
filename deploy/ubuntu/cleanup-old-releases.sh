#!/usr/bin/env bash
# Remove superseded releases and optional upload packages after production health.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
release_root=/opt/cliente/releases
[[ $# -le 2 ]] || { echo 'Supply the expected current release and optional deployed upload archive.' >&2; exit 1; }
[[ -d "$release_root" && ! -L "$release_root" && $(readlink -f "$release_root") == "$release_root" && -L /opt/cliente/current ]] || { echo 'Unexpected release layout.' >&2; exit 1; }
current=$(readlink -f /opt/cliente/current)
[[ $current == "$release_root/"* && ${current%/*} == "$release_root" ]] || { echo 'Current release is outside the release directory.' >&2; exit 1; }
[[ -z ${1:-} || $current == "$1" ]] || { echo 'Current release changed; cleanup stopped.' >&2; exit 1; }
[[ -f "$current/dist/server.js" && -f /etc/cliente/.env ]] || { echo 'Current Node release is incomplete.' >&2; exit 1; }
systemctl is-active --quiet cliente || { echo 'Cliente must be running before cleanup.' >&2; exit 1; }
pid=$(systemctl show --value --property MainPID cliente)
[[ $pid =~ ^[1-9][0-9]*$ && $(readlink -f "/proc/$pid/cwd") == "$current" ]] || { echo 'Service is not running the current release; nothing was removed.' >&2; exit 1; }
curl --max-time 15 -fsS -H 'Host: care.tranie-mua.io.vn' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5180/health |
  /opt/cliente/node/bin/node -e 'let data="";process.stdin.on("data",chunk=>data+=chunk);process.stdin.on("end",()=>{try{const h=JSON.parse(data);if(h.runtime!=="node"||h.mode!=="sqlServer"||h.status!=="running")throw Error();}catch{console.error("Node production health verification failed; nothing was removed.");process.exitCode=1;}});'
upload_root=/home/robotics/cliente-upload
keep_archive=''
is_app_package() {
  [[ $1 == cliente-node.tar.gz || $1 == cliente-linux-x64.tar.gz || $1 =~ ^cliente-(auth|subscription|announcements|scroll|release|node|ui)-[0-9]{8}(T[0-9]{6}Z)?\.tar\.gz$ ]]
}
if [[ -n ${2:-} ]]; then
  supplied_archive=$(realpath -m -- "$2")
  if [[ ${supplied_archive%/*} == "$upload_root" ]]; then
    [[ -d "$upload_root" && ! -L "$upload_root" && $(readlink -f "$upload_root") == "$upload_root" && ! -L "$2" && -f "$2" ]] || { echo 'Unsafe or missing upload archive; nothing was removed.' >&2; exit 1; }
    is_app_package "${supplied_archive##*/}" || { echo 'Unrecognized upload package name; nothing was removed.' >&2; exit 1; }
    tar -xzOf "$supplied_archive" ./wwwroot/index.html | cmp - "$current/wwwroot/index.html" || { echo 'Upload archive does not match the running frontend; nothing was removed.' >&2; exit 1; }
    keep_archive=$supplied_archive
  elif [[ "$2" == "$upload_root/"* ]]; then
    echo 'Upload archive must be a direct regular file; nothing was removed.' >&2; exit 1
  else
    echo 'Archive is outside the upload directory; upload package cleanup skipped.'
  fi
fi
while IFS= read -r -d '' candidate; do
  [[ $candidate != "$current" ]] || continue
  [[ $(readlink -f /opt/cliente/current) == "$current" ]] || { echo 'Current release changed; cleanup stopped.' >&2; exit 1; }
  [[ ${candidate%/*} == "$release_root" && ! -L "$candidate" && $(readlink -f "$candidate") == "$candidate" ]] || { echo 'Unsafe release path; cleanup stopped.' >&2; exit 1; }
  echo "Removing old Cliente release: $candidate"
  rm -rf --one-file-system -- "$candidate"
done < <(find "$release_root" -mindepth 1 -maxdepth 1 -type d -print0)
if [[ -n "$keep_archive" ]]; then
  while IFS= read -r -d '' candidate; do
    [[ $candidate != "$keep_archive" ]] || continue
    is_app_package "${candidate##*/}" || continue
    [[ $(readlink -f /opt/cliente/current) == "$current" ]] || { echo 'Current release changed; upload cleanup stopped.' >&2; exit 1; }
    [[ ${candidate%/*} == "$upload_root" && ! -L "$candidate" && -f "$candidate" && $(readlink -f "$candidate") == "$candidate" ]] || { echo 'Unsafe upload path; cleanup stopped.' >&2; exit 1; }
    echo "Removing old Cliente upload package: $candidate"
    rm -f -- "$candidate"
  done < <(find "$upload_root" -mindepth 1 -maxdepth 1 -type f -print0)
  echo "Upload cleanup complete. Retained package: $keep_archive"
fi
echo "Cleanup complete. Current release: $current"
