# Como apresentar o NOMADE RUN

Guia para a banca: o que preparar, o roteiro da demonstração da v2 em cerca de 10 minutos, o que dizer sobre arquitetura e segurança, as perguntas prováveis e o que fazer quando algo falhar.

Instalação e comandos: [`README.md`](../README.md). Publicação na nuvem: [`supabase/DEPLOY.md`](../supabase/DEPLOY.md) §10.

---

## 1. Escolha como mostrar

A demonstração principal usa o **modo demonstração**: o app inteiro roda com dados de exemplo guardados no próprio aparelho, sem servidor e sem internet. Toda tela mostra o selo "Demonstração", e o card compartilhado sai com "DADOS DE DEMONSTRAÇÃO".

| Opção | Quando usar | Como abrir |
|---|---|---|
| **A. Demonstração no navegador (recomendada)** | Projetor ligado ao notebook; nenhuma dependência de rede | Em `apps/mobile`: `EXPO_PUBLIC_DEMO=1 npx expo start --web --clear` e abra `http://localhost:8081/?cenario=primeira-abertura`. Use o modo celular das ferramentas do navegador (390 px de largura) |
| **B. Demonstração no celular** | Quer mostrar no aparelho, com vibração e animações reais | Em `apps/mobile`: `EXPO_PUBLIC_DEMO=1 npx expo start --clear` e leia o QR com o Expo Go. No celular, o app abre já com um corredor de exemplo (sem a escolha de time). No app da v2 publicado, a tela **Entrar** tem o botão **Ver demonstração** |
| **C. Servidor de verdade** | Mostrar o servidor como juiz: tempo real, moderação, corrida sem internet | Backend local (`npm run db:start` e `npm run functions:serve`) ou o Supabase Cloud. As telas da v2 que dependem do servidor (pintura, Raid, Liga, missões, feed) só aparecem com as migrations e as flags da v2 ligadas (`DEPLOY.md` §10); sem elas, mostram "indisponível" |

O `--clear` é obrigatório sempre que ligar ou desligar o `EXPO_PUBLIC_DEMO`: sem ele, o Expo reaproveita o pacote anterior.

### Cenários da demonstração (`?cenario=`, só no navegador)

| Cenário | O que abre |
|---|---|
| `primeira-abertura` | Sem conta: Boas-vindas → cadastro → escolha do time. **Use no roteiro** |
| `sem-time` | Conta criada, sem time: começa na escolha do time |
| `cheio` (padrão) | Corredor com histórico, crew, feed e notificações |
| `vazio` | Conta nova com time: telas nos estados vazios ilustrados |
| `sob-ataque` | Como `cheio`, e um alerta de invasão chega alguns segundos depois de abrir |
| `moderador` | Como `cheio`, com papel de moderador e 3 corridas em revisão |
| `lento`, `erro`, `offline` | Cada pedido demora 2,5 s, falha com erro, ou falha por falta de rede |

O cenário é lido quando a página carrega. Para trocar, mude a URL e recarregue.

### Antes de usar a nuvem (opção C)

- **Senhas das contas de demonstração (A-1):** as do seed estão no README, e o repositório é público. No projeto da nuvem, troque a senha de `admin.demo` e `moderador.demo` (painel **Authentication → Users**, ou no **SQL Editor**: `update auth.users set encrypted_password = crypt('NOVA_SENHA', gen_salt('bf')) where email in ('admin.demo@nomaderun.app','moderador.demo@nomaderun.app');`). Guarde as novas senhas só com a equipe.
- **Limite de login:** suba para **30** em **Authentication → Rate Limits → Sign-ups and sign-ins** antes do ensaio; volte para 3 depois. A banca e você saem pelo mesmo IP.
- **Projeto pausado:** o plano gratuito pausa o projeto depois de uma semana sem uso. Abra o app uns dias antes, ou clique em **Restore** no painel.

---

## 2. Checklist do dia anterior

**Demonstração (A ou B)**
- [ ] `EXPO_PUBLIC_DEMO=1 npx expo start --web --clear` abre a tela de Boas-vindas com o selo "Demonstração".
- [ ] Ensaio completo do roteiro da seção 3, do cadastro ao Você, sem erro.
- [ ] Uma segunda aba em `?cenario=cheio`, para mostrar telas com dados se o tempo apertar.
- [ ] Teste automático do mesmo fluxo (opcional, confirma que o pacote está bom): `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo` e `NODE_PATH="$(npm root -g)" node e2e-web/demo-mode-flow.cjs /tmp/nomade-demo` → 21/21.

**Servidor (só se for usar a opção C)**
- [ ] Local: `npm run db:start` e `npm run functions:serve` sem erro; `npx supabase db reset` com antecedência e ~15 s de espera antes de abrir o app (o tempo real demora a começar logo depois do reset).
- [ ] Nuvem: deploy conferido (`DEPLOY.md` §10), limite de login em 30, senhas demo trocadas.
- [ ] Navegador com `moderador.demo@nomaderun.app` pronto para o painel de moderação.

**Aparelhos e sala**
- [ ] Espelhamento do celular no projetor testado (opção B).
- [ ] Bateria acima de 80%, carregadores na mochila, brilho no máximo, "Não perturbe" ligado.
- [ ] Vídeo de reserva (2 min) do roteiro gravado no notebook.
- [ ] Capturas de reserva abertas numa pasta: `docs/melhoria/capturas/depois/` (165 telas em 3 larguras).
- [ ] Slides com os números da seção 5.

---

## 3. Roteiro da demonstração (~10 min)

Opção A, com `?cenario=primeira-abertura`. Entre parênteses, os requisitos do ERS que cada passo mostra.

| # | Tempo | O que fazer | O que dizer | Requisitos |
|---|---|---|---|---|
| 1 | 1:00 | **Boas-vindas → Começar → cadastro.** Preencha nome, e-mail, senha e nascimento; aceite termos e privacidade em separado | "Cada consentimento é separado, como pede a LGPD. Menor de 16 anos é recusado no app e no banco." | RF-001, RNF-013 |
| 2 | 1:30 | **Escolher o time:** "A cidade está dividida" → carrossel dos 4 times, com mascote e líder → toque em **Não sei escolher** para mostrar o quiz → escolha um time → a cor do time inunda a tela → explicação da localização antes do pedido | "Cada time tem mascote, líder e uma forma própria, para quem é daltônico. O app explica para que usa a localização antes de pedir." | RF-003, RNF-013 |
| 3 | 1:00 | **Mapa:** zonas da cidade como regiões suavizadas, faixa de hoje (missão, baú, chefão) e a missão de boas-vindas | "A regra do território é uma frase: corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela. O mapa nunca mostra a grade de hexágonos." | RF-007, RF-021 |
| 4 | 1:30 | **Correr:** toque na missão de boas-vindas → **Simulação** → **Começar**. Mostre o tempo, a distância, o ritmo, a pintura prevista e o **SOS** sempre visível. Depois de ~20 s, segure **Segure para encerrar** | "Na conta real o padrão é o GPS; a simulação só existe na demonstração. Encerrar pede 600 ms pressionado, para não terminar com o celular no bolso." | RF-004, RF-024, RNF-010, RNF-015 |
| 5 | 1:00 | **Resumo:** "Zona conquistada", métricas, bloco de recompensas (XP, missão, baú, sequência) | "Na conta real, esse resultado vem do servidor, que recalcula a corrida inteira. As recompensas são só XP e cosméticos: nada é vendido." | RF-006, RF-008, RF-016 |
| 6 | 1:00 | **Compartilhar:** troque o modelo do card, mostre a versão sem rota e baixe a imagem | "O começo e o fim da rota são cortados e as zonas de privacidade somem, com uma folga sorteada. Assim, ninguém descobre onde você mora pelo card." | RF-017, RN-010 |
| 7 | 1:00 | **Arena:** chefão da semana com a barra de vida e a "Sua parte", missões de hoje e os modos (Fuga, Caça, Liga) | "Toda semana um chefão invade a cidade: cada quilômetro tira 10 de vida. A chance de crítico está à vista." | RF-021, RF-026, RF-027 |
| 8 | 0:40 | **Clube:** crew, km da semana, feed com **Bora!** e o pódio | "O feed é só da crew, com reações prontas e sem comentários, para não precisar de moderação de texto." | RF-011, RF-014, RF-015 |
| 9 | 1:00 | **Você:** cartão do jogador, medalhas, **Ajustes** (pausa de saúde, notificações, telemetria desligada) → **Missões** → **Recompensas** (baú do dia com as chances) | "A sequência é semanal e tem pausa de saúde: descansar não é punido. Os lembretes têm limite de 1 por dia e nunca culpam. A telemetria vem desligada e só liga se a pessoa quiser." | RF-016, RF-019, RN-014, RNF-013 |

Frase de transição: "Vou abrir o app como alguém que nunca usou, escolher um time e correr uma volta."

**Se sobrar tempo, com o servidor de verdade (opção C):** no navegador, entre com `moderador.demo`, abra Você → Ajustes → **Moderação** e aprove a corrida de `suspeito.demo` com uma justificativa (RF-018, RN-009); num segundo aparelho, logado como `suspeito.demo` (senha no README), o sino recebe o aviso na hora (RF-019). Na conta real, a corrida usa o GPS de verdade (a simulação só existe na demonstração, D-76): para a corrida sem internet que vira "Resumo provisório" (RF-005), use o vídeo.

---

## 4. Arquitetura e segurança em 1 minuto

> "São três partes: o app em React Native com Expo, o servidor no Supabase com Postgres e PostGIS, e o painel de moderação, que é o próprio app no navegador.
>
> O servidor é o juiz. Cada celular assina os lotes de pontos com HMAC; o servidor confere, roda o antifraude e recalcula a corrida com as mesmas regras do app — o mesmo código TypeScript roda nos dois lados.
>
> A versão 2 entrou sem quebrar a primeira: tudo novo no servidor fica atrás de chaves que começam desligadas, e o app antigo continua funcionando.
>
> Toda tabela tem Row Level Security. As zonas de privacidade são escondidas por uma máscara deslocada e sorteada uma vez, para ninguém achar o centro tirando a média do buraco. O modo demonstração não faz nenhum pedido ao servidor, e um teste garante isso.
>
> Testamos em camadas: 1.411 testes no app, 832 no banco, 87 nas functions, o fluxo inteiro da demonstração no navegador e uma revisão adversarial da lógica, com todos os achados altos e médios corrigidos."

---

## 5. Números para os slides

| Item | Valor |
|---|---|
| Requisitos do ERS | 61: 39 ✅ · 17 🟡 · 3 ⬜ · 2 fora do MVP; nenhum P0 sem fazer (`docs/REQUISITOS.md`) |
| Testes do app (Jest) | 1.411 passando (26 de integração rodam só com o backend); regras do jogo com cobertura mínima de 90% na CI |
| Banco (pgTAP) | 832 testes em 29 arquivos |
| Edge Functions (Deno) | 87 testes (1 ignorado) |
| Fluxo completo da demonstração (Playwright) | 21/21 verificações, 0 pedidos ao servidor |
| Capturas da v2 | 165 (55 telas e estados × 3 larguras), 0 texto com contraste abaixo de AA |
| Texto por tela de jogo | média de 82 → 37 palavras |
| Teste de 5 segundos | 4,3 de 5 (86%; meta 80%) |
| Simulação do território v2 | novato que conquista na 1ª corrida: 13% → 62%; zonas "eternas": 38% → 11% |
| Tamanho do app web | 1.186.919 B gzip (orçamento da CI: 1.250.000) |
| Troca de dono em tempo real | 0,2 a 0,7 s (local; o ERS pede ≤ 3 s) |

---

## 6. Perguntas prováveis da banca

| Pergunta | Resposta curta |
|---|---|
| Por que mudaram a regra do território? | Na regra antiga, quem chegou primeiro ficava com a zona para sempre e o novato quase nunca conquistava. Com a pintura, o novato que conquista na 1ª corrida passa de 13% para 62% na simulação. A troca acontece na virada de temporada. |
| Isso é caixa de recompensa (loot box)? | Não. O baú do dia é grátis, só dá XP e cosméticos, mostra as chances e garante um lendário se ele demorar a sair. Não existe loja nem nada pago. |
| A sequência não vicia ou pune quem descansa? | A sequência é semanal (2 atividades, caminhar vale), tem congelamento automático 1 vez por mês e pausa de saúde de até 4 semanas. Os lembretes têm limite de 1 por dia, nunca no dia em que a pessoa já correu, e nenhum texto de culpa (há teste que proíbe). |
| Como evitam trapaça? | O servidor descarta trechos acima de 40 km/h, saltos e localização simulada, confere passos × velocidade, limita o dano do chefão a 30 km por dia e manda corridas suspeitas para a moderação. Tudo é recalculado no servidor. |
| E a privacidade do card e do feed? | A rota perde o começo, o fim e as zonas de privacidade, com folga sorteada a cada geração. No servidor, as zonas são escondidas por uma máscara deslocada. Não há horário em lugar nenhum. |
| E a telemetria? LGPD? | Opcional e desligada por padrão. Só 5 eventos com o dia, sem localização nem horário, apagados em 30 dias. Desligar apaga tudo na hora. Exportar e excluir a conta incluem tudo da v2. |
| Os dados da demonstração são reais? | Não. É um mundo de exemplo dentro do app, marcado com o selo "Demonstração" em toda tela e no card. Na conta real, Raid, Liga e encontros mostram dado real ou um estado vazio, nunca número inventado. |
| A v2 está no ar? | O app e o servidor da v2 estão prontos e testados. No Supabase Cloud, as partes novas ligam por chave, uma por vez, na ordem do `DEPLOY.md`; o território novo liga na troca de temporada. |
| Por que o Raid é semanal, se o ERS diz 48 h? | Uma semana dá tempo para a cidade inteira participar e cabe na rotina de quem corre 2 ou 3 vezes. A mudança está proposta na revisão do ERS (`ERS-ALTERACOES-PROPOSTAS.md`). |
| Grava com a tela bloqueada? Tem push? | Só em *development build*. O Expo Go não permite GPS em segundo plano nem push remoto no Android; os avisos chegam pela central e como notificação local. |
| Tem integração contínua? | Sim. A cada push, o GitHub roda tipos, lint, testes do app, cobertura das regras, contraste, tamanho do app web, testes das functions e do banco. |
| Os testes rodam no celular? | Os fluxos Maestro estão escritos e os IDs conferidos automaticamente, mas não rodaram em aparelho. No navegador, o fluxo inteiro roda com Playwright. |
| Aguenta 5.000 corredores? Quanto gasta de bateria? | Não medimos. A ingestão foi projetada para isso, mas o teste de carga e a medição de bateria em aparelho ficaram fora do MVP. |

---

## 7. Plano B

| Falha | Sinal | O que fazer |
|---|---|---|
| **Sem internet na sala** | — | O modo demonstração não precisa de rede. Se o mapa-base não carregar, as regiões das zonas continuam aparecendo |
| **Expo não sobe ou o pacote quebra** | Tela branca ou erro do Metro | `npx expo start --web --clear` de novo. Se não voltar em 1 minuto, mostre o vídeo ou as capturas de `docs/melhoria/capturas/depois/` |
| **App abre sem o selo "Demonstração"** | Pede servidor ou mostra "Backend não configurado" | O `EXPO_PUBLIC_DEMO=1` não entrou: reinicie com `--clear`. No app publicado, vá em **Entrar → Ver demonstração** |
| **Tela errada no começo** | Abre já no Mapa, sem cadastro | O cenário veio errado: corrija a URL para `?cenario=primeira-abertura` e recarregue |
| **Servidor fora do ar (opção C)** | "Sem conexão…" com a rede funcionando | Confira `npm run db:start` e `npm run functions:serve`, ou se o projeto da nuvem foi pausado. Se não voltar, siga na demonstração |
| **Login travado na nuvem** | "Muitas tentativas seguidas…" (429) | Suba o limite em **Authentication → Rate Limits**; vale na hora |
| **Qualquer travamento** | — | "Vou mostrar a gravação do mesmo fluxo." Não depure na frente da banca |

---

## 8. Depois da apresentação

- [ ] Nuvem: voltar o limite de login para **3** e conferir com `npx supabase config diff`.
- [ ] Nuvem: trocar de novo as senhas das contas de demonstração, ou apagar o projeto se o seed foi só para a apresentação.
- [ ] Local: `npx supabase db reset`, se for continuar desenvolvendo.
