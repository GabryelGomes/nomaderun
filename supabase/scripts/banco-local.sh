#!/usr/bin/env bash
# NOMADE RUN — banco local SEM Docker (T7.1.21, D-80): aplica as migrations e roda os testes pgTAP num
# Postgres 16 "puro" com PostGIS, pgTAP e pg_cron do apt, mais um shim do Supabase (supabase-shim.sql).
#
#   npm run db:test:local                       # na raiz: cria, aplica, testa e para (≈ 10 s)
#   NR_KEEP=1 npm run db:test:local             # deixa o banco rodando para explorar com psql
#   NR_INSTALL=1 npm run db:test:local          # 1ª vez: instala os pacotes pelo apt (como root)
#
# O que faz:
#   1. (NR_INSTALL=1) apt-get install postgresql-16-postgis-3 postgresql-16-pgtap postgresql-16-cron;
#   2. initdb numa pasta temporária (porta 54329, socket na própria pasta, sem TCP, auth trust só local),
#      com shared_preload_libraries = 'pg_cron', cron.database_name = 'postgres' e timezone UTC (como no Supabase);
#   3. aplica o shim do Supabase (roles anon/authenticated/service_role, auth.users, auth.uid(), storage, publicação
#      supabase_realtime e os privilégios padrão do schema public);
#   4. aplica supabase/migrations/*.sql em ordem, cada arquivo numa transação; para no primeiro erro;
#   5. aplica supabase/seed.sql (NR_SEED=0 pula), como o `supabase db reset`;
#   6. roda supabase/tests/database/*.sql com psql (mesma regra de supabase/scripts/test-db.sh: falha com "not ok",
#      erro de SQL ou plano diferente do executado) e confere com pg_prove, se existir;
#   7. para o servidor e apaga a pasta temporária (NR_KEEP=1 deixa tudo rodando).
#
# Variáveis:
#   NR_WORKDIR      pasta do cluster (padrão: mktemp -d /tmp/nomaderun-pg.XXXXXX, apagada no fim)
#   NR_PORT         porta do socket (padrão 54329)       NR_SEED     1 aplica o seed (padrão 1)
#   NR_KEEP         1 não para o servidor                NR_INSTALL  1 roda o apt-get install antes
#   NR_PG_BIN       binários (padrão /usr/lib/postgresql/16/bin)
#   NR_PG_PROVE     0 pula a conferência com pg_prove (padrão 1)
#   NR_EXTRA_SQL    arquivos .sql aplicados depois do seed, separados por espaço
#   NR_EXTRA_TESTS  arquivos pgTAP extras, rodados depois dos do projeto, separados por espaço
#
# Como root, o servidor roda como o usuário de sistema "postgres", que precisa entrar na pasta (permissão x em
# toda a cadeia). Se NR_WORKDIR fica atrás de uma pasta 700 do root (ex.: a pasta de rascunho de um agente), o
# script faz sozinho um bind mount para um caminho curto em /tmp (o socket Unix aceita no máximo 107 caracteres)
# e desfaz o mount no fim. Os dados continuam fisicamente em NR_WORKDIR.
#
# Não é o Supabase: não há PostgREST, GoTrue, Realtime nem Storage API. O pre-request (check_request), a RLS no
# canal do Realtime e o upload de avatar continuam no e2e com Docker (npm run db:start && npm run e2e).
# Saída: 0 se todas as migrations aplicaram e nenhum teste pgTAP falhou.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PG_BIN="${NR_PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="${NR_PORT:-54329}"
SEED="${NR_SEED:-1}"
KEEP="${NR_KEEP:-0}"
PROVE="${NR_PG_PROVE:-1}"
CREATED_WORK=0
if [[ -n "${NR_WORKDIR:-}" ]]; then
  WORK="$NR_WORKDIR"
else
  WORK="$(mktemp -d /tmp/nomaderun-pg.XXXXXX)"; CREATED_WORK=1
fi
MOUNTED=""

say() { printf '\n== %s\n' "$*"; }

if [[ "${NR_INSTALL:-0}" == "1" ]]; then
  say "Instalando PostGIS, pgTAP e pg_cron (apt)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16-postgis-3 postgresql-16-pgtap postgresql-16-cron || exit 1
fi

if [[ ! -x "$PG_BIN/initdb" ]]; then
  echo "Postgres 16 não encontrado em $PG_BIN (defina NR_PG_BIN ou instale postgresql-16)." >&2
  exit 1
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
  if [[ "$(id -u)" == "0" ]] && command -v mount >/dev/null 2>&1; then
    MNT="$(mktemp -d /tmp/nr-pg-mnt.XXXXXX)"
    chmod 755 "$MNT"
    if mount --bind "$WORK" "$MNT"; then
      MOUNTED="$MNT"; WORK="$MNT"
      echo "Pasta inacessível para $RUN_AS: usando bind mount em $MNT"
    else
      rmdir "$MNT"
    fi
  fi
  if ! as_pg test -w "$WORK"; then
    echo "O usuário $RUN_AS não consegue escrever em $WORK (falta permissão x em alguma pasta acima)." >&2
    exit 1
  fi
fi
if (( ${#WORK} > 80 )); then
  echo "Caminho $WORK é longo demais para o socket Unix (máx. ~107 caracteres com o nome do arquivo)." >&2
  exit 1
fi

PGDATA="$WORK/pgdata"
LOG="$WORK/postgres.log"
RESULTS="$WORK/pgtap-resultado.txt"
STARTED=0

cleanup() {
  if [[ "$KEEP" == "1" ]]; then
    if [[ $STARTED -eq 1 ]]; then
      echo "Servidor continua rodando: $PG_BIN/psql -h $WORK -p $PORT -U postgres -d postgres"
      echo "Para parar: $PG_BIN/pg_ctl -D $PGDATA stop${MOUNTED:+ && umount $MOUNTED}"
    fi
    return
  fi
  if [[ $STARTED -eq 1 ]]; then
    as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null && echo "Servidor parado."
  fi
  if [[ -n "$MOUNTED" ]]; then
    umount "$MOUNTED" && rmdir "$MOUNTED"
    WORK="${NR_WORKDIR:-$WORK}"
  fi
  if [[ $CREATED_WORK -eq 1 ]]; then
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

if [[ -e "$PGDATA" ]]; then
  echo "$PGDATA já existe: use outra NR_WORKDIR ou apague a pasta." >&2
  exit 1
fi

say "initdb em $PGDATA (porta $PORT, usuário $RUN_AS)"
as_pg "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >"$WORK/initdb.log" 2>&1 \
  || { cat "$WORK/initdb.log"; exit 1; }
cat >>"$PGDATA/postgresql.conf" <<EOF

# --- NOMADE RUN banco local (supabase/scripts/banco-local.sh) ---
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
STARTED=1

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
  if "${PSQL[@]}" --single-transaction -f "$ROOT/supabase/seed.sql" >"$WORK/seed.out" 2>&1; then
    echo "ok     seed.sql"
  else
    echo "FALHOU seed.sql"; sed 's/^/    /' "$WORK/seed.out"; exit 1
  fi
fi

for extra in ${NR_EXTRA_SQL:-}; do
  say "SQL extra: $extra"
  if "${PSQL[@]}" --single-transaction -f "$extra" >"$WORK/extra.out" 2>&1; then
    echo "ok     $(basename "$extra")"
  else
    echo "FALHOU $(basename "$extra")"; sed 's/^/    /' "$WORK/extra.out"; exit 1
  fi
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

if [[ "$PROVE" == "1" ]] && command -v pg_prove >/dev/null 2>&1; then
  say "Conferência com pg_prove"
  # pg_prove roda cada arquivo num psql próprio; os arquivos já fazem begin/plan/finish/rollback.
  PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres \
    pg_prove --psql-bin "$PG_BIN/psql" "$ROOT"/supabase/tests/database/*.sql ${NR_EXTRA_TESTS:-} 2>&1 | tail -n 4 | tee -a "$RESULTS"
fi

echo "Migrations aplicadas: $mig_ok"
[[ $files_failed -eq 0 ]]
