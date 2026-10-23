# Como apresentar o NOMADE RUN

Guia para a apresentação na faculdade: o que preparar no dia anterior, o roteiro da demonstração em cerca de 10 minutos, o que dizer sobre arquitetura e segurança, as perguntas prováveis da banca e o que fazer quando algo falhar.

Instalação e comandos básicos: [`README.md`](../README.md). Publicação na nuvem: [`supabase/DEPLOY.md`](../supabase/DEPLOY.md).

---

## 1. Escolha onde o backend vai rodar

| Opção | Quando usar | O que muda |
|---|---|---|
| **A. Backend local no notebook** | Rede da sala confiável e notebook com Docker | Celular e notebook na **mesma rede Wi-Fi**; o `.env` do app aponta para o IP do notebook (`http://<ip>:54321`). Se a rede da faculdade isolar os aparelhos entre si, use o roteador do próprio celular (ponto de acesso) para os dois |
| **B. Supabase Cloud** | Não quer depender do notebook nem da rede local | Siga `supabase/DEPLOY.md` com `WITH_SEED=1` (contas e zonas de demonstração). O `.env` aponta para `https://<ref>.supabase.co`. Precisa de conta no Supabase |
| **C. App publicado + Cloud (recomendado, já configurado)** | Apresentar sem notebook, de qualquer rede (Wi-Fi ou 4G) | Backend no projeto `rbdxksunpfbaxkelnsob` do Supabase Cloud e app no EAS Update (branch `demo`, conta `deltafaria785`). Abra pelo QR do botão **Preview** do último update em expo.dev, com o Expo Go logado numa conta do projeto. Para publicar uma versão nova: `npm run publicar -- "mensagem"` (usa sempre o `apps/mobile/.env.production`, nunca o `.env` local) |

A, B e C funcionam com o Expo Go. Escolha uma e ensaie com ela.

**Antes de usar a nuvem (B ou C):**
- **Senhas das contas de demonstração:** as do seed estão no README, e o repositório é público. No projeto da nuvem, troque a senha de `admin.demo` e `moderador.demo` (painel **Authentication → Users**, ou no **SQL Editor**: `update auth.users set encrypted_password = crypt('NOVA_SENHA', gen_salt('bf')) where email in ('admin.demo@nomaderun.app','moderador.demo@nomaderun.app');`). Guarde as novas senhas só com a equipe.
- **Limite de login:** suba para **30** em **Authentication → Rate Limits → Sign-ups and sign-ins** antes do ensaio e da apresentação; volte para 3 depois.
- **Projeto pausado:** o plano gratuito pausa o projeto depois de uma semana sem uso; abra o app uns dias antes (ou clique em **Restore** no painel).

## 2. Checklist do dia anterior

**Backend**
- [ ] **Opção A:** `npm run db:start` e `npm run functions:serve` sobem sem erro; `npm run e2e` termina com `56/56`.
- [ ] **Opção B:** deploy feito (`npm run deploy` com `WITH_SEED=1`) e conferido com o `curl` da seção 4 do `DEPLOY.md`.
- [ ] **Opção B, limite de login (P-09/P-34):** no painel do Supabase, **Authentication → Rate Limits → "Sign-ups and sign-ins" = 30** por 5 min. A banca e você saem pelo mesmo IP da rede; com o valor normal (3) o login trava. Confira com 4 logins seguidos sem erro. **Depois da apresentação, volte para 3** (passo a passo em `DEPLOY.md` §3).
- [ ] Banco no estado inicial: `npx supabase db reset` (opção A) **com antecedência**, e espere ~15 s antes de abrir o app. Logo depois do reset, o tempo real pode demorar alguns segundos para começar a entregar eventos (P-22). Cada ensaio conquista uma zona; resete de novo depois do último ensaio.

**App**
- [ ] `apps/mobile/.env` com a URL certa (IP do notebook ou URL da nuvem) e `npx expo start --clear`.
- [ ] Celular 1 (o seu): Expo Go aberto, app carregando o mapa com as zonas de Goiânia.
- [ ] Celular 2 ou navegador do notebook: conectado com `corredor.demo@nomaderun.app` / `Corrida@2026`, para mostrar a troca de dono em tempo real.
- [ ] Navegador do notebook: `npx expo start --web` (ou tecla `w`), aba pronta com `moderador.demo@nomaderun.app` / `Moderacao@2026` para o painel de moderação.
- [ ] Permissões de localização e notificações já concedidas no Expo Go (o pedido do sistema na frente da banca gasta tempo).
- [ ] Faça uma corrida de ensaio em **Simulação** do começo ao fim e confira "Zona conquistada" no resumo.

**Aparelhos e sala**
- [ ] Celular e notebook na mesma rede; teste o espelhamento da tela do celular no projetor.
- [ ] Bateria acima de 80% nos dois, carregadores na mochila; brilho no máximo, modo "Não perturbe" ligado.
- [ ] Vídeo de reserva (2 min) do roteiro abaixo gravado no notebook, sem depender de internet.
- [ ] Slide "O que entregamos e o que falta" (`docs/apresentacao/slides/slides/entregas.html`) atualizado: ele ainda diz "60 testes" e "sem servidor". Use os números da seção 5 deste guia.
- [ ] **Plano B do GPS:** use sempre a **Simulação** na demonstração. GPS real em sala fechada costuma ter sinal fraco, e ninguém vai correr no auditório.

---

## 3. Roteiro da demonstração (~10 min)

Faça a demo com uma **conta nova** no celular 1, para mostrar o cadastro. Entre parênteses, os requisitos do ERS que cada passo demonstra.

| # | Tempo | O que fazer | O que dizer | Requisitos |
|---|---|---|---|---|
| 1 | 1:00 | **Cadastro:** Criar conta, preencher nome de usuário, e-mail, senha, nascimento (mostre que menos de 16 anos é recusado) e aceitar **termos** e **privacidade** em separado | "Cada consentimento é separado, como pede a LGPD. A idade mínima é conferida no app e no banco." | RF-001, RNF-013 |
| 2 | 0:40 | **Time:** escolher o time, depois as telas que explicam localização e notificações **antes** do pedido do sistema | "O app explica para que usa a localização antes de pedir." | RF-003, RNF-013 |
| 3 | 0:50 | **Mapa:** mostrar as zonas de Goiânia, os chips "Todos os times" e "Só meu time", e o alerta "Parque Flamboyant sob ataque". Tocar no alerta e abrir a folha da zona (dono, influência, maiores corredores, eventos) | "As zonas vêm do servidor. O mapa mostra regiões de bairro; a grade de hexágonos fica só nas regras." | RF-007, RF-009, RF-010 |
| 4 | 2:00 | **Correr:** Correr → Simulação → Começar (2 toques). Mostrar o 3-2-1, o percurso, o **SOS** sempre visível, o chip da Escolta, o guia por voz e a faixa "Território dos …" ao entrar em zona rival. Quando aparecer "Conquista garantida ao terminar" (cerca de 1 min), segurar "Segure para encerrar" por 600 ms | "A simulação percorre o Parque Flamboyant em 10× e desvia até a zona neutra mais próxima. O encerramento pede 600 ms pressionado para não terminar com o celular no bolso." | RF-004, RF-021, RF-024, RF-025, RNF-010, RNF-015 |
| 5 | 0:40 | **Resumo oficial:** "Zona conquistada, mais N RP em <zona>", métricas e lista de zonas afetadas | "Este número veio do servidor, não do celular. O servidor recebeu os pontos assinados, rodou o antifraude e recalculou tudo." | RF-006, RF-008, RNF-006 |
| 6 | 1:20 | **Sem internet:** ligar o modo avião, iniciar outra corrida em Simulação, encerrar após uns 20 s. O resumo aparece como **"Resumo provisório"**. Desligar o modo avião: o resumo é confirmado sozinho (ou toque "Tentar enviar agora") | "A corrida fica gravada no aparelho. Nenhum ponto se perde; quando a conexão volta, o envio é repetido sem duplicar." | RF-005, RNF-005 |
| 7 | 0:40 | **Tempo real:** no celular 2 (ou navegador) com `corredor.demo`, o mapa da região já aberto mostra a zona do passo 5 com a cor do novo time, sem recarregar | "Nos testes locais, a troca de dono chega aos outros em menos de 1 segundo; o ERS pede até 3." | RNF-003, RF-007 |
| 8 | 0:40 | **Notificações:** abrir o sino do mapa (central de notificações) e mostrar "Zona conquistada"; tocar e abrir a zona. No celular 2, tocar no alerta do parque sob ataque | "Quem é do time dono e correu na zona nos últimos 30 dias recebe o Alerta de Invasão, com limite de 1 por zona a cada 6 h e 5 por dia." | RF-009, RF-019, RN-003 |
| 9 | 0:40 | **Clube:** rankings com os chips Temporada/Semana e Todos/cidade/Meu time/distrito; crew (criar ou mostrar) | "Os rankings são calculados no banco por semana ou temporada." | RF-011, RF-015, RF-020 |
| 10 | 1:00 | **Painel de moderação (navegador):** com `moderador.demo`, Perfil → Painel de moderação → corrida de `suspeito_demo` → percurso, gráficos de velocidade e passos, alerta de veículo → **Aprovar** com uma justificativa de pelo menos 10 caracteres | "Só moderador e administrador entram aqui; o banco confere o papel, não só a tela. A justificativa é obrigatória e o corredor é notificado." | RF-018, RN-009 |
| 11 | 0:30 | **LGPD:** no celular 1, Perfil → Conta e privacidade → **Exportar meus dados** (gera um JSON). Mostrar que **Excluir conta** pede a senha atual (não precisa excluir) | "A pessoa leva os próprios dados e pode apagar a conta pelo app." | RF-002, RNF-013 |

Total: cerca de 10 min. Se o tempo for curto, corte os passos 9 e 11.

Frase de transição para a demo: "Agora vou criar uma conta e correr uma volta no Parque Flamboyant em um minuto."

---

## 4. Arquitetura e segurança em 1 minuto

> "São três partes: o app em React Native com Expo, o servidor no Supabase com Postgres e PostGIS, e o painel de moderação, que é o próprio app rodando no navegador.
>
> O servidor é o juiz. Cada celular tem uma chave própria e assina os lotes de pontos com HMAC-SHA256; o servidor recusa lote com assinatura errada, fora de ordem ou repetido com outro conteúdo. Depois ele recalcula a corrida inteira com as mesmas regras do app — o mesmo código TypeScript roda nos dois lados — e só então decide quem conquista cada zona.
>
> No banco, toda tabela tem Row Level Security: cada pessoa só lê os próprios dados privados, e só o servidor escreve em zonas e corridas. Conta inativada perde o acesso na hora. Os links de recuperação de senha usam PKCE.
>
> Testamos isso em camadas: 360 testes no app com 100% de cobertura das regras, 285 testes no banco, 58 nas functions, 56 verificações de ponta a ponta, 89 ataques simulados contra a API e o fluxo completo da demonstração no navegador com Playwright."

---

## 5. Números para os slides

| Item | Valor |
|---|---|
| Requisitos do ERS | 27 RF, 15 RNF, 19 RN (situação de cada um em `docs/REQUISITOS.md`) |
| Testes do app (Jest) | 360 passando; regras do jogo com 100% de linhas e 99,6% de ramos cobertos |
| Banco (pgTAP) | 285 testes em 13 arquivos |
| Edge Functions (Deno) | 58 testes |
| Ponta a ponta do backend | 56 verificações |
| Segurança adversarial | 89 verificações, 0 achados abertos |
| Navegador (Playwright) | fluxo da demo (14 passos), autenticação (17) e comparação de imagem (4 telas) |
| Troca de dono em tempo real | 0,2 a 0,7 s (local; ERS pede ≤ 3 s) |
| `/zones` com 2.000 zonas | p95 de 35 ms (local; ERS pede < 150 ms) |

---

## 6. Perguntas prováveis da banca

| Pergunta | Resposta curta |
|---|---|
| Como evitam trapaça (carro, bicicleta, GPS falso)? | O servidor descarta trechos acima de 40 km/h, saltos de posição e localização simulada; confere passos × velocidade; tem teto de 300 RP por zona por dia e um índice de confiança que manda corridas suspeitas para a moderação. Toda a pontuação é recalculada no servidor (RN-007 a RN-009, RNF-006). |
| E se alguém escrever um app falso que assina os pontos? | É um limite conhecido: a chave é registrada pelo próprio aparelho, então a assinatura prova que o lote não foi alterado, mas não que veio do app oficial. O próximo passo é Play Integrity (Android) e App Attest (iOS). O antifraude no servidor continua valendo. |
| Quem corre muito não domina tudo? | Os pontos são pelo esforço relativo ao próprio ritmo (mediana das últimas 10 corridas), com teto diário por zona, perda diária de influência sem corridas e reset mensal de temporada. |
| Funciona sem internet? | Sim. Os pontos ficam numa fila no aparelho e são enviados quando a conexão volta; o reenvio não duplica nada. O resumo aparece como provisório até o servidor confirmar. |
| E a privacidade? | Cada usuário só acessa os próprios dados (RLS no banco). Há até 3 zonas de privacidade que escondem os pontos perto de casa para outras pessoas. Exportar e excluir os dados ficam no app. |
| Por que hexágonos nas regras se o mapa não mostra hexágonos? | A grade H3 deixa a regra justa e testável. Para a pessoa, o mapa mostra regiões suavizadas, que parecem bairros. |
| Por que não Mapbox, como diz o ERS? | `react-native-maps` roda no Expo Go sem token e o visual aprovado já usava ele; na web usamos MapLibre. O ERS previa alternativa (§2.5). A mudança está proposta em `docs/ERS-ALTERACOES-PROPOSTAS.md`. |
| Grava com a tela bloqueada? | Só em *development build*, com a flag `NOMADE_BACKGROUND_LOCATION=1`. O Expo Go não permite GPS em segundo plano. O código está pronto e ainda precisa ser validado em aparelho. |
| Tem notificação push? | A central de notificações e o tempo real funcionam no Expo Go. Push remoto exige *development build* (o Expo Go no Android não recebe push desde o SDK 53). |
| A Escolta mostra a posição ao vivo? | Não. No MVP ela compartilha a localização atual uma vez, ao ligar. O SOS abre o SMS com a localização para os contatos. Rastreamento contínuo precisa de mais backend (P-18). |
| Aguenta 5.000 corredores ao mesmo tempo (RNF-001)? Quanto gasta de bateria (RNF-004)? | Não medimos. A ingestão foi projetada para isso (só grava; o cálculo é no fim) e os índices geográficos estão medidos localmente, mas o teste de carga com k6 e a medição de bateria em aparelho ficaram fora do MVP. |
| Os testes rodam no celular? | Os fluxos Maestro (cadastro, login, UC-01, UC-02, UC-03) estão escritos e os IDs conferidos automaticamente, mas não rodaram em aparelho. No navegador, o fluxo inteiro roda com Playwright. |
| Tem integração contínua (CI)? | Não. Todas as suítes rodam à mão com os comandos do README. É um próximo passo. |

---

## 7. Plano B

| Falha | Sinal | O que fazer |
|---|---|---|
| **Sem internet na sala** | Mapa vazio ou "Sem internet: mostrando o último mapa salvo" | Opção A: crie uma rede com o celular (ponto de acesso), conecte o notebook nela e use o IP novo no `.env` (`npx expo start --clear`). Sem rede nenhuma: mostre o vídeo de reserva. |
| **Backend fora do ar** | "Sem conexão com a internet…" ao entrar, mesmo com a rede funcionando | Opção A: confira os dois terminais (`npm run db:start`, `npm run functions:serve`) e rode `npx supabase status`. Opção B: veja se o projeto não foi pausado no painel do Supabase. Se não voltar em 1 minuto, vá para o vídeo. |
| **GPS ruim** | Aviso de sinal fraco | Use a Simulação (já é o roteiro padrão). |
| **Login travado** | "Muitas tentativas seguidas…" (erro 429) | Opção B: suba o limite em Authentication → Rate Limits; vale na hora. Opção A não tem limite. |
| **Zona não troca de cor no celular 2** | Mapa do celular 2 parado | Arraste o mapa um pouco (recarrega a área) e siga. Se o banco acabou de ser resetado, espere ~15 s (P-22). |
| **Resumo fica provisório com internet** | "Resumo provisório" depois de religar a rede | Toque "Tentar enviar agora". Se continuar, siga para o próximo passo e volte no fim. |
| **Simulação não mostra "Conquista garantida"** | Todas as zonas perto já foram conquistadas nos ensaios | Rode `npx supabase db reset` antes da apresentação. Na hora, a corrida ainda pontua; mostre o resumo com os pontos. |
| **Qualquer travamento** | — | "Vou mostrar a gravação do mesmo fluxo." Não depure na frente da banca. |

---

## 8. Depois da apresentação

- [ ] Opção B: voltar o limite de login para **3** e conferir com `npx supabase config diff` (P-09).
- [ ] Opção B: trocar as senhas das contas de demonstração ou apagar o projeto, se o seed foi para a nuvem.
- [ ] `npx supabase db reset` no banco local, se for continuar desenvolvendo.
