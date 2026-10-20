# NOMADE RUN

**Um Projeto de Gestão e Gamificação de Corridas Urbanas**

App de corrida de rua com GPS e disputa de território: cada trecho corrido soma pontos para o seu time na região da cidade por onde você passou. O time com mais influência domina a região, que pode ser atacada, defendida e perdida. Além do território (o modo Domínio), a Arena tem outros minigames sobre o mapa real e um placar Cidade × Cidade.

**Integrantes:** Gabryel Gomes Bahmad Camapum · Mateus Augusto De Faria Brito

---

## O que o MVP entrega

- **Conta:** cadastro com e-mail e senha (16 anos ou mais, termos e privacidade aceitos em separado), login, recuperação de senha, perfil com foto, exportar os dados (JSON) e excluir a conta (LGPD).
- **Times:** escolha de um dos quatro times no primeiro acesso.
- **Corrida:** GPS a cada 1 s com pausa automática, pedômetro, guia por voz e tela sempre acesa. Para apresentar em sala existe o modo **Simulação**: uma volta no Parque Flamboyant (Goiânia) em velocidade 10×.
- **Sem internet:** a corrida é gravada no aparelho e enviada quando a conexão volta. Enquanto isso, o resumo aparece como provisório.
- **Servidor como juiz:** o servidor confere a assinatura de cada lote de pontos, roda o antifraude, recalcula toda a pontuação e decide quem conquista cada zona. O app só mostra estimativas.
- **Mapa vivo:** zonas carregadas do servidor e troca de dono em tempo real (menos de 1 s nos testes locais), alerta de zona sob ataque e central de notificações.
- **Jogo:** rankings por semana ou temporada (geral, time, cidade e distrito), crews, Neblina ("Onde já corri"), Fuga (fantasma), Caça (baús sorteados pelo servidor), placar entre cidades.
- **Corrida Segura:** até 5 contatos, botão SOS sempre visível (SMS com a localização), Escolta (compartilha a localização ao ligar) e alerta de parada.
- **Moderação:** painel web, dentro do próprio app, em que moderadores revisam corridas suspeitas e aprovam ou rejeitam com justificativa; administradores inativam contas.
- **Privacidade:** até 3 zonas de privacidade, que escondem os pontos do percurso perto de casa para outras pessoas.

O que **não** entrou (ou entrou só como demonstração) e o motivo estão em [`docs/REQUISITOS.md`](docs/REQUISITOS.md) e na seção "Limitações" de [`docs/COMO_APRESENTAR.md`](docs/COMO_APRESENTAR.md).

## Tecnologias

| Parte | Tecnologia |
|---|---|
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router, Zustand, expo-location, expo-sqlite, expo-secure-store, react-native-maps (celular) e MapLibre (web) |
| Backend | Supabase: Postgres 17 com PostGIS, Auth, Row Level Security (RLS), Edge Functions em Deno, Realtime e pg_cron |
| Regras do jogo | `apps/mobile/src/domain`: TypeScript puro, usado pelo app **e** pelas Edge Functions (uma única fonte de regras) |
| Testes | Jest (app), pgTAP (banco), Deno (functions), Playwright (navegador) e Maestro (fluxos no celular) |

## Estrutura do repositório

```
nomaderun/
├── apps/mobile/          app Expo (celular e painel web)
│   ├── src/app/          rotas (Expo Router)
│   ├── src/domain/       regras do jogo, puras e testadas
│   ├── src/features/     telas e casos de uso (auth, corrida, segurança, moderação)
│   ├── src/services/     API, GPS, fila offline, sincronização, assinatura HMAC
│   ├── .maestro/         fluxos de teste no celular
│   └── e2e-web/          testes no navegador (Playwright)
├── supabase/
│   ├── migrations/       esquema, RLS, funções SQL, jobs
│   ├── functions/        Edge Functions (Deno) e seus testes
│   ├── tests/            pgTAP e teste de segurança
│   ├── seed.sql          dados de DEMONSTRAÇÃO (Goiânia)
│   └── DEPLOY.md         como publicar no Supabase Cloud
└── docs/                 requisitos, arquitetura, decisões, QA, ERS e apresentação
```

---

## Instalar e rodar

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

Nunca coloque a chave `service_role`/`secret` no `.env` do app.

### 5. Abrir o app

```bash
cd apps/mobile
npx expo start              # use --clear depois de mudar o .env
```

Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android). Para abrir no navegador (inclusive o painel de moderação), aperte `w` no terminal do Expo ou rode `npx expo start --web`.

Sem as duas variáveis do `.env`, o app abre a tela "Backend não configurado".

### Contas de demonstração

Criadas pelo `seed.sql` e marcadas como demonstração (`is_demo = true`). Servem só para o banco local ou para a apresentação; troque as senhas se usar o seed num projeto na nuvem.

| Papel | E-mail | Senha | Time |
|---|---|---|---|
| Corredor | `corredor.demo@nomaderun.app` | `Corrida@2026` | Neon Striders |
| Moderador | `moderador.demo@nomaderun.app` | `Moderacao@2026` | Night Owls |
| Administrador | `admin.demo@nomaderun.app` | `Admin@2026demo` | Volt Runners |
| Corredor com corrida em revisão | `suspeito.demo@nomaderun.app` | `Suspeito@2026` | Urban Coyotes |

O seed também cria 271 zonas de demonstração em volta do Parque Flamboyant, com o parque sob ataque. Para voltar ao estado inicial: `npx supabase db reset` (apaga tudo o que foi feito no banco local) e espere uns 15 s antes de abrir o app.

---

## Rodar os testes

Com o backend local no ar e `npm run functions:serve` rodando:

| O quê | Onde | Comando |
|---|---|---|
| App: regras, serviços, testIDs | `apps/mobile` | `npm test` |
| Cobertura das regras (mínimo 90%) | `apps/mobile` | `npx jest --coverage` |
| Tipos e lint | `apps/mobile` | `npm run typecheck` e `./node_modules/.bin/eslint src` |
| Banco (pgTAP: RLS, funções, jobs) | raiz | `npm run db:test:psql` |
| Edge Functions (Deno) | raiz | `npm run functions:test` |
| Ponta a ponta do backend | raiz | `npm run e2e` |
| Segurança (ataques à API) | raiz | `STRICT=1 bash supabase/tests/security/run.sh` |
| Integração do app com o backend | `apps/mobile` | ver `docs/QA.md` §3 |
| Navegador (Playwright) | `apps/mobile` | ver [`apps/mobile/e2e-web/README.md`](apps/mobile/e2e-web/README.md) |
| Celular (Maestro) | `apps/mobile` | ver [`apps/mobile/.maestro/README.md`](apps/mobile/.maestro/README.md) |

Os testes de banco e de ponta a ponta gravam dados. Antes de uma apresentação, rode `npx supabase db reset`.

---

## Documentação

| Documento | Para quê |
|---|---|
| [`docs/COMO_APRESENTAR.md`](docs/COMO_APRESENTAR.md) | Checklist, roteiro da demo, perguntas da banca e plano B |
| [`docs/REQUISITOS.md`](docs/REQUISITOS.md) | Status de cada requisito do ERS e onde foi testado |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Componentes, camadas, banco e fluxo de segurança |
| [`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md) | Decisões D-01 a D-53 com justificativa |
| [`docs/API_CONTRATO.md`](docs/API_CONTRATO.md) | Contrato das Edge Functions e erros |
| [`docs/QA.md`](docs/QA.md) | Revisão de segurança, matriz de rastreabilidade e como rodar cada suíte |
| [`docs/PROGRESSO.md`](docs/PROGRESSO.md) | Log do desenvolvimento e pendências |
| [`docs/PLANO_DESENVOLVIMENTO.md`](docs/PLANO_DESENVOLVIMENTO.md) | Fases, tarefas e próximos passos |
| [`docs/ERS-ALTERACOES-PROPOSTAS.md`](docs/ERS-ALTERACOES-PROPOSTAS.md) | O que mudar no ERS para ele bater com o que foi construído |
| [`supabase/DEPLOY.md`](supabase/DEPLOY.md) | Publicar o backend no Supabase Cloud |
| [`apps/mobile/README.md`](apps/mobile/README.md) | Detalhes do app: variáveis, GPS em segundo plano, testes |
| [`docs/GUIA-DO-DESENVOLVEDOR.md`](docs/GUIA-DO-DESENVOLVEDOR.md) | Git, onde está cada coisa e como editar a apresentação |

---

## Documentos do TCC

### Para entregar

| Arquivo | O que é |
|---|---|
| `docs/ERS/NOMADE RUN - Um Projeto de Gestão e Gamificação de Corridas Urbanas.pdf` | **ERS em PDF**, no modelo da disciplina |
| `docs/ERS/NOMADE RUN - ERS (editável).docx` | Mesmo ERS em Word |
| `docs/ERS/ERS-NOMADE-RUN.md` | Fonte do ERS |

### Apresentação

| Caminho | O que é |
|---|---|
| `docs/apresentacao/web/NOMADE RUN Apresentação.html` | Apresentação completa numa página (10 slides + mockup interativo), abre no navegador |
| `docs/apresentacao/NOMADE RUN - Apresentação.pdf` | Os 10 slides em PDF |
| `docs/apresentacao/mockup/` | Mockup interativo e imagens dos celulares |
| `docs/apresentacao/telas/` | Capturas usadas nos slides |
| `docs/apresentacao/slides/` | Fonte dos slides |
| `docs/apresentacao/DESIGN-SYSTEM.md` | Cores, fontes e regras dos slides |
| `docs/06-PROMPT-APRESENTACAO.md` e `docs/07-PROMPT-COPIA-E-COLA.md` | Prompts que geraram a apresentação (o roteiro atualizado da demo está em `docs/COMO_APRESENTAR.md`) |

Os slides e o mockup foram feitos antes do backend: o slide de "o que falta" ainda diz "protótipo sem servidor" e "60 testes". Atualize esses números antes de apresentar (veja `docs/COMO_APRESENTAR.md`).

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
