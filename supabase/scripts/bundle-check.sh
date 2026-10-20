#!/usr/bin/env bash
# P-08 / D-02: confere, sem conta no Supabase Cloud, se o bundler das Edge Functions aceita o domain do app
# (apps/mobile/src/domain, fora de supabase/). Usa o mesmo `edge-runtime bundle` que o `supabase functions deploy`
# roda no Docker, gera o eszip de cada function, confere que o código do domain está dentro e sobe o eszip de
# finish-activity num edge-runtime limpo (só o arquivo .eszip montado) para ver se responde.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${EDGE_RUNTIME_IMAGE:-supabase/edge-runtime:v1.77.4}"
OUT="$(mktemp -d)"
trap 'docker rm -f nomaderun-bundle-check >/dev/null 2>&1 || true; rm -rf "$OUT"' EXIT
# Plano A: monta o repositório (o domain vem de apps/mobile). Plano B (npm run domain:copy): monta só supabase/,
# provando que a cópia é autossuficiente, como num bundler que não enxerga fora de supabase/.
if [[ -d "$ROOT/supabase/functions/_shared/domain_copy" ]]; then MOUNT="$ROOT/supabase"; PLAN="B (cópia em _shared/domain_copy)"; else MOUNT="$ROOT"; PLAN="A (domain do app, fora de supabase/)"; fi
fail=0
for dir in "$ROOT"/supabase/functions/*/; do
  name="$(basename "$dir")"
  [[ "$name" == _* || "$name" == tests ]] && continue
  if docker run --rm -v "$MOUNT:$MOUNT:ro" -v "$OUT:/out" -w "$ROOT/supabase" "$IMAGE" \
       bundle --entrypoint "$ROOT/supabase/functions/$name/index.ts" --output "/out/$name.eszip" >/dev/null 2>"$OUT/$name.log" \
     && [[ -s "$OUT/$name.eszip" ]]; then
    echo "ok     $name ($(du -k "$OUT/$name.eszip" | cut -f1) KB)"
  else
    echo "FALHOU $name"; sed 's/^/    /' "$OUT/$name.log"; fail=1
  fi
done
[[ $fail -eq 0 ]] || exit 1

if grep -aq "applyRunPoints" "$OUT/finish-activity.eszip" && grep -aq "latLngToCell" "$OUT/finish-activity.eszip"; then
  echo "ok     eszip de finish-activity contém o domain (applyRunPoints) e o h3-js (latLngToCell)"
else
  echo "FALHOU domain ausente do eszip"; exit 1
fi

docker run -d --name nomaderun-bundle-check -v "$OUT:/out:ro" -p 127.0.0.1:19998:9999 "$IMAGE" \
  start --main-service /out/finish-activity.eszip -p 9999 >/dev/null
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS http://127.0.0.1:19998/ || true)"
  [[ "$code" == "200" ]] && break
  sleep 0.5
done
body="$(curl -s -X POST http://127.0.0.1:19998/ -H 'Content-Type: application/json' -d '{}' || true)"
if [[ "$code" == "200" && "$body" == *'"UNAUTHORIZED"'* ]]; then
  echo "ok     eszip sobe sozinho num edge-runtime limpo e responde (CORS 200; sem token → UNAUTHORIZED)"
else
  echo "FALHOU eszip não respondeu como esperado (OPTIONS=$code, POST=$body)"; docker logs nomaderun-bundle-check 2>&1 | tail -20; exit 1
fi
echo "Bundle das functions ok com o plano $PLAN da D-02."
