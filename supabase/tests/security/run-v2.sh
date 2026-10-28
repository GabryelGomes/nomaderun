#!/usr/bin/env bash
# Casos adversariais da v2 (T7.3.8) contra a stack local. Pré-requisitos: `npm run db:start` e `npm run functions:serve`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
eval "$(./node_modules/.bin/supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export API_URL ANON_KEY SERVICE_ROLE_KEY
exec deno run --allow-net --allow-env --allow-read --config supabase/functions/deno.json supabase/tests/security/v2-security.ts
