# E7 — Onda 3: engajamento (T7.3.6)

> Branch `worktree-agent-af5b1ff39bd1b8904`, base `092497c` + merge de `claude/affectionate-gauss-e8gm77` (migrations da E9). 28/10/2026.

## 1. Entregas

| Tarefa | Onde | Resumo |
|---|---|---|
| `firstConquestEver` | `store/engagement-store.ts` (`everConquered`, `selectFirstConquestEver`), `features/engagement/hooks.ts` (`useFirstConquestEver`, `getFirstConquestEver`), `controller.ts` (`ensureConquestHistory`), `engagement-repo.ts` (`fetchEverConquered`) | `true` só quando o servidor confirma que a pessoa nunca conquistou (`activity_zones` + `result.zones` das corridas). Sem dado → `false` (o HUD nunca promete "1ª zona" à toa). Depois de uma corrida com conquista, nunca volta a `true` |
| `/recompensas` | `rewards-screen.tsx`, `model.ts` (`trackWindow`) | Nível, baú com as chances, trilha com 4 degraus (até 2 para resgatar + próximos) e "Ver os 24 degraus"; cosméticos resumidos ("N de 31 são seus") atrás de **"Ver todos"**. **102 palavras** no perfil cheio (teste: ≤ 120) |
| Telemetria opt-in (D-82) | `telemetry-model.ts`, `telemetry.ts`, `telemetry-consent.tsx`, `services/api/telemetry-repo.ts`, par `services/api/demo/telemetry.ts` (+2 linhas em `demo/rpc.ts`) | Contrato da E9: `my_telemetry_consent`, `set_telemetry_consent(p_opt_in, p_policy_version=1)`, `track_events`. Desligada por padrão; sem consentimento lido do servidor, `trackTelemetry` descarta na hora. Lista fechada (`app_open`, `run_finish`, `zone_conquer`, `share`, `mission_complete`), props só `count`, `kind`, `missionId`; viaja **só o dia**, nunca a hora. Lote: sai com 10 na fila, no resumo/abertura e no segundo plano; até 20 por envio, 50 na fila; evento com mais de 2 dias não viaja. Desligar esvazia a fila **antes** do servidor; sem rede, fica desligado no aparelho e refaz o aviso na próxima leitura. `TELEMETRY_CONSENT` (desligado em outro aparelho) limpa a fila e relê. `enabled = false` → "ainda não disponível" |
| Folha de consentimento | `TelemetryConsentSheet`, `TelemetrySettingsSection` | O que coleta, o que nunca coleta, 30 dias, como desligar; "Ligar" e "Agora não" com o mesmo peso; ligar só pela folha |
| Primeira semana | `missions-screen.tsx`, `model.ts` (`ftueAction`, `ftueComplete`, `FTUE_PRIZE`), `controller.ts` (`markRankingOpened`), `engagement-repo.ts` (`recordRankingOpened`), `demo/engagement.ts` | Cada passo aberto tem atalho para onde se faz (Correr, Caçar e Fugir já escolhem o modo; Raid/Liga ou as alternativas; Crew; Card). O passo 6 sem liga avisa `record_ranking_opened`. Demonstração: `record_share` e `record_ranking_opened` contam nas missões (o par da E7 vale sobre o da E8, D-85). Os 7 feitos → cartão "Primeira semana completa!" com a moldura **Primeira Semana** (dada pelo servidor no 7º passo). Telas de missões releem ao voltar (dado com mais de 15 s) |
| `kudos` | `services/api/types.ts` (`NotificationPrefs.kudos`, `PREF_DB_KEYS`), `reminder-settings.tsx` | Chave lida pelo servidor; interruptor "Aplausos da crew (1 por dia)" |
| Telemetria dos fatos | `controller.ts` | `app_open` (1/dia) no `refreshEngagement`; `run_finish`, `zone_conquer`, `mission_complete` no `recordRunResult`; `mission_complete` no `markRankingOpened` |

## 2. O que a E6 e a E8 encaixam (nomes exatos)

```ts
// E6b — corrida (use-run-session.ts, na largada):
import { getFirstConquestEver } from '@/features/engagement';
createLiveTracker({ runId, faction, snapshot, firstConquestEver: getFirstConquestEver() });
// em componente: useFirstConquestEver() (carrega o histórico se faltar)

// E6a — Ajustes:
import { TelemetrySettingsSection } from '@/features/engagement';
<TelemetrySettingsSection />           // testID raiz "telemetria"

// E6c — tela do ranking do time, ao montar (1 aviso por dia):
import { markRankingOpened } from '@/features/engagement';
useEffect(() => { void markRankingOpened(); }, []);

// E8 — share-screen, no onShared (depois do recordShare):
import { trackTelemetry } from '@/features/engagement';
trackTelemetry('share', { /* sem props */ });
```

## 3. Testes

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | 0 erros |
| `./node_modules/.bin/eslint src` | 0 erros, 0 avisos |
| `npx jest --silent --maxWorkers=2` | **115 suítes passaram (4 puladas, já existentes); 1.315 passaram, 26 pulados** |

Novos: `features/engagement/__tests__/onda3.test.ts` (14: lista fechada, props filtradas, só o dia no envio, teto da fila, desligada por padrão sem nada no servidor, 1 `app_open` por dia, desligar apaga, `TELEMETRY_CONSENT`, desligar sem rede, flag desligada, fatos da corrida, `firstConquestEver` nas contas nova e cheia, share e ranking concluindo os passos 7 e 6 com a moldura, atalhos, recorte da trilha). `engagement-ui.test.tsx` +4 (≤ 120 palavras, "Ver todos", atalho da primeira semana, cartão do prêmio, folha de consentimento). `demo-contract`, `testids` e `reduced-motion` verdes.

## 4. Pendências

- **Capturas** de `/recompensas` e da folha não foram geradas (pedido de relatório curto); a contagem de palavras está no teste. A E10 mede na onda 4.
- **E8:** `trackTelemetry('share')` no `onShared` (§2).
- **E6c:** `markRankingOpened()` ao montar o ranking (hoje só o atalho da primeira semana avisa).
- **Atalho do passo 7** leva a `/perfil/atividades` (escolher a corrida e compartilhar pelo resumo); ir direto ao `/compartilhar/[id]` da última corrida fica para depois.
- **Ética:** nada de lembrete ou empurrão para ligar a telemetria; o único lugar é Ajustes.
