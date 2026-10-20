#!/usr/bin/env bash
# Integração ponta a ponta contra a stack local. Pré-requisitos: `npx supabase start` e
# `npx supabase functions serve` rodando; Deno 2 instalado.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
eval "$(./node_modules/.bin/supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export API_URL ANON_KEY SERVICE_ROLE_KEY
exec deno run --allow-net --allow-env --allow-read --config supabase/functions/deno.json supabase/scripts/e2e.ts
