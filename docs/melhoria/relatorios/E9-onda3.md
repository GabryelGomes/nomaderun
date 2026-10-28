# E9 — Backend do jogo · Fase 7, onda 3 (T7.3.8)

> Equipe E9 · 28/10/2026 · branch `worktree-agent-a4743fbc5730e825c` (base `092497c`; o WIP `38016e3` da pausa foi mantido e os commits seguem por cima).
> Pedidos atendidos: E3-onda2 (`paintedToday`), E7-onda2 (`pauseAvailable`, chaves do `notify_pref`, telemetria D-82), E8-onda2 (`weekly_recap`).

## 1. Resumo

| Item | Entrega |
|---|---|
| `paintedToday` | campo novo em `zone_paint_near`: ids dos trechos que a própria pessoa pintou hoje, no raio, sem hora, sem trecho em zona de privacidade |
| `pauseAvailable` | `my_engagement().streak.pauseAvailable` (`null` com `streakV2` desligada) |
| `notify_pref` | **achado de segurança corrigido**: valor não booleano em `notification_prefs` (ex.: `"abc"`) levantava erro dentro da transação de OUTRA pessoa (invasão no finish do atacante, aplauso, job da sequência de todo mundo). Migration limpa os valores e põe um CHECK; `notify_pref` só lê booleano |
| `weekly_recap` | RPC (números, `days[7]`, sem rotas) + Edge Function **`weekly-recap`** (números + até 3 rotas cortadas pelo `clipRouteForSharing` com semente nova, pelo mesmo caminho do feed). Sem horário |
| Telemetria (D-82) | `telemetry_consent`, `telemetry_events` (lista fechada de 5 eventos, só o dia, props por lista branca sem coordenada), `track_events` (lote ≤ 50; `TELEMETRY_CONSENT` sem opt-in), `set_telemetry_consent` (retirar apaga), `my_telemetry_consent`, job de 30 dias, export e cascata |
| Segurança | pgTAP 28 (17 casos adversariais no banco) + `supabase/tests/security/v2-security.ts` (HTTP, máquina com Docker) |
| CI | seed v2 aplicado 2 vezes + teste do seed no job `db` (commit separado, o último) |

## 2. Migrations

| Migration | Conteúdo | pgTAP |
|---|---|---|
| `20261024120000_paint_today_pause_prefs` | limpeza + CHECK `profiles_notification_prefs_boolean`; `notify_pref` seguro; `private.cell_in_privacy_zone`; `zone_paint_near` + `paintedToday`; `my_engagement` + `pauseAvailable` | `25_paint_today_pause_prefs` (18) |
| `20261024120100_weekly_recap` | `private.weekly_recap`, `private.recap_week`, `weekly_recap(p_week_start)`, `svc_weekly_recap(p_user, p_week_start)` | `26_weekly_recap` (19) |
| `20261024120200_telemetry` | tabelas, `telemetry_props_ok`, 3 RPCs, `job_telemetry_retention` + cron `nomaderun-telemetry-retention` (`40 6 * * *`), `export_v2_tables` e `account_export_v2` com a telemetria | `27_telemetry` (35) |
| — | casos adversariais | `28_v2_adversarial` (17) |

**Asserções antigas atualizadas de propósito (nenhuma apagada):** `01_schema` nº 2 (49 → 51 tabelas) e nº 8 (7 → 8 jobs);
`12_security_audit` nº 6, 7 e 8 ganharam as 2 tabelas de telemetria (mais fortes); `21_paint` nº 26 ("nenhum autor, hora
ou coordenada no retrato") passa a ignorar só o NOME da chave `paintedToday` — os valores continuam conferidos.

**Function nova:** `weekly-recap` (+ `_shared/recap.ts`, `config.toml`). Teste Deno `recap.test.ts` (5: entrada, lista
branca, rota curta, propriedade com 300 corridas e zonas de privacidade, semente nova muda o corte).

## 3. Nomes para o app

- **E3:** `zone_paint_near(...).paintedToday: string[]` (o `paint-repo.ts` já lê).
- **E7:** `my_engagement().streak.pauseAvailable`; telemetria: `my_telemetry_consent()`, `set_telemetry_consent(p_opt_in, p_policy_version)`,
  `track_events(p_events)`; eventos `app_open`, `run_finish`, `zone_conquer`, `share`, `mission_complete`; props `model`,
  `format`, `withRoute`, `kind`, `source`, `missionId`, `count`. Flag `features.telemetry`.
- **E8:** `POST /weekly-recap { weekStart? }` → `{ weekStart, weekEnd, final, days[7], meters, runs, movingSeconds, zones,
  streakWeeks, isDemo, routes: [{ pieces: string[] (polyline p4), routeHidden }] }`; `rpc('weekly_recap')` sem rotas.
- Detalhes: `docs/API_CONTRATO.md`, "Contrato v2 — onda 3".

**Chaves do `notify_pref` × `NotificationPrefs`:** o servidor lê `invasion`, `conquest`, `streak`, `league`, `raid` e
**`kudos`**. O app tem as 4 da v1 + `chests`, `streak`, `league`, `raid`, `season`, `recap`, `comeback` (mesmos nomes; as
4 últimas só servem aos lembretes locais). **Falta `kudos` no app** (E7/E8): hoje o aplauso não pode ser desligado.

## 4. Testes

- `npm run db:test:local`: **805/805** (28 arquivos; eram 716). Com o seed v2 aplicado 2 vezes + teste do seed: **815**.
- Deno: **87 ok, 1 ignorado** (eram 82). `deno check`: 9 functions + `v2-security.ts` ok.
- Máquina com Docker: `npm run db:reset`, `npm run db:test:psql`, `npm run e2e`, `npm run functions:bundle-check`
  (inclui `weekly-recap`) e `bash supabase/tests/security/run-v2.sh`.

## 5. Decisões (para o coordenador registrar, se aprovar)

1. Resumo da semana por **Edge Function** (o corte da rota é do domain, TS); a RPC fica como caminho sem rota.
2. Semana = segunda a domingo (Brasília) pelo **início** da corrida; padrão = semana atual; até 52 semanas atrás.
3. Telemetria **sem horário** (só o dia) e sem `created_at`; `app_open` 1 por dia; teto de 200/dia por descarte (não erro);
   retirar o consentimento apaga os eventos.
4. `pauseAvailable = null` com a sequência v2 desligada.

## 6. Pendências e riscos

- **Consultas D1/D7/D30** da telemetria (só staff) não foram feitas como view; ficam para quando houver dado.
- `weekly-recap` lê até 3 corridas inteiras (`svc_load_activity`): custo ~3 consultas por chamada; sem cache.
- `paintedToday` omite trecho que já sumiu de `zone_cells` (não há posição para filtrar pelo raio).
- O `v2-security.ts` só roda com Docker (não executado aqui; o pgTAP 28 cobre a mesma lógica no banco).
- Postgres 16 local × 17 no `config.toml`, como nas ondas anteriores.
