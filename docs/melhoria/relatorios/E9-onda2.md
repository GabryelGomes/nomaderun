# E9 — Backend do jogo · Fase 7, onda 2 (gravação v2, pintura, feed, recordes, engajamento, LGPD v2)

> Equipe E9 · 23/10/2026 · branch `worktree-agent-af07e76e379bda412` (base `89144d8`)
> Tarefas: **T7.2.1** (gravação v2 + pintura no banco + paridade) e **T7.2.2** (feed e aplausos, recordes e parciais, `my_engagement`, LGPD v2, seed v2, documentação).
> Contratos seguidos: `E3-contrato-v2.md` (§1–§6), `E7-contrato-v2.md` (§3, §4, §8, §9), `E8-onda1.md` (§4, §6, §9: corte na function, `ServerClippedRoute`). Decisões: D-62, D-66, D-67, D-79, D-80, D-83, D-84.

## 1. Resumo

- **Gravação v2:** o `finish-activity` e a aprovação da moderação continuam chamando o cálculo v1 **sem mudança**. Depois, só se alguma flag estiver ligada, a function lê o contexto, calcula com o domain e grava tudo numa transação (`svc_apply_v2`). A resposta ganha o bloco opcional `extras` (pintura, pontos, liga, raid, engajamento, recordes, feed). **Com as flags desligadas, a resposta é byte a byte a de hoje** (teste Deno).
- **Pintura no banco (D-62):** `zone_cells` (sem autor), `paint_marks` (cliente não lê), colunas novas em `zones`, `zone_paint_near` (retrato sem autor, sem hora e sem zonas de privacidade), `job_fade_cells` (03:00 BRT, idempotente), virada v1 → v2 com herança por trigger e a volta atrás documentada.
- **Feed (D-79):** `feed_items` com a rota cortada na function pelo `clipRouteForSharing` (semente nova a cada vez), polyline de precisão 4 com até 80 pontos e conferência de privacidade depois da simplificação; sem horário; só a crew; `kudos` (Bora!/Fogo/Raio, sem si mesmo, 200/dia, Realtime).
- **Recordes e parciais:** `activity_stats` e `personal_records`, derivados dos trechos válidos.
- **Engajamento:** `my_engagement()` (curva, títulos e faixas do domain em `private.domain_constants()`); `record_share` e `record_ranking_opened` já existiam (onda 1).
- **LGPD v2:** `account_export_v2` + teste estrutural (tabela com usuário fora da exportação = vermelho; toda FK para a pessoa é `cascade`/`set null`; exclusão não deixa linha nenhuma).
- **Seed v2 de demonstração** idempotente (roda 2 vezes; teste próprio), tudo marcado.
- **D-84:** Fuligem fora de agosto e setembro no `raid_boss_for_week`, com teste de paridade contra o `raid.ts`.
- **Testes:** pgTAP **574 → 716** (24 arquivos; +10 do seed v2 quando aplicado: 726). Deno **58 → 82** (+1 ignorado, igual à base). `deno check` das 8 functions ok.

## 2. Antes × depois

| | Antes (base `89144d8`) | Depois |
|---|---|---|
| `finish-activity` | só v1 | v1 igual + `extras` atrás das flags (idempotente, repetição aplica o que faltou, erro na v2 nunca derruba a v1) |
| Território | influência (v1) | pintura pronta no banco; liga por `territory_rule = 'v2'` com herança automática |
| Constantes SQL × domain | conferidas à mão em 1 pgTAP | `private.domain_constants()` + `parity.test.ts` (8 testes: pintura, curva de XP, títulos, faixas, trilha, raid, sorteio do crítico em 4.000 sementes, rodízio com a D-84 em 624 semanas, liga, baú, alvos das missões) |
| Feed, aplausos, recordes | não existiam | tabelas, RPCs, Realtime e testes |
| Exportação LGPD | v1 (15 tabelas) | v2 (todas as 36 tabelas com dado da pessoa) + teste estrutural |
| pgTAP | 574 | 716 |
| Deno | 58 | 82 |

## 3. Migrations, functions e testes

| Migration | Conteúdo | pgTAP |
|---|---|---|
| `20261023120700_paint` | `domain_constants()`/`dc()`, `territory_rule()`; colunas `rule_version`, `inherit_*`, `attack_last_at`, `attack_flips` em `zones`; `zone_cells` (check `h3_parent(cell, 9) = zone_id`), `paint_marks`; `paint_effective_layers`, `paint_counts`, `paint_owner`, `paint_under_attack`, `paint_influence`, `paint_refresh_zone`; `zone_paint_near`; `paint_switch_to_v2` + trigger + `job_territory_switch`; `job_fade_cells` (cron `0 6 * * *`); decaimento/fortificar só na v1; `raid_boss_for_week` com a D-84 | `21_paint` (40) |
| `20261023120800_records_social` | `activity_stats`, `personal_records`, `my_records`; `user_settings`, `my_feed_settings`, `set_feed_settings`; `feed_items`, `kudos` (Realtime), `can_see_feed_item`, `crew_feed`, `feed_item_kudos`, `react_feed_item`, `delete_feed_item` | `23_records_social` (35) |
| `20261023120900_v2_recording` | `activities.v2_extras`, `v2_any_on`, `svc_v2_context`, `v2_zone_event`, `svc_apply_v2` | `22_v2_recording` (40) |
| `20261023121000_engagement_lgpd` | `xp_to_next_level`, `level_progress`, `runner_band`, `season_track_step`, `my_engagement`; `export_v2_tables`, `account_export_v2`, `svc_account_export_v2` | `24_engagement_lgpd` (27) |

**Asserções antigas atualizadas de propósito (nenhuma apagada ou pulada):** `01_schema` nº 2 (42 → 49 tabelas) e nº 8 (6 → 7 jobs); `12_security_audit` nº 13 (Realtime ganha `kudos`) e as listas das nº 6, 7 e 8 ganharam as 7 tabelas novas (teste mais forte, mesmo número de asserções).

**Functions:** `finish-activity`, `moderate-activity` (pelo `_shared/finish.ts`) e `account-export`. Código novo em `_shared/v2.ts` (puro: plano e `extras`), `_shared/v2-run.ts` (I/O, novas tentativas em `ZONE_CONFLICT`), `_shared/records.ts`, `_shared/feed.ts`. `account-delete`: só o comentário (a exclusão já era em cascata; o pgTAP 24 prova).

**Deno novos:** `parity.test.ts` (8), `v2.test.ts` (8), `feed_records.test.ts` (8, com 600 casos de propriedade de privacidade e 300 de recordes).

**Seed:** `supabase/seed_v2_demo.sql` + `supabase/tests/seed/seed_v2_demo.test.sql` (10).

## 4. Decisões de implementação (para o coordenador registrar como D-xx, se aprovar)

1. **`extras` como bloco único.** O contrato da E3 punha `paint`, `points`, `raid` e `league` no topo da resposta; aqui tudo fica em `extras` (pedido da tarefa), com `extras.contract = 2`.
2. **Território v2 sem mudar a v1:** com `territory_rule = 'v2'`, a function manda para a gravação v1 só as zonas **novas** (neutras) e nenhum evento; a pintura decide dono, placar e notificações. `zones.influence` vira espelho (trechos × 10) para o app antigo e para a volta atrás. Os `rp` continuam os da v1 (rankings não mudam).
3. **XP sem pagar em dobro:** com `features.missions`, a v1 grava `xp = 0` e o XP sai em linhas no `xp_ledger`; `response.xp` = XP v2 da própria atividade. Corrida já paga pela v1 (finalizada antes de ligar e reenviada) não recebe o XP de novo.
4. **Idempotência por `activities.v2_extras`** (o bruto do que foi aplicado); a function remonta `extras` a partir dele. Cada parte também é idempotente pelas próprias chaves.
5. **Erro na v2 nunca derruba a v1:** vira log e a resposta sai sem `extras`; a próxima chamada do finish aplica o que faltou.
6. **`zone_cells` sem `painted_by`:** o contrato da E3 sugeria a coluna; ela não é necessária para nenhuma regra e seria dado de localização por pessoa. O retrato é anônimo por construção.
7. **Virada por trigger** em `game_config.territory_rule` (v1 → v2 aplica a herança na mesma transação); `job_territory_switch()` refaz (idempotente). Decaimento e fortificar por influência só rodam na v1 (mesmos jobs, comando com guarda).
8. **Temporada da pintura** dentro do `job_fade_cells`: trecho vivo de temporada anterior volta a 1 camada (`seasonResetPaint`), sem job novo para a virada de mês.
9. **Feed:** `feed_items` não tem leitura direta (o `created_at` só ordena e nunca sai); `kudos` só tem `day` (sem horário) e vai pelo Realtime com a RLS de `can_see_feed_item`. A notificação de aplauso é 1 por item por dia, com o total atualizado (o push agrupado é local, no app).
10. **Rota do feed:** depois do `clipRouteForSharing`, Douglas–Peucker até 80 pontos, precisão 4 e uma conferência da linha desenhada (densificada a cada 8 m): nada dentro do raio de zona de privacidade nem a menos de 135 m das pontas; se falhar, o item vai sem rota.
11. **Recordes só com `valid`** (parcial não conta), melhor esforço exato (janelas que começam e que terminam em ponto, com interpolação).
12. **Seed v2 sem Raid nem Liga** (D-76: seriam vistos por contas reais da cidade) e sem sortear missões (o servidor sorteia na 1ª chamada); conta nova `parceira_demo` **sem senha** (não amplia o A-1).
13. **`my_engagement`** devolve `null` nas partes de feature desligada, em vez de `FEATURE_DISABLED` para tudo (nível, título e faixa sempre existem).

## 5. Lista para os repositórios do app (E3, E7, E8)

- **Todos:** `rpc('server_info')` (onda 1) e o bloco `extras` do `finish-activity` (tipos em `docs/API_CONTRATO.md`, seção "Contrato v2 — onda 2").
- **E3 (pintura, raid, liga):** `zone_paint_near(p_lat, p_lng, p_radius_m)` → `LiveSnapshot`; `extras.paint`, `extras.points`, `extras.raid`, `extras.league`; colunas novas em `zones` (`inherit_until`, `rule_version`…); `raid_current`, `league_current` (onda 1).
- **E7 (engajamento):** `my_engagement()`; `extras.engagement` (E7 §8); `my_records()`; tabelas `activity_stats`, `personal_records`; `record_share(p_activity)`, `record_ranking_opened()`, `my_missions`, `my_daily_chest`, `my_track` (onda 1).
- **E8 (social):** `crew_feed(p_limit, p_before)`, `react_feed_item(p_item, p_reaction)`, `feed_item_kudos(p_item)`, `delete_feed_item(p_item)`, `my_feed_settings()`, `set_feed_settings(p_share_runs, p_show_map)`; Realtime em `kudos`; `route` = `string[]` de polylines precisão 4 (`ServerClippedRoute`); notificação `type = 'kudos'`; `extras.feed.itemId`; `account_export_v2()`.

## 6. Pedidos

- **E3:** o teste de paridade aceita hoje o `raidBossForWeek` antigo (sem a D-84) e passa a exigir igualdade total quando o `raid.ts` pular a Fuligem — com a **mesma regra** daqui: na semana que começa (segunda, Brasília) em agosto ou setembro, se o rodízio cair na Fuligem, entra o **próximo** do rodízio (Mormaço) e as outras semanas não mudam. O teste usa o nome `raidBossForWeek`; se a função mudar de nome, troque o import em `supabase/functions/tests/parity.test.ts`.
- **E3/E8:** mover `_shared/records.ts` (parciais e melhores esforços) para o domain quando o app precisar da mesma conta.
- **E10:** pôr na CI o comando do seed v2 (`NR_EXTRA_SQL=... NR_EXTRA_TESTS=...`, `supabase/DEPLOY.md` §8.1); casos adversariais em `supabase/tests/security/` (aplauso em item invisível, `zone_paint_near` com zona de privacidade, `svc_*` com a chave anon) e os pares de demonstração das RPCs novas.
- **E6/E8:** chamar `set_feed_settings` na tela de privacidade (padrão: tudo ligado) e avisar ao entrar na crew que as corridas aparecem para ela.
- **Coordenador:** registrar as decisões da §4; a ordem de ligar as flags está em `supabase/DEPLOY.md` §8.2.

## 7. Pendências

- A validação do fantasma por `ghostPaceAllowedV2` (E3 §7) ficou na v1 (o `beatGhost` vem do cálculo v1); na v2 o fantasma só dá XP (`runXp`), não multiplica pontos.
- Telemetria (D-82) fica para a onda 3.
- `bundle-check`, `e2e` e o `db push --dry-run` precisam da máquina com Docker/Cloud: `npm run db:reset`, `npm run db:test:psql`, `npm run e2e`, `npm run functions:bundle-check`.

## 8. Riscos

- **Linha quente:** a pintura trava as zonas tocadas (como a v1); muitas corridas na mesma zona ao mesmo tempo podem dar `ZONE_CONFLICT` 3 vezes → a resposta sai sem `extras` e a próxima chamada aplica.
- **Corrida antiga reenviada depois da virada** do território é pintada com a hora atual (igual à v1, que também aplicava influência na sincronização tardia).
- **Shim, não o Supabase:** Realtime de `kudos` com RLS e o PostgREST das RPCs novas só são provados no e2e com Docker.
- **Postgres 16 × 17**, como na onda 1.

## 9. Como rodar

```bash
npm run db:test:local                                   # 716 pgTAP (24 arquivos)
NR_EXTRA_SQL="supabase/seed_v2_demo.sql supabase/seed_v2_demo.sql" \
  NR_EXTRA_TESTS=supabase/tests/seed/seed_v2_demo.test.sql npm run db:test:local   # + seed v2 duas vezes (726)
npx -y deno test --allow-read --config supabase/functions/deno.json supabase/functions/tests   # 82 ok, 1 ignorado
npx -y deno check --config supabase/functions/deno.json supabase/functions/*/index.ts
```
