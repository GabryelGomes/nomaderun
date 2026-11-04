#!/usr/bin/env bash
# Publica o app no EAS Update apontando SEMPRE para o backend da nuvem (revisão nº 1, A-3).
# Lê a URL e a chave pública de apps/mobile/.env.production (nunca do .env local, que o
# `npm run celular` reescreve com o IP do seu PC) e limpa o cache do Metro antes de empacotar.
#
# Uso (na raiz):  npm run publicar -- "mensagem do update"
#   BRANCH=demo (padrão)     branch do EAS Update (o canal "demo" do APK de `npm run apk` aponta para ela)
#   EAS_ENV=preview (padrão) ambiente do EAS (o SDK 55+ exige --environment; o APK usa o "preview" do eas.json)
# Antes de publicar, confere que o app.json tem o projectId real do EAS (scripts/check-publicacao.js, D-99).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/mobile"
PROD="$APP/.env.production"
BRANCH="${BRANCH:-demo}"
EAS_ENV="${EAS_ENV:-preview}"
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

node "$APP/scripts/check-publicacao.js" "$APP/app.json" || fail "Publicação recusada: falta o projectId do EAS (supabase/DEPLOY.md §12)."

cd "$APP"
printf '\n\033[1;33m▶ Gravando o backend %s no ambiente "%s" do EAS\033[0m\n' "$URL" "$EAS_ENV"
# Mesmo valor no ambiente do EAS e no processo: o update e o build leem o mesmo backend.
npx eas-cli@latest env:set --environment "$EAS_ENV" --name EXPO_PUBLIC_SUPABASE_URL --value "$URL" --visibility plaintext --non-interactive
npx eas-cli@latest env:set --environment "$EAS_ENV" --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$KEY" --visibility plaintext --non-interactive

printf '\n\033[1;33m▶ Publicando na branch "%s" (ambiente "%s") com o backend %s\033[0m\n' "$BRANCH" "$EAS_ENV" "$URL"
# Variáveis do processo têm prioridade sobre os arquivos .env: o app publicado usa exatamente estas.
EXPO_PUBLIC_SUPABASE_URL="$URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$KEY" \
  npx eas-cli@latest update --branch "$BRANCH" --environment "$EAS_ENV" --message "$MESSAGE" --clear-cache
