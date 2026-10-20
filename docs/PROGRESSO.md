# Progresso

> Registro contínuo. **Antes de começar** qualquer tarefa, leia a última entrada e as pendências.
> **Ao terminar**, adicione uma entrada no topo do log seguindo o modelo.

## Estado atual (resumo)

- **Fase:** 1 (infraestrutura)
- **Em andamento:** —
- **Feito na fase:** T1.4–T1.6 (A3 Frontend): cliente Supabase, auth, guardas de rota, onboarding no servidor, perfil e LGPD — validados contra o Supabase local.
- **Próximos passos:** fechar T1.1–T1.3 (A2) se ainda faltar algo; Fase 2 (A4 GPS: T2.1–T2.5) e T2.6 (A3).
- **Bloqueios:** nenhum

## Pendências abertas

| # | Pendência | Dono | Origem |
|---|---|---|---|
| P-01 | Cobertura de ramos do domain em 85% (meta 90%) | A5 | Baseline |
| P-02 | Seção 6.2 do ERS descreve paleta diferente da aprovada (D-15) | A6 | Baseline |
| P-03 | Foto de perfil (RF-002): hoje mostra iniciais na cor do time; falta bucket no Storage + upload | A2 (bucket/RLS) → A3 (tela) | T1.6 |
| P-04 | Atualizar `API_CONTRATO.md` com os nomes reais: RPC `choose_faction(p_faction)`, `username_available(p_username)`, coluna `profiles.units`, chaves `notification_prefs` = `invasion, conquest, missions, moderation`, metadados do cadastro | A2 | T1.6 |
| P-05 | Validar em aparelho (Expo Go / development build): SecureStore em partes, deep link `nomaderun://nova-senha`, permissão de notificações no Expo Go Android, compartilhamento do JSON exportado | A3/A5 | T1.4–T1.6 |
| P-06 | Login Google/Apple só com credenciais reais (código pronto, aparece com `EXPO_PUBLIC_AUTH_PROVIDERS`) | Coordenação | T1.5 |
| P-07 | Testes de tela (React Native Testing Library) e fluxos Maestro de cadastro/login/onboarding usando os testIDs listados no log de T1.4–T1.6 | A5 | T1.5 |

## Modelo de entrada

```
### AAAA-MM-DD — <ID da tarefa> — <título> (<agente>)
- Feito:
- Arquivos:
- Testes executados (comando → resultado):
- Problemas encontrados:
- Pendências:
- Para o próximo agente:
```

## Log

### 2026-10-20 — T1.4, T1.5, T1.6 — Infra do app, autenticação, onboarding, perfil e LGPD (A3 Frontend)
- **Feito:**
  - **T1.4 (infra):** dependências da fase atual e da próxima instaladas de uma vez; plugins no `app.json`; `app.config.js` com a flag de GPS em segundo plano; cliente Supabase com sessão no SecureStore dividida em partes (D-06) e `localStorage` no web; auto-refresh parado em segundo plano (AppState); tela "Backend não configurado" quando faltam as variáveis; `AppError` (NETWORK, UNAUTHORIZED, VALIDATION, NOT_FOUND, CONFLICT, RATE_LIMITED, SERVER, UNKNOWN) + `Result<T>` + mapeador de erros Auth/PostgREST/Functions/HTTP para pt-BR (inclui as mensagens `CODIGO: texto` do backend); repositórios `auth-repo`, `profile-repo`, `account-repo`, `functions` (Edge Functions com JWT), cache do perfil para abrir sem internet.
  - **T1.5 (auth):** rotas `/entrar`, `/cadastro`, `/recuperar-senha`, `/nova-senha` (deep link `nomaderun://nova-senha`, fluxo implícito e PKCE), `/termos`, `/privacidade` (modais), `/indisponivel`. Cadastro com e-mail, senha (mín. 8 + medidor de força), nome de usuário (3–20, conferido no RPC `username_available` antes do `signUp` e erro do banco tratado), nascimento DD/MM/AAAA com 16+, dois aceites separados; metadados em `options.data`. Botões Google/Apple só com `EXPO_PUBLIC_AUTH_PROVIDERS`. Guardas com `Stack.Protected` no `_layout.tsx` via função pura `resolveRouteGroup` (sem sessão → auth; recuperação → nova senha; sem facção → onboarding; com facção → abas); splash até restaurar a sessão e carregar o perfil. Rotas e opções de apresentação existentes mantidas. `session-store` novo; `game-store` recebe `name`/`faction`/`xp`/`trust` do perfil (`applyProfile`) e zera no logout (`resetForSignOut`), API usada pela corrida intacta.
  - **T1.6 (onboarding/perfil/LGPD):** onboarding com o mesmo visual; nome pré-preenchido com o nome de usuário (se mudar, salva no perfil); facção gravada pelo RPC `choose_faction`; explicação da localização mantida; **etapa nova e separada de notificações** com explicação própria (RNF-013). Aba Perfil ganhou a seção "Conta" (mesmo estilo de `Surface`) → `/perfil/editar` (nome, cidade natal, km/milhas, preferências de invasões/conquistas/missões/moderação; foto = iniciais) e `/perfil/conta` (exportar JSON via `account-export` + expo-file-system + expo-sharing; excluir conta digitando EXCLUIR → `account-delete` → logout; Sair; termos e privacidade).
- **Dependências instaladas** (`EXPO_OFFLINE=1 npx expo install ...`, versões do SDK 57): `@supabase/supabase-js@^2.118.0`, `expo-secure-store@~57.0.4`, `expo-sqlite@~57.0.4`, `expo-crypto@~57.0.3`, `expo-sensors@~57.0.3`, `expo-task-manager@~57.0.21`, `expo-keep-awake@~57.0.2`, `expo-network@~57.0.2`, `expo-notifications@~57.0.22`, `expo-file-system@~57.0.7`, `expo-sharing@~57.0.22`. **Não** instalado: `react-native-url-polyfill` (o runtime do Expo 57 já instala `URL`/`URLSearchParams`, ver D-16).
- **Plugins no `app.json`:** `expo-location` (textos pt-BR de uso, "sempre", movimento; `isAndroidMotionActivityEnabled: true`; segundo plano desligado), `expo-sensors` (`NSMotionUsageDescription`), `expo-secure-store` (sem Face ID), `expo-sqlite`, `expo-notifications` (cor laranja), `expo-task-manager`, `expo-sharing`; `ios.infoPlist.NSMotionUsageDescription`; `extra.backgroundLocation`.
- **Arquivos:**
  - Compartilhados: `apps/mobile/package.json`, `package-lock.json`, `app.json`, `app.config.js` (novo), `.env.example` (novo), `src/app/_layout.tsx`.
  - Serviços: `src/services/api/{env,errors,secure-storage,supabase,functions,types,auth-repo,profile-repo,account-repo,profile-cache,profile-cache.web}.ts`, `src/services/auth/deep-link.ts`, `src/lib/share-json{,.web}.ts`.
  - Store: `src/store/session-store.ts` (novo), `src/store/game-store.ts` (+`applyProfile`, `resetForSignOut`, `ProfileSnapshot`).
  - Auth: `src/features/auth/{route-guard,validation,session-controller,oauth}.ts`, `form-ui.tsx`, `sign-in-screen.tsx`, `sign-up-screen.tsx`, `forgot-password-screen.tsx`, `new-password-screen.tsx`, `legal-screen.tsx`, `unavailable-screen.tsx`.
  - Telas: `src/features/screens/{edit-profile-screen,account-screen}.tsx` (novas), `onboarding-screen.tsx` e `profile-screen.tsx` (mudança mínima).
  - Rotas: `src/app/(auth)/{_layout,entrar,cadastro,recuperar-senha}.tsx`, `src/app/{nova-senha,termos,privacidade,indisponivel}.tsx`, `src/app/(tabs)/perfil/{editar,conta}.tsx`.
  - Componentes (aditivo, sem mudança visual): `icon.tsx` (+`chevron`, `mail`, `eye`, `eyeOff`), `button.tsx` (`IconButton` aceita `testID`).
  - Testes: `src/services/api/__tests__/{errors,secure-storage,types,auth-repo,integration.local}.test.ts`, `src/services/auth/__tests__/deep-link.test.ts`, `src/features/auth/__tests__/{validation,route-guard}.test.ts`, `src/store/__tests__/session-store.test.ts`.
- **Testes executados (em `apps/mobile`):**
  - `npm run typecheck` → ok · `./node_modules/.bin/eslint src` → 0 erros, 0 avisos.
  - `npm test` → **157 passaram**, 7 ignorados (integração, só com `NOMADE_IT=1`); 15 suítes (60 do domain + 97 novos).
  - Integração real contra o Supabase local (`NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon> npx jest integration.local`) → **7/7**: nome livre, cadastro 16+ cria sessão e perfil sem facção, menor de 16 recusado pelo banco, editar perfil (cidade/unidade/preferências) e cidade inválida recusada, `choose_faction`, senha errada amigável, exportar e excluir conta (login depois falha).
  - `npx expo export -p web` → compila (com e sem `.env`; sem `.env` o app abre "Backend não configurado").
  - Fluxo no navegador (Playwright + Chromium local sobre o export web, 390×844): entrar com senha errada → "E-mail ou senha incorretos."; cadastro com erros de validação; idade 12 anos recusada; cadastro ok → onboarding com nome pré-preenchido → time → localização → notificações → abas; perfil → editar (cidade, milhas) salvo; conta → excluir com EXCLUIR → volta para Entrar.
- **Problemas encontrados:**
  - `npx expo install` falha aqui porque o proxy bloqueia a API do Expo; use `EXPO_OFFLINE=1 npx expo install <pacotes>` (usa o mapa de versões embutido no SDK). Docs web do Expo/Supabase também bloqueadas: APIs conferidas nos tipos instalados em `node_modules`.
  - O preset `jest-expo` troca o `fetch` global pelo do Expo (não funciona em Node): o teste de integração usa `node-fetch` (dependência transitiva) via `global.fetch` do cliente.
  - O Auth devolve só "Database error saving new user" quando o trigger recusa: por isso o app chama `username_available` antes do `signUp` e mapeia esse erro para uma mensagem amigável.
  - Diferenças do contrato escrito × backend real (já tratadas no app, ver P-04): `choose_faction(p_faction)`, coluna `units`, chaves `invasion`/`conquest` no jsonb.
  - Export web reaproveita cache do Metro: depois de criar/alterar o `.env`, rode com `--clear`.
- **Decisões novas:** D-16 a D-20 em `DECISOES_TECNICAS.md`.
- **Pendências:** P-03 a P-07 (tabela acima). Os dados de corridas, zonas, histórico e conquistas continuam locais/demonstração até a Fase 2 (A4) e T2.6 (A3). Os contatos da Corrida Segura no perfil ainda são os de demonstração (T2.5).
- **Para o A4 (GPS e integrações):**
  - Todas as dependências da Fase 2 já estão no `package.json` e os plugins no `app.json`: não precisa mexer neles. GPS em segundo plano: `NOMADE_BACKGROUND_LOCATION=1 npx expo run:android|ios` liga os flags do `expo-location`; leia em runtime `Constants.expoConfig?.extra?.backgroundLocation`.
  - Edge Functions: `callFunction<T>(name, { method, body, query })` em `src/services/api/functions.ts` já manda o JWT e devolve `Result<T>` com o erro do contrato (`error.detail` = `MISSING_POINTS`, `OUT_OF_ORDER` etc.). Para `ingest-points`, monte o corpo assinado no seu serviço e passe em `body`. Erros de rede → `code: 'NETWORK'` (sinal para manter na fila).
  - Usuário logado: `useSession.getState().session?.userId`; perfil: `useSession.getState().profile` (tem `unit` km/mi para formatar distâncias). O `game-store` manteve toda a API usada por `use-run-session.ts`; novos: `applyProfile` e `resetForSignOut` (chamado no logout — **não apague a fila offline de corridas não enviadas no logout sem decidir isso**; o reset do game-store não toca no SQLite).
  - O cache do perfil usa `expo-sqlite/kv-store` (chave `nomade.profile.v1`); use outro arquivo de banco para a fila.
  - A permissão de notificações já é pedida no onboarding (etapa própria). A de localização continua sendo pedida no onboarding e de novo na tela de corrida se faltar.
- **Para o A5 (QA):**
  - testIDs novos: `tela-entrar`, `entrar-email`, `entrar-senha`, `entrar-senha-mostrar`, `entrar-botao`, `entrar-erro`, `entrar-esqueci`, `entrar-criar-conta`, `entrar-google|apple`; `tela-cadastro`, `cadastro-email|senha|usuario|nascimento`, `cadastro-aceite-termos`, `cadastro-aceite-privacidade`, `cadastro-abrir-termos|privacidade`, `cadastro-botao`, `cadastro-erro`, `cadastro-ja-tenho-conta`, `tela-cadastro-confirmar`; `tela-recuperar-senha`, `recuperar-email|botao|enviado|erro|voltar`; `tela-nova-senha`, `nova-senha-senha|confirmar|botao|erro|erro-link|pedir-link|entrar`; `tela-termos`, `tela-privacidade`, `legal-fechar`; `tela-backend-nao-configurado`, `tela-perfil-indisponivel`, `indisponivel-tentar|sair`; onboarding: `onboarding-nome`, `onboarding-escolher-time`, `onboarding-faccao-<id>`, `onboarding-faccao-continuar`, `onboarding-localizacao-continuar`, `onboarding-notificacoes-continuar`, `onboarding-erro`; perfil: `perfil-editar`, `perfil-conta`, `perfil-sair`, `tela-editar-perfil`, `perfil-usuario`, `perfil-cidade`, `perfil-unidade-km|mi`, `perfil-notificacao-<invasions|conquests|missions|moderation>`, `perfil-salvar`, `perfil-erro`; conta: `tela-conta`, `conta-exportar`, `conta-termos`, `conta-privacidade`, `conta-sair`, `conta-excluir`, `conta-excluir-confirmacao`, `conta-excluir-confirmar`, `conta-excluir-cancelar`.
  - Rate limit local do Auth é baixo (`sign_in_sign_ups`): espalhe os testes de login/cadastro ou use usuários do seed. No Playwright conceda `permissions: ['geolocation','notifications']` ao contexto, senão o onboarding espera o prompt do navegador.
  - Sugestão: testes de tela com React Native Testing Library para cadastro/onboarding (P-07) e o teste `integration.local` no roteiro do T4.4.

### 2026-10-20 — T0.1–T0.3 — Análise, skills e base da documentação (A1 Arquiteto)
- **Feito:** leitura completa do ERS (27 RF, 15 RNF, 19 RN, UC-01..03) e do código; baseline medido; Docker e Supabase local validados no ambiente; skills instaladas; arquitetura, decisões D-01..D-15, contrato da API, plano e checklist criados.
- **Arquivos:** `docs/ARQUITETURA.md`, `docs/DECISOES_TECNICAS.md`, `docs/API_CONTRATO.md`, `docs/PLANO_DESENVOLVIMENTO.md`, `docs/REQUISITOS.md`, `docs/PROGRESSO.md`, `CLAUDE.md`, `.claude/skills/*`, `skills-lock.json`.
- **Testes:** `npm test` → 60/60; `npm run typecheck` → ok; `eslint src` → ok; cobertura do domain 94,1% linhas / 84,8% ramos.
- **Problemas:** a busca do `find-skills` (`npx skills find`) não funciona aqui porque o proxy bloqueia a API do skills.sh. Skills instaladas direto dos repositórios oficiais no GitHub (`npx skills add <repo> --skill ...`). O filtro de lint do rtk mostra "JSON parse failed" quando o ESLint não tem saída: rode `./node_modules/.bin/eslint src` direto.
- **Pendências:** P-01, P-02.
- **Para o próximo agente:** comece pela Fase 1. O backend sobe com `npx supabase start` na raiz (o Docker precisa estar rodando: `dockerd &`). O contrato está em `docs/API_CONTRATO.md`.
