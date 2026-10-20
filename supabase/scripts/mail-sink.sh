#!/usr/bin/env bash
# Sobe a caixa de e-mail de desenvolvimento no lugar do mailpit (quando a imagem do mailpit não está disponível).
# Requer a stack local rodando (rede supabase_network_nomaderun). Web: http://127.0.0.1:54324
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${MAIL_SINK_IMAGE:-supabase/storage-api:v1.82.1}"   # qualquer imagem com Node serve
docker rm -f supabase_inbucket_nomaderun >/dev/null 2>&1 || true
docker run -d --name supabase_inbucket_nomaderun --network supabase_network_nomaderun \
  -p 127.0.0.1:54324:8025 -v "$ROOT/supabase/scripts/mail-sink.mjs:/sink.mjs:ro" \
  --restart unless-stopped --entrypoint node "$IMAGE" /sink.mjs >/dev/null
echo "Caixa de e-mail local em http://127.0.0.1:54324"
