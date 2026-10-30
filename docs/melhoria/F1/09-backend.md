# F1 · E9 — Backend do jogo (Supabase)

> Equipe E9 · Fase F1 (descoberta e desenho) · 2026-10-23 · branch `claude/affectionate-gauss-e8gm77`
> Nada do repositório foi alterado. Arquivos desta frente: este relatório e `docs/melhoria/F1/backend/`
> (`banco-local.sh`, `supabase-shim.sql`, `rascunho-v2.sql`, `rascunho-v2.test.sql`, `resultado-banco-local.txt`).

## 0. Resumo

- **O servidor de hoje é sólido e está testado.** São 17 tabelas, todas com RLS, 15 RPCs do cliente, 10 funções `svc_*` só para o service role, 4 jobs no pg_cron e 8 Edge Functions. O Realtime está ligado em `zones` e `notifications`. A regra do território roda nas functions com o mesmo `src/domain` do app.
- **O que é real e o que é demonstração na Arena:**
  - reais: Domínio, Neblina, Fuga, Caça, Crews e sequência semanal;
  - Cidade × Cidade usa dados reais quando o servidor tem cidades; senão, mostra o placar de demonstração;
  - **Raid e Liga são só demonstração** (`arena-screen.tsx:13`);
  - não existem no servidor: o encontro da crew, missões, medalhas, feed, recordes e baú do dia.
- **O desenho da v2 é aditivo.**
  - **Tabelas e configuração:** 16 tabelas novas, uma config do jogo (`game_config`) para ligar e desligar cada feature sem deploy, e uma RPC de contrato (`server_info`).
  - **Gravação do resultado:** uma gravação v2 (`svc_apply_activity_result_v2`) chama a v1 **sem mudar nada nela** e aplica os extras na mesma transação: dano no chefão, missões, liga, recordes e feed.
  - **Recompensas:** um livro de XP (`xp_ledger`) torna todas as recompensas idempotentes.
- **Prova do banco local sem Docker: deu certo.** Rodei Postgres 16 + PostGIS + pgTAP + pg_cron do apt com um shim do Supabase. Resultados:
  - projeto atual: **285/285 testes pgTAP passam** (13 arquivos), com e sem seed, pelo `psql` e pelo `pg_prove`;
  - o rascunho v2 aplica por cima das 10 migrations e passa nos **47/47** testes próprios;
  - ele quebra **exatamente 3 asserções antigas**, que a F3 precisa atualizar: o número de tabelas e o número de jobs (`01_schema`) e a lista do Realtime (`12_security_audit`).
- **Deploy em ordem:**
  1. migrations, com as features desligadas;
  2. functions;
  3. seed v2 de demonstração (arquivo próprio);
  4. EAS Update;
  5. ligar as flags.
  A volta atrás é desligar a flag (na hora). As migrations nunca são revertidas: os erros se corrigem para frente.

---

## 1. Método e fontes

- **Prompt e definição da equipe:** prompt mestre (seções 1–4, 7, 8, 13–16, 19) e `.claude/agents/backend-jogo.md`.
- **Documentação:** `docs/API_CONTRATO.md`, `supabase/DEPLOY.md`, `docs/QA.md` §12–13, `docs/REVISAO.md` (A-1) e `docs/DECISOES_TECNICAS.md` (RN-001).
- **Código do servidor:** as 10 migrations, as 8 functions e `_shared/*`, `seed.sql` e `supabase/scripts/test-db.sh`.
- **Lado do app:** `apps/mobile/src/services/api/*`, `features/screens/arena-screen.tsx`, `club-screen.tsx`, `features/run/hunt-chests.ts` e `demo/demo-data.ts`.
- **Verificação:**
  - Deno: `npx -y deno test …` → **58 ok, 1 ignorado**; `deno check` das 8 functions → ok;
  - banco local: seção 7.

---

## 2. Mapa do servidor atual

Abreviações de migration: `M0` = `20261020120000_extensions_and_schema`, `M1` = `…120100_auth_rls`, `M2` = `…120200_rpcs`, `M3` = `…120300_views_and_jobs`, `M4` = `…120400_storage_avatars`, `M5` = `20261021120000_realtime_privacy`, `M6` = `…120100_chests`, `M7` = `…120200_rankings`, `M8` = `…120300_zone_names_chests_group`, `M9` = `20261022120000_qa_hardening`. Quando uma função foi redefinida, cito a **última** versão.

### 2.1 Tabelas (17, todas com RLS e com `revoke all … from anon, authenticated`)

| Tabela | Onde | Cliente pode | Observação |
|---|---|---|---|
| `seasons` | M0:41 | ler | temporada `AAAA-MM` (Brasília) |
| `profiles` | M0:54 | ler o próprio; atualizar 5 colunas | `xp`, `trust`, `faction` e `streak_weeks` só pelo servidor (M1:233; M9:209) |
| `devices` | M0:89 | ler os próprios (sem `secret`) | chave HMAC por aparelho (D-04) |
| `activities` / `activity_points` | M0:103 / M0:134 | ler os próprios; staff lê todos | pontos dentro de zona de privacidade escondidos para terceiros (M5:75) |
| `zones` / `zone_events` / `activity_zones` | M0:151 / M0:172 / M0:186 | ler (zonas e eventos); as próprias (`activity_zones`) | `zones.version` faz a concorrência otimista (D-23) |
| `safety_contacts` / `privacy_zones` | M0:205 / M5:16 | CRUD dos próprios | limites 5 e 3 por trigger |
| `notifications` | M0:217 | ler e marcar lida | `type` com CHECK de 6 valores |
| `fog_cells` / `chest_opens` / `chests` | M0:233 / M0:241 / M6:9 | ler os próprios | Neblina e Caça |
| `crews` / `crew_members` | M0:256 / M0:267 | ler a própria (QA-01); criar e sair | regras em trigger (M1:127–202) |
| `moderation_reviews` | M0:280 | staff; o dono lê as próprias | sem `moderator_id` para o cliente |

**Policies restritivas.** As policies `*_active_account` (M9:46–61) barram a conta **inativa** em 13 tabelas e no Storage. **Toda tabela nova com dado de usuário precisa da policy restritiva igual.**

### 2.2 Views (todas `security_invoker` sobre funções `security definer` em `private`)

- `public_profiles` (M3:28) e `public_crews` (M9:196), sem o código de convite;
- `staff_profiles` (M9:219);
- `leaderboard_individual`, `leaderboard_crews`, `leaderboard_factions` e `leaderboard_cities` (M3:44–98).

### 2.3 RPCs do cliente (`authenticated`)

| RPC | Onde |
|---|---|
| `username_available` (anon também) | M1:86 |
| `choose_faction`, `join_crew`, `leave_crew` | M9:64, M9:99, M9:120 |
| `mark_notifications_read`, `admin_set_user_status` | M2:103, M2:117 |
| `zones_in_bbox`, `zones_in_bbox_json` | M2:145, M9:249 |
| `daily_chests` | M9:133 |
| `ranking_runners`, `ranking_crews`, `ranking_factions`, `district_label` | M7:73, M7:98, M7:126, M7:153 |
| `is_staff`, `is_admin` | M1:28–30 |

### 2.4 Funções internas (`svc_*`, só o service role; laço de revoke em M8:342)

| Função | Onde |
|---|---|
| `svc_register_device`, `svc_device_secret` | M2:177, M2:196 |
| `svc_ingest_points` | M9:262 |
| `svc_load_activity` | M2:277 |
| `svc_finish_context` | M8:56 |
| `svc_crew_tracks` | M8:98 |
| `svc_apply_activity_result` | M8:122 |
| `svc_moderate_reject` | M2:512 |
| `svc_zone_detail` | M2:538 |
| `svc_account_export` | M8:311 |

**Internas em `private`:**

| Função | Onde |
|---|---|
| `notify_zone_runners` | M2:324 |
| `new_zone_name` | M8:11 |
| `roll_chests`, `chest_rarity`, `chest_xp` | M6:31–74 |
| `is_active`, `require_active` | M9:12, M9:19 |

**Pre-request do PostgREST:** `public.check_request` (M9:31).

### 2.5 Jobs (pg_cron, UTC; M3:245–248)

| Job | Cron (UTC) | Brasília | Regra |
|---|---|---|---|
| `job_fortify_zones` | `5 3 * * *` | 00:05 | RN-004 escudo |
| `job_decay_zones` | `0 6 * * *` | 03:00 **todo dia** | RN-005 ×0,9, piso 5 |
| `job_close_week` | `10 3 * * 1` | seg 00:10 | RN-014 sequência |
| `job_season_rollover` | `15 3 1 * *` | dia 1 00:15 | RN-006 ×0,3 |

### 2.6 Realtime e Storage

- **Publicação `supabase_realtime`:** só `zones` (M1:318) e `notifications` (M5:8). O teste `12_security_audit` trava essa lista.
- **Bucket `avatars`:** público, 2 MB, JPEG/PNG/WebP (M4:5).

### 2.7 Edge Functions (8, `verify_jwt = false`, autenticação em `_shared/supabase.ts:20`)

| Function | O que faz |
|---|---|
| `register-device` | grava o segredo HMAC do aparelho |
| `ingest-points` | lote assinado (HMAC, até 500 pontos e 1 MB) → `svc_ingest_points` |
| `finish-activity` | carrega a corrida → domain (`computeOfficialResult`) → `svc_apply_activity_result`, com até 3 tentativas em `ZONE_CONFLICT` |
| `moderate-activity` | aprovar (recalcula com o domain) ou rejeitar |
| `zones` / `zone` | leitura por área e detalhe |
| `account-export` / `account-delete` | LGPD; a exclusão exige senha (QA-06) |

### 2.8 Real × só do app × demonstração, por modo da Arena

| Modo | No servidor (real) | Só no app | Só demonstração |
|---|---|---|---|
| **Domínio** | zonas, RP, conquista, ataque, escudo, decaimento, temporada, M_grupo (functions + jobs) | prévia ao vivo (mesmo domain) | o centro do mapa em Goiânia (A-2 da revisão) |
| **Neblina** | `fog_cells` gravada no finish; XP por célula | desenho da névoa | — |
| **Fuga** | M_fantasma ×1,5 só com `mission = 'fuga'` e ritmo entre 150 e 900 s/km (QA-02) | o fantasma e a "corda" | o fantasma é o ritmo que o próprio cliente escolhe (RN-019 completo pendente) |
| **Caça** | `daily_chests` + abertura oficial no finish (25 m) | radar e prévia | sem internet: `seedChests` local (`hunt-chests.ts:24`), que não vale XP |
| **Raid** | **nada** | — | `DEMO_RAID` (`arena-screen.tsx:13,62–80`, rotulado) |
| **Liga** | **nada** (só as constantes do domain) | `leagueOutcome` | `demoLeague` (`arena-screen.tsx:39,132–160`, rotulado) |
| **Cidade × Cidade** | `leaderboard_cities` (RN-013, mínimo de 20 ativos) | — | `demoCityWar` quando o servidor não tem cidades (`club-screen.tsx:140,333`) |
| **Crews** | crews, convite, M_grupo, rankings | — | encontro da crew (`DEMO_CREW.nextMeetup`, `club-screen.tsx:203–221`) |
| **Sequência / XP / nível** | `streak_weeks`, `freezes_left`, `profiles.xp` (jobs e finish) | `levelFromXp` | — |
| **Missões / medalhas / feed / recordes / baú do dia** | **nada** (o tipo de notificação `mission` existe, sem tabela) | — | — |
| **Rabisco / Bandeira** | nada | card "em breve" | — |

### 2.9 Achados da auditoria (para a F2)

1. **Decaimento:** o prompt §2 diz que é "semanal (×0,9)", mas o servidor e o RN-005 aplicam **todo dia às 03:00** (0,9⁷ ≈ 0,48 por semana). A E3 precisa simular com o número certo.
2. **Constantes duplicadas no SQL:** os jobs repetem constantes do domain (0,9, piso 5, limiar 30, 500 m, escudo 3, ×0,3). Uma regra v2 que mude qualquer uma delas exige **job novo** e um **teste de paridade** (§4.1).
3. **Liga em grupos pequenos:** `leagueOutcome` (`games.ts:71`) sobe os 5 primeiros e desce os 5 últimos. Num grupo de 6, quase todos sobem. No começo, com poucos usuários reais, isso é o caso comum. Pedido para a E3: escalar o número de vagas (por exemplo, `min(5, ⌊n/5⌋)`) e exigir pontos > 0 para subir.
4. **Testes que travam o esquema:**
   - `01_schema` exige 17 tabelas e 4 jobs;
   - `12_security_audit` exige o Realtime só em `zones` e `notifications`, e também a lista de tabelas "escritas só pelo servidor".
   Toda migration v2 precisa atualizá-los: as 3 quebras previstas foram confirmadas no banco local.
5. **Privilégios padrão do Supabase:** `anon`, `authenticated` e `service_role` recebem `all` em toda tabela e função nova do `public`. As migrations atuais revogam isso uma a uma. Esquecer o revoke é a falha mais provável na v2: há um checklist na §6.
6. **Push remoto:** não existe. As notificações são da central (tabela + Realtime) e locais (`local-alert.ts`). No Expo Go, o push remoto não está disponível no Android, então os lembretes da E7 precisam ser **locais agendados pelo app** ou **itens da central**.
7. **Seed:** o `seed.sql` não é idempotente e tem as senhas públicas de demonstração (A-1). Rodá-lo de novo no Cloud (`--include-seed`) duplicaria dados e ainda reaplicaria as senhas conhecidas. O seed v2 precisa ser um arquivo à parte, idempotente.
8. **`streakDays` recebe semanas** (`_shared/scoring.ts:228`). É intencional, porque a decisão documentada é que o multiplicador de sequência usa `streak_weeks` (`DECISOES_TECNICAS.md:157`). Fica registrado para a E3 não estranhar.
9. **Riscos aceitos que continuam valendo:**
   - o `finish` carrega a corrida inteira em `jsonb` (até 14.400 pontos);
   - não há limite de chamadas por minuto nas functions (QA-08).

---

## 3. Fluxo da corrida no servidor (hoje) e onde a v2 entra

1. **`register-device`:** o app gera um segredo de 32 bytes, que vai para `devices.secret` e nunca volta ao app.
2. **`ingest-points`** (a cada 5 s):
   - `parseIngestBody`: até 500 pontos, `ghostPace` entre 150 e 900, missão `livre|fuga|caca`;
   - `svc_device_secret` + `verifyBatchSignature` (HMAC-SHA256, comparação em tempo constante);
   - `svc_ingest_points`: cria a corrida no 1º lote e confere ordem, reenvio, dono, aparelho, 3 corridas abertas e 14.400 pontos.
3. **`finish-activity`:**
   - `parseFinish` e `checkEndedAt` (entre o início e agora + 5 min);
   - `svc_load_activity`; se a corrida já terminou, devolve o `result` guardado (idempotente).
4. **`scoreAndApply`** (`_shared/finish.ts:50`):
   - `candidateCells` (domain `validateActivity` + `zoneOf` + `revealFog`);
   - `svc_crew_tracks` (M_grupo, `group.ts`);
   - `svc_finish_context`: perfil, ritmos recentes, zonas, RP do dia por zona e baús da Caça.
5. **`computeOfficialResult`** (`_shared/scoring.ts:216`). É **aqui que entra a regra v2**:
   - **domain:** `finishRun` (`run-engine.ts:115`) → `scoreZone` (esforço 0,8–1,3, sequência +5%/semana até 10, ×1,5 fantasma, ×1,25 grupo, ×2 defesa, teto de 300 RP por dia e por zona) → `applyRunPoints` / `resolveZone` (limiar 30, tomada 1,1×, ataque 50%, fim do ataque 40%, escudo −10/20/30%);
   - **confiança:** `applyTrust` / `trustLevel` (abaixo de 40 vai para revisão; abaixo de 10 suspende);
   - **baús:** `openChests` (25 m).
6. **`svc_apply_activity_result`** (M8:122), numa transação:
   - trava as zonas em ordem fixa e confere a `version` (senão `ZONE_CONFLICT` → nova tentativa);
   - grava `activity_zones`, `fog_cells`, `zone_events` e as notificações (invasão: no máximo 1 por zona a cada 6 h e 5 por dia; território perdido; conquista);
   - grava os baús, o XP, a corrida, o trust e a suspensão.
7. **Jobs:** fortificação 00:05, decaimento 03:00, sequência na segunda e temporada no dia 1.

**Onde a v2 entra:**

| Passo | Mudança |
|---|---|
| 5 | Escolhe `finishRun` (v1) ou `finishRunV2` pelo `territoryRule` que vem no contexto (lido de `game_config`). Também calcula com o domain os `extras`: `raidDamageM`, `missionMetrics`, `leaguePoints`, `stats` (parciais e melhores 1/5/10 km). |
| 6 | O `finish.ts` passa a chamar **`svc_apply_activity_result_v2`**. Ela chama a v1 sem mudança e aplica os extras na mesma transação. A `moderate-activity` (aprovar) usa o mesmo `scoreAndApply`, então a corrida aprovada também ganha os extras. |
| 7 | Jobs novos: raids a cada 10 min e liga na segunda 03:20 BRT. O decaimento v2 só ganha job novo se a E3 mudar os números. |

---

## 4. Desenho das features novas

Os números são **provisórios**: a E3 e a E7 fecham os valores na F2. O SQL de referência está em `docs/melhoria/F1/backend/rascunho-v2.sql`, testado no banco local (47 testes). **Padrão comum de toda tabela nova:**
- FK para `profiles(id) on delete cascade`, o que já cobre a exclusão LGPD;
- RLS ligada, `revoke all … from anon, authenticated` e grant mínimo de `select`;
- policy restritiva `*_active_account`;
- escrita **só** por RPC `security definer` (`set search_path = ''`, `require_active()`) ou pelo service role.

### 4.0 Transversal

| Peça | Desenho |
|---|---|
| `game_config` (key, value jsonb) | Leitura para `authenticated`. Guarda `territory_rule` (`"v1"`/`"v2"`) e `features` (`raid`, `league`, `missions`, `feed`, `records`, `dailyChest`, `telemetry`). Ligar e desligar sem deploy é o plano de volta atrás. Seed: tudo desligado. |
| `server_info()` | RPC sem `security definer` (lê `game_config` pela RLS). Devolve `{ contract: 2, territoryRule, features, serverTime, brToday }`. **Não existe no servidor antigo** (PGRST202): o app novo deduz contrato 1. |
| `xp_ledger` | `(user_id, source, ref)` é único e `amount` vai de 0 a 5000. `private.grant_xp` insere e soma ao `profiles.xp` na mesma transação, então **nenhuma recompensa paga duas vezes**. O dono lê. |
| Notificações | O CHECK de `type` ganha `raid`, `league`, `kudos`, `medal` e `reward` (superconjunto). O app antigo mostra o tipo desconhecido como `system` (`notifications-repo.ts:34`). `notification_prefs` ganha chaves novas, com `true` quando a chave falta. |
| LGPD | `private.account_export_v2(uid)` junta as tabelas novas. Uma migration de LGPD no fim de cada onda redefine `svc_account_export` = antigo ‖ v2. O teste `22_lgpd_v2` confere que **toda tabela do `public` com coluna de usuário** aparece no export. A exclusão já é coberta pelo `on delete cascade`. |
| Resposta do `finish` | Campos **opcionais** novos: `v: 2` e `extras: { raid, missionsCompleted, league, records }`. Nada muda nos campos antigos. O resultado guardado também recebe os campos, então o finish repetido devolve igual. |

### 4.1 Território v2

A E3 decide a regra. O servidor fica pronto para dois formatos:

- **Formato A (M4 + pintura ao vivo só no app; recomendado como base).**
  - **Tabelas:** sem tabela nova. Colunas aditivas em `zones`: `rule_version smallint default 1`, `owner_since timestamptz` e `last_run_at timestamptz` (base para "o que mudou desde ontem").
  - **Leitura:** `zones_in_bbox_json` e o Realtime continuam mandando `influence`, `owner`, `shield` e `attacker`, então o mapa do app antigo segue funcionando.
  - **Barra de duas cores:** derivada de `influence` (dono × maior rival). O domain calcula os números ("faltam 400 m") na prévia e no oficial.
  - **Resposta do finish:** `zones[].outcome` mantém o enum antigo (`conquered|defended|influence|none`). Resultados novos (marcos de 25%, por exemplo) vão em `zones[].v2`, um campo opcional.
- **Formato B (M1 "pintar ruas" persistente).**
  - **Tabela:** `zone_tiles(tile text pk, H3 res 11 ≈ 25 m; zone_id fk; faction; painted_at date)`, **sem `user_id`**.
  - **Privacidade:** o cliente **não lê** os tiles (eles mostrariam o percurso das pessoas). Só lê o agregado `zones.paint jsonb {faction: tiles}`, o que também respeita "o mapa nunca mostra a grade". Tiles dentro de zona de privacidade não são pintados.
  - **Escrita:** na gravação v2, com um teto de tiles por corrida.
  - **Custo:** no máximo 49 tiles por zona (cerca de 13 mil linhas para as 271 zonas de demonstração).
- **M2 (circuito fechado), se entrar:** o domain fecha o polígono e o servidor precisa de `svc_zones_in_polygon(geojson)` para carregar as zonas **dentro** da volta (hoje o `candidateCells` só carrega as zonas tocadas). Teto de área e de zonas por corrida.
- **M3 (bandeiras):** fica fora agora, porque exige uma fonte de dados de praças e parques (OSM) e moderação.

**Como trocar a regra:**
- `game_config.territory_rule`; o `svc_finish_context` passa a devolver `territoryRule`.
- Se os números do decaimento, da fortificação ou da temporada mudarem: jobs novos (`job_decay_zones_v2` …) que leem as constantes de `game_config.territory_constants`. A migration faz `cron.unschedule` dos antigos e `cron.schedule` dos novos. Um **teste Deno de paridade** lê o JSON da migration e compara com as constantes exportadas pelo domain.
- **Quando trocar:** na **virada de temporada** (o reset ×0,3 já acontece), depois que o EAS Update estiver no ar.

**Testes:**
- pgTAP `14_territory_v2`: colunas, flag e jobs;
- Deno: `territory_v2.test.ts` (oficial v1 × v2 com a mesma corrida, enum antigo preservado) e `territory_parity.test.ts`.

**Custo:** desprezível no A; algumas dezenas de MB por cidade grande no B.

### 4.2 Raid real (chefão)

**Tabelas:**

| Tabela | Colunas e índices |
|---|---|
| `raid_bosses` | `id`, `name`, `art_key`, `is_demo` |
| `raids` | `boss_id`, `scope` (`global`/`city`), `city`, `starts_at`, `ends_at`, `hp_m` (vida em **metros**), `damage_m`, `status` (`active`/`defeated`/`expired`), `defeated_at`, `rewarded_at`, `is_demo`. Índice único parcial: **um raid ativo por escopo** |
| `raid_hits` | PK **`(raid_id, activity_id)`**: uma corrida golpeia uma vez. Mais `user_id`, `faction`, `crew_id` (foto do momento, para o ranking de crews), `damage_m` |
| `raid_rewards` | PK `(raid_id, user_id)`; `tier` (`participante`/`top10`/`mvp`), `xp` |

**Regras:**
- **Dano:** `extras.raidDamageM` vem do domain (metros válidos × fator, a definir pela E3).
- **Tetos no servidor:** **21 km por corrida** e **30 km por pessoa por dia** (provisórios).
- **Quem golpeia:** só corridas `scored`, terminadas dentro da janela do raid.
- **Fases** por vida restante: 100 / 66 / 33% (`private.raid_phase`). A fase muda dentro da mesma transação.

**RPC e job:**
- `raid_current()`: chefão, vida, fase, prazo, o meu dano, top 10 corredores e top 5 crews, **sem ids de corrida**.
- `job_tick_raids()` a cada 10 min:
  1. expira os raids vencidos;
  2. premia os derrotados (100 / 300 / 500 XP pelo `xp_ledger`, idempotente);
  3. abre o próximo chefão por 48 h, com vida `max(50 km, ativos_7d × 8 km)` e rotação semanal.

**Realtime:** `raids` entra na publicação, com números públicos e nenhum dado pessoal.

**Antiabuso:**
- PK por corrida e tetos diários;
- corrida em revisão só golpeia depois de aprovada (pelo mesmo caminho do `scoreAndApply`);
- o cliente não escreve em nenhuma tabela do raid.

**Testes:** pgTAP `15_raids` (no rascunho: tetos, repetição, fase, derrota, MVP, job idempotente e cliente sem escrita) e Deno `raid_damage.test.ts`.

**Custo e risco:** 1 linha por corrida. A linha do raid é um ponto quente de trava, aceitável na escala do TCC; se crescer, a vida vira a soma de `raid_hits` atualizada pelo job.

### 4.3 Liga semanal real

**Tabelas:**
- `league_groups(week_start segunda, division 0–4, closed_at)`;
- `league_members(PK (week_start, user_id), group_id, division, points, final_rank, outcome)`;
- `league_standings(user_id pk, division)`.

**Entrada:**
- na **1ª corrida aceita da semana** (`private.add_league_points`), sem cadastro: quem não corre não entra;
- a vaga sai num grupo aberto da própria divisão com menos de 30 pessoas, com trava consultiva por semana e divisão.

**Pontos:** `extras.leaguePoints`. Recomendo o `rpTotal`, que já é esforço relativo, justo para o iniciante e com teto diário. A E3 confirma.

**Fechamento:**
- `job_close_league()` na **segunda 03:20 BRT** (`20 6 * * 1`). As corridas de domingo que sincronizarem até lá ainda contam; depois disso, a semana fechada recusa pontos.
- Desempate por quem entrou primeiro.
- O resultado segue `leagueOutcome`, com a correção de grupo pequeno do achado 3 da §2.9. Grava `final_rank`, `outcome` e a nova divisão. Idempotente (`closed_at`). Notificação `league`.

**Leitura:** `league_current()`, um RPC só com o próprio grupo (posição, nome, time, foto, pontos, "você") e o prazo. O cliente não lê os grupos dos outros.

**Realtime:** não precisa (a leitura acontece ao abrir a tela e depois do finish).

**Testes:** pgTAP `17_league` (entrada, grupo de 30, fechamento, subida e descida, semana fechada, RLS).

**Custo:** 1 linha por pessoa por semana.

### 4.4 Missões, medalhas, desafios e trilha da temporada

**Missões:**
- **Tabelas:**
  - `mission_defs`: catálogo. `kind` = daily / weekly / monthly / ftue; `metric` = meters, runs, zones_conquered, zones_defended, chests_opened, raid_damage_m, new_fog_cells, kudos_given ou crew_runs; mais `target`, `reward_xp`, `title`, `icon` e `is_demo`;
  - `user_missions`: único por `(user, def, period_key)`. A meta e a recompensa ficam gravadas no momento do sorteio. `check (claimed_at is null or completed_at is not null)`.
- **RPCs:**
  - `my_missions()` sorteia, de forma determinística, 3 diárias e 3 semanais na 1ª chamada do período (trava consultiva) e lista as missões;
  - `claim_mission(id)` é **idempotente** (`alreadyClaimed`) e paga pelo `xp_ledger`;
  - o progresso é `private.advance_missions(user, metrics, at)` com as métricas **oficiais** do finish, sem passar da meta;
  - `kudos_given` avança por trigger no aplauso.
- **FTUE de 7 dias:** `kind = 'ftue'`, sorteadas pelo `my_missions` enquanto a conta tiver menos de 7 dias, uma por dia.
- **Desafio mensal:** `kind = 'monthly'` (`period_key = AAAA-MM`) + medalha.

**Medalhas:**
- `medal_defs(id, title, tier, art_key, secret)` e `user_medals(PK (user_id, medal_id), awarded_at, activity_id)`;
- as medalhas de corrida (1ª zona, 10 km, explorador de bairro) chegam pelo `extras.medals`, calculado pelo domain;
- as de evento chegam pelos jobs (raid derrotado, subida na liga, desafio do mês);
- `private.award_medal` é idempotente pela PK.

**Trilha da temporada:**
- o XP da temporada é a soma do `xp_ledger` desde `season_start()`, numa view `private`;
- tabelas: `track_claims(PK (user_id, season_id, level))`, `user_cosmetics(PK (user_id, cosmetic_id), source)` e `user_equipped(user_id pk, trail_color, avatar_frame, conquest_effect)`;
- RPCs: `claim_track_level(level)` e `equip_cosmetic(slot, id)`, que confere se a pessoa possui o item.

**Antiabuso:**
- o período é calculado pelo **relógio do servidor** (Brasília), nunca pelo do app;
- o progresso só vem do finish oficial;
- o resgate é idempotente e o cliente não escreve em nenhuma dessas tabelas.

**Testes:** pgTAP `16_missions_medals` (no rascunho: sorteio, idempotência, progresso com teto, resgate único) e Deno `missions.test.ts` (métricas da corrida).

**Custo:** cerca de 6 linhas por pessoa por semana; limpeza de mais de 90 dias por job.

### 4.5 Feed e aplausos ("Bora!")

**Tabelas:**
- `feed_items`:
  - colunas: `actor_id`, `kind` (`run`, `zone_captured`, `medal`, `raid_defeated`, `league_promoted`, `level_up`), `activity_id`, `crew_id` (foto do momento) e `payload` com **até 1 KB, já cortado**: distância, tempo, ritmo e número de zonas, **sem coordenadas**;
  - índice único `(activity_id, kind)`;
  - criados pela gravação v2 ou pelos jobs.
- `kudos`: PK `(feed_item_id, user_id)`; `reaction` ∈ `bora | fogo | raio`. Não há comentário livre.

**Quem vê:** quem fez e quem é da **mesma crew** (`private.can_see_feed_item`). "Amigos" pede um sistema de seguir que não existe: fica como decisão (§8).

**RLS:**
- `select` em `feed_items` e em `kudos` só onde a pessoa pode ver o item;
- `insert` em `kudos` só nas colunas `(feed_item_id, reaction)`, com `user_id = auth.uid()` e o item visível;
- `delete` só do próprio.

**Antiabuso (trigger):**
- ninguém aplaude a si mesmo (`KUDOS_SELF`);
- teto de 200 por dia (`KUDOS_LIMIT`);
- a notificação para quem fez é agrupada: no máximo 1 por item por hora.

**Realtime:** `kudos` entra na publicação. A RLS vale na assinatura e a linha não tem dado sensível (o nome já é público).

**Configuração:** opção "Mostrar minhas corridas para a crew" (`user_settings.share_runs_to_feed`, padrão `true`; pedido para a E8).

**Testes:** pgTAP `18_social` (crew vê, fora da crew não vê, aplauso em si mesmo, teto, RLS de inserção) e um caso de segurança: aplauso em item invisível.

**Custo:** 1 item por corrida, mais os aplausos.

### 4.6 Recordes pessoais e parciais

**Tabelas:**
- `activity_stats(activity_id pk, user_id)`, com:
  - `splits` (segundos por km, até 100);
  - `pace_series` (até 200 pontos, para o gráfico);
  - `best_1k_s`, `best_5k_s` e `best_10k_s`;
- `personal_records(PK (user_id, kind ∈ 1k|5k|10k|21k|longest), value, activity_id)`.

**Cálculo:**
- o domain calcula `stats` **só sobre trechos válidos**, e a gravação v2 guarda;
- `private.upsert_record` só grava se melhorar e devolve o valor anterior, para o "Novo recorde!" do resumo;
- recorde só com `status = 'valid'`; a corrida `partial` não conta.

**Corridas antigas:** um script Deno (`supabase/scripts/backfill-stats.ts`) recalcula `activity_stats` e os recordes a partir de `activity_points`, com o service role, rodado uma vez.

**RLS:** o dono lê (staff lê `activity_stats` para a moderação).

**Testes:** pgTAP `19_records` (no rascunho: 3 recordes numa corrida, finish repetido não duplica) e Deno `splits.test.ts` (propriedades: soma dos parciais ≈ tempo em movimento; melhor 1 km ≤ qualquer parcial).

**Custo:** cerca de 3 KB por corrida.

### 4.7 Baú do dia

**Tabela:** `daily_rewards(PK (user_id, day), rarity, xp, opened_at)`.

**RPC:** `open_daily_chest()`, com trava consultiva. Exige **uma corrida aceita de pelo menos 1 km no dia** (Brasília), senão responde `DAILY_CHEST_LOCKED`.
- **Sorteio no servidor**, com as mesmas chances da Caça (70/25/5) e **as chances na resposta** (`odds`).
- **XP** pelo `xp_ledger`.
- **Idempotente:** chamar de novo devolve o mesmo baú.

**Ética:** abrir o app sem correr não dá nada, e não há punição por descansar. O baú some no fim do dia, sem acumular (pedido para a E7: confirmar esse comportamento ou criar um "baú do descanso" menor).

**Testes:** pgTAP `20_daily_chest` (trancado, abre, abre uma vez, XP uma vez).

**Custo:** 1 linha por pessoa por dia de corrida.

### 4.8 Dados para o card de compartilhamento

**RPC:** `share_card(activity_id)`, só para o dono. Devolve:
- distância, tempo em movimento, ritmo, data e time;
- zonas conquistadas, dano no chefão e recordes desta corrida;
- **rota já cortada no servidor:**
  - tira os pontos dentro das zonas de privacidade;
  - corta **200 m de cada ponta**; corrida com menos de 600 m sai sem rota;
  - simplifica (`ST_Simplify`) e entrega como **polyline codificada** (`ST_AsEncodedPolyline`), sem horários.

**Recap semanal:** `weekly_recap(week_start)`, com os agregados da semana e as zonas que a pessoa ainda domina.

**GPX:** sai do próprio `activity_points` (o dono já lê). O app gera o arquivo e não precisa de servidor.

**Testes:** pgTAP `21_share_card` (outra pessoa recebe `NOT_FOUND`; ponto dentro da zona de privacidade não aparece na polyline; pontas cortadas).

**Custo:** nenhum armazenamento.

### 4.9 Telemetria mínima (só se a F2 aprovar)

- **Tabela:** `telemetry_events(id, user_id fk cascade, event text, props jsonb, app_version, created_at)`.
  - `event` sai de uma lista fechada: `app_open`, `run_start`, `run_finish`, `zone_conquer`, `share`, `mission_claim`, `ftue_step`;
  - `props` tem no máximo 512 bytes e nenhuma coordenada.
- **RPC:** `track_events(p jsonb)`, com até 50 eventos por chamada e 500 por dia por pessoa. **Só grava com o consentimento** (`user_settings.telemetry_opt_in`, padrão desligado).
- **Leitura:** o cliente não lê. A staff tem as views D1/D7/D30.
- **Retenção:** 30 dias, com limpeza diária (`nomaderun-telemetry-retention`, 03:40 BRT).
- **LGPD:** entra no export e é apagada em cascata.
- **Custo:** com 100 pessoas, cerca de 1 MB por dia, de 30 a 40 MB parados.

### 4.10 Jobs novos (UTC; Brasília = UTC−3)

| Job | Cron (UTC) | Brasília | Idempotência |
|---|---|---|---|
| `nomaderun-tick-raids` | `*/10 * * * *` | a cada 10 min | `rewarded_at` + PK das recompensas + `xp_ledger` |
| `nomaderun-close-league` | `20 6 * * 1` | seg 03:20 | `closed_at` por grupo |
| `nomaderun-close-month` | `20 3 1 * *` | dia 1 00:20 | medalha (PK) + `xp_ledger` |
| `nomaderun-cleanup` | `40 6 * * *` | 03:40 | apaga missões antigas e telemetria vencida |
| (E7) `nomaderun-nudges` | a definir | 8h–21h | no máximo 1 lembrete por pessoa por dia, respeitando as preferências; só na central |

---

## 5. Compatibilidade e deploy

### 5.1 Matriz

| | **Servidor antigo** (Cloud hoje) | **Servidor novo** (v2) |
|---|---|---|
| **App antigo** (EAS Update atual) | como hoje | **Funciona.** Requisições e respostas antigas não mudam; o `finish` só **acrescenta** `v` e `extras`, que o app antigo ignora (ele guarda o `result` como objeto). Tipos novos de notificação aparecem como `system`. Raid e Liga continuam como demonstração rotulada. **Diferença:** com `territory_rule = v2`, a prévia do app antigo usa a regra v1; o oficial manda. Por isso a flag só liga **depois** do EAS Update. |
| **App novo** | **Degrada sem quebrar.** `server_info` não existe (PGRST202) → contrato 1: esconde ou marca como demonstração Raid, Liga, missões, feed, recordes e baú do dia, e usa a prévia v1. Os repos novos tratam `PGRST202` / `42P01` / `404` como `FEATURE_UNAVAILABLE`. O resumo sem `extras` não mostra as seções novas. | completo, de acordo com as flags de `server_info.features` |

**Regras de contrato:**
1. Campo novo é sempre opcional.
2. Nada é renomeado ou removido.
3. Comportamento novo entra em **RPC ou function nova** (`svc_apply_activity_result_v2`, `raid_current` …) e não muda a assinatura da antiga.
4. Tudo começa desligado em `game_config`.
5. O app decide o que mostrar por `server_info` e nunca pela versão do próprio app.

### 5.2 Ordem de deploy (cada onda)

1. **Antes:**
   - `npx supabase db dump --linked -f backup-<data>.sql` (esquema) e `--data-only` (dados), guardados fora do repositório;
   - `npx supabase migration list`.
2. **Local:**
   - `bash docs/melhoria/F1/backend/banco-local.sh` (ou `npm run db:reset && npm run db:test:psql` com Docker);
   - `npm run functions:test`, `functions:check`, `functions:bundle-check` e `npm run e2e`.
3. **Migrations:** `npx supabase db push --dry-run` e depois `db push`. Tudo aditivo e **com as flags desligadas**. O app antigo e as functions antigas continuam iguais. Conferir com o e2e contra o Cloud e com `db advisors`.
4. **Functions:** `npx supabase functions deploy`. O `finish` passa a usar a gravação v2; com as flags desligadas, os extras vêm vazios.
5. **Seed v2 de demonstração:** `supabase/seed_v2_demo.sql`, idempotente, `is_demo = true`, rodado com `psql` ou no SQL Editor. **Não** usar `db push --include-seed`, que reaplica o seed inteiro e as senhas conhecidas.
6. **App:** EAS Update (branch `demo`). O app novo lê `server_info`.
7. **Flags:** `update game_config …` ligando uma feature por vez, cada uma com o seu teste de fumaça. A **regra de território v2 liga na virada de temporada** (decisão D2 da §8).

### 5.3 Plano de volta atrás

| Problema | Volta atrás |
|---|---|
| Feature com defeito | desligar a flag em `game_config` (vale na hora, sem deploy) |
| Function nova com defeito | redeploy das functions da tag anterior (`git checkout <tag> -- supabase/functions && npx supabase functions deploy`). A v1 da gravação continua existindo |
| App novo com defeito | `eas update:republish` do grupo anterior no branch `demo` |
| Migration com defeito | **correção para frente** (migration nova). Nunca `drop`. Emergência: `cron.unschedule(...)`, `revoke` do grant e flag desligada |
| Dados corrompidos | restaurar o dump do passo 1 (último recurso; perde o que entrou depois) |

---

## 6. Plano de migrations (F3/F4) e checklist

O timestamp é o do dia da implementação, sempre depois de `20261022120000`. Proposta de arquivos em ordem, um por feature, cada um com o seu pgTAP:

| # | Migration | Conteúdo | pgTAP |
|---|---|---|---|
| 1 | `…_v2_contract.sql` | `game_config`, `server_info`, `xp_ledger`, `grant_xp`, CHECK de notificações, `user_settings` | `14_contract` |
| 2 | `…_territory_v2.sql` | colunas em `zones`, `territory_constants`, contexto com `territoryRule` (e `zone_tiles` se for o formato B) | `14_territory_v2` |
| 3 | `…_apply_v2.sql` | `svc_apply_activity_result_v2` (chama a v1) | no `14` |
| 4 | `…_raids.sql` | bosses, raids, hits, rewards, `raid_current`, job, Realtime | `15_raids` |
| 5 | `…_missions_medals.sql` | defs, user_missions, medalhas, trilha, cosméticos | `16_missions_medals` |
| 6 | `…_league.sql` | grupos, membros, standings, `league_current`, job | `17_league` |
| 7 | `…_social.sql` | feed, kudos, `can_see_feed_item`, Realtime | `18_social` |
| 8 | `…_records_card.sql` | `activity_stats`, `personal_records`, `share_card`, `weekly_recap` | `19_records`, `21_share_card` |
| 9 | `…_daily_chest.sql` | `daily_rewards`, `open_daily_chest` | `20_daily_chest` |
| 10 | `…_telemetry.sql` (se aprovada) | eventos, `track_events`, retenção | `21b_telemetry` |
| 11 | `…_lgpd_v2.sql` | `svc_account_export` = antigo ‖ `account_export_v2` | `22_lgpd_v2` |
| — | ajustes nos testes antigos | `01_schema` (17 → N tabelas, 4 → M jobs) e `12_security_audit` (lista do Realtime e lista de tabelas "só servidor") | — |

**Checklist de cada migration (sai dos testes `12` e `01` e das armadilhas vistas):**
1. Tabela: `enable row level security`, `revoke all … from anon, authenticated`, grant mínimo, policy explícita e policy restritiva `*_active_account`.
2. Função: `set search_path = ''`. Se for `security definer`, `revoke all … from public, anon`, e `grant execute` só para quem precisa. `svc_*` e `job_*` só para o `service_role` (repetir o laço do M8:342).
3. RPC do cliente: `auth.uid()` não nulo, `private.require_active()`, entrada validada com código `CODIGO: texto pt-BR`.
4. FK para `profiles` com `on delete cascade` e a entrada correspondente no export.
5. Realtime só em tabela com RLS e sem dado sensível; atualizar a lista do `12`.
6. Job: horário em UTC comentado em Brasília, idempotente; atualizar a contagem do `01`.
7. Constante do domain repetida no SQL: teste de paridade.
8. Dado de demonstração só no `seed_v2_demo.sql`, com `is_demo`.

---

## 7. Prova técnica: banco local sem Docker

**Resultado: funcionou. 285/285 testes pgTAP passam no projeto atual**, com e sem seed, pelo `psql` (a mesma regra de `supabase/scripts/test-db.sh`) e pelo `pg_prove` ("All tests successful. Files=13, Tests=285"). O ciclo completo leva cerca de 6 s.

| Item | Valor |
|---|---|
| Pacotes (apt do Ubuntu) | `postgresql-16-postgis-3` 3.4.2, `postgresql-16-pgtap` 1.3.2, `postgresql-16-cron` 1.6.2; Postgres 16.15 |
| Cluster | `initdb` numa pasta temporária, porta **54329**, socket na própria pasta (sem TCP), auth `trust` só local, `shared_preload_libraries = 'pg_cron'`, `cron.database_name = 'postgres'`, `wal_level = logical`, fsync desligado |
| Shim (`supabase-shim.sql`) | roles `anon`, `authenticated`, `service_role` (bypassrls), `authenticator`, `supabase_admin`; esquemas `auth`, `storage`, `extensions`; `auth.users` e `auth.identities` com as colunas do GoTrue; `auth.uid()`, `role()`, `email()` e `jwt()` lendo `request.jwt.claims`; `storage.buckets`, `storage.objects` (RLS) e `storage.foldername()`; publicação `supabase_realtime`; privilégios padrão do `public` iguais aos do Supabase; `search_path` com `extensions` |
| Projeto atual | 10/10 migrations, seed ok, **13 arquivos · 285 testes · 0 falhas** |
| Projeto + rascunho v2 | rascunho aplicado; **`rascunho-v2.test.sql` 47/47**; quebras previstas e confirmadas: `01_schema` nº 2 (33 tabelas, esperado 17) e nº 8 (6 jobs, esperado 4); `12_security_audit` nº 13 (Realtime com `kudos` e `raids`) |
| Deno (functions) | 58 ok, 1 ignorado; `deno check` ok |

**Como reproduzir** (como root; o servidor roda como o usuário `postgres`):
```bash
NR_INSTALL=1 bash docs/melhoria/F1/backend/banco-local.sh            # instala (1ª vez), cria, aplica, testa e para
NR_KEEP=1 bash docs/melhoria/F1/backend/banco-local.sh               # deixa o banco rodando para explorar (psql -h <pasta> -p 54329)
NR_EXTRA_SQL="$PWD/docs/melhoria/F1/backend/rascunho-v2.sql" \
NR_EXTRA_TESTS="$PWD/docs/melhoria/F1/backend/rascunho-v2.test.sql" \
  bash docs/melhoria/F1/backend/banco-local.sh                       # prova do rascunho v2
```

**Onde quase parou e como resolvi.** Neste ambiente, a pasta de temporários fica atrás de diretórios `700` do root, que voltam a `700` sozinhos. Por isso o usuário `postgres` não consegue entrar nela. A solução foi um **bind mount** para um caminho curto (`mount --bind <pasta>/f1-backend /tmp/nr-pg-mnt`). Os dados continuam fisicamente na pasta de temporários, e o caminho curto ainda respeita o limite de 107 caracteres do socket Unix. Isso está no cabeçalho do script.

**Limites (o que esta prova não cobre):**
- **Serviços que não existem no banco local:** não há PostgREST, Realtime, GoTrue nem Storage API. O pre-request (`check_request`), a RLS no canal do Realtime e o upload de avatar ficam para o e2e e o adversarial com Docker.
- **Versão do Postgres:** a prova usa Postgres 16, e o `config.toml` usa `major_version = 17`. Nada nas migrations depende da diferença, mas a validação final continua sendo a do Supabase CLI.
- **Shim, não a imagem oficial:** o shim reproduz só o necessário. Uma migration que dependa de outra parte do Supabase (`pg_net`, `vault`, `pgsodium`) precisa de um shim novo.

**Proposta:** levar o script e o shim para `supabase/scripts/` (T7.E9.1) e usá-los como `npm run db:test:local` na CI do GitHub (pedido para a E10), sem Docker.

---

## 8. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Onde rodam as regras das features (dano, missão, liga, recordes)? | (a) domain em TS calcula e passa os `extras` para a gravação v2; (b) trigger SQL em `activities.scored` | **(a)**. Mantém a regra "o domain é a fonte única"; a aprovação da moderação já passa pelo mesmo `scoreAndApply`. O SQL só aplica tetos e idempotência |
| D2 | Quando ligar o território v2? | (a) assim que o deploy terminar; (b) na virada de temporada depois do EAS Update | **(b)**. O reset ×0,3 já acontece; "temporada nova, regra nova" é fácil de explicar; o app antigo fica pouco tempo com a prévia errada |
| D3 | Escopo do raid | (a) global (todo o NOMADE RUN); (b) por cidade natal; (c) por cidade da corrida | **(a)** agora (poucos usuários reais), com a coluna `city` pronta para (b) depois |
| D4 | Quem vê o feed | (a) só a crew; (b) crew + "seguir" (tabela `follows`); (c) o time inteiro | **(a)** na F4, sem moderação extra; (b) só se a E8 provar que cabe |
| D5 | Pontos de liga | (a) `rpTotal`; (b) XP; (c) km | **(a)**: esforço relativo, justo para o iniciante, com teto diário (E3 confirma) |
| D6 | Telemetria | (a) não; (b) mínima com consentimento e retenção de 30 dias | **(b)** se as métricas do §3 do prompt forem para a banca; senão, (a) |
| D7 | Seed v2 de demonstração no Cloud | (a) `seed_v2_demo.sql` idempotente; (b) `--include-seed` | **(a)** (a opção b reaplica o seed inteiro e as senhas públicas) |
| D8 | Constantes do território no SQL | (a) repetir no SQL com teste pgTAP (como hoje); (b) `game_config.territory_constants` + teste Deno de paridade | **(b)** se a v2 mudar os números do decaimento, da fortificação ou da temporada |

---

## 9. Pedidos para as outras equipes

- **E3 (jogo e território):**
  - expor no domain `finishRunV2` (ou um parâmetro de regra), mais `raidDamage`, `runMetrics` (métricas de missão), `leaguePoints`, `runStats` (parciais, melhores 1/5/10 km, só trechos válidos) e `medalsForRun`;
  - registrar os arquivos novos na ponte (`_shared/domain.ts` e os dois `deno.json`);
  - corrigir `leagueOutcome` para grupos pequenos (§2.9-3);
  - simular com o decaimento **diário** (§2.9-1);
  - definir os tetos do raid e a fórmula da vida.
- **E7 (engajamento):** catálogo de missões (ids, métricas da lista da §4.4, metas, XP), medalhas, trilha e cosméticos; regra do baú do dia (descanso); catálogo de lembretes, levando em conta que **não há push remoto no Expo Go** e que os lembretes são locais ou da central.
- **E8 (social):** campos do card (§4.8); confirmar o feed só da crew (D4); configuração "mostrar minhas corridas"; tipos de reação.
- **E6 (UX):** mostrar o estado `FEATURE_UNAVAILABLE` (servidor antigo) e o "demonstração" rotulado nas telas de Raid, Liga e Missões.
- **E10 (qualidade):**
  - pôr `banco-local.sh` na CI;
  - acrescentar casos de segurança da v2 em `supabase/tests/security/`: dano repetido, missão resgatada duas vezes, aplauso em item invisível, card de outra pessoa, flood de telemetria;
  - criar o modo demonstração com os mesmos formatos de `raid_current`, `league_current`, `my_missions` e `share_card`.
- **Coordenação:** decidir D1–D8; registrar como pendência **do dono** a troca das senhas de demonstração no Cloud (A-1).

---

## 10. Tarefas propostas (F3/F4)

| ID | Título | Dona | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E9.1 | Banco local sem Docker no repositório | E9 (+E10 para a CI) | `supabase/scripts/`, `package.json` (coordenação) | — | `npm run db:test:local` aplica as migrations e roda o pgTAP: 285/285 verde; documentado no `DEPLOY.md` |
| T7.E9.2 | Contrato v2 e config do jogo | E9 | `supabase/migrations`, `tests/database`, `API_CONTRATO.md` | D1 | `server_info` e `game_config` com flags desligadas; `xp_ledger` + `grant_xp`; CHECK de notificações; `01` e `12` atualizados; pgTAP verde |
| T7.E9.3 | Gravação v2 no finish | E9 | `supabase/functions/_shared`, `migrations` | T7.E9.2, domain da E3 | `svc_apply_activity_result_v2` chama a v1; `finish` e `moderate` usam a v2; a resposta antiga continua idêntica (teste Deno de snapshot) + `v`/`extras`; o e2e passa sem mudança |
| T7.E9.4 | Território v2 no servidor | E9 | `functions/_shared/scoring.ts`, `migrations` | regra da E3, D2, D8 | regra escolhida por `territory_rule`; enum `outcome` preservado; jobs v2 (se precisar) com teste de paridade; simulação da E3 reproduzida num teste Deno |
| T7.E9.5 | Raid real | E9 | `migrations`, `tests/database/15_raids` | T7.E9.2–3, D3 | tetos, fases, derrota, prêmios idempotentes, `raid_current` sem ids de corrida, Realtime em `raids`; seed com 1 chefão demo |
| T7.E9.6 | Missões, medalhas e trilha | E9 | `migrations`, `16_missions_medals` | T7.E9.2–3, catálogo da E7 | sorteio 3+3 determinístico, FTUE, mensal, resgate idempotente, medalhas por PK, trilha e `equip_cosmetic` validado |
| T7.E9.7 | Liga semanal | E9 | `migrations`, `17_league` | T7.E9.2–3, D5, ajuste da E3 | entrada na 1ª corrida, grupos ≤ 30, fechamento seg 03:20 idempotente, subida e descida com regra para grupo pequeno, `league_current` só do próprio grupo |
| T7.E9.8 | Feed e aplausos | E9 | `migrations`, `18_social`, `tests/security` | T7.E9.3, D4 | só a crew vê; `KUDOS_SELF` e `KUDOS_LIMIT`; Realtime em `kudos`; notificação agrupada; caso adversarial verde |
| T7.E9.9 | Recordes, parciais e card | E9 | `migrations`, `scripts/backfill-stats.ts`, `19`, `21` | T7.E9.3, `runStats` da E3 | recorde só com `valid`; backfill roda sem erro no seed; `share_card` sem pontos de privacidade e com pontas cortadas (teste) |
| T7.E9.10 | Baú do dia | E9 | `migrations`, `20_daily_chest` | T7.E9.2, regra da E7 | trancado sem 1 km; uma vez por dia; chances na resposta; XP pelo livro |
| T7.E9.11 | LGPD v2 | E9 | `migrations`, `22_lgpd_v2` | T7.E9.5–10 | o teste estrutural garante que toda tabela com usuário entra no export; exclusão em cascata provada |
| T7.E9.12 | Repos do app para a v2 | E9 (tipos e chamadas, sem telas) | `apps/mobile/src/services/api/**` | T7.E9.2 | `server-info-repo`, `raid-repo`, `league-repo`, `missions-repo`, `social-repo`, `records-repo` com `FEATURE_UNAVAILABLE` no servidor antigo; jest, typecheck e lint verdes |
| T7.E9.13 | Seed v2 de demonstração | E9 | `supabase/seed_v2_demo.sql`, `gen-seed.ts` | T7.E9.5–10 | idempotente (roda 2× sem erro), tudo com `is_demo`, nenhuma senha nova |
| T7.E9.14 | Deploy v2 documentado | E9 | `supabase/DEPLOY.md`, `API_CONTRATO.md` | todas | ordem da §5.2, volta atrás da §5.3, comandos de flag e de fumaça; contrato com cada RPC e tabela nova |
| T7.E9.15 | Telemetria (se D6 = b) | E9 | `migrations`, `21b_telemetry` | D6 | lista fechada de eventos, consentimento, tetos, retenção de 30 dias, sem coordenadas |

---

## 11. Riscos de segurança e bloqueios

| Risco | Impacto | Mitigação |
|---|---|---|
| **A-1:** senhas de admin e moderador de demonstração públicas no Cloud | alto (quem lê o README entra como admin) | **Pendência do dono**: trocar as senhas no painel do Cloud (ou rebaixar `admin.demo`). A E9 não mexe nisso. O seed v2 não cria contas nem senhas. |
| Revoke esquecido (privilégio padrão do Supabase) | cliente grava placar e XP direto | checklist da §6 + testes estruturais do `12` (o rascunho prova que eles pegam) |
| Recompensa paga duas vezes | inflação de XP | `xp_ledger` único por `(fonte, referência)` e PKs por corrida, raid, missão e dia |
| Relógio do cliente (períodos, liga) | missão ou liga fora do período | período sempre pelo relógio do servidor (Brasília); semana fechada recusa pontos |
| Rota e casa no card ou no feed | privacidade (RN-010) | corte no servidor (zonas de privacidade + 200 m das pontas); feed sem coordenadas; `zone_tiles` sem `user_id` e sem leitura pelo cliente |
| Aplausos em massa e notificações em excesso | spam | teto de 200 por dia, sem aplauso em si mesmo, notificação agrupada |
| Linha quente do raid | lentidão no fim de corrida em pico | aceitável no TCC; plano B: vida = soma via job |
| App antigo com a prévia v1 depois da troca de regra | confusão no resumo | flag só depois do EAS Update e na virada de temporada |
| Constantes duplicadas no SQL | regra divergente entre app e jobs | teste de paridade (D8) |
| Sem rate limit nas functions (QA-08) | abuso de chamadas | segue para o gateway do Cloud; as RPCs novas têm tetos próprios |

**Bloqueios:**
- Neste ambiente não há Docker. O e2e, o adversarial (`edge-security.ts`) e o `bundle-check` rodam só na máquina da equipe, com `npm run db:reset`, `npm run db:test:psql`, `npm run e2e` e `npm run functions:bundle-check`.
- O deploy no Cloud exige o token do dono e não foi feito.
- Nenhum outro bloqueio.
