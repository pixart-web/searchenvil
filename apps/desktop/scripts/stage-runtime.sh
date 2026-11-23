#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../../.."
stage="apps/desktop/build/runtime"
if [[ -e "$stage" ]]; then
  echo "Move the existing stage at $stage before running a fresh build." >&2
  exit 1
fi
mkdir -p "$stage"
stage="$(cd "$stage" && pwd)"
swift apps/desktop/scripts/build-icon.swift "$stage/../searchanvil.iconset"
iconutil -c icns "$stage/../searchanvil.iconset" -o "$stage/../searchanvil.icns"

: "${SEARCHANVIL_POSTGRES:=$(brew --prefix postgresql@16)}"
: "${SEARCHANVIL_REDIS:=$(brew --prefix redis)}"
: "${SEARCHANVIL_NODE_DIST:?Set to an extracted official Node.js 22 macOS distribution}"
mkdir -p "$stage/node/bin"
cp "$SEARCHANVIL_NODE_DIST/bin/node" "$stage/node/bin/node"
cp "$SEARCHANVIL_NODE_DIST/LICENSE" "$stage/node/LICENSE"
python3 apps/desktop/scripts/stage-native-runtime.py \
  --postgres "$SEARCHANVIL_POSTGRES" --redis "$SEARCHANVIL_REDIS" "$stage/native"

pnpm db:generate
pnpm exec turbo run build --filter=@searchanvil/api... --filter=@searchanvil/worker...
pnpm --filter @searchanvil/api deploy --prod "$stage/api"
pnpm --filter @searchanvil/worker deploy --prod "$stage/worker"
pnpm --filter @searchanvil/database deploy "$stage/database"

source_client=$(find node_modules/.pnpm -path '*/.prisma/client' -type d -print -quit)
test -n "$source_client"
for component in api worker database; do
  # pnpm deploy leaves an unused self-alias targeting the source workspace.
  self_alias="$stage/$component/node_modules/.pnpm/node_modules/@searchanvil/$component"
  if [[ -L "$self_alias" ]]; then unlink "$self_alias"; fi
  prisma_client=$(find "$stage/$component/node_modules/.pnpm" -path '*/@prisma/client' -type d -print -quit)
  test -n "$prisma_client"
  generated_dir="$(dirname "$(dirname "$prisma_client")")/.prisma"
  mkdir -p "$generated_dir"
  cp -R "$source_client" "$generated_dir/client"
done

NEXT_PUBLIC_SEARCHANVIL_DESKTOP=1 pnpm --filter @searchanvil/web build
cp -R apps/web/.next/standalone "$stage/web"
cp -R apps/web/.next/static "$stage/web/apps/web/.next/static"

browser_cache="$(mktemp -d)"
trap 'rm -rf "$browser_cache"' EXIT
PLAYWRIGHT_BROWSERS_PATH="$browser_cache" \
  pnpm --filter @searchanvil/performance exec playwright-core install chromium --no-shell
browser_app="$(find "$browser_cache" -type d -name '*.app' -prune | head -1)"
test -n "$browser_app"
mkdir "$stage/chromium"
cp -R "$browser_app" "$stage/chromium/Chromium.app"
/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable'   "$browser_app/Contents/Info.plist" > "$stage/chromium/executable"
