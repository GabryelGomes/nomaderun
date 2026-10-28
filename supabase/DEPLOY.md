# Deploy do backend no Supabase Cloud (P-08)

> Dono: A2 Backend. Vale para o CLI fixo no `package.json` da raiz (`supabase@2.121.0`).
> Resumo: `SUPABASE_ACCESS_TOKEN=… PROJECT_REF=… SUPABASE_DB_PASSWORD=… npm run deploy` (script `supabase/scripts/deploy.sh`).

## 0. Antes de começar

- Node 22 e `npm install` na raiz (instala o CLI); Docker rodando (o CLI usa o Docker para empacotar as functions); Deno 2 para os testes (`npm i -g deno@2.5.6`).
- Confira localmente: `npm run db:reset`, `npm run db:test:psql`, `npm run functions:test`, `npm run functions:check`, `npm run e2e`. Sem Docker, o banco e o pgTAP rodam com `npm run db:test:local` (seção 0.1).

## 0.1 Testes do banco sem Docker (`npm run db:test:local`, D-80)

Obrigatório antes de cada commit em `supabase/` (Fase 7). Usa um Postgres 16 "puro" com PostGIS, pgTAP e pg_cron do apt e um **shim do Supabase** (`supabase/scripts/supabase-shim.sql`: roles `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`/`auth.jwt()`, `storage.buckets`/`objects`, publicação `supabase_realtime` e os privilégios padrão do `public`).

```bash
NR_INSTALL=1 npm run db:test:local   # 1ª vez, como root: instala postgresql-16-postgis-3, -pgtap e -cron pelo apt
npm run db:test:local                # cria o cluster, aplica shim + migrations + seed, roda o pgTAP e para (≈ 10 s)
NR_SEED=0 npm run db:test:local      # sem o seed de demonstração
NR_KEEP=1 npm run db:test:local      # deixa o banco rodando; o script imprime o psql e o comando para parar
```

| Variável | Padrão | Para quê |
|---|---|---|
| `NR_WORKDIR` | `mktemp -d /tmp/nomaderun-pg.XXXXXX` (apagada no fim) | pasta do cluster; o socket fica nela (sem TCP) |
| `NR_PORT` | `54329` | número do socket (não conflita com o `supabase start`, que usa 54322) |
| `NR_SEED` / `NR_KEEP` / `NR_PG_PROVE` | `1` / `0` / `1` | seed, manter rodando, conferir com `pg_prove` |
| `NR_EXTRA_SQL` / `NR_EXTRA_TESTS` | vazio | SQL e testes pgTAP extras (ex.: rascunhos) |
| `NR_PG_BIN` | `/usr/lib/postgresql/16/bin` | binários do Postgres |

- **Regra de aprovação:** igual à de `supabase/scripts/test-db.sh` (falha com `not ok`, erro de SQL ou plano diferente do executado) e, se houver `pg_prove`, a mesma lista confere pelo `pg_prove`.
- **Como root:** o servidor roda como o usuário `postgres`. Se `NR_WORKDIR` fica atrás de uma pasta `700` (ex.: pasta de rascunho de um agente), o script faz um **bind mount** para um caminho curto em `/tmp` (o socket Unix aceita no máximo 107 caracteres) e desfaz no fim.
- **O que não cobre:** não há PostgREST, GoTrue, Realtime nem Storage API. O pre-request (`check_request`), a RLS no canal do Realtime e o upload de avatar ficam para o `npm run e2e` com Docker. O local usa Postgres 16 e o `config.toml` usa 17: a validação final continua sendo `npm run db:reset && npm run db:test:psql`.
- **Uma migration nova que dependa de outra parte do Supabase** (`pg_net`, `vault`, `pgsodium`) precisa de um trecho novo no shim.
- **Domain fora de `supabase/` (D-02/D-22):** `npm run functions:bundle-check` roda o mesmo `edge-runtime bundle` que o `supabase functions deploy` usa no Docker, gera o eszip das 8 functions, confere que o domain e o h3-js estão dentro e sobe o eszip de `finish-activity` num edge-runtime limpo (só o arquivo `.eszip` montado). Resultado em 2026-10-20: **ok** — o deploy padrão (Docker) aceita o domain do app (plano A). O que não deu para testar sem conta: o upload do eszip para a API do Supabase (o proxy deste ambiente bloqueia `api.supabase.com`), que não reprocessa os imports.

## 1. Criar o projeto

1. <https://supabase.com/dashboard> → **New project** → região **South America (São Paulo)** → anote a **senha do banco**.
2. Anote o **Project ref** (20 letras na URL `…/project/<ref>`).
3. Crie um token pessoal em **Account → Access Tokens**.

## 2. Vincular, migrations e functions

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...      # nunca commitar
export PROJECT_REF=abcdefghijklmnopqrst
export SUPABASE_DB_PASSWORD='...'
npm run deploy                            # = bash supabase/scripts/deploy.sh
```

O script faz, nesta ordem:

| Passo | Comando | Observação |
|---|---|---|
| Testes | `npm run functions:test`, `domain-copy.mjs --check`, `bundle-check.sh` | `SKIP_CHECKS=1` pula |
| Vincular | `supabase link --project-ref $PROJECT_REF -p $SUPABASE_DB_PASSWORD` | |
| Banco | `supabase db push --dry-run` e depois `supabase db push` | aplica `supabase/migrations` (PostGIS, pg_cron, RLS, RPCs, jobs, Realtime em `zones` e `notifications`) |
| Seed | `supabase db push --include-seed` **só com `WITH_SEED=1`** | dados de **demonstração** (271 zonas de Goiânia, contas `*.demo@nomaderun.app` com senhas públicas no PROGRESSO). Em produção real, não use; para a apresentação, use e troque as senhas depois |
| Auth | `supabase config push --yes` **só com `CONFIG_PUSH=1`** | veja a seção 3; rode `npx supabase config diff` antes |
| Functions | `supabase functions deploy` | as 8 functions; `verify_jwt = false` e `import_map = ./functions/deno.json` vêm do `config.toml` (D-24) |

Manual equivalente: os mesmos comandos com `npx supabase ...`.

### Secrets

Nenhum segredo próprio é necessário: o Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nas functions (`_shared/supabase.ts` só lê esses três). Se o projeto usar só as chaves novas (`sb_secret_…`) e não injetar a `SUPABASE_SERVICE_ROLE_KEY`, defina: `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<sb_secret_...>` (nomes com prefixo `SUPABASE_` podem ser recusados pelo CLI; nesse caso ative as chaves legadas em **Project Settings → API Keys**). Nunca coloque a service role no app.

## 3. Auth (painel ou `CONFIG_PUSH=1`)

Em **Authentication → Sign In / Providers / URL Configuration / Rate Limits / Emails** (ou `CONFIG_PUSH=1`, que envia o `config.toml`):

- **E-mail e senha** ligados; senha mínima **8**; **Confirm email desligado** no MVP (D-21) — ligue se houver SMTP.
- **JWT expiry 3600 s**, rotação de refresh token ligada.
- **Site URL** `nomaderun://`; **Redirect URLs**: `nomaderun://**`, `exp://**` (Expo Go), `http://localhost:8081/**` e a URL do painel web se publicado.
- **Rate limit de login/cadastro (P-09, QA-06):** o `config.toml` usa `sign_in_sign_ups = 3` por 5 min **por IP** (≈ RNF-007). O limite soma cadastro, login **e a conferência de senha da exclusão de conta** (`account-delete` reautentica pelo Auth). Só vale no Cloud (o Auth local não vê o IP do cliente). **Para a apresentação** (banca e plateia na mesma rede saem pelo mesmo IP/NAT):
  1. Antes (no dia anterior): **Authentication → Rate Limits → "Sign-ups and sign-ins"** = **30** por 5 min (ou `sign_in_sign_ups = 30` no `config.toml` e `npx supabase config push`). Confira com 4 logins seguidos do mesmo aparelho (nenhum `429`).
  2. Não mude `token_refresh` (150) nem os demais.
  3. Depois da apresentação: volte para **3** (valor do RNF-007, D-21) e confira com `npx supabase config diff` que não sobrou diferença.
  Se travar no meio (`429` / "Muitas tentativas"), suba o limite no painel; vale na hora, sem redeploy.
- **Troca de senha com reautenticação:** `secure_password_change = true` (QA-06) — vai no `config push`; no painel: **Authentication → Providers → Email → Secure password change**.
- **Conta inativada sem acesso (QA-07):** a migration `20261022120000_qa_hardening.sql` faz `alter role authenticator set pgrst.db_pre_request = 'public.check_request'` e `notify pgrst, 'reload config'`. Depois do `db push`, confira no SQL Editor: `select setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticator';` deve listar `pgrst.db_pre_request=public.check_request`. Se o Cloud recusar o `alter role`, rode a linha no SQL Editor (as policies restritivas continuam barrando a conta inativa de qualquer forma).
- **Linhas por resposta (QA-04):** `max_rows = 2000` em `[api]` (painel: **Project Settings → Data API → Max rows**). O `/zones` não depende disso (usa `zones_in_bbox_json`).
- **SMTP (opcional):** o envio padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para testes. Para recuperação de senha confiável, configure um SMTP (Resend, SendGrid, Brevo) em **Authentication → Emails → SMTP Settings**; o modelo em pt-BR é `supabase/templates/recovery.html`. No plano gratuito sem SMTP o Supabase recusa trocar o modelo e o `config push` falha inteiro; por isso a seção `[auth.email.template.recovery]` do `config.toml` fica comentada — descomente só depois de configurar o SMTP.
- Google/Apple só com credenciais reais (P-06).

## 4. Conferir

```bash
curl -i "https://$PROJECT_REF.supabase.co/functions/v1/zones?bbox=-49.3,-16.8,-49.2,-16.7"   # 401 UNAUTHORIZED (sem token) = function no ar
npx supabase migration list            # todas as migrations aplicadas no remoto
npx supabase db advisors --linked      # segurança e desempenho
```

Depois, rode o e2e contra o Cloud (cria e apaga uma conta de teste; precisa da service role, use só no seu terminal):

```bash
API_URL=https://$PROJECT_REF.supabase.co ANON_KEY=<publishable/anon> SERVICE_ROLE_KEY=<service role> \
  deno run --allow-net --allow-env --allow-read --config supabase/functions/deno.json supabase/scripts/e2e.ts
```
(o trecho de RN-010 do e2e usa a conta de moderador de demonstração: só passa com `WITH_SEED=1`).

No app (`apps/mobile/.env`): `EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co` e `EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon>`.

## 5. Se o deploy das functions falhar por causa do domain (plano B da D-02)

Sintoma: erro de módulo não encontrado em `apps/mobile/src/domain/...` no deploy, ou uso de `--use-api` (bundling no servidor do Supabase, que só recebe os arquivos de `supabase/`).

```bash
npm run domain:copy            # copia o domain para supabase/functions/_shared/domain_copy e aponta a ponte para a cópia
npm run functions:test         # o teste domain_bridge confere que a cópia é idêntica ao domain
npm run functions:bundle-check # no plano B monta só supabase/ (prova que a cópia é autossuficiente)
npm run deploy                 # ou USE_API=1 npm run deploy (sem Docker)
npm run domain:copy:restore    # volta ao plano A depois do deploy (não commite a cópia sem combinar com a coordenação)
```

Mudou o domain? Rode `npm run domain:copy` de novo antes do próximo deploy (`npm run domain:copy:check` falha se a cópia estiver velha; o `deploy.sh` roda essa checagem).

## 6. Jobs e Realtime

- Os 4 jobs do pg_cron do MVP (RN-004, RN-005, RN-006, RN-014) são criados pela migration; a v2 soma mais 4 (§10). Confira em **Database → Cron Jobs** (horários em UTC = Brasília + 3 h).
- Realtime: `zones` (mapa) e `notifications` (central, P-13) estão na publicação `supabase_realtime`; a RLS vale para quem assina.

## 7. Servidor v2 (Fase 7, D-80): migrations atrás de flags

- **Ordem:** backup (`npx supabase db dump --linked -f backup-<data>.sql` e `--data-only`) → `npm run db:test:local` (ou `db:reset` + `db:test:psql`) → `npx supabase db push --dry-run` e `db push` → functions → EAS Update → flags, uma por vez.
- **Migrations da onda 1** (`20261023120000` a `20261023120600`): contrato (`game_config`, `server_info`, `xp_ledger`), cosméticos e medalhas, baú do dia, Raid, Liga, missões e trilha, sequência v2. Todas aditivas; com as flags desligadas o app publicado não vê diferença. A única mudança em objeto antigo é o `CHECK` de `notifications.type`, trocado por um superconjunto na mesma instrução, e o `job_close_week`, que só muda de regra com `features.streakV2`.
- **Jobs novos:** `nomaderun-raid-tick` (`*/10 * * * *`) e `nomaderun-close-league` (`20 6 * * 1` = segunda 03:20 BRT). Realtime ganha `raids`.
- **Segredo do baú do dia:** a migration gera `private.server_secrets('daily_chest_hmac')` com 32 bytes aleatórios no próprio banco (nada no repositório). Para trocar: `update private.server_secrets set value = extensions.gen_random_bytes(32) where name = 'daily_chest_hmac';` (os baús já abertos não mudam).
- **Ligar uma feature:** `update public.game_config set value = value || '{"raid": true}' where key = 'features';`. **Desligar** (volta atrás na hora): o mesmo com `false`. Ordem sugerida, depois do EAS Update: `dailyChest`, `missions`, `track`, `raid`, `league`, `streakV2`. A gravação v2 do `finish-activity` (onda 2) é que alimenta raid, liga, missões e baú com as corridas; antes dela, as telas abrem, mas só as RPCs do app mexem nos dados.
- **Conferir depois do `db push`:** `select public.server_info();` no SQL Editor (como `authenticated`, com `set role`), `select jobname, schedule from cron.job;` e `npx supabase db advisors --linked`.

## 8. Onda 2 (T7.2.1 e T7.2.2): gravação v2, pintura, feed, recordes, LGPD v2

### 8.1 O que sobe

| Ordem | O quê | Observação |
|---|---|---|
| 1 | Backup | `npx supabase db dump --linked -f backup-<data>.sql` e `--data-only` |
| 2 | Testes locais | `npm run db:test:local` (716 pgTAP), `npx -y deno test --allow-read --config supabase/functions/deno.json supabase/functions/tests` e o `deno check` das 8 functions. Com o seed v2: `NR_EXTRA_SQL="supabase/seed_v2_demo.sql supabase/seed_v2_demo.sql" NR_EXTRA_TESTS=supabase/tests/seed/seed_v2_demo.test.sql npm run db:test:local` |
| 3 | Migrations | `npx supabase db push --dry-run` e `db push`: `20261023120700_paint`, `…120800_records_social`, `…120900_v2_recording`, `…121000_engagement_lgpd`. Todas aditivas. Objetos antigos tocados: `private.raid_boss_for_week` (D-84) e os comandos dos jobs `nomaderun-decay-zones` e `nomaderun-fortify-zones` (mesmo nome e horário; agora só rodam com `territory_rule = 'v1'`) |
| 4 | Functions | `npx supabase functions deploy finish-activity moderate-activity account-export` (as outras não mudaram; o `bundle-check` continua valendo). Com as flags desligadas, a resposta é a mesma de antes |
| 5 | EAS Update | o app novo, que lê `extras` e as RPCs novas |
| 6 | Flags, uma por vez | abaixo |
| 7 | Seed v2 (só demonstração/apresentação) | `psql "$DB_URL" -f supabase/seed_v2_demo.sql` depois do `seed.sql`. Idempotente; não liga flag; não cria Raid nem Liga (D-76); a conta nova `parceira_demo` não tem senha |

**Compatibilidade.** App antigo × servidor novo: igual a hoje enquanto as flags estiverem desligadas; com flags ligadas, só ganha o campo `extras`, que ele ignora (com `missions` ligada, o `xp` da resposta passa a ser o XP v2 da atividade; com o território v2, os `zones[].outcome` refletem a pintura). App novo × servidor antigo: `server_info` não existe (`PGRST202`) e o finish não manda `extras` → o app mostra o modo atual. Function nova × banco sem as migrations da onda 2: `svc_v2_context` não existe → a v2 falha, é registrada no log e a resposta sai sem `extras` (a v1 nunca é afetada). Por isso a ordem é migrations → functions.

### 8.2 Flags (ordem sugerida, depois do EAS Update)

```sql
update public.game_config set value = value || '{"records": true}' where key = 'features';     -- recordes e parciais
update public.game_config set value = value || '{"missions": true, "dailyChest": true, "track": true}' where key = 'features';  -- XP em linhas, missões, baú
update public.game_config set value = value || '{"feed": true}' where key = 'features';        -- feed da crew e aplausos
update public.game_config set value = value || '{"raid": true}' where key = 'features';        -- o job abre o chefão na segunda 06:00
update public.game_config set value = value || '{"league": true}' where key = 'features';      -- liga semanal
```
Desligar é o mesmo comando com `false` (volta atrás na hora; o que já foi gravado fica).

### 8.3 Virada do território (D-62), na troca de temporada

1. Confirme que o app publicado já tem a pintura (EAS Update) e que `job_fade_cells` está agendado (`select jobname, schedule, command from cron.job;`).
2. `update public.game_config set value = '"v2"' where key = 'territory_rule';` — o trigger `game_config_territory_switch` aplica a herança na mesma transação: cada zona com dono recebe 3 trechos virtuais do dono por 7 dias (`inherit_*`), `rule_version = 2`. `select public.job_territory_switch();` refaz (idempotente).
3. Daí em diante: o `finish-activity` pinta (`zone_cells`, `paint_marks`), o `job_fade_cells` (03:00 BRT) desbota e reavalia os donos, e o decaimento/fortificar por influência deixam de rodar.
4. **Volta atrás:** `update public.game_config set value = '"v1"' where key = 'territory_rule';`. As zonas ficam com o dono e a influência-espelho (trechos × 10) e a regra v1 continua a partir daí; os trechos ficam guardados (invisíveis na v1) para uma nova virada.

### 8.4 Conferir

- `select public.zone_paint_near(-16.7097, -49.2388, 1500);` (como `authenticated`): sem `painted_at`, sem autor, sem trecho em zona de privacidade.
- Uma corrida de teste com `missions` ligada: `select v2_extras from public.activities where id = '<id>';` e `select * from public.xp_ledger where ref = '<id>';`.
- `select public.svc_account_export_v2('<user>') ? 'xpLedger';` → `true`.
- `npx supabase db advisors --linked` (RLS e `search_path` das funções novas).

## 9. Onda 3 (T7.3.8): paintedToday, pauseAvailable, resumo da semana, telemetria

| Ordem | O quê | Observação |
|---|---|---|
| 1 | Backup | como na §8.1 |
| 2 | Testes locais | `npm run db:test:local` (**805** pgTAP, 28 arquivos), os testes Deno (87) e o `deno check` das **9** functions |
| 3 | Migrations | `20261024120000_paint_today_pause_prefs`, `…120100_weekly_recap`, `…120200_telemetry`. Aditivas. A 1ª **limpa** valores não booleanos de `profiles.notification_prefs` (viram "ligado", como chave ausente) antes do CHECK novo |
| 4 | Functions | `npx supabase functions deploy weekly-recap` (nova; já está no `config.toml`). As outras não mudaram |
| 5 | EAS Update | o app que lê `paintedToday`, `pauseAvailable`, `weekly-recap` e a tela de consentimento |
| 6 | Flag | `update public.game_config set value = value || '{"telemetry": true}' where key = 'features';` — só depois do app com a tela de consentimento. Mesmo ligada, nada é gravado sem o opt-in |

**Compatibilidade.** App antigo × servidor novo: campos novos são ignorados; `weekly-recap` e as RPCs de telemetria
não são chamadas. App novo × servidor antigo: `paintedToday` ausente → `[]`; `pauseAvailable` ausente → `null`;
`weekly-recap` → 404 `NOT_AVAILABLE` e `weekly_recap`/`track_events` → `PGRST202` (indisponível); o app não envia
telemetria. **Volta atrás:** desligar `features.telemetry`; para apagar os eventos, `delete from public.telemetry_events;`.

**Conferir:**
- `select jobname, schedule from cron.job where jobname = 'nomaderun-telemetry-retention';` → `40 6 * * *`.
- Como `authenticated`: `select public.zone_paint_near(-16.7097, -49.2388, 1500) -> 'paintedToday';` e
  `select public.weekly_recap();`.
- `curl -X POST "$SUPABASE_URL/functions/v1/weekly-recap" -H "Authorization: Bearer <jwt>" -H "apikey: <anon>" -d '{}'`.

**Segurança (máquina com Docker):** `npm run db:start`, `npm run functions:serve` e, em outro terminal,
`bash supabase/tests/security/run-v2.sh` (aplaudir a si mesmo, 201º aplauso, `feed_items`/`zone_cells`/`paint_marks`/
telemetria direto, golpe forjado no chefão, missão resgatada 2 vezes, telemetria sem consentimento, `weekly-recap`).
O script liga as flags da v2 durante o teste e devolve como estavam. A mesma lógica, sem HTTP, está no pgTAP 28.

## 10. Deploy completo da v2 (Fase 7), do zero ao app na nuvem

Resumo das seções 7 a 9 mais as correções da revisão (`20261028120000_review_fixes`), na ordem que não quebra o app que já está publicado no EAS Update. Cada passo pode parar no meio: com as flags desligadas, o app antigo continua igual, e o app novo mostra "indisponível" no que o servidor ainda não tem.

| Passo | O quê | Comando / observação |
|---|---|---|
| 0 | **A-1: senhas das contas demo** | Troque as senhas de `admin.demo` e `moderador.demo` no projeto da nuvem (SQL em `docs/COMO_APRESENTAR.md` §1). Elas estão no README, e o repositório é público |
| 1 | Backup | `npx supabase db dump --linked -f backup-<data>.sql` e o mesmo com `--data-only` |
| 2 | Testes locais | `npm run db:test:local` (**832** pgTAP em 29 arquivos), `npm run functions:test` (Deno: 87 ok, 1 ignorado), `npm run functions:check` e `npm run domain:copy:check` |
| 3 | Migrations | `npx supabase db push --dry-run` e `npx supabase db push`. Sobem de `20261023120000_v2_contract` a `20261028120000_review_fixes` (15 arquivos, todos aditivos). Jobs novos: `raid-tick`, `close-league`, `fade-cells` e `telemetry-retention`. Realtime ganha `raids` e `feed_kudos_counts` |
| 4 | Functions | `npx supabase functions deploy` (as 9). Mudaram na v2: `finish-activity`, `moderate-activity`, `account-export` e a nova `weekly-recap` |
| 5 | Seed v2 (só para a apresentação) | `psql "$DB_URL" -f supabase/seed_v2_demo.sql`, depois do `seed.sql`. Idempotente, não liga flag e não cria Raid nem Liga (D-76) |
| 6 | App novo | Confira que o `apps/mobile/.env.production` **não** tem `EXPO_PUBLIC_DEMO=1` (senão o app publicado só abre a demonstração) e rode `npm run publicar -- "v2"` na raiz (branch `demo` do EAS Update) |
| 7 | Flags, uma por vez | Na ordem da §8.2: `records` → `missions` + `dailyChest` + `track` → `feed` → `raid` → `league` → `streakV2`. Depois de cada uma, uma corrida de teste e `select v2_extras from public.activities order by created_at desc limit 1;` |
| 8 | Território v2 | Só na **troca de temporada** (dia 1), com o app novo já publicado: §8.3. Volta atrás com `territory_rule = 'v1'` |
| 9 | Telemetria, por último | `features.telemetry` só depois que o app com a seção "Ajudar a melhorar o app" (Você → Ajustes) estiver publicado **e** a política de privacidade (`/privacidade`) citar a telemetria opt-in (já cita, desde o fechamento da Fase 7). Mesmo ligada, nada é gravado sem o consentimento da pessoa |
| 10 | Conferir | `select jobname, schedule from cron.job;` (8 jobs), `npx supabase db advisors --linked` e o `curl` do `weekly-recap` (§9) |

**Para desligar a v2 de uma vez** (o que já foi gravado fica): `update public.game_config set value = (select jsonb_object_agg(k, false) from jsonb_object_keys(value) k) where key = 'features';` e `territory_rule = 'v1'`.
