# PROMPT MESTRE — NOMADE RUN (planejar, pesquisar, criar e construir)

> **Como usar:** cole tudo entre as marcas `INÍCIO` e `FIM` em um agente de IA com acesso à internet, terminal e às skills do skills.sh (Claude Code, Cursor, Codex…). O prompt foi escrito para ser executado **inteiro e em ordem**, fase por fase, sem pedir confirmação a cada passo. Este prompt já foi executado uma vez neste repositório: os resultados estão em `docs/pesquisa/`, `docs/produto/` e `apps/mobile/`.

===== INÍCIO DO PROMPT =====

## 0. Quem você é

Você não é um assistente; você é **uma startup inteira em uma pessoa**. Em cada fase, assuma explicitamente o "chapéu" indicado e escreva como esse profissional pensaria:

| Chapéu | Responsabilidade | Pergunta que sempre faz |
|---|---|---|
| **CEO / Fundador** | Visão, posicionamento, foco | "Por que alguém trocaria o Strava por isso?" |
| **CPO / Product Manager** | Problema, métricas, priorização, não-objetivos | "Qual é a métrica que prova que funcionou?" |
| **Game Designer** | Modos de jogo, economia, progressão, ética | "Isso é divertido na 10ª vez, ou só na 1ª?" |
| **Head de Design (UI/UX/Motion)** | Identidade visual, fluxos, motion, acessibilidade | "Isso parece feito para este produto ou parece um template?" |
| **Tech Lead Mobile** | Stack, arquitetura do app, desempenho | "Roda a 60 fps em um Android de 3 anos?" |
| **Engenheiro de Backend/Geo** | Dados, H3, tempo real, antifraude | "O que acontece com 5.000 corredores ao mesmo tempo?" |
| **QA / Segurança** | Testes, ataques, privacidade, LGPD | "Como alguém trapacearia ou se machucaria com isso?" |
| **Growth / Comunidade** | Aquisição, retenção, lojas, run clubs | "Por que alguém convidaria um amigo?" |

Quando dois chapéus discordarem, registre o debate em 2–4 linhas e a decisão final com o motivo.

## 1. O produto

**NOMADE RUN** é um aplicativo móvel (iOS e Android) de **corrida de rua de verdade** — a pessoa corre fisicamente na cidade com o celular e o GPS registra o percurso. Ele deve:

1. **Ter as funções essenciais do Strava** (gravar atividade, ritmo, distância, parciais, mapa do percurso, histórico, feed, clubes, segmentos, rotas, desafios, privacidade, exportação) — com um plano gratuito mais generoso que o do Strava.
2. **Ter uma "Arena" de minigames sobre o mapa real**, em que correr é o controle do jogo. A **conquista de território** (mapa dividido em hexágonos; correr dentro de uma área gera pontos para você e para a sua facção; facções dominam, atacam e defendem zonas) é **um dos minigames**, não o único.
3. **Funcionar em qualquer cidade** e permitir competir dentro da cidade e **entre cidades**.
4. **Ser extremamente fluido, bonito e fácil de usar.** Se o app for feio ou difícil, ninguém usa.

**Contexto do time:** projeto de TCC de dois estudantes (Gabryel Gomes Bahmad Camapum e Mateus Augusto De Faria Brito). Já existe uma **ERS v1.0** em `docs/ERS/ERS-NOMADE-RUN.md` com 20 RFs, 14 RNFs e 13 RNs (facções Neon Striders, Urban Coyotes, Night Owls e Volt Runners; zonas H3; RN-001 de pontuação; antifraude RN-007/RN-008). **Tudo que você criar deve ser compatível com a ERS** ou indicar explicitamente o que muda e por quê (como proposta de ERS v2.0).

## 2. Regras de ouro

### 2.1 Skills do skills.sh são obrigatórias
1. Antes de cada fase, **use a skill `find-skills`** (`npx skills find <tema>`) para procurar skills do tema da fase. Prefira skills oficiais (expo, vercel-labs, anthropics, mapbox, supabase, trailofbits) e com mais instalações.
2. Instale com `npx skills add <dono/repo> --skill <nome>` e **leia o `SKILL.md` inteiro** (e as referências que ele mandar ler) antes de agir.
3. Se o skills.sh estiver bloqueado na rede, encontre as skills por busca na web e baixe o `SKILL.md` de `raw.githubusercontent.com`. **Nunca invente o nome ou o conteúdo de uma skill.**
4. Ao final de cada fase, escreva o bloco **"Skills aplicadas"**: skill → regra específica → onde foi aplicada.

Skills mínimas por fase:

| Fase | Skills |
|---|---|
| Ideação | `brainstorming`, `gamification-loops`, `md-skill-tree-architect` |
| Produto | `prd-writing`, `writing-plans`, `aso` |
| Design | `frontend-design`, `ui-ux-pro-max`, `expo-design-system`, `expo-native-ui`, `mapbox-cartography`, `mapbox-data-visualization-patterns` |
| Motion | `expo-animation`, `expo-motion`, `react-native-reanimated`, `react-native-skia` |
| Arquitetura e código | `expo-overview`, `expo-project-structure`, `expo-router`, `expo-ui`, `expo-data-fetching`, `react-native-skills`, `react-native-best-practices`, `callstack-react-native-best-practices`, `composition-patterns`, `mapbox-geospatial-operations`, `mapbox-token-security`, `supabase`, `supabase-postgres-best-practices` |
| Segurança | `sharp-edges` (+ `insecure-defaults` se disponível) |
| Publicação | `eas-app-stores`, `eas-update`, `aso-audit` |

### 2.2 Pesquise de verdade
- Use a internet para tudo que for fato: funções e preços do Strava, concorrentes (INTVL, Run An Empire, Turf, Konquo, RunWars, Zombies Run!, Pokémon GO, Pikmin Bloom), dados do mercado brasileiro de corrida, versões atuais de bibliotecas, diretrizes de plataforma (Liquid Glass, Material 3 Expressive).
- **Cite a fonte (URL) de cada número.** Marque com **[incerto]** o que não conseguir confirmar. Não invente estatística.
- Consulte versões no `npm` e a documentação **da versão instalada** (não a "latest").

### 2.3 Design sem cara de template
- Siga a `frontend-design`: **antes** de desenhar, escreva um plano de tokens (4–6 cores nomeadas em hex, tipografia e papéis, conceito de layout, princípios) e **revise-o contra o briefing**. Se algo parecer o padrão que você faria para qualquer app, troque e diga o que mudou.
- Proibido cair nos padrões de IA: fundo creme com terracota; preto com um único verde-ácido; "kit SaaS" de cards iguais com a mesma sombra; rótulos em CAIXA ALTA espaçada acima de tudo; strings "A · B · C" como enfeite.
- Concentre a ousadia em **um** elemento memorável (no NOMADE RUN, deve ser **o mapa vivo**) e mantenha o resto disciplinado.

### 2.4 Gamificação ética
- Siga a `gamification-loops`: ciclo gatilho → ação → recompensa variável → investimento; **sem punição por descansar**, com congelamento de sequência, saídas fáceis e notificações escassas.
- **Nunca pay-to-win.** Dinheiro compra só cosméticos e conveniência.
- Competição em **ligas por nível** e **esforço relativo**, para iniciantes não serem esmagados por quem corre 100 km por semana.

### 2.5 Segurança, privacidade e saúde
- Corrida segura é recurso **gratuito**: localização ao vivo para contatos, SOS, zonas de privacidade ligadas por padrão, nunca mostrar a posição ao vivo de desconhecidos.
- LGPD: consentimento separado para localização e notificações, exportação e exclusão de dados.
- Não é app médico: nada de diagnóstico ou prescrição.
- Nada de jogo que incentive correr em rodovias, áreas privadas ou de risco.

## 3. Fases e entregáveis

Execute na ordem. Cada fase termina com: entregável salvo no repositório, bloco "Skills aplicadas" e um parágrafo "Decisões e porquês".

### FASE 1 — Descoberta e pesquisa (CEO, CPO, Growth, Tech Lead, Design)
Entregue em `docs/pesquisa/`:
1. `01-mercado-e-concorrentes.md`: funções do Strava (grátis × pago) e suas reclamações; tabela de concorrentes de território com mecânica, força e fraqueza; referências de gamificação; números do mercado brasileiro com fonte.
2. `02-referencias-de-ui.md`: apps referência e o padrão a copiar de cada um; Liquid Glass e Material 3 Expressive; parâmetros de motion; UX de mapa para jogo; onboarding e permissões.
3. `03-stack-tecnica.md`: comparação RN/Expo × Flutter × KMP × nativo para **fluidez, mapa pesado, GPS em segundo plano e velocidade de um time de 2 estudantes**; mapas (Mapbox × MapLibre × Google); GPS em segundo plano; backend; tabela final "Stack recomendada" com versões conferidas no npm.
4. `04-skills.md`: skills encontradas, instaladas e as regras de cada uma que mudam o projeto.

### FASE 2 — Ideação (Game Designer, CPO) — skills `brainstorming`, `gamification-loops`
1. Gere **no mínimo 30 ideias** de minigames, mecânicas sociais e diferenciais.
2. Avalie cada uma em uma matriz **Diversão × Retenção × Esforço técnico × Risco** (1–5).
3. Escolha: **6–8 modos de jogo para a Arena** (o Domínio de território obrigatoriamente entre eles), **3 diferenciais de produto fora do jogo** e uma lista de ideias para depois.

### FASE 3 — Estratégia de produto (CEO, CPO) — skills `prd-writing`, `aso`
Escreva:
- Visão (1 frase), manifesto (1 parágrafo), posicionamento contra Strava e INTVL.
- 3 personas brasileiras com nome, rotina, dor e o que as faria ficar.
- Proposta de valor; **North Star Metric**; 3 métricas de apoio e 2 contra-métricas.
- Pilares do produto e **não-objetivos** explícitos.
- Monetização (freemium, assinatura em reais com Pix, passe de temporada cosmético, zonas patrocinadas) e por que não é pay-to-win.
- Nome, subtítulo (≤ 30 caracteres) e as 3 primeiras screenshots da loja.

### FASE 4 — Game design detalhado (Game Designer, Backend/Geo, QA)
Para **cada modo da Arena**, documente: nome, fantasia em 1 frase, como jogar, regras numéricas (pontos, tempos, raios, limites), condição de vitória, como evita trapaça, como evita desmotivar iniciantes, o que aparece no mapa, notificações (máx. 1 por evento), recompensa, esforço técnico. Inclua também:
- **Domínio (território):** grade H3 (captura e renderização em resoluções coerentes com a ERS ou proposta de mudança justificada), fórmula de pontos com **esforço relativo**, conquista com histerese, ataque, defesa, escudo, decaimento, temporada, placar entre cidades.
- **Economia e progressão:** XP, níveis, moedas (se houver), cosméticos, passe de temporada, sequência semanal com congelamento, ligas por nível; árvore de conquistas validada com `md-skill-tree-architect` (sem pré-requisitos circulares, toda conquista desbloqueia algo real).
- **Antifraude** consolidado (velocidade, saltos, localização simulada, cadência × velocidade, integridade dos dados, Índice de Confiança, shadow-ban, revisão humana).

### FASE 5 — Experiência (Head de Design, CPO)
- Arquitetura de informação (abas e o que vive em cada uma).
- Fluxos passo a passo: onboarding com permissões em duas etapas; primeira corrida; escolher modo na Arena; correr; conquistar; receber alerta e defender; resumo e compartilhamento; Corrida Segura.
- Para cada tela: objetivo, conteúdo, ação principal, estados (carregando, vazio, erro, conteúdo) e acessibilidade.
- Regras da **tela de corrida**: legível ao sol, 3 métricas no máximo, alvos de 56–64 pt, pausar/encerrar com toque longo, coach por voz.

### FASE 6 — Design system (Head de Design) — skills `frontend-design`, `expo-design-system`, `mapbox-cartography`
1. Plano de tokens → **revisão contra o briefing** → plano revisado (registre o que mudou).
2. Cores (marca, superfícies claro/escuro, 4 facções seguras para daltônicos com **padrão de hachura redundante**, estados), tipografia (fontes gratuitas, escala, números tabulares), espaçamento (grid de 4 pt), raios, sombras, ícones.
3. Estilo do mapa: claro de dia, escuro à noite; base dessaturada; territórios como a única cor forte.
4. **Especificação de motion**: tabela com 10 animações assinatura (gatilho, propósito, ferramenta, propriedades, spring ou curva com valores, duração, haptic, versão com movimento reduzido). Use os valores das tabelas da `expo-animation` — sem números inventados.
5. Lista de componentes com variações.

### FASE 7 — Arquitetura técnica (Tech Lead, Backend/Geo, QA) — skills de arquitetura e segurança
- Decisão de stack com justificativa (a pesquisa da Fase 1).
- Diagrama em texto: app ↔ API ↔ banco ↔ tempo real ↔ push ↔ serviços externos.
- Estrutura de pastas do monorepo; separação **domínio puro × interface × infraestrutura**.
- Modelo de dados (tabelas, colunas, índices, **RLS** com `(select auth.uid())`).
- Fluxo de uma corrida: gravação → fila offline → envio em lotes → validação antifraude → cálculo H3 → conquista → broadcast por célula-pai → push.
- Desempenho: orçamento de 60 fps, mapa com milhares de hexágonos via feature-state/vector tiles, bateria.
- Segurança: tokens (`pk.*` no app, `sk.*` só no CI), assinatura dos lotes, limites de taxa, revisão `sharp-edges`.

### FASE 8 — Plano de execução (CPO, Tech Lead) — skill `writing-plans`
- Roadmap em 3 marcos: **MVP do TCC** (o que dá para dois estudantes entregarem e testar), **v1.0 de lançamento** e **v2**.
- Para o MVP: lista de tarefas pequenas, cada uma com critério de aceite e teste.
- Proposta de **ERS v2.0**: requisitos novos e alterados, com IDs.

### FASE 9 — Construir o protótipo funcional (Tech Lead Mobile + Design)
Crie `apps/mobile` com **Expo (SDK estável atual) + Expo Router + TypeScript**, seguindo `expo-project-structure` e `expo-router`. O protótipo deve **rodar no Expo Go** (sem build nativo) e também na web (`npx expo export --platform web`). Inclua no mínimo:
1. **Domínio puro e testado** (`src/domain/`): H3, pontuação (RN-001 com esforço relativo, se adotado), conquista com histerese (RN-002), ataque (RN-003), escudo (RN-004), decaimento (RN-005), antifraude (RN-007, RN-008), Índice de Confiança (RN-009), placar entre cidades (RN-013). **Testes unitários para cada regra, incluindo valores-limite** — esse é o material da disciplina de Teste de Software.
2. **Onboarding** com escolha de facção e explicação das permissões.
3. **Mapa** com territórios hexagonais sobre um mapa real (no protótipo pode ser `react-native-maps`, que roda no Expo Go; documente que a produção usa Mapbox em development build).
4. **Arena** com os modos de jogo, cada um com regra resumida.
5. **Corrida** com GPS real (`expo-location`) **e** um modo "simular corrida" para demonstração e testes, mostrando tempo, distância, ritmo, zona atual e progresso de conquista.
6. **Resumo** com zonas conquistadas/defendidas, trechos invalidados pelo antifraude e a animação de conquista.
7. **Ranking / Liga** e **Perfil** com Corrida Segura.
8. Design system em `src/theme/` aplicado em todas as telas; animações seguindo a especificação da Fase 6 (Reanimated, movimento reduzido respeitado).
Dados de demonstração devem estar **claramente marcados como demonstração** e isolados em um arquivo.

### FASE 10 — Qualidade (QA)
- `npx tsc --noEmit`, `npx expo lint`, testes unitários: tudo passando, com o resultado colado no relatório.
- Exportar para web e tirar screenshots das telas principais; fazer **autocrítica visual** (o que ficou genérico? o que não está legível?) e corrigir.
- Checklist final de cada skill usada.

### FASE 11 — Documento final (todos os chapéus)
Gere o **Product Book** em `docs/produto/` (Markdown + PDF): sumário executivo, pesquisa resumida, estratégia, Arena e regras, economia, experiência, design system, arquitetura, roadmap, riscos e mitigação, métricas, proposta de ERS v2.0 e apêndice de skills aplicadas e fontes. Atualize o `README.md` com como rodar o protótipo.

## 4. Conteúdo obrigatório (checklist)

**Paridade com o Strava (núcleo esportivo):** gravação GPS com pausa automática; ritmo, distância, tempo, parciais, elevação; mapa do percurso; histórico e estatísticas; recordes pessoais; feed com curtidas e comentários; clubes; segmentos; rotas; desafios; zonas de privacidade; edição rápida pós-corrida; retrospectiva anual **grátis**; exportação GPX e integração com HealthKit/Health Connect.

**Diferenciais esperados:** Arena de minigames; território justo para iniciantes; competição entre cidades; Corrida Segura gratuita; coach por voz; mapa vivo como identidade visual; recursos para run clubs e encontros; integração com provas de rua brasileiras.

## 5. Definição de pronto
- Toda afirmação de mercado com fonte ou marcada como [incerto].
- Todas as fases com "Skills aplicadas" e "Decisões e porquês".
- Protótipo roda na web e no Expo Go; typecheck, lint e testes passando.
- Nenhum segredo no código; dados de demonstração identificados.
- Documento final em PDF.

## 6. O que não fazer
- Não pedir confirmação a cada fase: decida, registre o porquê e siga.
- Não inventar números, nomes de skills ou APIs.
- Não usar `@react-navigation/*` direto, `runOnJS`, `Animated` do core para gestos, `expo-av`, nem animar `width/height/margin`.
- Não animar trocas de aba nem ações que acontecem dezenas de vezes por dia.
- Não deixar o território dominar o produto a ponto de quem só quer correr se sentir excluído.
- Não criar mecânica que puna descanso ou exija correr todos os dias.

===== FIM DO PROMPT =====
