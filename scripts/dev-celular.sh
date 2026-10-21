#!/usr/bin/env bash
# Sobe tudo para testar no celular (Expo Go) e mostra o QR code:
#   backend Supabase local + Edge Functions + .env do app com o IP da rede + Expo.
# Uso (na raiz do repositório):  npm run celular
#   IP=192.168.0.10 npm run celular   → força o IP (ex.: se a detecção errar)
#   NO_START=1 npm run celular        → só configura, não abre o Expo
#   ONLINE=1 npm run celular          → Expo com conta (por padrão roda offline, sem login)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/mobile"
LOG_DIR="$ROOT/supabase/.temp"
mkdir -p "$LOG_DIR"
cd "$ROOT"

say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# 1. Docker
say "Conferindo o Docker"
docker info >/dev/null 2>&1 || fail "Docker não está rodando. Abra o Docker Desktop (ou 'sudo service docker start') e rode de novo."

# 2. Dependências
[ -d "$ROOT/node_modules" ] || { say "Instalando dependências da raiz"; npm install; }
[ -d "$APP/node_modules" ] || { say "Instalando dependências do app"; (cd "$APP" && npm install); }

# 3. Supabase local
say "Subindo o Supabase local (a primeira vez demora)"
if docker ps -a --format '{{.Names}}' | grep -q '^supabase_db_nomaderun$'; then
  # Containers já existem (ex.: o Docker acabou de ligar): espera ficarem prontos antes de decidir.
  docker start $(docker ps -a --format '{{.Names}}' | grep '_nomaderun$') >/dev/null 2>&1 || true
  for _ in $(seq 1 45); do
    npx supabase status -o env >/dev/null 2>&1 && break
    sleep 2
  done
fi
if ! npx supabase status -o env >/dev/null 2>&1; then
  npm run db:start
fi
ENV_OUT="$(npx supabase status -o env 2>/dev/null || true)"
ANON="$(printf '%s\n' "$ENV_OUT" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
[ -n "$ANON" ] || fail "Não consegui ler a ANON_KEY em 'npx supabase status -o env'."

# 4. Edge Functions
code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/functions/v1/zones || true)"
if [ "$code" != "401" ] && [ "$code" != "200" ]; then
  say "Subindo as Edge Functions em segundo plano (log: supabase/.temp/functions.log)"
  nohup npx supabase functions serve > "$LOG_DIR/functions.log" 2>&1 &
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/functions/v1/zones || true)"
    [ "$code" = "401" ] && break
    sleep 2
  done
fi

# 5. IP que o celular alcança
detect_ip() {
  if [ -n "${IP:-}" ]; then echo "$IP"; return; fi
  local ip
  ip="$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -1 || true)"
  [ -n "$ip" ] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  # WSL em modo NAT dá um 172.16–31.x interno: pergunta ao Windows o IP da placa com gateway.
  if grep -qi microsoft /proc/version 2>/dev/null && [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]; then
    local win
    win="$(powershell.exe -NoProfile -Command \
      "(Get-NetIPConfiguration | Where-Object { \$_.IPv4DefaultGateway -ne \$null -and \$_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress" \
      2>/dev/null | tr -d '\r' | head -1)"
    [ -n "$win" ] && ip="$win"
  fi
  echo "$ip"
}
LAN_IP="$(detect_ip)"
[ -n "$LAN_IP" ] || fail "Não consegui descobrir o IP. Rode com IP=<seu IP> npm run celular"
say "IP para o celular: $LAN_IP"

# 6. .env do app (mantém as outras variáveis)
ENV_FILE="$APP/.env"
touch "$ENV_FILE"
tmp="$(mktemp)"
grep -vE '^EXPO_PUBLIC_SUPABASE_(URL|ANON_KEY)=' "$ENV_FILE" > "$tmp" || true
{
  cat "$tmp"
  echo "EXPO_PUBLIC_SUPABASE_URL=http://$LAN_IP:54321"
  echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON"
} > "$ENV_FILE"
rm -f "$tmp"
say ".env do app atualizado (apps/mobile/.env)"

# 7. Teste rápido: o backend responde pelo IP da rede?
code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://$LAN_IP:54321/auth/v1/health" -H "apikey: $ANON" || true)"
if [ "$code" != "200" ]; then
  printf '\n\033[1;31m⚠ Daqui não consegui acessar http://%s:54321 (código %s).\033[0m\n' "$LAN_IP" "$code"
  echo "  Teste no NAVEGADOR DO CELULAR: http://$LAN_IP:54321/auth/v1/health"
  echo "  Se aparecer um texto/JSON, está tudo certo: ignore este aviso e leia o QR code."
  if grep -qi microsoft /proc/version 2>/dev/null; then
    WSL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    if [ "$WSL_IP" != "$LAN_IP" ]; then
      echo "  Se não abrir, o WSL está no modo NAT. No PowerShell COMO ADMINISTRADOR rode:"
      echo "    netsh interface portproxy add v4tov4 listenport=54321 listenaddress=0.0.0.0 connectport=54321 connectaddress=$WSL_IP"
      echo "    netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$WSL_IP"
      echo "    New-NetFirewallRule -DisplayName \"NOMADE RUN\" -Direction Inbound -Protocol TCP -LocalPort 8081,54321 -Action Allow"
      echo "  (o IP do WSL muda ao reiniciar o Windows; se mudar, refaça os dois netsh)"
    else
      echo "  Se não abrir (rede espelhada), no PowerShell COMO ADMINISTRADOR rode:"
      echo "    Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow"
      echo "    New-NetFirewallRule -DisplayName \"NOMADE RUN\" -Direction Inbound -Protocol TCP -LocalPort 8081,54321 -Action Allow"
    fi
  else
    echo "  Se não abrir, libere as portas 8081 e 54321 no firewall deste computador."
  fi
fi

[ -n "${NO_START:-}" ] && { say "Configuração pronta (NO_START)."; exit 0; }

# 8. Expo com o QR code apontando para o IP da rede
say "Abrindo o Expo — leia o QR code com o Expo Go (Android) ou a câmera (iPhone)"
cd "$APP"
# --offline: o Expo não fala com os servidores da Expo, então não pede conta nem login
# (nem no computador nem no Expo Go). Para o modo normal (com conta): ONLINE=1 npm run celular
if [ -n "${ONLINE:-}" ]; then
  REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" exec npx expo start --clear
fi
REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" exec npx expo start --clear --offline
