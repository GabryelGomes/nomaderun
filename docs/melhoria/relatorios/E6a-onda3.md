# E6a — Layout, "Você" e ajustes · Fase 7, F4, onda 3

> Tarefa **T7.3.1** (D-70, D-72 a D-77). Branch `worktree-agent-a5d87106b6610b9f6`, base `092497c`
> (+ 2 commits WIP do coordenador durante a pausa, sem mudança de conteúdo).

## 1. O que mudou

**Layout**
- `app/_layout.tsx`: `useReminderPlanner()` (E7) montado; rotas `missoes` e `recompensas` no guard `app`, com cabeçalho.
- `app/(tabs)/_layout.tsx`: `<WelcomeBackGate />` (E7) por cima das abas.

**Você** (`profile-screen.tsx`, rota `(tabs)/perfil`)
- Herói: `PlayerCard` com `ProgressRing` (E5) em volta do avatar (foto ou iniciais), título `titleForLevel` (E7) e
  `Mascot` (E4). Toque abre `/recompensas`. Com anel, o cartão mostra o XP em 1 linha (antes sumia).
- 3 `StatTile`: distância total, zonas conquistadas e Atlas (% do bairro mais explorado, `districtsExploration`).
- Estante de medalhas: 4 `Medal` (E4) com níveis por degrau e as bloqueadas; "N de 4".
- Atalhos (`SettingsRow`): Corridas (km da semana), Meu time, Missões, Recompensas (degrau da temporada).
- Engrenagem no cabeçalho (`voce-ajustes`) → `/perfil/ajustes`. O índice de confiança foi para Conta e privacidade.
- Números do histórico inteiro vêm de `listMyActivities` (via `useResource`), sem mexer no período das Corridas.

**Ajustes** (rota nova `(tabs)/perfil/ajustes`, `profile-screen.settings.tsx`)
- Conta (editar, notificações com "N novas", conta, moderação); Corrida Segura (Escolta, Alerta de parada, contatos);
  Privacidade (zonas + `<FeedSettings />` da E8); Jogo ("Vibração" e "Pular celebrações" com `useMotionPrefs`,
  "Pausa de saúde" → `<HealthPauseSheet />`); `<ReminderSettingsSection />` (E7); `<InviteCard kind="app" />` (E8); Sair.

**Corridas** (`activities-screen.tsx`, wireframe 12)
- Herói: km da semana em número grande + `WeekBars` (seg–dom, Brasília) + chama da sequência; meta da semana em 1 linha.
- Lista com `FeedRunCard` e mini-mapa: traço local ou `getActivityPath` (até 8 por abertura, 120 pontos).
- Selos ≤ 3 (estado do envio, simulada, zonas, fantasma, "+N pontos" — glossário D-74). Vazio: `EmptyArt sem-corridas` + Correr.

**Onboarding**: `MascotRunner quality="leve"` no carrossel; `LeaderBust pose="falando"` na folha do líder (slot 112 × 124).

**Vibração e fundo**: `haptic()` (E5) em `button.tsx` (`tap`), `hold-button.tsx` (`success`), `use-run-safety.ts`
(`warning`/`error` com `force`) e `faction-screen`. Onboarding já usava. `NeonBackdrop` pausa os laços com
`usePausedWhenHidden` e aceita `paused` (para o resumo da E6b, se quiser).

**Telas secundárias**
- Notificações agrupadas em Hoje / Ontem / Esta semana / Antes (Brasília), ícone por tipo; vazio com o mascote dormindo.
- Contatos e zonas de privacidade: abertura em 1 frase; vazio com `EmptyArt` (`sem-contatos`, `sem-localizacao`).
- Meu time: mascote grande, líder e lema; textos curtos; vazio ilustrado se não houver time.
- Ícones novos em `icon.tsx`: `gear`, `edit`, `logout`, `vibrate`, `sparkles`, `moon`, `invite`, `home`.

## 2. Testes (em `apps/mobile`)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ok |
| `./node_modules/.bin/eslint src` | 0 erros, 0 avisos |
| `npx jest --silent --maxWorkers=2` | **114 suítes passam, 4 puladas · 1297 casos passam, 26 pulados, 0 falhas** |
| `testids`, `reduced-motion`, `animated-styles` | verdes |

- Novo `features/screens/__tests__/profile-model.test.ts` (10 casos): estante, km da semana, corridas da semana, selos,
  iniciais e grupos por dia das notificações.
- Atualizado de propósito `components-game.test.tsx`: com o anel, o `PlayerCard` mostra o XP em 1 linha.

## 3. Régua de texto (`--comparar antes`)

| Tela | Antes | Agora | Blocos longos |
|---|---:|---:|---|
| (tabs)/perfil (Você) | 171 | **13** no arquivo · **≈ 30 na captura** (com os textos dos componentes) | 2 → 0 |
| perfil/atividades | 66 | 35 | 2 → 0 |
| perfil/time | 90 | 72 (meta 60; as 3 consequências da troca ficam) | 2 → 0 |
| perfil/ajustes (nova, conta) | — | 31 | 0 |
| perfil/conta | 73 | 84 (+ índice de confiança) | 2 → 2 |
| contatos-seguranca | 56 | 42 | 2 → 0 |
| zonas-privacidade | 76 | 56 | 2 → 0 |

Telas de jogo: média **57 → 48**, blocos longos **16 → 10**, sem imagem **12 → 9**. A régua ganhou a linha
`(tabs)/perfil/ajustes`.

## 4. Capturas (390 px, modo demonstração, pngquant 85–98)

`E6a-onda3/antes/` e `E6a-onda3/depois/` (`capturas.cjs` da E10: perfil, atividades, notificações, contatos, zonas,
Meu time e onboarding, nos estados cheio/vazio/carregando/erro). Extras em `depois/`: `ajustes__390.png`,
`onboarding-times__390.png`, `onboarding-lider__390.png`. Export com `EXPO_PUBLIC_DEMO=1 --clear`, `TMPDIR` próprio;
`voce-ajustes` e `notificacoes-grupo` conferidos no bundle. 0 erros de página, 0 pedidos ao servidor.

## 5. Pendências e riscos

- **E10:** incluir `/perfil/ajustes` no `capturas.cjs`; a captura "atividades" usa `/atividades` (redireciona).
- **E4:** arte de "casa" para o vazio das zonas de privacidade (hoje usa `sem-localizacao`).
- **E7:** medalhas de verdade (a estante usa 4 regras locais em `profile-screen.model.ts`, sobre dados reais).
- **E6b:** `NeonBackdrop paused` disponível para pausar durante o roteiro do resumo.
- **Risco:** nome longo é cortado no cartão (anel + mascote ocupam 144 pt); `button.tsx` agora vibra também no Android
  (mapeamento da E5). Corridas faz até 8 pedidos de rota por abertura.
- Conta e privacidade passou da meta de conta (84 > 80) pelo índice de confiança; textos LGPD mantidos.
