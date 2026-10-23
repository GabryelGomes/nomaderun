# E7 — Onda 2: engajamento no app (T7.2.4)

> Branch `worktree-agent-a45a8260e40358ab5` (worktree `.claude/worktrees/agent-a45a8260e40358ab5`), base `89144d8`. 23/10/2026.
> Contrato: `docs/API_CONTRATO.md` ("Contrato v2" e "Contrato v2 — onda 2" da E9) e `E7-contrato-v2.md`. Domain da onda 1 sem nenhuma mudança.

## 1. O que foi feito

| Parte | Arquivos | Resumo |
|---|---|---|
| Repositório | `src/services/api/engagement-repo.ts` | `fetchMissions`, `rerollMission`, `claimMission`, `fetchDailyChest`, `openDailyChests`, `fetchTrack`, `claimTrackStep`, `startHealthPause`, `endHealthPause`, `fetchEngagementStatus` (`my_engagement` + `user_cosmetics`; sem a RPC, plano B pelo perfil v1), `parseRunEngagement` (bloco `extras.engagement`). Tipos no próprio arquivo. `PGRST202`/`PGRST205`/`FEATURE_DISABLED` → `{ available: false }` (não é erro) |
| Demonstração | `src/services/api/demo/engagement.ts` (novo) + 1 linha em `rpc.ts`, 1 em `functions.ts`, 2 em `db.ts` | As 10 RPCs, a tabela `user_cosmetics` e o `extras.engagement` do `finish-activity`, tudo calculado pelo domain. O histórico semeado é **reproduzido corrida por corrida** na 1ª chamada: missões, baús guardados, garantia do lendário, trilha e primeira semana ficam coerentes. Formatos iguais aos da E9 (onda 2): `response.xp` = só o XP da atividade, `extras.contract = 2` |
| Store | `src/store/engagement-store.ts` | 4 partes (`status`, `missions`, `chest`, `track`), cada uma `idle/loading/ready/unavailable/error`; recarregar não pisca o esqueleto; troca de conta limpa |
| Controlador e hooks | `src/features/engagement/{controller,hooks}.ts` | `refreshEngagement`, `rerollDailyMission`, `openStoredChests`, `claimSeasonStep`, `startPause`, `endPause`, `recordRunResult`; `useEngagementData`, `useTodayStrip`, `useRunRewards`, `useWelcomeBack` |
| Modelos puros | `model.ts`, `today.ts`, `run-rewards-model.ts`, `welcome-back.ts`, `cosmetics.ts` | textos (D-74), chances visíveis, primeira semana, ordem pico-fim, faixa de hoje, cartões de volta, catálogo de cosméticos e "como ganhar" |
| Telas | `src/app/missoes.tsx` → `missions-screen.tsx`; `src/app/recompensas.tsx` → `rewards-screen.tsx` | ver §3 |
| Folhas | `health-pause-sheet.tsx`, `welcome-back-sheet.tsx` | Pausa de saúde (1–4 semanas, iniciar/encerrar) e "Bem-vindo de volta" (+ `WelcomeBackGate`) |
| Bloco do resumo | `run-rewards-block.tsx` | `RunRewardsBlock` (XP linha a linha, nível, missões, baús, semana) |
| Lembretes | `src/features/notifications/{reminders,reminder-state,use-reminder-planner}.ts`, `reminder-settings.tsx` | agendador `expo-notifications` sobre `planReminders`; `useReminderPlanner()`; `ReminderSettings`/`ReminderSettingsSection`. Em `controller.ts`: invasão/conquista entre 22h e 7h ficam só na central (`gameAlertMode`, D-69) |
| Preferências | bloco `NotificationPrefs` de `src/services/api/types.ts` | 7 chaves novas **opcionais** (`chests`, `streak`, `league`, `raid`, `season`, `recap`, `comeback`; ausente = ligada, como o `notify_pref` da E9). O mapeamento do bloco (`PREF_DB_KEYS` e a linha de prefs do `toProfile`) acompanhou; as 4 da v1 e os testes antigos não mudaram |

## 2. Antes × depois

| | Antes | Depois |
|---|---|---|
| Missões, baú do dia, trilha | só no servidor (onda 1), sem tela | `/missoes` e `/recompensas` com dados reais ou de demonstração |
| Resumo | XP num número só | bloco com cada linha de XP, nível, baús (com as chances) e missões, terminando numa frase boa e verdadeira |
| Mapa | sem dados de engajamento | `useTodayStrip()`: até 3 chips só verdadeiros + cartão da primeira semana/volta |
| Lembretes | só alerta com o app aberto | locais, replanejados a cada abertura, sincronização e corrida, com os limites da D-69 |
| Volta e pausa | inexistentes no app | "Bem-vindo de volta" (14+ dias) e pausa de saúde |

## 3. Telas (modo demonstração, 390 px, "Reduzir movimento", relógio 23/10 09:00)

Capturas em `docs/melhoria/relatorios/E7-onda2/` (pngquant 85–98, 304 KB no total, 0 erros de página):

| Captura | O que mostra |
|---|---|
| `missoes__cheio__390.png` | Primeira semana (passo 1 feito, 2 aberto, 3–7 trancados com "Depois do passo N"), 3 de hoje com anéis e "Trocar", 3 da semana (2 concluídas) |
| `missoes__vazio__390.png` | Conta nova: passo 1 aberto, tudo em 0% |
| `recompensas__cheio__390.png` | Nível 6 "Pé na Rua", faixa Prata, sequência; 2 baús guardados (1 + bônus raro) com a **tabela de chances** (70/25/5%, XP e chance de item) e "Lendário garantido em até 16 baús"; trilha aberta no degrau atual com "Resgatar"; cosméticos por tipo, cada um com "como ganhar"; "Nada aqui é vendido." |
| `recompensas__pausa__390.png` | Folha da pausa de saúde (1–4 semanas, 1 por temporada) |
| `recompensas__vazio__390.png` | Nível 1, 1 baú guardado, trilha no degrau 0 |

Como gerar: `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <tmp>` (com `TMPDIR` próprio, risco R1 da E5), servir com `e2e-web/serve.cjs` e Playwright (`NODE_PATH=/opt/node22/lib/node_modules`).

**Texto (D-74):** títulos ≤ 30 e frases ≤ 90 (conferido em teste para os textos gerados). As duas telas são listas de detalhe, não telas de jogo: 207 palavras em `/missoes` (30 por missão em média) e 435 em `/recompensas` (a maior parte é o catálogo de 31 cosméticos). Se a E6 quiser reduzir, o catálogo pode virar "Ver todos".

## 4. Testes

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | 0 erros |
| `./node_modules/.bin/eslint src` | 0 erros, 0 avisos |
| `npx jest --maxWorkers=2` | **87 suítes passaram (4 puladas, já existentes); 1.043 passaram, 26 pulados** (base: 986). **57 testes novos** em 6 suítes |
| `reduced-motion.test.ts`, `testids.test.ts`, `demo-contract.test.ts` | verdes |

Suítes novas: `services/api/__tests__/engagement-repo.test.ts` (13: indisponível ≠ erro, leitura tolerante, demonstração cheia e vazia, troca 1/dia, baú travado sem 1 km, trilha idempotente, pausa), `features/engagement/__tests__/engagement-model.test.ts` (20, com propriedade do pico-fim: XP primeiro, semana no fim, pico logo antes, sem repetição; frases sem culpa nem perda), `run-extras.test.ts` (1: corrida real pela fila e sync assinado no modo demonstração → `extras.engagement`, baús abertos, missões andando, XP coerente, idempotente, sem rede), `engagement-ui.test.tsx` (11), `features/notifications/__tests__/reminders.test.ts` (10: só `eng:*` trocados, ≤ 1 por dia, 8h–21h, nada no dia em que correu, tipo desligado nunca aparece, sem permissão/sem sessão nada agendado, pausa de 7 dias, fadiga), `reminder-settings.test.tsx` (2).

**Testes de outras equipes ajustados (sem apagar nem pular):** `src/__tests__/demo-contract.test.ts` (autoteste) e `src/services/api/demo/__tests__/postgrest.test.ts` usavam `claim_mission` como exemplo de RPC **sem par**; agora ela tem par, então o exemplo virou `exemplo_sem_par` (mesma intenção).

## 5. O que a E6 encaixa

```tsx
// _layout raiz (E6a), uma vez:
import { useReminderPlanner } from '@/features/notifications/use-reminder-planner';
useReminderPlanner();

// Mapa (E6b): faixa de hoje
import { useTodayStrip } from '@/features/engagement';
const strip = useTodayStrip(); // { items: DailyItem[], coach, featured, streak, chest, loading }
<DailyStrip items={strip.items} />
{strip.coach ? <MissionCoachCard {...strip.coach} /> : null} // testID, eyebrow, title, done, steps, reward, demo, onPress

// Resumo (E6b): bloco Recompensas (não desenha nada com o servidor v1)
import { RunRewardsBlock, useRunRewards } from '@/features/engagement';
const block = useRunRewards(official);           // o OfficialResult como veio do servidor
<RunRewardsBlock block={block} demo={isDemoMode()} testID="resumo-recompensas" />

// Volta (E6): pronto para montar no Mapa, ou o hook + a folha
import { WelcomeBackGate, useWelcomeBack, WelcomeBackSheet } from '@/features/engagement';
<WelcomeBackGate />  // aparece sozinho com 14+ dias sem atividade, 1 vez por ausência

// Conta (E6): pausa e lembretes
import { HealthPauseSheet } from '@/features/engagement';
<HealthPauseSheet visible={open} onClose={() => setOpen(false)} />
import { ReminderSettingsSection } from '@/features/notifications/reminder-settings';
<ReminderSettingsSection />  // ou ReminderSettings (prefs, device, onChangePrefs, onChangeDevice, now)
```
Atalhos para as rotas: `router.push('/missoes')`, `router.push('/recompensas')` (Arena, Você, chips do Mapa).

## 6. Decisões de detalhe (para o coordenador registrar ou vetar)

1. **Silêncio e "pausar por 7 dias" ficam no aparelho**, não no `notification_prefs`: os lembretes são locais (D-69), e o bloco `NotificationPrefs` precisava continuar só com booleanos para a tela de edição de perfil da E6 compilar.
2. **Chaves novas de preferência opcionais**: ausente = ligada, como no servidor. Assim, salvar o perfil não apaga as chaves que a pessoa nunca mexeu, e os testes antigos de `toProfile`/`toProfileRow` continuam iguais.
3. **"Abrir baús" só aparece com atividade hoje**: no servidor v2 o finish já abre os baús; sem atividade, o botão só renderia uma recusa.
4. **Cosméticos pelo `user_cosmetics`** (RLS: só as próprias linhas), porque o `my_engagement` da E9 não os traz.
5. **Semana, última atividade e horário habitual** (para os lembretes e o "bem-vindo de volta") saem das corridas (`activities`), porque o `my_engagement` não os traz.
6. **Fadiga dos lembretes**: um lembrete conta como entregue quando passa do horário; o toque (resposta da notificação) marca como aberto.

## 7. Pendências, pedidos e riscos

**Pedidos**
- **E6a:** montar `useReminderPlanner()` no `_layout` raiz e pedir a permissão de notificação depois da 1ª conquista (D-72). Sem permissão, o planejador só registra o plano e não agenda nada.
- **E6b:** encaixar `RunRewardsBlock` no resumo (depois do `CelebrationSequence`) e a faixa de hoje no Mapa. A celebração grande (`ChestOpening`, `LevelUp`, `StreakFlame`) fica com o orquestrador; o bloco é a parte calma.
- **E6:** `ReminderSettingsSection` e `HealthPauseSheet` na tela de conta; `WelcomeBackGate` no Mapa; o editor de perfil pode trocar os 4 interruptores dele pelo componente (ele cobre também os 7 novos).
- **E9:** (a) `my_engagement` poderia trazer `pauseAvailable` (hoje a folha só descobre "já usou nesta temporada" pela recusa `PAUSE_USED`); (b) confirmar que `notify_pref` lê `chests`/`streak`/`recap`/`season`/`comeback` com esses nomes.
- **E10:** o `demo-contract` e o `postgrest` ganharam o exemplo `exemplo_sem_par` (§4); se o teste de contrato for reescrito nesta onda, manter o exemplo fora dos pares reais. O teste estático "só transform e opacidade" deve passar: as telas só usam as primitivas da E5.
- **E5 (adaptador `LiveEvent`/resumo):** o bloco `extras.engagement` já tem `level.titleAfter`, `dailyChests.opened[].rarity` e `streak.weekKept` para alimentar `LevelUp`, `ChestOpening` e `StreakFlame`.

**Riscos**
- **Notificação local no Expo Go:** confirmar `scheduleNotificationAsync` com gatilho de data no Expo Go SDK 57 (Android e iOS). O código cai em silêncio se o módulo faltar.
- **Paridade demonstração × servidor:** o sorteio de missões da demonstração usa `drawMissions` (domain); o servidor usa `md5` no SQL (E9 onda 1). Os ids e os níveis batem; as missões sorteadas podem ser outras.
- **Volume de texto** de `/recompensas` (§3).
- **Trilha da demonstração** chega ao degrau 22 de 24 no perfil cheio (6 corridas + missões + baús de 16 dias): é o resultado das regras, mas mostra quase tudo resgatado.
