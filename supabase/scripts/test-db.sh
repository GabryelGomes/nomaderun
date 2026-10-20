#!/usr/bin/env bash
# Roda os testes pgTAP de supabase/tests/database direto no container do banco, via psql.
# Use quando `npx supabase test db` não conseguir baixar a imagem supabase/pg_prove (mesmos arquivos, mesmo
# resultado: falha se houver "not ok", erro de SQL ou plano diferente do executado).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${DB_CONTAINER:-supabase_db_nomaderun}"
total=0; failed=0; files_failed=0
for f in "$ROOT"/supabase/tests/database/*.sql; do
  name="$(basename "$f")"
  out="$(docker exec -i "$DB" psql -U postgres -d postgres -X -q -t -A -v ON_ERROR_STOP=1 < "$f" 2>&1)"
  status=$?
  oks=$(grep -cE '^ok ' <<<"$out")
  nots=$(grep -cE '^not ok ' <<<"$out")
  plan=$(grep -oE '^1\.\.[0-9]+' <<<"$out" | head -1 | cut -d. -f3)
  total=$((total + oks + nots))
  if [[ $status -ne 0 || $nots -gt 0 || -z "$plan" || "$plan" -ne $((oks + nots)) ]]; then
    files_failed=$((files_failed + 1)); failed=$((failed + nots))
    echo "FALHOU $name (ok=$oks, not ok=$nots, plano=${plan:-?}, saída=$status)"
    grep -vE '^ok ' <<<"$out" | sed 's/^/    /'
  else
    echo "ok     $name ($oks testes)"
  fi
done
echo "Arquivos com falha: $files_failed · testes executados: $total · falhas: $failed"
[[ $files_failed -eq 0 ]]
