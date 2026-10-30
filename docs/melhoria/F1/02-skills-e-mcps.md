# F1 — E2 Skills e MCPs

**Equipe:** E2 — Skills e MCPs · **Fase:** F1 (descoberta) · **Data:** 2026-10-23
**Requisito atendido:** R12 (skills pelo método find-skills, motion.dev e MCPs).
**Escopo de escrita usado:** `.claude/skills/<novas pastas>/`, seção nova no fim de `.agents/skills/SOURCES.md`, este relatório e `docs/melhoria/F1/skills/`. Nenhum arquivo do app foi alterado; nada foi instalado no app.

---

## 1. Resumo

- **20 skills novas em `.claude/skills/`:** 14 vindas de fora e 6 "promovidas" de `.agents/skills`. O Claude Code só carrega `.claude/skills`, e antes as 55 skills de `.agents/skills` ficavam invisíveis para as equipes.
- **Prioridades do dono:**
  - design e animação: Software Mansion (Reanimated 4 e SVG), game feel, Impeccable (deleite e onboarding);
  - gamificação e retenção: balanceamento, mecânicas, revisão ética, ativação e retenção do Lenny;
  - social: indicação e boca a boca;
  - ilustração: Lottie a partir de SVG.
- **Expo Go SDK 57:**
  - **Vêm no Expo Go:** Skia 2.6.2, Lottie 7.3.8, view-shot, expo-audio, expo-blur, expo-linear-gradient, react-native-svg 15.15.4, Gesture Handler 2.32.0 e Reanimated 4.5.1. Confirmei no código-fonte do Expo Go (branch `sdk-57`) e nas páginas da documentação v57.
  - **Não vêm:** Rive, `react-native-share` (Stories direto), Pulsar e WebGPU.
- **Três achados críticos:**
  1. O Expo Go embute o **view-shot 4.0.3**, mas o `npx expo install` instala o **5.1.0**. As versões não batem.
  2. **Push remoto não funciona no Expo Go Android** desde o SDK 53. Notificação local funciona.
  3. As animações CSS do Reanimated **ignoram "Reduzir movimento"**.
- **MCPs:**
  - ligados: Whimsical, Vercel (há **dois** conectores Vercel), GitHub e Google Drive;
  - Figma falhou: o proxy recusou o túnel (403);
  - recomendados: Expo, Supabase (só leitura), Mobbin e Figma.
- **motion.dev:** é biblioteca só web. O MCP do AI Kit dá acesso grátis à documentação, mas os exemplos premium exigem Motion+ (pago). Os MCPs da comunidade estão parados. Para o app, a recomendação é traduzir os princípios para o Reanimated 4 (tabela na seção 6).

---

## 2. Método (find-skills adaptado ao ambiente)

1. **Ranking e busca:** o skills.sh e o `npx skills find` estão bloqueados no proxy. Usei WebSearch (`skills.sh <tema>`, `github SKILL.md <tema>`) e os agregadores Skillselion, VibeIndex e Tessl para ver installs e auditorias.
2. **Download:** `git clone --depth 1 --filter=blob:none`, um repositório por pasta vazia em `scratchpad/f1-skills/dl-<dono>_<repo>/`. Baixei 18 repositórios.
3. **Verificação:**
   - li cada `SKILL.md` inteiro;
   - fiz uma varredura de `curl|sh`, download de binário, pedidos de segredo e frases de prompt injection;
   - conferi licença, data do último commit e dono.
4. **Instalação:** só pastas novas, com `SKILL.md`, até 3 referências e o `LICENSE` original. Onde precisei, pus uma **nota NOMADE** curta no topo (versões do app, React Compiler, Expo Go). Nas cópias da Software Mansion, troquei o `name` para não colidir com outras skills.
5. **Registro:** `.agents/skills/SOURCES.md`, seção "Fase 7 — Reformulação v2", com repositório, URL raw, licença, installs e comando `npx skills add` de cada skill.

**Expo Go:** `docs.expo.dev` também está bloqueado (DNS). Confirmei pelo **código-fonte da documentação v57** (`expo/expo`, `docs/pages/versions/v57.0.0/sdk/*.mdx`: campos `platforms` e `inExpoGo`) e pelo **código do próprio Expo Go** no branch `sdk-57` (`apps/expo-go/package.json` e `apps/expo-go/ios/Podfile.lock`). Os commits consultados foram `a33ffd0` (main, 2026-10-23) e `1797e5d` (sdk-57, 2026-10-23).

---

## 3. Skills por frente

**Legenda:** 🆕 instalada agora; ⬆️ promovida de `.agents/skills`; ✔️ já estava em `.claude/skills`. As três regras são as mais úteis para o NOMADE.

### E3 — Game design e território

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `game-balance-economy` | [lvtd-llc/skills](https://github.com/lvtd-llc/skills/tree/main/skills/game-balance-economy) · MIT | Rebalancear pontos de território, teto diário, decaimento e bônus | 1) Comece pela **intenção** ("o que o número deve fazer a pessoa sentir"). 2) Todo recurso tem **fonte e sumidouro**: os pontos de território que só entram viram inflação. 3) Procure o **líder que dispara** (quem domina cedo não pode decidir a temporada) e a estratégia dominante. |
| 🆕 `game-mechanics-design` | [lvtd-llc/skills](https://github.com/lvtd-llc/skills/tree/main/skills/game-mechanics-design) · MIT | Especificar a regra nova de conquista (R3) | 1) Nomeie a mecânica com um verbo do jogador e uma promessa de 1 frase (casa com "explicável em 1 frase"). 2) Liste 3 dinâmicas desejadas e 3 indesejadas antes de codar. 3) Regras como dados, simulação determinística com semente, cenários de teste antes do polimento. |
| ⬆️ `gamification-loops` | omer-metin/skills-for-antigravity | Pontos, medalhas, sequências, barras de progresso | 1) "Isso ajuda a pessoa?" vem antes de "isso aumenta o número?". 2) Use `references/sharp_edges.md` para diagnosticar vício e cansaço. 3) Valide com `references/validations.md`. |
| ✔️ `property-based-testing` | trailofbits | Simular e balancear com propriedades (fast-check) | Teste invariantes ("pontos nunca negativos", "teto diário respeitado") em vez de exemplos. |

### E4 — Direção de arte (ilustração, mascotes, chefões)

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `swm-rn-svg` | [software-mansion-labs/skills](https://github.com/software-mansion-labs/skills/tree/main/skills/react-native-best-practices/references/svg) · MIT | Quem mantém o `react-native-svg` diz quando usá-lo | 1) SVG estático grande → `expo-image` (ou Skia), não `react-native-svg`: cada elemento vira uma view nativa. 2) Anime partes com `Animated.createAnimatedComponent(Path)` e faça as conversões dentro do `useAnimatedProps`. 3) Animação vetorial sem controle por parte → Lottie (Rive não roda no Expo Go). |
| 🆕 `text-to-lottie` | [diffusionstudio/lottie](https://github.com/diffusionstudio/lottie) · MIT · ~7,7K installs | Transformar SVG de mascote, baú ou medalha em Lottie sem After Effects | 1) Defina antes se o fundo é transparente (ícones e mascotes: sim). 2) Easing por comportamento, nunca linear. 3) Verifique os quadros 0, meio e `op-1` no player Skottie, que roda **fora** do repositório. |
| ⬆️ `motion-design` | lottiefiles/motion-design-skill · MIT | Personalidade e coreografia das animações dos personagens | 1) Nunca linear em movimento espacial. 2) Mudança importante nunca só com opacidade: junte posição ou escala. 3) Três camadas: primária, secundária e ambiente (respiração ou flutuação do mascote parado). |
| 🆕 `impeccable-refs` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) · Apache-2.0 (derivada) | `delight.md` para dar caráter sem "fofura genérica" | 1) O deleite nasce do mundo do produto (corrida, rua, time), não de um catálogo pronto. 2) Celebração proporcional à frequência. 3) Nunca bloqueia a tarefa; som só com consentimento. |
| ✔️ `mobile-app-ui-design` | — | Telas e componentes | — |

**Lacuna:** não há skill confiável de **personagem/mascote em SVG para React Native** (seção 8). Proponho a E4 criar a skill de projeto `nomade-arte` (T7.E2.3).

### E5 — Motion e feedback

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `swm-rn-animations` | [software-mansion-labs/skills](https://github.com/software-mansion-labs/skills/tree/main/skills/react-native-best-practices/references/animations) · MIT | Guia oficial de quem faz o Reanimated, com tabela de recursos por versão | 1) **Nunca `runOnJS`**: use `scheduleOnRN` do `react-native-worklets`. 2) **CSS animations/transitions ignoram "Reduzir movimento"**: leia `useReducedMotion()` e use duração 1 ms (não 0). 3) Confira a versão: callbacks CSS (`onCSS*`) são da 4.6 e **não existem na 4.5.1**; `:active` e CSS em SVG existem. |
| 🆕 `game-feel` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/game-feel) · Apache-2.0 | O "juice" das conquistas, do dano no chefão e da abertura de baú | 1) Um bom impacto = **5–8 respostas pequenas em ~100 ms** (som, partícula, flash, número, vibração). 2) **Três níveis** (pequeno/médio/grande), cada evento num nível: casa com a seção 11. 3) Exagerar **por pouco tempo** e voltar ao repouso; nunca bloquear o toque. |
| ⬆️ `react-native-reanimated` | registrada em SOURCES | Referência da API 4.x (já cita o SDK 57: Reanimated 4.5, Worklets 0.10, GH 2.32) | 1) Plugin `react-native-worklets/plugin` por último no Babel. 2) `scheduleOnRN` no lugar de `runOnJS`. 3) `Gesture.Pan()` (API v2) é a que o SDK 57 instala. |
| ⬆️ `expo-animation` | expo/skills · MIT | Ordem de decisão: animar? por quê? qual thread? | 1) Animar só `transform`/`opacity`. 2) **Nunca `scale(0)`**: comece em 0,9–0,97 com opacidade 0. 3) **Nunca animar a intensidade do `BlurView`** (Android redesenha). Reduzir movimento entra junto com a animação. |
| ⬆️ `react-native-skia` | registrada em SOURCES | Partículas, brilho neon, confete, card de imagem | 1) Passe shared values direto nas props de desenho; não embrulhe nós Skia com `createAnimatedComponent`. 2) Pare loops decorativos ao desmontar ou sair da tela. 3) O rótulo do Canvas não expõe as formas: espelhe as áreas de toque com controles nativos acessíveis. |
| ⬆️ `emil-design-eng` | emilkowalski/skills · MIT | Polimento de microinterações | 1) Toque no botão: 100–160 ms. 2) Nunca ease-in em UI. 3) Ação repetida centenas de vezes não anima. |

### E6 — UX das telas

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `ux-writing` | [content-designer/ux-writing-skill](https://github.com/content-designer/ux-writing-skill) · MIT · ~1,3K | P1/P12: menos texto, português claro | 1) Botão = **[Verbo] [objeto]**, 2–4 palavras ("Correr agora"). 2) Erro = **[o que falhou]. [por quê]. [o que fazer].** 3) Permissão = **[benefício]. [permissão].** ("Pinte sua rua no mapa. Permitir localização.") Frase com até 14 palavras (90% de compreensão). |
| 🆕 `impeccable-refs` | Apache-2.0 | `onboard.md` (FTUE e estados vazios) e `audit.native.md` (nota 0–4 por tela) | 1) Levar ao momento "aha" (primeira zona pintada) o quanto antes. 2) Estado vazio = o que vai aparecer + por que importa + 1 ação + ilustração. 3) Auditoria nativa em 5 dimensões, só documenta (antes/depois comparável). |
| 🆕 `mobile-accessibility` | [community-access/accessibility-agents](https://github.com/community-access/accessibility-agents/tree/main/skills/mobile-accessibility) · MIT | P8 | 1) Alvos de 44 pt (iOS) e 48 dp (Android). 2) `accessibilityLiveRegion`/`aria-live` para placares e avisos durante a corrida. 3) Mover o foco do leitor de tela ao abrir modal ou folha. |
| ⬆️ `emil-design-eng` | — | Ver E5 | — |
| ✔️ `expo-native-ui`, `expo-router`, `mobile-app-ui-design` | — | Base | — |

### E7 — Engajamento e retenção

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `user-onboarding-activation` | [RefoundAI/lenny-skills](https://github.com/RefoundAI/lenny-skills/tree/main/skills/user-onboarding-activation) · MIT · ~280 | FTUE (R10) | 1) Sucesso nos **primeiros 30 s**: pessoa "preguiçosa, vaidosa e egoísta". 2) Leve a **uma** ação de alto valor (missão "corra 500 m"). 3) No celular, **cada toque é um milagre**: corte passos. |
| 🆕 `retention-engagement` | lenny-skills · MIT | Loops de volta (seção 13) | 1) Meça a **curva de sobrevivência** por coorte (D1/D7/D30), não "aberturas". 2) Produto que fica melhor com o uso ("valor acumulado": zonas, histórico, medalhas). 3) Sequência é a maior alavanca do Duolingo, **mas** só entra com proteção (ver abaixo). |
| 🆕 `game-responsibility-review` | [lvtd-llc/skills](https://github.com/lvtd-llc/skills/tree/main/skills/game-responsibility-review) · MIT | Ética (X1, seção 5.4) | 1) Liste as pressões: sequência, recompensa diária, FOMO, recompensa variável, notificação, comparação social. 2) Classifique Blocker/High/Medium/Low e defina **portões de lançamento**. 3) Dê controle à pessoa (notificações, intensidade); recuperar de falha sem coerção. |
| ⬆️ `gamification-loops` | — | Ver E3 | — |

### E8 — Social e compartilhamento

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `referrals-word-of-mouth` | lenny-skills · MIT | Card do Instagram, convites | 1) Indicação só **acelera** um boca a boca que já existe: o card tem que ser bonito por si. 2) Ponha o convite e o compartilhamento **no pico de satisfação** (fim da corrida, conquista), não nas configurações. 3) Recompensa só depois da **ativação** do convidado (1ª corrida). |
| ⬆️ `react-native-skia` | — | Alternativa de captura (`makeImageSnapshot`) se o view-shot falhar | — |
| (lacuna) | — | Nenhuma skill de card para Stories em RN/Expo | Ver seção 8 |

### E9 — Backend

| Skill | Situação |
|---|---|
| ✔️ `supabase`, `supabase-postgres-best-practices` | Já cobrem migrações, RLS, Edge Functions, pg_cron. Não achei complemento melhor. Os mapas de calor já têm `mapbox-data-visualization-patterns` em `.agents/skills`. |

### E10 — Qualidade e plataforma

| Skill | Origem · licença | Por quê | 3 regras mais úteis |
|---|---|---|---|
| 🆕 `visual-testing` | [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills/tree/main/skills/visual-testing) · MIT | Capturas antes/depois com o modo demonstração (X3) | 1) `toHaveScreenshot({ animations: 'disabled' })` e esperar o conteúdo, nunca `waitForTimeout`. 2) **Mascarar ou congelar** relógio, datas, avatares e mapa. 3) Limiar por componente (0 px em ícones; ~0,5% em tela cheia) e diffs como artefatos do CI. |
| 🆕 `mobile-accessibility` | — | Ver E6 | — |
| 🆕 `impeccable-refs` (`audit.native.md`) | — | Nota 0–4 por tela | — |
| ✔️ `webapp-testing`, `property-based-testing`, `sharp-edges`, `differential-review`, `react-native-best-practices` (Callstack, desempenho) | — | Base | — |

### Todas as equipes

- `game-feel`, `ux-writing` e `game-responsibility-review` valem como **checklists transversais**.
- O cartão rápido "qual skill cada equipe chama" está em `docs/melhoria/F1/skills/cartao-por-equipe.md`.

---

## 4. Expo Go SDK 57: o que vem nele

### 4.1 Fontes consultadas

- **[D] Documentação v57** (código-fonte): `docs/pages/versions/v57.0.0/sdk/<lib>.mdx` em https://github.com/expo/expo/tree/main/docs/pages/versions/v57.0.0/sdk (versão publicada: `https://docs.expo.dev/versions/v57.0.0/sdk/<lib>/`). O campo `platforms` inclui `'expo-go'` e as libs de terceiros trazem `inExpoGo: true`.
- **[G] Código do Expo Go SDK 57:**
  - dependências: https://github.com/expo/expo/blob/sdk-57/apps/expo-go/package.json
  - versões nativas iOS: https://github.com/expo/expo/blob/sdk-57/apps/expo-go/ios/Podfile.lock
- **[B] Versões do `npx expo install`:** https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json. É a mesma coisa que `apps/mobile/node_modules/expo/bundledNativeModules.json`, expo 57.0.27.

### 4.2 Tabela

| Biblioteca | `npx expo install` instala [B] | Expo Go SDK 57 traz [G] | Documentação v57 [D] | **Vem no Expo Go?** | Já no app? |
|---|---|---|---|---|---|
| `@shopify/react-native-skia` | 2.6.2 | 2.6.2 (pod `react-native-skia (2.6.2)`) | `expo-go`, `inExpoGo: true` (`skia.mdx`) | **Sim** | Não |
| `lottie-react-native` | ~7.3.8 | 7.3.8 (pods `lottie-react-native (7.3.8)` e `lottie-ios (4.6.0)`; Android `com.airbnb.android:lottie:6.5.2`) | **Não há página** `lottie.mdx` nas versões v54–v57 | **Sim, pelo código do Expo Go** (a documentação não confirma) | Não |
| `react-native-view-shot` | **5.1.0** | **4.0.3** (fork local `apps/expo-go/modules/react-native-view-shot`) | `expo-go`, `inExpoGo: true` (`captureRef.mdx`) | **Sim, com versão diferente** (risco R1) | Não |
| `expo-audio` | ~57.0.5 | 57.0.5 | `expo-go` (`audio.mdx`) | **Sim** | Não |
| `expo-blur` | ~57.0.3 | 57.0.3 | `expo-go` (`blur-view.mdx`) | **Sim** (não animar a intensidade no Android) | Não |
| `expo-linear-gradient` | ~57.0.2 | 57.0.2 | `expo-go` (`linear-gradient.mdx`) | **Sim** | Não |
| `react-native-svg` | 15.15.4 | 15.15.4 | `expo-go`, `inExpoGo: true` | **Sim** | Sim (15.15.4) |
| `react-native-gesture-handler` | ~2.32.0 | 2.32.0 | `expo-go`, `inExpoGo: true` | **Sim** (API v2) | Sim |
| `react-native-reanimated` | 4.5.1 | 4.5.1 | `expo-go`, `inExpoGo: true` | **Sim** | Sim |
| `react-native-worklets` | 0.10.1 | 0.10.1 | — | **Sim** | Sim |
| `expo-haptics` | ~57.0.3 | 57.0.3 | `platforms` **sem** a tag `expo-go` (`haptics.mdx`) | **Sim, pelo código** (e o app já usa) | Sim |
| `expo-sharing` | ~57.0.22 | 57.0.24 | `expo-go` | **Sim** | Sim |
| `expo-image` | ~57.0.5 | 57.0.5 | `expo-go` | **Sim** | Sim |
| `expo-glass-effect` | ~57.0.4 | 57.0.4 | `ios`, `expo-go`; só iOS 26+ (cai para `View`) | **Sim** (só iOS) | Sim |
| `expo-mesh-gradient` | ~57.0.2 | 57.0.2 | `expo-go` | **Sim** | Não |
| `@react-native-masked-view/masked-view` | 0.3.2 | 0.3.2 | `inExpoGo: true` | **Sim** (máscaras de brilho e texto em gradiente) | Não |
| `expo-media-library` | — | 57.0.5 | `expo-go` | **Sim** (salvar o card na galeria) | Não |
| `expo-notifications` | ~57.0.22 | 57.0.24 | `platforms: ['android','ios']` + aviso | **Parcial:** local sim; **push remoto não, no Android, desde o SDK 53** | Sim (só local) |
| Rive (`@rive-app/react-native`) | — | ausente | — | **Não** (exige development build: https://rive.app/docs/runtimes/react-native/adding-rive-to-expo) | — |
| `react-native-share` (Stories direto) | — | ausente | — | **Não** | — |
| `react-native-pulsar` (hápticos SWM) | — | ausente | — | **Não** | — |
| `react-native-wgpu` / TypeGPU | — | ausente | a skill SWM diz "Expo Go is not supported" | **Não** | — |

**Comando** (F3, só com aprovação do coordenador, porque mexe em `package.json`): `npx expo install @shopify/react-native-skia lottie-react-native react-native-view-shot expo-audio expo-blur expo-linear-gradient` (use `EXPO_OFFLINE=1` se a API da Expo estiver bloqueada). As versões resultantes devem bater com a coluna [B].

### 4.3 Observações

- **view-shot (R1):** o JavaScript 5.1.0 conversaria com o nativo 4.0.3 do Expo Go. A API `captureRef` é a mesma desde a 4.0 e as duas usam TurboModule. Mesmo assim, **é obrigatório um teste real no Expo Go Android e iOS** antes de construir o card (T7.E2.1). Plano B: `makeImageSnapshot` do Skia, que é nativo do Expo Go na versão exata.
- **Skia na web:** precisa carregar o CanvasKit (WASM, alguns MB). Isso afeta a prévia na Vercel e o modo demonstração na web. Use Skia só onde houver ganho claro e tenha uma alternativa web (SVG ou estático).
- **Lottie na web:** `lottie-react-native` 7.3.8 declara `@lottiefiles/dotlottie-react` (^0.13.5) como dependência par **opcional**, usada na web (`npm view lottie-react-native@7.3.8 peerDependencies`). Sem ela, a animação não aparece no export web. A E10 deve confirmar no export.
- **Push:** o re-engajamento da E7 deve usar **notificação local agendada** e avisos dentro do app. O push remoto exige development build, o que contradiz a distribuição pelo Expo Go.

---

## 5. MCPs

### 5.1 Já ligados na conta

| MCP | Estado nesta sessão | Uso por equipe |
|---|---|---|
| **Whimsical** (workspace "gabryel") | Ligado | **E6:** wireframes de cada tela antes/depois (exige `how_to('wireframe')`). **E3:** fluxograma da regra nova de território. **E7:** diagramas dos loops (diário, semanal, temporada). **E1:** mapa da jornada em 6 momentos. **Coordenador:** quadro do plano mestre. Ver o resultado com `fetch({image:true})`. |
| **Vercel** | Ligado, **com dois conectores** (`Vercel` e `Vercel-852190fe`) | **E10/coordenador:** prévia web (X4) a partir do `npx expo export -p web`; logs de execução; proteção da prévia. Decidir qual conector fica (decisão D5). |
| **GitHub** | Ligado | **E10:** ver execuções e logs do CI (X5). **Coordenador:** PR, revisão e busca de código de referência em projetos abertos. O acesso a outros repositórios depende de `add_repo`. |
| **Google Drive** | Ligado | **E1/coordenador:** ler documentos do TCC (ERS, apresentação) e publicar a apresentação final. Nunca subir segredos ou dados pessoais. |
| Claude Docs | Ligado | Opcional para documentos compartilháveis do coordenador. |
| **Figma** (plugin) | **Falhou:** proxy recusou o túnel (403) | Sem uso até o dono liberar. As skills `figma:*` existem, mas dependem do servidor. |
| codegraph (projeto) | Habilitado no `.claude/settings.json` | Todas as equipes: mapa de símbolos e impacto (regra do `CLAUDE.md`). |

### 5.2 Recomendados para o dono ligar

| MCP | Endereço oficial | Ganho | Custo e cuidados |
|---|---|---|---|
| **Expo** | `https://mcp.expo.dev/mcp` (HTTP + OAuth). Docs: https://docs.expo.dev/eas/ai/mcp · blog: https://expo.dev/blog/become-an-ai-native-developer-with-the-expo-mcp-server | **Prioridade 1.** Consulta a documentação da Expo de dentro da sessão (aqui o `docs.expo.dev` está bloqueado), orienta instalação de pacotes e acompanha EAS Update/Build. As capacidades locais (capturas e automação do simulador) exigem o pacote `expo-mcp` e SDK 54+. | Lançado para planos pagos em 2025; segundo um artigo de terceiros, aberto ao plano Free com cota mensal em maio/2026 (não confirmei na fonte oficial). O host pode ser bloqueado pelo proxy, como o Figma. **Não** instalar `expo-mcp` no app sem decisão do coordenador. |
| **Supabase** | `https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true` · https://github.com/supabase/mcp | **E9:** ler esquema, logs e advisors do projeto na nuvem; conferir RLS e o estado das migrações (X7, compatibilidade com o servidor que já está no ar). | **Sempre `read_only=true` e `project_ref`** (sem isso alcança todos os projetos da organização). Migrações continuam pelo CLI e por revisão. |
| **Mobbin** | `https://api.mobbin.com/mcp` (HTTP + OAuth, sem chave) · https://github.com/mobbin/mobbin-mcp-server · docs: https://docs.mobbin.com/mcp/clients/overview | **E1/E6/E8:** telas reais de referência (Strava, Duolingo, Pokémon GO, Nike Run Club) para onboarding, fim de corrida e compartilhamento. | Plano e preço **não confirmados** (o README não diz). Usar como referência, nunca copiar a tela. |
| **Figma** | `https://mcp.figma.com/mcp` ou o plugin `claude plugin install figma@claude-plugins-official` · https://developers.figma.com/docs/figma-mcp-server/remote-server-installation | **E4/E6:** ler frames e tokens (se o dono desenhar no Figma); gerar telas a partir do código para revisão visual. | Hoje dá **403 no proxy**: o dono precisa liberar o host na rede do ambiente. Grátis durante o beta; vai virar recurso pago por uso (https://help.figma.com/hc/en-us/articles/32132100833559). |

---

## 6. motion.dev

| Pergunta | Resposta |
|---|---|
| Roda no app? | **Não.** Motion (`motion`/`framer-motion`) é biblioteca de DOM. O app é React Native: no celular quem anima é o Reanimated 4.5 (seção 16.3 do prompt mestre). |
| Na versão web do app? | Tecnicamente daria em arquivos `.web.tsx`, mas **não recomendo**: duas implementações de cada animação dobram o custo e quebram a paridade. Na web, o Reanimated 4 já roda (CSS animations via react-native-web). |
| Na apresentação do TCC e numa página de divulgação? | **Sim.** Slides HTML (`frontend-slides`/`slides` em `.agents/skills`) ou uma página na Vercel podem usar Motion de verdade. |
| AI Kit oficial | Página: https://motion.dev/docs/ai-kit (contexto: https://motion.dev/docs/ai-kit-context; instalação: https://motion.dev/docs/ai-kit-install). Segundo as páginas de instalação/contexto vistas pela busca, o **MCP local do AI Kit traz a documentação completa sem assinatura**; os **exemplos premium e as "transições salvas" exigem Motion+** (token pessoal pago). O SDK do AI Kit (alfa) é React web e exige Motion+. *Não consegui abrir motion.dev (DNS bloqueado): confirme o preço na página antes de pagar.* |
| MCPs da comunidade | [Abhishekrajpurohit/motion-dev-mcp](https://github.com/Abhishekrajpurohit/motion-dev-mcp) e [glama.ai/mcp/servers/pz8nupxaql](https://glama.ai/mcp/servers/pz8nupxaql): **não oficiais**. O repo é MIT, sem commits desde 2025-08, monta um banco raspando a documentação e só cobre React/JS/Vue. **Não usar**: se precisar, o MCP oficial grátis é melhor. |

**Como aplicar os princípios do Motion no app com Reanimated 4.5.1:**

| Princípio Motion | Equivalente no Reanimated 4.5.1 |
|---|---|
| Molas com `visualDuration` + `bounce` | `withSpring(v, { duration, dampingRatio })`. Molas são interrompíveis: usar em arraste e botões. |
| `AnimatePresence` (entrada e saída) | `entering`/`exiting` (`FadeIn`, `ZoomIn.springify()`), com `useReducedMotion` |
| `layout` / `layoutId` | `layout={LinearTransition}`; transição compartilhada com cautela (custo) |
| `whileTap` / `whileHover` | Pseudo-seletor CSS `:active` (4.5.0+) ou `Pressable` + shared value |
| `stagger()` | Atraso por índice (`entering={FadeInUp.delay(i * 40)}`), até ~8 itens |
| Animações ligadas à rolagem | `useAnimatedScrollHandler` / `useScrollOffset` |
| `useReducedMotion` | `useReducedMotion()` (lido na abertura do app) e `ReducedMotionConfig`. **CSS animations não respeitam sozinhas**: encurte para 1 ms. |
| Animar só transform e opacidade | Mesma regra (P9). Nada de animar `BlurView`, `elevation` ou layout durante a corrida. |

---

## 7. Fora do Expo Go: o que dá para fazer

| Desejo | No Expo Go | Saída recomendada |
|---|---|---|
| Postar direto nos Stories do Instagram | **Não** (`react-native-share` e o pasteboard do esquema `instagram-stories://` exigem código nativo) | Gerar a imagem 1080×1920 (Stories) e 1080×1350 (feed) e abrir a folha de compartilhamento do sistema com `expo-sharing`; também oferecer "Salvar na galeria" com `expo-media-library`. Relatos antigos indicam problemas com o Instagram na folha do iOS (https://forums.expo.dev/t/expo-sharing-image-video-not-working-with-instagram/42606): **testar no aparelho** (T7.E2.1). |
| Mascotes com máquina de estados (Rive) | **Não** | SVG + Reanimated (poses: parado, golpe, furioso, derrotado) ou Lottie por pose |
| Push remoto no Android | **Não** | Notificações locais agendadas + avisos no app |
| Hápticos ricos (Pulsar, Core Haptics) | **Não** | `expo-haptics` (impact, notification, selection) combinados em sequência curta |

---

## 8. Buscado e não encontrado (ou rejeitado)

| Tema | Resultado |
|---|---|
| Mascote ou personagem em SVG para React Native | Nada confiável. `simota/ink` é web (CSS, `aria`) e escreve em `.agents/*.md`. `create-svg-illustrations` é para slides. `canvas-design`/`algorithmic-art` (Anthropic) geram PNG/PDF. → criar `nomade-arte` (T7.E2.3). |
| Card para Instagram Stories em RN/Expo | Só skills web (Next `og`, `creating-share-images`) e SwiftUI (`rshankras/share-card`). → regras na T7.E2.1 e na E8. |
| Push e notificações para Expo | Só a skill da Courier (serviço pago) e genéricas. → usar a documentação `notifications.mdx` v57 e `game-responsibility-review`. |
| Hápticos com `expo-haptics` | Só `axiom-haptics` (iOS nativo) e `pulsar-haptics` (fora do Expo Go). `game-feel` cobre o "quando". |
| Rive | Não roda no Expo Go: nenhuma skill instalada. |
| Deep links com Expo Router | Coberto pela `expo-router` que já existe. Nenhuma skill dedicada melhor. |
| Gamificação de jogo de localização (Pokémon GO/Ingress) | Nada específico; `gamification-loops` + `game-mechanics-design` + relatório da E1. |
| Skill Impeccable completa | Rejeitada: lançador baixa binário remoto (`scripts/impeccable` usa `curl`/`wget`). Só as referências entraram. |
| Skill de gestos da SWM | Boa, mas adiada (ver SOURCES). |
| `game-ui-ux` (gamedev) | Presa a Godot/Unity. |
| `heymoezy/porter` `game-designer` | Sem licença. |

---

## 9. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Onde ficam as skills? | (a) só `.claude/skills` (o Claude Code carrega); (b) manter `.agents/skills` como arquivo e promover sob demanda; (c) mover tudo | **(b)**. Promovi as 6 mais úteis para F3/F4. Promover outras (ex.: `copywriting`, `app-store-screenshots`, `mapbox-*`) só quando uma equipe pedir. |
| D2 | Tecnologia dos mascotes e chefões animados | (a) SVG + Reanimated; (b) Lottie (com `text-to-lottie`); (c) Skia | **(a) como base**: já instalado, leve e web ok. **(b) para celebrações** (baú, chefão derrotado), se a E4 conseguir produzir. **(c) só para partículas e brilho**, com alternativa na web. |
| D3 | Captura do card de compartilhamento | (a) `react-native-view-shot` + `expo-sharing`; (b) Skia `makeImageSnapshot`; (c) gerar no servidor | **(a)** se o spike T7.E2.1 passar no Expo Go (versão 4.0.3 × 5.1.0); senão (b). (c) só se os dois falharem (custo de Edge Function e privacidade de rota). |
| D4 | Re-engajamento sem push remoto no Android | (a) notificações locais agendadas + avisos no app; (b) development build | **(a)**; registrar como D-xx. (b) contraria a distribuição pelo Expo Go. |
| D5 | MCPs | ligar Expo, Supabase (só leitura), Mobbin e Figma; resolver Vercel duplicado | Pedir ao dono **Expo e Supabase primeiro**; Mobbin se a conta permitir; Figma depende de liberar o proxy. Deixar **um** conector Vercel. |
| D6 | Novas libs nativas no `package.json` | instalar todas na F3 ou sob demanda | **Sob demanda por onda**, uma equipe por vez (arquivo compartilhado), sempre com `npx expo install`. |

---

## 10. Tarefas propostas para F3/F4

| ID | Título | Dona | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E2.1 | Spike: capturar e compartilhar o card no Expo Go | E8 (E10 testa) | `apps/mobile/src/features/social/**` | D3; coordenador libera `react-native-view-shot` no `package.json` | PNG 1080×1920 e 1080×1350 gerado com `captureRef` no **Expo Go Android e iOS**; folha de compartilhamento abre e o Instagram aparece; "Salvar na galeria" funciona; na web há alternativa (download). Resultado (passou/falhou e versão) registrado no relatório. |
| T7.E2.2 | Instalar as libs nativas aprovadas | Coordenador (E10 valida) | `apps/mobile/package.json`, lockfile | D2, D6 | `npx expo install …` com versões iguais à coluna [B]; `npx expo install --check` limpo; typecheck, ESLint e jest verdes; `npx expo export -p web` gera sem erro; abre no Expo Go. |
| T7.E2.3 | Skill de projeto `nomade-arte` (traço Pit Lane Neon) | E4 (E2 revisa) | `.claude/skills/nomade-arte/` | Relatório 04 da E4 | `SKILL.md` com até 300 linhas: grade, espessura de traço, paleta via tokens, 4 poses dos chefões, regras de mascote por time, checklist de SVG (viewBox, sem raster, alvo ≤ 30 KB por ilustração depois de otimizar) e de acessibilidade. Usada pela E4 em pelo menos 3 ilustrações. |
| T7.E2.4 | Skill de projeto `nomade-motion` (catálogo → presets) | E5 (E2 revisa) | `.claude/skills/nomade-motion/` | Relatório 05 da E5; `src/theme/motion.ts` | Mapeia cada momento da seção 11 a um preset (duração, mola, háptico, som opcional, versão com movimento reduzido) com nomes iguais aos de `motion.ts`; inclui as regras da 4.5.1 (sem `onCSS*`, CSS com 1 ms quando reduzido). |
| T7.E2.5 | Regressão visual de todas as rotas | E10 | `apps/mobile/e2e-web/**`, `.github/workflows/**` | Modo demonstração (X3) | Baselines de todas as rotas em 375×812; animações desligadas; relógio e mapa mascarados; diffs como artefato do CI; skill `visual-testing` seguida. |
| T7.E2.6 | Ligar e documentar os MCPs aprovados | Dono + coordenador | `docs/melhoria/**` | D5 | `/mcp` mostra Expo e Supabase conectados; Supabase com `read_only=true` e `project_ref`; um único conector Vercel; nota de uso em `docs/melhoria`. |
| T7.E2.7 | Revisão das skills no fim da F3 | E2 | `.claude/skills/**`, `.agents/skills/SOURCES.md` | Relatórios da F3 | Lista de skills usadas e não usadas; remover ou atualizar as desatualizadas (ex.: quando o SDK subir o Reanimated); conferir que nenhuma nota NOMADE contradiz o código. |

---

## 11. Riscos e bloqueios

| # | Risco | Efeito | Mitigação |
|---|---|---|---|
| R1 | view-shot 5.1.0 (JS) × 4.0.3 (nativo do Expo Go) | Card de compartilhamento pode falhar | Spike T7.E2.1 cedo; plano B com Skia |
| R2 | Push remoto ausente no Expo Go Android | Loops de volta mais fracos | Notificações locais agendadas (D4) |
| R3 | Instagram na folha de compartilhamento do iOS (relatos antigos) | "Postar nos Stories" pode não abrir direto | Testar no aparelho; oferecer "Salvar na galeria" |
| R4 | Skia e Lottie na web | Prévia na Vercel mais pesada ou quebrada | Alternativa web para cada uso; E10 testa o export web |
| R5 | Skills com installs baixos (lvtd ~57, SWM ~10, qa-skills) | Qualidade menos provada | Curtas, com fonte citada, sem comandos; revisão na T7.E2.7 |
| R6 | Exemplos das skills escrevem `sharedValue.value` na renderização | Quebra as regras do React Compiler | Avisos nas notas NOMADE; ESLint do React Compiler pega |
| R7 | Skill pede para rodar algo remoto (`text-to-lottie` → `npx degit` + `npm install` com `postinstall`) | Execução de código de terceiros | Só no scratchpad, depois de ler o `package.json`; nunca no app |
| R8 | `docs.expo.dev` e `motion.dev` bloqueados (DNS) | Confirmações indiretas | Usei o código-fonte da documentação e do Expo Go; o MCP da Expo resolveria |
| R9 | Conector Figma com 403 e Vercel duplicado | E4/E6 sem Figma; confusão de conta na Vercel | D5 |
| R10 | Sequências e recompensas diárias (Lenny, gamification) | Padrão manipulador (X1) | `game-responsibility-review` como portão obrigatório da E7 |

---

## 12. Arquivos desta entrega

- `docs/melhoria/F1/02-skills-e-mcps.md` (este relatório)
- `docs/melhoria/F1/skills/cartao-por-equipe.md` (quais skills cada equipe chama)
- `.agents/skills/SOURCES.md`, seção "Fase 7 — Reformulação v2" (só acréscimo)
- `.claude/skills/` (20 pastas novas, cada uma com `SKILL.md`, até 3 referências e `LICENSE` quando a origem tem):
  - **novas:** `swm-rn-animations`, `swm-rn-svg`, `game-feel`, `game-balance-economy`, `game-mechanics-design`, `game-responsibility-review`, `user-onboarding-activation`, `retention-engagement`, `referrals-word-of-mouth`, `ux-writing`, `mobile-accessibility`, `visual-testing`, `text-to-lottie`, `impeccable-refs`;
  - **promovidas:** `react-native-reanimated`, `react-native-skia`, `expo-animation`, `gamification-loops`, `emil-design-eng`, `motion-design`.

## 13. Fontes

**Skills (repositórios)**
- https://github.com/software-mansion-labs/skills
- https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- https://github.com/lvtd-llc/skills
- https://github.com/RefoundAI/lenny-skills
- https://github.com/content-designer/ux-writing-skill
- https://github.com/community-access/accessibility-agents
- https://github.com/petrkindlmann/qa-skills
- https://github.com/diffusionstudio/lottie
- https://github.com/pbakaus/impeccable
- https://github.com/simota/agent-skills
- https://github.com/narumiruna/agent-skills
- https://github.com/trycourier/courier-skills
- https://github.com/rshankras/claude-code-apple-skills
- https://github.com/expo/skills

**Installs e listagens**
- https://www.skills.sh/lvtd-llc/skills/game-balance-economy
- https://skills.sh/refoundai/lenny-skills/user-onboarding-activation
- https://www.skills.sh/software-mansion-labs/react-native-skills
- https://skills.sh/gamedev-skills/awesome-gamedev-agent-skills/game-feel
- https://skillselion.com/skills/content-designer/ux-writing-skill/ux-writing
- https://vibeindex.ai/skills/diffusionstudio/lottie/text-to-lottie
- https://www.star-history.com/pbakaus/impeccable/

**Expo**
- https://github.com/expo/expo/tree/main/docs/pages/versions/v57.0.0/sdk
- https://github.com/expo/expo/blob/sdk-57/apps/expo-go/package.json
- https://github.com/expo/expo/blob/sdk-57/apps/expo-go/ios/Podfile.lock
- https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json
- https://docs.expo.dev/versions/v57.0.0/sdk/notifications/

**Rive e Instagram**
- https://rive.app/docs/runtimes/react-native/adding-rive-to-expo
- https://forums.expo.dev/t/how-to-share-an-image-to-instagram-stories-from-expo-react-native/24418

**MCPs**
- https://docs.expo.dev/eas/ai/mcp
- https://github.com/supabase/mcp
- https://github.com/mobbin/mobbin-mcp-server
- https://developers.figma.com/docs/figma-mcp-server/remote-server-installation

**motion.dev**
- https://motion.dev/docs/ai-kit
- https://motion.dev/docs/ai-kit-install
- https://motion.dev/docs/ai-kit-context
- https://github.com/Abhishekrajpurohit/motion-dev-mcp
- https://glama.ai/mcp/servers/pz8nupxaql
