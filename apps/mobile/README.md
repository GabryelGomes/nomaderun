# NOMADE RUN — app (Expo)

App de corrida com disputa de território entre quatro times. O mesmo código roda no celular (Expo Go ou development build) e no navegador, onde também fica o painel de moderação. Feito com **Expo SDK 57 + React Native 0.86 + TypeScript**.

Abas: **Mapa · Arena · Correr · Clube · Você**. Para subir o backend local e ver o passo a passo completo, comece pelo [`README.md` da raiz](../../README.md).

## Rodar sem servidor (modo demonstração)

```bash
npm install
EXPO_PUBLIC_DEMO=1 npx expo start --web --clear     # sem --web: QR para o Expo Go
```

O app inteiro roda com dados de exemplo guardados no aparelho, com o selo "Demonstração" em toda tela, e não faz nenhum pedido a servidor. No navegador, o cenário vem da URL: `http://localhost:8081/?cenario=primeira-abertura` começa do cadastro; `cheio` (padrão), `vazio`, `sem-time`, `sob-ataque`, `moderador`, `lento`, `erro` e `offline` estão descritos em [`docs/COMO_APRESENTAR.md`](../../docs/COMO_APRESENTAR.md) §1. No celular, o cenário é sempre `cheio`.

O `--clear` é obrigatório ao ligar ou desligar o `EXPO_PUBLIC_DEMO`: sem ele, o Metro reaproveita o pacote anterior. Num app ligado a um servidor, o botão **Ver demonstração** da tela Entrar abre o mesmo modo; sair dele apaga tudo o que a demonstração gravou no aparelho.

A **Simulação** de corrida (uma volta no Parque Flamboyant, Goiânia, em 10×) só existe no modo demonstração. Na conta real, a corrida usa o GPS.

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

O app pergunta ao servidor o que ele já tem (`server_info`). Com um servidor sem a v2, ou com as flags da v2 desligadas, as telas novas que dependem dele (pintura, Raid, Liga, missões, feed) mostram um estado "indisponível" em vez de dados inventados. Como ligar: [`supabase/DEPLOY.md`](../../supabase/DEPLOY.md) §10.

### Navegador e painel de moderação

```bash
npx expo start --web       # ou tecla w com o Expo já aberto
```

Abre em `http://localhost:8081`. Entre com uma conta de moderador ou administrador (as de demonstração estão no README da raiz) e vá em **Você → Ajustes → Moderação**. O mapa da web usa MapLibre com o mapa-base gratuito do OpenFreeMap.

## Variáveis de ambiente (`.env`)

| Variável | Valor | Observação |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Local: `http://<IP do computador>:54321` · Nuvem: `https://<ref>.supabase.co` | No celular use o IP da máquina na rede, não `127.0.0.1`. No navegador do próprio computador, `http://127.0.0.1:54321` funciona |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Local: `ANON_KEY` (ou `PUBLISHABLE_KEY`) de `npx supabase status -o env` (na raiz) · Nuvem: Project Settings → API | Chave pública; pode ir para o app |
| `EXPO_PUBLIC_AUTH_PROVIDERS` | Vazio, ou `google`, `apple`, `google,apple` | Mostra os botões de login social. Só funciona com os provedores configurados no Supabase |
| `EXPO_PUBLIC_DEMO` | Vazio ou `1` | `1` = build só de demonstração, sem servidor. Nunca deixe ligado no `.env.production` que vai para o EAS Update |

Nunca coloque a chave `service_role`/`secret` aqui: ela é só das Edge Functions. Depois de mudar o `.env`, reinicie com `npx expo start --clear`.

## GPS com a tela bloqueada (development build)

No Expo Go o app grava a corrida com a tela acesa. Para gravar com a tela bloqueada é preciso um **development build** gerado com a flag `NOMADE_BACKGROUND_LOCATION=1`:

```bash
NOMADE_BACKGROUND_LOCATION=1 npx expo run:android     # ou run:ios (precisa do Xcode)
```

A flag liga, no `app.config.js`, as permissões de localização em segundo plano e o serviço em primeiro plano do Android. O app então pede a permissão "o tempo todo" e mostra a notificação do serviço durante a corrida.

Push remoto também só funciona em development build. No Expo Go, os avisos chegam pela central de notificações e como notificação local; os lembretes de engajamento são sempre locais, no máximo 1 por dia, das 8h às 21h.

Esse caminho ainda não foi validado em aparelho (pendência P-17 em `docs/PROGRESSO.md`).

## Testes

| O quê | Comando | Precisa do backend? |
|---|---|---|
| Testes unitários, de serviços, de telas e análise de testIDs | `npm test` | Não |
| Cobertura (falha se `src/domain` ficar abaixo de 90%) | `npx jest --coverage` | Não |
| Tipos | `npm run typecheck` | Não |
| Lint | `./node_modules/.bin/eslint src` | Não |
| Fluxo completo no modo demonstração (Playwright) | `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo` e `NODE_PATH="$(npm root -g)" node e2e-web/demo-mode-flow.cjs /tmp/nomade-demo` | Não |
| Integração com o backend local | `NOMADE_IT=1 NOMADE_IT_URL=http://127.0.0.1:54321 NOMADE_IT_ANON=<anon key> NOMADE_IT_DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx jest integration --forceExit` | Sim, com functions |

Sem `NOMADE_IT=1`, os testes de integração aparecem como ignorados no `npm test`. Um teste proíbe `fetch` no modo demonstração.

### Navegador (Playwright)

Fluxo completo sem servidor, capturas das telas em 3 larguras, fluxos com o Supabase local (`demo-flow`, `auth-flow`) e comparação de imagem: [`e2e-web/README.md`](e2e-web/README.md).

### Celular (Maestro)

Fluxos de cadastro, login e dos casos de uso UC-01, UC-02 e UC-03: [`.maestro/README.md`](.maestro/README.md). Precisam de aparelho ou emulador e do [Maestro CLI](https://maestro.mobile.dev). Os IDs usados nos fluxos são conferidos contra o código pelo `npm test`.

## Estrutura

```
src/
  app/          rotas (Expo Router): auth, abas, corrida, resumo, zona, missões, recompensas, compartilhar, moderação
  domain/       regras do jogo, puras e testadas (também usadas pelas Edge Functions)
  features/     telas e casos de uso: auth, run, engagement (missões, baú, sequência, telemetria),
                social (card, feed, convite), safety, moderation, notifications
  services/     api (repositórios Supabase e o servidor de demonstração), auth, location, sensors,
                offline (fila SQLite), sync, signing (HMAC), notifications, safety
  components/   UI reutilizável; art (mascotes, chefões, ilustrações em SVG), motion e celebration
  store/        estado (Zustand): sessão, jogo, zonas, notificações
  theme/        sistema visual Pit Lane Neon (`tokens.ts`, `neon.ts`)
  demo/         mundo de DEMONSTRAÇÃO usado pelo modo demonstração
```

Regras de camada (telas não chamam o Supabase direto, o domain não importa React) em [`docs/ARQUITETURA.md`](../../docs/ARQUITETURA.md).

## Limitações conhecidas

| Parte | Hoje |
|---|---|
| Mapa | `react-native-maps` (Apple Maps no iPhone, Google Maps no Android) e MapLibre na web, em vez de Mapbox |
| GPS com a tela bloqueada e push remoto | Só em development build |
| Escolta | Compartilha a localização uma vez ao ligar; não acompanha ao vivo |
| SOS e alerta de parada | Abrem o app de mensagens com a localização; a pessoa toca em enviar |
| Feed | Só da crew, com reações prontas; sem seguir pessoas nem comentar |
| Resumo | Sem parciais por km nem gráfico de ritmo na tela; corridas antigas abrem sem o bloco de recompensas |
| Validação em aparelho | Ícone da aba Correr no Android, splash no Android 12+, animação do baú lendário em Android de entrada e leitores de tela ainda não conferidos |
