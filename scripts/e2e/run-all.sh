#!/usr/bin/env bash
# Runs every end-to-end check against a running app (BASE_URL, default http://localhost:3000).
# Prereqs: local Supabase (pnpm db:start), the app started with TELEGRAM_API_BASE=http://127.0.0.1:8099,
# and the mock Bot API: node scripts/e2e/mock-telegram.mjs
set -euo pipefail
cd "$(dirname "$0")"
for t in reader-login reader-progress reader-prefetch reader-unlock reader-settings full-flow admin admin-bulk import leak-audit concurrency; do
  echo "== $t"
  node "$t.mjs"
done
echo "All E2E checks passed."
