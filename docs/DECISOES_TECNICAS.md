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
