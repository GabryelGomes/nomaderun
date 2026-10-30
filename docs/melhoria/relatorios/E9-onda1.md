# E9 — Backend do jogo · Fase 7, onda 1 (fundação)

> Equipe E9 · 23/10/2026 · branch `worktree-agent-a2900914e6bf31470` (base `d7747d8`)
> Tarefas: T7.1.21 (banco local), T7.1.22 (contrato v2), T7.1.23 (Raid, Liga, missões, medalhas, trilha, baú do dia).
> Alinhado aos contratos da E7 (`E7-contrato-v2.md`) e da E3 (`E3-contrato-v2.md`), lidos na cópia principal.

## 1. Resumo

- **Banco local sem Docker no repositório:** `npm run db:test:local` (Postgres 16 + PostGIS + pgTAP + pg_cron do apt, shim do Supabase). Resultado: **574/574 pgTAP** (20 arquivos), com e sem seed, pelo `psql` e pelo `pg_prove`. Os 285 antigos continuam passando.
- **7 migrations novas, todas aditivas e desligadas por padrão** (`game_config.features.* = false`, `territory_rule = "v1"`). Com as flags desligadas, o app publicado não vê nada de diferente.
- **25 tabelas novas**, todas com RLS, `revoke all` de `anon`/`authenticated`, `select` mínimo e policy restritiva `*_active_account` nas que têm dado de usuário. O cliente não escreve em nenhuma: tudo passa por RPC `security definer` ou pelo service role.
- **Deno:** 57 ok, 2 ignorados (iguais à base); `deno check` das 8 functions ok. Nenhum arquivo do app nem da ponte do domain foi alterado.

## 2. Antes × depois

| | Antes (base `d7747d8`) | Depois |
|---|---|---|
| Banco local | só em `docs/melhoria/F1/backend/` (prova da F1) | `supabase/scripts/banco-local.sh` + `supabase-shim.sql`, `npm run db:test:local`, seção 0.1 do `DEPLOY.md`; bind mount automático e limpeza no fim |
| Contrato | sem versão | `server_info()` → contrato 2, flags e parâmetros públicos |
| XP | `profiles.xp += x` direto | `xp_ledger` (idempotente por `(user_id, source, ref)`), `grant_xp`, `xp_history`; XP nunca diminui (trigger) |
| Raid / Liga | só demonstração no app | tabelas, RPC da tela, golpe idempotente, jobs que abrem, fecham e premiam |
| Missões, medalhas, trilha, baú do dia | não existiam | catálogo (29 missões da E7, 12 medalhas da E4, 34 cosméticos, 24 degraus), RPCs e regras |
| Testes pgTAP | 285 | 574 |

## 3. Migrations e testes

| Migration | Conteúdo | pgTAP |
|---|---|---|
| `20261023120000_v2_contract` | `game_config` (flags + parâmetros de raid, liga, missões, baú e trilha), `server_info()`, `xp_ledger`, `grant_xp`, `svc_grant_xp`, `xp_history`, trigger `XP_DECREASE`, colunas novas em `profiles` (E7 §2), `notifications.type` superconjunto, `notify_pref` | `14_v2_contract` (30) |
| `20261023120100_rewards_catalog` | `cosmetic_defs`, `user_cosmetics`, `user_equipped` (FK garante a posse), `equip_cosmetic`/`unequip_cosmetic`, `medal_defs`, `user_medals`, `award_medal` (só sobe de nível) | `15_rewards_catalog` (26) |
| `20261023120200_daily_chest` | segredo HMAC gerado no banco, `daily_rewards`, `bonus_chests`, guardados derivados, sorteio HMAC + garantia no 20º, `open_daily_chests()`, `my_daily_chest()` | `16_daily_chest` (40) |
| `20261023120300_raids` | `raid_bosses` (`RAID_BOSS_IDS`), `raids` (Realtime), `raid_hits`, `raid_weak_points`, `raid_rewards`, `raid_visits`, `raid_seeded_unit` (paridade), `svc_raid_hit`, `raid_current()`, `job_raid_tick` (a cada 10 min) | `17_raids` (62) |
| `20261023120400_league` | `league_groups`, `league_members`, `league_reservations`, `league_entries`, `league_standings`, `add_league_points`, `league_current()`, `job_close_league` (segunda 03:20) | `18_league` (38) |
| `20261023120500_missions_track` | `mission_defs` (29 ids da E7), `user_missions`, `engagement_marks`, sorteio 3+3, `settle_mission`, `advance_missions`, `my_missions`, `reroll_mission`, `claim_mission`, `record_share`, `record_ranking_opened`; `track_rewards`, `track_claims`, `my_track`, `claim_track_step` | `19_missions_track` (74) |
| `20261023120600_streak_pause` | `job_close_week` v2 atrás de `features.streakV2` (desligada = regra antiga, igualzinha), `start_health_pause`, `end_health_pause` | `20_streak_pause` (19) |

**Asserções antigas atualizadas de propósito (nenhuma apagada ou pulada):**
- `01_schema` nº 2: 17 → **42 tabelas** (as 25 da v2); nº 8: 4 → **6 jobs** (`nomaderun-raid-tick`, `nomaderun-close-league`). O número de asserções não mudou.
- `12_security_audit` nº 13: o Realtime passa a ter `raids` (só vida, fase e status; o teste 17 confirma que `raids` não tem coluna de usuário). As listas das asserções 6, 7 e 8 ("cliente não insere/altera/apaga tabelas do servidor") ganharam as 25 tabelas novas, que o cliente não deve escrever: o teste ficou mais forte, com o mesmo número de asserções.

## 4. Decisões de implementação (para o coordenador registrar, se quiser, como D-xx)

1. **Notificações:** o `CHECK` de `notifications.type` só se amplia com `drop constraint` + `add constraint` na mesma instrução `alter table`. Não há outro jeito no Postgres; nenhum valor antigo deixa de valer.
2. **Segredo do HMAC do baú:** gerado pela própria migration (`private.server_secrets`, 32 bytes aleatórios); não fica no código e o cliente não lê o schema `private`.
3. **RPC de feature desligada** responde `FEATURE_DISABLED: …`; o app trata como indisponível (igual a `PGRST202` no servidor antigo).
4. **Missões (E7):** `kind` usa os mesmos valores de `MissionCadence` (`diaria`, `semanal`, `ftue`, `volta`). O sorteio no SQL é determinístico por `md5(usuário|período|id)`, não pelo `engagementRng` do domain: o servidor é a autoridade e o app lê as atribuições pelo `my_missions`. A troca é feita **no mesmo registro** (mesmo `id` e `slot`, progresso 0), por isso `unique (user_id, period_key, slot)` vale sempre. A primeira semana vale só para contas criadas depois da migration (`ftue_started_at` nulo nas antigas).
5. **Baú bônus** (passo 1, volta, chefão, trilha) ficou numa tabela à parte (`bonus_chests`), porque o domain limita os baús do dia a 3 (`n` 1..3). Abre junto com os do dia, com a raridade mínima, e não mexe na garantia.
6. **Raid (E3):** o servidor confere o crítico com o mesmo sorteio do domain (`raid_seeded_unit` é o `raidSeededUnit`, testado com valores tirados do próprio `raid.ts`) e aplica, nesta ordem: 21 km por corrida, 30 km por dia, limite de sanidade (10/km × crítico × ponto fraco × grupo) e, por último, 300 de dano por dia. O golpe final fica em `raid_hits.final_blow` (não em `raids`, que vai para o Realtime); `defeated_at` é o fim da corrida que derrubou.
7. **Liga (E3):** `leagueGroupsV2` roda no fechamento e **reserva** vagas para a semana seguinte (`league_reservations`); a pessoa só vira membro na 1ª corrida (D-68). Sem reserva, entra por `leaguePlaceNewcomer`.
8. **Sequência v2** (D-63, E7 §7) ficou atrás de uma flag nova, `features.streakV2`, para o job antigo continuar idêntico até a virada.

## 5. Como rodar

```bash
npm run db:test:local                 # na raiz; ≈ 10 s; 574/574
NR_SEED=0 npm run db:test:local       # sem o seed de demonstração
NR_KEEP=1 npm run db:test:local       # deixa rodando; o script imprime o psql e como parar
NR_INSTALL=1 npm run db:test:local    # 1ª vez numa máquina sem os pacotes (como root)
```
Na máquina da equipe (Docker): `npm run db:reset`, `npm run db:test:psql`, `npm run e2e`, `npm run functions:bundle-check`.

## 6. Pendências (onda 2) e pedidos

**Ficou para a onda 2 (E9):**
- Gravação v2 no `finish-activity`/`moderate-activity`: chamar o domain (`runXp`, `raidDamage`, `scoreRunV2`, `settleMission`, `openDailyChests`) e as funções desta onda (`svc_raid_hit`, `add_league_points`, `ensure_missions` + `advance_missions` com o progresso absoluto, `open_daily_chests`, `grant_xp`), mais `lifetime_meters`/`last_activity_at`, o bloco `extras.engagement` (E7 §8) e os campos `raid`/`league`/`points` (E3 §5). A missão de volta precisa ser criada **antes** de contar a corrida (`ensure_missions(..., p_exclude => atividade)`).
- `my_engagement()` (E7 §3: nível, título, faixa e o resto num só retorno) — depende das contas do domain; nesta onda as partes saem por `my_missions`, `my_daily_chest`, `my_track`, `xp_history` e `profiles`.
- Pintura (E3 §3): `zone_cells`, `paint_marks`, colunas novas em `zones`, `zone_paint_near`, `job_fade_cells` e a virada v1 → v2.
- Feed e aplausos, recordes e parciais, LGPD v2 (`account_export_v2` com as 25 tabelas novas; a exclusão já é coberta pelo `on delete cascade`) e seed v2 de demonstração.
- Teste Deno de paridade das constantes (E7 §9, E3 §6): esta branch não tem `raid.ts`, `league.ts`, `progression.ts` nem `missions.ts` (estão na principal); os valores de paridade do `raid_seeded_unit` foram tirados do domain da principal e fixados no pgTAP 17.
- Medalha da temporada para quem nunca abre a trilha: hoje sai ao abrir `my_track`/resgatar; o `job_season_rollover` pode dar a medalha automaticamente.
- Título "Caçador do <chefão>" é permanente (E3 diz "por 1 semana"); emblema da crew com mais dano no chefão ainda não existe.

**Pedidos:**
- **E7:** confirmar os ids de cosméticos (`cosmetic_defs`, 34 itens, por exemplo `moldura-primeira-semana`, `rastro-temporada`) e os degraus da trilha (`track_rewards`) contra o catálogo do domain; confirmar as 7 chaves novas de `notification_prefs` (`raid`, `league`, `streak`…).
- **E3 / E4:** o rodízio fixo de `raidBossForWeek` põe a **Fuligem** na semana de 02/11 e pode cair em agosto/setembro (queimadas), o que contraria o pedido da E4 (§4: não agendar a Fuligem nesses meses). O servidor segue o domain; se mudar, muda nos dois.
- **E3:** o contrato pede `final_blow_user` em `raids`; aqui ficou em `raid_hits.final_blow` para `raids` continuar sem dado pessoal no Realtime.
- **E10:** pôr `npm run db:test:local` na CI (não precisa de Docker) e acrescentar casos adversariais da v2 em `supabase/tests/security/` (golpe repetido, missão resgatada duas vezes, baú aberto duas vezes).
- **E6/E8:** ler `server_info()` e tratar `PGRST202` e `FEATURE_DISABLED` como indisponível; chamar `record_share` depois do share sheet e `record_ranking_opened` ao abrir o ranking.

## 7. Riscos

- **Linha quente do raid:** cada golpe trava a linha de `raids` (aceitável no TCC; o plano B é somar `raid_hits` no job).
- **Postgres 16 × 17:** o banco local usa 16 e o `config.toml` usa 17; nada nas migrations depende da diferença, mas a validação final é a do Supabase CLI.
- **Shim, não o Supabase:** sem PostgREST, Realtime e GoTrue; `check_request`, a RLS no canal do Realtime e o upload de avatar continuam no e2e com Docker.
- **A-1** (senhas públicas de demonstração no Cloud) segue como pendência do dono; nada desta onda cria conta ou senha.
