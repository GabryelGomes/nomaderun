#!/usr/bin/env bash
# NOMADE RUN — F1/E9: banco local SEM Docker para aplicar as migrations e rodar os testes pgTAP.
#
# O que faz:
#   1. (opcional, NR_INSTALL=1) instala postgresql-16-postgis-3, postgresql-16-pgtap e postgresql-16-cron pelo apt;
#   2. cria um cluster Postgres 16 numa pasta temporária (porta 54329, socket na própria pasta, auth trust só local),
#      com shared_preload_libraries = 'pg_cron' e cron.database_name = 'postgres';
#   3. aplica o shim do Supabase (supabase-shim.sql, ao lado deste script);
#   4. aplica supabase/migrations/*.sql em ordem (cada arquivo numa transação, para no primeiro erro);
#   5. aplica supabase/seed.sql (NR_SEED=0 pula), como faz o `supabase db reset`;
#   6. roda supabase/tests/database/*.test.sql com psql (mesma regra de supabase/scripts/test-db.sh) e,
#      se houver pg_prove, também com pg_prove;
#   7. para o servidor (NR_KEEP=1 deixa rodando) e imprime o resumo.
#
# Uso (como root ou como um usuário comum; como root, o servidor roda como o usuário "postgres"):
#   bash docs/melhoria/F1/backend/banco-local.sh
# Variáveis:
#   NR_WORKDIR  pasta do cluster (padrão: mktemp -d /tmp/nomaderun-pg.XXXXXX). O usuário do servidor precisa
#               conseguir entrar nela (permissão x em toda a cadeia de pastas). Se a pasta desejada fica atrás de
#               uma pasta 700 do root, faça um bind mount para um caminho curto e acessível, por exemplo:
#                 mkdir -p /tmp/nr-pg-mnt && mount --bind <pasta-temporária> /tmp/nr-pg-mnt
#                 NR_WORKDIR=/tmp/nr-pg-mnt/run bash docs/melhoria/F1/backend/banco-local.sh
#               (caminho curto também evita o limite de 107 caracteres do socket Unix).
#   NR_PORT     porta (padrão 54329)      NR_SEED  1 aplica o seed (padrão 1)
#   NR_KEEP     1 não para o servidor     NR_INSTALL 1 roda o apt-get install antes
#   NR_PG_BIN   binários do Postgres (padrão /usr/lib/postgresql/16/bin)
#   NR_EXTRA_SQL    arquivos .sql aplicados depois do seed (ex.: o rascunho v2 desta pasta), separados por espaço
#   NR_EXTRA_TESTS  arquivos pgTAP extras rodados depois dos testes do projeto, separados por espaço
# Saída: 0 se todas as migrations aplicaram e nenhum teste pgTAP falhou.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
PG_BIN="${NR_PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="${NR_PORT:-54329}"
SEED="${NR_SEED:-1}"
KEEP="${NR_KEEP:-0}"
WORK="${NR_WORKDIR:-$(mktemp -d /tmp/nomaderun-pg.XXXXXX)}"
PGDATA="$WORK/pgdata"
LOG="$WORK/postgres.log"
RESULTS="$WORK/pgtap-resultado.txt"

say() { printf '\n== %s\n' "$*"; }

if [[ "${NR_INSTALL:-0}" == "1" ]]; then
  say "Instalando PostGIS, pgTAP e pg_cron (apt)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16-postgis-3 postgresql-16-pgtap postgresql-16-cron || exit 1
fi

for ext in postgis pgtap pg_cron; do
  if [[ ! -f "/usr/share/postgresql/16/extension/$ext.control" ]]; then
    echo "Extensão $ext não encontrada. Rode com NR_INSTALL=1 ou instale postgresql-16-${ext/pg_cron/cron}." >&2
    exit 1
  fi
done

# O Postgres não roda como root: como root, usa o usuário de sistema "postgres".
if [[ "$(id -u)" == "0" ]]; then
  RUN_AS="postgres"
  as_pg() { su -s /bin/bash "$RUN_AS" -c "$(printf '%q ' "$@")"; }
else
  RUN_AS="$(id -un)"
  as_pg() { "$@"; }
fi

mkdir -p "$WORK"
[[ "$(id -u)" == "0" ]] && chown "$RUN_AS" "$WORK"
if ! as_pg test -w "$WORK"; then
  echo "O usuário $RUN_AS não consegue escrever em $WORK (falta permissão x em alguma pasta acima)." >&2
  exit 1
fi

say "initdb em $PGDATA (porta $PORT, usuário $RUN_AS)"
as_pg "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >"$WORK/initdb.log" 2>&1 \
  || { cat "$WORK/initdb.log"; exit 1; }
cat >>"$PGDATA/postgresql.conf" <<EOF

# --- NOMADE RUN banco local (F1/E9) ---
port = $PORT
listen_addresses = ''
unix_socket_directories = '$WORK'
shared_preload_libraries = 'pg_cron'
cron.database_name = 'postgres'
timezone = 'UTC'
wal_level = logical
fsync = off
synchronous_commit = off
full_page_writes = off
max_connections = 30
EOF

as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOG" -w -t 60 start >/dev/null || { cat "$LOG"; exit 1; }
stop_server() {
  if [[ "$KEEP" == "1" ]]; then
    echo "Servidor continua rodando: psql -h $WORK -p $PORT -U postgres -d postgres"
    echo "Para parar: $PG_BIN/pg_ctl -D $PGDATA stop"
  else
    as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null && echo "Servidor parado."
  fi
}
trap stop_server EXIT

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)

say "Shim do Supabase"
"${PSQL[@]}" -f "$HERE/supabase-shim.sql" || exit 1

say "Migrations"
mig_ok=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  if "${PSQL[@]}" --single-transaction -f "$f" >"$WORK/migration.out" 2>&1; then
    mig_ok=$((mig_ok + 1)); echo "ok     $(basename "$f")"
  else
    echo "FALHOU $(basename "$f")"; sed 's/^/    /' "$WORK/migration.out"; exit 1
  fi
done

if [[ "$SEED" == "1" && -f "$ROOT/supabase/seed.sql" ]]; then
  say "Seed de demonstração"
  "${PSQL[@]}" --single-transaction -f "$ROOT/supabase/seed.sql" >"$WORK/seed.out" 2>&1 \
    && echo "ok     seed.sql" || { echo "FALHOU seed.sql"; sed 's/^/    /' "$WORK/seed.out"; exit 1; }
fi

for extra in ${NR_EXTRA_SQL:-}; do
  say "SQL extra: $extra"
  "${PSQL[@]}" --single-transaction -f "$extra" >"$WORK/extra.out" 2>&1 \
    && echo "ok     $(basename "$extra")" || { echo "FALHOU $(basename "$extra")"; sed 's/^/    /' "$WORK/extra.out"; exit 1; }
done

say "Testes pgTAP (psql, mesma regra de supabase/scripts/test-db.sh)"
total=0; failed=0; files_failed=0; files=0
: >"$RESULTS"
for f in "$ROOT"/supabase/tests/database/*.sql ${NR_EXTRA_TESTS:-}; do
  name="$(basename "$f")"; files=$((files + 1))
  out="$("${PSQL[@]}" -t -A <"$f" 2>&1)"; status=$?
  oks=$(grep -cE '^ok ' <<<"$out"); nots=$(grep -cE '^not ok ' <<<"$out")
  plan=$(grep -oE '^1\.\.[0-9]+' <<<"$out" | head -1 | cut -d. -f3)
  total=$((total + oks + nots))
  if [[ $status -ne 0 || $nots -gt 0 || -z "$plan" || "$plan" -ne $((oks + nots)) ]]; then
    files_failed=$((files_failed + 1)); failed=$((failed + nots))
    echo "FALHOU $name (ok=$oks, not ok=$nots, plano=${plan:-?}, saída=$status)" | tee -a "$RESULTS"
    grep -vE '^ok ' <<<"$out" | sed 's/^/    /' | tee -a "$RESULTS"
  else
    echo "ok     $name ($oks testes)" | tee -a "$RESULTS"
  fi
done
echo "Arquivos: $files · com falha: $files_failed · testes executados: $total · falhas: $failed" | tee -a "$RESULTS"

if command -v pg_prove >/dev/null 2>&1; then
  say "Conferência com pg_prove"
  # pg_prove roda cada arquivo num psql próprio; os arquivos já fazem begin/plan/finish/rollback.
  PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres \
    pg_prove --psql-bin "$PG_BIN/psql" "$ROOT"/supabase/tests/database/*.sql 2>&1 | tail -n 4 | tee -a "$RESULTS"
fi

echo "Migrations aplicadas: $mig_ok · resultado completo em $RESULTS"
[[ $files_failed -eq 0 ]]
