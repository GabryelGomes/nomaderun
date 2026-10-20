# NOMADE RUN — app (Expo)

App de corrida com disputa de território. O mesmo código roda no celular (Expo Go ou development build) e no navegador, onde também fica o painel de moderação. Feito com **Expo SDK 57 + React Native 0.86 + TypeScript**.

O app precisa do backend (Supabase). Para subir o backend local e ver o passo a passo completo, comece pelo [`README.md` da raiz](../../README.md).

## Rodar contra o backend

1. Na raiz do repositório: `npm run db:start` e, em outro terminal, `npm run functions:serve`.
2. Aqui em `apps/mobile`:
   ```bash
   npm install
   cp .env.example .env      # preencha as variáveis abaixo
   npx expo start --clear
   ```
3. Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android). Celular e computador na mesma rede Wi-Fi.

Sem `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`, o app abre a tela "Backend não configurado".

Para testar sem sair de casa, escolha **Simulação** na tela de nova corrida: o app percorre uma volta no Parque Flamboyant (Goiânia) em velocidade 10× e desvia até a zona neutra mais próxima, para mostrar uma conquista.

### Navegador e painel de moderação

```bash
npx expo start --web       # ou tecla w com o Expo já aberto
```

Abre em `http://localhost:8081`. Entre com uma conta de moderador ou administrador (as de demonstração estão no README da raiz) e vá em **Perfil → Painel de moderação**. O mapa da web usa MapLibre com o mapa-base gratuito do OpenFreeMap.

## Variáveis de ambiente (`.env`)

| Variável | Valor | Observação |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Local: `http://<IP do computador>:54321` · Nuvem: `https://<ref>.supabase.co` | No celular use o IP da máquina na rede, não `127.0.0.1`. No navegador do próprio computador, `http://127.0.0.1:54321` funciona |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Local: `ANON_KEY` (ou `PUBLISHABLE_KEY`) de `npx supabase status -o env` (na raiz) · Nuvem: Project Settings → API | Chave pública; pode ir para o app |
| `EXPO_PUBLIC_AUTH_PROVIDERS` | Vazio, ou `google`, `apple`, `google,apple` | Mostra os botões de login social. Só funciona com os provedores configurados no Supabase |

Nunca coloque a chave `service_role`/`secret` aqui: ela é só das Edge Functions. Depois de mudar o `.env`, reinicie com `npx expo start --clear`.

## GPS com a tela bloqueada (development build)

No Expo Go o app grava a corrida com a tela acesa. Para gravar com a tela bloqueada é preciso um **development build** gerado com a flag `NOMADE_BACKGROUND_LOCATION=1`:

```bash
NOMADE_BACKGROUND_LOCATION=1 npx expo run:android     # ou run:ios (precisa do Xcode)
```

A flag liga, no `app.config.js`, as permissões de localização em segundo plano e o serviço em primeiro plano do Android. O app então pede a permissão "o tempo todo" e mostra a notificação do serviço durante a corrida. Sem a flag, ou no Expo Go, a flag não tem efeito.

O mesmo vale para notificações push remotas: só em development build. No Expo Go, os alertas chegam pela central de notificações do app e como notificação local com o app aberto.

Esse caminho ainda não foi validado em aparelho (pendência P-17 em `docs/PROGRESSO.md`).

## Testes

| O quê | Comando | Precisa do backend? |
|---|---|---|
| Testes unitários, de serviços e análise de testIDs | `npm test` | Não |
| Cobertura (falha se `src/domain` ficar abaixo de 90%) | `npx jest --coverage` | Não |
| Tipos | `npm run typecheck` | Não |
| Lint | `./node_modules/.bin/eslint src` | Não |
| Integração com o backend local | `NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon key> NOMADE_IT_DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx jest integration --forceExit` | Sim, com functions |

Sem `NOMADE_IT=1`, os testes de integração aparecem como ignorados no `npm test`.

### Navegador (Playwright)

Fluxo completo da demonstração, autenticação e comparação de imagem sobre o export web: [`e2e-web/README.md`](e2e-web/README.md). Resumo:

```bash
npx expo export -p web --output-dir /tmp/nomade-web
node e2e-web/demo-flow.cjs /tmp/nomade-web
```

### Celular (Maestro)

Fluxos de cadastro, login e dos casos de uso UC-01, UC-02 e UC-03: [`.maestro/README.md`](.maestro/README.md). Precisam de aparelho ou emulador e do [Maestro CLI](https://maestro.mobile.dev). Os IDs usados nos fluxos são conferidos contra o código pelo `npm test`.

## Estrutura

```
src/
  app/          rotas (Expo Router): auth, abas, corrida, resumo, zona, notificações, moderação
  domain/       regras do jogo, puras e testadas (também usadas pelas Edge Functions)
  features/     telas e casos de uso: auth, run (sessão de corrida), safety, moderation, notifications
  services/     api (repositórios Supabase), auth, location, sensors, offline (fila SQLite),
                sync, signing (HMAC), notifications, safety
  components/   UI reutilizável: mapa nativo/web (regiões suavizadas, sem grade), botões, selo do time
  store/        estado (Zustand): sessão, jogo, zonas, notificações
  theme/        design system "Pista" (laranja, neutros quentes, Inter)
  demo/         dados de DEMONSTRAÇÃO usados na simulação e nas telas sem dados do servidor
```

Regras de camada (telas não chamam o Supabase direto, o domain não importa React) em [`docs/ARQUITETURA.md`](../../docs/ARQUITETURA.md).

## Limitações conhecidas

| Parte | No MVP |
|---|---|
| Mapa | `react-native-maps` (Apple Maps no iPhone, Google Maps no Android) e MapLibre na web, em vez de Mapbox |
| GPS com a tela bloqueada e push remoto | Só em development build |
| Escolta | Compartilha a localização uma vez ao ligar; não acompanha ao vivo |
| SOS e alerta de parada | Abrem o app de mensagens com a localização; a pessoa toca em enviar |
| Raid, Liga do Bairro, Próximo encontro | Dados de demonstração identificados na tela |
