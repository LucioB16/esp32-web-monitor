#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf 'esp32-web-monitor: verificación de frontend (Nuxt build)\n'

pushd "$root_dir/apps/web" >/dev/null
npm ci --no-progress
npm run build -- --preset deno >/dev/null
rm -rf node_modules .nuxt .output
popd >/dev/null
