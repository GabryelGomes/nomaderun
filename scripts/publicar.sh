#!/usr/bin/env bash
# Publica o app no EAS Update apontando SEMPRE para o backend da nuvem (revisão nº 1, A-3).
# Lê a URL e a chave pública de apps/mobile/.env.production (nunca do .env local, que o
# `npm run celular` reescreve com o IP do seu PC) e limpa o cache do Metro antes de empacotar.
#
# Uso (na raiz):  npm run publicar -- "mensagem do update"
#   BRANCH=demo (padrão)   branch do EAS Update
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/mobile"
PROD="$APP/.env.production"
BRANCH="${BRANCH:-demo}"
MESSAGE="${1:-Atualização $(date '+%d/%m %H:%M')}"

fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$PROD" ] || fail "Falta apps/mobile/.env.production. Copie apps/mobile/.env.production.example e preencha com a URL e a chave anon/publishable do Supabase Cloud."

URL="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_URL=//p' "$PROD" | tr -d '\r' | head -1)"
KEY="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_ANON_KEY=//p' "$PROD" | tr -d '\r' | head -1)"

[[ "$URL" == https://*.supabase.co ]] || fail "EXPO_PUBLIC_SUPABASE_URL em .env.production precisa ser a URL da nuvem (https://<ref>.supabase.co). Valor atual: '${URL:-vazio}'."
[ -n "$KEY" ] || fail "EXPO_PUBLIC_SUPABASE_ANON_KEY vazia em .env.production."
case "$KEY" in
  sb_secret_*|*service_role*) fail "Essa é uma chave secreta: use a anon/publishable. A secreta nunca vai no app." ;;
esac

printf '\n\033[1;33m▶ Publicando na branch "%s" com o backend %s\033[0m\n' "$BRANCH" "$URL"
cd "$APP"
# Variáveis do processo têm prioridade sobre os arquivos .env: o app publicado usa exatamente estas.
EXPO_PUBLIC_SUPABASE_URL="$URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$KEY" \
  npx eas-cli@latest update --branch "$BRANCH" --message "$MESSAGE" --clear-cache
