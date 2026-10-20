#!/usr/bin/env bash
# Deploy do backend no Supabase Cloud (P-08). Passo a passo e explicações: supabase/DEPLOY.md.
#
# Variáveis:
#   SUPABASE_ACCESS_TOKEN  token pessoal (https://supabase.com/dashboard/account/tokens)   [obrigatória]
#   PROJECT_REF            ref do projeto (20 letras, aparece na URL do painel)            [obrigatória]
#   SUPABASE_DB_PASSWORD   senha do banco definida ao criar o projeto                       [obrigatória]
#   WITH_SEED=1            também grava supabase/seed.sql (SÓ para demonstração: contas e zonas de demo)
#   CONFIG_PUSH=1          envia a configuração de Auth do config.toml (redirects, senha, rate limit, e-mail)
#   USE_API=1              bundling no servidor do Supabase (sem Docker); exige o plano B (npm run domain:copy)
#   SKIP_CHECKS=1          pula os testes Deno e a verificação do bundle antes de subir
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
SB="./node_modules/.bin/supabase"

: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
: "${PROJECT_REF:?defina PROJECT_REF}"
: "${SUPABASE_DB_PASSWORD:?defina SUPABASE_DB_PASSWORD}"
export SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD

[[ -x "$SB" ]] || { echo "rode npm install na raiz (CLI fixo supabase@2.121.0)"; exit 1; }

if [[ "${USE_API:-0}" == "1" && ! -d supabase/functions/_shared/domain_copy ]]; then
  echo "USE_API=1 envia os arquivos para o bundler do Supabase, que não enxerga apps/mobile: rode antes npm run domain:copy (plano B, D-02)."
  exit 1
fi

if [[ "${SKIP_CHECKS:-0}" != "1" ]]; then
  echo "==> Testes Deno das functions"
  npm run -s functions:test
  node supabase/scripts/domain-copy.mjs --check
  if [[ "${USE_API:-0}" != "1" ]]; then
    echo "==> Bundle local das functions (mesmo edge-runtime do deploy por Docker)"
    bash supabase/scripts/bundle-check.sh
  fi
fi

echo "==> Vinculando ao projeto $PROJECT_REF"
"$SB" link --project-ref "$PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"

echo "==> Migrations (supabase/migrations)"
"$SB" db push --dry-run -p "$SUPABASE_DB_PASSWORD"
if [[ "${WITH_SEED:-0}" == "1" ]]; then
  echo "    WITH_SEED=1: gravando também os dados de DEMONSTRAÇÃO (contas *.demo@nomaderun.app, zonas de Goiânia)"
  "$SB" db push --include-seed -p "$SUPABASE_DB_PASSWORD" --yes
else
  "$SB" db push -p "$SUPABASE_DB_PASSWORD" --yes
fi

if [[ "${CONFIG_PUSH:-0}" == "1" ]]; then
  echo "==> Configuração de Auth (config.toml) — confira antes com: npx supabase config diff"
  "$SB" config push --project-ref "$PROJECT_REF" --yes
fi

echo "==> Edge Functions (verify_jwt = false e import map vêm do config.toml, D-24)"
if [[ "${USE_API:-0}" == "1" ]]; then
  "$SB" functions deploy --project-ref "$PROJECT_REF" --use-api
else
  "$SB" functions deploy --project-ref "$PROJECT_REF"
fi

cat <<MSG

Pronto. No app (apps/mobile/.env):
  EXPO_PUBLIC_SUPABASE_URL=https://$PROJECT_REF.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<chave publishable/anon em Project Settings → API Keys>
Teste rápido: curl -i https://$PROJECT_REF.supabase.co/functions/v1/zones?bbox=-49.3,-16.8,-49.2,-16.7  (sem token → 401 UNAUTHORIZED)
MSG
