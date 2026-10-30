# E6b — UX/UI: Mapa, Correr e Resumo · Fase 7, F3, onda 2

> Tarefa **T7.2.7**. 2026-10-23. Branch `worktree-agent-abae3fde98bc4cafb`, base `89144d8`.
> Também traz, com a autorização do coordenador, os commits da E10 `9877b7c` (teste "só transform e opacidade") e `8307eb4` (interruptor do modo demonstração), por `cherry-pick`.

## 1. Resumo

| Tela | O que mudou |
|---|---|
| **Mapa** | Faixa de hoje (`DailyStrip`) só com dado verdadeiro, **um** alerta por vez (`AlertSlot` com prioridade), "Desde ontem" (4 s), missão de boas-vindas (`MissionCoachCard`) e `BigRunButton` (Correr a 1 toque). As camadas viraram um menu atrás do botão (−9 palavras na 1ª dobra). |
| **Correr** | GPS é o padrão. A simulação só aparece com `isDemoActive()` (D-76). HUD com `createLiveTracker`: anel de progresso + "Faltam ~X m para conquistar". Avisos `RewardToast` por nível. Rastro na cor neon do time. `appendPoint` + `isUnderAttackAt`. |
| **Resumo** | Sequência cinematográfica: a rota se desenha → 4 números com `CountUp` → conquistas uma a uma num palco com **Pular** (`CelebrationSequence`) → nível → **Compartilhar** (primário). "Concluir" virou link. Permissão de notificação depois da 1ª conquista (`PermissionPrimer`). |
| **Todas** | `GrowBar`/`InfluenceBar`/`GrowPillar` e a barrinha do 3-2-1 só com transform (`ProgressBar` / `scaleX` / `scaleY`); `ActivityIndicator` → `ShimmerSkeleton`; `expo-haptics` direto → `haptic()` nos meus arquivos. |

## 2. Antes → depois (modo demonstração, 390×844)

Export web com `EXPO_PUBLIC_DEMO=1 --clear` e `TMPDIR` próprio, servido por `e2e-web/serve.cjs` e fotografado com Playwright. Mapa e Nova corrida com "Reduzir movimento" (como o `capturas.cjs`); corrida e resumo com movimento completo. Imagens em `E6b-onda2/`, comprimidas com `pngquant` (1,35 MB → 0,43 MB).

| Tela | Antes | Depois | Palavras visíveis (antes → depois) |
|---|---|---|---|
| Mapa | `antes-mapa.png` | `depois-mapa.png` | 33 → **25** |
| Mapa sob ataque | `antes-mapa-sob-ataque.png` | `depois-mapa-sob-ataque.png` | 33 → **25** |
| Nova corrida | `antes-corrida-preparacao.png` | `depois-corrida-preparacao.png` | 65 → **49** |
| Corrida ativa | `antes-corrida-ativa.png`, `-2` | `depois-corrida-ativa.png`, `-2` | 27 → 25 (o 2º quadro mostra o aviso "Zona conquistada") |
| Resumo de corrida antiga | `antes-resumo-demo-corrida-1.png` | `depois-resumo-demo-corrida-1.png` | 98 → **47** |
| Resumo de corrida nova | `antes-resumo-corrida-nova.png` | `depois-resumo-1-rota.png` → `-2-conquista.png` → `-3-final.png` | 72 → **34** |

- Os quadros do resumo são aproximados: a captura com o SwiftShader leva 0,5–2 s por quadro.
- O Mapa da captura não tem missão: o corredor de demonstração já tem corridas. A sequência aparece como "2 semanas", que é dado do servidor.

## 3. Régua de texto (`node docs/melhoria/F1/ux/medir-texto.mjs --comparar antes`)

| Tela | Antes | Depois | Meta | Blocos longos |
|---|---:|---:|---:|---|
| `(tabs)/index` · Mapa | 36 | 44 | 45 | 0 → 0 |
| `corrida` · preparação | 58 | **43** | 45 | 3 → **0** |
| `corrida` · GPS | 27 | 28 | 45 | 0 → 0 |
| `corrida` · ativa | 145 | **109** | 90 | 6 → **2** |
| `resumo` | 113 | **80** | 60 | 2 → **0** |
| **Telas de jogo** | 1.387 · média 77 · 32 blocos longos | 1.310 · média **73** · 23 blocos longos | | |

**Leitura dos números:**
- **Mapa, +8 no teto estático:** a régua soma todos os estados (menu de camadas, "Desde ontem", erro e carregando). Na 1ª dobra visível, caiu de 33 para 25 palavras, contando o nome do time e as 5 abas. Os textos dos alertas ficam em `map-screen.model.ts`, que a régua não lê. Eles têm no máximo 30 caracteres no título e 1 linha no apoio.
- **Corrida ativa, ainda acima de 90:** os textos de segurança (alerta de parada, SOS e Escolta) ficaram como estavam, como pede o relatório da F1.
- **Resumo, ainda acima de 60:** o teto conta também "Ver detalhes" (fechado por padrão) e a explicação da notificação.

## 4. Decisões locais (para o coordenador registrar, se concordar)

1. **Retrato da previsão ao vivo** (`lazyLiveSnapshot`).
   - A zona é lida do store quando a corrida a toca pela 1ª vez. Zona com dono vale 3 trechos virtuais (herança da D-62), e o ataque só vale dentro da janela.
   - Ainda não há trechos pintados: eles chegam quando existir o repositório de `zone_paint_near`.
   - Durante a corrida, as zonas carregam por área a cada troca de âncora (~500 m).
2. **Regiões do mapa da corrida.** A âncora é a grade de ~500 m (`mapAnchorKey`), então a suavização só é refeita quando as zonas ou a âncora mudam. Na web, o efeito do mapa virou 3: regiões, rastro (`pathVersion`) e pontos.
3. **Avisos durante a corrida.**
   - Só os eventos `pequena` ou maiores viram aviso.
   - O épico (1ª conquista da vida) vira médio com a borda acesa, sem partículas.
   - Entrar em zona rival não vibra duas vezes.
   - A fila guarda no máximo 3 avisos.
4. **Resumo.**
   - Só o que o **servidor confirmou** vira celebração; o resumo provisório não comemora nada.
   - As conquistas tocam num palco por cima da tela (um momento por vez) e depois ficam como chips.
   - O nível usa o XP do servidor, sem "subiu de nível" inventado.
5. **"A rota se desenha" só com opacidade.** São 12 pedaços em cascata em 800 ms, sem `strokeDashoffset` animado.
6. **Missão de boas-vindas** só quando o servidor responde que a pessoa não tem nenhuma corrida.

## 5. Testes (em `apps/mobile`)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ok |
| `./node_modules/.bin/eslint src` | 0 erros, 0 avisos |
| `npx jest --maxWorkers=2` | **87 suítes passam, 4 puladas · 1.038 passam, 26 pulados, 0 falhas** (os pulados são os mesmos de antes: banco local) |
| `reduced-motion.test.ts`, `testids.test.ts`, `animated-styles.test.ts` | verdes; a lista de exceções do `animated-styles` ficou **vazia** (as 5 eram da E6b) |

**Testes novos (37):**
- `features/run/__tests__/live-hud.test.ts` (14), que inclui o tracker real do domain conquistando uma zona neutra;
- `features/screens/__tests__/map-screen-model.test.ts` (10);
- `features/run/__tests__/summary-v2.test.ts` (8);
- `features/screens/__tests__/e6b-render.test.tsx` (5).

**Testes mudados de propósito:** só a lista de exceções do `animated-styles.test.ts`, com autorização do coordenador.

## 6. Pedidos para outras equipes

- **E7:**
  - **Hook do dia.** Preencher `MapToday` (`map-screen.model.ts`: `streak {done, goal, atRisk}`, `chest {credits, meters}`, `boss {name, hp}`, `mission`, `demo`) e passar em `src/app/(tabs)/index.tsx` como `<MapScreen today={…} />`.
  - **Resumo.** Entregar o bloco "Recompensas" como `<SummaryScreen rewards={…} />` em `src/app/resumo.tsx`.
  - **Corrida.** Enviar o `firstConquestEver` para o tracker, que hoje vai `false` e por isso nunca mostra "Sua 1ª zona!".
- **E8:** `<ShareButton>` por `renderShare={({ runId }) => …}` em `src/app/resumo.tsx`. Hoje o resumo compartilha só texto.
- **E5:**
  1. O `CelebrationSequence` pula o roteiro inteiro na web, porque o `isScreenReaderEnabled` do react-native-web devolve sempre `true`. Contornei com `screenReader={false}` só na web; o certo é tratar isso dentro do componente.
  2. O adaptador `LiveEvent` → `CelebrationEvent` não existia na minha base. Mapeei direto em `features/run/live-hud.ts` (`toastForEvent`) e troco quando o adaptador chegar.
- **E3 / E9:** repositório do retrato `zone_paint_near` (sem autor e sem hora) para preencher `snapshot.cells`.
  - **Risco:** a previsão ao vivo usa a regra v2, mas o servidor ainda está em `territory_rule = v1`. O texto diz "~" e "provável", e o servidor decide no resumo.
- **E6a (`.maestro/`, que é dela):**
  - **`03-uc03`:** tocar em `mapa-camada` antes de `mapa-camada-*`. As opções agora ficam num menu, e cada toque em `mapa-camada` abre ou fecha esse menu.
  - **`05-uc01`:**
    - só roda numa build de demonstração, porque `corrida-sinal-simulacao` agora existe só no modo demonstração;
    - tocar `resumo-conquistas-pular` (opcional) antes de `resumo-concluir`, porque o palco das conquistas fica por cima da tela por ~4 s.
  - **`mapa-alerta-ataque`:** mantido num invólucro; o id novo do `AlertSlot` é `mapa-alerta-attack`.
- **E6 (componentes base) / E6a:** ainda chamam `expo-haptics` direto: `button.tsx`, `hold-button.tsx`, `features/safety/use-run-safety.ts`, `onboarding-screen.tsx` e `faction-screen.tsx`. No SOS e nos alertas de segurança, usar `haptic(…, { force: true })`.
- **E10:**
  - o Mapa ganhou `testID="tela-mapa"` (achado nº 5 da onda 1);
  - `CaptureCelebration` saiu do resumo e ficou sem uso. Ela continua na lista do `reduced-motion.test.ts`; dá para apagar as duas juntas na onda 3.

## 7. Riscos e notas

- **Captura da corrida com o relógio falso do Playwright** (`clock.install`): ela travou no `screenshot`. Nas capturas da corrida e do resumo, usei o relógio real.
- **Pasta temporária compartilhada:** o `scratchpad` é dividido com outras frentes. Uma delas sobrescreveu `shots/`, e por isso refiz as capturas em `e6b-shots/`.
- **Onde a regra de produto aparece:**
  - a simulação depende de `isDemoActive()`, lido ao abrir a Nova corrida;
  - o "Desde ontem" depende das notificações do servidor (`conquest` e `territory_lost`). Sem notificação, o bloco não aparece.
