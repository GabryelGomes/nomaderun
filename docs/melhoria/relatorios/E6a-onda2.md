# E6a — Primeira abertura, abas e layout · Fase 7, F3, onda 2

> Tarefa **T7.2.6** (D-72, D-73, D-74, D-77). 2026-10-23.
> Branch `worktree-agent-a09949d5c2f14ee48` (worktree `.claude/worktrees/agent-a09949d5c2f14ee48`), base `89144d8`
> mais o commit da E10 `8307eb4` (interruptor do modo demonstração), trazido por `cherry-pick` com autorização do
> coordenador.

## 1. Resumo

- **Primeira abertura nova (D-72):** Boas-vindas → cadastro enxuto → "A cidade está dividida" → escolha do time →
  confirmação épica → GPS explicado → Mapa com a missão de boas-vindas.
  - **Cadastro:** 4 campos; 1 caixa grava os 2 aceites; a cidade saiu.
  - **Escolha do time:** carrossel com o mascote animado (E4), "Conhecer {líder}" (folha do líder), quiz
    "Não sei escolher" (3 perguntas).
  - **Confirmação:** `TeamConfirm` (E5) com o mascote em vitória e o grito do líder.
  - **Notificações:** saíram do onboarding (vêm depois da 1ª conquista, E7).
  - **Passo "nome":** só aparece para quem não tem nome de usuário (login social sem nome).
- **No modo demonstração, o Mapa chega em 21,6 s** com o robô (Playwright); por uma pessoa, a estimativa é de
  60 a 75 s. Meta: ≤ 90 s.
- **Abas novas (D-73):** Mapa · Arena · **Correr** · Clube · **Você**.
  - **Correr** abre a Nova corrida a 1 toque.
  - **Você** é a antiga aba Perfil, com o atalho "Atividades".
  - `/atividades` continua funcionando (redireciona para `/perfil/atividades`).
- **Modo demonstração (D-77):**
  - "Ver demonstração" em Entrar e na tela indisponível;
  - selo fixo no `_layout` (`testID="selo-demonstracao"`), com "Sair" quando o modo foi ligado pelo botão;
  - ouvinte da troca no `session-controller` (zera as stores);
  - login social escondido na demonstração.
- **Guarda de rotas:** novo campo `onboardingInProgress`. A confirmação e o GPS acontecem **depois** de o time ser
  gravado, sem o layout trocar de grupo no meio.
- **Testes:** **1029 passam, 26 pulados, 0 falhas** (84 suítes + 4 puladas). Typecheck e ESLint limpos. Em relação à base
  `89144d8` (986 casos), são +43: 32 nos 4 arquivos meus da §6 e 10 do `demo-switch` da E10 (cherry-pick). O
  caso a mais que sobra na conta não foi investigado.

## 2. Primeira abertura (D-72)

### 2.1 A jornada e o tempo até o Mapa

Medido com `docs/melhoria/relatorios/E6a-onda2/primeira-abertura.cjs`:
- export web com `EXPO_PUBLIC_DEMO=1` e `--clear` numa pasta própria, com `TMPDIR` próprio;
- `e2e-web/serve.cjs`, Chromium com 390 × 844 e GPS permitido;
- `?cenario=primeira-abertura`.

O robô digita na hora, mas para 0,3 a 2,5 s antes de cada captura. O caminho medido inclui a folha do líder e o quiz,
os 2 desvios.

| Marca | Tempo acumulado (robô) | Estimativa para uma pessoa |
|---|---:|---:|
| Boas-vindas na tela | 1,0 s | 2 s |
| Cadastro (Começar) | 2,9 s | 5 s |
| "A cidade está dividida" | 4,4 s | 35 a 45 s (4 campos e 1 caixa) |
| Escolha do time (passou sozinha) | 10,7 s | + 6 s |
| Time escolhido (com a folha do líder e o quiz) | 17,9 s | + 10 a 20 s |
| Confirmação épica | 18,0 s | + 3 s |
| Explicação do GPS | 20,5 s | + 3 s |
| **Mapa com a missão de boas-vindas** | **21,6 s** | **≈ 60 a 75 s** |

**Resultado da execução:**
- 0 erros de página;
- selo "Demonstração" presente;
- `/atividades` redirecionou para `/perfil/atividades`.

O "Ver demonstração" de Entrar, no roteiro `primeira-abertura`, leva ao onboarding (a conta de demonstração ainda não
tem time).

### 2.2 Capturas (390 px, pngquant 85–98, 528 KB no total)

Pasta: `docs/melhoria/relatorios/E6a-onda2/`. Junto ficam o `relatorio.json` e o script.

| Arquivo | Tela |
|---|---|
| `00-entrar-ver-demonstracao.png` | Entrar com "Ver demonstração" |
| `01-boas-vindas.png` | Boas-vindas: wordmark, 1 frase, Começar / Já tenho conta |
| `02-cadastro.png`, `03-cadastro-preenchido.png` | Cadastro: 4 campos, 1 aceite, CTA fixo |
| `04-cidade-dividida.png` | "A cidade está dividida": mapa ilustrado com as 4 regiões suavizadas e a fatia de cada time |
| `05-times.png`, `09-time-escolhido.png` | Carrossel com o Lume (E4), estilo, bio e "Conhecer Íris Valente" |
| `06-lider.png` | Folha do líder (Nara Lis) |
| `07-quiz.png`, `08-quiz-resultado.png` | Quiz: "Sugerimos os Neon Striders. A escolha é sua." |
| `10-confirmacao-inundando.png`, `11-confirmacao.png` | `TeamConfirm`: a cor inunda a tela; "Passo certo, cidade azul!" |
| `12-localizacao.png` | GPS: arte "pinte" (E4), 1 motivo e 1 garantia |
| `13-mapa-missao.png` | Mapa com "Missão 1 · Corra 500 m e pinte sua 1ª zona" (Conta ✓ · Time ✓ · Correr 500 m), acima do alerta e do Correr |
| `14-voce.png`, `15-voce-atividades.png` | Aba Você e as Atividades dentro dela |
| `16-correr-abre-nova-corrida.png` | Aba Correr → Nova corrida |

### 2.3 O que mudou, passo a passo

**Boas-vindas** (`features/auth/welcome-screen.tsx`, rota `(auth)/boas-vindas`):
- é a 1ª tela do grupo `auth`;
- tem 1 frase: "Corra a sua cidade: cada rua conta.";
- se a sessão foi encerrada pelo servidor, vai direto para Entrar, onde o aviso aparece.

**Cadastro** (`sign-up-screen.tsx`):
- e-mail, senha (com medidor), nome de usuário ("Aparece nos rankings.") e nascimento ("Para maiores de 16 anos.");
- **1 caixa**, "Aceito os Termos e a Privacidade", com os 2 links de 44 pt. Ela envia `acceptedTerms` e
  `acceptedPrivacy`, então o trigger do servidor não muda;
- erro único: "Aceite os Termos e a Privacidade para continuar.";
- "Já tenho conta" usa `router.dismissTo('/entrar')`;
- a cidade fica em "Editar perfil".

**"A cidade está dividida"** (`features/screens/onboarding/city-divided*.ts(x)`):
- **Dados:** porcentagem de zonas de cada time, vinda de `getFactionRanking()`. Sem dado ou sem zonas, usa uma
  divisão de exemplo com o selo "Demonstração".
- **Arte:** feita com as primitivas neon da E4 (`neon`, `glyph`, `StaticArt`). Regiões **suavizadas** (curvas
  quadráticas, nunca hexágonos), com a forma de cada time; a área acompanha a fatia.
- **Tempo:** passa sozinha em 6 s; "Escolher meu time" adianta. Com leitor de tela ligado, não avança sozinha.
  Na web o react-native-web sempre diz "leitor ligado", então lá ela sempre avança.

**Escolha do time** (`onboarding-screen.tsx`):
- `TeamCarousel` com `Mascot` animado (qualidade `leve`);
- vibração `selection` (E5);
- CTA "Entrar para os {time}"; "Dá para trocar 1 vez por temporada.";
- erro na própria tela: "Não deu para salvar seu time. …";
- saiu o `?? 'striders'`.

**Folha do líder:** `LeaderSheet` com o mascote no lugar do busto. O busto é da E4 nesta onda.

**Quiz** (`quiz.ts`, `team-quiz.tsx`):
- perguntas e respostas da bíblia (§3.5), com a ordem girando a cada pergunta;
- sem cor nem forma nas respostas;
- vence o mais votado; no empate, vale a pergunta 1;
- "Ver os {time}" só pré-seleciona o card. A escolha é da pessoa.

**Confirmação:**
- `chooseFaction` começa no toque, e o `TeamConfirm` aparece com `origin` medido por `measureInWindow`;
- "Bora correr" espera o servidor. Se ele falhou, volta à escolha com o erro.

**GPS** (`LocationStep`):
- `PermissionPrimer` com `TutorialArt step="pinte"` e o título "Ligue o GPS e pinte a cidade" (28 caracteres);
- o pedido do sistema tem limite de 10 s, para nunca prender o onboarding.

**Mapa:**
- `WelcomeMissionOverlay` (`welcome-mission-card.tsx`), montado no `(tabs)/_layout.tsx` para não mexer na tela do
  Mapa (E6b);
- aparece só na aba Mapa e só na sessão em que a pessoa acabou de entrar;
- texto do catálogo da E7 (`f1-dominio`);
- **sem prêmio prometido** (XP e baú dependem das flags);
- toque → Nova corrida; "x" fecha;
- fica acima do Correr e do espaço do alerta de ataque (`welcomeMissionBottom`, testado por plataforma).

### 2.4 Guarda de rotas

`route-guard.ts`:
- `GuardInput.onboardingInProgress?: boolean`;
- regra: `hasFaction && !onboardingInProgress ? 'app' : 'onboarding'`.

`features/auth/onboarding-flow.ts` (Zustand, só na memória):
- `activeFor` e `welcomeFor` guardam o **id da pessoa**: a flag nunca vale para outra conta;
- `begin` acontece ao montar o onboarding; `finish`, no último passo.

**Casos:**
- quem já tinha time vai direto às abas;
- app fechado entre o time e o GPS: na volta, abas (a Nova corrida pede o GPS de novo).

## 3. Abas (D-73)

**Configuração única** (`components/app-tabs-config.tsx`): `APP_TABS`, `RUN_ROUTE` e `ACTIVITIES_ROUTE`.

**Nativo** (`app-tabs.tsx`):
- **Correr** é uma aba comum;
- `screenListeners.tabPress` → `router.push('/corrida')`;
- a tela da aba (`/correr`, `app-tabs-correr.tsx`) tem só a arte "corra" e o `BigRunButton`. É o que fica na aba
  quando a corrida fecha;
- `testID` nos triggers (`aba-*`).

**Web** (`app-tabs.web.tsx`):
- barra de 64 px e Correr em **círculo laranja**;
- o toque faz `preventDefault` e abre `/corrida`;
- o círculo passa 6 px da barra, sem invadir os 16 px livres acima do Correr do Mapa (testado).

**Você:**
- a aba `perfil` ganhou o rótulo e o título "Você";
- o botão "Atividades" no cabeçalho (`voce-atividades`) abre `/perfil/atividades`;
- `(tabs)/atividades/` saiu;
- a rota `app/atividades.tsx` redireciona, para manter o `router.replace('/atividades')` do resumo (E6b), o
  `capturas.cjs` e links antigos.

**Ícone laranja da Correr no nativo:**
- a NativeTabs só pinta de laranja o ícone **selecionado** (`selectedColor`);
- o laranja sempre aceso depende de um PNG com `renderingMode: 'original'` (pedido à E4).

## 4. Modo demonstração (D-77)

- **`features/auth/demo-entry.ts`:**
  - `startDemo()`:
    - no build normal, chama `enterDemo()` da E10;
    - no build de demonstração, entra na conta do corredor de demonstração;
  - `leaveDemo()` chama `exitDemo()`;
  - `canLeaveDemo()` vale `isDemoActive() && !isDemoBuild()`;
  - `useDemoActive()` usa `useSyncExternalStore(onDemoSwitch, isDemoActive)`.
- **`session-controller.ts`**, como pedido no §6 do relatório da E10:
  - `onDemoSwitch(resetStoresForDemoSwitch)` zera game, session, zones, notifications e o `onboarding-flow`, **sem**
    `clearLocal()`;
  - o efeito do `useSessionBootstrap` depende de `useSyncExternalStore(onDemoSwitch, isDemoActive)`.
- **Selo** (`demo-seal.tsx`):
  - fica no alto e no centro, sem receber toque (os cantos têm voltar, fechar e botões do cabeçalho);
  - "Sair" (`selo-demonstracao-sair`, 44 pt com o `hitSlop`) aparece só quando o modo foi ligado pelo botão.
- **Login social:** some com o modo ligado.

## 5. Lembretes da E7

O `useReminderPlanner` **não existe nesta base**. O ponto está marcado com um comentário no `app/_layout.tsx`, logo
antes das guardas. O coordenador monta na integração.

## 6. Testes e verificações (em `apps/mobile`)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ok |
| `./node_modules/.bin/eslint src` | 0 erros, 0 avisos |
| `npx jest --maxWorkers=2` | **84 suítes passam, 4 puladas · 1029 casos passam, 26 pulados, 0 falhas** (base `89144d8`: 81 suítes, 986 casos) |
| `testids.test.ts` (Maestro × código) e `reduced-motion.test.ts` | verdes |
| `demo-contract` e `demo-switch` | verdes |

**Testes novos ou atualizados:**

| Arquivo | Casos | O que cobre |
|---|---:|---|
| `features/auth/__tests__/route-guard.test.ts` | 8 → **15** | `onboardingInProgress`, a flag que não fura sessão, recuperação nem perfil, e a flag por pessoa |
| `features/auth/__tests__/first-open.test.tsx` | **7** | Boas-vindas; cadastro com 4 campos, sem cidade, 1 aceite e os 2 aceites no servidor; "Ver demonstração" nos 2 builds; ouvinte da troca |
| `features/screens/onboarding/__tests__/onboarding.test.tsx` | **11** | Quiz (puro, todas as 64 combinações, e na tela); porcentagens que somam 100; regiões sem hexágono; avanço em 6 s com relógio falso; selo quando falta dado; missão do catálogo |
| `components/__tests__/tab-bar-clearance.test.ts` | 2 → **9** | Ordem das abas; Correr no centro, abrindo `/corrida`; Você em `/perfil`; o círculo da web; card da missão acima do Correr e do alerta em iOS, Android e web |

**Maestro** (`.maestro/`):
- `abrir-app` espera também `tela-boas-vindas`;
- `entrar-demo` e `02-login` passam por "Já tenho conta";
- `01-cadastro-onboarding` virou a jornada nova: 4 campos, `cadastro-aceite`, cidade, times, confirmação, GPS e
  `mapa-missao-boas-vindas`;
- novo `06-abas-correr-voce.yaml`: aba Correr → Nova corrida; Você → Atividades;
- `config.yaml` e `README.md` atualizados.

## 7. Régua de texto (`node docs/melhoria/F1/ux/medir-texto.mjs --comparar antes`)

Atualizei a lista de telas da régua, que é ferramenta da E6 na F1:
- o onboarding mudou de arquivo;
- o passo de notificações saiu;
- entraram as telas novas;
- a lista de "ilustração" ganhou as peças da E4 (`TutorialArt`, `EmptyArt`, `TeamEmblem`, `StaticArt`).

| Tela | Palavras antes | Agora | Blocos longos | Imagem |
|---|---:|---:|---|---|
| (auth)/cadastro | 123 | **63** | 4 → **0** | sim |
| onboarding · 1 boas-vindas | 50 | **11** | 2 → **0** | sim |
| onboarding · 1b cidade dividida | — | 14 | 0 | sim |
| onboarding · 2 time | 22 | 30 | 1 → 0 | sim |
| onboarding · 2b quiz (3 perguntas + resultado somados) | — | 71 (≈ 18 por tela) | 0 | sim |
| onboarding · 2c confirmação | — | 4 | 0 | (o mascote vem por prop) |
| onboarding · 3 localização | 58 | **14** | 2 → **0** | sim |
| onboarding · 4 notificações | 49 | **saiu** | — | — |
| mapa · missão de boas-vindas | — | 17 | 0 | sim |
| (tabs)/correr | — | 4 | 0 | sim |
| (auth)/entrar | 26 | 28 (+ "Ver demonstração") | 0 | sim |
| indisponivel | 43 (onda 1) | 45 | 0 | — |

**Totais:**
- **Primeira abertura** (caminho principal, telas de jogo): **179 → 73 palavras**;
- **Telas de jogo, total:** média **77 → 60** palavras por tela, blocos longos **32 → 25**.

A régua ainda acusa `app/dev/arte.tsx` e `app/dev/motion.tsx` sem mapa (E4 e E5, onda 1).

## 8. Pendências, pedidos e riscos

**Pedidos:**
- **E10, `e2e-web` (pasta sua):** `demo-flow.cjs` e `auth-flow.cjs` usam os ids antigos. Trocar:
  - `tela-entrar` + `entrar-criar-conta` por `tela-boas-vindas` + `boas-vindas-comecar`;
  - tirar `cadastro-cidade` (o `auth-flow` testa a cidade no cadastro: passar o caso para "Editar perfil");
  - `cadastro-aceite-termos` e `cadastro-aceite-privacidade` por `cadastro-aceite`;
  - no lugar de `onboarding-escolher-time`, `onboarding-faccao-*`, `onboarding-faccao-continuar`,
    `onboarding-localizacao-continuar` e `onboarding-notificacoes-continuar`, usar:
    1. `onboarding-cidade-continuar` (opcional);
    2. `onboarding-times-<time>`;
    3. `onboarding-entrar-time`;
    4. `onboarding-confirmacao-continuar`;
    5. `onboarding-localizacao-permitir`.
  - O `capturas.cjs` já acha o selo do app (`[data-testid*="demonstracao"]`).
- **E6b (Mapa):** quando o card de missão da E7 entrar no Mapa, levar o `WelcomeMissionOverlay` para dentro da pilha
  de baixo do Mapa e tirá-lo do `(tabs)/_layout.tsx`. Hoje ele é posicionado por cálculo (`welcomeMissionBottom`),
  reservando o espaço do alerta mesmo quando não há alerta.
- **E7:**
  - montar `useReminderPlanner()` no `_layout` (ponto marcado);
  - pedir a permissão de notificação depois da 1ª conquista: o onboarding não pede mais;
  - stores novas com dados de pessoa entram no `resetStoresForDemoSwitch` (`session-controller.ts`).
- **E8:** o mesmo, para o store do feed.
- **E4:**
  - ícone PNG laranja da aba Correr (para o laranja aceso no nativo);
  - bustos dos líderes para a `LeaderSheet` (hoje vai o mascote).

**Riscos e notas:**
- **Tab bar do Android:** a altura (80 dp) é estimada (Material 3). Se a barra real for menor, o card só fica um pouco
  mais alto.
- **Aba Correr no nativo:**
  - não foi testada em aparelho;
  - `screenListeners.tabPress` + `JUMP_TO`: a corrida abre por cima e, ao fechar, a aba Correr fica selecionada,
    mostrando o botão grande.
- **Selo:** no alto e no centro, ele encosta no nome do time da pílula do Mapa (2 a 4 px). Não recebe toque.
- **Desempenho:** 4 mascotes animados no carrossel (qualidade `leve`). Medição no Android médio fica com a E10.
- **Cherry-pick `8307eb4` (E10):** autorizado pelo coordenador; é o 1º commit da branch depois da base, aqui com o hash
  `9abd345` (mesmo conteúdo, hash novo por causa do cherry-pick). No merge, o Git deve ver a mesma mudança dos dois
  lados.
- **Commits intermediários:** as verificações (typecheck, ESLint, Jest) rodaram no estado final e depois fiz 3
  commits de código em sequência (abas → primeira abertura → demonstração e layout), como na onda 1.
- **Arquivos fora da lista estrita**, mas da E6:
  - `app/atividades.tsx` (redirecionamento) e `components/app-tabs-{config,correr,redirect}.tsx`;
  - `docs/melhoria/F1/ux/medir-texto.mjs` (lista de telas).
- **Não mexi em:** `map-screen`, `run-screen`, `summary-screen`, `features/run`, `src/domain`. Em `src/services`, só
  li (o cherry-pick é da E10).
