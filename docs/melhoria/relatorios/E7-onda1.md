# E7 — Onda 1 (fundação): progressão, missões e lembretes

> Tarefas **T7.1.6** (`progression.ts`, `missions.ts`) e **T7.1.7** (`reminders.ts`) do `PLANO-MESTRE.md`.
> Decisões aplicadas: D-63, D-64, D-65, D-66, D-69 (e o glossário da D-74).
> Contrato para a E9: `docs/melhoria/relatorios/E7-contrato-v2.md`.

## 1. O que foi feito

| Arquivo | Conteúdo |
|---|---|
| `apps/mobile/src/domain/progression.ts` (novo) | Curva de XP v2 e fontes em linhas (`runXp`); 8 títulos; 8 faixas por material; sequência semanal v2 (`closeStreakWeek`, congelamento automático, pausa de saúde); baú do dia (crédito até 3, abre com ≥ 1 km, garantia no 20º, chances públicas); trilha da temporada; calendário de Brasília (`brtCalendar`) e gerador com semente (`engagementRng`) |
| `apps/mobile/src/domain/missions.ts` (novo) | Catálogo das 29 missões com os ids da F1; alvos adaptativos; sorteio 3 + 3 por semente com 1 leve; troca de 1 diária por dia; progresso recalculado a partir do resultado oficial; conclusão no máximo 1 vez; primeira semana (7 passos sem prazo); missão de volta |
| `apps/mobile/src/domain/reminders.ts` (novo) | Catálogo das 15 notificações; `reminderText` (≤ 60, singular/plural, zona cortada); `planReminders(estado, preferências, now)` para os próximos 7 dias; `gameAlertMode` (invasão/conquista na central entre 22h e 7h) |
| `apps/mobile/src/domain/__tests__/progression.test.ts`, `missions.test.ts`, `reminders.test.ts` (novos) | 95 testes de exemplo e de propriedade |
| `supabase/functions/_shared/domain.ts`, `supabase/functions/deno.json`, `supabase/scripts/deno.json` | Registro dos 3 arquivos na ponte (linha `export *` e mapeamentos com e sem `@/`) |
| `docs/melhoria/relatorios/E7-contrato-v2.md` (novo) | Tabelas, RPCs, métricas, ledger, jobs e o bloco `extras.engagement`, com o diff exato em relação ao rascunho da E9 |

Nada em `games.ts`, `scoring.ts`, `season.ts` nem nos outros arquivos da E3 foi alterado. `closeWeek`, `xpForLevel` e `levelFromXp` continuam valendo para o servidor v1.

## 2. Antes × depois

| Tema | Antes (v1) | Depois (domain v2) |
|---|---|---|
| Curva | `100·n^1,5`; nível 10 = 139 corridas do iniciante | `arred10(50·n^1,3)+50`; nível 10 = 4.300 XP (13 corridas na simulação da F1); pede ≤ XP que a v1 em **todo** nível |
| XP de distância | 1 por 100 m, sem teto | 10/km até 5 km/dia, 5/km até 15 km, 0 depois; dividir a corrida não rende (telescópico) |
| Neblina/Atlas | 10 XP por célula, sem teto | 2 XP por trecho, teto 60 **por dia** |
| Sequência | gasta congelamento mesmo sem sequência; sem pausa; sem "melhor" | só gasta se há sequência; pausa de saúde 1–4 semanas por temporada; melhor sequência nunca diminui |
| Baú do dia | não existia | crédito até 3, chances 70/25/5 visíveis, garantia no 20º |
| Missões | não existiam | 29 missões, sorteio reproduzível, sempre 1 leve |
| Lembretes | só alertas com o app aberto | planejador local com os limites da D-69 |

## 3. Testes (todos verdes)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | sem erros |
| `./node_modules/.bin/eslint src` | sem erros |
| `npx jest --maxWorkers=2 src/domain` | 12 suítes, **199 testes** (95 novos: progression 38, missions 32, reminders 25) |
| `npx jest --maxWorkers=2` (app inteiro) | 53 suítes passaram (4 puladas, já existentes), **512 passaram**, 26 pulados (já existentes) |
| Cobertura do domain | linhas 100% · instruções 99,78% · ramos 98,64% · funções 99,04%. `progression.ts` 100/100/100/100; `missions.ts` ramos 97,9%; `reminders.ts` ramos 96,7% |
| `deno test … supabase/functions/tests` | **58 passaram**, 0 falhas, 1 ignorado (plano B da ponte) |
| `deno check … supabase/functions/*/index.ts` e `_shared/domain.ts` | sem erros (confirma que nenhum nome exportado colide no `export *`) |

**Propriedades conferidas** (gerador com semente de `__tests__/prop.ts`):
- XP ≥ 0 em toda linha; teto diário de 240 XP da atividade; distância de várias corridas = distância do dia inteiro;
- nível só sobe; ninguém perde nível na troca de curva (`levelProgress(xp) ≥ levelFromXp(xp)`); faixa nunca regride;
- melhor sequência nunca diminui e fica ≥ a atual; congelamentos nunca negativos;
- nunca 20 baús seguidos sem lendário; frequência sorteada a ±2% de 70/25/5;
- sorteio: sempre 1 leve, 1 de cada nível e nunca missão impossível; alvo semanal ≤ +10% da maior semana (acima do piso de 6 km);
- missão conclui no máximo 1 vez, com progresso que só sobe e ≤ alvo, para qualquer sequência de evidências;
- lembretes (400 casos): todo horário entre 8h e 21h de Brasília e fora do silêncio da pessoa; no máximo 1 por dia e 4 em quaisquer 7 dias (1 com fadiga), contando os já entregues; nada no dia em que correu; nada na pausa; preferência desligada nunca aparece; nada depois de 30 dias sem atividade; escada só nos dias 7/14/21/30; textos ≤ 60 e sem culpa;
- textos de missão ≤ 40 com o maior `{x}` possível; nenhum texto com palavra de culpa.

## 4. API pública nova

**`progression.ts`**
- Calendário e sorteio: `brtCalendar.{clock, at, addDays, daysBetween, weekMonday, weekIdOf}`, `engagementRng(seed)`.
- Curva: `xpToNextLevel(n)`, `totalXpForLevel(n)`, `levelProgress(xp)` → `{ level, intoLevel, needed, isMax, title }`.
- Fontes: `XP_RULES_V2`, `DAILY_RUN_XP_CAP`, `dailyDistanceXp(m)`, `runXp(input)` → `{ total, lines, todayAfter }`, `XpSource`, `XP_SOURCE_LABELS`, `EMPTY_XP_DAY`.
- Títulos e faixas: `RUNNER_TITLES`, `titleForLevel`, `unlockedTitles`, `RUNNER_BANDS`, `runnerBand(m)`.
- Sequência: `STREAK_V2`, `NEW_STREAK_V2`, `closeStreakWeek`, `refillStreakFreezes`, `grantExtraFreeze`, `isHealthPaused`, `startHealthPause`, `endHealthPause`, `weekKeptXp`.
- Baú do dia: `DAILY_CHEST`, `dailyChestsStored`, `canOpenDailyChests`, `rollDailyChest`, `openDailyChests`, `dailyChestRolls`, `resolveCosmeticDrop`, `dailyChestOdds`.
- Trilha: `SEASON_TRACK`, `seasonTrackStep`.

**`missions.ts`**: `MISSION_CATALOG`, `MISSION_TEXT_MAX`, `missionById`, `missionXpSource`, `MISSION_TARGETS`, `dailyKmTarget`, `weeklyKmTarget`, `raidKmTarget`, `resolveMissionTarget`, `formatMissionKm`, `missionText`, `drawMissions(ctx, 'diaria' | 'semanal', dia)`, `rerollMission`, `MISSION_REROLLS_PER_DAY`, `missionProgress`, `settleMission`, `FTUE_STEP_IDS`, `FTUE_ENDOWED_PROGRESS`, `ftueSteps`, `ftueBarProgress`, `ftueAssignment`, `comebackMissionId`, `comebackAssignment`; tipos `MissionDef`, `MissionAssignment`, `MissionContext`, `MissionActivity`, `MissionEvidence`.

**`reminders.ts`**: `REMINDER_CATALOG`, `REMINDER_LIMITS`, `REMINDER_TEXT_MAX`, `reminderText`, `shortZoneName`, `GUILT_PATTERN`, `hasGuiltWords`, `usualStartHour`, `planReminders(state, prefs, now)` → `PlannedReminder[]` (`id`, `kind`, `pref`, `key`, `identifier`, `at`, `text`), `gameAlertMode(at, prefs)`; tipos `ReminderState`, `ReminderPrefs`, `ReminderPrefKey`.

## 5. Decisões de detalhe tomadas nesta onda (para o coordenador registrar ou vetar)

1. **Fantasma e Atlas por dia, não por corrida:** +50 do fantasma 1×/dia e teto de 60 do Atlas por dia (a D-64 não dizia). Motivo: "dividir a corrida não rende" e um teto diário verificável.
2. **Congelamento só protege sequência > 0:** a v1 gastava congelamento de quem tinha 0 semanas.
3. **Correr 2× durante a pausa de saúde ainda conta** para a sequência (a pausa só protege; nunca tira).
4. **Troca de missão:** só diárias, 1 por dia (como no RPC da F1). As semanais não trocam.
5. **Lembretes:** com 7+ dias sem atividade, só a escada de volta (os outros tipos param); quem nunca correu não recebe a escada; o aviso do baú respeita 7 dias corridos (não a semana ISO, que permitia domingo + segunda); o silêncio da pessoa só vale quando amplia o padrão (`quietStart` 9–21, `quietEnd` 8–21).
6. **Glossário D-74:** "Revele 5 trechos novos do Atlas" e a alternativa do passo 4 "Revele 10 trechos do Atlas". Os **ids** (`d-neblina-5`, `d-neblina-20`) ficaram iguais, como pedido.
7. **Volta** usa o prêmio fixo do catálogo; `v-30` marca `streakRestart` no `bonus` (a sequência recomeça com 1 semana: regra do servidor).

## 6. Pendências, pedidos e riscos

**Pedidos**
- **E9 (urgente, está criando as tabelas agora):** aplicar a §1 do contrato. Os dois pontos que quebram de cara são o `check` de `mission_defs.id` (o rascunho recusa hífen, e os 29 ids têm hífen) e o baú do dia que **acumula até 3** (o rascunho faz 1 por dia que some). Também: progresso absoluto (não somar deltas) e `xp_ledger.source` ampliado.
- **E3:** `brtCalendar` duplica o cálculo de Brasília de `season.ts` (que não exporta o deslocamento). Se a E3 criar um utilitário de calendário (raid e liga também precisam de semana ISO e de segunda 06:00), unificar na integração. Os nomes da E7 foram escolhidos para não colidir no `export *` da ponte (`brtCalendar`, `engagementRng`, `xpToNextLevel`, `levelProgress`, `closeStreakWeek`…).
- **E3:** o XP da corrida no `run-engine`/servidor v1 continua o antigo; a gravação v2 (E9, T7.2.1) passa a usar `runXp`. Nada muda no v1.
- **E6/E10 (onda 2):** preferências novas (`chests`, `streak`, `league`, `raid`, `season`, `recap`, `comeback`, `quietStart`, `quietEnd`, `snoozeUntil`) entram em `NotificationPrefs` (`services/api/types.ts`); a tela de ajustes precisa dos 7 interruptores e do "Pausar lembretes por 7 dias".
- **E10:** confirmar `scheduleNotificationAsync` com gatilho de data no Expo Go SDK 57 (Android e iOS) antes da T7.2.4.

**Para a onda 2 (E7):** store e hooks; agendador em `features/notifications` que cancela os `identifier` `eng:*` e agenda `planReminders` a cada abertura, sincronização e corrida; telas `/missoes` e `/recompensas`; bloco "Recompensas" do resumo lendo `extras.engagement`; catálogo de cosméticos (ids citados nos títulos e na FTUE: `rastro-faisca`, `moldura-bairro`, `efeito-pulso`, `rastro-cometa`, `moldura-holofote`, `efeito-onda`, `moldura-nomade`, `moldura-primeira-semana`).

**Riscos**
- **Base da worktree:** a worktree nasceu em `a663bee`, anterior a `d7747d8`. Como não havia nenhum trabalho nela, a branch própria foi avançada para `d7747d8` (avanço rápido, sem merge nem rebase) antes do 1º commit.
- **Paridade SQL × domain:** se a E9 reescrever sorteio, alvos ou chances em SQL, os números podem divergir. Mitigação: teste Deno de paridade (§9 do contrato) e, de preferência, cálculo na Edge Function com o próprio domain.
- **Estado velho nas notificações locais:** o planejador prevê o crédito do baú e a escada de volta "se nada mudar"; a verdade depende de replanejar a cada abertura, sincronização e corrida (tarefa da onda 2).
- **Leitura jurídica do baú (ECA Digital):** continua pendente com o orientador (D-66). O código não tem nada pago nem moeda.
