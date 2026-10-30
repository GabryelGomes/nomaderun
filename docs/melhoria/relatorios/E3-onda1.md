# E3 · Onda 1 — Game design e território (T7.1.1 a T7.1.5)

> Equipe E3 · Fase 7, F3 onda 1 (fundação) · 23/10/2026
> Branch `worktree-agent-a1f0e5fbe9bcb26d5`, base `d7747d8`.
> Contrato para a E9: [`E3-contrato-v2.md`](E3-contrato-v2.md).

## 1. Resumo

| Tarefa | Entrega | Estado |
|---|---|---|
| T7.1.1 | `paint.ts`: regra v2 "Pintura de ruas" (D-62) | ✅ |
| T7.1.2 | `live-events.ts`: previsão incremental e 9 eventos com nível de celebração | ✅ |
| T7.1.3 | `raid.ts` (D-67) e `league.ts` (D-68) | ✅ |
| T7.1.4 | Correções E-03, E-06, E-07, E-08, E-11, E-12, D-63, Fuga pelo ritmo-base e Atlas por bairro, cada uma com teste de regressão | ✅ |
| T7.1.5 | Contrato para a E9 (`E3-contrato-v2.md`) | ✅ |

**Nenhuma função que a v1 do servidor usa mudou de comportamento.** As correções são funções novas (`…V2`); as antigas ganharam `@deprecated`. A única mudança no lugar foi interna e de resultado idêntico: `validPath` do `finishRun` em O(n) (E-11), com teste de equivalência contra a versão O(n²).

## 2. O que foi feito

### 2.1 `paint.ts` (T7.1.1)
- Trecho = H3 res 11, 1 a 3 camadas. Passar pinta (vazio), reforça (seu, até 3, relógio reinicia), enfraquece (rival com 2–3) ou vira (rival com 1 → seu com 1).
- **Desbotar idempotente:** a camada atual sai de `layers` e `paintedAt` (`effectiveLayers`), então o job pode rodar a qualquer hora, mais de uma vez, sem tirar camada a mais (`fadeCell(fadeCell(c, t), t) = fadeCell(c, t)`, testado como propriedade).
- **Dono por maioria com mínimo 3** (`zoneOwnerByCells`): empate mantém o dono; empate sem dono → neutra. Simétrico (não depende da ordem dos times).
- **Herança** (`inheritZonesV1`): 3 trechos virtuais do dono por 7 dias; some se a zona trocar de dono.
- **Ataque v2** (substitui a E-03 na regra nova): rival com ≥ 50% dos trechos do dono ou ≥ 3 trechos virados; expira 24 h depois da última virada. **Defesa:** o dono vira de volta ≥ 3 trechos ou tira a pressão.
- **Reforço na conquista:** `options.reinforceOnConquest`, desligado por padrão (`PAINT_DEFAULTS`).
- **Só passos válidos pintam** (`paintCellsOfRun` usa os `steps` válidos de `validateActivity`); interpolação só entre pontos a ≤ 100 m.
- **1 camada por corredor por trecho por dia** via `paintedToday`.
- Eventos com os mesmos tipos de `territory.ts` (`captured`, `under_attack`, `defended`, `neutralized`): as notificações do servidor não mudam.

### 2.2 `live-events.ts` (T7.1.2)
- `createLiveTracker({ runId, faction, snapshot, paintedToday?, firstConquestEver? })` → `push(ponto)` devolve eventos; `summary()` dá o HUD.
- Eventos: `trecho_pintado`, `trecho_virado`, `trecho_enfraquecido`, `zona_entrou`, `zona_rival_entrou`, `zona_progresso` (25/50/75%), `faltam_metros`, `zona_conquistada`, `zona_defendida`. Cada um com `runId`, `t`, `atMeters` e `level` (`micro`/`pequena`/`media`/`epica`; tabela `LIVE_EVENT_LEVEL`). A 1ª conquista da vida é épica.
- "Faltam N trechos (≈ X m)" é **honesto**: conta só trechos novos; virar trecho rival pode adiantar, nunca atrasar.
- A zona atual é a do ponto (não de cada amostra), para não piscar na divisa.
- A previsão usa a mesma `paintTransition` e o mesmo `zoneOwnerByCells` do servidor (teste de propriedade "previsão = oficial").

### 2.3 `raid.ts` e `league.ts` (T7.1.3)
- **Raid:** janela seg 06:00 → dom 21:00; vida `max(500, 0,75 × mediana × 10 × fator)`; fator 0,7–1,5; fases 1/2/3 que só avançam; dano 10/km, ponto fraco ×2 (fase ≥ 2), crítico 10% determinístico (`raidCritRoll(idDaAtividade)`), grupo ×1,25 (fase 3); tetos de 21 km/corrida, 30 km e 300 de dano/dia; golpe final; pontos fracos por semente; baú pela hora da queda (chances visíveis); "Sua parte" e "desde a sua última visita". Rotação dos chefões `soneca → rei-buzina → fuligem → mormaco → paredao` a partir de 19/10/2026.
- **Liga:** grupos de até 30 por divisão, ordenados por volume, em blocos que diferem no máximo 1; 1 sobe/desce a cada 6 (até 5); **grupo pequeno (< 6): só o 1º sobe, se pontuou, e ninguém desce**; 0 ponto nunca sobe; desempate por quem chegou antes; entrada no meio da semana (`leaguePlaceNewcomer`); fechamento seg 03:20.
- `season.ts` ganhou `weekStartBrt` (aditivo).

### 2.4 Correções (T7.1.4)

| Bug | Correção v2 | Teste de regressão |
|---|---|---|
| E-03 ataque eterno | `isUnderAttackAt`, `attackExpired`, `clearExpiredAttack`; `resolveZoneV2` limpa o vencido e o alerta volta a disparar | `v2-fixes.test.ts` › E-03 (mostra também que a v1 continua igual) |
| E-06 empate a favor dos Striders | `strongestRivalV2` devolve `null` no empate; `resolveZoneV2` não dá a zona no empate | E-06 + propriedade de simetria (200 casos) |
| E-07 zona neutra para quem não correu | `applyRunPointsV2`/`resolveZoneV2(…, actor)`: só quem correu conquista | E-07 + propriedade (200 casos) |
| E-08 temporada sem reavaliar o dono | `seasonResetV2` neutraliza o dono abaixo de 30 na hora | E-08 |
| E-11 `validPath` O(n²) | corrigido no lugar (marcação em `Uint8Array`), resultado idêntico | equivalência com a versão O(n²) (100 trajetos) |
| E-12 cópia do vetor a cada ponto | `appendPoint` (sem copiar; `addPoint` igual) | `appendPoint` ≡ `addPoint` em 200 trajetos |
| D-63 sequência multiplica pontos | `scoreZoneV2`/`scoreRunV2` sem sequência; `finishRunV2` | D-63 |
| E-15 Fuga bônus grátis | `scoreZoneV2` sem fantasma; `GHOST_WIN_XP`; `ghostPaceV2` (3 níveis) e `ghostPaceAllowedV2` (±20%) | Fuga + propriedade "o iniciante a 7:15 vence o Seu ritmo" |
| Atlas por bairro | `districtExploration`, `districtsExploration`, `atlasMilestonesCrossed`, `fogCellsInDistrict` | Atlas |

## 3. Decisões técnicas tomadas aqui (para o coordenador registrar)

1. **Desbotar pelo relógio do trecho** (`paintedAt` + `layers`), não por decremento no job: idempotente e sem depender do horário do cron.
2. **Empate na zona v2:** mantém o dono se ele estiver no empate; senão a zona fica neutra (simétrico).
3. **Ataque v2** com prazo de 24 h desde a última virada do rival, e defesa por "3 trechos de volta" ou "rival abaixo de 50%".
4. **"Faltam N trechos"** conservador (só trechos novos), para nunca prometer menos do que é preciso (ética, E-01).
5. **Raid:** teto diário de dano de 300 aplicado **depois** do crítico (um crítico de 21 km fica em 300); `damage` inteiro (arredondado para baixo).
6. **Fantasma sem histórico:** "Seu ritmo" a 7:30/km (450 s), para o iniciante conseguir vencer; o padrão do ritmo-base (6:00) continua para os pontos.
7. **Liga:** ranking estrito com desempate por `reachedAt` (quem chegou antes); 1 sobe/desce a cada 6.
8. **Nomes com prefixo** (`paint…`, `raid…`, `league…`, `…V2`) porque a ponte usa `export *` e nomes repetidos entre arquivos quebram o `deno check`.

## 4. Testes (números)

| Verificação | Antes (d7747d8) | Depois |
|---|---|---|
| Jest `src/domain` | 9 suítes, 104 testes | **14 suítes, 192 testes**, todos passando |
| Cobertura do domain (stmts / branches / funcs / lines) | 99,55 / 99,6 / 97,67 / 100 | **100 / 99,32 / 100 / 100** (limite 90) |
| Jest do app inteiro (`npx jest --maxWorkers=2`) | — | **55 suítes passando, 4 puladas (já eram); 505 testes passando, 26 pulados** |
| `npm run typecheck` | ok | ok |
| `eslint src` | ok | ok |
| Deno `supabase/functions/tests` | 58 ok, 1 ignorado | **58 ok, 0 falhas, 1 ignorado** (inclui `domain_bridge`) |
| `deno check` das 8 functions | ok | ok (+ `scripts/gen-seed.ts` e `scripts/e2e.ts`) |

**Propriedades (200 casos cada, semente fixa):** 1 dono por zona e sempre o líder com ≥ 3; camadas entre 1 e 3 e passada rival nunca aumenta camada rival; simetria entre times (pintura e `resolveZoneV2`); idempotência (repetir trecho; reaplicar no mesmo dia); desbotar idempotente e componível; só passos válidos pintam (100 trajetos); previsão = oficial (60 trajetos); dano ≥ 0, inteiro e teto diário; vida só cai e fase só avança; só quem correu conquista (E-07); grupos ≤ 30 com tamanhos ±1 e volumes em faixas; ninguém sobe e desce ao mesmo tempo.

**Desempenho:** previsão ao vivo de 15 km a 1 Hz (5.401 pontos, 340 trechos, 666 eventos): **26–37 ms** no Deno; no Jest, o teste (com 3 rodadas e a preparação) passa com folga abaixo de 200 ms por rodada. `appendPoint` + `finishRun` de 15 km: ~120 ms.

## 5. Pendências

- **Simulação como regressão (T7.3.6):** os scripts de `docs/melhoria/F1/jogo/sim/` ainda usam a regra C própria da simulação. Na onda 3, trocar pela `applyPaint` real e transformar os alvos (novato ≥ 50%, eternas ≤ 15%, custo ≤ 1,5 km) em asserção.
- **`finishRunV2`** fica disponível, mas recomendo **não** usá-lo antes da virada (mudaria duas regras de uma vez). A gravação v2 deve chamar `finishRun` v1 + `applyPaint` + `scoreRunV2` + `raidDamage` (contrato, seção 1).
- Rabisco (Fréchet) e Cidade × Cidade por média não entraram nesta onda (não estavam no escopo da T7.1.x).

## 6. Pedidos para outras equipes

| Para | Pedido |
|---|---|
| **E9** | Contrato inteiro (`E3-contrato-v2.md`): `zone_cells`, `paint_marks` (1 camada por corredor por trecho por dia), colunas novas em `zones`, `zone_paint_near` **sem autor, sem hora e sem zonas de privacidade**, `job_fade_cells`, RPC `raid_hit` idempotente, jobs da Raid e da Liga, campos novos opcionais na resposta, `ghostPaceAllowedV2` no `validate.ts` da gravação v2 |
| **E6** | Trocar `addPoint` por `appendPoint` em `use-run-session.ts` (E-12). Atenção: o vetor `run.points` passa a ser o mesmo objeto, então o mapa deve depender de `run.points.length` (ou de uma cópia por segundo), não da identidade do vetor. Usar `isUnderAttackAt(zone, now)` no lugar de `isUnderAttack` (E-04/E-05). HUD com `createLiveTracker` e `summary().current` ("Você 3 × 7 Corujas · faltam 2 trechos ≈ 80 m"). Fuga com `GHOST_LEVELS` e `ghostPaceV2`. Atlas com `districtsExploration` (e sem o corte de 600 células, E-14) |
| **E5** | Mapear `LiveEvent.level` para a escala de celebração; regra de ritmo: no máximo 1 vibração a cada 10 s, exceto conquista; voz só em conquista, 75% e entrada em zona rival |
| **E7** | `GHOST_WIN_XP` (50) e `atlasMilestonesCrossed` para medalhas de bairro; os eventos de `live-events.ts`/`applyPaint` servem de gatilho para missões ("pinte 30 trechos", "retome 1 zona") |
| **E7 e E8** | **Não exportar** nomes que já existem no domain (a ponte usa `export *`): em especial `CelebrationLevel`, `LiveEvent`, `weekStartBrt`, `GHOST_*`, `PAINT_*`, `RAID_*`, `LEAGUE_*`. O coordenador deve rodar `deno check` depois de juntar as três branches |
| **E10** | No servidor de demonstração, o `finish-activity` pode chamar `applyPaint`/`raidDamage` direto do domain; teste e2e que espera `zona_conquistada` numa corrida simulada |

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Colisão de nomes na ponte (`export *`) ao juntar E3, E7 e E8 | prefixos; pedido acima; `deno check` no merge |
| `applyPaint` com `world.cells` incompleto dá placar errado | pré-condição documentada no contrato; o servidor carrega por `zone_id` |
| Retrato ao vivo com dono incoerente (desbotou entre jobs) | o servidor monta o retrato com `refreshZoneOwner`; o resultado oficial vem do servidor (`provisional: true`) |
| `appendPoint` compartilha o vetor | documentado; `addPoint` continua disponível e igual |
