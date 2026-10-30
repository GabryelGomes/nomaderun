# E3 · Onda 2 — Game design e território (T7.2.3)

> Equipe E3 · Fase 7, F3 onda 2 · 23/10/2026
> Branch `worktree-agent-a4f23948ff610126d`, base `89144d8`.

## 1. Resumo

| Tarefa | Entrega | Estado |
|---|---|---|
| D-84 | `raidBossForWeek` pula a Fuligem nas semanas que começam em agosto ou setembro (entra o Mormaço) | ✅ |
| Simulação como regressão | motor com a regra real (`applyPaint`) + `territory-sim.test.ts` no Jest/CI; a regra C da simulação da F1 agora é a real | ✅ |
| Repositórios | `raid-repo.ts`, `league-repo.ts`, `paint-repo.ts`, com "indisponível" sem erro e pares na demonstração | ✅ |
| "Metros para conquistar" | `paintZoneGap` (v2) e `influenceGapV1` (v1, pedido da E6) | ✅ |

Nenhuma função v1 mudou de comportamento. `applyPaint` ficou mais leve por dentro (mesmo resultado, provado por propriedade).

## 2. D-84 no domain (para o teste de paridade da E9)

- **Nome mantido: `raidBossForWeek(startsAt)`** em `src/domain/raid.ts` (o import do `parity.test.ts` não muda).
- Regra: se a semana começa (segunda-feira, Brasília) em agosto ou setembro e o rodízio cairia na Fuligem, entra o próximo do rodízio (Mormaço). Nenhuma outra semana muda.
- Novos (aditivos): `RAID_FULIGEM_OFF_MONTHS = [8, 9]`, `raidRotationBossForWeek` (rodízio puro, sem a D-84) e `raidWeekMonth` (mês da segunda-feira da semana).
- Ajuste de borda: a semana passa a valer de segunda 00:00 a domingo 23:59 (Brasília), igual ao `week_start` do SQL. Antes, um instante entre segunda 00:00 e 06:00 caía na semana anterior. Ninguém chamava a função com esse instante.
- **Paridade conferida** com a porta da regra do SQL do `parity.test.ts` da E9 (lido da branch principal, sem commit): 624 semanas, 21 delas da D-84, **0 divergências**.
- Exemplos de 2027: 09/08 e 13/09 → Mormaço (seria Fuligem); 16/08 → Mormaço (rodízio normal). Por isso **o Mormaço aparece 2 semanas seguidas** nessas datas: é consequência da D-84 ("nenhuma outra semana muda").

## 3. Simulação como teste de regressão

### 3.1 O que mudou
- **Motor `PaintSim`** (`apps/mobile/src/domain/__tests__/sim/paint-sim.ts`). Usa a regra real, na ordem do servidor:
  - `applyPaint` com o mundo que o servidor carrega (todos os trechos das zonas tocadas);
  - 1 camada por corredor, trecho e dia;
  - `fadeCells` + `refreshZoneOwner` às 03:00;
  - `seasonResetPaint` na virada.
- **Simulação enxuta** (`__tests__/sim/territorio-sim.ts`):
  - bairro sintético, corredores, agenda e métricas;
  - **sondas do novato**: a cada 4 dias medidos, 40 primeiras corridas hipotéticas de novatos iniciantes, aplicadas sem gravar (`applyPaint` não muda o mundo). São 560 amostras por semente, em vez de ~7 novatos num bairro de 91 zonas, que davam ruído de ±15 pontos.
- **Teste `src/domain/__tests__/territory-sim.test.ts`:**
  - 91 zonas, sementes 1, 2 e 3, ~3.500 corridas e 1.680 sondas;
  - **~12 s** no Jest normal; ~35 s na rodada com cobertura da CI;
  - as falhas mostram os números de cada semente.
- **Simulação da F1:** `regras.ts` ganhou `RegraPinturaReal` (C = `applyPaint`). A regra própria da F1 virou "C-F1", e as variantes C+p, C0, D e D+az continuam como registro.
  - `regressao.ts` é a versão completa;
  - `rapido.md` foi gerado de novo, e C ≈ C-F1.

### 3.2 Números (regra real; `resultados/regressao.md`, 3 sementes)

| Cenário | Novato na 1ª corrida | … nos 1ºs 1 km | Eternas | Custo para tomar | Giro/semana |
|---|---:|---:|---:|---:|---:|
| **Teste do Jest (91 zonas), equilibrados** | **60%** (alvo ≥ 50%) | 29% | **10%** (alvo ≤ 15%) | **0,77 km** (alvo ≤ 1,5) | 32% |
| Bairro da F1 (271 zonas), equilibrados | 62% | 32% | 11% | 0,80 km | 33% |
| Bairro da F1, desequilibrados (45/30/15/10%) | **47%** | 24% | **24%** | 0,95 km | 24% |

Os números da regra real batem com os da F1 para a regra C (62%, 11%, 0,8 km): a decisão D-62 continua de pé com o código de verdade.

## 4. Repositórios do app (API)

Todos devolvem `Result<… | Unavailable>`, com `Unavailable = { available: false; reason: 'servidor-antigo' | 'desligada' }`:
- `PGRST202` ou `42883` → `'servidor-antigo'`;
- `FEATURE_DISABLED` → `'desligada'`;
- rede e outros erros continuam `ok: false`.

Os tipos de cada repositório ficam no próprio arquivo (`types.ts` não mudou).

| Arquivo | Função | Retorno (disponível) |
|---|---|---|
| `raid-repo.ts` | `fetchRaidCurrent()` → `rpc('raid_current')` | `RaidCurrent`:<br>• `raid: RaidBoss \| null` (id, bossId, nome, tema, fraqueza, falas, artKey, `weekStart`, `startsAt`/`endsAt`, `hp`/`hpMax`, `phase`, `status`, participantes, `defeatedAt`, `isDemo`, `weakPoints[{zoneId, name, center}]`);<br>• `me` (dano, metros, golpes, metros de hoje, posição, recompensas);<br>• **`share`** ("Sua parte", `raidShare`);<br>• `sinceLastVisit`, `topRunners`, `topCrews`, `params` |
| `league-repo.ts` | `fetchLeagueCurrent()` → `rpc('league_current')` | `LeagueCurrent`: `weekStart`, `closesAt`, `division`/`divisionName`, `joined`, `groupSize`, `smallGroup`, `promoteSlots`/`relegateSlots`, `members[{position, username, faction, avatarUrl, points, you, zone}]`, **`me`**, `lastResult` |
| `paint-repo.ts` | `fetchPaintNear(center, radiusM = 1500)` → `rpc('zone_paint_near', { p_lat, p_lng, p_radius_m })` (raio de 100 m a 3 km; posição inválida falha antes de chamar) | `PaintNear`: `snapshot: LiveSnapshot` (pronto para `createLiveTracker`), `paintedToday: string[]`, `center`, `radiusM` |

**Auxiliares exportados:**
- `callFeatureRpc` e `unavailableReason` (`raid-repo.ts`, reaproveitados pelos outros dois);
- `isRaidAvailable`;
- os parsers `parseRaidCurrent`, `parseLeagueCurrent` e `parsePaintNear`, tolerantes a camelCase e snake_case.

**Pares na demonstração** (`services/api/demo/game-v2.ts`, com 1 linha de spread no índice de `rpc.ts`). Todos usam as regras do domain:
- **`raid_current`:**
  - chefão do rodízio real (com a D-84) e vida por `raidHpFor` de uma cidade fictícia;
  - dano da cidade que cresce na semana: o chefão cai no domingo à noite;
  - "Sua parte" calculada por `raidDamage` sobre as corridas pontuadas do próprio corredor (tetos inclusos);
  - fases e pontos fracos (`raidWeakPoints`), "desde a sua última visita", ranking de 10 corredores `*.demo`, crews;
  - recompensas depois do fim; `isDemo: true`.
- **`league_current`:**
  - grupo de **30** (o corredor + os `*.demo` do mundo + quem falta, também `.demo`);
  - pontos = ranking semanal da demonstração;
  - subida e descida por `leagueStandingsV2`, divisão Rua com o resultado "subiu" da semana anterior;
  - conta nova: `joined: false`.
- **`zone_paint_near`:**
  - trechos sintéticos coerentes com o dono e a influência: o dono lidera com ≥ 3, e zona neutra fica sem líder;
  - nenhum trecho dentro de zonas de privacidade; "sob ataque" com a janela de 24 h.

## 5. "Faltam X m" (pedido da E6)

| Função | Regra | Uso no HUD |
|---|---|---|
| `paintZoneGap(counts, faction, owner, { underAttack?, retaken?, blocked? })` → `{ goal, cells, meters, retakes }` | v2 (`paint.ts`) | `goal`: `conquistar` (= `conquestGap`), `defender` (trechos novos até o rival cair abaixo de 50%, ou `retakes` trechos virados de volta), `manter` ou `bloqueada`. Use com `summary().current.counts` do tracker |
| `influenceGapV1({ zone, faction, now, paceSecPerKm, basePaceSecPerKm, bonus?, earnedTodayInZone?, runMetersInZone? })` → `{ goal, points, meters, reachableToday }` | v1 (`territory.ts`) | Troca o `metros × 0,1` do `run-screen.tsx:256`. Considera esforço, escudo, janela de defesa (2×), teto de 300 por zona e dia e o desempate da v1. `reachableToday: false` = "só amanhã" |

Propriedades:
- correr os metros indicados conquista ou defende na regra oficial (`scoreZone` + `applyRunPoints`), e 30 m a menos não;
- na v2, pintar `cells` basta e 1 a menos não basta (conquistar e defender).

## 6. Testes (números)

| Verificação | Antes (`89144d8`) | Depois |
|---|---|---|
| Jest `src/domain` | 19 suítes, 308 testes | **21 suítes, 327 testes** |
| Cobertura do domain (stmts / branches / funcs / lines) | — | **99,94 / 98,63 / 100 / 100** (limite 90) |
| Jest do app (`npx jest --maxWorkers=2`) | — | **84 suítes passando, 4 puladas (já eram); 1.020 testes passando, 26 pulados** |
| `npm run typecheck` / `eslint src` | ok | ok / 0 problemas |
| Deno `supabase/functions/tests` | 58/0/1 | **58 ok, 0 falhas, 1 ignorado** |
| `deno check` (8 functions + `gen-seed.ts`) | ok | ok |
| Contrato da demonstração | verde | verde (3 RPCs novas com par) |

Testes novos:
- `raid.test.ts`: +4 (D-84, borda da semana e propriedade em 380 semanas);
- `zone-gap.test.ts`: 9;
- `territory-sim.test.ts`: 5;
- `paint.test.ts`: +1 (placar incremental = recontagem);
- `game-v2-repos.test.ts`: 15 (demonstração, indisponível e parsers).

## 7. Decisões técnicas tomadas aqui (para o coordenador registrar)

1. **D-84 por substituição:** na semana da Fuligem em agosto/setembro entra o Mormaço, e as outras não mudam. Consequência: o Mormaço aparece 2 semanas seguidas.
2. **Semana do rodízio pela segunda-feira 00:00 de Brasília**, igual ao `week_start` do servidor.
3. **Métrica do novato por sondas** (1ª corrida hipotética aplicada sem gravar) no teste de regressão. A métrica por agentes continua no relatório.
4. **"Indisponível" é resposta, não erro:** `{ available: false, reason }`.
5. **Parâmetros de `zone_paint_near`:** `p_lat`, `p_lng`, `p_radius_m` (padrão `p_` da E9). Resposta em camelCase: `{ cells, zones: [{ zoneId, owner, name, inherited, blocked, underAttack }], paintedToday }`.
6. **Teste de desempenho do `live-events` por tempo de CPU** (`process.cpuUsage`). O limite continua 200 ms. Na rodada com cobertura, a simulação em outro worker deixava a medida de parede instável (falhou 1 vez em 3 com 244 ms).

## 8. Pendências, pedidos e riscos

| Para | Pedido |
|---|---|
| **E9** | **`zone_paint_near`** ainda não está no `API_CONTRATO.md`:<br>• publicar com os parâmetros e a resposta do item 7.5;<br>• incluir `paintedToday` (trechos do próprio usuário hoje, de `paint_marks`);<br>• sem autor, sem hora e sem trechos em zonas de privacidade;<br>• se o nome ou a forma mudar, eu ajusto o `paint-repo.ts` e o par.<br>Se a RPC tiver flag, responder `FEATURE_DISABLED` com a regra v1 |
| **E9** | O `parity.test.ts` já pode exigir a D-84 do domain (o nome é o mesmo) |
| **E6** | Repositórios prontos para a Arena (Raid e Liga) e para o HUD (`fetchPaintNear` → `createLiveTracker`):<br>• "faltam X m" com `paintZoneGap` (v2) ou `influenceGapV1` (v1, pela `territoryRule` do `server_info`);<br>• tratar `available: false` como estado ilustrado, não erro |
| **E10** | `territory-sim.test.ts` leva ~12 s (~35 s com cobertura). Se a CI ficar lenta, dá para rodá-lo num passo próprio; ele não tem asserção de tempo |
| **Coordenador** | Registrar as decisões da seção 7 |

**Riscos:**
- **Times desequilibrados** (45/30/15/10%): novato na 1ª corrida 47% e eternas 24%, fora dos alvos. A F1 já mostrava isso (45%). O teste de regressão só cobre times equilibrados. Se os times reais ficarem desequilibrados, avaliar um bônus de azarão (a variante D+az da F1) numa onda futura.
- O par `zone_paint_near` da demonstração sintetiza trechos a partir da influência v1, porque a demonstração ainda grava território v1. Por isso o retrato pode divergir do resultado oficial da demonstração, que é marcado `provisional`.
- Conflito esperado no merge: só a linha `...DEMO_GAME_V2_RPC_HANDLERS` no índice de `demo/rpc.ts`.
