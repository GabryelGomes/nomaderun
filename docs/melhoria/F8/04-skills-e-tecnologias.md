# F8 — Skills, MCPs e tecnologias para a finalização

**Equipe:** E2 — Skills e MCPs · **Fase:** 8 (Finalização 100%) · **Data:** 2026-10-30
**Continua:** `docs/melhoria/F1/02-skills-e-mcps.md` (Fase 7). Não repito o que está lá: as 20 skills da F1, a tabela do Expo Go SDK 57 por fonte e a avaliação do motion.dev continuam valendo.
**Escopo de escrita:** 10 pastas novas em `.claude/skills/`, seção "Fase 8" no fim de `.agents/skills/SOURCES.md` e este relatório. Nenhum arquivo do app foi alterado. Os testes de pacote rodaram numa **cópia** do `apps/mobile` no scratchpad.

**Legenda:** **[TESTADO]** = rodei aqui e vi o resultado · **[LIDO]** = só li fonte ou código · **[NÃO CONFIRMADO]** = não consegui conferir.

---

## 0. Resumo

1. **10 skills instaladas** (limite: 12): `eas-update`, `eas-app-stores`, `character-design`, `icon-design`, `player-onboarding`, `mobile-audit`, `maestro-e2e`, `lgpd-privacy-policy`, `lgpd-eca-digital-minors` e `localize-pt`.
2. **HyperFrames:** é um renderizador de **HTML para MP4** (Chrome sem tela + FFmpeg, Node 22+). **Não roda no React Native nem no Expo Go.** Renderizei aqui um vídeo 1080×1920 de 4 s com a cara de um time do NOMADE em 9 s. **Veredito: só na apresentação** (e, se quiserem, 4 clipes pré-renderizados, um por time).
3. **Animação no Expo Go [TESTADO]:**
   - Lottie e Skia instalam e passam no `expo-doctor` (19 de 21 checagens; as 2 falhas são de rede).
   - **Na web, os dois quebram do jeito que estão:** o Lottie busca um WASM no jsdelivr/unpkg em tempo de execução, e o Skia cai com "CanvasKit is not defined".
   - Corrigi o Lottie servindo o WASM pelo próprio site: 0 pedidos externos.
   - Rive precisa de `react-native-nitro-modules`, que não vem no Expo Go.
4. **MCPs [TESTADO]:**
   - **Figma** agora conecta, mas a conta é plano Starter com assento View: são **6 chamadas de leitura por mês** (as de escrita ficam fora do limite).
   - **Mobbin** conecta, mas responde "requires a paid plan".
   - **Vercel** funciona e **ainda não há projeto do NOMADE**: a prévia web não foi publicada.
5. **Publicação: cinco lacunas que bloqueiam pessoas reais** (seção 6):
   - **sem `expo-updates`**: o APK interno não recebe OTA;
   - `publicar.sh` sem `--environment`;
   - **sem página web de exclusão de conta**, que o Google Play exige;
   - **SMTP padrão do Supabase** em vez de um SMTP próprio;
   - **política de privacidade sem controlador e sem encarregado**.
   - Há ainda um risco legal a conferir: o **ECA Digital** (16 e 17 anos por autodeclaração).

---

## 1. skills.sh e o método find-skills

### 1.1 Método

- `skills.sh`, `docs.expo.dev`, `planalto.gov.br` e `developers.figma.com` **não resolvem** neste ambiente. A API do GitHub dá 403 sem `add_repo`.
- Por isso usei **WebSearch** (`skills.sh <tema>`) e agregadores (skillselion, vibeindex, tessl, claudeskills) para ranking e installs.
- Baixei os repositórios com `git clone --depth 1 --filter=blob:none`, cada um numa pasta vazia do scratchpad (`scratchpad/dl/<dono>_<repo>`): 15 repositórios.
- Li cada `SKILL.md` inteiro e rodei uma varredura (`scratchpad/scripts/scan.sh`) atrás de:
  - `curl | sh` e `npx`/`npm i`;
  - segredos;
  - frases de injeção.
- Conferi licença e data do último commit.
- Ao instalar: só pastas novas, o `SKILL.md`, até 3 referências e o `LICENSE` original, mais uma **nota NOMADE** no topo com as regras do projeto que vencem a skill.

### 1.2 Candidatas por tema

**Confiança:** **A** = autor oficial ou repositório já usado no projeto, licença permissiva e varredura limpa. **B** = comunidade, licença permissiva e varredura limpa, mas poucos installs. **C** = rejeitada.

| Tema | Skill (link) | O que faz | Autor · licença · data · installs | Confiança | Decisão |
|---|---|---|---|---|---|
| Mascotes / personagem | [`character-design`](https://github.com/omer-metin/skills-for-antigravity/tree/main/skills/character-design) | Três leituras (silhueta, cor, detalhe), linguagem de formas, família de personagens, desenhar pensando na animação | omer-metin (mesmo repo da `gamification-loops`) · Apache-2.0 · 2026-01-22 · não achei installs (irmãs: ~40–90) | B+ | **Instalada** |
| Mascotes animados em SVG | [`svg-character-animation`](https://www.skills.sh/calesthio/openmontage/svg-character-animation) | Rig SVG + GSAP + Remotion/HyperFrames | calesthio/OpenMontage · **AGPL-3.0** · Tessl 63/100 | C | Rejeitada (licença e web) |
| Ilustração SVG | [`svg-illustration`](https://skills.sh/narumiruna/agent-skills/svg-illustration) | Regras de SVG para slides e documentos | narumiruna · MIT · 2026-10-22 | B | Não instalada (já rejeitada na F1: é para diagramas) |
| Ícones e emblemas | [`icon-design`](https://github.com/omer-metin/skills-for-antigravity/tree/main/skills/icon-design) | Grade, alinhamento ótico, traço consistente, menor tamanho primeiro | omer-metin · Apache-2.0 · ~93 installs | B+ | **Instalada** |
| Ícones | [`icon-system`](https://skillselion.com/skills/dylantarre/design-system-skills/icon-system) | Sprites e tokens de ícone (web) | dylantarre · MIT · 2025-12-30 · ~10 | B | Não (só web) |
| Ícones | [`icon-set-generator`](https://skillselion.com/skills/jezweb/claude-skills/icon-set-generator) | Gera conjuntos de SVG | jezweb · ~1,5K · **auditoria MEDIUM** | C | Não |
| Animação Lottie | `text-to-lottie` (já instalada na F1) | SVG → Lottie | diffusionstudio · MIT | A | Já existe |
| Animação Rive | [`rive`](https://www.skills.sh/bowtiedswan/rive-skills/rive), [`rive-react`](https://www.skills.sh/stevysmith/rive-skills/rive-react) | Máquinas de estado Rive | comunidade · 13 estrelas / ~91 installs | — | Não (Rive não roda no Expo Go, seção 3) |
| Animação Reanimated | `swm-rn-animations`, `react-native-reanimated`, `expo-animation` (F1) | — | Software Mansion, Expo | A | Já existem |
| Onboarding / FTUE | [`player-onboarding`](https://github.com/omer-metin/skills-for-antigravity/tree/main/skills/player-onboarding) | Gancho em 30 s, um conceito por vez, ensinar jogando, medir abandono por passo | omer-metin · Apache-2.0 · ~44 installs | B+ | **Instalada** (complementa `user-onboarding-activation` e `impeccable-refs`) |
| Gamificação | `gamification-loops`, `game-*` (F1) | — | — | A | Já existem; nada melhor encontrado |
| Acessibilidade | `mobile-accessibility` (F1) | — | — | A | Já existe; nada melhor encontrado |
| Segurança mobile | [`mobile-audit`](https://github.com/briiirussell/cybersecurity-skills/tree/main/skills/mobile-audit) | MASVS/MASTG por categoria, refutação por achado, calibração (chave publicável ≠ segredo) | briiirussell · MIT · 2026-10-30 · ~60 installs · Socket: 1 alerta LOW | A− | **Instalada** |
| Segurança mobile | [`security-review`](https://openskillindex.com/skills/jubakitiashvili-everything-react-native-expo-security-review-3b2d36) | Checklist RN/Expo | JubaKitiashvili · MIT | B | Não (rasa; a `mobile-audit` cobre mais) |
| Segurança mobile | [`mobile-security`](https://claudeskills.info/skills/transilienceai/communitytools/mobile-security/) | Pentest (Frida, descompilação) | transilienceai · MIT | B | Não (ofensiva) |
| Segurança mobile | [`security-audit`](https://skills.cat/skills/dtsvetkov1/agent-rules/security-audit) | Varredura RN/Expo | dtsvetkov1 · **sem licença** | C | Rejeitada |
| Supabase RLS | [`supabase-audit-rls`](https://skillselion.com/skills/yoanbernabeu/supabase-pentest-skills/supabase-audit-rls) e o conjunto `supabase-pentest-skills` | Pentest caixa-preta (RLS, RPC, Storage, Auth) com a chave anon | yoanbernabeu · MIT · 2026-01-31 · ~660 | B | Não instalada: rodar **uma vez, pelo dono, depois do deploy**, fora do repo (grava `.sb-pentest-*` e tem skills de "extrair service key") |
| Supabase RLS | `supabase-security` (omer-metin) | Básico de RLS | Apache-2.0 | B | Não (rasa perto de `supabase` e `supabase-postgres-best-practices`) |
| Release / EAS | [`eas-update`](https://skills.sh/expo/skills/eas-update) | OTA, canais, runtime, depuração | **Expo (oficial)** · MIT · 2026-10-28 · ~940 | A | **Instalada** (versão nova; a de `.agents` está desatualizada) |
| Release / lojas | [`eas-app-stores`](https://github.com/expo/skills/tree/main/plugins/expo/skills/eas-app-stores) | Build e envio às lojas, metadados | Expo · MIT · 2026-10-28 | A | **Instalada** |
| Release / web | `expo-dom`, `eas-hosting`, `eas-update-insights`, `eas-observe` | DOM components, hospedagem, saúde do OTA | Expo · MIT | A | Não agora (ver seções 2 e 6) |
| Expo Go | — | Nenhuma skill específica | — | — | `expo-overview` cobre |
| E2E Maestro | [`maestro-e2e`](https://skills.sh/raphaelbarbosaqwerty/maestro-dev-skills/maestro-e2e) | 40+ comandos, seletores, permissões, subfluxos | raphaelbarbosaqwerty · MIT · 2026-02-05 · ~85 | B | **Instalada** (3 de 24 regras) |
| E2E Maestro | [`maestro-mobile-testing`](https://skills.sh/tovimx/maestro-mobile-testing-skill/maestro-mobile-testing) | Maestro para RN/Expo | tovimx · ~970 installs, 23 estrelas · **sem licença** | C | Rejeitada (licença) |
| LGPD | [`lgpd-privacy-policy`](https://github.com/goul4rt/lgpd-skills/tree/main/skills/lgpd-privacy-policy), [`lgpd-eca-digital-minors`](https://github.com/goul4rt/lgpd-skills/tree/main/skills/lgpd-eca-digital-minors) | Os 7 elementos do Art. 9º; ECA Digital | goul4rt · MIT · 2026-05-31 · pt-BR | B+ | **Instaladas** (2 de 19; o orquestrador `lgpd-audit` depende de todas) |
| Copywriting pt-BR | [`localize-pt`](https://www.skills.sh/i18n-agent/i18nstack/localize-pt) | Regras de pt-BR: calques, falsos amigos, estados vazios | i18n-agent · MIT · 2026-10-22 | B | **Instalada** (nota: sempre pt-BR) |
| Copywriting pt-BR | — | Nenhuma skill de copy **em** pt-BR | — | — | `ux-writing` + `localize-pt` cobrem |
| Vídeo | [`hyperframes`](https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes) | Vídeo em HTML | HeyGen · Apache-2.0 | A | Não no repo (seção 2) |

### 1.3 O que foi instalado

Todas as pastas ficam em `.claude/skills/<nome>/`, com `LICENSE` e nota NOMADE.

| Skill | Frente | Por que agora | 3 regras mais úteis para o NOMADE |
|---|---|---|---|
| `character-design` | Arte dos times | 4 mascotes e chefões precisam ser diferentes à primeira vista | 1) Silhueta em 32×32 identifica o time **sem cor** (daltonismo). 2) Linguagem de formas por personalidade (círculo amigável, triângulo agressivo, quadrado firme). 3) Detalhe só entra se não piora as leituras 1 e 2; desenhe pensando nas poses de animação. |
| `icon-design` | Emblemas e ícones | Emblema do time, ícones de aba e de modo | 1) Desenhe no **menor** tamanho primeiro (aba 24 pt). 2) Mesmo traço e raio em todo o conjunto ("irmãos"). 3) Alinhamento ótico vence o matemático (triângulo de "play" deslocado). |
| `player-onboarding` | Primeira abertura | Boas-vindas → time → GPS → missão | 1) Algo empolgante nos **primeiros 30 s**. 2) **Um conceito por momento**, no contexto em que é usado. 3) Medir abandono por passo e deixar o veterano pular. |
| `mobile-audit` | Segurança | Revisão antes de abrir para pessoas reais | 1) Chave **publicável** não é achado (a anon do Supabase); a `service_role` sim. 2) Cada achado passa por uma **refutação** antes de entrar no relatório. 3) Root, jailbreak e ofuscação são **nota de reforço**, não achado. |
| `eas-update` | Publicação | Corrige o modelo de OTA do projeto (seção 6) | 1) `npx expo install expo-updates` + `eas update:configure`, nunca escrever `updates.url`/`runtimeVersion` à mão. 2) SDK 55+: publicar com `--environment`. 3) Mudança nativa (Skia, Lottie no APK) = build novo, não update. |
| `eas-app-stores` | Publicação | Se forem às lojas | 1) Credenciais no EAS, nunca no repo. 2) Metadados e capturas por loja. 3) Conta de revisão sem senha em arquivo. |
| `maestro-e2e` | QA | P-07: rodar os fluxos no aparelho | 1) `testID` semântico (`tela_elemento_tipo`). 2) `launchApp: clearState: true` e subfluxos. 3) `extendedWaitUntil` em vez de esperas fixas; `hideKeyboard` antes de tocar. |
| `lgpd-privacy-policy` | LGPD | A política atual não tem os 7 elementos | 1) Controlador identificado e **contato do encarregado**. 2) Direitos com menção ao **Art. 18**. 3) Toda mudança material = nova versão + aviso. |
| `lgpd-eca-digital-minors` | LGPD | O app aceita 16 e 17 anos | 1) Avaliar se é "de acesso provável" por menores. 2) **Autodeclaração de idade não basta** (segundo a skill). 3) Caixas de recompensa e geolocalização exigem atenção com menores. |
| `localize-pt` | Textos | Agentes escrevem calques ("bem-sucedido", "Zero anúncios") | 1) Estado vazio = "Nenhum(a) X" / "Não há X". 2) Conclusão no particípio ("Corrida salva"), não "bem-sucedida". 3) Fugir de falsos amigos e de "Zero X" ("Sem X"). |

Comandos equivalentes (para outra máquina, onde o skills.sh abre):

```bash
npx skills add expo/skills --skill eas-update
npx skills add expo/skills --skill eas-app-stores
npx skills add omer-metin/skills-for-antigravity --skill character-design
npx skills add omer-metin/skills-for-antigravity --skill icon-design
npx skills add omer-metin/skills-for-antigravity --skill player-onboarding
npx skills add briiirussell/cybersecurity-skills --skill mobile-audit
npx skills add raphaelbarbosaqwerty/maestro-dev-skills
npx skills add goul4rt/lgpd-skills --skill lgpd-privacy-policy
npx skills add goul4rt/lgpd-skills --skill lgpd-eca-digital-minors
npx skills add i18n-agent/i18nstack --skill localize-pt
```

---

## 2. HyperFrames (heygen-com/hyperframes)

**Fontes:**
- README e código clonados no commit `1116077` (2026-10-30);
- npm `hyperframes@0.8.221` (publicado em 2026-10-30; a versão 0.1.0 é de 2026-03-23).

### 2.1 O que é de fato [LIDO + TESTADO]

- **Framework para transformar HTML, CSS e animação controlável por tempo em MP4 determinístico.**
  - O vídeo é um `index.html` com elementos `class="clip"`, `data-start` e `data-duration`.
  - Uma timeline GSAP pausada é registrada em `window.__timelines`.
- O renderizador abre a página num **Chrome sem tela** (Puppeteer), avança quadro a quadro e codifica com **FFmpeg**: a mesma entrada gera sempre o mesmo vídeo.
- Saídas: MP4, WebM/MOV com transparência, GIF, sequência PNG e HLS.
- **Pacotes:**
  - CLI `hyperframes`;
  - `core`, `engine` e `producer` (captura e encode);
  - `studio` (editor no navegador);
  - `player` (web component `<hyperframes-player>`);
  - `shader-transitions` (WebGL);
  - renderização na AWS Lambda e no Cloud Run.
- **Adaptadores de animação:** GSAP, CSS, Lottie, Three.js, Anime.js e WAAPI.
- **Licença: Apache-2.0** (arquivo `LICENSE`).
  - A biblioteca GSAP, usada nos exemplos, tem licença própria, gratuita mas não OSI [LIDO, não conferi o texto].
- **Requisitos:** Node ≥ 22 e FFmpeg.

### 2.2 Roda no React Native/Expo?

**Não.** O núcleo depende de DOM, Chrome e FFmpeg (Node).
- O `<hyperframes-player>` é um web component: só funcionaria no export web ou dentro de um componente DOM do Expo (`'use dom'`, que usa `react-native-webview`, presente no Expo Go). **Não testei** e não recomendo: um WebView inteiro para tocar animação.
- O caminho que funciona é **renderizar o MP4 fora** e tocar no app com `expo-video`, que vem no Expo Go SDK 57 (`apps/expo-go/package.json` do branch `sdk-57`) [LIDO].

### 2.3 Teste local [TESTADO]

O teste ficou em `scratchpad/hf-test`.

1. `npm i hyperframes@0.8.221` e `hyperframes telemetry disable`.
2. `hyperframes doctor`:
   - FFmpeg 6.1.1: ok;
   - Chrome: ausente; usei o `headless_shell` do Playwright em `/opt/pw-browsers` com `HYPERFRAMES_BROWSER_PATH`.
3. `hyperframes init card-time --example blank --resolution portrait --skip-skills`. Sem `--skip-skills`, **o `init` instala skills de IA sozinho**.
4. Escrevi um card "VOCÊ ENTROU NO TIME · VOLT", com emblema SVG e brilho verde-neon (`#19E6A8`, `#070708`, da `neon.ts`).
5. `hyperframes lint`: 0 erros.
6. `hyperframes render -q draft`:
   - **1ª tentativa falhou:** o GSAP vinha do jsdelivr e o Chrome sem tela não alcança a CDN pelo proxy;
   - **2ª passou** com o GSAP copiado para `assets/` (`npm i gsap@3.14.2`).
   - **Resultado:** `card.mp4`, H.264, 1080×1920, 30 fps, 4 s, **288 KB**, renderizado em **9 s**.
   - O quadro de 2,5 s foi conferido visualmente (emblema, brilho, título e selo "DEMONSTRAÇÃO").

### 2.4 Cuidados

- **Telemetria ligada por padrão.** Desligue com `hyperframes telemetry disable` ou `DO_NOT_TRACK=1`.
- **`publish` envia o projeto para a HeyGen.** O `cloud` e o `auth` usam conta HeyGen. Para a apresentação, só render local: nada de dado pessoal real numa composição.
- O `init` baixa skills e o template aponta GSAP por CDN. Para render offline, copie o GSAP para `assets/`.
- Renderizar **por pessoa** (card com o nome de cada corredor) exigiria Chrome + FFmpeg num servidor. As Edge Functions (Deno) não têm isso, e o render na nuvem da HeyGen mandaria dados a terceiros (LGPD). **Não fazer.**

### 2.5 Três usos concretos

| # | Uso | Como | Custo |
|---|---|---|---|
| 1 | **Trailer da apresentação** (30–45 s, 1920×1080) | Composição com as capturas "depois" que já existem (165 PNG em `docs/melhoria/capturas`), títulos e o mapa pintando; `hyperframes render -q delivery`. Skill `/hyperframes` instalada **numa pasta de vídeo fora do repo** | Zero no app |
| 2 | **Clipe de 4 s por time na tela de escolha** | O mesmo `card-time` com variáveis por time (`--batch` com 4 linhas) → 4 MP4 de ~300 KB tocados com `expo-video` ao confirmar o time | +~1,2 MB de assets; precisa de decisão de arte (E4) e de "Reduzir movimento" (mostrar o quadro final). **Alternativa já pronta:** `components/celebration/team-confirm.tsx` em Reanimated, sem peso extra |
| 3 | **Card animado para os Stories** (1080×1920) | Clipes **pré-renderizados** por time ou conquista (sem dados da pessoa) compartilhados com `expo-sharing`; o card estático com dados continua no app | Assets; não personaliza por pessoa |

**Veredito: SÓ NA APRESENTAÇÃO** (uso 1). Os usos 2 e 3 são opcionais e só entram se a E4 quiser vídeo pré-renderizado. Nunca entra como dependência do app.

---

## 3. Animação de personagem no Expo Go SDK 57 (sem development build)

### 3.1 O que rodei [TESTADO]

**Setup:**
- copiei o `apps/mobile` para `scratchpad/app-copy` e rodei `npm ci` (1.197 pacotes);
- `EXPO_OFFLINE=1 npx expo install lottie-react-native expo-linear-gradient expo-blur`, depois `npx expo install @shopify/react-native-skia`, que gravaram `~7.3.8`, `~57.0.2`, `~57.0.3` e `2.6.2`, as versões do `bundledNativeModules.json`;
- criei duas rotas de teste (`src/app/dev/teste-lottie.tsx` e `teste-skia.tsx`), com Lottie (anel pulsando, JSON de 1 KB), gradiente, blur e um círculo Skia com `Blur`, animado por shared value.

**Verificações:**
- **`npx expo-doctor@latest` (1.21.5):** 19 de 21 checagens passaram, incluindo "packages match versions required by installed Expo SDK", "required peer dependencies" e "no duplicate dependencies". As 2 falhas são de rede: `exp.host` e React Native Directory não resolvem aqui.
- **`npx expo install --check`:** "Dependencies are up to date".
- **Export web e Android** (`npx expo export`), medindo o JS em bruto e com gzip.
- **Navegador:** abri as rotas no Chromium com Playwright (`scratchpad/scripts/web-anim-check.cjs`).

| Medida | Base (app atual) | + Lottie (+ `@lottiefiles/dotlottie-react`) | + Skia |
|---|---|---|---|
| JS web (gzip) | 1.489.038 B | **+62.930 B** | **+112.783 B** |
| WASM extra na web | — | `dotlottie-player.wasm` 1,88 MB (718 KB gzip), baixado em tempo de execução | `canvaskit.wasm` 7,16 MB (**2,90 MB gzip**), **obrigatório** |
| Bytecode Android (Hermes, gzip) | 3.259.610 B | **+8.143 B** | **+228.548 B** |
| Abre na web? | — | **Não**, sem ajuste: busca o WASM em `cdn.jsdelivr.net` e `unpkg.com`. **Sim**, com o WASM servido pelo site (`setWasmUrl('/dotlottie-player.wasm')` + arquivo em `public/`): 0 pedidos externos, anel visível | **Não:** `CanvasKit is not defined` (falta `LoadSkiaWeb`/`WithSkiaWeb` + `canvaskit.wasm`) |
| Export web sem a dependência opcional | — | **Quebra o build:** "Unable to resolve module @lottiefiles/dotlottie-react" | — |

**Observações:**
- A base mede todos os `.js` do export. O orçamento da CI (1.250.000 B) mede de outro jeito, então compare só as diferenças.
- **No Expo Go, o nativo dessas bibliotecas já vem no binário:** o custo para a pessoa é só o JS acima.
- Nada disso foi testado em aparelho: o desempenho nativo da seção 3.2 é **[LIDO]**.

### 3.2 Tabela

| Biblioteca | Funciona no Expo Go? | Custo de bundle | Custo de desempenho [LIDO] | Mascote parado | Celebração da escolha do time | Chefão levando golpe | Confete |
|---|---|---|---|---|---|---|---|
| `react-native-reanimated` 4.5.1 + `react-native-svg` 15.15.4 (já no app) | **Sim** (já usados) | 0 (já pagos) | Animar `transform`/`opacity` de um `<G>` é barato; **cada elemento SVG é uma view nativa**, então animar dezenas de paths por quadro pesa. Filtro SVG (blur) é caro em tamanho grande | **Recomendado:** respiração de 2–3 s em `scale`/`translateY` no grupo do mascote; pausa fora da tela (`use-paused-when-hidden.ts`); estático com Reduzir movimento | **Recomendado:** já existe `team-confirm.tsx` + `burst`, `spin-rays`, `confetti` | **Recomendado:** `shake.tsx` + `flash.tsx` + `floating-number.tsx` + háptico; pausa de impacto de ~60–90 ms (`game-feel`) | **Recomendado:** `confetti.tsx` (teto de 60, CSS keyframes na thread de UI) |
| `lottie-react-native` 7.3.8 | **Sim** (pod `lottie-react-native 7.3.8` no Expo Go [LIDO na F1]; instala e passa no doctor [TESTADO]) | +63 KB gzip na web, +8 KB no Android; WASM de 718 KB gzip na web | Renderiza nativo (lottie-ios / lottie-android), bom para animação longa com muitos elementos; o arquivo JSON pesa no bundle | Possível, mas exige arte em Lottie (After Effects ou `text-to-lottie`) | **Boa opção** se a E4 produzir um `.json` por time (explosão com a cor do time) | Possível (uma animação por pose) | Desnecessário |
| `@shopify/react-native-skia` 2.6.2 | **Sim** no aparelho [LIDO na F1]; instala e passa no doctor [TESTADO]. **Web quebra** sem setup [TESTADO] | +113 KB gzip de JS na web + **2,9 MB gzip de WASM**; +229 KB no Android | Desenho na GPU; ótimo para muitas partículas (`Atlas`) e brilho com blur real; não use canvas para UI comum | Não | Só se precisar de brilho com blur real | Não | Só se passar de ~60 partículas. **Hoje não precisa.** Se entrar, precisa de alternativa web ou `WithSkiaWeb` |
| Rive (`@rive-app/react-native` 0.5.9 / `rive-react-native` 9.8.6) | **Não.** O pacote novo exige `react-native-nitro-modules`, ausente do Expo Go; a Rive pede development build [LIDO: npm e F1] | — | — | Não | Não | Não | Não |

**Recomendação:** ficar em **Reanimated + SVG** para tudo. Se a E4 quiser celebrações mais ricas, use **Lottie**, que só entra com:
1. `@lottiefiles/dotlottie-react` como dependência (senão o export web quebra);
2. `dotlottie-player.wasm` copiado para `apps/mobile/public/` e `setWasmUrl` no carregamento (senão a web depende de CDN);
3. teste no Expo Go Android e iOS.

**Skia: não instalar nesta fase.** O custo na web (2,9 MB) não compensa o que o Reanimated já faz. Instalação, se aprovada pelo coordenador:

```bash
npx expo install lottie-react-native @lottiefiles/dotlottie-react
```

---

## 4. Efeitos visuais "que dão vontade de olhar"

**O que o app já tem** em `components/motion` [LIDO]:
- `shimmer-skeleton`, `parallax-header`, `shake`, `flash`, `spin-rays`, `burst`, `confetti`, `floating-number` e `haptics.ts`, com "Reduzir movimento" e pausa fora da tela;
- o brilho neon é feito por **traços empilhados** (`components/art/neon/core.ts`, `glowFill`), sem filtro.

O que falta é pouco. Na tabela, "Expo Go" diz se a biblioteca vem no binário do Expo Go SDK 57.

| Efeito | Expo Go | Situação no app | Exemplo mínimo |
|---|---|---|---|
| **Gradiente animado** | `expo-linear-gradient` 57.0.2: **sim** [LIDO]; render web conferido [TESTADO] | **Não instalado** | Anime a **posição** de um gradiente largo, não as cores. Ver bloco A |
| **Blur** | `expo-blur` 57.0.3: **sim** [LIDO]; export web ok [TESTADO] | **Não instalado** | Blur **estático** atrás de folha ou modal; anime a `opacity` de uma `Animated.View` que o envolve. **Nunca** anime `intensity` (Android redesenha, regra da `expo-animation`) |
| **Glow / neon em SVG** | Filtros do `react-native-svg` 15.15.4 [LIDO no código-fonte]: implementados `FeGaussianBlur`, `FeOffset`, `FeMerge`, `FeFlood`, `FeBlend`, `FeComposite`, `FeColorMatrix` e `FeDropShadow`; **não implementados** (só aviso) `FeMorphology`, `FeTurbulence`, `FeDisplacementMap`, `FeConvolveMatrix`, `FeTile`, `FeImage`, `FeComponentTransfer` e as luzes | Usa traços empilhados (mais barato) | Filtro só em emblema **estático** e pequeno. Ver bloco B |
| **Partículas** | Reanimated: sim. Skia: sim no aparelho, quebra na web sem setup [TESTADO] | `confetti.tsx` (até 60) | Fique com o Reanimated. Skia `Atlas` só se forem centenas |
| **Parallax** | Reanimated: sim | `parallax-header.tsx` (rolagem) | **Novo, opcional:** inclinação do aparelho com `useAnimatedSensor(SensorType.ROTATION)` no fundo da escolha de time (±6 pt, desligado com Reduzir movimento) [LIDO, não testado] |
| **Shimmer / skeleton** | Sim | `shimmer-skeleton.tsx` | Já existe; com `expo-linear-gradient` a faixa pode virar um gradiente (opcional) |
| **Hápticos** | `expo-haptics` 57.0.3: sim (o app já usa) | `haptics.ts` | Use o wrapper do projeto. Golpe no chefão: `impact('heavy')` no acerto e `notification('success')` ao derrotar |

**Bloco A. Gradiente animado:**

```tsx
// Gradiente animado: a faixa é 2× mais larga e desliza (transform na thread de UI).
const x = useSharedValue(0);
useEffect(() => { x.value = withRepeat(withTiming(-W, { duration: 6000 }), -1, true); }, [x]);
const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
<View style={{ overflow: 'hidden', width: W }}>
  <Animated.View style={[{ width: W * 2, height: H }, style]}>
    <LinearGradient colors={[neon.bg, teamColor, neon.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
  </Animated.View>
</View>
```

**Bloco B. Glow em SVG:**

```tsx
<Svg viewBox="0 0 100 100">
  <Defs>
    <Filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <FeGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
      <FeMerge><FeMergeNode in="b" /><FeMergeNode in="SourceGraphic" /></FeMerge>
    </Filter>
  </Defs>
  <Path d={emblema} stroke={teamColor} strokeWidth={4} fill="none" filter="url(#glow)" />
</Svg>
```

### 4.1 Referências visuais (estilo neon esportivo e jogos de território)

Consultadas por busca em 2026-10-30; **não abri as páginas** (vários hosts estão bloqueados aqui).

1. **Run An Empire** (PAN Studio): correr em volta do parque para tomá-lo; o mais próximo do NOMADE em mecânica. https://fitness-gaming.com/news/fitness-and-sports/run-an-empire.html
2. **KYRO: Territory Run Game** (2026): clubes defendem e expandem território correndo circuitos. https://ingamenews.com/esports/kyro-territory-run-game-brings-strategy-mechanics-to-mobile-running/
3. **App de corrida "Civ 7 na vida real"** (Dexerto): leitura de mapa como jogo de estratégia. https://www.dexerto.com/gaming/new-running-app-turns-your-neighborhood-into-a-real-life-civ-7-game-3389630/
4. **"Fitness App UI – Dark Mode with Neon Energy"** (Dribbble, sabbirux7): fundo escuro com destaque neon em cards de métricas. https://dribbble.com/sabbirux7?page=2
5. **Vitrine do HyperFrames**: ritmo e cortes para o trailer da apresentação. https://hyperframes.heygen.com/showcase

---

## 5. MCPs e ferramentas nesta fase

Estado testado nesta sessão em 2026-10-30.

| Ferramenta | Estado | Uso concreto nesta fase | Comando / skill |
|---|---|---|---|
| **Figma** (conector claude.ai) | **Conecta** [TESTADO: `whoami` → "Gabryel Gomes", plano **Starter**, assento **View**]. O plugin `plugin:figma:figma` segue com 403 no proxy | **Desenhar os 4 emblemas e exportar SVG:** criar o arquivo e os frames com as ferramentas de **escrita**, que segundo a documentação ficam **fora** do limite. Leituras (`get_design_context`, `get_screenshot`) contam **6 por mês** no Starter/View [LIDO por busca; a página oficial não abre aqui]. **Na prática:** desenhar no Figma, exportar o SVG à mão e trazer para `components/art/team/*` | Skills `figma:figma-use` (obrigatória antes de `use_figma`), `figma:figma-create-new-file`, `figma:figma-generate-library` (tokens neon) |
| **Whimsical** | Conecta (confirmado na F1; não chamei de novo) | **Fluxo da primeira abertura:** boas-vindas → cadastro → "A cidade está dividida" → time → confirmação → GPS → missão, com os ramos (pular, negar GPS, sem rede) | `how_to('flowchart')` e `add_board_content`; conferir com `fetch({image:true})` |
| **Vercel** | Conecta [TESTADO: `list_projects` mostra só `jogo-de-vouchers` e `jogo`] | **Criar a prévia web** (`DEPLOY.md` §11, ainda não feita) e acompanhar erros. O dono importa o repo com Root Directory `apps/mobile`; depois, `get_deployment` e `get_runtime_errors` | Há **dois** conectores Vercel (`Vercel` e `Vercel-852190fe`): usar um só |
| **Mobbin** | Conecta, mas **"requires a paid plan"** [TESTADO em `search_flows`] | Seria para fluxos de escolha de personagem e time. **Sem uso** até alguém assinar | — |
| **GitHub** | Conecta (F1) | Logs da CI (`actions_list`, `get_job_logs`) no fechamento; outros repos só com `add_repo` | — |
| **Google Drive** | Conecta (F1) | Publicar o trailer e os slides da apresentação | — |
| **Expo MCP** | Não ligado | **Prioridade 1 do dono:** contornaria o bloqueio do `docs.expo.dev` e ajudaria no EAS Update | `https://mcp.expo.dev/mcp` |
| **Supabase MCP** | Não ligado | Depois do deploy: `get_advisors` (lint de segurança e RLS) e logs das functions, **sempre** com `read_only=true&project_ref=<ref>` | `https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true` |

---

## 6. Segurança e publicação: o que falta para pessoas reais

Conferido em `docs/REQUISITOS.md` (RNF-007, RNF-013), `supabase/DEPLOY.md` §3, §10 e §11, `apps/mobile/app.json`, `eas.json`, `scripts/publicar.sh` e `scripts/apk.sh`, `supabase/config.toml` e `features/auth/legal-screen.tsx` **[LIDO]**.

**Já feito, fora desta lista:** RLS em toda tabela, `service_role` só nas functions, HMAC, PKCE, exportar e excluir conta, telemetria opt-in, checagem de chave secreta nos scripts e varredura do bundle.

| # | O que falta | Por quê | Como resolver | Bloqueia? |
|---|---|---|---|---|
| S1 | **`expo-updates` ausente** e nada de `extra.eas.projectId`, `updates.url` ou `runtimeVersion` no repo | O APK de `npm run apk` (canal `demo`) **não recebe** o que `npm run publicar` publica: sem `expo-updates`, o build não procura update. No Expo Go o EAS Update funciona pelo link do projeto, mas o Expo Go é ferramenta de desenvolvimento, não distribuição | `npx expo install expo-updates` + `npx eas-cli@latest update:configure` (skill `eas-update`), commitar o diff, gerar APK novo | **Sim**, para o APK |
| S2 | `scripts/publicar.sh` publica sem `--environment` | A skill oficial diz que o SDK 55+ exige ambiente EAS ao publicar [LIDO na skill; **não testei** o comando] | Gravar as `EXPO_PUBLIC_*` no ambiente `production` (como o `apk.sh` faz no `preview`) e publicar com `--environment production` | Provável |
| S3 | **Página web de exclusão de conta** | O Google Play exige link web para pedir a exclusão sem reinstalar o app ([política](https://support.google.com/googleplay/android-developer/answer/13327111)). Hoje a exclusão está **dentro** do app | Rota pública `/excluir-conta` no export web, explicando o caminho e com um canal (e-mail do encarregado) | **Sim**, para a Play Store |
| S4 | **SMTP próprio + confirmação de e-mail** | D-21 desligou a confirmação para a demo. O e-mail padrão do Supabase tem limite baixo por hora e cai em spam; o checklist de produção pede SMTP próprio ([Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)) | Ligar a confirmação, configurar SMTP (Resend, SES…) e testar o link PKCE | **Sim**, para cadastro aberto |
| S5 | **Política de privacidade incompleta** (Art. 9º) | Falta identificação do **controlador**, **contato do encarregado**, menção explícita ao **Art. 18** e transferência internacional (região do Supabase) | Skill `lgpd-privacy-policy`; nova versão (`PRIVACY_VERSION`) e novo aceite | **Sim** (LGPD) |
| S6 | **ECA Digital** (Lei 15.211/2025, vigente desde 17/03/2026) | `MIN_AGE = 16` por **autodeclaração**: pessoas de 16 e 17 anos entram. Segundo a skill, a lei veda autodeclaração como verificação e pede atenção a geolocalização e a caixas de recompensa (os **baús** são grátis; **[NÃO CONFIRMADO]** se a definição legal exige pagamento, porque `planalto.gov.br` não abre aqui) | Decisão dos autores: (a) subir para **18+**, a saída mais simples para um TCC; ou (b) aplicar a skill `lgpd-eca-digital-minors` com apoio jurídico | **Decisão** |
| S7 | **Limite de chamadas por pessoa nas Edge Functions** | Hoje só há o limite do Auth (login/cadastro por IP, só no Cloud). Uma conta pode chamar `zones` (até 2.000 zonas por resposta), `account-export` e `weekly-recap` sem teto | Contador por `auth.uid()` + rota numa tabela `private` com função `security definer`, chamada no início das functions caras. Alternativa oficial: Upstash Redis ([guia Supabase](https://supabase.com/docs/guides/functions/examples/rate-limiting)), que traz mais um fornecedor | Recomendado |
| S8 | **A-1 e P-09** | Senhas públicas das contas demo; limite de login de 3 por 5 min para a sala | `DEPLOY.md` §10 passo 0 e §3 | **Sim** (já listado) |
| S9 | **Prévia web não publicada** | Nenhum projeto NOMADE na Vercel [TESTADO] | `DEPLOY.md` §11; necessária também para S3 e para a URL pública da política | Sim, para S3 e S5 |
| S10 | **Prontidão para as lojas** | `app.json` sem `ios.bundleIdentifier` e `android.package`. Conta pessoal nova no Google Play exige **teste fechado com 12 testadores por 14 dias** ([ajuda do Google](https://support.google.com/googleplay/android-developer/answer/14151465)). Faltam formulário de segurança de dados e conta de revisão | Skill `eas-app-stores`. Para o TCC, **APK interno + EAS Update** basta; loja só se os autores quiserem | Só para loja |
| S11 | **Monitoramento de falhas** | Não há relatório de crash (nenhum Sentry ou similar no app) | Opcional: skill oficial `eas-observe` / `eas-update-insights` (não instaladas) depois do S1 | Não |
| S12 | **Auditoria final** | — | `mobile-audit` no código (MASVS L1); `supabase-pentest-skills` uma vez contra o Cloud, pelo dono; `npm audit` com `npx expo install --fix` (P-37) | Recomendado |

**Chaves públicas:** a anon/publishable do Supabase **pode** ir no app; os scripts já recusam `sb_secret_*`/`service_role`. **[NÃO CONFIRMADO]:** se o projeto na nuvem usa as chaves novas `sb_publishable_` ou as JWT antigas. Vale conferir no painel antes da entrega.

---

## 7. Cinco recomendações principais

1. **Corrigir o OTA (S1 e S2) antes de qualquer outra coisa de publicação:** sem `expo-updates`, o APK entregue a pessoas reais nunca recebe correções.
2. **Fechar o pacote legal mínimo (S3, S5, S6):** página web de exclusão, política com controlador e encarregado, e **decidir 16+ ou 18+** por causa do ECA Digital.
3. **Personagens em Reanimated + SVG, sem Skia nesta fase:**
   - usar `character-design` e `icon-design` para que os 4 times passem no teste da silhueta;
   - Lottie só com o WASM servido pelo próprio site e `@lottiefiles/dotlottie-react` instalado.
4. **HyperFrames só para o trailer da apresentação**, renderizado fora do repo com telemetria desligada e sem `publish`.
5. **Usar o Figma (escrita) para os emblemas e o Whimsical para o fluxo da primeira abertura.** Deixar Mobbin de lado (pago) e criar a prévia na Vercel (S9).

---

## 8. Riscos e limites desta entrega

- Nada foi testado em **aparelho**: Expo Go Android e iOS precisam confirmar Lottie e os filtros SVG.
- Installs e estrelas vêm de agregadores (aproximados); vários não foram encontrados.
- Hosts bloqueados aqui: `skills.sh`, `docs.expo.dev`, `api.expo.dev`, `planalto.gov.br`, `developers.figma.com`, `rive.app` e `motion.dev`. A API do GitHub precisa de `add_repo`.
- As skills da comunidade instaladas (B/B+) têm poucos installs. São curtas, sem comandos automáticos, e a nota NOMADE limita o uso.
- O `PROGRESSO.md` **não** foi atualizado por esta equipe: fica com o coordenador ao integrar a fase.

## 9. Arquivos

- `docs/melhoria/F8/04-skills-e-tecnologias.md` (este relatório)
- `.agents/skills/SOURCES.md`: seção "Fase 8 — Finalização 100%" (só acréscimo)
- `.claude/skills/{eas-update, eas-app-stores, character-design, icon-design, player-onboarding, mobile-audit, maestro-e2e, lgpd-privacy-policy, lgpd-eca-digital-minors, localize-pt}/`
- Scratchpad (não versionado): `hf-test/card-time/out/card.mp4`, `app-copy/` (testes de pacote), `scripts/` (varredura, export e checagem web)

## 10. Fontes (consultadas em 2026-10-30)

**Repositórios clonados** (commit):
- https://github.com/heygen-com/hyperframes (`1116077`)
- https://github.com/expo/skills (`05754e7`)
- https://github.com/omer-metin/skills-for-antigravity (`e8dcf4e`)
- https://github.com/briiirussell/cybersecurity-skills (`05409bb`)
- https://github.com/raphaelbarbosaqwerty/maestro-dev-skills (`53ce7c0`)
- https://github.com/goul4rt/lgpd-skills (`d85d79a`)
- https://github.com/i18n-agent/i18nstack (`6bf6587`)
- Avaliados e rejeitados:
  - https://github.com/tovimx/maestro-mobile-testing-skill (`d4c0be2`)
  - https://github.com/calesthio/OpenMontage (`195eab2`)
  - https://github.com/yoanbernabeu/supabase-pentest-skills (`0f96122`)
  - https://github.com/JubaKitiashvili/everything-react-native-expo (`5326190`)
  - https://github.com/transilienceai/communitytools (`95fdc12`)
  - https://github.com/dtsvetkov1/agent-rules (`a676d21`)
  - https://github.com/dylantarre/design-system-skills (`45bddad`)
  - https://github.com/narumiruna/agent-skills (`0794151`)

**Expo:**
- Expo Go SDK 57: https://github.com/expo/expo/blob/sdk-57/apps/expo-go/package.json (baixado via raw)
- Changelog do SDK 57: https://expo.dev/changelog/sdk-57
- npm: `lottie-react-native@7.3.8`, `@rive-app/react-native@0.5.9`, `hyperframes@0.8.221`

**Listagens e installs:**
- https://skills.sh/expo/skills/eas-update
- https://skills.sh/tovimx/maestro-mobile-testing-skill/maestro-mobile-testing
- https://www.vibeindex.ai/skills/raphaelbarbosaqwerty/maestro-dev-skills/maestro-e2e
- https://www.skills.sh/briiirussell/cybersecurity-skills/mobile-audit/security/socket
- https://skillselion.com/skills/omer-metin/skills-for-antigravity/player-onboarding
- https://tessl.io/registry/skills/github/calesthio/OpenMontage/svg-character-animation

**Políticas e normas:**
- Supabase, limite nas Edge Functions: https://supabase.com/docs/guides/functions/examples/rate-limiting
- Supabase, checklist de produção: https://supabase.com/docs/guides/deployment/going-into-prod
- Google Play, exclusão de conta: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, teste fechado: https://support.google.com/googleplay/android-developer/answer/14151465
- Figma, limites: https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/ (via busca)
- ECA Digital: https://www.demarest.com.br/protecao-de-criancas-e-adolescentes-no-ambiente-digital/ e https://www.tecmundo.com.br/voxel/502437-loot-boxes-serao-proibidas-no-brasil-apos-sancao-de-lula-entenda-impacto-da-lei-felca-nos-games.htm (o texto oficial em planalto.gov.br não abriu)
