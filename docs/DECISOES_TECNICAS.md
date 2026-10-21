# Decisões técnicas

Formato: **D-xx — título** · data · responsável · contexto → decisão → justificativa → consequências.
Nunca apague uma decisão: se mudar, crie outra que a substitua ("Substitui D-xx").

---

### D-01 — Backend em Supabase (Postgres + PostGIS, Auth, Edge Functions, Realtime)
2026-10-20 · Arquiteto
- **Contexto:** o ERS (§2.4, §2.5, §6.3) já define Supabase, PostgreSQL e PostGIS. O time tem 2 pessoas e prazo de disciplina.
- **Decisão:** usar Supabase. Localmente com `supabase` CLI (Docker); na apresentação, Supabase Cloud no plano gratuito.
- **Justificativa:** auth com bcrypt e JWT pronta (RNF-007), RLS no banco (controle de acesso por usuário), PostGIS para consultas por área (RNF-009), Edge Functions em TypeScript (reaproveitam as regras), Realtime para o mapa (RNF-003). Validado neste ambiente: a stack local sobe por completo.
- **Consequências:** é preciso Docker para desenvolver o backend; o app depende de duas variáveis públicas de ambiente.

### D-02 — `src/domain` é a fonte única das regras, usada no app e no servidor
2026-10-20 · Arquiteto
- **Contexto:** RNF-006 exige que o servidor recalcule tudo; RNF-008 exige as regras isoladas e com ≥ 90% de cobertura. O domain atual já é puro e testado.
- **Decisão:** as Edge Functions importam `apps/mobile/src/domain` (caminho relativo + import map de `h3-js`). Se o bundler do Supabase não aceitar, o backend usa uma cópia gerada por script em `supabase/functions/_shared/domain`, com um teste que falha quando as duas divergem.
- **Justificativa:** evita duas implementações das mesmas regras; o resultado provisório no app é idêntico ao oficial.
- **Consequências:** `src/domain` não pode importar nada de React/Expo (já é assim) e mudanças nele afetam app e servidor.
- **Resultado (2026-10-20, A2):** testado com `supabase functions serve`: o import relativo funciona **sem o plano B**, com uma ponte (`supabase/functions/_shared/domain.ts`), remapeamento dos imports sem extensão no `deno.json` e o h3-js vendorizado. Detalhes e verificação automática na D-22.

### D-03 — Gravação offline com fila SQLite e ingestão idempotente
2026-10-20 · Arquiteto
- **Decisão:** cada corrida recebe um UUID no aparelho; cada ponto tem `seq`. Pontos vão primeiro para o `expo-sqlite`. O servidor tem chave única `(activity_id, seq)` e ignora duplicados.
- **Justificativa:** RF-005 / RNF-005 (sem perda e sem duplicação), UC-01 A1.

### D-04 — Assinatura HMAC-SHA256 por aparelho
2026-10-20 · Arquiteto
- **Decisão:** no primeiro login o app gera 32 bytes aleatórios (`expo-crypto`), guarda no `expo-secure-store` e registra no servidor (`register-device`, autenticado). Cada lote é assinado sobre um JSON canônico `{activityId, deviceId, fromSeq, toSeq, points}`. O servidor recusa assinatura inválida, `seq` fora de ordem e reenvio com conteúdo diferente.
- **Justificativa:** RNF-006.
- **Consequências / limite:** a chave simétrica trafega uma vez por TLS no registro. Para produção, trocar por chave assimétrica com atestação do aparelho (Play Integrity / App Attest).

### D-05 — Autenticação por e-mail e senha no MVP; Google/Apple opcionais
2026-10-20 · Arquiteto
- **Decisão:** Supabase Auth com e-mail e senha, JWT de 1 h (`jwt_expiry = 3600`) com refresh automático, recuperação de senha por e-mail. Idade ≥ 16 e aceite de termos validados no app **e** no banco (trigger na criação do perfil). Botões Google/Apple só aparecem se o provedor estiver configurado.
- **Justificativa:** RF-001 sem depender de contas de desenvolvedor Apple/Google para a demonstração.

### D-06 — Sessão no expo-secure-store
2026-10-20 · Arquiteto
- **Decisão:** adapter de storage do supabase-js sobre `expo-secure-store`, dividindo valores grandes em partes.
- **Justificativa:** RNF-007 (tokens fora de armazenamento em texto puro).

### D-07 — Papéis no banco e RLS em todas as tabelas
2026-10-20 · Arquiteto
- **Decisão:** `profiles.role` (`runner`, `moderator`, `admin`). Policies usam `auth.uid()` e as funções `is_staff()` / `is_admin()`. Escrita em zonas e no resultado das corridas só pelo service role.
- **Justificativa:** RNF-007 ("cada usuário acessa apenas os próprios dados privados"), RF-002 (admin inativa contas), RF-018.

### D-08 — Painel web de moderação dentro do próprio app Expo (web)
2026-10-20 · Arquiteto
- **Decisão:** rota `/moderacao` no Expo Router, visível só para `moderator`/`admin`, usada pelo navegador (`npx expo start --web`).
- **Justificativa:** RF-018 sem uma terceira base de código; reaproveita o design system e o mapa web (MapLibre), que já existem.

### D-09 — Mapas: manter react-native-maps (nativo) e MapLibre (web)
2026-10-20 · Arquiteto
- **Decisão:** não migrar para Mapbox no MVP.
- **Justificativa:** roda no Expo Go, não precisa de token, e o visual atual já foi aprovado. O ERS permite alternativa ao Mapbox (§2.5).

### D-10 — GPS: primeiro plano no Expo Go, segundo plano em development build
2026-10-20 · Arquiteto
- **Decisão:** `expo-location` com `BestForNavigation` a cada 1 s e a tela mantida acesa durante a corrida; tarefa em segundo plano (`expo-task-manager`) atrás de uma flag, ativa só em development build. Pedômetro via `expo-sensors`.
- **Justificativa:** RF-004 funciona na demonstração com Expo Go; a limitação fica documentada.

### D-11 — Zonas com geometria PostGIS calculada pelo servidor
2026-10-20 · Arquiteto
- **Decisão:** `zones.id` = índice H3 (texto); a geometria (polígono) é calculada com `h3-js` na Edge Function quando a zona nasce, e indexada com GiST. A consulta `zones_in_bbox` usa `ST_Intersects`.
- **Justificativa:** RNF-009 e RF-020 (zonas criadas na primeira corrida em qualquer cidade) sem depender da extensão h3-pg.

### D-12 — Estado no app: Zustand + repositórios
2026-10-20 · Arquiteto
- **Decisão:** manter Zustand (já usado) e adicionar a camada `src/services/api` com repositórios. Sem nova biblioteca de cache.
- **Justificativa:** menos dependências e mudanças mínimas nas telas aprovadas.

### D-13 — Notificações: central no app + Realtime; push como extra
2026-10-20 · Arquiteto
- **Decisão:** tabela `notifications` alimentada pelo servidor, lida pela central do app (RF-019) e pela assinatura Realtime. Push com `expo-notifications` fica pronto para development build.
- **Justificativa:** limitação do Expo Go; RF-009 continua demonstrável no app.

### D-14 — Estratégia de testes
2026-10-20 · Arquiteto / QA
- **Decisão:** Jest (domain com limite de 90% de cobertura de linhas e ramos; services com mocks), pgTAP (`supabase test db`) para RLS e funções SQL, `deno test` para as Edge Functions, fluxos Maestro (`.maestro/`) para UC-01..03 e testIDs fixos em todo elemento interativo.
- **Justificativa:** RNF-008, RNF-012.

### D-15 — Preservar a identidade visual atual ("Pista")
2026-10-20 · Arquiteto (pedido dos autores)
- **Contexto:** o ERS §6.2 descreve a paleta "Asfalto & Giz"; o app hoje usa o design system "Pista" (laranja, neutros quentes, Inter), aprovado pelos autores.
- **Decisão:** manter `src/theme/tokens.ts` e os componentes atuais. Telas novas reutilizam `Text`, `Button`, `Surface`, `TeamBadge` e os tokens.
- **Consequências:** a seção 6.2 do ERS deve ser atualizada numa próxima revisão para refletir o visual aprovado.

### D-16 — Cliente Supabase no app: sem polyfill de URL, sessão em partes no SecureStore, web com localStorage
2026-10-20 · A3 Frontend
- **Contexto:** D-06 pede a sessão no SecureStore; o Keychain/Keystore aceita ~2 KB por chave e a sessão do Supabase passa disso. O supabase-js usa `URL`/`URLSearchParams`; o painel web e o `expo export -p web` (renderização estática em Node) também usam o cliente.
- **Decisão:** `src/services/api/supabase.ts` cria um cliente único com `autoRefreshToken`, `persistSession`, `detectSessionInUrl: false`; storage = adapter que divide o valor em partes de até 1.800 bytes UTF-8 (`chave__0..n` + `chave__chunks`), com `keychainAccessible: AFTER_FIRST_UNLOCK`; no web, `localStorage`; durante a renderização estática (sem `window`), sem persistência nem refresh. Auto-refresh liga/desliga com o `AppState`. **Não** usar `react-native-url-polyfill`: o runtime do Expo SDK 57 já instala `URL` e `URLSearchParams` (`expo/src/winter`). Sem `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `getSupabase()` devolve `null` e o app mostra "Backend não configurado".
- **Justificativa:** RNF-007 sem dependência extra; o export web não trava; falha de configuração fica explícita.
- **Consequências:** parte faltando no SecureStore = sessão descartada (pede login). Telas e stores nunca importam `supabase.ts`; só os repositórios.

### D-17 — Sessão, perfil e guardas de rota: session-store + controlador + função pura
2026-10-20 · A3 Frontend
- **Contexto:** o `_layout.tsx` decidia as rotas pelo `onboarded` do `game-store`, em memória. Agora a decisão depende da sessão do Auth, do perfil no servidor (facção) e do fluxo de recuperação de senha.
- **Decisão:** `src/store/session-store.ts` guarda status (`loading|unconfigured|signedOut|signedIn`), sessão, perfil e `recovering`; `src/features/auth/session-controller.ts` orquestra repositórios ↔ stores (stores não importam serviços); `resolveRouteGroup()` (pura, testada) escolhe o grupo liberado no `Stack.Protected`: `auth`, `recovery`, `onboarding`, `app`, `unavailable` ou splash. O `game-store` continua com a mesma API e passa a receber `name`/`faction` (e `xp`/`trust` no primeiro carregamento) do perfil por `applyProfile`; `resetForSignOut` no logout. O último perfil fica em cache (`expo-sqlite/kv-store`, `localStorage` no web) para o app abrir sem internet.
- **Justificativa:** o servidor é a fonte da facção (RF-003); a lógica de navegação fica testável; a corrida (A4) não precisa mudar.
- **Consequências:** depois que a navegação montou, um "splash" passageiro (perfil carregando após o login) mantém a tela anterior em vez de desmontar o Stack.

### D-18 — Links de autenticação por `nomaderun://` (recuperação de senha e confirmação)
2026-10-20 · A3 Frontend
- **Decisão:** o app pede `redirectTo = Linking.createURL('/nova-senha')` (recuperação) e `/entrar` (confirmação/login social). O controlador lê o link inicial e os eventos `url`, aceita tokens no fragmento (fluxo implícito, padrão) e `?code=` (PKCE), cria a sessão (`setSession`/`exchangeCodeForSession`) e marca `recovering` quando `type=recovery`, liberando só a tela "Nova senha" até a senha ser trocada. Link expirado mostra a mensagem e o atalho "Pedir novo link". O backend (A2) já libera `nomaderun://**` em `additional_redirect_urls`.
- **Justificativa:** RF-001 (recuperação por e-mail) funcionando no Expo Go e em development build.

### D-19 — Cadastro: validação no app, nome conferido antes do signUp e metadados para o trigger
2026-10-20 · A3 Frontend
- **Contexto:** quando o trigger `handle_new_user` recusa o cadastro, o Auth devolve só "Database error saving new user", sem o motivo.
- **Decisão:** o app valida tudo antes (e-mail, senha ≥ 8 com medidor de força, nome `^[A-Za-z0-9_.]{3,20}$`, nascimento DD/MM/AAAA com 16+, dois aceites separados), chama o RPC `username_available` e só então o `signUp`, enviando em `options.data`: `username`, `birthdate` (AAAA-MM-DD), `accepted_terms`, `accepted_privacy`, `terms_version`, `privacy_version` e os instantes dos aceites. O erro genérico do trigger vira mensagem amigável. Mensagens do backend no formato `CODIGO: texto` são separadas (código em `AppError.detail`, texto pt-BR para a tela). A permissão de notificações tem etapa própria no onboarding, separada da localização (RNF-013).
- **Justificativa:** RF-001, RNF-013 e mensagens claras sem depender do texto interno do Auth.
- **Consequências:** o backend continua validando (16+, aceites, nome único); o app é a primeira barreira, não a única.

### D-20 — GPS em segundo plano atrás de flag de build (`app.config.js`)
2026-10-20 · A3 Frontend
- **Decisão:** o `app.json` mantém o segundo plano desligado; `app.config.js` liga `isIosBackgroundLocationEnabled`, `isAndroidBackgroundLocationEnabled` e `isAndroidForegroundServiceEnabled` só com `NOMADE_BACKGROUND_LOCATION=1` no build/prebuild e expõe `extra.backgroundLocation` para o código (A4) decidir em runtime. Os textos de permissão "sempre" já estão em pt-BR.
- **Justificativa:** D-10; o Expo Go não precisa da permissão "sempre" e as lojas exigem justificativa para ela.

### D-21 — Configuração do Auth para o MVP (rate limit, e-mail, senha, redirecionamentos)
2026-10-20 · A2 Backend
- **Contexto:** RNF-007 pede 10 tentativas de login a cada 15 min por IP; RF-001 pede recuperação por e-mail; a demonstração não pode depender de caixa de e-mail real.
- **Decisão:** `supabase/config.toml`: `jwt_expiry = 3600`, rotação de refresh token, senha mínima 8, `site_url = nomaderun://` e redirecionamentos `nomaderun://**`, `exp://**`, `http://localhost:8081/**`; **confirmação de e-mail desligada** para a demo; e-mail de recuperação em pt-BR (`supabase/templates/recovery.html`); Google e Apple com a seção pronta e `enabled = false`. Rate limit `sign_in_sign_ups = 3` por 5 min (o Auth só aceita janela de 5 min: 3/5 min = 9/15 min, o mais próximo de 10/15 sem passar).
- **Justificativa:** RF-001 e RNF-007 com a menor diferença possível; demo sem etapa de confirmação.
- **Consequências:** localmente o Auth **não aplica** rate limit por IP (não há cabeçalho de IP do proxy; conferido: 5 logins seguidos passam). Vale no Supabase Cloud após `supabase config push`; numa sala com o mesmo IP de saída, 3 logins/5 min pode travar a apresentação — se acontecer, suba o valor no painel. Em produção: ligar a confirmação de e-mail e um SMTP real.

### D-22 — Resultado da D-02 nas Edge Functions: import relativo do domain + import map; h3-js vendorizado; sem npm
2026-10-20 · A2 Backend
- **Contexto:** teste real com `supabase functions serve` (CLI 2.121.0, edge-runtime 1.77.4 = Deno 2.1.4). Arquivos fora de `supabase/` **funcionam** (o CLI monta no container cada arquivo que encontra no grafo), mas: (1) o domain usa imports sem extensão (`./grid`) e o runtime não aceita `sloppy-imports`; (2) o CLI só monta arquivos que encontra com caminho explícito; (3) o container não alcança o registro npm (proxy com certificado próprio), então `npm:h3-js` e `npm:@supabase/supabase-js` não carregam.
- **Decisão:** sem plano B (sem cópia do domain). `supabase/functions/_shared/domain.ts` importa **cada** arquivo do domain com `.ts` (`../../../apps/mobile/src/domain/x.ts`) e `supabase/functions/deno.json` remapeia cada especificador sem extensão (`"../../apps/mobile/src/domain/grid": ".../grid.ts"`). `h3-js` aponta para uma cópia **idêntica** à do app (4.5.0) em `_shared/vendor/h3-js` (`npm run domain:vendor-h3`). As functions falam com o Auth, o PostgREST e o Storage por `fetch` (`_shared/supabase.ts`), sem supabase-js. O teste `functions/tests/domain_bridge.test.ts` falha se um arquivo novo do domain não estiver na ponte e nos import maps, se o domain importar algo de fora, ou se o h3-js vendorizado divergir do app.
- **Justificativa:** fonte única das regras de verdade (o servidor roda o mesmo arquivo do app); functions sobem sem internet (bom para a apresentação); nenhuma dependência npm no servidor.
- **Consequências:** arquivo novo em `src/domain` exige uma linha na ponte e uma em cada `deno.json` (`supabase/functions` e `supabase/scripts`) — o teste avisa. O `h3-runtime.ts` (polyfill de TextDecoder) é carregado antes do h3-js pela própria ponte; no Deno ele não altera nada. O deploy no Cloud (`supabase functions deploy`) não foi testado aqui (sem projeto Cloud); se o bundler recusar caminhos fora de `supabase/`, aplicar o plano B da D-02. **Atualização (D-44):** o bundle do deploy por Docker foi verificado localmente e o plano B está pronto atrás de `npm run domain:copy`.

### D-23 — finish-activity: cálculo no domain (JS) e gravação atômica por RPC com concorrência otimista
2026-10-20 · A2 Backend
- **Contexto:** a pontuação precisa do domain (TypeScript), mas a gravação nas zonas precisa de transação com `SELECT ... FOR UPDATE`; o acesso por HTTP não abre transação que atravesse o código JS.
- **Decisão:** a function lê o contexto (`svc_finish_context`: perfil, ritmo-base = mediana das últimas 10 corridas pontuadas, sequência semanal, RP já ganho hoje por zona, estado e `version` das zonas tocadas, neblina já revelada), roda `finishRun` e envia tudo para `svc_apply_activity_result`, que numa **única transação** trava a corrida e as zonas (`FOR UPDATE`, em ordem de id), confere a `version` lida e grava zonas (novas com o polígono de `cellBoundary`, RF-020), `activity_zones`, `zone_events`, neblina, XP, trust, notificações e o resultado. Versão mudou → `ZONE_CONFLICT` → a function recalcula (até 3 vezes; depois `BUSY` 503). O resultado fica em `activities.result`: finalizar de novo devolve o mesmo JSON.
- **Justificativa:** RNF-006 (servidor autoritativo) com consistência sob corridas simultâneas, sem duplicar as regras em SQL.
- **Consequências:** `zones.version` é incrementada por toda escrita (inclusive pelos jobs).

### D-24 — Functions conferem o JWT no Auth (`verify_jwt = false` no gateway)
2026-10-20 · A2 Backend
- **Decisão:** cada function chama `GET /auth/v1/user` com o token recebido (`requireUser`). No `config.toml`, `verify_jwt = false` para as 8 functions.
- **Justificativa:** funciona com as chaves novas e antigas do Supabase, libera o preflight CORS do app web e recusa token de conta excluída ou banida (o gateway só olharia a assinatura).
- **Consequências:** uma chamada a mais ao Auth por requisição (~5 ms local).

### D-25 — Jobs diários em SQL (pg_cron) espelhando as constantes do domain
2026-10-20 · A2 Backend
- **Decisão:** `job_decay_zones` (RN-005), `job_fortify_zones` (RN-004), `job_close_week` (RN-014) e `job_season_rollover` (RN-006) são funções SQL agendadas pelo pg_cron (UTC; Brasília = UTC-3). Reproduzem `decayZone`, `fortifyZone`, `closeWeek` e `seasonReset` com as mesmas constantes (0,90 / 5 / 30 / 500 m / 3 / 0,30) e são testadas no pgTAP (`07_jobs_rankings.test.sql`).
- **Justificativa:** rodam dentro do banco, sem segredo nem chamada HTTP agendada; testáveis.
- **Consequências:** é a única duplicação de regra fora do domain. Se mudar uma dessas constantes no domain, mude a função SQL e o teste.

### D-26 — Interpretações de regras no servidor
2026-10-20 · A2 Backend
- **RN-009:** a corrida vai para revisão se o índice estiver abaixo de 40 **antes ou depois** dela; abaixo de 10 depois dela o corredor fica suspenso (`status = suspended`, 30 dias) e a corrida vai para revisão. Aprovação da moderação pontua com o estado atual das zonas e não mexe no índice.
- **RN-001:** `M_sequência` usa `profiles.streak_weeks` (o parâmetro `streakDays` do domain recebe semanas, limite 10). `M_grupo` não é aplicado (exige corrida simultânea de 3+ membros; fora do MVP) — **superado pela D-40**. O "agora" do cálculo é a hora do servidor no `finish-activity`.
- **RF-003:** trocar de facção grava `contribution_reset_at`; rankings da temporada ignoram a contribuição anterior. A influência já somada nas zonas fica.
- **RF-020:** zona nova nasce sem nome e sem cidade (sem IBGE no MVP); as functions mostram `"Zona XXXX"` — **superado pela D-43** (nome e cidade gerados na gravação).
- **Privacidade:** `zone_events` não expõe `user_id`/`activity_id` ao cliente; rankings e `public_profiles` são views `security_invoker` sobre funções `security definer` do schema `private` (só agregados e campos públicos).

### D-27 — Ambiente local sem mailpit e sem pg_prove
2026-10-20 · A2 Backend
- **Contexto:** as imagens `supabase/mailpit` e `supabase/pg_prove` não baixam neste ambiente (limite dos registros Docker).
- **Decisão:** `supabase/scripts/mail-sink.sh` sobe uma caixa SMTP mínima (`mail-sink.mjs`, Node de uma imagem já baixada) com o mesmo nome de container do mailpit; os e-mails aparecem em `http://127.0.0.1:54324`. `supabase/scripts/test-db.sh` roda os mesmos arquivos pgTAP via `psql` dentro do container do banco, falhando com `not ok`, erro de SQL ou plano diferente.
- **Consequências:** onde as imagens existirem, `npx supabase start` (sem `-x mailpit`) e `npx supabase test db` funcionam com os mesmos arquivos.

### D-28 — Zonas do mapa num store próprio (`zones-store`), carregadas por área visível com cache
2026-10-20 · A3 Frontend
- **Contexto:** o mapa, a folha da zona e a estimativa da corrida (A4) precisam da mesma visão das zonas do servidor; o `game-store` (agora do A4) tinha `seedZones()` local.
- **Decisão:** `src/store/zones-store.ts` (`useZones`) é a fonte única: `zones: Record<string, Zone>` (tipo do domain) + `meta` (nome/cidade do servidor), `loadBbox(bbox)` (`GET /zones?bbox=`, mescla sem apagar o que está fora da caixa, descarta resposta de carga antiga), `subscribe()` (Realtime em `zones`, um canal só com contagem de referências), `upsertZones()` (A4 chama após corrida confirmada) e `hydrate()` (último mapa salvo em `expo-sqlite/kv-store`; `localStorage` no web). O mapa pede a área visível com espera de 600 ms depois que a câmera para (`onRegionChange` novo no `TerritoryMap`, nativo e web) e desenha só as zonas da área visível + 25% de margem, no máximo 1.500. Nome: o do servidor; sem ele, o nome local de demonstração. **Exceção consciente** à regra "store não importa serviço": o contrato combinado com o A4 pede `loadBbox`/assinatura no próprio store; o repositório é injetável (`setZonesApi`) para os testes.
- **Justificativa:** RF-007, RNF-003 (Realtime medido em 0,2–0,7 s localmente), RNF-009 (poucos pedidos), estado sem internet com o último mapa.
- **Consequências:** o `game-store.zones` (seed) fica obsoleto; quem ainda o ler (resumo/corrida, A4) deve passar a ler `useZones`.

### D-29 — Central de notificações: Realtime + consulta periódica; notificação local com o app aberto
2026-10-20 · A3 Frontend
- **Contexto:** a tabela `notifications` não está na publicação `supabase_realtime` (só `zones` está); push remoto não existe no Expo Go (D-13).
- **Decisão:** `features/notifications/controller.ts` (montado no layout raiz) carrega a lista ao entrar, assina o Realtime filtrado por `user_id` (passa a funcionar sozinho quando o A2 incluir a tabela na publicação) e consulta a cada 20 s com o app em primeiro plano (e ao voltar para ele). Notificação nova de invasão, território perdido, conquista ou moderação vira notificação local (`expo-notifications`, respeitando `notification_prefs` e a permissão do onboarding; no web não). Tocar num alerta de zona navega para `/?zona=<id>&lat&lng&t=<agora>`: o mapa centraliza (`focus` novo no `TerritoryMap`) e abre a folha com a situação atual (UC-02 passo 4 e E1). Ao sair da conta, as stores do usuário são zeradas.
- **Consequências:** atraso de até 20 s sem Realtime na tabela; `setNotificationHandler` é definido aqui na primeira notificação local (se o A4 definir outro, vale o último; os dois mostram o banner).

### D-30 — Painel de moderação dentro do app (`/moderacao`) com guarda dupla por papel
2026-10-20 · A3 Frontend
- **Decisão:** rotas `src/app/moderacao/{index,[id],contas}.tsx` (D-08: o painel é o app no navegador). Guarda dupla: `Stack.Protected guard={canModerate(role)}` no layout raiz e `Redirect` para `/` no `_layout` do grupo; a entrada "Painel de moderação" só aparece no Perfil para `moderator`/`admin`; "Contas" só para `admin` (e nunca a própria conta). Layout em duas colunas a partir de 900 px (mapa + gráficos | dados, alertas e decisão), uma coluna no celular. Percurso no `TerritoryMap` existente (sem zonas), gráficos de velocidade (com a linha de 25 km/h da RN-007) e de passos por minuto em SVG próprio (`react-native-svg`), alertas com os textos do domain (`FLAG_EXPLANATION`) e o motivo da revisão. Justificativa obrigatória de 10 a 1.000 caracteres validada no app e no servidor. Pontos lidos em páginas de 1.000 (limite do PostgREST).
- **Justificativa:** RF-018, RF-002 (admin inativa), segurança em camadas (a RLS e a function continuam sendo a barreira real).

### D-31 — Rankings e cidades com as views do servidor; o que não tem dado continua demonstração rotulada
2026-10-20 · A3 Frontend
- **Decisão:** o Clube ganhou a seção "Rankings" (Corredores, Crews, Times) usando `leaderboard_*`; no individual, escopo Todos / Minha cidade / Meu time (filtros que a view permite). Período: só "temporada atual" (é o que as views calculam). "Guerra de Cidades" usa `leaderboard_cities` (RN-013) quando há linhas; sem linhas, mostra o placar de demonstração com o rótulo. Continuam demonstração, com rótulo: Próximo encontro (Clube), Raid e Liga do Bairro (Arena). O cartão "Sua Crew" mostra a crew real (membros e km da temporada); a barra passou a ser membros/30, porque o servidor não tem meta semanal de km.
- **Consequências:** filtros por semana/distrito do ERS ficam para quando o backend tiver as views.

### D-32 — Foto de perfil com `expo-image-picker` e envio de bytes ao bucket `avatars`
2026-10-20 · A3 Frontend
- **Decisão:** `expo-image-picker` (`EXPO_OFFLINE=1 npx expo install`, plugin com texto de permissão de fotos em pt-BR, câmera e microfone desligados). Galeria, recorte quadrado, qualidade 0,7, `base64` → bytes (decodificador próprio, igual em iOS/Android/web) → `storage.from('avatars').upload('<uid>/avatar-<ts>.<ext>')` com `contentType`; grava a URL pública em `profiles.avatar_url` e apaga as fotos antigas da pasta. Validação no app: JPEG/PNG/WebP até 2 MB (o bucket também recusa). A foto aparece no lugar das iniciais (mesmo círculo de 64 pt do editar perfil).
- **Consequências:** precisa de um novo build nativo para o texto de permissão de fotos (no Expo Go vale o texto padrão).

### D-33 — HMAC-SHA256 em JavaScript puro no app (conferido com o vetor do contrato)
2026-10-20 · A4 GPS e integrações
- **Contexto:** D-04 pede HMAC-SHA256 por aparelho. O `expo-crypto` do SDK 57 só tem digest (sem HMAC) e é assíncrono; o Hermes não tem `crypto.subtle`.
- **Decisão:** `src/services/signing/hmac.ts` implementa SHA-256 (FIPS 180-4) e HMAC (RFC 2104) em TypeScript puro, com UTF-8 e base64 próprios; `canonical.ts` monta o JSON canônico na ordem do contrato. O `expo-crypto` fica só para os 32 bytes aleatórios e os UUIDs.
- **Justificativa:** assinatura síncrona e idêntica em iOS, Android, web e Jest; testada com o vetor do `API_CONTRATO.md`, RFC 4231 e comparação direta com o canonical do servidor.
- **Consequências:** ~1 ms por lote de 200 pontos; se um dia houver HMAC nativo, basta trocar `hmacSha256Hex` mantendo os testes.

### D-34 — Fila offline: SQLite próprio por corrida, pontos guardados até o resultado oficial
2026-10-20 · A4 GPS e integrações
- **Decisão:** `nomade-queue.db` (separado do kv-store do perfil) com `runs` (estado `recording|pending|syncing|synced|failed`, `last_seq`, `acked_seq`, provisório, oficial, percurso simplificado, erro, tentativas) e `points` (PK `run_id, seq`). Toda escrita passa por um mutex em JS + transação (GPS em primeiro plano e tarefa de segundo plano não repetem `seq`). Pontos só são apagados depois do resultado oficial; o resumo guarda um percurso de até 600 pontos. No web, fila em memória com cópia no localStorage. Corridas e chaves do aparelho são por `userId`; o logout **não** apaga a fila (a corrida pendente sincroniza quando a mesma conta voltar). Corrida com menos de 2 pontos é descartada; corrida "gravando" de um processo anterior vira pendente ao abrir o app.
- **Justificativa:** RF-005/RNF-005 (nenhum ponto perdido, inclusive com o app fechado) e provisório calculado sobre exatamente os pontos que vão ao servidor.

### D-35 — Sync: transporte próprio, lotes de 200 a cada 5 s, erros do contrato e espera exponencial
2026-10-20 · A4 GPS e integrações
- **Decisão:** `sync-engine.ts` (puro, injetável) + `transport.ts` (supabase-js `functions.invoke`, preservando `error.details.lastSeq`, que o `callFunction` genérico descarta). Cada ciclo envia até o `lastSeq` do início (não persegue pontos novos), em lotes de até 200 (o servidor aceita 500). Gatilhos: a cada 5 s na corrida, ao terminar (força), ao abrir o app, ao voltar a conexão e ao voltar ao primeiro plano. Tratamento: `OUT_OF_ORDER`/`MISSING_POINTS` → recomeça de `lastSeq + 1`; `UNKNOWN_DEVICE`/`INVALID_SIGNATURE` → renova a chave (1×); `DEVICE_TAKEN` → novo UUID; 401 → `refreshSession` (1×); rede/5xx/429/`BUSY` → espera 2 s, 4 s, ... até 5 min; `ACTIVITY_CLOSED` → lê `activities.result`; demais 4xx → `failed` com mensagem pt-BR. Ao terminar, a tela espera o oficial por até 12 s; depois disso mostra o provisório e o evento do sync atualiza o resumo/histórico quando o oficial chegar.
- **Justificativa:** RF-005, RNF-006, UC-01 A1; testável com um servidor falso que segue o contrato e com a integração real.

### D-36 — Corrida Segura no MVP: SMS pelo app de mensagens, Escolta por link, alerta de parada local
2026-10-20 · A4 GPS e integrações
- **Decisão:** SOS e alerta de parada abrem `sms:` com os números dos contatos e a mensagem com o link do Google Maps (iOS `sms:/open?addresses=...&body=`, Android `sms:a,b?body=`); sem SMS ou sem contatos, `Share`. A Escolta, ao ligar (antes ou durante a corrida), compartilha a localização atual uma vez. Alerta de parada: sem sair de um raio de 25 m por 10 min → "Está tudo bem?" com 60 s → mesmo envio do SOS; constantes em `stop-alert.ts`.
- **Justificativa:** funciona no Expo Go sem serviço de SMS pago nem backend novo.
- **Consequências / limite:** o sistema exige que o usuário toque em "enviar" no app de mensagens (não há envio silencioso sem um provedor de SMS); "ao vivo" de verdade fica como pendência (P-18).

### D-37 — Simulação com desvio até a zona neutra mais próxima
2026-10-20 · A4 GPS e integrações
- **Decisão:** a rota da simulação (`features/run/simulation.ts`) é a volta no lago do Flamboyant (`demoRoute`) mais um desvio, por linha interpolada (passos ≤ 3,2 m), até o centro da zona neutra mais próxima no `useZones` (até 2,5 km; sem dados, o Estádio Serra Dourada do seed), com ~420 m de voltas dentro dela, ida e volta.
- **Justificativa:** a demonstração precisa mostrar "Zona conquistada" (RN-002, ~300 m numa zona neutra) e o seed tem quase todas as zonas do parque com dono. Um teste garante que a rota é válida para o antifraude.
- **Consequências:** cada demonstração conquista uma zona neutra; `npm run db:reset` devolve o seed.

### D-38 — GPS com a tela bloqueada: a tarefa grava na fila e a tela lê da fila
2026-10-20 · A4 GPS e integrações
- **Decisão:** com `extra.backgroundLocation` (D-20) e permissão "sempre", a corrida usa só `startLocationUpdatesAsync` (sem `watchPositionAsync` em paralelo, para não duplicar pontos); a tarefa (`background-task.ts`) grava cada lote de fixes direto no SQLite (só com a corrida `recording` e sem pausa, passos repartidos pelo tempo) e a tela lê os pontos novos da fila a cada 1 s. Sem a flag ou sem a permissão, cai no `watchPositionAsync` com a tela acesa (`expo-keep-awake`).
- **Justificativa:** RF-004 ("inclusive com a tela bloqueada") e RNF-005 sem depender de o JS da tela estar vivo.
- **Consequências:** só em development build (Expo Go não tem segundo plano no iOS); passos com a tela bloqueada no iOS a validar (P-21).

### D-39 — Caça no servidor: sorteio diário em SQL, abertura no cálculo oficial
2026-10-20 · A2 Backend
- **Contexto:** RF-023/RN-017 (P-12, P-19): os baús eram só locais; a abertura precisa ser validada pelo servidor (RNF-006).
- **Decisão:** tabela `chests` (por usuário e dia de Brasília) e RPC `daily_chests(p_lat?, p_lng?)`: na primeira chamada do dia sorteia 5–8 baús uniformes no disco de 3 km em torno do último ponto da última corrida não rejeitada (sem corrida, da posição enviada pelo app), sorteando de novo o ponto que cair em zona bloqueada (até 30 tentativas); raridade 70/25/5 % (`private.chest_rarity`), XP 20/60/150 (= `CHEST_XP` do domain). Chamadas seguintes devolvem os mesmos (trava consultiva por usuário/dia). A abertura acontece no `finish-activity`/aprovação: o contexto traz os baús fechados (só se `mission = 'caca'`, dias entre o início da corrida e hoje); `openChests` usa `chestsInReach` do domain (25 m) sobre os pontos de trechos válidos; corrida rejeitada ou em revisão não abre; o XP entra no XP da corrida. A gravação trava os baús e, se algum já foi aberto, levanta `ZONE_CONFLICT` para a function recalcular (cada baú abre uma vez); `chest_opens` continua sendo o histórico que o app lê.
- **Limites:** "sempre em ruas e parques" não é garantido (não há base de ruas no MVP); o centro vem da última corrida, então quem ainda não correu precisa enviar a posição. Na simulação o app continua com baús locais de demonstração (o percurso simulado não passa pelos baús sorteados).

### D-40 — M_grupo (RN-001): detecção no servidor + ponte `applyPack` até o domain repassar o dado
2026-10-20 · A2 Backend
- **Decisão:** `svc_crew_tracks` devolve os pontos `[t, lat, lng]` das corridas não rejeitadas dos outros membros da Crew no intervalo da corrida (±15 s). `_shared/group.ts/detectPack` percorre os mesmos passos válidos de `validateActivity` que o `finishRun` usa; em cada passo interpola a posição dos colegas no instante do meio (buraco > 15 s = não estava correndo) e conta o trecho "em grupo" quando o corredor e mais 2 colegas estão a até 50 m dois a dois. Zona com ≥ 60% dos metros válidos em grupo recebe `M_grupo = PACK_BONUS` (1,25). Como o `finishRun` não repassa `inPack` ao `scoreZone` (que já aceita), `applyPack` recalcula só essas zonas com as funções do domain (`scoreZone({ inPack: true })`, `applyRunPoints`, `defenseWindowOpen`) e troca outcomes, eventos, zonas e `rpTotal`. Resposta ganha `group: { zones, members }`.
- **Consequências:** quem finaliza antes de os colegas sincronizarem não ganha o bônus (não há recálculo retroativo); o app sync envia lotes a cada 5 s, então em geral os pontos já estão lá. O provisório do app não tem M_grupo (dados de outros usuários). Constantes 50 m / 60% / 3 membros ficam em `group.ts` até irem para o domain. **Pedido ao A1 (P-26):** `RunContext.packZones?: ReadonlySet<string>` repassado como `inPack` no `finishRun` (e as constantes no `scoring.ts`); quando existir, o servidor passa `packZones` e remove `applyPack` — o teste `group.test.ts` falha para avisar.

### D-41 — Rankings por período e escopo em RPCs; distrito = pai H3 calculado em SQL
2026-10-20 · A2 Backend
- **Decisão:** `ranking_runners`, `ranking_crews` (período `week` | `season`; escopo `general` | `faction` | `city` | `district`) e `ranking_factions` (`general` | `city` | `district`), `security definer` com validação (`VALIDATION: ...`) e limite de 500 linhas. Semana = segunda 00:00 de Brasília (como RN-014); temporada = mês; contribuição zerada pela troca de facção é respeitada. Cidade = cidade natal (`profiles.city`, como RN-013); no escopo cidade das facções, as zonas contadas são as de `zones.city`. Distrito = célula H3 res 7 que contém a zona: sem a extensão h3 no banco, `private.h3_parent` calcula o pai pelos bits do índice (troca a resolução e marca os dígitos finos com 7); o pgTAP compara com valores gerados por `districtOf`. `district_label` dá o nome-base mais comum das zonas do distrito ("Jardim Goiás"). As views `leaderboard_*` continuam (temporada, geral) para não quebrar o app.
- **Consequências:** estado e país do ERS ficam fora (o perfil não tem esses campos). Os rankings são calculados na hora (≤ 5 min do RF-015 atendido sem cache).

### D-42 — Zona de privacidade (RN-010) aplicada pela RLS do percurso
2026-10-20 · A2 Backend
- **Decisão:** tabela `privacy_zones` (até 3 por usuário em trigger, raio padrão 200 m, 50–1000 m, CRUD só do dono). A policy de `activity_points` passou a ser: o dono vê tudo; staff vê os pontos dos outros **exceto** os que estão a até `radius_m` de algum endereço do dono (`private.route_point_hidden` com `ST_DWithin` em geography). Assim o painel de moderação (que lê `activity_points` em páginas) já recebe o percurso filtrado sem mudança no app, e qualquer leitura futura de percurso de terceiros (feed, perfil público, compartilhamento) herda o filtro. O cálculo oficial e a moderação usam `svc_load_activity` (service role), que lê todos os pontos: dentro da zona pontua normalmente.
- **Consequências:** ~0,08 ms por ponto na leitura do moderador (1.186 pontos em ~95 ms local). O moderador vê buracos no percurso e nos gráficos onde o corredor marcou endereço. Cadastro pelo app: `from('privacy_zones').insert({ label, lat, lng, radius_m? })` (tela pendente, P-27).

### D-43 — Nome e cidade de zonas criadas fora do seed
2026-10-20 · A2 Backend
- **Decisão:** ao inserir uma zona nova, `svc_apply_activity_result` chama `private.new_zone_name`: base = nome da zona com nome mais próxima até ~3 km, sem o número final; sem vizinha, a cidade natal do corredor; sem cidade, "Zona". Número = maior número já usado com essa base + 1 (se só existe a base sem número, começa em 2). A cidade vem da vizinha (ou da cidade natal). O nome entra na zona, no resultado guardado e na resposta do `finish-activity`; zonas antigas sem nome foram nomeadas pela migration, na ordem de criação.
- **Consequências:** determinístico para a mesma ordem de criação; duas corridas simultâneas podem gerar o mesmo nome (não é chave). `zoneLabel`/`zone_label` ("Zona XXXX") continuam como último recurso.

### D-44 — Deploy no Cloud: bundle verificado localmente, plano B pronto atrás de script
2026-10-20 · A2 Backend
- **Contexto:** P-08. O CLI 2.121.0 não tem `--dry-run` no `functions deploy` e consulta a API antes de empacotar (aqui `api.supabase.com` é bloqueado pelo proxy).
- **Decisão:** `npm run functions:bundle-check` roda o mesmo `edge-runtime bundle` (imagem `supabase/edge-runtime:v1.77.4`) que o deploy por Docker usa, gera o eszip das 8 functions, confere que o domain e o h3-js estão dentro e sobe o eszip de `finish-activity` sozinho num edge-runtime limpo (responde CORS 200 e `UNAUTHORIZED`). Resultado: o plano A (domain fora de `supabase/`) empacota. Plano B pronto: `npm run domain:copy` copia o domain para `_shared/domain_copy` (só acrescenta `.ts` nos imports) e aponta a ponte para a cópia; `domain:copy:check` (rodado pelo `deploy.sh`) e o teste `domain_bridge` falham se a cópia divergir; `domain:copy:restore` volta. Com a cópia, o bundle-check monta só `supabase/` e também passa. Use o plano B se o deploy real recusar o domain ou com `--use-api` (bundling no servidor do Supabase). Passo a passo em `supabase/DEPLOY.md`; `supabase/scripts/deploy.sh` faz link, `db push` (seed só com `WITH_SEED=1`), `config push` opcional e `functions deploy`.
- **Consequências:** falta o deploy real com uma conta (P-08 fica aberta só para isso, com a coordenação).


### D-45 — Central de notificações: Realtime primeiro, consulta de 20 s só como fallback
2026-10-20 · A3 Frontend
- **Contexto:** P-24. Com `notifications` na publicação Realtime (P-13), a consulta fixa a cada 20 s (D-29) virou desperdício de rede e bateria.
- **Decisão:** `features/notifications/realtime-fallback.ts` (`createFallbackPolling`, sem React nem supabase-js) recebe o status do canal (`subscribe(cb)` em `subscribeNotifications`) e o `AppState`. O intervalo de 20 s só roda em primeiro plano **enquanto o canal não está `SUBSCRIBED`** (conectando, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`, ou assinatura que falhou). Ao chegar/voltar a `SUBSCRIBED` e ao voltar ao primeiro plano faz **uma** consulta de recuperação (o que chegou enquanto o canal estava fora vira notificação local se for nova). Em segundo plano nada roda.
- **Consequências:** em uso normal, só o WebSocket; sem Realtime (rede instável, proxy), a central se comporta como antes. Uma consulta extra na abertura (carga inicial + recuperação ao conectar), aceitável. D-29 continua valendo para o fallback.

### D-46 — Rankings do Clube pelas RPCs `ranking_*`; "Meu distrito" = distrito da corrida mais recente
2026-10-20 · A3 Frontend
- **Contexto:** P-25. As views `leaderboard_*` só dão temporada/geral; o A2 publicou as RPCs com período e escopo (D-41). O contrato manda usar `districtOf(zoneId)`, mas o perfil não tem uma "zona de casa".
- **Decisão:** o Clube passa a usar só as RPCs (`rankRunners`, `rankCrews`, `rankFactions` em `leaderboard-repo`), com três linhas de chips no mesmo estilo: quadro (Corredores/Crews/Times), período (Temporada/Semana) e escopo (Todos, Em <cidade>, Meu time, Em <distrito>; Times não tem "Meu time"). O distrito é `districtOf` da zona da corrida mais recente do usuário (`activity_zones`, maior metragem em caso de empate) e o rótulo vem de `rpc('district_label')`. Falta de cidade/time/distrito não chama o servidor: mostra o motivo ("Corra uma vez para ver o ranking do seu distrito."). A lógica dos filtros fica em `features/screens/club-ranking.ts` (pura, testada).
- **Consequências:** o distrito acompanha onde a pessoa tem corrido (sem campo novo no perfil). As views continuam no banco e no repositório (testes antigos), mas a tela não as usa mais. Guerra de Cidades segue em `leaderboard_cities`.

### D-47 — Zonas de privacidade: tela própria, mapa com toque e círculos
2026-10-20 · A3 Frontend
- **Contexto:** P-27 (RN-010). O cadastro precisa de um ponto (posição atual ou toque no mapa) e mostrar onde ficam as zonas.
- **Decisão:** rota `/zonas-privacidade` (cabeçalho empilhado como "Contatos de segurança"), aberta pela seção Conta do Perfil. `privacy-zones-repo` faz CRUD em `privacy_zones` com as mesmas regras do banco (raio padrão 200 m, 50–1000, nome até 40, limite 3 → `PRIVACY_ZONES_LIMIT` com a mensagem do servidor). O `TerritoryMap` ganhou duas props opcionais: `onMapPress(ponto)` (qualquer toque, além do `onZonePress`) e `circles` (discos cinza: `Circle` no nativo, polígono de 48 lados no web). Posição atual pelo `expo-location` depois de `requestLocationAccess` (mesmas mensagens da corrida). Sem edição de raio no MVP (o contrato permite; a tela usa o padrão).
- **Consequências:** telas existentes não passam as props novas, então não mudam. A RLS do percurso (D-42) faz o resto; o app não filtra nada.

### D-48 — Trechos inválidos em cinza no resumo buscados pelo `seq` no servidor
2026-10-20 · A3 Frontend (exceção autorizada no resumo do A4)
- **Contexto:** P-20 (UC-01 E1). O percurso do resumo vem simplificado da fila (`simplifyPath`, até 600 pontos) ou do servidor sem `seq`, então o índice do ponto não é o `seq` e não dá para recortar `invalidSegments` (fromSeq/toSeq) com segurança.
- **Decisão:** com o resultado **oficial** e `invalidSegments` não vazio, o resumo chama `track-repo.getInvalidStretches(activityId, segmentos)`, que junta trechos encostados e busca no servidor só os pontos de cada trecho (`seq` entre `fromSeq − 1` e `toSeq`, até 20 trechos × 1.000 pontos; o dono lê todos os próprios pontos). O `TerritoryMap` ganhou `invalidPaths` (linhas `ink3`, mesma espessura do percurso, desenhadas por cima da linha laranja). Resumo provisório não mostra cinza (o E1 fala do resultado oficial); sem internet, o mapa fica como antes.
- **Consequências:** posição exata para qualquer tamanho de corrida, sem tocar na fila nem no `use-run-record` (arquivos do A4). Mudança no resumo limitada a um efeito e uma prop.

### D-50 — Endurecimento do backend pelos achados do QA (QA-01/02/04/05/06/07/08/09/16)
2026-10-22 · A2 Backend
- **Contexto:** relatório do A5 (`docs/QA.md`), pendências P-29, P-30, P-32 a P-35. O app (A3) segue usando `select('*')` em `crews` e `profiles`, então grant por coluna nessas tabelas quebraria as telas. (O número D-49 ficou livre para a decisão do A3 feita em paralelo.)
- **Decisão:**
  - **Crews (QA-01):** em vez de grant por coluna, a **RLS** de `crews` passa a liberar a linha só ao líder e aos membros (que precisam do código para convidar) e a view `public_crews` (security invoker sobre função definer, padrão das views públicas) lista todas sem `invite_code`. `join_crew` (definer) continua achando a crew pelo código.
  - **Staff (QA-16):** `profiles` volta a ser só do dono; staff lê outros pela view `staff_profiles` (só devolve linhas se `private.is_staff()`), sem nascimento/aceites/preferências. `moderator_id` sai do grant de leitura de `moderation_reviews`.
  - **Conta inativa (QA-07):** duas camadas — pre-request do PostgREST (`public.check_request`, 401 `ACCOUNT_INACTIVE`, configurado por `alter role authenticator set pgrst.db_pre_request`) e policies **restritivas** `*_active_account` com `private.is_active()` (valem também no Realtime e no Storage); RPCs definer do cliente chamam `private.require_active()`. `check_request` fica em `public` e não é definer porque o anon também passa por ele e não tem acesso ao schema `private`. **`suspended` não perde o acesso**: é suspensão de competição (RN-009, 30 dias; corridas vão para a moderação) e as Edge Functions já aceitam esse status — só `inactive` (decisão do admin, login bloqueado) é barrado.
  - **Fuga (QA-02):** `ghostPace` de **150 a 900 s/km** (2:30 a 15:00 por km; o app oferece 5:00–7:00) e só com `mission = 'fuga'`; fora disso é ignorado na validação, na gravação e no cálculo (`officialGhostPace`). Fantasma do dono da zona/amigo fica para depois.
  - **Limites (QA-08/09):** **14.400 pontos por corrida** (4 h × 1 ponto/s, `POINTS_LIMIT`), **3 corridas abertas** criadas nas últimas 24 h por usuário (`TOO_MANY_OPEN_RUNS`; as mais antigas contam como abandonadas para não travar quem perdeu uma corrida), corpo recusado pelo `Content-Length`, `endedAt` entre o início e agora + 5 min.
  - **`/zones` (QA-04):** RPC `zones_in_bbox_json` (array único) na function + `max_rows = 2000`.
  - **Avatar (QA-05):** CHECK com a URL pública do bucket `avatars` na pasta do próprio id; hosts `<ref>.supabase.co`, `localhost`, `127.0.0.1` e IPs privados (Expo Go na rede local).
  - **Auth (QA-06):** `secure_password_change = true`; `account-delete` exige `password` e confere com `grant_type=password` no Auth usando o e-mail do token (a sessão criada morre com a conta).
  - **Cadastro:** `handle_new_user` valida a `city` dos metadados (2–80, `CITY_INVALID`).
- **Consequências:** o app precisa enviar `password` na exclusão e `city` no cadastro, ler perfis de outros (painel) em `staff_profiles` e crews alheias em `public_crews`, e tratar `401 ACCOUNT_INACTIVE`, `TOO_MANY_OPEN_RUNS` e `POINTS_LIMIT` (contrato atualizado). A conferência de senha conta no rate limit de login do Auth. Domínio próprio para o Storage exige acrescentar o host em `private.valid_avatar_url`.

### D-51 — Links de autenticação só por PKCE, com confirmação para trocar de conta
2026-10-22 · A3 Frontend
- **Contexto:** QA-03. Com o fluxo implícito, qualquer app ou página podia abrir `nomaderun://…#access_token=…` e o app chamava `setSession`, trocando a conta conectada sem aviso.
- **Decisão:** cliente com `flowType: 'pkce'`; `sessionFromCallback` só troca `code` por sessão (`exchangeCodeForSession`, que exige o verificador gravado neste aparelho no pedido) e recusa tokens na URL (`IMPLICIT_TOKENS`). Se já há sessão, o link de `code` fica em `session-store.pendingLink` e o diálogo "Trocar de conta?" (mostra o e-mail atual) decide; links de erro ou tokens são ignorados para quem está conectado. Trocar para outra conta zera o progresso local. Link aberto em outro aparelho (sem verificador) tem mensagem própria.
- **Consequências:** o link de recuperação/confirmação só funciona no aparelho (ou navegador) em que foi pedido; a confirmação do cadastro em outro aparelho confirma o e-mail mas não abre sessão (a mensagem manda entrar com a senha). Em produção, App Links/Universal Links continuam recomendados.

### D-52 — "Reduzir movimento" nos botões: só opacidade; faixa "Defendendo" amarela com texto escuro
2026-10-22 · A3 Frontend (exceção autorizada em `run-screen`/`hold-button`, arquivos do A4)
- **Contexto:** QA-12 (RNF-011, RNF-015, ERS da faixa de território) com o visual aprovado (D-15).
- **Decisão:** `pressFeedback` (`components/press-feedback.ts`) devolve escala 0,97 normalmente e, com `useReducedMotion`, opacidade 0,7 sem escala (Button e IconButton). `HoldButton` com movimento reduzido mostra o anel inteiro ganhando opacidade nos mesmos 600 ms. Faixa "Defendendo" em `palette.warning` (token existente) com texto/ícone `palette.ink` (contraste ~8:1; branco sobre amarelo não passaria). Métricas da corrida fixas em 48 pt, sem `adjustsFontSizeToFit`. Chips de camada ganham `hitSlop` 4 (44 pt de toque) sem mudar o desenho de 36 pt.
- **Consequências:** nenhuma outra mudança visual; comparação de imagem do Playwright continua 4/4. Os 6 traços de giz da conquista seguem fora (D-15).

### D-53 — Contrato da D-50 no app: conta inativada encerra a sessão; limites da fila são definitivos
2026-10-22 · A3 Frontend (exceção autorizada em `services/sync`, do A4)
- **Contexto:** P-39. O backend passou a responder 401 `ACCOUNT_INACTIVE`, `POINTS_LIMIT`/`TOO_MANY_OPEN_RUNS` (409) e a recusar `endedAt` depois de agora + 5 min.
- **Decisão:** `errors.ts` reconhece `ACCOUNT_INACTIVE` (PostgREST `PT401` e functions) e avisa ouvintes (`onAccountInactive`; o transporte do sync usa `reportAccountInactive`); o `session-controller` encerra a sessão e deixa "Conta inativada…" em `signedOutNotice`, mostrado na tela Entrar. Na fila, `POINTS_LIMIT` e `TOO_MANY_OPEN_RUNS` marcam a corrida como falha com mensagem clara e sem novas tentativas; os pontos locais só são apagados depois do resultado oficial. `endedAt` vai limitado ao relógio atual (a simulação 10× produz horários futuros). Painel lê `staff_profiles`; o app não lê crews alheias (a própria crew continua em `crews`, permitido a membros). `account-delete` com senha; `INVALID_PASSWORD` vira mensagem no campo.
- **Consequências:** conta reativada precisa entrar de novo; corridas que falharam por limite ficam no histórico com a explicação e os pontos no aparelho.

### D-54 — Fase 6: layout mobile pela skill mobile-app-ui-design e motion no estilo landonorris.com
2026-10-23 · A1 Arquiteto (pedido dos autores)
- **Contexto:** os autores relataram layout quebrado no celular e pediram (1) adequar o layout ao mobile usando a skill `ceorkm/mobile-app-ui-design` (instalada em `.claude/skills/mobile-app-ui-design`) e (2) usar o site https://landonorris.com/ (OFF+BRAND) como referência de animações e motion.
- **Decisão:** **substitui parcialmente a D-15**: a paleta "Pista", as fontes Inter/Inter Tight e a identidade dos times continuam; mudam o layout (grade de 8 pt, zona do polegar, áreas seguras, estados vazio/erro/carregamento) e a linguagem de movimento. O motion segue o perfil extraído do código do site (espelho público, só leitura): `power2.out` como easing padrão de interação, `expo.inOut` nas transições de tela, `expo.out` (cubic-bezier(.19,1,.22,1), usado no CSS do site) nas entradas; durações 0,5–0,6 s na interface e 1,5–2,5 s em momentos de destaque; textos de destaque revelados por linhas/palavras com máscara (subida de 100% → 0, stagger 15–30 ms). Implementação com Reanimated (UI thread), sem GSAP/Lenis/WebGL (não fazem sentido no React Native).
- **Regras:** "Reduzir movimento" troca tudo por opacidade (RNF-011); nenhuma animação bloqueia a interação; 60 fps; no máximo um "momento herói" por tela; nenhum testID muda.
- **Consequências:** as imagens de referência do Playwright (`e2e-web/__screenshots__`) serão regeradas de propósito ao fim da Fase 6.

### D-55 — Motion por animações CSS do Reanimated 4 e helpers de layout compartilhados
2026-10-23 · A7 Design/Motion (T6.1)
- **Contexto:** a D-54 pede o motion do landonorris.com na UI thread, com "Reduzir movimento" e sem mexer em testIDs; as telas serão adaptadas por 3 agentes em paralelo.
- **Decisão:** (1) tokens em `src/theme/motion.ts` (curvas como tupla pura + `Easing.bezier` + `cubicBezier`); `theme/easing.ts` e `tokens.motion` ficam por compatibilidade. (2) Entradas (`RevealText`, `FadeUp`/`Stagger`, `ScreenEnter`) usam **animações CSS do Reanimated 4** (`animationName` com keyframes em cache), que rodam na UI thread sem shared values por item; o parallax usa `useAnimatedScrollHandler`; o `CountUp` usa `requestAnimationFrame` atualizando um único texto (funciona igual na web). (3) O componente de toque se chama `Pressable` (alias de `PressableScale`) com `testID`/`accessibilityLabel` obrigatórios no tipo, e `PressableScale`/`Chip` entraram no teste estático de testIDs. (4) `ScreenScroll`/`Screen` medem a `BottomBar` e reservam o espaço do CTA; `ChipRow` rola na horizontal. Toda lógica (atrasos, reserva, parallax, contagem, transições) é função pura testada em Jest.
- **Consequências:** títulos com `RevealText` ficam divididos em palavras na árvore visual (o nome acessível é a frase inteira): seletores de teste por texto exato precisam usar `testID`/papel. Guia: `docs/DESIGN_MOBILE_MOTION.md`.


### D-56 — Corrida com 3 métricas e troca por algarismo; conquista em 6 traços (ERS §6.2)
2026-10-23 · A4 (T6.4)
- **Contexto:** em 360×640 as 4 métricas da corrida apareciam como "0,…"/"5:…" e o rótulo do botão de encerrar saía da tela; a D-54 pede motion e o ERS §6.2 pede a zona "pintada" por seis traços com 60 ms de intervalo (que a D-15 tinha deixado de fora).
- **Decisão:** (1) corrida com **3 métricas** (RNF-015): tempo em 88 pt (72 pt quando tem horas, para caber em 360 pt), distância e ritmo em 48 pt; a média por km fica só no resumo. O painel tem a altura do conteúdo e o mapa fica com o resto (`flex: 1`, mínimo 160 pt). (2) `TickerText` (`features/run/ticker-text.tsx`): cada caractere numa máscara e só o que mudou sobe (power2.out, 200 ms), com algarismos tabulares; **desligado na Simulação 10×** (o segundo troca a cada 100 ms e ficaria sempre no meio do movimento) e com "Reduzir movimento". (3) `CaptureCelebration` mantém a API e desenha o anel em **6 traços** (arcos de 55°, 60 ms entre o início de cada um, 420 ms cada, expo.out; fim em 720 ms), depois a marca do time e o título por palavras; o giro dos traços usa `transform` de `View` (o `G rotation/origin` do react-native-svg gera aviso de DOM na web). A vibração da conquista fica só no componente (o resumo vibrava junto, em dobro). (4) Contagem 3-2-1 com o número saindo de uma máscara (expo.out 600 ms) e uma barra por número que enche nos 0,8 s.
- **Consequências:** as contas puras ficam em `components/capture-celebration.math.ts` e `features/run/run-motion.ts` (teste `run-motion.test.ts`). Na Simulação os números trocam sem animação; a troca animada só aparece com GPS real (validar a 60 fps no aparelho).

### D-57 — Telas de conta: CTA fixo só fora de formulários; marca "NOMADE RUN" com revelação própria
2026-10-23 · A3 (T6.2)
- **Contexto:** a D-54 pede o CTA principal na zona do polegar (`BottomBar`) e um título com `RevealText` por tela. Nos formulários (entrar, cadastro, recuperar/nova senha) uma barra fixa fica atrás do teclado no iOS (o `ScreenScroll` ajusta só o conteúdo) e, no cadastro, permitiria enviar antes de ver os aceites. A marca "NOMADE RUN" usa 76 pt (o `hero` tem 96 pt e não cabe em 360 pt) e o `RevealText` não aceita tamanho próprio. Telas com cabeçalho nativo já têm o título na barra.
- **Decisão:** (1) `BottomBar` nas telas cujo CTA não depende do teclado: onboarding (time, localização, notificações), editar perfil (`safeBottom=false`, dentro das abas), contatos de segurança e zonas de privacidade (o botão "Adicionar" some enquanto o formulário está aberto, e o formulário sobe para logo abaixo da explicação) e perfil indisponível. Nos formulários o botão de enviar fica logo depois do último campo, com "próximo" do teclado encadeando os campos. (2) `HeroWordmark` local (`features/auth/hero-wordmark.tsx`): linhas sobem da máscara em 1,5 s (expo.out), tamanho `min(76, (largura − 48) / 4,15)`, lido uma vez como cabeçalho. (3) Com cabeçalho nativo, o título nativo continua e o `RevealText` vai no primeiro título do conteúdo ("Seus contatos", "Seus endereços", "Seus dados", "Unidade de distância", nome no perfil). (4) `FormScaffold` passou a usar `ScreenScroll` (margem lateral de 24 pt mantida); `modal` só tira a área segura de cima no iOS (folha), `nativeHeader` tira sempre.
- **Consequências:** o pedido de `RevealText` com tamanho de fonte ficou no PROGRESSO para o A7; quando existir, o `HeroWordmark` pode virar `RevealText`. Os títulos agora são palavras separadas na árvore visual: testes devem usar os testIDs novos (`entrar-titulo`, `cadastro-titulo`, …) ou o papel `heading`.


### D-58 — Telas de entrada com o visual neon da apresentação ("Pit Lane Neon")
2026-10-21 · A1 Arquiteto (pedido dos autores, prints do iPhone 15)
- **Contexto:** os autores acharam a tela de login "simples demais" e pediram neons e um visual mais atual. A apresentação já tem um design system neon (`docs/apresentacao/design-tokens.json`: base `#070708`, laranja `#FF6A13`, brilho em camadas da mesma cor).
- **Decisão:** as telas de entrada usam esse visual, sempre escuras (`ForceScheme` em `theme/use-theme.ts`), com `NeonBackdrop` (manchas de luz que respiram, rota neon desenhada em 2,8 s e um "corredor" de luz percorrendo a rota), "RUN" em laranja neon com brilho, selos dos times com brilho neon e botão principal com brilho. Tokens em `theme/neon.ts`. O resto do app mantém a paleta "Pista" (D-15/D-54). O foco dos campos de texto ganhou borda e brilho na cor de ação em todos os formulários.
- **Regras:** decorativo fora do leitor de tela; "Reduzir movimento" deixa tudo estático (rota já desenhada, sem corredor e sem respiração).
- **Consequências:** login visualmente alinhado aos slides. Estendido a pedido dos autores (2026-10-21) às boas-vindas do onboarding e ao cadastro.

### D-59 — App inteiro no visual neon ("Pit Lane Neon"), sempre escuro
2026-10-21 · A1 Arquiteto (pedido dos autores após aprovarem o login neon da D-58)
- **Decisão:** o tema escuro passa a ser o "Pit Lane Neon" da apresentação (fundo `#070708`, superfícies `#111215` com borda `#24252B`, texto `#F3F1ED`, ação `#FF6A13`) e o app fica **sempre escuro** (`APP_SCHEME` em `theme/use-theme.ts`, `userInterfaceStyle: "dark"` no `app.json` e `Appearance.setColorScheme('dark')`, para a barra de abas nativa, o teclado e o mapa do iOS acompanharem). Componentes compartilhados acendem: botão principal e botões de ação com brilho laranja, chips e cards selecionados com contorno e brilho laranja, cards com borda fina, barras de progresso em laranja. As telas das abas e as que usam `ScreenScroll` ganham a luz ambiente laranja (`NeonAmbient`, estática).
- **Substitui:** a parte de cores da D-15 e o tema claro automático da RNF-010 (o tema claro continua em `tokens.ts`; voltar é trocar `APP_SCHEME`). As cores dos times continuam as seguras para daltônicos (Okabe-Ito), com formas.
- **Consequências:** imagens de referência do Playwright regeneradas; RNF-010 (tema claro de dia) passa a desvio documentado — a ERS v1.1 deve refletir o tema escuro único.
