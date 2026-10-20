#!/usr/bin/env bash
# Teste adversarial de segurança (T4.2, A5) contra a stack local. Pré-requisitos: `npm run db:start`,
# `npm run functions:serve` e o seed (contas de demonstração). STRICT=1 faz os achados conhecidos falharem.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
eval "$(./node_modules/.bin/supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET)=')"
export API_URL ANON_KEY SERVICE_ROLE_KEY JWT_SECRET
exec deno run --allow-net --allow-env --allow-read --config supabase/functions/deno.json supabase/tests/security/edge-security.ts
