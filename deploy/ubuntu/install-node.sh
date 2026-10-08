#!/usr/bin/env bash
# Install a private Node 24 runtime without changing other apps' Node binaries.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
case "$(uname -m)" in x86_64) architecture=x64 ;; aarch64) architecture=arm64 ;; *) echo 'Unsupported architecture.' >&2; exit 1 ;; esac
runtime=/opt/cliente/node
if [[ -x "$runtime/bin/node" ]] && [[ $("$runtime/bin/node" -p 'process.versions.node.split(".")[0]') == 24 ]]; then exit 0; fi
if ! command -v curl >/dev/null || ! command -v xz >/dev/null; then apt-get update; apt-get install -y curl ca-certificates xz-utils; fi
temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
curl --fail --silent --show-error --proto '=https' --tlsv1.2 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$temporary/SHASUMS256.txt"
filename=$(awk -v arch="$architecture" '$2 ~ ("^node-v24\\.[0-9]+\\.[0-9]+-linux-" arch "\\.tar\\.xz$") { print $2; exit }' "$temporary/SHASUMS256.txt")
[[ -n "$filename" && $filename == node-v24.*-linux-*.tar.xz ]] || { echo 'Cannot select Node 24 archive.' >&2; exit 1; }
curl --fail --silent --show-error --proto '=https' --tlsv1.2 "https://nodejs.org/dist/latest-v24.x/$filename" -o "$temporary/$filename"
(cd "$temporary"; awk -v name="$filename" '$2 == name { print }' SHASUMS256.txt | sha256sum -c -)
install -d -o root -g root -m 0755 /opt/cliente/runtimes
destination="/opt/cliente/runtimes/${filename%.tar.xz}"
[[ ! -e "$destination" ]] || { echo 'Runtime destination already exists; inspect before replacing.' >&2; exit 1; }
mkdir "$destination"
tar -xJf "$temporary/$filename" --strip-components=1 -C "$destination"
chmod -R a+rX,go-w "$destination"
ln -sfn "$destination" "$runtime"
"$runtime/bin/node" --version
