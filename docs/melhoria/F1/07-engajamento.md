# F1 · 07 — Engajamento e retenção (Equipe E7)

> Fase F1 (descoberta e design). Nenhum código de produção foi alterado.
> **Anexos** em `docs/melhoria/F1/engajamento/`:
> - `simulacao-progressao.ts` → `saida-simulacao.md`: XP, nível, temporada, baú do dia e faixa de corredor em 3 perfis, por 5 anos, com sementes fixas;
> - `catalogo.ts` → `catalogo-tabelas.md`: missões e notificações, com conferência automática dos limites de caracteres e de palavras de culpa.
>
> **Comandos** (na raiz):
> - `npx -y tsx docs/melhoria/F1/engajamento/simulacao-progressao.ts` (cerca de 75 s);
> - `npx -y tsx docs/melhoria/F1/engajamento/catalogo.ts --tabelas`.

## 0. Resumo em 1 minuto

O dono pediu "táticas de dopamina", "o que prende nas telas" e "como fazer a pessoa voltar". A resposta da E7 é a mesma em todos os casos:
- **antecipação honesta:** barra quase cheia, baú guardado, chefão com vida baixa;
- **surpresa só cosmética:** raridade do baú com chances visíveis;
- **metas finitas:** 3 missões por dia e 3 por semana, que acabam;
- **um motivo verdadeiro para voltar,** nunca culpa.

**Os 4 loops:**

| Loop | Em 1 linha |
|---|---|
| **Diário** | Abrir o mapa mostra o baú do dia guardado (até 3) e 3 missões curtas (1 leve) → 1 atividade abre os baús e risca missões → resumo com XP detalhado. |
| **Semanal** | 2 atividades garantem a semana (congelamento mensal + pausa de saúde) → 3 missões semanais adaptadas ao seu volume → liga fecha domingo → recap na segunda. |
| **Temporada (mês)** | Trilha grátis de 24 degraus (bronze 8, prata 16, ouro 24) com cosméticos → medalha da temporada → reset parcial do mapa (×0,3) → troca de time liberada. |
| **Primeira semana (FTUE)** | 7 passos, um liberado por dia, sem prazo: Domínio → Caça → Fuga → Raid → Crew → Liga → Compartilhar. Termina com a moldura "Primeira Semana". |

**Achados que mudam o plano** (detalhes na §1):
1. **A curva de XP atual não fecha.**
   - O nível 50 exige 689.513 XP, e nenhum perfil chega lá em 5 anos.
   - O iniciante leva 139 corridas (70 semanas) até o nível 10.
2. **O XP premia volume.** O avançado ganha 11,1× o XP semanal do iniciante.
3. **Bônus de território por antiguidade.** As semanas de sequência entram como "dias" no multiplicador de pontos de território: 10 semanas valem +50% de RP. Pedido para a E3.
4. **Missões não existem.** A preferência `missions` e o tipo de notificação `mission` existem, mas nada os produz.
5. **Não há push remoto no Expo Go,** e as notificações só aparecem com o app aberto. Para "trazer de volta" sem servidor de push, a proposta usa **notificações locais agendadas**, replanejadas a cada abertura e a cada sincronização.

---

## 1. Auditoria do que existe

**Legenda:** S = funciona no servidor · T = só na tela (calculado no app) · D = só demonstração (rotulada).

| Item | Onde | Estado | Observação |
|---|---|---|---|
| **XP da corrida** | `apps/mobile/src/domain/run-engine.ts:172-174`; servidor `supabase/functions/_shared/scoring.ts` (`computeOfficialResult` → `finishRun`); somado em `profiles.xp` (`20261021120300_zone_names_chests_group.sql:259`) | S | Fórmula: `floor(m/100)·1 + 10·células novas de neblina + 50 se vencer o fantasma`, mais os baús da Caça. Não há detalhamento ("de onde veio cada XP") |
| **Nível** | `domain/games.ts:91-105` (`xpForLevel = 100·n^1,5`, máx. 50) | T | Aparece só no Perfil (`features/screens/profile-screen.tsx:31-63`). O resumo mostra "+XP" (`summary-screen.tsx:159`), sem barra, sem "subiu de nível" e sem títulos |
| **Sequência semanal** | `domain/games.ts:77-88` (`closeWeek`); job `job_close_week` (`20261020120300_views_and_jobs.sql:185-206`, segunda 00:10 BRT); congelamento volta a 1 no `job_season_rollover` (`:225`) | S | Visível em Atividades (`activities-screen.tsx:76-95`), com barra de 2 e o texto "Descanse sem culpa" (bom). Faltam: celebração, recompensa, "melhor sequência", pausa de saúde |
| **Texto do congelamento** | `activities-screen.tsx:94` | T | Escrito fixo no singular: aparece "0 congelamento disponível" |
| **Sequência no RP** | `features/run/run-controller.ts:98` (`streakDays: Math.min(10, g.streakWeeks)`); servidor `_shared/scoring.ts` (`streakDays: input.streakWeeks`); `domain/scoring.ts:12-13,28` | S | As semanas viram "dias" do multiplicador diário: 10 semanas = ×1,5 no território. É uma vantagem de antiguidade no mapa. **Pedido E3** |
| **Baús da Caça** | `supabase/migrations/20261021120100_chests.sql` (5–8 por dia num raio de 3 km do último ponto da última corrida; 70/25/5%; 20/60/150 XP); abertura no finish-activity | S | As chances não aparecem na tela (fere a transparência da §5.4). Não existe "baú do dia" único. O centro do sorteio costuma ser perto de casa: a RLS protege (só o dono vê), mas o card de compartilhar não pode mostrar baús |
| **Missões diárias e semanais** | — | ausentes | RF-016 🟡. `activities.mission` hoje é o **modo** (livre/fuga/caca), o que gera conflito de nome com "missões" (§12, decisão C3) |
| **Conquistas** | `profile-screen.tsx:21-25` (3 regras) | T | Calculadas a partir do histórico carregado (até 200 atividades, `activities-repo.ts:67`). Não ficam gravadas nem têm medalha |
| **Liga** | `domain/games.ts:63-75`; `demo/demo-data.ts:183-191` | D | Rotulada "Ranking de demonstração" (`arena-screen.tsx:160`). Usa o XP total como pontos |
| **Raid** | `arena-screen.tsx` (`DEMO_RAID`) | D | Rotulado "Raid de demonstração" (`:80`). A missão "dano no chefão" depende do raid real (E9) |
| **Temporada** | `domain/season.ts`; `job_season_rollover` (`views_and_jobs.sql:210-226`) | S | Virada mensal, influência ×0,3, troca de time (RF-003). Não há XP de temporada, trilha nem medalha |
| **Notificações do servidor** | `rpcs.sql:324-350` (`notify_zone_runners`: invasão 1 por zona a cada 6 h e no máximo 5 por dia; território perdido); conquista e moderação (`zone_names…sql:233,299`) | S | Ninguém produz o tipo `mission`. Não há janela de silêncio no servidor |
| **Entrega no app** | `features/notifications/controller.ts` (Realtime + consulta a cada 20 s só em primeiro plano); `local-alert.ts:39-42` (notificação local imediata) | T | Só com o app aberto. Push remoto só em development build (D-13). Nenhuma notificação de engajamento |
| **Preferências** | `services/api/types.ts:7-14` (`invasions`, `conquests`, `missions`, `moderation`); UI em `edit-profile-screen.tsx:23-25` | S | Faltam chaves por tipo de engajamento (§8.3) |
| **Telemetria** | — | ausente | D1/D7/D30 **de corrida** já dá para tirar de `activities`. Não há registro de "abriu o app" |

**Como a curva atual se comporta** (simulação, `saida-simulacao.md`):

| Nível | Iniciante (3 km, 2×/sem.) | Regular (5 km, 4×/sem.) | Avançado (15 km, 6×/sem.) |
|---|---|---|---|
| 5 | 9 corridas (sem. 5) | 5 corridas (sem. 2) | 2 corridas (sem. 1) |
| 10 | 139 corridas (sem. 70) | 59 corridas (sem. 15) | 13 corridas (sem. 3) |
| 20 | não chega em 5 anos | 781 corridas (sem. 196) | 163 corridas (sem. 28) |
| 50 | não chega | não chega | não chega |

- **XP por semana** (semanas 2 a 52): iniciante 166, regular 442, avançado 1.849. O avançado ganha **11,1×** o iniciante.
- **De onde vem o XP do avançado:** distância 71% e neblina 21%. A neblina rende muito na 1ª semana (462 células, cerca de 4.600 XP) e quase nada depois.

---

## 2. Filtro ético (§5.4) aplicado ao pedido do dono

| Tática pedida ("dopamina", "prender", "voltar") | Versão saudável adotada | Descartado (motivo) |
|---|---|---|
| Recompensa variável | Raridade do baú do dia e da Caça (comum 70%, raro 25%, lendário 5%), com **chances na tela** e garantia de lendário a cada 20 baús. O conteúdo é só XP e cosmético | Loot box paga, moeda premium, "pague para abrir agora" (proibidos) |
| Sequência (aversão à perda) | Sequência **semanal** de 2 atividades (caminhar vale), 1 congelamento por mês, **pausa de saúde** de 1 a 4 semanas por temporada e "melhor sequência" guardada para sempre | Sequência diária; "reparar sequência" pago; contagem regressiva para perder |
| Notificação que puxa de volta | No máximo 1 por dia de engajamento, 4 por semana, só das 8h às 21h (dentro da regra de 7h–22h), com motivo verdadeiro e desligável por tipo. A escada de volta termina em silêncio | "Você abandonou…", "seu time está decepcionado", alerta falso, notificação de madrugada |
| Escassez e FOMO | Só a escassez real do jogo (chefão termina em 48 h, liga fecha domingo). As missões somem sem multa | Oferta relâmpago, recompensa "só hoje" que obriga a correr todo dia |
| Barra quase cheia (gradiente de meta, Zeigarnik) | "Faltam 400 m", missão a 70% e progresso dotado: a missão de boas-vindas começa em 20% | — |
| Infinito ("só mais uma") | Metas finitas: 3 diárias e 3 semanais. A trilha da temporada termina no degrau 24; depois só há estrelas de prestígio, sem cosmético exclusivo | Rolagem infinita de recompensas; missões que renovam ao concluir |
| Comparação social | Liga entre pares de nível parecido (E3) e recap "você × você" | Ranking que humilha; "fulano correu mais que você" |
| Prender nas telas | **Não é objetivo.** O app mede corridas por semana, não tempo de tela. Recompensas só por atividade real (com uma exceção: abrir o app não dá XP) | XP por abrir o app, por tempo de tela ou por "olhar o mapa" (incentiva o gesto vazio: *metric gaming*) |
| Correr mais | Teto saudável de XP: 10 XP/km até 5 km/dia, 5 XP/km de 5 a 15 km e 0 depois. Missões adaptadas ao seu volume, com crescimento de no máximo +10% por semana. Aviso "Descanso também treina" | Missão "corra todo dia"; meta que cresce sem teto; bônus por correr machucado ou de madrugada |
| Aposta da sequência (E1, Duolingo) | Fica para a P2, opcional: aposta 1 congelamento e ganha 2. Não entra na F3 | — |

---

## 3. Os loops (modelo Hook: gatilho → ação → recompensa → investimento)

### 3.1 Loop da corrida (base de todos)

| Etapa | Conteúdo |
|---|---|
| **Gatilho** | Botão gigante "Correr" no Mapa; chip "Baú do dia ×2" e chip "Missões 1/3" no topo do Mapa |
| **Ação** | Correr ou caminhar. A pintura ao vivo é da E3/E5 |
| **Recompensa** | **Resumo** na ordem do pico-fim: zonas → baús da Caça → **baús do dia** abrindo → missões riscadas → XP detalhado → barra de nível → degrau da temporada. O momento épico fica por último |
| **Investimento** | Zonas do time, sequência, degraus da temporada, cosméticos equipados |
| **Tela** | Mapa, Corrida e Resumo (E6/E5); bloco "Recompensas" em `features/engagement` |
| **Dados** | Resposta do finish-activity com o novo bloco `engagement` (§10) |
| **Risco** | Recompensa demais de uma vez anula a antecipação |
| **Mitigação** | Teto de 3 baús do dia; celebração proporcional (§5.3 do prompt); o nível novo é a única tela cheia |

### 3.2 Loop diário

| Etapa | Conteúdo |
|---|---|
| **Gatilho** | Ao abrir, o Mapa mostra "o que mudou" (E6), os baús guardados (1 a 3) e as missões do dia. Notificação só se houver motivo (§8) |
| **Ação** | 1 atividade de qualquer tipo. Caminhada conta: a validação não tem velocidade mínima (`anti-cheat.ts`) |
| **Recompensa** | Todos os baús guardados abrem; missões concluídas dão de 20 a 40 XP cada; "+30 corrida concluída" (1 vez por dia) |
| **Investimento** | Escolher e trocar 1 missão por dia (autonomia) |
| **Tela** | Mapa (chips), `/missoes` e Resumo |
| **Dados** | `mission_assignments` do dia e baús guardados (calculados no servidor, §10) |
| **Risco** | Virar obrigação diária |
| **Mitigação** | **O baú guarda até 3:** quem corre 2×/semana abre 6 baús por semana, e quem corre 6× abre 7 (simulação). Missão perdida não vira dívida. Nenhuma notificação diz "hoje" |

### 3.3 Loop semanal

| Etapa | Conteúdo |
|---|---|
| **Gatilho** | Barra "1 de 2" em Atividades e no Mapa; sábado, "Falta 1 atividade…" (se for verdade); domingo, liga a ≤ 2 posições da linha (liga real); segunda, recap |
| **Ação** | A 2ª atividade da semana; avançar nas 3 missões semanais (1 leve) |
| **Recompensa** | "Semana garantida +50 XP" com a chama acendendo (E5 `StreakFlame`); missões semanais de 100 a 200 XP; resultado da liga; card do recap (E8) |
| **Investimento** | Contador de semanas e "melhor sequência"; crew e time |
| **Tela** | Atividades (sequência), `/missoes` (aba Semana), Arena (liga), recap (E8) |
| **Dados** | `profiles.streak_weeks`, `best_streak_weeks`, `pause_until`, liga da E9 |
| **Risco** | Medo de perder a sequência |
| **Mitigação** | Congelamento automático e avisado ("Semana protegida pelo congelamento"); **pausa de saúde** (lesão, viagem, descanso) de 1 a 4 semanas, 1 vez por temporada; a melhor sequência nunca some; quando a sequência quebra, o texto é "Nova sequência começa na próxima atividade", sem número em vermelho |

### 3.4 Loop da temporada (mês)

| Etapa | Conteúdo |
|---|---|
| **Gatilho** | Dia 1, 9h, "Temporada de novembro começou…"; barra da trilha no Perfil e na Arena |
| **Ação** | Todo XP do mês conta para a trilha; não há missão exclusiva paga |
| **Recompensa** | 24 degraus de 120 XP com cosméticos (§6); medalha bronze, prata ou ouro gravada para sempre; depois do degrau 24, estrelas de prestígio |
| **Investimento** | Cosméticos equipados (rastro, moldura, efeito) e estante de medalhas |
| **Tela** | `/recompensas` (trilha) e Perfil (estante) |
| **Dados** | `season_progress` e `cosmetic_unlocks` |
| **Risco** | O ouro ficar só para quem corre muito |
| **Mitigação** | O ouro é alcançado em **48% dos meses pelo iniciante** (2×/semana); o regular fecha no dia 17 e o avançado no dia 10. Não há cosmético exclusivo para quem corre mais que isso |

### 3.5 Primeira semana (FTUE de 7 passos)

| Etapa | Conteúdo |
|---|---|
| **Gatilho** | Missão de boas-vindas logo depois da escolha do time (E6). Às 9h do dia seguinte, notificação local "Passo 2 de 7 liberado" |
| **Ação** | Um modo por passo (§5.3). Os passos 5 a 7 não exigem correr |
| **Recompensa** | 400 XP no total (nível 2 já na 1ª corrida e nível 5 por volta da 3ª corrida, em todos os perfis); baú do dia raro garantido no passo 1; moldura "Primeira Semana" no passo 7 |
| **Investimento** | Time escolhido, crew, primeiro card compartilhado |
| **Tela** | Cartão "Primeira semana" no topo de `/missoes` e no Mapa, enquanto houver passo aberto |
| **Dados** | `mission_assignments` com período `ftue`; `profiles.ftue_started_at` |
| **Risco** | Exigir 4 corridas na 1ª semana do iniciante |
| **Mitigação** | Um passo libera por dia, mas **nunca expira**: quem corre 2×/semana termina em cerca de 2 semanas. O texto da tela é "Primeiros passos", não "7 dias" |

### 3.6 Volta depois de sumir (alinhada com a escada da E1, §12.3)

| Dias sem atividade | O que acontece | Notificação (≤ 60) |
|---|---|---|
| 7 | Missão de volta `v-7` ("Volta leve: 10 minutos já contam") + baú raro garantido | "Sua missão de volta está pronta: 10 minutos já contam." |
| 14 | Missão `v-14` + baú raro garantido. Se uma zona onde a pessoa correu estiver **mesmo** sob ataque, só com push remoto: variante da zona | "Baú raro garantido na sua próxima atividade. Sem pressa." / "{zona} está sob ataque. Bora defender?" |
| 21 | Oferece a pausa de saúde | "Precisa de uma pausa? Sua sequência fica guardada." |
| 30 | Missão `v-30` + baú lendário garantido. **Último aviso, depois silêncio** até a pessoa voltar (alertas de segurança continuam) | "Quando quiser voltar, tem um baú lendário te esperando." |

- **Tela "Que bom te ver!" (E6):**
  - mostra o mascote acenando, 3 cartões "o que mudou" e a missão fácil com a barra em 20%;
  - **não mostra** a sequência perdida nem perdas em vermelho.
- **Recompensa de volta garantida, não sorteada:** o megaestudo citado pela E1 (+27%) premiava a volta. Aqui o prêmio é fixo, para não virar caça-níquel.

---

## 4. Progressão

### 4.1 Fontes de XP (rascunho de `src/domain/progression.ts`)

| Fonte | Regra | Hoje |
|---|---|---|
| Distância | 10 XP/km nos primeiros 5 km do dia, 5 XP/km de 5 a 15 km e **0 depois de 15 km/dia** | 10 XP/km sem teto |
| Atividade concluída | +30 XP com ≥ 1 km válido ou ≥ 15 min de movimento, **1 vez por dia** (dividir a corrida não rende) | — |
| Neblina | 2 XP por célula nova, no máximo 60 por corrida | 10 XP por célula, sem teto |
| Fantasma vencido | +50 XP (mantém) | +50 |
| Baús da Caça | 20 / 60 / 150 XP (mantém) | igual |
| Baú do dia | 15 / 40 / 100 XP + chance de cosmético | — |
| Missão diária | leve 20, padrão 30, desafio 40 | — |
| Missão semanal | leve 100, padrão 150, desafio 200 | — |
| Semana garantida | +50 XP na 2ª atividade da semana | — |
| Primeira semana | 100 + 40 + 40 + 40 + 60 + 60 + 60 = 400 XP | — |
| Volta | 50 / 60 / 80 XP + baú garantido | — |

**Exemplo:** corrida de 3 km do iniciante numa quinta, com 3 baús guardados e 2 missões feitas:
- distância 30 + concluída 30 + neblina cerca de 10 + baús do dia cerca de 76 (3 × 25,5 em média) + missões 50 = **cerca de 196 XP**;
- cada linha aparece no resumo e no histórico `xp_history` (transparência).

### 4.2 Curva proposta: `xpForLevel(n) = arred10(50·n^1,3) + 50`

- **Nunca rebaixa ninguém:** para todo n, a curva nova pede ≤ XP que a atual (nível 2 = 100 nas duas). Ao migrar, ninguém perde nível; quem já tem XP só sobe.
- **Mantém** `MAX_LEVEL = 50`.

**Corridas (e semana) até cada nível** (simulação, curva e fontes propostas):

| Nível (XP total) | Iniciante 3 km 2×/sem. | Regular 5 km 4×/sem. | Avançado 15 km 6×/sem. |
|---|---|---|---|
| 2 (100) | 1 corrida (sem. 1) | 1 corrida (sem. 1) | 1 corrida (sem. 1) |
| 5 (880) | 3 corridas (sem. 2) | 4 corridas (sem. 1) | 3 corridas (sem. 1) |
| 10 (4.300) | 13 corridas (sem. 7) | 12 corridas (sem. 3) | 12 corridas (sem. 2) |
| 20 (21.100) | 61 corridas (sem. 31) | 61 corridas (sem. 16) | 55 corridas (sem. 10) |
| 30 (53.660) | 160 corridas (sem. 80) | 164 corridas (sem. 41) | 144 corridas (sem. 24) |
| 40 (104.130) | 313 corridas (sem. 157) | 320 corridas (sem. 80) | 288 corridas (sem. 48) |
| 50 (174.160) | não chega em 5 anos (nível 40 em 3 anos) | 544 corridas (sem. 136, cerca de 2,6 anos) | 492 corridas (sem. 82, cerca de 1,6 ano) |

- **XP por semana** (semanas 2 a 52): iniciante 665, regular 1.295, avançado 2.148. O avançado fica em **3,2×** o iniciante (hoje 11,1×).
- **De onde vem o XP:**
  - no iniciante, 43% vem de missões;
  - no avançado, 28% vem da distância.
- **O mesmo nível pede quase o mesmo número de corridas nos 3 perfis:** o nível mede constância, não volume.

### 4.3 Títulos por faixa de nível

| Níveis | Título | Desbloqueia |
|---|---|---|
| 1–4 | Recruta do Asfalto | — |
| 5–9 | Pé na Rua | Rastro "Faísca" |
| 10–14 | Desbravador de Bairro | Moldura "Bairro" |
| 15–19 | Guardião de Esquina | Efeito "Pulso" |
| 20–29 | Estrategista Urbano | Rastro "Cometa" |
| 30–39 | Lenda do Bairro | Moldura "Holofote" |
| 40–49 | Mestre da Cidade | Efeito "Onda" |
| 50 | Nômade | Moldura animada "Nômade" + título fixo |

- Os nomes não repetem as divisões da liga (Calçada, Rua, Avenida, Rodovia, Maratona).
- O título "Guardião da zona" (E1) é um selo por zona (E3), por isso aqui fica "Guardião de Esquina".
- A pessoa pode exibir qualquer título já conquistado (autonomia).

### 4.4 Faixa de corredor (distância total; por material e brilho, para não usar matiz)

- **Por que material e brilho:** os times já são donos das cores (E1, §5). Por isso a faixa é uma borda de material na moldura do avatar.
- **Nunca regride:** a distância total só sobe.

| Faixa | km total | Iniciante | Regular | Avançado |
|---|---|---|---|---|
| Asfalto | 0 | início | início | início |
| Bronze | 10 | 2 sem. | 1 sem. | 1 sem. |
| Prata | 50 | 9 sem. | 3 sem. | 1 sem. |
| Ouro | 150 | 25 sem. | 8 sem. | 2 sem. |
| Neon | 400 | 67 sem. | 20 sem. | 5 sem. |
| Holográfico | 1.000 | 167 sem. | 50 sem. | 12 sem. |
| Lenda | 2.500 | 417 sem. | 125 sem. | 28 sem. |
| Nômade | 5.000 | — | 250 sem. | 56 sem. |

### 4.5 Cosméticos desbloqueáveis (sem venda, sem efeito no jogo)

| Tipo | Quantidade inicial | Como ganha |
|---|---|---|
| Cor do rastro | 10 | Títulos, degraus 4/12/20 da trilha, baú do dia (raro: 5% de chance de cosmético; lendário: 30%) |
| Moldura do avatar | 12 | Faixa de corredor (8), primeira semana (1), títulos (3) |
| Efeito de conquista | 6 | Títulos, degraus 8/16/24 |
| Emblema da temporada | 1 por mês | Medalha bronze, prata ou ouro |

- **Cosmético repetido no baú** vira +20 XP. Não existe "fragmento" que precise juntar.
- **Arte:** E4. **Animação do efeito:** E5.

---

## 5. Missões

### 5.1 Regras

- **Sorteio por dia e por semana:**
  - 1 leve + 1 padrão + 1 desafio, a partir do catálogo;
  - semente = `hash(userId, período)`, por isso o resultado é reproduzível e testável;
  - missões impossíveis ficam de fora: "Defenda" só se o time tem zona sob ataque a ≤ 3 km; "Crew" só para quem tem crew; "Chefão" só com raid real.
- **Alvo adaptativo** (o "esforço relativo" da E3 aplicado às missões):
  - diária `d-km`: mediana das últimas 10 corridas, arredondada a 0,5 km, entre 2 e 8 km;
  - semanal `s-km`: 90% da mediana semanal das últimas 4 semanas, com no máximo +10% sobre a maior delas, entre 6 e 40 km.
- **Sempre há opção leve,** e caminhar conta.
- **Trocar 1 missão por dia** (autonomia).
- **Missão perdida some,** sem multa nem acúmulo.
- **Conclusão automática no servidor** (finish-activity), idempotente: cada atribuição conclui uma única vez. A celebração acontece no resumo.

### 5.2 Catálogo (29 missões; tabela completa com metas e validação em `engajamento/catalogo-tabelas.md`)

| Cadência | Leve | Padrão | Desafio |
|---|---|---|---|
| **Diária** (20/30/40 XP) | Mova-se 15 min (caminhar vale) · Caminhe ou corra 1,5 km · Revele 5 trechos novos da Neblina | Corra {x} km hoje · Pinte 3 zonas com a cor do time · Abra 2 baús na Caça · Termine à frente do fantasma | Conquiste uma zona · Defenda uma zona sob ataque · Corra junto com alguém da crew · Revele 20 trechos novos da cidade |
| **Semanal** (100/150/200 XP) | Faça 2 atividades na semana · Some 60 minutos de movimento | Some {x} km na semana · Pinte 10 zonas diferentes · Corra em 2 bairros diferentes | Conquiste 3 zonas na semana · Cause {x} km de dano no chefão · Corra 2 vezes com a sua crew |

- O maior texto tem 34 caracteres, contando o `{x}` com o maior valor possível.
- **Validação no servidor,** sempre sobre o resultado **oficial**:
  - `meters` e `movingSeconds` de trechos válidos;
  - `activity_zones.rp` e `outcome`;
  - `chest_opens`, `newFogCells`, `beatGhost`, `group`;
  - dano do raid (E9) e `districtOf(zone)`.
- Atividade rejeitada ou em revisão não conta até ser aprovada. A aprovação reprocessa as missões do período, se ele ainda estiver aberto.

### 5.3 Primeira semana (passos com texto ≤ 40)

| Passo | Modo | Texto | Meta / validação | Recompensa |
|---|---|---|---|---|
| 1 | Domínio | Corra 500 m e pinte sua 1ª zona | ≥ 500 m válidos e alguma zona com RP > 0 (500 m dão ≥ 40 RP, acima dos 30 da conquista de zona neutra) | 100 XP + baú do dia raro garantido |
| 2 | Caça | Abra seu primeiro baú na Caça | `chest_opens` ≥ 1 | 40 XP |
| 3 | Fuga | Vença o fantasma em 1 km | Fuga, ≥ 1 km, `beatGhost` (ritmo escolhido pela pessoa) | 40 XP |
| 4 | Raid | Cause 1 km de dano no chefão | Dano ≥ 1 km. Sem raid real: "Revele 10 trechos da Neblina" | 40 XP |
| 5 | Crew | Entre numa crew ou crie a sua | Linha em `crew_members` (não precisa correr) | 60 XP |
| 6 | Liga | Some seus primeiros pontos na liga | Pontos da liga > 0. Sem liga real: ver o ranking do time | 60 XP |
| 7 | Compartilhar | Compartilhe o card de uma corrida | `record_share` depois do share sheet (declarado pelo app: só cosmético e XP baixo) | 60 XP + moldura "Primeira Semana" |

- **Ordem:** a do prompt (§13).
- **Liberação:** um passo por dia (00:00 BRT) depois de concluído o anterior; nunca expira.
- **Progresso dotado:** a barra começa em 20% ("conta criada + time escolhido").

---

## 6. Temporada (mês, `season.ts`)

| Degraus | Recompensa (todas grátis) |
|---|---|
| 1, 2, 3 | +1 baú do dia raro (1 vez) · emblema do mês · moldura do mês (comum) |
| 4 | Rastro do mês |
| 5–7 | XP extra de 50 cada |
| **8** | **Medalha de bronze** + congelamento extra (no máximo 2 guardados) |
| 9–11 | Efeito de conquista "Faísca do mês" · baú lendário garantido (degrau 10) |
| 12 | Rastro do mês, versão brilhante |
| 13–15 | XP extra de 75 cada |
| **16** | **Medalha de prata** + moldura do mês (rara) |
| 17–19 | Baú raro · efeito "Pulso do mês" · XP extra |
| 20 | Rastro do mês, versão animada |
| 21–23 | XP extra de 100 cada |
| **24** | **Medalha de ouro** + moldura animada do mês |
| 25+ | Estrela de prestígio a cada 240 XP (só um número no perfil, sem item exclusivo) |

**Simulação** (média dos meses 2 a 59):

| Perfil | XP/mês | Degraus | Bronze | Prata | Ouro | Ouro no dia |
|---|---|---|---|---|---|---|
| Iniciante | 2.887 | 22,8 (19–24) | 100% | 100% | 48% | 29 |
| Regular | 5.499 | 24 | 100% | 100% | 100% | 17 |
| Avançado | 8.996 | 24 | 100% | 100% | 100% | 10 |

- **O que já existe e continua:** reset parcial do território (×0,3, `job_season_rollover`, E3 decide se muda) e troca de time 1 vez por temporada (RF-003, `factionChange`).
- **Novo:** "temporada temática" (nome e arte do mês, pela E4), por exemplo "Temporada do Calor" em novembro. É só cosmética.

---

## 7. Baú do dia

- **Onde fica:** **não** é um ponto no mapa.
  - É um ícone fixo no topo do Mapa ("Baú do dia ×2"), que abre no resumo da próxima atividade.
  - **Motivo:** segurança (não leva ninguém a um ponto específico, de noite ou perto de casa) e simplicidade.
  - A Caça continua com os baús físicos (decisão C2).
- **Regra (1 frase):** "Ganhe 1 baú por dia; guarde até 3; uma atividade abre todos."
- **Quantos abre** (simulação): iniciante 6,0 por semana, regular 7,0, avançado 7,0. Iguala quem corre pouco e quem corre muito.
- **Raridade** (chances sempre visíveis no "?"): comum 70% (15 XP), raro 25% (40 XP + 5% de cosmético), lendário 5% (100 XP + 30% de cosmético).
  - Garantia: o 20º baú sem lendário é lendário. Há um contador "faltam N".
  - Em 5 anos, o regular abre 142 lendários em 1.819 baús (7,8% efetivo).
- **Sorteio no servidor:** `HMAC(segredo do servidor, userId | dia | n)` → `progression.rollDailyChest(r, pity)`. É puro e determinístico, testável com semente, e o cliente não consegue prever.
- **Anti-abuso:**
  - só atividade **pontuada** (válida ou parcial, ≥ 1 km ou ≥ 15 min) abre;
  - os créditos são contados por dia BRT no servidor (mudar o relógio do aparelho não adianta);
  - no máximo 3 por abertura e 1 abertura por dia;
  - com índice de confiança < 40, os baús ficam guardados até a revisão;
  - conta nova sem corrida não acumula além do 1º baú (que já começa guardado: progresso dotado).

---

## 8. Notificações

### 8.1 Orçamento e regras (domain puro `reminders.ts`, decisão C8)

- **Engajamento:**
  - no máximo **1 por dia BRT** e **4 por semana**;
  - **janela de 8h às 21h** (mais curta que os 7h–22h do prompt);
  - perto do horário habitual da pessoa: mediana da hora de início das últimas 10 corridas, menos 1 h;
  - não envia se a pessoa já teve atividade hoje.
- **Prioridade quando há mais de uma no dia:** chefão > liga > sequência > missão > baú > primeira semana > recap > temporada > volta. A volta só existe quando não há atividade há 7 dias ou mais, então não concorre com as outras.
- **Jogo** (invasão e território perdido): continuam com o limite atual (1 por zona a cada 6 h, 5 por dia).
  - **Novo:** das 22h às 7h, vão só para a central, sem banner nem som. Conquista agrupada numa só por corrida.
- **Segurança** (SOS, alerta de parada): sem limite e sem janela.
- **Verdade:**
  - **local:** cada notificação local é agendada com o estado conhecido. O app **cancela e replaneja** a cada abertura, sincronização e corrida, sempre para os próximos 7 dias;
  - **servidor:** o que depende do servidor (zona sob ataque, chefão, liga) só é criado pelo servidor na hora do fato;
  - **sem push remoto** (Expo Go): o que vem do servidor chega na central e vira alerta local com o app aberto. Fora dele, só com development build (§10, push opcional).
- **Parar:** depois do aviso de 30 dias, silêncio. Se 3 notificações de engajamento seguidas não forem abertas, o orçamento cai para 1 por semana (sinal de que não ajudam).

### 8.2 Catálogo (15 itens; gatilho, limite e janela completos em `engajamento/catalogo-tabelas.md`)

| id | Gatilho verdadeiro | Texto (≤ 60) | Preferência | Entrega |
|---|---|---|---|---|
| `n-chefao` | Raid real com < 15% de vida, termina em < 24 h, e a pessoa causou dano | O chefão está com {x}% de vida. Sua corrida conta! | `raid` | servidor |
| `n-liga` | Domingo, a ≤ 2 posições da linha de subir | A liga fecha hoje: você está a {x} posições de subir. | `league` | servidor |
| `n-sequencia` | Sábado, exatamente 1 de 2 atividades na semana | Falta 1 atividade para garantir a semana. Caminhar vale! | `streak` | local |
| `n-missao` | Missão semanal ≥ 70%, sexta ou sábado | Faltam {x} km para a missão da semana. | `missions` | local |
| `n-bau` | 3 baús guardados e nenhuma atividade hoje | Seus 3 baús do dia estão guardados. Uma corrida abre todos. | `chests` | local |
| `n-ftue` | Passo liberado e não feito (só nos 14 primeiros dias) | Passo {x} de 7 liberado: {passo}. | `missions` | local |
| `n-recap` | Segunda 8h, se houve atividade na semana anterior | Sua semana: {x} km e {y} zonas pintadas. Veja o recap. | `recap` | local |
| `n-temporada` | Dia 1, 9h | Temporada de {mês} começou: trilha nova e troca de time. | `season` | local |
| `n-volta-7` | 7 dias sem atividade (sem pausa ligada) | Sua missão de volta está pronta: 10 minutos já contam. | `comeback` | local |
| `n-volta-14` | 14 dias | Baú raro garantido na sua próxima atividade. Sem pressa. | `comeback` | local |
| `n-volta-14-zona` | 14 dias e zona da pessoa sob ataque agora (só com push) | {zona} está sob ataque. Bora defender? | `comeback` | servidor |
| `n-volta-21` | 21 dias | Precisa de uma pausa? Sua sequência fica guardada. | `comeback` | local |
| `n-volta-30` | 30 dias (último aviso) | Quando quiser voltar, tem um baú lendário te esperando. | `comeback` | local |
| `n-invasao` | Já existe (com o horário novo) | Alerta de invasão! {zona} está sob ataque. | `invasions` | servidor |
| `n-conquista` | Já existe (agrupada) | Você conquistou {x} zonas para o seu time! | `conquests` | servidor |

**Regras de texto:**
- singular e plural tratados ("1 posição");
- nome de zona com mais de 22 caracteres é cortado com "…";
- `catalogo.ts` confere ≤ 60 caracteres e bloqueia palavras de culpa (abandonar, decepcionar, sumiu, "vai perder", "última chance"…).

**Mensagens de saúde** (no resumo, não são notificação):
- "6 dias seguidos. Descanso também treina." (6 dias com atividade em 7);
- "Semana forte! Subir aos poucos evita lesão." (km da semana > 1,3× a média de 4 semanas).

### 8.3 Preferências (estende `NotificationPrefs`, compatível com o que existe)

| Chave | Padrão |
|---|---|
| `invasions`, `conquests`, `moderation` | já existem |
| `missions` | já existe: passa a cobrir as missões e a primeira semana |
| `chests`, `streak`, `league`, `raid`, `season`, `recap`, `comeback` | novas, padrão ligado |
| `quietStart` / `quietEnd` | 22 / 7; a pessoa pode ampliar, nunca reduzir |

Chave ausente = ligada: perfis antigos continuam valendo. Há um botão "Pausar lembretes por 7 dias".

---

## 9. Telemetria mínima (LGPD)

| Métrica | De onde sai | Consentimento |
|---|---|---|
| D1/D7/D30 de **corrida** e corridas por semana | `activities` (já existe; execução do serviço) | não precisa de novo |
| Missão concluída, recompensa | `xp_ledger` e `mission_assignments` (já são dados do jogo) | não precisa de novo |
| D1/D7/D30 de **abertura** | `app_opens(user_id, day)`: 1 linha por dia | **opt-in** "Ajudar a melhorar o app", desligado por padrão |
| Compartilhou, abriu notificação (por tipo), viu o recap | `engagement_events` (evento em lista fechada, `props` ≤ 256 bytes, no máximo 50 por dia) | opt-in |

- **Retenção dos dados:** os eventos brutos ficam 90 dias. Depois, um job agrega por dia, coorte semanal e evento, **sem `user_id`**, e apaga o bruto.
- **LGPD:** `svc_account_export` inclui as tabelas novas; `account-delete` apaga em cascata.
- **Acesso:** só staff lê as views de coorte.
- **Fora da telemetria:** nada de localização, rota, ritmo ou tempo de tela.

---

## 10. Contrato para a E9 (servidor)

**Princípios:**
- migrações **aditivas**, RLS em tudo (o dono lê só o que é seu; escreve só via RPC `security definer` ou Edge Function);
- regras no domain (`progression.ts`, `missions.ts`, `reminders.ts`) usadas pela ponte das functions;
- o finish-activity grava tudo **na mesma transação** do resultado oficial.

### 10.1 Tabelas e colunas

| Objeto | Colunas principais | Notas |
|---|---|---|
| `xp_ledger` | `id`, `user_id`, `source` (check: `run_distance`, `run_complete`, `fog`, `ghost`, `hunt_chest`, `daily_chest`, `mission`, `week_kept`, `ftue`, `comeback`, `season_step`, `duplicate_cosmetic`), `amount ≥ 0`, `ref_id text`, `season_id`, `created_at` | `unique(user_id, source, ref_id)` → idempotência. `profiles.xp` = soma (XP nunca diminui; moderação que rejeita depois **não** retira XP já mostrado, só bloqueia os créditos futuros: decisão C9) |
| `mission_assignments` | `id`, `user_id`, `period` ('2026-10-23' \| '2026-W43' \| 'ftue' \| 'volta-<data>'), `cadence`, `slot`, `mission_id`, `target numeric`, `progress numeric`, `completed_at`, `rerolled_at` | `unique(user_id, period, slot)`. Criadas sob demanda em `my_engagement()` (como em `daily_chests`, com trava consultiva) |
| `daily_chest_opens` | `user_id`, `day`, `n`, `rarity`, `xp`, `cosmetic_id`, `activity_id`, `opened_at` | PK `(user_id, day, n)`. Guardados = `min(3, dias desde a última abertura)`, derivado |
| `season_progress` | `user_id`, `season_id`, `xp`, `steps`, `medal` ('bronze' \| 'prata' \| 'ouro' \| null) | PK `(user_id, season_id)` |
| `cosmetic_unlocks` | `user_id`, `cosmetic_id`, `source`, `unlocked_at` | O catálogo de cosméticos fica no domain (código) |
| `profiles` (novas colunas) | `lifetime_meters bigint`, `best_streak_weeks smallint`, `equipped jsonb` (≤ 256 bytes: trail, frame, effect, title), `ftue_started_at`, `pause_until date`, `pause_used_season text`, `daily_chest_pity smallint`, `last_activity_at`, `telemetry_opt_in bool default false` | Atualizar a view pública só com o que é público (título e faixa sim; pausa não) |
| `app_opens`, `engagement_events` | Ver §9 | Job de retenção |
| `notifications.type` | Acrescentar `engagement` (o tipo fino vai em `data.kind`) | Compatível com o app atual |
| `push_tokens` (opcional, dev build) | `user_id`, `token`, `platform`, `created_at` | Só se a coordenação aprovar push remoto |

### 10.2 RPCs (`authenticated`)

| RPC | Faz |
|---|---|
| `my_engagement()` | Devolve `{ level, xp, intoLevel, needed, title, band, lifetimeMeters, streak:{weeks, best, runsThisWeek, freezesLeft, pauseUntil}, dailyChest:{stored, pityLeft, odds}, missions:{daily[], weekly[], ftue[], comeback?}, season:{id, xp, step, nextStepXp, endsAt, medal}, equipped }` |
| `reroll_mission(p_assignment)` | Troca 1 missão diária por dia, por outra do mesmo nível |
| `equip_cosmetic(p_slot, p_cosmetic)` | Só equipa o que está em `cosmetic_unlocks` |
| `start_health_pause(p_weeks 1..4)` / `end_health_pause()` | 1 vez por temporada. O `job_close_week` pula a semana pausada |
| `record_share(p_activity)` | Passo 7 da primeira semana e telemetria (1 crédito por dia) |
| `xp_history(p_limit)` | Lista do ledger com rótulos (transparência) |
| `track_event(p_event, p_props)` | Só com opt-in; evento em lista fechada; no máximo 50 por dia |

### 10.3 finish-activity: novo bloco opcional na resposta

```ts
engagement?: {
  xp: { total: number; lines: { source: string; amount: number; label: string }[] };
  levelBefore: number; levelAfter: number; titleAfter?: string; bandAfter?: string;
  dailyChests: { rarity: 'comum' | 'raro' | 'lendario'; xp: number; cosmeticId: string | null }[];
  missions: { id: string; text: string; xp: number }[];
  weekKept: boolean;
  season: { stepBefore: number; stepAfter: number; unlocked: string[] };
  comeback?: { missionId: string };
}
```

- **Compatibilidade:** o app antigo ignora o bloco; o app novo com servidor antigo esconde o bloco "Recompensas" e mostra o XP como hoje.
- **XP da corrida:** passa a vir de `progression.runXp()`. A soma continua em `response.xp`, para os clientes antigos.

### 10.4 Jobs

| Job | Faz |
|---|---|
| `job_close_week` (estender) | Respeita `pause_until`; atualiza `best_streak_weeks`; cria `notifications` "Semana protegida pelo congelamento" quando usar o congelamento |
| `job_season_rollover` (estender) | Grava a medalha pela quantidade de degraus (8/16/24) em `cosmetic_unlocks`; zera os degraus. O congelamento extra do degrau 8 respeita o máximo de 2 |
| `job_weekly_recap` (novo, segunda 08:00 BRT) | Dados do recap (E8) + notificação na central |
| `job_engagement_retention` (novo, diário) | Agrega e apaga os eventos com mais de 90 dias |
| `private.can_notify_engagement(user, now)` | Janela 22h–7h (e a da pessoa), 1 por dia, 4 por semana e preferência. Toda notificação de engajamento criada pelo servidor passa por aqui |

### 10.5 Testes que a E9 entrega

- **pgTAP:** RLS das tabelas novas; idempotência do ledger; baú do dia com 3 guardados; missão não conclui duas vezes; janela de silêncio; exportação LGPD.
- **Deno:** finish-activity com o bloco `engagement`; semente do baú reproduzível.

---

## 11. Pedidos para outras equipes

| Para | Pedido |
|---|---|
| **E3** | (1) Decidir o uso de `streakWeeks` como `streakDays` no RP (`run-controller.ts:98`, `_shared/scoring.ts`). Recomendação: tirar a sequência do RP (ou teto de +10%) e premiar a constância só com XP e cosméticos. (2) Aceitar que o XP saia do `finishRun` para `progression.runXp()` (ou que o `run-engine` o chame), com neblina 2 XP por célula e teto de 60. (3) Confirmar que 500 m na 1ª corrida pintam zona sempre (passo 1). (4) Regras da liga real e do raid que as missões usam |
| **E4** | Baú do dia (3 raridades + estados guardado ×1/×2/×3); medalhas bronze, prata e ouro × tema mensal; 12 molduras e 8 faixas de material; 10 rastros; 6 efeitos; ícones dos 8 títulos; selo de missão; ilustração da pausa de saúde e do "Que bom te ver!". Mascote cansado e sorrindo, nunca triste |
| **E5** | `RewardToast` (missão riscada), `ChestOpening` (1 a 3 em sequência), `LevelUp` (única tela cheia), `StreakFlame`, `SeasonStepUp`, contador de garantia do lendário. Ordem no resumo: zonas → baús → missões → XP → nível → degrau. Com "Reduzir movimento", tudo vira fade |
| **E6** | Chips "Baú do dia ×N" e "Missões 1/3" no Mapa; seção Missões na Arena e rota `/missoes`; `/recompensas` (trilha); cartão de nível, título e faixa no Perfil; tela "Que bom te ver!"; tela de preferências com as 7 chaves novas; renomear "missão" (Livre/Fuga/Caça) para **"modo"** na interface |
| **E8** | Card do recap semanal; `record_share` chamado ao concluir o compartilhamento; o card nunca mostra baús nem o ponto de início perto de casa |
| **E9** | Contrato da §10 |
| **E10** | Testes de propriedade do domain novo; modo demonstração com dados de engajamento rotulados como "demonstração"; confirmar que `scheduleNotificationAsync` com gatilho de data funciona no Expo Go SDK 57 (Android e iOS); checklist anti-culpa (E1, §14) |
| **E1** | Validar os textos da escada de volta. A E7 trocou "Sentimos sua falta" por textos sem apelo emocional |

---

## 12. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| C1 | Trocar a curva de XP? | A) manter 100·n^1,5 · B) 50·n^1,3+50 + fontes novas (§4.1) · C) só fontes novas | **B**: ninguém perde nível; o nível 50 fica possível; o avançado fica em 3,2× o iniciante (não 11×) |
| C2 | Baú do dia: onde? | A) crédito diário guardado até 3, aberto na atividade · B) ponto físico no mapa | **A**: segurança, simplicidade e não pune descanso |
| C3 | "Missão" é modo ou tarefa? | A) "missão" = tarefa, "modo" = Livre/Fuga/Caça (campo `activities.mission` inalterado) · B) manter as duas | **A** |
| C4 | Sequência no multiplicador de RP | A) remover · B) teto de +10% · C) manter (+50% em 10 semanas) | **A** (E3 decide o equilíbrio do mapa) |
| C5 | Telemetria de abertura | A) opt-in, desligado por padrão · B) interesse legítimo, ligado | **A**: as métricas de corrida já saem de `activities` |
| C6 | Push remoto | A) só notificações locais agendadas (Expo Go) · B) + `push_tokens` para development build | **A** agora; B fica atrás de flag para a demonstração |
| C7 | Pausa de saúde | A) 1 a 4 semanas, 1 vez por temporada · B) não ter | **A** (E1 também recomenda) |
| C8 | Arquivo extra no domain para a E7 | `src/domain/reminders.ts` (planejador puro de notificações, reaproveitado por um futuro push no servidor) ou `features/notifications/planner.ts` | **domain**, registrado na ponte |
| C9 | XP de corrida depois rejeitada pela moderação | A) não retira (XP nunca diminui) · B) estorna | **A**: o XP já mostrado fica; nas próximas, os créditos esperam a revisão (índice < 40) |

---

## 13. Tarefas propostas para F3/F4

| ID | Título | Dona | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E7.1 | Regras puras de progressão | E7 | `src/domain/progression.ts`, `__tests__/progression.test.ts`, ponte (`_shared/domain.ts`, 2× `deno.json`) | C1, E3 (pedido 2) | Fontes de XP, curva, títulos, faixas, trilha, `rollDailyChest` com semente. Propriedades: XP ≥ 0 e ledger idempotente; nível monotônico; curva nova ≤ atual; teto diário de distância. Cobertura ≥ 90%; `domain_bridge.test.ts` verde |
| T7.E7.2 | Regras puras de missões | E7 | `src/domain/missions.ts` + testes + ponte | T7.E7.1 | Catálogo, sorteio por semente, alvo adaptativo (+10% no máximo), avaliação sobre o resultado oficial, primeira semana e volta. Propriedades: conclui no máximo 1 vez; sempre 1 leve; texto ≤ 40 |
| T7.E7.3 | Planejador de notificações | E7 | `src/domain/reminders.ts` + testes (+ ponte) | C8 | Propriedades: ≤ 1 por dia e ≤ 4 por semana de engajamento; nada entre 22h e 7h BRT; preferência desligada nunca envia; silêncio depois de 30 dias; texto ≤ 60 |
| T7.E7.4 | Servidor de engajamento | E9 | `supabase/**`, `docs/API_CONTRATO.md` | T7.E7.1–2 | Tabelas, RPCs e jobs da §10; finish-activity com o bloco `engagement`; pgTAP e Deno verdes; seed de demonstração; ordem de deploy em `DEPLOY.md` |
| T7.E7.5 | Repositório e store de engajamento no app | E7 (+ dono de `services/api`) | `src/services/api/engagement-repo.ts`, `src/features/engagement/use-engagement.ts` | T7.E7.4 | Degrada sem erro com servidor antigo; testes de mapeamento |
| T7.E7.6 | Telas de missões e trilha | E7 (layout da E6) | `src/features/engagement/**`, `src/app/missoes.tsx`, `src/app/recompensas.tsx` | E4, E5, T7.E7.5 | Herói visual; ≤ 1 frase por bloco; `testID` e `accessibilityLabel`; estados vazio, erro e demonstração; teste de 5 s ≥ 80% |
| T7.E7.7 | Bloco "Recompensas" do resumo | E7 (componente) + E6 (encaixe) | `src/features/engagement/rewards-block.tsx` | E5, T7.E7.5 | Ordem pico-fim; XP linha a linha; "Reduzir movimento" respeitado |
| T7.E7.8 | Chips do Mapa e cartão de nível do Perfil | E7 (componentes) + E6 | `src/features/engagement/**` | E4 | 2 toques para correr continuam valendo; nada cobre o botão "Correr" |
| T7.E7.9 | Notificações locais agendadas + preferências novas | E7 | `src/features/notifications/**` (+ `NotificationPrefs` com o dono de `types.ts`) | T7.E7.3, E10 (Expo Go) | Replaneja ao abrir, sincronizar e correr; cancela ao desligar; o toque abre a tela certa; testes do agendador |
| T7.E7.10 | Volta depois de sumir e pausa de saúde | E7 + E9 + E6 | `features/engagement`, `supabase/**` | T7.E7.2–4 | Escada 7/14/21/30 com silêncio depois; tela "Que bom te ver!" sem perdas; a pausa congela a sequência e as notificações |
| T7.E7.11 | Telemetria mínima com consentimento | E9 (servidor) + E7 (cliente) + E6 (interruptor) | `supabase/**`, `features/engagement/telemetry.ts` | C5 | Opt-in desligado por padrão; 90 dias + agregado sem `user_id`; exportar e excluir incluem; consulta D1/D7/D30 documentada |
| T7.E7.12 | Demonstração de engajamento | E10 + E7 | `src/services/api/demo/**` | T7.E7.5 | Todas as telas novas no modo demonstração, rotuladas; capturas para o relatório |

---

## 14. Riscos éticos e bloqueios

| Risco | Mitigação |
|---|---|
| Sequência gerar ansiedade | Semanal, congelamento automático, pausa de saúde, melhor sequência eterna, texto neutro quando quebra, aviso desligável (`streak`) |
| Baú virar caça-níquel | Chances visíveis, garantia de lendário, conteúdo só XP e cosmético, nada à venda, prêmio da volta fixo (não sorteado) |
| Incentivar excesso de treino | XP zero depois de 15 km/dia; alvos com no máximo +10% por semana; opção leve sempre; mensagens de descanso; nenhuma missão diária obrigatória para a sequência |
| Notificação local "mentir" por estado velho | Replanejar a cada abertura, sincronização e corrida; textos sobre fatos que o app sabe (baús guardados, 1 de 2); fatos do mapa só pelo servidor |
| Privacidade | Baú do dia sem ponto no mapa; card sem baús; telemetria opt-in sem localização; eventos com retenção de 90 dias |
| Recompensa por gesto vazio (*metric gaming*) | Sem XP por abrir o app; o compartilhamento declarado pelo app só dá cosmético e 60 XP 1 vez |

**Bloqueios e dependências:**
- **Sem servidor real:** o passo Raid e a missão de chefão (raid real), o passo Liga e a notificação da liga (liga real) dependem da E9. Há substitutos definidos para a primeira semana.
- **A confirmar:**
  - agendamento local no Expo Go SDK 57 (E10);
  - quem é dono de `services/api/types.ts` (`NotificationPrefs`) e de `summary-screen.tsx` (o encaixe é da E6).
- **Achados fora do escopo da E7** (registrar no `PROGRESSO.md`): o texto "0 congelamento disponível" (`activities-screen.tsx:94`, E6) e as conquistas do Perfil calculadas só na tela (`profile-screen.tsx:21-25`, viram medalhas no servidor com a T7.E7.4).
