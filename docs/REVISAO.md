# Revisão do projeto NOMADE RUN

> **Revisão nº 1 — 2026-10-21** (agente revisor-nomaderun, branch `main`, commit `1f92a5e`).
> Só revisão: nenhum código de produção foi alterado. Cada achado foi conferido no código ou com um comando.
> Contexto: backend de produção no Supabase Cloud (projeto `rbdxksunpfbaxkelnsob`), app publicado no EAS Update (branch `demo`); Docker e Supabase locais no ar para os testes.

## 1. O que foi verificado e resultado das suítes

| Suíte | Comando | Resultado |
|---|---|---|
| Tipos | `apps/mobile`: `npm run typecheck` | ✅ sem erros |
| Análise estática | `apps/mobile`: `./node_modules/.bin/eslint src` | ✅ 0 problemas |
| Testes do app + cobertura | `apps/mobile`: `npx jest --coverage` | ✅ 406 passaram, 26 ignorados (integração), 48 suítes. `src/domain`: 99,54% linhas · 99,59% ramos (limite de 90% ok) |
| Integração do app (backend local) | `NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon> npx jest integration --forceExit` | ✅ 26/26 (4 suítes) |
| Banco (pgTAP) | raiz: `npm run db:test:psql` | ✅ 285/285, 13 arquivos |
| Edge Functions (Deno) | raiz: `npm run functions:test` | ✅ 58 passaram, 1 ignorado de propósito ("plano B: cópia do domain") |
| Ponta a ponta | raiz: `npm run e2e` | ✅ 56/56 |
| Segurança adversarial | raiz: `STRICT=1 bash supabase/tests/security/run.sh` | ✅ 89/89, 0 achados (o limite de login dá 400, não 429, localmente: só vale no Cloud, P-09) |
| Playwright (web) | — | não rodado nesta revisão (exige export web; última rodada verde na T6.5/D-59) |
| Maestro / aparelho | — | não rodável aqui (sem aparelho). Tudo marcado "📱" abaixo só o iPhone/Android confirma |

Também foi feita leitura dirigida (CodeGraph + `rg`) de: brilhos neon (`textShadow`, `boxShadow`), elementos flutuantes nas telas de aba, cabeçalho grande do iOS e parallax, configuração do Auth e das functions, segredos no repositório, `app.json`, documentação de deploy e apresentação.

**Conferência pedida (casos parecidos com os do iPhone 15):**
- `textShadow`: sobrou **um** uso, o "RUN" do login/boas-vindas (`features/auth/hero-wordmark.tsx:47-53`), já com a caixa aumentada pelo tamanho do brilho e máscara com folga (`pad ≥ 22`). Parece correto no código; só o aparelho confirma 📱.
- **Brilho cortado em retângulo por outro motivo:** encontrado nos chips (achado M-1).
- **Elementos flutuantes em telas de aba:** só o mapa tem (alerta + "Correr" + controles), todos já com `tabBarClearance`. "Salvar alterações" do Editar perfil usa `safeBottom: false`. Nenhum outro CTA fixo em tela de aba.
- **Cabeçalho grande do iOS:** Clube, Arena, Crew, Atividades, Perfil e Conta usam `contentInsetAdjustmentBehavior="automatic"`; o parallax não amplia mais (`parallax-math.ts`). Resta um detalhe de suavidade (B-3).

## 2. Achados priorizados

### Alta

**A-1 — Contas de administrador e moderador com senha pública no backend de produção**
- **Onde:** `README.md:151-153` (senhas `Admin@2026demo`, `Moderacao@2026`, `Corrida@2026`); `supabase/seed.sql:303` e `:313` (papéis `moderator` e `admin`); `supabase/DEPLOY.md:34` ("Em produção real, não use"); `docs/PROGRESSO.md` (log de 2026-10-21: "seed de demonstração" enviado ao Cloud). O repositório `GabryelGomes/nomaderun` é **público** (conferido com `gh api`).
- **Por que importa:** qualquer pessoa que leia o README entra no app publicado como **administrador** e pode inativar contas (inclusive as da banca no dia), ou como moderador e rejeitar corridas. É o maior risco real do projeto hoje.
- **Como verificar:** `gh api repos/GabryelGomes/nomaderun --jq .visibility` → `public`; ler `README.md:151`. (Não foi feito login no Cloud com essas senhas, de propósito.)
- **Sugestão:** já no painel do Supabase Cloud, trocar as senhas das três contas `*.demo@nomaderun.app` (ou rebaixar `admin.demo` para `runner` e criar um admin com senha forte fora do repositório). No README, deixar as senhas só para o backend **local**. Avaliar deixar o repositório privado até a apresentação.
- **Esforço:** P.

**A-2 — O mapa sempre abre em Goiânia e mostra "você está aqui" num ponto fixo**
- **Onde:** `apps/mobile/src/features/screens/map-screen.tsx:31` (`MAP_CENTER` derivado de `DEMO_CENTER`), `:35` (área inicial), `:131` (`user={DEMO_CENTER}`); `src/demo/demo-data.ts:12`.
- **Por que importa:** com o app publicado, quem corre em outra cidade vê o mapa de Goiânia e o próprio ponto no Parque Flamboyant. As zonas que ele criar (RF-020: "zonas nascem em qualquer lugar") não aparecem ao abrir o app. E o ponto do usuário é um dado de demonstração **sem rótulo**, o que fere a regra do `CLAUDE.md`.
- **Como verificar:** abrir o mapa com o GPS em qualquer outro lugar; ou ler as linhas citadas.
- **Sugestão:** pedir a posição atual com `expo-location` (com a explicação de permissão que já existe) e centralizar nela; sem permissão ou sem fix, usar a última posição de corrida ou a cidade do perfil, e só então Goiânia com o rótulo "Demonstração: Goiânia". Não desenhar o ponto do usuário sem posição real.
- **Esforço:** M.

**A-3 — Publicar no EAS Update não é reproduzível e pode apontar o app de todos para `127.0.0.1`**
- **Onde:** não há `eas.json` nem `extra.eas.projectId`/`updates`/`runtimeVersion` no repositório (`apps/mobile/app.json`, `app.config.js`; `git status` limpo); `apps/mobile/.env` hoje aponta para `http://127.0.0.1:54321`; `scripts/dev-celular.sh` (via `npm run celular`) reescreve o `.env` com o IP local. O cuidado está só numa frase do log do `PROGRESSO.md`.
- **Por que importa:** o próximo `eas update` feito da máquina errada (ou depois de `npm run celular`) publica um app que não acha o servidor para **todos** que abrem a branch `demo`. Outra pessoa da equipe também não consegue publicar a partir do repositório.
- **Como verificar:** `ls apps/mobile/eas.json` (não existe); `grep SUPABASE_URL apps/mobile/.env` (127.0.0.1).
- **Sugestão:** versionar `eas.json` com um perfil `demo` cujo `env` define `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` do Cloud (são públicas), ou um script `npm run publicar` que confere a URL antes de chamar `eas update --branch demo --clear-cache`. Documentar no README e no `COMO_APRESENTAR.md`.
- **Esforço:** P.

### Média

**M-1 — Brilho dos chips selecionados cortado em faixa reta no iOS (mesma família do "retângulo")**
- **Onde:** `apps/mobile/src/components/chip-row.tsx:55` (brilho de 14 px) dentro de `ScrollView` horizontal com `paddingVertical: 4` (`:115`); `src/features/screens/map-layer-chips.tsx:55` com `paddingVertical: 4` (`:31`).
- **Por que importa:** a `ScrollView` do iOS sempre recorta o que passa das bordas (`clipsToBounds`). O brilho de 14 px só tem 4 px de folga em cima e embaixo: aparece cortado em linhas retas, um retângulo laranja em volta do chip. Afeta os filtros do Clube, período em Atividades, ritmo da Fuga e as camadas do mapa.
- **Como verificar:** 📱 iPhone → Clube → selecionar um filtro; olhar acima e abaixo do chip. No navegador não aparece, porque o recorte ali é só horizontal.
- **Sugestão:** `paddingVertical` ≥ 14–16 na `contentContainerStyle`, com `marginVertical` negativo igual na `ScrollView` para não mudar o layout (o mesmo truque do `hero-wordmark`); ou diminuir o brilho para 4 px nesses chips.
- **Esforço:** P.

**M-2 — Contraste dos botões laranja piorou com o neon: 2,87:1 (QA-22)**
- **Onde:** `apps/mobile/src/theme/tokens.ts:52-53` (tema escuro: `action #FF6A13` com `onAction` branco); `components/button.tsx`.
- **Por que importa:** o QA-22 mediu 3,12:1 com o laranja antigo. Com o laranja neon (D-59) o rótulo branco caiu para **2,87:1** (cálculo WCAG feito nesta revisão), longe do 4,5:1 do RNF-011. É o botão mais importante do app ("Correr", "Começar", "Entrar").
- **Como verificar:** contraste de `#FFFFFF` sobre `#FF6A13` = 2,87; `#070708` sobre `#FF6A13` = 7,02.
- **Sugestão:** a decisão é dos autores (P-44). O caminho mais barato: texto quase preto (`neon.bg`) sobre laranja, 7,02:1, comum em temas neon. Registrar como D-xx.
- **Esforço:** P (código) + decisão.

**M-3 — Documentação diz coisas que não valem mais**
- **Onde e o quê:**
  - `docs/REQUISITOS.md:71` (RNF-010): "tema e mapa seguem o modo do sistema (`userInterfaceStyle: automatic`)". Hoje o app é **sempre escuro** (`app.json`: `"userInterfaceStyle": "dark"`, D-59). O status ✅ também precisa ser revisto (o ERS pede claro/escuro), já previsto como desvio na proposta de ERS v1.1.
  - `docs/REQUISITOS.md:72` (RNF-011): "Falta: corrigir QA-18/19". Já corrigidos (log de 2026-10-21).
  - `docs/PROGRESSO.md`, "Estado atual": ainda pede "deploy no Cloud (P-08)", que foi fechado, e mostra 398 testes (hoje são 406).
  - `docs/COMO_APRESENTAR.md:13-14` e `README.md`: não citam o caminho que existe hoje (app pelo EAS Update + backend no Cloud, sem notebook); a opção B ainda diz "Precisa de conta no Supabase (P-08)".
  - `apps/mobile/src/services/api/activities-repo.ts:109`: comentário "O servidor ainda não grava baús (P-12): hoje volta vazio". Desatualizado (P-28).
  - `REQUISITOS.md`, `ARQUITETURA.md` e várias entradas do log têm data 2026-10-22, depois das entradas de 2026-10-21 que estão acima delas.
- **Por que importa:** a banca e a própria equipe leem esses documentos; o guia de apresentação é o roteiro do dia.
- **Sugestão:** fechar a T6.6 (docs e fechamento) com esses pontos; acrescentar a "Opção C: app publicado + Cloud" no `COMO_APRESENTAR.md`.
- **Esforço:** P.

**M-4 — Limite de login de 3 por 5 minutos por IP no Cloud, com o app já público**
- **Onde:** `supabase/config.toml:215` (`sign_in_sign_ups = 3`), P-09/P-34.
- **Por que importa:** na sala, todos os celulares no mesmo Wi-Fi saem pelo mesmo IP. Três entradas ou cadastros em 5 minutos e o resto da turma ou da banca recebe erro. Com o app publicado, isso já vale hoje, não só no dia.
- **Como verificar:** 4 logins seguidos no Cloud pela mesma rede (não feito aqui).
- **Sugestão:** seguir o `DEPLOY.md` §3 (30 por 5 min) antes de qualquer teste em grupo, e voltar depois; deixar o lembrete no checklist do dia.
- **Esforço:** P.

### Baixa

**B-1 — QA-20 continua aberto: o alerta do mapa corta "pontos em dobro"** — `map-screen.tsx:214` (`numberOfLines={1}`). Sugestão: trocar para "Defenda: pontos em dobro" na 2ª linha e deixar o nome do time atacante na folha da zona. P.

**B-2 — QA-23, QA-24 e QA-25 ainda abertos** (notificações em 360 pt, "(você)" cortado no ranking, links de 20 pt no cadastro). Conferidos como não alterados desde a T6.5 (`QA.md` §14). P cada.

**B-3 — Parallax de Clube/Arena só começa depois que o conteúdo já passou por baixo do cabeçalho** — `components/motion/parallax-math.ts:12` usa o `contentOffset.y` cru, que no iOS começa em cerca de −150 pt com o título grande. O card só esmaece quando `y > 0`, ou seja, depois de rolar cerca de 150 pt. Não quebra nada (o bug grave foi corrigido). Sugestão: guardar o primeiro `contentOffset.y` recebido (posição de repouso) e calcular o parallax a partir dele, para que o zero seja o topo visível. Não confiar no `contentInset` do evento: com o ajuste automático do iOS ele pode não incluir o cabeçalho. P. 📱

**B-4 — Brilho da barra de progresso com `overflow: 'hidden'` na mesma view** — `features/screens/game-motion.tsx:46`. Na web o brilho aparece; no iOS, conferir se a sombra externa não é recortada junto com o preenchimento. Se for, mover o `boxShadow` para uma view externa sem recorte. P. 📱

**B-5 — Cores soltas fora dos tokens** — `map-layer-chips.tsx:52` (`#2A1609` em vez de `neon.activeFill`, diferente do `Chip`); `territory-map.tsx:150` e `territory-map.web.tsx:128` (halo do usuário `rgba(255,90,31,…)`, o laranja antigo, não o neon `#FF6A13`); `run-screen.tsx:454/457` e `button.tsx:34/100` (`#FFFFFF` direto). P.

**B-6 — Night Owls vermelho quase igual à cor de perigo** — `tokens.ts:66` (`#D7263D`) contra `danger` `#D92D20` (claro) e `#FF4D45` (escuro). Em zonas "sob ataque", SOS e erros, o vermelho deixa de ser só "perigo". As formas por time (losango) ajudam. Sugestão: conferir com os autores se o alerta de ataque deve usar outro sinal além da cor. P (decisão).

## 3. Melhorias sugeridas (não são bugs)

| Ideia | Ganho esperado |
|---|---|
| Botão "Minha posição" no mapa (junto de A-2) | Usuário se encontra no mapa; demo em outra cidade funciona sem explicação |
| Teste de unidade que falha se um `boxShadow` estiver dentro de `ScrollView` horizontal sem folga vertical (análise estática, no estilo do `testids.test.ts`) | Evita novos "brilhos em retângulo" que só aparecem no iPhone |
| CI simples no GitHub Actions (typecheck, eslint, `npm test`, `functions:test`) | Fecha o "Falta" do RNF-008 com pouco esforço; a banca vê o selo verde |
| Script `npm run publicar` (ver A-3) que também roda `typecheck` e `npm test` antes do `eas update` | Nenhuma publicação quebrada para quem está com o app aberto |
| Tela "Trocar de facção" usando o RPC `choose_faction` que já existe | Fecha o 🟡 do RF-003 (P0) só com uma tela |
| Parciais por km no resumo (os pontos já estão no `record.path`) | Avança o RF-006 (P0) com pouco código |
| Rodar o Playwright de imagem também no tema neon atual e guardar as capturas por versão | Detecta mudança visual sem querer (D-15) |

## 4. Status dos achados da revisão anterior

Primeira revisão: não havia `docs/REVISAO.md`. Situação das pendências de QA relacionadas, conferida no código:

| Item | Status |
|---|---|
| QA-18, QA-19 (faixa de território) | ✅ corrigidos (`banner-color.ts`; teste `banner-color.test.ts` passa) |
| Parallax ampliado no Clube/Arena | ✅ corrigido (`parallax-math.ts`; resta o ajuste fino B-3) |
| "Correr"/"Salvar alterações" atrás da barra de abas | ✅ corrigido (`tabBarClearance`, teste `tab-bar-clearance.test.ts`) |
| Brilho em retângulo nos números do resumo | ✅ corrigido (sem `textShadow` em `summary-screen.tsx` e `capture-celebration.tsx`); restou o caso dos chips (M-1) |
| QA-20, QA-23, QA-24, QA-25 | ⬜ abertos (B-1, B-2) |
| QA-21, QA-22 | ⬜ dependem de decisão; QA-22 piorou com o neon (M-2) |

## 5. Próximos passos recomendados (em ordem)

1. **Hoje, no painel do Cloud:** trocar as senhas das contas de demonstração, principalmente `admin.demo` e `moderador.demo` (A-1). Tirar as senhas do README ou marcá-las como "só no backend local".
2. Versionar `eas.json`/script de publicação com a URL do Cloud e documentar o fluxo de `eas update` (A-3).
3. Centralizar o mapa na posição real do usuário, com Goiânia rotulada como demonstração só como reserva (A-2).
4. Folga vertical para o brilho dos chips (M-1) e decisão sobre o texto dos botões laranja (M-2), depois conferir no iPhone 15 junto do checklist `QA.md` §14.7 (P-45).
5. Subir o limite de login no Cloud antes de qualquer teste em grupo (M-4).
6. Fechar a T6.6 corrigindo os documentos de M-3 e registrando a "Opção C" no guia de apresentação.
7. Baixa: QA-20/23/24/25, B-3 a B-6.
8. Ao terminar cada rodada de testes locais: `npx supabase db reset` e esperar ~15 s (P-22).
