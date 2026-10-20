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
- **Consequências:** arquivo novo em `src/domain` exige uma linha na ponte e uma em cada `deno.json` (`supabase/functions` e `supabase/scripts`) — o teste avisa. O `h3-runtime.ts` (polyfill de TextDecoder) é carregado antes do h3-js pela própria ponte; no Deno ele não altera nada. O deploy no Cloud (`supabase functions deploy`) não foi testado aqui (sem projeto Cloud); se o bundler recusar caminhos fora de `supabase/`, aplicar o plano B da D-02.

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
- **RN-001:** `M_sequência` usa `profiles.streak_weeks` (o parâmetro `streakDays` do domain recebe semanas, limite 10). `M_grupo` não é aplicado (exige corrida simultânea de 3+ membros; fora do MVP). O "agora" do cálculo é a hora do servidor no `finish-activity`.
- **RF-003:** trocar de facção grava `contribution_reset_at`; rankings da temporada ignoram a contribuição anterior. A influência já somada nas zonas fica.
- **RF-020:** zona nova nasce sem nome e sem cidade (sem IBGE no MVP); as functions mostram `"Zona XXXX"`.
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
