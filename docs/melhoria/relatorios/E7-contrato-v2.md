# E7 — Contrato v2 de engajamento (para a E9)

> **Fase 7, onda 1.** Substitui a §10 de `docs/melhoria/F1/07-engajamento.md`.
> **Fonte da verdade das regras:** `apps/mobile/src/domain/progression.ts`, `missions.ts` e `reminders.ts`, já registrados na ponte (`supabase/functions/_shared/domain.ts`). A Edge Function chama o domain; o SQL guarda, trava e confere.
> **Base:** o rascunho da E9 (`docs/melhoria/F1/backend/rascunho-v2.sql`, §§1, 3 e 7). A seção 1 lista **o que precisa mudar nele**.

---

## 1. Mudanças obrigatórias no rascunho da E9

| # | Onde | Rascunho atual | Contrato v2 | Por quê |
|---|---|---|---|---|
| 1 | `mission_defs.id` | `check (id ~ '^[a-z0-9_]{3,40}$')` | `check (id ~ '^[a-z0-9-]{3,40}$')` | Os 29 ids têm hífen (`d-mover-15`, `v-7`) e **não mudam** |
| 2 | `mission_defs.kind` | daily / weekly / monthly / ftue | + `'volta'` | Missão de volta (D-65, §3.6 da F1) |
| 3 | `mission_defs` | sem nível nem exigência | + `tier text check (tier in ('leve','padrao','desafio'))`, + `requires text null check (requires in ('crew','zone_under_attack','raid'))` | Sorteio 1 leve + 1 padrão + 1 desafio, só missão possível |
| 4 | `mission_defs.target` | `integer > 0` fixo | + `target_rule text not null default 'fixed' check (target_rule in ('fixed','daily_km','weekly_km','raid_km'))`; `target` vira `integer null` (obrigatório quando `fixed`) | Alvo adaptativo (§5) |
| 5 | `mission_defs.metric` | 9 métricas | as 17 da §4 | Catálogo da F1 |
| 6 | `user_missions.period_key` | `AAAA-MM-DD`, `AAAA-Www`, `AAAA-MM`, `ftue` | + `volta-AAAA-MM-DD` | Uma missão de volta por ausência |
| 7 | `user_missions` | único por `(user, def, period)` | + `slot smallint not null`, + `variant text not null default 'base' check (variant in ('base','fallback'))`, + `available_from timestamptz not null`, + `rerolled_at timestamptz`; **único também por `(user_id, period_key, slot)`** | Troca de 1 por dia mantém o slot; FTUE com versão alternativa; janela da FTUE e da volta |
| 8 | `private.advance_missions` | soma `progress + delta` | grava o **progresso absoluto** calculado pelo domain: `progress = greatest(progress, p_progress)` | "Zonas diferentes" e "bairros" contam ids distintos entre corridas; somar deltas conta repetido |
| 9 | Resgate | `claim_mission` manual | **pagamento automático** na conclusão (`claimed_at = completed_at`, `grant_xp('mission', user_missions.id)`); `claim_mission` fica como caminho idempotente (devolve `alreadyClaimed`) | Celebração no resumo (F1 §3.1); nada de gesto vazio |
| 10 | `xp_ledger.source` | 7 fontes | superconjunto da §6 | XP linha a linha no resumo (transparência) |
| 11 | `daily_rewards` | PK `(user_id, day)`; 1 baú que some no fim do dia; `random()`; XP da Caça (20/60/150) | PK `(user_id, day, n)` com `n` 1..3; **acumula até 3** (D-66); sorteio por HMAC; XP do baú do dia **15/40/100**; garantia no 20º | Resposta ao pedido da E9 na §4.7: **acumula**, não some (descanso não é punido) |
| 12 | `job_close_week` | gasta congelamento mesmo com sequência 0 | regra de `closeStreakWeek` (§7) | D-63 |

---

## 2. Tabelas e colunas

Padrão comum da E9 vale para todas: FK `profiles(id) on delete cascade`, RLS, `revoke all` de `anon`/`authenticated`, `select` só do dono, escrita só por RPC `security definer` ou service role.

| Objeto | Colunas (novas ou alteradas) | Notas |
|---|---|---|
| `xp_ledger` | como no rascunho; `source` com a lista da §6 | `unique (user_id, source, ref)`; `profiles.xp` = soma. XP nunca diminui (C9: atividade reprovada depois não estorna) |
| `mission_defs` | `id`, `kind`, `tier`, `requires`, `metric`, `target`, `target_rule`, `min_meters integer null`, `reward_xp`, `title` (≤ 40), `fallback_when text null check in ('no_raid','no_league')`, `fallback_metric`, `fallback_target`, `fallback_title`, `bonus jsonb null`, `active`, `is_demo` | Seed = `MISSION_CATALOG` (29 linhas). `title` é o texto com `{x}`; o app troca pelo alvo |
| `user_missions` | rascunho + `slot`, `variant`, `available_from`, `rerolled_at` | `available_until` não precisa de coluna: sai do `period_key` (fim do dia / da semana em Brasília); `ftue` e `volta-*` não expiram |
| `daily_rewards` | `user_id`, `day date`, `n smallint check (n between 1 and 3)`, `rarity`, `xp`, `cosmetic_id text null`, `guaranteed boolean`, `activity_id uuid`, `opened_at` | PK `(user_id, day, n)`. Guardados **derivados**, não gravados (§5) |
| `profiles` (novas) | `best_streak_weeks smallint default 0`, `pause_from date`, `pause_until date`, `pause_used_season text`, `daily_chest_pity smallint default 0 check (between 0 and 19)`, `lifetime_meters bigint default 0`, `ftue_started_at timestamptz`, `last_activity_at timestamptz` | `streak_weeks` e `freezes_left` já existem (`freezes_left` passa a aceitar até 2). Na view pública só título e faixa; pausa nunca |
| `user_cosmetics`, `user_equipped`, `track_claims` | como no rascunho (§4.4 da E9) | `equip_cosmetic` confere a posse |
| `notifications.type` | + `'reward'` (rascunho já tem) | Tipo fino em `data.kind` (`bau`, `sequencia`, `missao`…) |
| `notification_prefs` (jsonb) | + `chests`, `streak`, `league`, `raid`, `season`, `recap`, `comeback` (padrão `true` quando falta), + `quietStart`, `quietEnd` (horas), + `snoozeUntil` (ms) | Mesmo formato de `ReminderPrefs` |

---

## 3. RPCs (`authenticated`)

| RPC | Faz | Domain usado como referência |
|---|---|---|
| `my_engagement()` | Devolve `{ level, xp, intoLevel, needed, title:{id,name}, band:{id,name,metersToNext}, lifetimeMeters, streak:{weeks, best, activitiesThisWeek, freezesLeft, pause:{from,until}\|null}, dailyChest:{stored, pityLeft, odds}, missions:{daily[], weekly[], ftue[], comeback?}, season:{id, xp, step, intoStep, medal, prestigeStars} }` | `levelProgress`, `runnerBand`, `dailyChestsStored`, `dailyChestOdds`, `seasonTrackStep`, `ftueSteps` |
| `my_missions()` | Como no rascunho, com o sorteio **por (kind, tier)**: 1 leve + 1 padrão + 1 desafio, filtrando `requires` (crew, zona do time sob ataque a ≤ 3 km, raid ativo); determinístico por `(user, period_key)` | `drawMissions` (propriedades: sempre 1 de cada nível; nunca missão impossível) |
| `reroll_mission(p_id uuid)` | Troca **1 diária por dia** (conta `rerolled_at` do dia em Brasília) por outra do mesmo `tier`, ainda não sorteada no dia e possível; mesmo `slot`, progresso 0. Erros: `MISSION_REROLL_LIMIT`, `MISSION_COMPLETED`, `MISSION_NO_OPTION` | `rerollMission` |
| `claim_mission(p_id uuid)` | Idempotente; normalmente devolve `alreadyClaimed` (o finish já pagou) | — |
| `open_daily_chests()` | Abre **todos** os guardados (≤ 3) se houver atividade pontuada de ≥ 1 km hoje, trust ≥ 40 e nenhuma abertura hoje. Devolve `{ prizes:[{n, rarity, xp, cosmeticId, guaranteed}], pityLeft, odds, alreadyOpened }`. Erros: `DAILY_CHEST_LOCKED` (sem 1 km hoje), `DAILY_CHEST_REVIEW` (trust < 40) | `canOpenDailyChests`, `openDailyChests`, `resolveCosmeticDrop` |
| `start_health_pause(p_weeks int)` / `end_health_pause()` | 1 a 4 semanas, 1 vez por temporada, começando na segunda da semana atual; encerrar antes protege só a semana atual. Erros: `PAUSE_WEEKS`, `PAUSE_USED`, `PAUSE_ACTIVE` | `startHealthPause`, `endHealthPause` |
| `record_share(p_activity uuid)` | Passo 7 da primeira semana; 1 crédito por dia | `missionProgress` (`shares`) |
| `xp_history(p_limit int)` | Lista do ledger com o rótulo de `XP_SOURCE_LABELS` | — |
| `equip_cosmetic(p_slot, p_cosmetic)` | Só o que está em `user_cosmetics` | — |

---

## 4. Métricas das missões (TS → SQL)

| `MissionMetric` (domain) | `metric` no SQL | Como conta | Missões |
|---|---|---|---|
| `movingSeconds` | `moving_seconds` | soma | d-mover-15, s-60-min, v-7, v-30 |
| `meters` | `meters` | soma (metros válidos) | d-1500m, d-km, s-km, v-14 |
| `atlasCells` | `new_fog_cells` | soma | d-neblina-5, d-neblina-20, f4 (alternativa) |
| `zonesPainted` | `zones_painted` | **ids distintos** com pontos > 0 | d-pintar-3, s-pintar-10 |
| `districts` | `districts` | **ids distintos** (H3 res. 7 das zonas) | s-bairros-2 |
| `huntChests` | `chests_opened` | soma | d-caca-2, f2-caca |
| `ghostWins` | `ghost_wins` | atividades com `beatGhost` e `meters ≥ min_meters` | d-fantasma, f3-fuga (1 km) |
| `conquered` | `zones_conquered` | soma | d-conquistar, s-conquistar-3 |
| `defended` | `zones_defended` | soma | d-defender |
| `groupActivities` | `crew_runs` | atividades com bônus de grupo | d-crew, s-crew-2 |
| `activities` | `runs` | atividades pontuadas | s-2-atividades |
| `raidMeters` | `raid_damage_m` | soma | s-chefao, f4-raid |
| `paintedActivities` | `painted_runs` | atividades com `meters ≥ min_meters` e ≥ 1 zona pintada | f1-dominio (500 m) |
| `crewMember` | `crew_member` | 1 se é membro de crew | f5-crew |
| `leaguePoints` | `league_points` | 1 se pontos da liga da semana > 0 | f6-liga |
| `rankingOpened` | `ranking_opened` | 1 se abriu o ranking na janela | f6 (alternativa) |
| `shares` | `shares` | `record_share` na janela | f7-compartilhar |

**Só contam** atividades `valid` ou `partially_valid`, dentro da janela (`available_from` ≤ fim < fim do período), cada id uma vez. Atividade aprovada depois pela moderação: o finish/moderate reprocessa as missões do período, se ainda abertas.

---

## 5. Números (constantes do domain; a E9 não deve copiar à mão sem o teste de paridade da §9)

| Regra | Valor | Constante |
|---|---|---|
| Curva | `arred10(50·n^1,3) + 50`; nível 50 = 174.160 XP | `xpToNextLevel`, `totalXpForLevel` |
| Distância | 10 XP/km até 5 km/dia, 5 XP/km de 5 a 15 km, 0 depois (telescópico: dividir não rende) | `XP_RULES_V2`, `dailyDistanceXp` |
| Concluída | +30 com ≥ 1 km **ou** ≥ 15 min, 1×/dia | `XP_RULES_V2.completeXp` |
| Atlas | 2 XP por trecho novo, teto **60 por dia** | `atlasXpCapPerDay` |
| Fantasma | +50, **1×/dia** | `ghostXp` |
| Baús da Caça | 20/60/150 (inalterado) | `CHEST_XP` (games.ts) |
| Teto diário da atividade | 240 XP (sem Caça, baús, missões) | `DAILY_RUN_XP_CAP` |
| Semana garantida | +50 na atividade que completa 2 na semana | `weekKeptXp` |
| Missões | diária 20/30/40 · semanal 100/150/200 · FTUE 400 no total · volta 50/60/80 | `MISSION_CATALOG` |
| Alvos | d-km: mediana das 10 últimas, 0,5 km, 2–8 km · s-km: 0,9 × mediana de 4 semanas, ≤ 1,1 × maior, 6–40 km · s-chefao: metade do s-km, 1–15 km | `dailyKmTarget`, `weeklyKmTarget`, `raidKmTarget` |
| Baú do dia | guardados = `min(3, dias desde a última abertura)`; conta sem atividade: 1; nunca aberto: `min(3, dias desde a criação + 1)`; abre com ≥ 1 km pontuado, trust ≥ 40; 70/25/5; XP 15/40/100; cosmético 0/5/30%; 20º sem lendário = lendário; repetido = +20 XP | `DAILY_CHEST`, `dailyChestsStored`, `rollDailyChest` |
| Sorteio do baú | `r = HMAC(segredo, userId|dia|n)` → dois números em [0, 1) (`rarity`, `cosmetic`) → `rollDailyChest(r, pity)` | o segredo fica só no servidor |
| Trilha | 24 degraus de 120 XP; medalhas 8/16/24; estrela a cada 240 XP depois | `SEASON_TRACK`, `seasonTrackStep` |
| Títulos / faixas | 8 títulos (níveis 1/5/10/15/20/30/40/50); 8 faixas (0/10/50/150/400/1.000/2.500/5.000 km) | `RUNNER_TITLES`, `RUNNER_BANDS` |

---

## 6. `xp_ledger.source` e convenção de `ref`

| `source` | `ref` | Quem grava |
|---|---|---|
| `run` (legado, v1) | `activity_id` | finish v1 |
| `run_distance`, `run_complete`, `fog`, `ghost`, `hunt_chest` | `activity_id` | finish v2 (uma linha por fonte de `runXp().lines`) |
| `daily_chest` | `AAAA-MM-DD:n` | finish v2 / `open_daily_chests` |
| `duplicate_cosmetic` | `AAAA-MM-DD:n` | idem |
| `mission`, `ftue`, `comeback` | `user_missions.id` | finish v2, `record_share`, entrada na crew |
| `week_kept` | `AAAA-Www` | finish v2 |
| `season_step` | `AAAA-MM:degrau` | job/trilha |
| `medal`, `raid`, `league`, `track` | como no rascunho | E9 |

---

## 7. Jobs

| Job | Regra |
|---|---|
| `job_close_week` (estender; segunda 00:10 BRT) | Para cada perfil, `closeStreakWeek(state, { monday, activities })`: ≥ 2 atividades → `weeks+1` e `best = max`; semana que toca a pausa (`pause_from..pause_until`) → nada muda; **só gasta congelamento se `weeks > 0`**; senão `weeks = 0` (`best` fica). Grava `notifications` "Semana protegida pelo congelamento" quando gastar |
| `job_season_rollover` (estender) | `freezes_left = refillStreakFreezes(freezes_left)` (pelo menos 1, no máximo 2); medalha pela trilha; `pause_used_season` não precisa zerar (compara com a temporada nova) |
| `nomaderun-nudges` (E9, opcional) | **Não precisa na onda 2:** os lembretes são locais (`planReminders`). O servidor só cria `n-chefao`, `n-liga` e `n-volta-14-zona` na hora do fato, passando por `private.can_notify_engagement(user, now)` = mesmas regras (1/dia, 4 em 7 dias, 8h–21h BRT, preferência, nada no dia em que correu) |

---

## 8. Gravação v2: bloco `extras.engagement` da resposta do `finish-activity`

Segue o padrão do rascunho (campos **opcionais** dentro de `extras`; o app antigo ignora). Substitui `extras.missionsCompleted`.

```ts
// apps/mobile/src/domain: tipos XpLine, DailyChestPrize, SeasonMedal, MissionCadence
type EngagementBlock = {
  xp: { total: number; lines: XpLine[] };            // runXp().lines + weekKeptXp + baús do dia + missões, na ordem do resumo
  level: { before: number; after: number; titleAfter: { id: string; name: string } | null }; // titleAfter só se mudou
  band: { before: string; after: string };            // runnerBand(lifetimeMeters antes/depois).band.id
  dailyChests:
    | { opened: (DailyChestPrize & { n: number; cosmeticId: string | null })[]; pityLeft: number }
    | { opened: []; reason: 'status' | 'distance' | 'review' | 'already'; stored: number };
  missions: { id: string; userMissionId: string; cadence: MissionCadence; text: string; xp: number }[]; // concluídas agora
  streak: { activitiesThisWeek: number; weekKept: boolean; weeks: number; best: number; freezesLeft: number; paused: boolean };
  season: { stepBefore: number; stepAfter: number; medal: SeasonMedal | null };
  ftue?: { stepDone: number | null; nextUnlocksAt: number | null };
  comeback?: { missionId: 'v-7' | 'v-14' | 'v-30' };
};
```

**Ordem no finish v2** (mesma transação do resultado oficial; tudo idempotente pelo ledger e pelas PKs):
1. `today` = linhas do ledger do dia (Brasília) → `XpDayTotals`; `runXp({ status, meters, movingSeconds, newAtlasCells, beatGhost, huntChests, today })` → `grant_xp` por linha. `response.xp` continua sendo a soma (clientes antigos).
2. Semana: conta atividades pontuadas da semana → `weekKeptXp(antes, depois)`.
3. Baú do dia: `canOpenDailyChests` → `openDailyChests(rolls HMAC, profiles.daily_chest_pity)` → `resolveCosmeticDrop` → grava `daily_rewards`, ledger e o novo `pity`.
4. Missões abertas do período (diárias, semanais, FTUE liberada, volta): carrega a evidência do período → `settleMission` → `progress = greatest(...)`; conclusão paga e preenche `completed_at`/`claimed_at`.
5. `levelProgress(xp antes/depois)`, `runnerBand(lifetime antes/depois)`, `seasonTrackStep(xp da temporada antes/depois)`.
6. Atualiza `last_activity_at`, `lifetime_meters`; se a pessoa voltava de 7+ dias, cria a missão de volta antes do passo 4 (`comebackAssignment`).

**Atividade em revisão:** `runXp` devolve 0 e o baú responde `review`; a aprovação reprocessa os passos 1–4.

---

## 9. Testes que a E9 entrega

- **pgTAP:** RLS e revoke das tabelas novas; ids com hífen aceitos em `mission_defs`; sorteio com 1 por `tier` e sem `requires` impossível; troca 1 por dia; conclusão e pagamento 1 vez (`unique` do ledger); `daily_rewards` com 3 guardados e nenhum 4º; garantia no 20º; pausa 1 vez por temporada; `job_close_week` não gasta congelamento com sequência 0.
- **Deno (paridade):** o finish v2 importa o domain; um teste fixa os números da §5 (ex.: `dailyDistanceXp(15_000) = 100`, `totalXpForLevel(50) = 174160`, `weeklyKmTarget([20e3 ×4]) = 18e3`) para pegar qualquer cópia divergente em SQL (`private.mission_target`, `private.chest_rarity`).
- **Deno:** `extras.engagement` presente com o servidor novo e ausente com a flag `features.missions` desligada.
