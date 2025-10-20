#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf 'esp32-web-monitor: verificación de frontend (Nuxt build)\n'

npm --prefix "$root_dir/apps/web" ci --no-progress
npm --prefix "$root_dir/apps/web" run build >/dev/null
rm -rf "$root_dir/apps/web/node_modules" "$root_dir/apps/web/.nuxt" "$root_dir/apps/web/.output" "$root_dir/apps/web/.vercel"

printf '\nValidando contratos JSON...\n'
find "$root_dir/contracts" -name '*.json' -print0 | while IFS= read -r -d '' file; do
  jq empty "$file" >/dev/null
done
