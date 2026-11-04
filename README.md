# NOMADE RUN

**Um Projeto de Gestão e Gamificação de Corridas Urbanas**

App de corrida de rua com GPS e disputa de território entre quatro times. A regra cabe numa frase: corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela. Em volta do território há um chefão semanal da cidade, uma liga, missões, crews e cards para compartilhar.

**Integrantes:** Gabryel Gomes Bahmad Camapum · Mateus Augusto De Faria Brito

---

## O que o app faz

O app tem quatro abas: **Mapa · Arena · Clube · Você**. Correr fica num lugar só: o botão **CORRER** do Mapa (mais os atalhos com contexto, como defender uma zona ou o "Ir" das missões).

- **Primeira abertura, antes da conta:** boas-vindas com os 4 mascotes, "a cidade está dividida", as capas dos times (mascote, lema, líder e um quiz que sugere) e a cerimônia "Seu rastro agora é desta cor", em 4 toques e sem digitar; depois o cadastro (16 anos ou mais) e a explicação da localização antes do pedido. Quem já tem conta entra direto.
- **Corrida:** GPS a cada 1 s com pausa automática, pedômetro, guia por voz, SOS sempre visível e a pintura prevista ao vivo. Sem internet, a corrida fica no aparelho e é enviada quando a conexão volta.
- **Servidor como juiz:** o servidor confere a assinatura de cada lote de pontos, roda o antifraude, recalcula a corrida e decide quem fica com cada zona. O app só mostra estimativas.
- **Território:** zonas desenhadas como regiões suavizadas, troca de dono em tempo real, alerta de invasão e central de notificações.
- **Arena:** Raid semanal (um chefão com barra de vida coletiva), Liga semanal em grupos de até 30, Fuga (fantasma) e Caça (baús no mapa).
- **Progresso sem pressão:** níveis com títulos, missões diárias e semanais com o botão "Ir", "Como jogar" em 6 cartões, primeira semana guiada, baú do dia com as chances à vista, medalhas e uma sequência semanal com congelamento e pausa de saúde. Nada é vendido.
- **Social:** crews com convite por link, feed da crew com reações prontas (Bora!, fogo, raio) e o eco da crew ("… reforçou 2 trechos que você pintou"), e cards da corrida e da semana para Stories, sem o começo e o fim da rota.
- **Privacidade e LGPD:** até 3 zonas de privacidade, exportar os dados, excluir a conta (também explicado na página pública `/excluir-conta`), telemetria opcional, desligada por padrão, e Ajustes em 4 telas (Conta · Segurança na corrida · Privacidade · Lembretes).
- **Moderação:** painel web dentro do próprio app, em que moderadores revisam corridas suspeitas; administradores inativam contas.
- **Modo demonstração:** o app inteiro roda com dados de exemplo, sem servidor, marcado com o selo "Demonstração" em toda tela.

As partes novas do servidor (pintura, Raid, Liga, missões, feed, telemetria) ligam por chaves que começam desligadas, uma por vez ([`supabase/DEPLOY.md`](supabase/DEPLOY.md) §10–§12). O que não entrou e o motivo estão em [`docs/REQUISITOS.md`](docs/REQUISITOS.md).

## Tecnologias

| Parte | Tecnologia |
|---|---|
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router, Zustand, expo-location, expo-sqlite, expo-secure-store, react-native-maps (celular) e MapLibre (web) |
| Backend | Supabase: Postgres 17 com PostGIS, Auth, Row Level Security (RLS), Edge Functions em Deno, Realtime e pg_cron |
| Regras do jogo | `apps/mobile/src/domain`: TypeScript puro, usado pelo app **e** pelas Edge Functions (uma única fonte de regras) |
| Arte e animação | SVG (react-native-svg) e Reanimated 4, sem Skia nem Lottie |
| Testes | Jest (app), pgTAP (banco), Deno (functions), Playwright (navegador), Maestro (fluxos no celular) e CI no GitHub |

## Estrutura do repositório

```
nomaderun/
├── apps/mobile/          app Expo (celular e painel web)
│   ├── src/app/          rotas (Expo Router)
│   ├── src/domain/       regras do jogo, puras e testadas
│   ├── src/features/     telas e casos de uso (auth, corrida, engajamento, social, moderação)
│   ├── src/services/     API, modo demonstração, GPS, fila offline, sincronização, assinatura HMAC
│   ├── src/components/   componentes, arte (SVG), animações e celebrações
│   ├── .maestro/         fluxos de teste no celular
│   └── e2e-web/          testes no navegador (Playwright)
├── supabase/
│   ├── migrations/       esquema, RLS, funções SQL, jobs
│   ├── functions/        Edge Functions (Deno) e seus testes
│   ├── tests/            pgTAP e teste de segurança
│   ├── seed.sql          dados de DEMONSTRAÇÃO (Goiânia); seed_v2_demo.sql completa a v2
│   └── DEPLOY.md         como publicar no Supabase Cloud
├── .github/workflows/    CI no GitHub
└── docs/                 requisitos, arquitetura, decisões, QA, ERS e apresentação (melhoria/ = reformulação v2)
```

---

## Ver o app sem servidor (modo demonstração)

Precisa só do Node.js 22. Nada é enviado a servidor nenhum.

```bash
cd apps/mobile
npm install
EXPO_PUBLIC_DEMO=1 npx expo start --web --clear
```

Abra `http://localhost:8081/?cenario=primeira-abertura` para começar da primeira abertura (time, cerimônia e cadastro), ou `?cenario=cheio` para um corredor com histórico. Os outros cenários (`vazio`, `sem-time`, `sob-ataque`, `moderador`, `lento`, `erro`, `offline`) estão em [`docs/COMO_APRESENTAR.md`](docs/COMO_APRESENTAR.md) §1. No celular, troque `--web` por nada e leia o QR com o Expo Go.

O `--clear` é obrigatório ao ligar ou desligar o `EXPO_PUBLIC_DEMO`. Num app ligado a um servidor, o botão **Ver demonstração** da tela Entrar abre o mesmo modo.

---

## Instalar e rodar com o backend

### Pré-requisitos

- **Node.js 22** e npm.
- **Docker** rodando (o Supabase local roda em containers).
- **Expo Go** no celular (App Store ou Google Play). Celular e computador **na mesma rede Wi-Fi**.
- Para os testes das functions: **Deno 2** (`npm i -g deno@2.5.6`).

### 1. Baixar o código

```bash
git clone https://github.com/GabryelGomes/nomaderun.git
cd nomaderun
git checkout claude/dreamy-ptolemy-xnm4r7
```

Para atualizar depois: `git pull origin claude/dreamy-ptolemy-xnm4r7`.

### 2. Instalar as dependências

```bash
npm install                 # na raiz: instala o Supabase CLI
cd apps/mobile && npm install && cd ../..
```

### 3. Subir o backend local

Na raiz, em um terminal:

```bash
npm run db:start            # sobe Postgres, Auth, Realtime e Storage; aplica migrations e seed
```

A primeira vez demora alguns minutos (baixa as imagens do Docker). Em outro terminal, deixe as Edge Functions rodando:

```bash
npm run functions:serve
```

### 4. Configurar o app

Pegue a URL e a chave pública do backend local:

```bash
npx supabase status -o env
```

Use as linhas **`API_URL`** (normalmente `http://127.0.0.1:54321`) e **`ANON_KEY`** (a `PUBLISHABLE_KEY` também funciona). Sem `-o env` aparecem os mesmos valores numa tabela. O comando pode avisar "Stopped services" e terminar com código de erro: é normal, porque o `db:start` deixa de fora serviços que o projeto não usa.

Crie o arquivo `apps/mobile/.env` a partir do modelo:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

e preencha:

```
EXPO_PUBLIC_SUPABASE_URL=http://192.168.0.10:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key do supabase status>
```

**No celular, troque `127.0.0.1` pelo IP do computador na rede** (o celular não enxerga o `127.0.0.1` do computador). Para descobrir o IP: `ipconfig getifaddr en0` (macOS), `hostname -I` (Linux) ou `ipconfig` (Windows, campo "Endereço IPv4"). Para usar só no navegador do próprio computador, `127.0.0.1` funciona.

**Publicar para usar de qualquer rede (EAS Update + Supabase Cloud):** copie `apps/mobile/.env.production.example` para `apps/mobile/.env.production`, preencha a chave anon/publishable da nuvem e rode `npm run publicar -- "mensagem"` na raiz. O script recusa publicar com URL local ou chave secreta.

**Atalho (recomendado para o celular):** na raiz, `npm run celular` faz tudo de uma vez: confere o Docker, sobe o Supabase e as Edge Functions, descobre o IP que o celular alcança (no WSL, pergunta ao Windows), grava o `apps/mobile/.env`, testa o backend por esse IP e abre o Expo com o QR code certo. Se o IP detectado estiver errado: `IP=192.168.0.10 npm run celular`. **iPhone:** o Expo Go só abre o projeto com a mesma conta Expo logada no celular e no computador (`npx expo login -u <usuário>`). No Android dá para rodar sem conta: `OFFLINE=1 npm run celular`.

**No WSL (Windows):** o `hostname -I` dentro do WSL devolve um IP interno (172.x) que o celular não alcança, e o Expo Go fica carregando sem parar. Use o IP do **Windows** na rede Wi-Fi (`ipconfig` no PowerShell, "Endereço IPv4") no `.env` e no Expo:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<IP do Windows> npx expo start --clear
```

Para o celular alcançar o Metro (porta 8081) e o Supabase (54321) dentro do WSL, ative o modo de rede espelhado (`networkingMode=mirrored` no `%UserProfile%\.wslconfig`, depois `wsl --shutdown`) e libere as portas no Firewall do Windows. Alternativa: `npx expo start --tunnel` para o Metro e Supabase Cloud para o backend.

Nunca coloque a chave `service_role`/`secret` no `.env` do app.

### 5. Abrir o app

```bash
cd apps/mobile
npx expo start              # use --clear depois de mudar o .env
```

Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android). Para abrir no navegador (inclusive o painel de moderação), aperte `w` no terminal do Expo ou rode `npx expo start --web`.

Sem as duas variáveis do `.env`, o app abre a tela "Backend não configurado".

### Contas de demonstração

Criadas pelo `seed.sql` e marcadas como demonstração (`is_demo = true`). **Estas senhas valem só para o banco local.** O repositório é público: num projeto na nuvem, troque as senhas de `admin.demo` e `moderador.demo` logo depois do seed (como fazer: `docs/COMO_APRESENTAR.md` §1).

| Papel | E-mail | Senha | Time |
|---|---|---|---|
| Corredor | `corredor.demo@nomaderun.app` | `Corrida@2026` | Neon Striders |
| Moderador | `moderador.demo@nomaderun.app` | `Moderacao@2026` | Night Owls |
| Administrador | `admin.demo@nomaderun.app` | `Admin@2026demo` | Volt Runners |
| Corredor com corrida em revisão | `suspeito.demo@nomaderun.app` | `Suspeito@2026` | Urban Coyotes |

O seed também cria 271 zonas de demonstração em volta do Parque Flamboyant, com o parque sob ataque. Para voltar ao estado inicial: `npx supabase db reset` (apaga tudo o que foi feito no banco local) e espere uns 15 s antes de abrir o app.

As telas da v2 que dependem do servidor (pintura, Raid, Liga, missões, feed) ficam "indisponíveis" até você ligar as flags. Para vê-las no backend local: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed_v2_demo.sql` e as flags de [`supabase/DEPLOY.md`](supabase/DEPLOY.md) §8.2. Na conta real, a corrida usa o GPS; a **Simulação** (uma volta no Parque Flamboyant em 10×) só existe no modo demonstração.

---

## Rodar os testes

| O quê | Onde | Comando | Precisa do backend? |
|---|---|---|---|
| App: regras, serviços, telas, testIDs | `apps/mobile` | `npm test` | Não |
| Cobertura das regras (mínimo 90%) | `apps/mobile` | `npx jest --coverage` | Não |
| Tipos e lint | `apps/mobile` | `npm run typecheck` e `./node_modules/.bin/eslint src` | Não |
| Fluxo completo no modo demonstração | `apps/mobile` | `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo` e `NODE_PATH="$(npm root -g)" node e2e-web/demo-mode-flow.cjs /tmp/nomade-demo` (Playwright global) | Não |
| Banco sem Docker (Postgres 16 + PostGIS + pgTAP, Linux) | raiz | `npm run db:test:local` (na 1ª vez, `NR_INSTALL=1`; detalhes em `supabase/DEPLOY.md` §0.1) | Não |
| Banco (pgTAP) no Supabase local | raiz | `npm run db:test:psql` | Sim |
| Edge Functions (Deno) | raiz | `npm run functions:test` e `npm run functions:check` | Não |
| Ponta a ponta do backend | raiz | `npm run e2e` | Sim, com `functions:serve` |
| Segurança (ataques à API) | raiz | `STRICT=1 bash supabase/tests/security/run.sh` e `bash supabase/tests/security/run-v2.sh` | Sim, com `functions:serve` |
| Integração do app com o backend | `apps/mobile` | ver `docs/QA.md` §3 | Sim |
| Outros testes no navegador (Playwright) | `apps/mobile` | ver [`apps/mobile/e2e-web/README.md`](apps/mobile/e2e-web/README.md) | Depende do teste |
| Celular (Maestro) | `apps/mobile` | ver [`apps/mobile/.maestro/README.md`](apps/mobile/.maestro/README.md) | Sim, e um aparelho |

Números da última rodada (Fase 8): Jest 1.672 ✅ (26 de integração pulados), pgTAP 964/964 em 34 arquivos, Deno 108 ok (1 ignorado), `demo-mode-flow` 62/62, bundle web 1.238.936 B gzip (orçamento 1.250.000).

A CI do GitHub (`.github/workflows/ci.yml`) roda tipos, lint, Jest, cobertura, contraste, o export web com o limite de tamanho, Deno e pgTAP a cada push. Os testes de banco e de ponta a ponta gravam dados: antes de uma apresentação, rode `npx supabase db reset`.

---

## Publicação

O passo a passo está em [`supabase/DEPLOY.md`](supabase/DEPLOY.md): §10 (servidor da v2: migrations, functions e flags), §11 (versão web na Vercel) e **§12 (publicação: atualização pelo ar com `expo-updates`, Expo Go, identificador `br.com.nomaderun.app`, limite de chamadas e pacote legal)**. Antes do primeiro `publicar`, os autores rodam `eas init` e colam o UUID no `app.json`; a trava `scripts/check-publicacao.js` recusa enquanto houver marcador.

---

## Documentação

| Documento | Para quê |
|---|---|
| [`docs/COMO_APRESENTAR.md`](docs/COMO_APRESENTAR.md) | Checklist, roteiro da demo, perguntas da banca e plano B |
| [`docs/REQUISITOS.md`](docs/REQUISITOS.md) | Status de cada requisito do ERS e onde foi testado |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Componentes, camadas, banco e fluxo de segurança |
| [`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md) | Decisões D-01 a D-99 com justificativa |
| [`docs/API_CONTRATO.md`](docs/API_CONTRATO.md) | Contrato das Edge Functions e erros |
| [`docs/QA.md`](docs/QA.md) | Revisão de segurança, matriz de rastreabilidade e como rodar cada suíte |
| [`docs/PROGRESSO.md`](docs/PROGRESSO.md) | Log do desenvolvimento e pendências |
| [`docs/PLANO_DESENVOLVIMENTO.md`](docs/PLANO_DESENVOLVIMENTO.md) | Fases, tarefas e próximos passos |
| [`docs/ERS-ALTERACOES-PROPOSTAS.md`](docs/ERS-ALTERACOES-PROPOSTAS.md) | O que mudar no ERS (v1.1 e v1.2) para ele bater com o que foi construído |
| [`docs/melhoria/PLANO-MESTRE.md`](docs/melhoria/PLANO-MESTRE.md) | Reformulação v2: o que mudou, decisões e ondas; relatórios em `docs/melhoria/relatorios/` |
| [`supabase/DEPLOY.md`](supabase/DEPLOY.md) | Publicar o backend no Supabase Cloud e o app (§10–§12) |
| [`docs/guia-teste/`](docs/guia-teste/) | Guia de teste para colegas e professores (HTML e PDF) |
| [`apps/mobile/README.md`](apps/mobile/README.md) | Detalhes do app: variáveis, GPS em segundo plano, testes |
| [`docs/GUIA-DO-DESENVOLVEDOR.md`](docs/GUIA-DO-DESENVOLVEDOR.md) | Git, onde está cada coisa e como editar a apresentação |

---

## Documentos do projeto

### Para entregar

| Arquivo | O que é |
|---|---|
| `docs/ERS/NOMADE RUN - Um Projeto de Gestão e Gamificação de Corridas Urbanas.pdf` | **ERS em PDF**, no modelo da disciplina |
| `docs/ERS/NOMADE RUN - ERS (editável).docx` | Mesmo ERS em Word |
| `docs/ERS/ERS-NOMADE-RUN.md` | Fonte do ERS |

### Apresentação

| Caminho | O que é |
|---|---|
| `docs/apresentacao/web/NOMADE RUN Apresentação.html` | Apresentação completa numa página (12 slides com as telas reais), abre no navegador |
| `docs/apresentacao/NOMADE RUN - Apresentação.pdf` | Os 12 slides em PDF |
| `docs/apresentacao/mockup/` | Mockup interativo e imagens dos celulares |
| `docs/apresentacao/telas-v2/` | Capturas reais usadas nos slides (modo demonstração) |
| `docs/apresentacao/slides/` | Fonte dos slides |
| `docs/apresentacao/DESIGN-SYSTEM.md` | Cores, fontes e regras dos slides |
| `docs/06-PROMPT-APRESENTACAO.md` e `docs/07-PROMPT-COPIA-E-COLA.md` | Prompts que geraram a apresentação (o roteiro atualizado da demo está em `docs/COMO_APRESENTAR.md`) |

Os slides têm as telas e os números da Fase 8 (como regerar: `docs/apresentacao/README.md`).

### Produto e pesquisa

| Caminho | O que é |
|---|---|
| `docs/produto/NOMADE RUN - Product Book.pdf` | Estratégia, Arena, design system, arquitetura e roadmap |
| `docs/pesquisa/` | Pesquisas de mercado, UI, stack técnica e skills, com fontes |
| `docs/05-PROMPT-MESTRE.md` | Prompt mestre que gerou a pesquisa, o Product Book e o protótipo |
| `docs/01-BRAINSTORM.md` a `04` | Rascunhos iniciais (uso interno) |

### Regerar os PDFs

```bash
./docs/ERS/build-src/build.sh
./docs/produto/build/build.sh
```
