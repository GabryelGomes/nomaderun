# MEGA-PROMPT — Construir o aplicativo NOMADE RUN

> **Como usar:** copie tudo a partir da linha `===== COPIE A PARTIR DAQUI =====` e cole numa IA de programação (Claude Code, Cursor, Codex…), de preferência com as skills do arquivo `02-SKILLS-MAP.md` já instaladas no projeto.
> Dica: peça uma **fase por vez** ("Execute a FASE 1") em vez do app inteiro de uma vez — a qualidade sai muito maior.

===== COPIE A PARTIR DAQUI =====

# PAPEL
Você é um time sênior completo trabalhando como uma pessoa só: **Arquiteto de Software**, **Engenheiro Mobile (React Native/Expo)**, **Engenheiro de Back-end/Geoespacial**, **Game Designer**, **Designer de UI/Motion** e **Engenheiro de QA/Segurança**. Você escreve código de produção, tipado, testado e bonito. Você não entrega placeholders ("TODO: implementar") — se algo for simplificado, diga explicitamente o quê e por quê.

# O PRODUTO
**NOMADE RUN** é um app de corrida com todas as funções essenciais do Strava (gravar atividade por GPS, pace, distância, splits, histórico, feed social) **mais um jogo de conquista de território no mapa real da cidade**:
- A cidade é dividida em hexágonos **H3 resolução 9** ("Zonas", ~0,1 km²), agrupados em **H3 resolução 7** ("Distritos").
- Correr dentro de uma zona gera **Run Points (RP)** para o corredor e para a sua **Facção**. A facção com mais influência é a dona da zona.
- Zonas são atacadas, defendidas e fortificadas. Donos recebem **push de invasão** em tempo real.
- Há **Crews** (guildas), **Modo Fantasma** (correr contra o melhor tempo do dono), temporadas, missões e badges.
- Funciona em **qualquer cidade do mundo** (zonas criadas sob demanda) e tem competição **Cidade × Cidade**: cada usuário representa sua cidade natal, e os RP ganhos em qualquer lugar somam para ela.
- Um **anti-cheat rigoroso** impede bicicleta, carro e GPS falso.
- Visual **dark mode cyberpunk neon**, com hexágonos 3D brilhando no mapa, zonas em disputa pulsando e explosões de partículas ao conquistar.
- Idioma da interface: **português do Brasil** (com i18n preparado para inglês).

# REGRA DE OURO: SKILLS DO SKILLS.SH
Este projeto segue obrigatoriamente as skills do diretório https://skills.sh. **Antes de cada fase, leia o `SKILL.md` das skills indicadas e aplique as regras delas.** Ao final de cada fase, escreva um bloco "Skills aplicadas" listando quais regras de cada skill você seguiu (com o nome da regra/seção). Se uma skill não estiver instalada, instale com o comando indicado.

| Área | Skill (dono/repositório → skill) | Comando |
|---|---|---|
| Arquitetura | pproenca/dot-skills → `clean-architecture` | `npx skills add pproenca/dot-skills --skill clean-architecture` |
| UI nativa / navegação | expo/skills → `building-native-ui` | `npx skills add expo/skills --skill building-native-ui` |
| Dados / offline | expo/skills → `native-data-fetching` | `npx skills add expo/skills --skill native-data-fetching` |
| Estilização | expo/skills → `expo-tailwind-setup` | `npx skills add expo/skills --skill expo-tailwind-setup` |
| Performance RN | vercel-labs/agent-skills → `react-native-skills` | `npx skills add vercel-labs/agent-skills --skill react-native-skills` |
| Composição de componentes | vercel-labs/agent-skills → `vercel-composition-patterns` | `npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns` |
| Mapa mobile | mapbox/mapbox-agent-skills → `mapbox-android-patterns`, `mapbox-ios-patterns` | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-android-patterns` |
| Estilo do mapa | mapbox/mapbox-agent-skills → `mapbox-cartography`, `mapbox-style-patterns` | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-cartography` |
| Hexágonos / heatmap / 3D | mapbox/mapbox-agent-skills → `mapbox-data-visualization-patterns` | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-data-visualization-patterns` |
| Geoespacial | mapbox/mapbox-agent-skills → `mapbox-geospatial-operations` | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-geospatial-operations` |
| Token do mapa | mapbox/mapbox-agent-skills → `mapbox-token-security` | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-token-security` |
| Design visual | anthropics/skills → `frontend-design` | `npx skills add anthropics/skills --skill frontend-design` |
| Paleta / tipografia | nextlevelbuilder/ui-ux-pro-max-skill → `ui-ux-pro-max` | `npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max` |
| Animações | bjornmelin/dev-skills → `expo-motion` | `npx skills add bjornmelin/dev-skills --skill expo-motion` |
| Banco de dados | supabase/agent-skills → `supabase-postgres-best-practices` | `npx skills add supabase/agent-skills --skill supabase-postgres-best-practices` |
| Tempo real | adaptationio/skrillz → `supabase-realtime` | `npx skills add adaptationio/skrillz --skill supabase-realtime` |
| Segurança | trailofbits/skills → `insecure-defaults`, `sharp-edges`, `differential-review`, `static-analysis` | `npx skills add trailofbits/skills --skill insecure-defaults` |
| OWASP / API | agamm/claude-code-owasp → `owasp-security` | `npx skills add agamm/claude-code-owasp --skill owasp-security` |
| Carga (k6) | davila7/claude-code-templates → `k6-load-testing` | `npx skills add davila7/claude-code-templates --skill k6-load-testing` |
| E2E mobile | tovimx/maestro-mobile-testing-skill → `maestro-mobile-testing` | `npx skills add tovimx/maestro-mobile-testing-skill --skill maestro-mobile-testing` |
| E2E web | bobmatnyc/claude-mpm-skills → `playwright` | `npx skills add bobmatnyc/claude-mpm-skills --skill playwright` |
| Painel web | vercel-labs/agent-skills → `vercel-react-best-practices`, `web-design-guidelines` | `npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices` |

Se o nome exato de uma skill não for encontrado, rode `npx skills add <dono/repositorio> --list` e use o nome correto.

# STACK OBRIGATÓRIA
**Monorepo** com `pnpm` workspaces + Turborepo:
```
nomaderun/
├─ apps/
│  ├─ mobile/          # Expo SDK (última estável) + Expo Router + TypeScript strict
│  └─ web/             # Next.js (App Router) — painel ao vivo + moderação anti-cheat + landing
├─ packages/
│  ├─ domain/          # Regras de negócio PURAS (sem React, sem Supabase): pontuação, anti-cheat, conquista
│  ├─ ui/              # Design tokens + componentes compartilhados
│  └─ config/          # tsconfig, eslint, prettier
├─ supabase/
│  ├─ migrations/      # SQL versionado (PostGIS + h3-pg)
│  ├─ functions/       # Edge Functions (Deno/TypeScript)
│  └─ seed.sql         # Dados de demonstração (Goiânia)
└─ tests/
   ├─ load/            # k6
   ├─ e2e-mobile/      # Maestro
   └─ e2e-web/         # Playwright
```

- **Mobile:** Expo, Expo Router, TypeScript strict, NativeWind (Tailwind), `@rnmapbox/maps`, `h3-js`, `expo-location` + `expo-task-manager` (GPS em segundo plano), `expo-sensors` (Pedometer + Accelerometer), `expo-notifications`, `expo-haptics`, `expo-av`/`expo-audio` (sons e voz), `expo-sqlite` (fila offline), `react-native-reanimated` v4, `react-native-gesture-handler`, `@shopify/react-native-skia` (glow e partículas), TanStack Query, Zustand, Zod, i18next.
- **Back-end:** Supabase (Postgres + **PostGIS** + **h3-pg**, Auth, Realtime, Storage, Edge Functions, `pg_cron`).
- **Web:** Next.js + Tailwind + Mapbox GL JS + `deck.gl` (H3HexagonLayer) para o mapa ao vivo.
- **Qualidade:** ESLint, Prettier, Vitest (domínio), Jest + React Native Testing Library (componentes), Maestro, Playwright, k6, Semgrep no CI (GitHub Actions).

# ARQUITETURA (skill `clean-architecture`)
- **Regra de dependência:** `apps/*` → `packages/domain`. O domínio nunca importa framework.
- Camadas no app mobile: `features/<feature>/{ui, hooks, services}`; serviços falam com o back-end através de **interfaces (ports)** definidas no domínio, implementadas por **adapters** (Supabase, Mapbox, sensores).
- **Toda regra de pontuação e anti-cheat vive em `packages/domain`** e é executada **duas vezes**: no app (feedback instantâneo, "otimista") e na Edge Function (fonte da verdade). O servidor **sempre recalcula** — nunca confia em pontos enviados pelo cliente.
- Funções puras e determinísticas, 100% cobertas por testes unitários (alvo: ≥ 90% de cobertura em `packages/domain`).

# MODELO DE DADOS (Postgres) — skill `supabase-postgres-best-practices`
Crie migrations SQL com estas tabelas (tipos exatos, PKs `uuid`, `created_at timestamptz default now()`, índices e **RLS habilitado em todas**):
- `profiles` (id = auth.users.id, username único, avatar_url, faction_id, crew_id, home_city_id, level, xp, trust_score int default 100, privacy_radius_m int default 200, home_point geography(Point) nullable).
- `factions` (id, slug, name, color_hex) — seed: `neon-striders #00F0FF`, `urban-coyotes #FF6B1A`, `night-owls #B026FF`, `volt-runners #C6FF00`.
- `crews` (id, name, tag 3–5 letras, faction_id, owner_id, max_members 30).
- `activities` (id, user_id, started_at, ended_at, distance_m, moving_time_s, avg_pace_s_per_km, status enum `recording|processing|valid|partially_valid|rejected|under_review`, cheat_flags jsonb, route geography(LineString), client_hmac text).
- `activity_points` (activity_id, seq, ts, lat, lng, accuracy_m, speed_mps, altitude_m, steps_delta, is_mocked bool) — particionada por mês; índice em (activity_id, seq).
- `cities` (id, name, state, country, ibge_code nullable, boundary geography(MultiPolygon)) — malha do IBGE no Brasil, OSM no exterior.
- `zones` (h3_index h3index PK, district_h3 h3index, city_id, owner_faction_id nullable, shield_level smallint 0–3, is_blocked bool, name text nullable, last_battle_at).
- `zone_influence` (h3_index, faction_id, influence numeric, updated_at) — PK composta.
- `zone_contributions` (activity_id, user_id, h3_index, meters, rp, multipliers jsonb, day date) — para teto diário e auditoria.
- `zone_events` (id, h3_index, type enum `captured|under_attack|defended|neutralized|fortified`, faction_id, created_at).
- `ghost_runs` (h3_index, user_id, best_time_s, path jsonb).
- `seasons`, `missions`, `user_missions`, `badges`, `user_badges`, `follows`, `respects` (curtidas), `comments`, `push_tokens`, `cheat_reports`.
- Índices GiST em colunas geography; índices B-tree nas FKs; `pg_cron` diário para decaimento de influência.
- Políticas RLS: usuário lê/edita só o próprio perfil e atividades; zonas e influência são leitura pública; escrita de influência **somente** pela service role (Edge Functions).

# REGRAS DO JOGO (implementar em `packages/domain`, com testes para cada uma)
**RN-01 — Cálculo de Run Points por zona**
```
RP = metros_validos_no_hex × 0.1 × M_pace × M_streak × M_ghost × M_pack × M_defesa
M_pace   = clamp(360 / pace_s_por_km, 0.75, 1.50)      // referência 6:00 min/km
M_streak = 1 + 0.05 × min(dias_seguidos, 10)           // até +50%
M_ghost  = 1.5 se venceu o fantasma do dono, senão 1.0
M_pack   = 1.25 se ≥ 3 membros da mesma Crew a ≤ 50 m durante ≥ 60% do trecho, senão 1.0
M_defesa = 2.0 se a zona é da facção do corredor e está "sob ataque", senão 1.0
RP final do hex arredondado para inteiro; teto de 300 RP por usuário por hex por dia.
```
**RN-02 — Conquista com histerese:** zona neutra é conquistada quando uma facção atinge ≥ 100 de influência. Zona com dono só troca quando `influencia_desafiante ≥ influencia_dono × 1.10`.

**RN-03 — Alerta de Invasão:** quando `influencia_inimiga ≥ 0.5 × influencia_dono`, cria `zone_events(under_attack)`, envia push para membros da facção dona que correram naquela zona nos últimos 30 dias (máx. 1 push por zona a cada 6h por usuário) e abre **janela de defesa de 24h**.
Texto: `⚠️ Alerta de Invasão! Seu território em {nome_zona} está sendo conquistado pelos {faccao}. Corra lá nas próximas 24h para defender.`

**RN-04 — Fortificação:** cada dia seguido com ≥ 500 m corridos pela facção dona na zona sobe o escudo (máx. 3); o escudo reduz o RP inimigo em 10% / 20% / 30%. Um dia sem corrida da facção dona → escudo −1.

**RN-05 — Decaimento:** todo dia às 03:00 (America/Sao_Paulo) a influência de todas as facções em todas as zonas é multiplicada por 0.90. Abaixo de 5 → zera. Se o dono cair abaixo de 100 → zona volta a ser neutra (`neutralized`).

**RN-06 — Temporada:** mensal; no reset a influência é multiplicada por 0.30, rankings congelados e badges entregues.

**RN-07 — Zonas bloqueadas:** hexágonos sobre rodovias, água e aeroportos (`is_blocked = true`) não geram RP e aparecem hachurados no mapa.

**RN-08 — Privacidade:** pontos dentro de `privacy_radius_m` do `home_point` não aparecem em nenhuma visualização pública (mas contam RP).

**RN-09 — Cidade × Cidade:** pontuação da cidade na temporada = soma dos RP dos usuários com aquela cidade natal (ganhos em qualquer lugar) ÷ √(corredores ativos). Só entram cidades com ≥ 20 corredores ativos. Zonas são criadas sob demanda na primeira corrida em uma área nova, associadas à cidade pelo limite municipal. Badge "Nômade" ao correr em 1, 5 e 10 cidades.

# ANTI-CHEAT (skills `insecure-defaults`, `sharp-edges`, `owasp-security`)
Implemente `validateActivity(points): { segments, flags, trustDelta }` em `packages/domain`:
1. **Precisão:** descartar pontos com `accuracy_m > 30`.
2. **Velocidade:** trecho com velocidade média > 25 km/h por > 30 s → inválido; qualquer ponto > 40 km/h → inválido; flag `VEHICLE_SUSPECTED`.
3. **Teletransporte:** deslocamento > 50 m entre pontos com Δt ≤ 1 s → flag `TELEPORT`, trecho inválido.
4. **Mock location:** `is_mocked = true` em qualquer ponto → atividade `rejected`, flag `MOCK_LOCATION`, `trust_score −30`.
5. **Cadência vs velocidade:** quando a velocidade estiver entre 8 e 20 km/h, cadência do pedômetro deve estar entre 120 e 220 passos/min; abaixo de 60 passos/min por > 60 s → flag `NO_STEPS`, trecho inválido.
6. **Acelerômetro:** variância da magnitude em janelas de 5 s deve ser compatível com corrida (limiar configurável); vibração "lisa" demais com velocidade alta → `VEHICLE_SUSPECTED`.
7. **Integridade:** o app assina o lote de pontos com HMAC-SHA256 (chave por dispositivo emitida no login e guardada no SecureStore); servidor valida assinatura, `seq` contínuo, timestamps monotônicos e rejeita reenvio (idempotência por `activity_id + seq`).
8. **Trust Score:** começa em 100; cada flag reduz; < 40 → atividades vão para `under_review` (fila no painel web) e não pontuam até aprovação.
9. Nunca logar token/chave; segredos só em variáveis de ambiente; rate limit de 1 lote/2 s por usuário na ingestão.

# TELAS (skills `building-native-ui`, `frontend-design`, `ui-ux-pro-max`, `expo-motion`)
1. **Splash + Onboarding (3 telas)** — explica conquistar/defender/crew com ilustrações animadas; pede permissões de localização (primeiro "enquanto usa", depois "sempre", explicando o motivo) e notificações.
2. **Escolha de Facção** — 4 cartões grandes em neon, com hino/descrição, contagem de membros e % do mapa da cidade dominado; selecionar faz o cartão "acender".
3. **Mapa (Home, aba principal)** — mapa escuro, hexágonos 3D coloridos por facção, zonas em disputa pulsando, sua posição com halo; topo: chip da sua facção + RP do dia; botão flutuante grande **"CORRER"**; filtro de camadas (Território / Heatmap 24h / Minhas zonas / Energy Cells). Tocar num hex abre **bottom sheet da Zona**: nome, dono, barra de influência por facção, escudo, top 3 corredores, botão "Desafiar Fantasma".
4. **Corrida ao vivo** — números gigantes (tempo, distância, pace) em JetBrains Mono; mini-mapa com rastro neon tipo cometa; indicador da zona atual com barra de influência subindo em tempo real; aviso vermelho nas bordas ao entrar em território inimigo; avatar do fantasma quando ativo; slide-to-stop (evitar parada acidental); tela sempre visível e legível sob sol.
5. **Resumo da corrida** — contadores animados, mapa do trajeto, splits, gráfico de pace, lista "Zonas afetadas" (+RP, conquistada/defendida), badges ganhas, flags do anti-cheat explicadas com linguagem amigável, botão **Compartilhar Recap** (vídeo/imagem 9:16).
6. **Feed** — atividades de quem você segue e da Crew, "Respect" com animação, comentários.
7. **Crew** — membros, ranking interno, metas semanais, chat simples, zonas da Crew.
8. **Ranking** — por facção, crew e individual; filtro distrito/cidade/estado/país/global/temporada; aba **Cidade × Cidade** com o placar das cidades e a sua cidade natal destacada.
9. **Perfil** — avatar com cosméticos, nível/XP, badges, estatísticas, "Prefeito de…", configurações (privacidade, unidades, voz, reduzir movimento).
10. **Notificações** — central com alertas de invasão, conquistas, missões.

Navegação: tabs nativas (Mapa · Feed · Correr [central] · Ranking · Perfil).

# DESIGN SYSTEM (tokens em `packages/ui`)
- **Cores:** `bg #0A0B10`, `surface #12141C`, `surface-2 #1A1D29`, `border #2A2F3F`, `text #E8ECF4`, `text-muted #8A93A8`, `danger #FF2E63`, `success #00FF9C`, `warning #FFD600`, facções `#00F0FF`, `#FF6B1A`, `#B026FF`, `#C6FF00`.
- **Tipografia:** Orbitron (display), Space Grotesk (títulos), Inter (texto), JetBrains Mono (números tabulares).
- **Espaçamento:** escala 4/8/12/16/24/32/48; raio 12/20/999.
- **Glow:** sombra colorida da facção (blur 16–24) + borda 1 px com 60% de opacidade.
- Contraste mínimo **WCAG AA (4.5:1)** para todo texto; alvos de toque ≥ 44×44 pt.
- Light mode opcional, mas o padrão é dark.

# EFEITOS VISUAIS E MOTION (obrigatórios)
| Momento | Efeito | Tecnologia |
|---|---|---|
| Mapa carregando | hexágonos "sobem" do chão em onda (stagger por distância do usuário) | Mapbox fill-extrusion + interpolação de altura |
| Zona em disputa | pulso de opacidade/altura a cada 1,5 s na cor do atacante | expressão Mapbox animada via `setFeatureState` |
| Conquista | onda de luz no hex, explosão de 40 partículas na cor da facção, haptic `success`, som de 400 ms, toast "ZONA CONQUISTADA" | Skia + Reanimated + expo-haptics |
| Rastro da corrida | linha neon com gradiente que esmaece atrás (efeito cometa) | `line-gradient` do Mapbox |
| Território inimigo | vinheta vermelha nas bordas + voz "Você entrou em território {faccao}" | Reanimated + TTS/áudio |
| Números | contagem animada (rolling digits) | Reanimated |
| Botão CORRER | respiração suave (scale 1→1.04) + glow pulsante | Reanimated |
| Recap | trajeto desenhado progressivamente pintando os hexágonos | Skia → exportar vídeo/imagem |
- Todas as animações a **60 fps** rodando na UI thread (worklets).
- Se `useReducedMotion()` estiver ativo: sem pulsos, partículas ou ondas; apenas mudanças de cor instantâneas.

# TEMPO REAL E NOTIFICAÇÕES (skill `supabase-realtime`)
- Canal `zones:{district_h3}` (Broadcast) com mudanças de dono/influência; o app assina só os distritos visíveis na tela.
- Canal `crew:{crew_id}` (Presence) para mostrar quem da Crew está correndo agora.
- Push via Expo Push Service disparado por Edge Function a partir de `zone_events`.

# API / EDGE FUNCTIONS
- `POST /ingest-points` — lote de até 50 pontos `{activity_id, seq_start, points[], hmac}`; valida Zod + HMAC + rate limit; resposta `202` em < 200 ms (processamento assíncrono).
- `POST /finish-activity` — fecha a atividade, roda `validateActivity` + cálculo de RP + conquista em transação; retorna resumo.
- `GET /zones?bbox=` — zonas e influência no retângulo visível (cache 10 s).
- `GET /zone/:h3` — detalhe da zona.
- `POST /ghost/:h3/start` — retorna o caminho do fantasma.
- Erros padronizados `{code, message}`; nada de stack trace para o cliente.

# REQUISITOS NÃO FUNCIONAIS (metas mensuráveis)
- **Desempenho (k6):** `/ingest-points` com 5.000 usuários virtuais simultâneos enviando 1 lote/5 s → **p95 < 300 ms, p99 < 800 ms, erros < 0,5%**; cenários smoke, load, stress, spike e soak (2 h) em `tests/load/` com `thresholds` que falham o CI.
- **Mapa:** primeira renderização da Home < 2,5 s em Android intermediário; 60 fps ao arrastar com até 2.000 hexágonos visíveis.
- **Bateria:** ≤ 8% por hora de corrida com tela desligada (GPS a cada 1 s, sensores em lote).
- **Offline:** corrida inteira gravada sem internet, fila no SQLite, sincronização automática com retentativa exponencial; zero perda de pontos.
- **Precisão:** distância com erro ≤ 3% em percurso aferido de 5 km (céu aberto).
- **Segurança:** OWASP ASVS nível 1, RLS em todas as tabelas, HTTPS/TLS 1.2+, tokens JWT com expiração de 1 h + refresh, token Mapbox com escopo e restrição de URL/bundle (skill `mapbox-token-security`), Semgrep sem achados "high" no CI.
- **Acessibilidade:** WCAG AA, labels para leitor de tela em todos os controles, reduzir movimento respeitado.
- **LGPD:** consentimento explícito para localização, exportar e excluir conta e dados em até 30 dias.

# TESTES (obrigatórios em cada fase)
- **Unitários (Vitest):** todas as RNs e todas as regras anti-cheat, incluindo casos-limite (exatamente 25 km/h, exatamente +10%, teto de 300 RP, decaimento abaixo de 5).
- **Fixtures de GPS** em `packages/domain/fixtures/`: `corrida_valida_5km.json`, `bicicleta_22kmh.json`, `carro_45kmh.json`, `teletransporte.json`, `mock_location.json`, `sem_passos.json`, `sinal_ruim.json`.
- **Componentes (Jest + RNTL):** bottom sheet da zona, HUD da corrida, resumo.
- **E2E mobile (Maestro):** onboarding → escolher facção → simular corrida (rota GPX mockada) → ver zona conquistada → receber alerta. Use `testID` em todo elemento interativo.
- **E2E web (Playwright):** painel ao vivo carrega hexágonos; moderador aprova/rejeita atividade `under_review`; testes visuais com `toHaveScreenshot()` (tema dark, cores da facção, estado "sob ataque").
- **Carga (k6):** ver RNF de desempenho.
- **Segurança:** testes que provam que o cliente não consegue escrever influência diretamente (RLS), que HMAC inválido é rejeitado e que reenvio do mesmo lote é idempotente.

# FASES DE ENTREGA (execute uma por vez; ao final de cada uma, rode lint + testes e mostre o resultado)
- **FASE 0 — Fundação:** monorepo, configs, design tokens, CI (lint, typecheck, testes, Semgrep), Supabase local, migrations + seed com ~500 zonas em Goiânia (Parque Flamboyant, Setor Bueno, Praça Tamandaré, Lago das Rosas…).
- **FASE 1 — Domínio:** `packages/domain` completo (RN-01 a RN-09 + anti-cheat) com fixtures e ≥ 90% de cobertura.
- **FASE 2 — Corrida (núcleo Strava):** auth, onboarding, permissões, gravação em background, HUD ao vivo, fila offline, resumo, histórico.
- **FASE 3 — Mapa e Território:** mapa dark customizado, hexágonos 3D, bottom sheet da zona, ingestão + conquista no servidor, realtime por distrito.
- **FASE 4 — Social e Facções:** facções, crews, feed, respect, ranking, push de invasão, janela de defesa, fortificação.
- **FASE 5 — Game feel:** todas as animações da tabela, sons, haptics, Modo Fantasma, missões, badges, Energy Cells, recap compartilhável.
- **FASE 6 — Painel web:** mapa ao vivo (deck.gl H3), heatmap 24h, fila de moderação anti-cheat, métricas.
- **FASE 7 — Qualidade final:** Maestro, Playwright, k6, revisão de segurança (`differential-review`), auditoria de acessibilidade, README com como rodar tudo.

# CRITÉRIOS DE PRONTO (Definition of Done) de cada fase
- `pnpm lint && pnpm typecheck && pnpm test` passam sem erros.
- Nenhum segredo commitado; `.env.example` atualizado.
- Telas novas com `testID`, labels de acessibilidade, estados de carregando / vazio / erro.
- Bloco "Skills aplicadas" escrito.
- Lista do que ficou simplificado e por quê.

# O QUE NÃO FAZER
- Não confiar em nenhum número calculado no cliente para pontuar.
- Não usar `any` em TypeScript; não desabilitar regras de lint para "passar".
- Não usar cores fora dos tokens; não usar fontes padrão do sistema nos números.
- Não pedir localização "sempre" antes de explicar o motivo.
- Não colocar objetivos/drops do jogo em zonas bloqueadas.
- Não apresentar o app como ferramenta médica (sem diagnóstico, sem "zonas cardíacas" com recomendação de saúde).

Comece pela **FASE 0**. Antes de escrever código, mostre: (1) a árvore de pastas final, (2) o diagrama de arquitetura em texto, (3) as skills que vai ler nesta fase. Depois implemente.

===== FIM DO PROMPT =====
