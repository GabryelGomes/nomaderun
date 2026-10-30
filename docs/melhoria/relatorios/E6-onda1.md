# E6 — UX/UI das telas · Fase 7, F3, onda 1 (fundação)

> Tarefas **T7.1.16** (honestidade e segurança) e **T7.1.17** (tokens e componentes base). 2026-10-23.
> Branch `worktree-agent-aea708411c15bf26d`, base `d7747d8`.

## 1. Resumo

- **O app publicado deixou de mentir.**
  - A Nova corrida começa no **GPS real**; a simulação virou a opção "Simulação (demonstração)".
  - Saíram a conquista "garantida", o "dobro" depois de 24 h, o Raid "em toda corrida", os lendários "longe", a Liga com número falso, o encontro com "17 confirmados" e a promessa de "cor de rastro ou moldura".
  - Raid, Liga e Encontro mostram um **estado vazio "Em breve"** em vez de dado inventado (D-76).
- **Contraste D-75 resolvido.**
  - Texto escuro `#070708` no laranja (7,02:1) e no vermelho (6,14:1).
  - Bordas de controle com 3,4:1 a 3,6:1.
  - Token `villain` `#B15CFF`.
  - O `contraste.cjs --strict` **passa**.
- **18 componentes novos** em `src/components/`, com arte e motion por slot. O anel de progresso continua sendo o `ProgressRing` da E5.
- **Testes:** 50 casos novos (46 de renderização dos componentes + 4 de contraste). Jest completo: **467 passam, 26 pulados (os mesmos de antes), 0 falhas**.

## 2. T7.1.16 — Honestidade e segurança

| Bug | Antes | Depois | Arquivo |
|---|---|---|---|
| Falha 1 (E10), D-76 | `useState<RunMode>('simulacao')` | **GPS real é o padrão.** O chip GPS vem primeiro; o outro diz "Simulação (demonstração)". Na verificação do GPS, o botão é "Usar simulação (demonstração)"; na corrida ativa, o cabeçalho também diz "Simulação (demonstração)" | `run-screen.tsx` |
| E-01 | "Conquista garantida ao terminar" e "Faltam N RP" | "Conquista provável: o servidor confirma ao terminar" e "Faltam cerca de N pontos para conquistar"; o ganho aparece como "~+N pts" | `run-screen.tsx` |
| E-04 | Alerta do Mapa com `isUnderAttack` (sem prazo) e "defender vale pontos em dobro" | O alerta só existe dentro da janela de 24 h (`defenseWindowOpen` com `useNow`) e diz "dobro até 18:40" | `map-screen.tsx` |
| E-18 | Caça: "Os lendários ficam longe" | "Baús escondidos pela cidade: passe a 25 m para abrir." | `arena-screen.tsx` |
| E-21 | Raid "Em toda corrida"; "Domínio, Neblina e Raid valem em toda corrida" | Raid "Em breve" (card que não é botão); "Domínio e Neblina contam em toda corrida." | `arena-screen.tsx` |
| E-22, E-23, E-24 | Liga de demonstração em conta real (divisão fixa, XP da vida, "Duas corridas mudam isso") | Estado vazio: "A Liga ainda não começou" | `arena-screen.tsx` |
| Raid (falha 4, D-76) | "2.312 km de dano" de demonstração | Estado vazio: "O chefão ainda não chegou" | `arena-screen.tsx` |
| Encontro (falha 4, R-3) | "17 confirmados" e um "Confirmar presença" laranja que não gravava | Estado vazio: "Nenhum encontro marcado" | `club-screen.tsx` |
| E-26 | Barra `membros ÷ 30` sem significado | Dois `StatTile` reais: "Corredores 4 de 30" e "Na temporada 23,4 km" | `club-screen.tsx` |
| R-4 | "Cada nível libera uma cor de rastro ou moldura." | Removida (não existe; volta quando a E7 entregar) | `profile-screen.tsx` |
| Falha 3 | "Backend não configurado" com `.env`, `npx supabase status` e `npx expo start --clear` | "Servidor indisponível" + 1 frase + **Tentar de novo** (`reloadAppAsync`). Uma linha técnica só com `__DEV__` | `unavailable-screen.tsx` |
| Perfil não carregou | Título de 37 caracteres e "Sair" com o mesmo peso | "Não deu para abrir seu perfil" (29) + Tentar de novo; "Sair da conta" virou `ghost` | `unavailable-screen.tsx` |
| D-70 | Night Owls: "Donos da madrugada" | "Donos das luzes da cidade" | `tokens.ts` |

**Notas:**
- A Arena usa o `ModeCard`:
  - Domínio e Neblina ficam só leitura ("Em toda corrida");
  - Fuga e Caça são botões ("Escolha antes de sair");
  - Raid, Rabisco e Bandeira são "Em breve" e **não parecem botão**: borda tracejada, sem seta e sem retorno de toque.
- `DEMO_RAID`, `demoLeague` e `DEMO_CREW` continuam em `src/demo` (pasta da E10), para o modo demonstração da onda 2.
- **Maestro:** `05-uc01-corrida-simulada.yaml` agora espera "Conquista provável: o servidor confirma ao terminar". O toque em `corrida-sinal-simulacao` já existia e continua obrigatório. `testids.test.ts` verde.

## 3. T7.1.17 — Tokens, acessibilidade e componentes

### 3.1 Tokens (`tokens.ts`, `neon.ts`)

| Token | Antes | Depois | Razão |
|---|---|---|---|
| `dark.onAction` | `#FFFFFF` | `#070708` | 2,87 → **7,02:1** |
| `dark.onDanger` (novo) | `'#FFFFFF'` fixo no `button.tsx` | `#070708` | 3,28 → **6,14:1** |
| `dark.lineControl` (novo) | `line` `#24252B` nos controles | `#666870` | 1,32 → **3,62:1** no fundo · 3,37 na superfície · 3,09 na superfície afundada |
| `factions.volt.onColor` | branco | `#070708` | 3,42 → **5,89:1** |
| `neon.villain` (novo) | — | `#B15CFF` | 5,60:1 no fundo |
| `light.onAction` e `light.lineControl` (tema claro sem uso) | branco | `palette.ink` e `#86857F` | mantém o tipo `ThemeColors` igual nos dois temas |

**Regra:**
- `line` ficou só para a borda **decorativa** (cartão e divisória);
- `lineControl` vai em botão secundário, chips, campos e caixa de seleção;
- a cor base do time (`factions.*.color`) é preenchimento; o texto na cor do time usa `neonTeam` (D-70). Conferi com `grep` que nenhum `<Text>` usa a cor base.

### 3.2 Contraste (`node docs/melhoria/F1/qa/contraste.cjs --strict`)

| | Pares | Abaixo do mínimo | `--strict` |
|---|---:|---:|---|
| Antes | 63 | 10 (8 no tema escuro) | **falha** (saída 1) |
| Depois | 62 | 1 (`palette.ink3` do tema claro sem uso, que o `--strict` ignora) | **passa** (saída 0) |

**Atenção, coordenador:** mexi em 3 pontos do `contraste.cjs` (pasta da E10) para ele medir o que o código usa de verdade.
1. O botão de perigo lia `'#FFFFFF'` fixo; agora lê `dark.onDanger`.
2. As bordas de controle leem `dark.lineControl` (fundo, superfície e superfície afundada).
3. O par "`factions.*.color` como texto" saiu, porque pela D-70 essa cor não é usada como texto; os pares "ui" continuam.

Também acrescentei os 2 pares do `villain`. Cada mudança tem um comentário "E6 (onda 1)". O teste `src/components/__tests__/tokens-contrast.test.ts` trava os mesmos pares no Jest.

### 3.3 Acessibilidade

- **Botões:**
  - o `Button` anuncia `accessibilityState={{ disabled, busy }}` (nova prop `busy`);
  - usa `minHeight` no lugar de `height`, e o rótulo tem `maxFontSizeMultiplier` de 1,4.
- **Fonte grande:**
  - o `Text` tem teto por variante: `hero` 1,2; `metric` e `headline` 1,3 (`FONT_SCALE_MAX`);
  - chips do `ChipRow` e do mapa usam `minHeight` e teto de 1,3 (`CHIP_FONT_MAX`).
- **Campos:** o `TextField` tem borda `lineControl` também em repouso (antes não tinha borda até ganhar foco); a caixa de seleção usa a mesma borda.
- **Termos e Privacidade:** viraram `InlineLink` (`form-ui.tsx`), com alvo de 44 pt de altura. Antes eram `Text onPress` com 20 pt. Os testIDs continuam `cadastro-abrir-termos` e `cadastro-abrir-privacidade`.
- **Contagem 3-2-1 e aviso de SOS:** texto escuro sobre o laranja e o vermelho.
- **Alvos novos ≥ 44 pt:** link do `SectionHeader` (44), "Conhecer líder" (44), chips do `DailyStrip` (44), fechar do `AlertSlot` (48×56), `SettingsRow` (56), `ModeCard` (72), `BigRunButton` (72).

### 3.4 API dos componentes novos (`apps/mobile/src/components/`)

Todo interativo exige `testID` e tem `accessibilityLabel` montado a partir dos textos. Arte decorativa fica com `aria-hidden` e `importantForAccessibility="no-hide-descendants"`.

| Componente | Props | Slots para E4/E5 |
|---|---|---|
| `HeroHeader` | `title`, `eyebrow?`, `body?`, `tone?: FactionId \| 'action' \| 'villain'`, `aside?`, `children?`, `testID?` | `art` (112 pt) e `children` (números, `ProgressRing`) |
| `BigRunButton` | `onPress`, `testID`, `label='Correr'`, `sublabel?`, `accessibilityLabel?`, `disabled?` | `halo` (pulso da E5, atrás do botão) |
| `StatTile` | `label`, `value`, `unit?`, `icon?`, `accent?`, `delta?: {value, good?}`, `size?: 'md'\|'lg'`, `testID?` | `valueSlot` (`CountUp`) |
| `ModeCard` | `testID`, `title`, `body`, `variant: 'play'\|'info'\|'soon'`, `icon?`, `tag?`, `selected?`, `onPress?` | `art` (ícone ilustrado) |
| `PlayerCard` | `testID`, `name`, `faction`, `level`, `xp: {into, needed}`, `title?`, `onPress?` | `avatar`, `mascot` e `ring` (sem anel, usa a barra de XP) |
| `FeedRunCard` | `testID`, `path: LatLng[]`, `title`, `distance`, `detail?`, `badges?` (máx. 3), `author?: {name, faction}`, `color?`, `demo?`, `onPress?` | `aside` (ex.: "Bora!" da E8); exporta também `RouteMiniMap` |
| `WeekBars` | `days` (7, seg→dom), `today` (0..6), `unit='km'`, `format?`, `height=72`, `max?`, `testID?` | estático (a animação, se houver, é da E5 com `scaleY`) |
| `DailyStrip` | `items: {key, testID, icon, value, label, tone?, onPress?}[]` (máx. 3; vazio = nada) | — |
| `AlertSlot` | `alerts: {id, kind, title, body, onPress, onDismiss?}[]`, `testID='alerta'` | `art` de cada alerta. Prioridade em `ALERT_PRIORITY`; escolha em `pickAlert()` |
| `MissionCoachCard` | `testID`, `title`, `done`, `steps: string[]`, `eyebrow='Missão'`, `reward?`, `demo?`, `onPress?` | `art` |
| `TeamPickerCard` | `faction`, `selected`, `onSelect(f)`, `onLeader?(f)`, `width?`, `testID?` (padrão `time-<id>`) | `art` (mascote) |
| `TeamCarousel` | `value: FactionId \| null`, `onChange`, `onLeader?`, `testID='times'` (cards `times-<id>`) | `renderArt(f, selected)` |
| `LeaderSheet` | `faction`, `onJoin`, `onBack`, `busy?`, `testID='lider'` (`-entrar`, `-voltar`) | `art` (busto) |
| `PermissionPrimer` | `testID` (`-permitir`, `-agora-nao`), `title`, `body`, `ctaLabel`, `onPress`, `footnote?`, `icon?`, `secondaryLabel?`, `onSecondary?`, `busy?` | `art` |
| `HelpSheet` | `testID`, `title`, `cards: {key, title, body, icon?}[]`, `onClose?` | `art` de cada cartão |
| `DemoBadge` | `label='Demonstração'`, `testID?` | — |
| `SettingsRow` | `testID`, `icon`, `title`, `value?`, `onPress`, `destructive?` | — |
| `EmptyState` | `title`, `body?`, `icon?`, `tag?`, `action?`, `compact?`, `testID?` | `art` (112 pt; 72 no `compact`) |
| `SectionHeader` | `title`, `actionLabel?` + `onAction?` (link "Ver todas"), `actionTestID?`, `action?`, `testID?` | — |

**Arquivos de apoio:**
- `team-identity.ts`: mascote, líder, estilo, bio curta e fala de cada time (D-70 e bíblia da E4), mais a linha de equilíbrio;
- `route-path.ts`: `routeSvgPath` (projeção local, mantém a proporção) e `thinRoute`. A rota de outra pessoa precisa chegar **já cortada** pelo domain (D-78, D-79).

**Compatibilidade:** `EmptyState` e `SectionHeader` foram para arquivos próprios e continuam exportados por `surface.tsx`; as 12 importações em telas não mudaram.

## 4. Testes e verificações (em `apps/mobile`)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ok |
| `./node_modules/.bin/eslint src` | 0 erros, 0 avisos |
| `npx jest --maxWorkers=2` | **54 suítes passam, 4 puladas · 467 casos passam, 26 pulados**. Os pulados são os testes de integração com banco local, iguais aos de antes. Novos: +50 |
| `testids.test.ts` e `reduced-motion.test.ts` | verdes |
| `contraste.cjs --strict` | saída 0 (antes 1) |

**Testes novos:**
- `components-base.test.tsx` (17 casos);
- `components-game.test.tsx` (18);
- `components-team.test.tsx` (11);
- `tokens-contrast.test.ts` (4).

**Como funcionam:**
- usam o `react-test-renderer` 19.2.3, que já é dependência do `jest-expo` (nada instalado);
- `render-helpers.tsx` dá `host`, `press` e `text`;
- cada arquivo simula o Reanimated e o Worklets (`require('react-native-reanimated/mock')` e `react-native-worklets/src/mock`).

**Testes de tela:** nenhum mudou de propósito. Não há teste de renderização de tela; o `game-motion.test.ts` não foi afetado.

**Aviso conhecido:** "A worker process has failed to exit gracefully" já existia antes (vazamento de handle, T7.E10.7).

## 5. Régua de texto (`node docs/melhoria/F1/ux/medir-texto.mjs --comparar antes`)

Só as telas que mudaram; as demais ficaram iguais.

| Tela | Palavras antes | Depois | Δ | Blocos longos |
|---|---:|---:|---:|---|
| `(tabs)/arena` | 195 | **119** | −76 | 10 → **1** |
| `(tabs)/perfil` | 171 | 162 | −9 | 2 → 2 |
| `(tabs)/clube` | 108 | 108 | 0 | 3 → 2 |
| `(tabs)/index` · Mapa | 36 | 33 | −3 | 0 → 0 |
| `corrida` · preparação | 58 | 58 | 0 | 3 → 3 |
| `corrida` · GPS | 27 | 28 | +1 | 0 → 0 |
| `corrida` · ativa | 145 | 149 | +4 | 6 → 6 |
| `indisponivel` | 73 | **43** | −30 | 2 → **0** |
| **Telas de jogo** | 1.470 · média **82** · 42 blocos longos | 1.387 · média **77** · 32 blocos longos | −83 | |

**Leitura dos números:**
- **Clube:** o encontro falso saiu, mas os rótulos do `StatTile` e o estado vazio entraram, e o total ficou igual. O corte grande do Clube é da onda 3 (T7.3.3).
- **Corrida ativa:** +4 palavras de propósito ("cerca de", "provável… confirma"), porque a honestidade vale mais que 4 palavras.
- **Telas ainda sem imagem:** continuam 14. O `EmptyState` com ícone não conta como ilustração na régua, o que está certo. A arte da E4 entra na onda 2.

## 6. Pendências, pedidos e riscos

**Pedidos:**
- **Para a E10:**
  1. `e2e-web/demo-flow.cjs:124` espera "Conquista garantida ao terminar". Trocar por `"Conquista provável: o servidor confirma ao terminar"` (e o `README.md:21` do `e2e-web`). A pasta é da E10 e eu não editei.
  2. Absorver as 3 mudanças do `contraste.cjs` (§3.2) quando ele for para `apps/mobile/scripts/` e ligar o `--strict` na CI (D-81).
  3. Capturas antes e depois quando o modo demonstração existir. As referências visuais (`visual.spec.cjs`) vão mudar de propósito: botões com texto escuro, bordas visíveis e estados vazios.
  4. Botão "Ver demonstração" na tela indisponível (onda 2) e o modo demonstração voltar a mostrar Raid, Liga e Encontro com `DemoBadge`.
- **Para a E4:** arte por slot.
  - `EmptyState.art`: Raid "chefão a caminho", Liga, encontro, servidor indisponível.
  - `TeamPickerCard.art`: mascotes.
  - `LeaderSheet.art`: bustos.
  - `ModeCard.art`: ícones de modo.
  - `PermissionPrimer.art`: rota pintando o bairro.
  - `HelpSheet`: 3 cartões.
- **Para a E5:**
  - `BigRunButton.halo` (pulso na 1ª vez);
  - `StatTile.valueSlot` (`CountUp`);
  - `PlayerCard.ring` e `HeroHeader.children` (`ProgressRing`);
  - mola do `TeamCarousel` (hoje é o snap nativo);
  - animação das `WeekBars` (só `scaleY`).
- **Para a E3 (E-01 de verdade):** função pura "metros (ou pontos) para conquistar ou defender", com esforço, escudo e teto, para trocar a estimativa `metros × 0,1` do `run-screen`. O texto já diz "cerca de" e "provável".
- **Para a E7:** recompensas de nível reais (R-4) antes de qualquer frase sobre elas; os títulos por nível para o `PlayerCard.title`.

**Pendências da E6 (onda 2, T7.2.6):**
- o `Switch` da Corrida Segura na pré-corrida ainda tem 40×20 na web; vira linha inteira tocável na reescrita da pré-corrida;
- o mapa da corrida recalcula as regiões a cada ponto (D1/D2, pedido T7.E6.y);
- usar os componentes novos no Mapa (`DailyStrip`, `AlertSlot`, `MissionCoachCard`, `BigRunButton`) e no onboarding (`TeamCarousel`, `LeaderSheet`, `PermissionPrimer`).

**Riscos e notas:**
- **Base da worktree:** ela nasceu em `a663bee`, mais velho que a base pedida. Avancei a minha própria branch até `d7747d8` por fast-forward (`git merge --ff-only`): nenhum commit de outra branch foi misturado e nada foi reescrito.
- **Volt com texto escuro:** muda a faixa "Território dos Volt" da corrida e as iniciais do avatar Volt em "Editar perfil". `banner-color.test.ts` continua verde.
- **`unavailable-screen`:** usa `reloadAppAsync` do `expo`. Na web, ele recarrega a página.
- **Ordem dos commits:** rodei as verificações no estado final e fiz 3 commits pequenos em sequência. Cada commit compila sozinho: tokens, depois componentes, depois telas.
