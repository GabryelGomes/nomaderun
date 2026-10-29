#!/usr/bin/env bash
# Gera um APK do app na nuvem do EAS (não precisa de Android Studio) para instalar direto
# no celular Android, apontando SEMPRE para o backend da nuvem.
# Lê a URL e a chave pública de apps/mobile/.env.production (igual ao `npm run publicar`),
# grava as duas como variáveis do ambiente "preview" do EAS e dispara o build do perfil
# "preview" (eas.json): APK, distribuição interna, canal "demo" do EAS Update.
#
# Uso (na raiz):  npm run apk
# Ao terminar, o EAS mostra um link e um QR code para baixar o .apk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/mobile"
PROD="$APP/.env.production"

fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$PROD" ] || fail "Falta apps/mobile/.env.production. Copie apps/mobile/.env.production.example e preencha com a URL e a chave anon/publishable do Supabase Cloud."

URL="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_URL=//p' "$PROD" | tr -d '\r' | head -1)"
KEY="$(sed -n 's/^EXPO_PUBLIC_SUPABASE_ANON_KEY=//p' "$PROD" | tr -d '\r' | head -1)"

[[ "$URL" == https://*.supabase.co ]] || fail "EXPO_PUBLIC_SUPABASE_URL em .env.production precisa ser a URL da nuvem (https://<ref>.supabase.co). Valor atual: '${URL:-vazio}'."
[ -n "$KEY" ] || fail "EXPO_PUBLIC_SUPABASE_ANON_KEY vazia em .env.production."
case "$KEY" in
  sb_secret_*|*service_role*) fail "Essa é uma chave secreta: use a anon/publishable. A secreta nunca vai no app." ;;
esac

cd "$APP"
printf '\n\033[1;33m▶ Gravando o backend %s no ambiente "preview" do EAS\033[0m\n' "$URL"
# A chave anon/publishable é pública por natureza (vai dentro do app), por isso "plaintext".
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "$URL" --visibility plaintext --non-interactive
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$KEY" --visibility plaintext --non-interactive

printf '\n\033[1;33m▶ Gerando o APK na nuvem do EAS (leva uns 10 a 20 minutos)\033[0m\n'
npx eas-cli@latest build --platform android --profile preview
