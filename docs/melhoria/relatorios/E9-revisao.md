# E9 — Correções da revisão da lógica v2 (A1, M1–M5, B4)

> 28/10/2026 · branch `worktree-agent-a4743fbc5730e825c` (com o merge de `claude/affectionate-gauss-e8gm77`).
> Migration `20261028120000_review_fixes.sql` (aditiva) e pgTAP `29_review_fixes.test.sql` (27 casos; cada um falharia antes da correção).

| Item | Correção | Prova (pgTAP 29) |
|---|---|---|
| **A1 (Alto, D-87)** | Máscara estável por zona de privacidade (`private.privacy_zone_masks`): centro deslocado 0,6–1,0 × raio, folga 25–85 m, sorteio gravado uma vez por zona; mover a zona reaproveita o sorteio. Usada em `zone_paint_near` (`cells` e `paintedToday`) e em `in_privacy_zone` (percurso para a staff) | ataque do revisor numa grade de ~20 m: círculo exato → erro < 10 m; máscara → erro > 100 m (0,5 × raio); zona 100 % coberta; retrato estável; mover a zona mantém o sorteio |
| **M1** | `kudos_log` (itens aplaudidos no dia): desfazer não libera o teto; aviso só no par novo do dia (não reabre `read_at`); `kudos_text` singular/plural | 35 ciclos → 1 aviso, lido, "1 reação"; 200 itens desfeitos → o 201º dá `KUDOS_LIMIT` |
| **M2** | `track_events` e `set_telemetry_consent` com a mesma trava por pessoa, antes de ler/gravar o consentimento | 2 sessões reais (dblink): desligar espera o envio e apaga os 2 eventos; nenhum sobra |
| **M3** | trigger `privacy_zones_after_write` tira as rotas da pessoa do feed ao criar/mover a zona | 202 rotas → 0, itens ficam com `route_hidden` |
| **M4** | `kudos` fora do Realtime; `feed_kudos_counts` (só contadores, RLS da crew) na publicação, mantida por trigger | publicação, colunas sem `user_id`, contadores corretos, fora da crew não vê |
| **M5** | `weekly_recap.zones` só conta `captured` do time da pessoa | evento de terceiro time não conta |
| **B4** | `league_current` usa a semana anterior até `league_closes_at` | conferência no código (o `now()` do teste não pode ser segunda 00:00–03:20) |

**Testes antigos ajustados de propósito (nenhum apagado):** `01_schema` (53 tabelas); `12_security_audit` (Realtime com `feed_kudos_counts` no lugar de `kudos`; listas com as 2 tabelas novas); `23_records_social` (Realtime pelos contadores; a fixture do teto passa a registrar `kudos_log` e o alvo é um item novo); `08`, `21` e `25` fixam a máscara no círculo exato para continuar conferindo ponto a ponto.

**Resultados:** `NR_PORT=54341 npm run db:test:local` **832/832** (29 arquivos); com o seed v2 duas vezes **842**. Deno **87 ok**, 1 ignorado.

**Para a E8 (app):** o app ainda não assinava `kudos`; para aplausos ao vivo, assine `feed_kudos_counts` (`event: '*'`, `table: 'feed_kudos_counts'`, opcional `filter: feed_item_id=in.(...)`) e use `bora/fogo/raio/total` direto; quem reagiu continua em `feed_item_kudos(p_item)`. Nada muda nas RPCs. **E3:** `league.ts:53` tem a mesma regra da B4 (semana nova antes das 03:20).

**Riscos:** a máscara esconde um pouco mais de pintura perto das casas (até ~2 × raio + 85 m); o `paint_marks`/`zone_cells` não mudam. O teste da M2 usa `dblink` (vem no contrib do Postgres; no Supabase CLI também existe).
