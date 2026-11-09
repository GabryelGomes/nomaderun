# F8 · 03 — Auditoria de UX tela por tela (app v2, modo demonstração)

> Fase 8 ("Finalização 100%"). Olhar de quem **nunca viu o app**: o que se entende em 5 s, qual é a ação principal, o que se repete, o que está velho ou sem sentido e o que falta para cada tela "fechar". **Só auditoria: nenhum código do app foi alterado.**
> Data: 2026-10-30 · Auditor: E6 (UX/UI) · Base: worktree da E6, export web do modo demonstração (D-77).

## 0. Como foi feito

- **Export:** `EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear` (o worker do MapLibre copiado antes).
- **Roteiro reprodutível:** `docs/melhoria/F8/ux/auditar-telas.cjs` (base: `e2e-web/capturas.cjs` e `demo-mode-flow.cjs`). Três blocos:
  - `fluxo`: primeira abertura → cadastro → cidade dividida → líder → quiz → time → confirmação → localização → Mapa → Nova corrida → simulação → corrida → Resumo → Compartilhar → Concluir → Você → Missões, **contando toques**;
  - `estatico`: 29 rotas × cenários (`cheio`, `vazio`, `erro`, `offline`, `lento`, `sob-ataque`, `sem-time`, `primeira-abertura`, `moderador`), incluindo erro/offline com o perfil já em cache ("quente");
  - `interacoes`: 42 toques em folhas, modais, chips, cartões e botões secundários.
- **Viewport:** 390 × 844, "Reduzir movimento", relógio fixo (23/10/2026 09:00) nas telas estáticas; o fluxo usa o relógio real (a simulação precisa dele). Mapa-base trocado por estilo vazio (sem internet); as regiões aparecem.
- **Saída:** `docs/melhoria/F8/ux/capturas/*.png` (pngquant 85–98). Telas com rolagem têm `--2`, `--3`… (a tela inteira, não só a 1ª dobra). Texto visível, alvos < 44 px e interativos sem nome de cada captura em `docs/melhoria/F8/ux/textos.json`.
- **Palavras no DOM** (`textos.json`; inclui cartões fora da tela, como os do carrossel). Valores da 1ª captura de cada tela:

  | Tela | Palavras | Capturas |
  |---|---:|---:|
  | Mapa | 29 | 1 |
  | Nova corrida | 43 | 1 |
  | Corrida ativa | 34 | 1 |
  | Resumo | 48 | 2 |
  | Arena | 72 | 2 |
  | Missões | 83 | 2 |
  | Recompensas | 118 | 2 |
  | Clube | 287 | 6 |
  | Você | 47 | 1 |
  | Ajustes | 204 | 5 |
  | Atividades | 119 | 2 |
  | Zona | 36 | 1 |

  Clube, Ajustes e Recompensas passam da meta da D-74 (≤ 40 palavras por tela de jogo). A régua oficial continua sendo `docs/melhoria/F1/ux/medir-texto.mjs`.
- **Limites:** é a web, não o aparelho. A barra de abas da web tem o Correr elevado; no iOS/Android (NativeTabs) ele é uma aba comum (D-73). Rotas abertas por URL direta não mostram "←" (a pilha está vazia); abertas por toque, mostram. Não conta como achado.

Escala: **nota 1–5** (5 = entende e age em 5 s sem ajuda). **Severidade:** Alto (confunde ou contradiz o jogo, ou trava a pessoa), Médio (atrasa, gera dúvida), Baixo (acabamento).

## 1. Resumo executivo

- **Nota média das 33 telas: 3,5/5.** O visual neon está maduro: mascotes, chefão, cards de compartilhar e estados vazios ilustrados. O que derruba a nota não é estética, é **coerência**: o mesmo dado aparece diferente em telas diferentes, a mesma ação mora em 2 ou 3 lugares e há vocabulário demais.
- **As queixas do dono se confirmam:**
  - **Correr duplicado:** na verdade é triplicado (aba Correr + CORRER do Mapa + uma tela "Bora pintar a cidade?" com um 3º CORRER, que aparece quando se volta da corrida pela aba).
  - **Símbolos antigos:** o `TeamBadge` (círculo colorido com forma geométrica) ainda aparece em 15 componentes, ao lado do mascote e do emblema novos. Em "Meu time", o seu time é o mascote e os outros 3 são bolinhas geométricas.
- **Dois achados novos e graves:**
  - **Dois níveis diferentes:** depois da 1ª corrida, o Resumo diz "Nível 3!" e o Você diz "nível 2". No cenário cheio, o Você diz "nível 5" e Recompensas diz "6". São duas curvas de XP (`domain/games.ts:184` e `domain/progression.ts:141`).
  - **A missão de boas-vindas não some** depois de cumprida: o Mapa continua pedindo "Correr 500 m" logo depois do Resumo que deu "+100 XP" por ela.
- **Um terceiro, de confiança:** offline, o Você e as Atividades mostram **zeros** (0 km, 0 zonas) como se fossem dados. Com erro do servidor (503), o app inteiro trava, mesmo com o perfil em cache.
- **Placeholders:** nenhum "TODO" ou "lorem" visível. Os "Em breve" que existem só aparecem com o servidor antigo ou com a flag desligada (estados `unavailable`). O que sobrou de "não pronto" é a **rota 404 em inglês** ("Unmatched Route / Go back / Sitemap").

## 2. Fichas por tela

Formato: **(a)** 5 s · **(b)** ação principal · **(c)** duplicações · **(d)** símbolos/ícones · **(e)** textos · **(f)** o que falta · **(g)** nota e achados (id → lista do §6).

### 2.1 Boas-vindas — `boas-vindas__primeira-abertura.png`, `f1-01-boas-vindas.png`
- (a) "NOMADE RUN, corra a sua cidade". Não mostra o jogo (times, mapa, mascote).
- (b) "Começar": é o maior e o laranja. Correto.
- (c) —
- (d) As 4 bolinhas são o `TeamBadge` geométrico (`features/auth/neon-badges.tsx:15`). Os 4 mascotes já existem (`components/art`) e não aparecem. O logo da E4 (`Logo`) também não: o título é só texto.
- (e) Ok, curto.
- (f) Um herói: 4 mascotes ou o mapa dividido em segundo plano.
- (g) **3/5** · UX-04 (Alto), UX-20 (Médio).

### 2.2 Entrar — `entrar__primeira-abertura.png`
- (a) Formulário de login claro.
- (b) "Entrar". Correto.
- (c) "Criar conta" e "Ver demonstração" bem separados.
- (d) Repete as 4 bolinhas geométricas no topo.
- (e) Ok.
- (f) —
- (g) **4/5** · UX-04.

### 2.3 Cadastro — `f1-02-cadastro-vazio.png`, `f1-03-cadastro-preenchido.png`
- (a) "Criar conta, 1 minuto e você escolhe seu time". Muito bom.
- (b) "Criar conta", fixo embaixo. Correto.
- (c) "Já tenho conta" no meio do formulário compete com o botão principal (Baixo).
- (d) —
- (e) Ajudas curtas ("Aparece nos rankings", "Para maiores de 16 anos").
- (f) —
- (g) **4/5**.

### 2.4 Recuperar senha / Nova senha — `recuperar-senha__primeira-abertura.png`, `nova-senha__cheio.png`
- Simples e corretas.
- (g) **4/5**, sem achados.

### 2.5 Onboarding — cidade dividida — `f1-04-onboarding-1.png`
- (a) "A cidade está dividida, de que lado você corre?": entende-se na hora. Ótima abertura.
- (b) "Escolher meu time". Correto.
- (d) As formas (círculo, triângulo, losango, quadrado) aparecem **sem mascote**. É o último lugar onde a forma pura ainda faz sentido (acessibilidade para daltônicos), mas destoa da tela seguinte.
- (e) As porcentagens (31/29/24/16%) não dizem que são de demonstração. O testID `onboarding-cidade-demonstracao` existe, mas não aparece nesta captura.
- (g) **4/5** · UX-31 (Baixo).

### 2.6 Onboarding — escolha do time, líder e quiz — `f1-05-times.png`, `f1-06-folha-lider.png`, `f1-07-folha-quiz.png`, `f1-08-quiz-resultado.png`, `f1-10-time-volt-selecionado.png`
- (a) Carrossel com mascote, lema e "Conhecer [líder]". O "Não sei escolher" abre um quiz de 3 perguntas. **É a melhor tela do app.**
- (b) Botão fixo "Toque no seu time" (desligado), que vira "Entrar para os Volt Runners". Correto.
- (c) Os indicadores do carrossel são as formas (● ■ ◆ ▲). Ok.
- (d) Consistente: mascote nos cards e busto do líder na folha.
- (e) "Na fábula a lebre dormiu; a nossa não para e cada quilômetro recarrega." é longa, mas tem personalidade. Os lemas daqui **não batem** com os de "Meu time" (ver 2.27).
- (f) —
- (g) **5/5** · UX-30 (Baixo).

### 2.7 Confirmação do time — `f1-11-confirmacao.png`
- (a) A cor do time inunda a tela, com mascote, nome e frase do líder. Épico, como pede a D-72.
- (b) "Bora correr", mas o botão **leva à permissão de localização, não à corrida**. A promessa e o resultado não batem.
- (e) "VOLT RUNNERS" em preto sobre verde, com uma faixa escura atrás do texto (parece um destaque de seleção). Dá impressão de bug.
- (g) **4/5** · UX-18 (Baixo).

### 2.8 Permissão de localização — `f1-12-localizacao.png`
- (a) "Ligue o GPS e pinte a cidade", com ilustração e a garantia "Sua casa fica escondida dos outros". Muito boa.
- (b) "Permitir localização". Botão único, de propósito (Apple 5.1.1(iv): o "não" fica no diálogo do sistema). **Correto, não mexer.**
- (g) **5/5**.

### 2.9 Mapa (aba inicial) — `mapa__cheio.png`, `mapa__vazio.png`, `mapa__sob-ataque.png`, `f1-13-mapa-boas-vindas.png`, `f1-20-depois-concluir.png`, `x-mapa-camadas.png`, `x-mapa-chip-hoje-1.png`, `x-mapa-alerta-toque.png`
- (a) "Mapa do meu time, um alerta, um CORRER enorme". O "o que mudou" da E5 some em 4 s e não está na captura.
- (b) **CORRER** de 72 pt, na zona do polegar: é o mais visível. **Mas a 1 cm dele está a aba Correr, que faz a mesma coisa**, e, na 1ª sessão, o card da missão (com ›) também abre a Nova corrida. São 3 alvos para a mesma ação na mesma dobra.
- (c) Correr ×3 (UX-01). "48 zonas em Goiânia" é do time, e a Arena mostra "Domínio: 0 zonas", que são as suas. A mesma palavra vale para dois números (UX-31).
- (d) Cabeçalho com o `TeamBadge` geométrico (`map-screen.tsx:244`), enquanto o card de missão logo abaixo usa o mascote (UX-04).
- (e) Chips "2/2 Semana", "2 Baús", "36% Chefão": substantivo e número, sem verbo. "36% Chefão" não diz que é a **vida** do chefão. No alerta, "Urban Coyotes · dobro até 02:30" usa jargão ("dobro" = pontos em dobro) e um horário, enquanto a zona mostra "17:30 para defender" (UX-09).
- (f) 1. **Bug:** depois de completar a missão de boas-vindas (corrida de 0,70 km com zona conquistada e "+100 XP" no Resumo), o Mapa **continua mostrando "MISSÃO 1 · Corra 500 m…"** com "Correr 500 m" aberto (`f1-20`). O card é estático e só sai quando a pessoa o fecha (`welcome-mission-card.tsx:27–40`, `onboarding-flow.ts:9,30`). Enquanto isso, ele também esconde o alerta de ataque (`map-screen.tsx`, `welcomeOn`) (UX-02). 2. Numa conta nova sem a 1ª sessão (`mapa__vazio`), o alerta de ataque ganha a vaga da missão inicial: quem tem 0 corridas é chamado para "defender" antes de aprender a correr (UX-32).
- (g) **3/5** · UX-01, UX-02, UX-04, UX-09, UX-31, UX-32.

### 2.10 Aba Correr (tela da aba) — `correr-aba__cheio.png`, `x-aba-correr-toque.png`
- (a) "Bora pintar a cidade?" e um 3º botão CORRER. A tela só existe porque a aba abre a Nova corrida "por cima" e, ao fechar, sobra esta tela de passagem.
- (b) CORRER, idêntico ao do Mapa.
- (c) **Duplicação pura.** É o sintoma mais visível do problema de navegação.
- (g) **1/5** · UX-01 (Alto).

### 2.11 Nova corrida — `nova-corrida__cheio.png`, `f1-14-nova-corrida.png`, `f1-15…simulacao.png`, `x-arena-modo-1.png`
- (a) Escolher o jogo, o sinal e a segurança, e "Começar".
- (b) "Começar", fixo embaixo. Correto.
- (c) "Corrida Segura" (interruptor) + "Contatos de segurança" (link, meio coberto pelo botão fixo): a segurança aparece em 2 controles.
- (d) "Corrida livre" e "Fuga" usam **o mesmo ícone de corredor**; "Caça" usa uma caixa. Na Arena, os mesmos modos usam a arte nova da E4 (`ModeIcon`: fantasma, baú com sinal). Dois jogos de ícones para os mesmos modos (UX-08).
- (e) O título da seção é **"Missão"**, mas os itens são **modos**. Contraria o glossário da D-74 ("missão é tarefa e modo é jogo") e confunde com a tela Missões. "Sinal: GPS real / Simulação (demonstração) · Volta no parque em 10×" é jargão técnico (só aparece na demonstração).
- (f) —
- (g) **3/5** · UX-08, UX-12.

### 2.12 Corrida ativa — `f1-16-contagem.png`, `f1-17-corrida-ativa.png`
- (a) Tempo enorme, km, ritmo e "54% Jardim Goiás 19 · Faltam ~240 m para conquistar". Muito bom.
- (b) "Segure para encerrar". Pausar (laranja) e SOS bem separados.
- (d) A faixa do território usa o `TeamBadge` (`run-screen.tsx:453`).
- (e) O banner de cima, "Território dos Neon Striders · **Pinte as ruas para virar**", tem a frase incompleta (virar o quê?) e o ícone de **alerta** (⚠) para uma informação neutra. "Escolta desligada" é um 3º nome para a Corrida Segura (UX-12). Os nomes de zona trazem número ("Jardim Goiás 19"), o que parece código e não lugar (UX-29).
- (g) **4/5** · UX-13, UX-12, UX-29.

### 2.13 Resumo — `f1-18-resumo*.png`, `resumo__cheio*.png`
- (a) "ZONA CONQUISTADA · Setor Pedro Ludovico 36", rota, 4 números e recompensas. Comemora bem.
- (b) "Compartilhar", fixo e laranja. "Concluir" é texto. Correto, como no Strava.
- (c) **Muita repetição na mesma tela:**
  - XP aparece 3 vezes: o chip "+293 XP", o card "Nível 3 · +293 XP" e "Total 293 XP";
  - o nível aparece 2 vezes: "Nível 3" com barra e "Nível 3! Recruta do Asfalto" com outra barra;
  - a zona do título repete num chip;
  - "Missão +170" na conta e as 3 missões listadas logo abaixo.
- (d) "Nível 3" ao lado do `TeamBadge` (`summary-screen.tsx:336`); zonas conquistadas com o `TeamBadge` (`:386`).
- (e) "Território +81 pts" aqui, "+1.130 pontos" em Atividades e "+1130 pts" no Resumo cheio: unidade e separador de milhar diferentes. "1 baú guardado. **Abrem** com 1 km." tem erro de concordância. "1 de 2 na semana · Mais 1 atividade garante a semana. Caminhar vale." mistura "corrida" e "atividade" (UX-15).
- (f) **O nível do Resumo não bate com o do Você** (UX-03).
- (g) **3/5** · UX-03, UX-10, UX-04, UX-15.

### 2.14 Compartilhar (card da corrida) — `f1-19-compartilhar*.png`, `compartilhar__cheio*.png`
- (a) Prévia do card em 9:16, modelos (Nível novo / Conquista de zona / Corrida), formato (Stories / Feed / Adesivo). Bom.
- (b) "Baixar imagem" (na web; no aparelho é "Compartilhar"). Correto.
- (c) —
- (e) O card de "Nível novo" diz "1 KM NO TOTAL" para uma corrida de 0,70 km: o arredondamento desmente o Resumo. Depois da 1ª corrida, o modelo padrão é "Nível novo", não "Conquista de zona", que é o momento mais forte (UX-33).
- (f) O interruptor "Mostrar rota" fica escondido sob o rodapé fixo.
- (g) **4/5** · UX-33.

### 2.15 Minha semana (recap) — `x-atividades-recap.png`, `compartilhar-semana__cheio*.png`, `compartilhar-semana__vazio.png`
- (a) Card bonito: km, barras por dia, 2 mini-rotas, sequência.
- (b) "Baixar imagem". Correto.
- (f) **Só se chega aqui pelo botão dentro de Atividades** (Você → Corridas → Compartilhar minha semana: 3 toques). Nenhuma chamada no Mapa, no Resumo ou no domingo (UX-17). O estado vazio não tem arte e tem duas saídas ("Voltar" e X), sem "Correr" (UX-28).
- (g) **4/5** (cheio) · **2/5** (vazio) · UX-17, UX-28.

### 2.16 Arena — `arena__cheio*.png`, `arena__vazio.png`, `x-arena-raid-toque.png`, `x-arena-ajuda.png`, `x-arena-missao-toque.png`
- (a) Chefão da semana (Soneca), missões de hoje, modos e liga. Herói forte.
- (b) **Não há ação principal.** O card do chefão não tem botão, e **tocar nele não faz nada** (`x-arena-raid-toque` = a mesma tela). "Sua parte 2%" não diz como aumentar. Quem acabou de ver o chefão não sabe que é só correr (UX-11).
- (c) "Missões de hoje" repete a tela Missões (aceitável como prévia, com "Ver todas").
- (d) Os modos usam a arte nova (`ModeIcon`), diferente da Nova corrida (UX-08). "Domínio" e "Atlas" levam ao Mapa, e não a uma explicação.
- (e) Missões cortadas com "…" ("Termine à frente do …", "Defenda uma zona sob …") (UX-11). "Liga Rua · 17º de 30 · **top 5** sobe": inglês, e "Liga Rua" parece nome incompleto. "Fase 2" sem explicação.
- (f) **A Liga não tem tela:** é um card sem toque e sem destino. O "Como jogar" (?) explica só Corra/Pinte/Defenda: nada sobre chefão, liga, baú ou missão.
- (g) **3/5** · UX-11, UX-08, UX-07, UX-19.

### 2.17 Missões — `missoes__cheio*.png`, `missoes__vazio.png`, `f1-22-missoes-depois-da-1a-corrida*.png`
- (a) Primeira semana (1/7), Hoje (3) e Esta semana (3), com anéis de progresso.
- (b) Só a "Primeira semana" tem ação ("Correr" ou "Caçar"). As missões do dia **não têm "Ir"**, só "Trocar" (UX-27).
- (c) —
- (e) "Revele 5 trechos novos do Atlas": jargão em dobro ("trechos" e "Atlas"). A etiqueta "Leve" não diz nada. "33,3%" com casa decimal. "1/7 · prêmio: moldura Primeira Semana". Na conta vazia, a barra de 0/7 aparece parcialmente cheia.
- (f) Fica escondida: Você → Missões, ou Arena → Ver todas (2 toques). O Mapa só mostra o chip de missão quando há uma "em destaque" (UX-17).
- (g) **3/5** · UX-27, UX-07, UX-17.

### 2.18 Recompensas — `recompensas__cheio*.png`, `recompensas__vazio.png`, `x-mapa-chip-hoje-1.png`
- (a) Nível, baú do dia, trilha do mês e cosméticos. Muita informação.
- (b) "Resgatar" (degrau 22) e "Abrir baú" disputam com "Pausar" e "Ver os 24 degraus".
- (c) A sequência ("2 semanas seguidas", com "Pausar") repete Atividades e o chip do Mapa. "Pausar" aqui é a mesma "Pausa de saúde" dos Ajustes, com outro nome (UX-16).
- (e) **Sistemas demais numa tela:**
  - Nível 6 "Pé na Rua";
  - "Faixa Prata · 8 km para Ouro";
  - Trilha de outubro com degraus;
  - Cosméticos;
  - sequência;
  - a tabela "Chances" com "5% item / 30% item".

  "Faixa" não é explicada em lugar nenhum (UX-07). O chip "2 Baús" do Mapa traz para cá, mas o baú é o 2º bloco (embaixo do nível).
- (f) **O nível daqui (6) não bate com o do Você (5)** (UX-03).
- (g) **3/5** · UX-03, UX-07, UX-16.

### 2.19 Clube — `clube__cheio*.png`, `clube__vazio.png`, `x-clube-feed-toque.png`
- (a) Card da crew (Flamboyant Runners, 115 km de 60 na semana), feed de corridas e ranking.
- (b) Não fica claro. Toque no card da crew? Reagir? No vazio, sim: "Entrar ou criar crew" (bom).
- (c) O feed também existe como rota própria (`/compartilhar/feed`). O ranking "Temporada" da crew repete o ranking geral.
- (d) `TeamBadge` geométrico no avatar do feed, no pódio e nas linhas do ranking (`club-screen.tsx:324,365`). O emblema da crew é o novo, então os dois estilos aparecem na mesma tela. A reação **"Raio" tem ícone de bandeira**.
- (e) Depois de reagir, os rótulos somem e ficam só os números ("♡ Bora! 2 · 🔥 1 · ⚑ 1"). Sem o texto, o ⚑ não diz nada. "[FLR]", "[PCG]" e "[VLT]" são siglas soltas. "−8,1 km no chefão" é ambíguo. Os chips de filtro do ranking cortam ("S…").
- (f) O ranking só aparece depois de 5 cards de feed, na **6ª rolagem**. O feed não tem "ver mais" nem limite (UX-21).
- (g) **3/5** · UX-04, UX-21.

### 2.20 Crew — `clube-crew__cheio*.png`, `x-clube-crew-sair.png`
- (a) Emblema, código grande, convite e ranking da temporada.
- (b) "Compartilhar convite". Correto.
- (c) "Copiar código" e "Copiar link" ao lado de "Compartilhar convite". O texto do convite mostra a **URL inteira** (`http://127.0.0.1:8211/compartilhar/convite/DEMOFLR1`), que quebra em 3 linhas. "Copiar código" quebra em 2 linhas a 390 px (UX-35).
- (d) Ranking com `TeamBadge` (`crew-screen.tsx:124`).
- (g) **4/5** · UX-35, UX-04.

### 2.21 Feed da crew (rota) — `compartilhar-feed__cheio*.png`
- (a) Título duplo: "Feed da crew" (cabeçalho) e "Corridas da crew" (título grande), com X.
- (c) É o mesmo conteúdo do Clube.
- (g) **3/5** · UX-22 (Baixo).

### 2.22 Convite (página de quem recebe) — `convite__cheio.png`
- (a) "Bora correr junto?", com código e instruções. Clara.
- (b) "Copiar código" (laranja) vem antes de "Abrir o NOMADE RUN". A ordem natural seria abrir primeiro. Baixo.
- (g) **4/5**.

### 2.23 Você — `voce__cheio.png`, `voce__vazio.png`, `f1-21-…`, `x-voce-*.png`
- (a) Cartão do jogador (mascote, nível, XP), 3 números, medalhas e uma lista (Corridas, Meu time, Missões, Recompensas). Boa hierarquia.
- (b) Não há ação primária. Aceitável para um perfil.
- (c) —
- (d) Medalhas sem nome; tocar nelas não faz nada (`x-voce-medalhas-toque`). Os ícones "Missões" (troféu) e "Recompensas" (baú) estão bem.
- (e) "Atlas 23 · % do bairro": que bairro? "Corridas" abre uma tela chamada **"Atividades"** (UX-15).
- (f) **O nível diverge do Resumo e de Recompensas** (UX-03). A engrenagem dos Ajustes, pequena no topo, é o único caminho para Conta, Segurança, Privacidade, Lembretes e Sair.
- (g) **4/5** · UX-03, UX-15, UX-34.

### 2.24 Ajustes — `voce-ajustes__cheio*.png` (5 rolagens), `x-ajustes-pausa-folha.png`, `x-ajustes-convite-app.png`, `x-ajustes-sair.png`
- (a) Lista longa: Conta, Corrida Segura, Privacidade, Jogo, Lembretes (9 interruptores e 2 horários), Dados de uso, Convidar amigos, Sair.
- (c) **Duplicações:**
  - **notificações em 3 lugares:** a linha "Notificações" daqui, "Lembretes" daqui e "Notificações" (4 interruptores) dentro de **Editar perfil**;
  - "Convidar amigos" daqui e o convite da crew;
  - "Sair" daqui e "Sair" em Conta e privacidade (UX-16).
- (e) "Corrida Segura" é a seção, "Escolta ao vivo" é o interruptor e "Alerta de parada" é outro: 3 nomes (UX-12). "Pular celebrações" está ok.
- (f) "Sair" desconecta **na hora, sem confirmar** (`x-ajustes-sair` cai em Boas-vindas). Interruptores com bolinha verde-azulada sobre trilho laranja, uma combinação de cor estranha.
- (g) **2/5** · UX-16, UX-12, UX-36.

### 2.25 Atividades — `voce-atividades__cheio*.png`, `voce-atividades__vazio.png`, `x-voce-atividades-toque.png`
- (a) "12,2 km esta semana", barras por dia, sequência, "Compartilhar minha semana" e a lista de corridas. Muito boa.
- (e) "Semana garantida. 1 congelamento.": jargão ("congelamento" = proteção da sequência). Título "Atividades", lista "Corridas", entrada "Corridas" (UX-15).
- (f) **Vazio errado para conta nova:** "Nada neste período · Escolha um período maior" quando não há nenhuma corrida, e "Compartilhar minha semana" ativo com 0 km (UX-14).
- (g) **4/5** (cheio) · **2/5** (vazio) · UX-14, UX-15.

### 2.26 Rota `/atividades` (antiga) — `atividades-raiz__cheio*.png`
- Redireciona e mostra a mesma tela. Ok.

### 2.27 Meu time — `voce-time__cheio.png`, `x-voce-time-trocar.png`
- (a) O seu time com o mascote; "Trocar de time" com os outros 3.
- (d) **O símbolo antigo está aqui, lado a lado:** o seu time é mascote; Urban Coyotes, Night Owls e Volt Runners são bolinhas geométricas (`faction-screen.tsx:140`). É o caso mais visível do que o dono apontou (UX-04).
- (e) Os lemas não batem com o onboarding: Volt é "Resistência sem fim" aqui e "Resistência e distância" lá; Coyotes é "Correm em matilha" aqui. "Lume · líder Íris Valente": "Lume" (o nome do mascote) não é apresentado em lugar nenhum (UX-30).
- (g) **3/5** · UX-04, UX-30.

### 2.28 Editar perfil — `voce-editar__cheio*.png`
- (b) "Salvar alterações" fixo. Correto.
- (c) Tem a seção "Notificações" (Invasões, Conquistas, Missões, Moderação), que pertence aos Ajustes (UX-16).
- (g) **3/5**.

### 2.29 Conta e privacidade — `voce-conta__cheio*.png`
- (e) "**Índice de confiança: 100**" sem contexto (parece nota de crédito). "JSON com perfil, corridas, trajetos de GPS…" é jargão de desenvolvedor (UX-24).
- (c) "Sair" duplicado com Ajustes.
- (g) **3/5** · UX-24, UX-16.

### 2.30 Contatos de segurança / Zonas de privacidade — `contatos-seguranca__*.png`, `zonas-privacidade__*.png`
- Contatos:
  - (b) "Adicionar contato" é a ação da tela, mas vem em estilo **secundário** (contorno) (UX-26);
  - (e) "Eles recebem sua localização no SOS, na Escolta e se você parar por 10 min." é claro.
- Zonas de privacidade:
  - (e) mostra **coordenadas cruas** ("Raio de 200 m · -16.70161, -49.25344", com ponto decimal); "A 200 m deles, sua rota vale pontos, mas ninguém vê." não deixa claro a quem "deles" se refere (UX-23).
- (g) **3/5** cada.

### 2.31 Notificações — `notificacoes__cheio.png`, `notificacoes__vazio.png`
- (a) Agrupadas por Hoje, Ontem e Esta semana, com ação clara ("Corra lá…"). O vazio "Tudo calmo por aqui" tem o mascote dormindo. Ótima.
- (e) "Alerta de Invasão!" usa caixa de título (o resto do app usa caixa de frase). "Corra lá nas próximas 24h" é o 3º formato de prazo (UX-09).
- (g) **4/5** · UX-09.

### 2.32 Zona (folha) — `zona__cheio.png`, `zona__sob-ataque.png`, `zona__vazio.png`, `x-mapa-alerta-toque.png`
- (a) Mascote do dono, placar "Striders 13 × 12 Coyotes", relógio e "Defender esta zona". Muito clara.
- (b) "Defender esta zona" (laranja, com escudo). Correto.
- (d) Placar e histórico com o `TeamBadge` pequeno (`zone-sheet.tsx:91,100,195,269,287`). "Ver histórico" usa o ícone de corredor.
- (e) "**17:30** para defender" parece horário (17h30), mas são 17 h 30 min restantes. No Mapa o mesmo prazo é "até 02:30" (UX-09).
- (g) **4/5** · UX-09, UX-04.

### 2.33 Moderação (papel moderador) — `moderacao__moderador.png`, `moderacao-detalhe__moderador.png`, `moderacao-contas__moderador.png`
- (e) "Índice de confiança abaixo de 40 **(RN-009)**": código de requisito exposto na interface (UX-25). O bloco "Como revisar" é um parágrafo de 4 linhas (para o moderador, aceitável).
- (g) **3/5** · UX-25.

### 2.34 Estados globais — `*__erro.png`, `*__offline.png`, `*__erro-quente.png`, `*__offline-quente.png`, `*__carregando.png`, `rota-inexistente__cheio.png`
- **Erro ou offline numa abertura a frio (sem perfil em cache):**
  - qualquer aba vira "Não deu para abrir seu perfil", com "Tentar de novo" e "Sair da conta";
  - os estados de erro e offline de cada tela, que existem no código, nunca aparecem;
  - "Sair da conta" como 2ª opção, justamente quando não há rede, é perigoso: deslogar sem rede pode perder corridas não sincronizadas (UX-05, ver nota em §6).
- **Com o perfil em cache (`*-quente`):** ver §2.34.1.
- **Carregando:**
  - na web, o app fica **branco** enquanto o JavaScript carrega (o `index.html` não tem o fundo escuro; no aparelho é a splash) (UX-37, Baixo);
  - com o app montado e os dados chegando (`*__carregando.png`, cenário `lento`, 3,3 s), a Arena mostra esqueletos (bom);
  - o **Você mostra "0,0 km · 0 zonas · 0 de 4"** enquanto carrega, o mesmo problema dos zeros falsos do offline (UX-38).
- **404:** "**Unmatched Route** · Page could not be found · Go back · Sitemap", **em inglês** e com o visual padrão do Expo. Falta `src/app/+not-found.tsx` (UX-06).

#### 2.34.1 Erro e offline com perfil em cache (`*__erro-quente.png`, `*__offline-quente.png`)

Simula um celular que já abriu o app antes.

- **Offline: o Mapa funciona.** Mostra "Sem internet: último mapa salvo", o alerta em cache e o CORRER (`mapa__offline-quente`). Muito bom.
- **Erro do servidor (503): o app inteiro trava**, mesmo com o perfil em cache (`mapa__erro-quente`, `arena__erro-quente`). Com o servidor fora do ar, ninguém corre. O offline tem caminho; o erro não tem (UX-05).
- **Zeros falsos offline:** o Você mostra "0,0 km · 0 zonas · 0 de 4 medalhas" ao lado de "nível 5", sem aviso de que está sem rede (`voce__offline-quente`). Atividades mostra "0,0 km · 0 semanas seguidas" no herói, e o "Sem conexão" fica numa linha pequena embaixo. A Arena mostra "Domínio 0 zonas · Atlas 0%". Quem abrir sem sinal acha que **perdeu o progresso** (UX-38).
- **Cinco jeitos de dizer "sem conexão":**
  - linha de status (Mapa);
  - ilustração com botão laranja (Missões);
  - card com botão contorno (Arena, crew);
  - título grande em negrito (ranking do Clube);
  - esqueleto que nunca termina embaixo do erro (Recompensas, `recompensas__offline-quente`).

  Um só componente de erro e offline resolve (UX-38).

## 3. Fluxos completos (toques e telas até cada momento de valor)

Contagem do `auditar-telas.cjs` (`textos.json` → `toques`). Cada campo de formulário conta 1 toque.

| Momento de valor | Toques | Telas | Observação |
|---|---:|---:|---|
| Primeira abertura → **Mapa com meu time** | **12** | 7 | Boas-vindas (1) → Cadastro (4 campos + aceite + Criar = 6) → Cidade (1) → Time (1 + Entrar 1) → Confirmação (1) → Localização (1). Meta D-72: ≤ 90 s, cumprida. Líder e quiz são opcionais (+2 a +5). |
| Mapa → **correndo** | **+3** (15) | 2 | Card da missão ou CORRER (1) → Nova corrida (escolher o sinal só na demonstração; no aparelho, 0) → Começar (1) → contagem. **No aparelho, 2 toques.** |
| Correndo → **Resumo** | **+1** (16) | 1 | Segurar para encerrar. |
| Resumo → **card compartilhado** | **+2** (18) | 1 | Compartilhar → Baixar ou Compartilhar. |
| Resumo → Mapa | +1 | — | "Concluir" volta ao Mapa **com a missão já cumprida ainda aberta** (UX-02). |
| **Dia 2:** abrir → ver missões | 2 | 2 | Você → Missões, ou Arena → Ver todas. Sem chip fixo no Mapa. |
| **Dia 2:** abrir → abrir baú | 2–3 | 2 | Chip "Baú" → Recompensas → rolar até o baú → Abrir (o baú abre com 1 km). |
| **Dia 2:** ver a sequência | 0 | 1 | Chip "2/2 Semana" no Mapa (bom), mas o toque leva a Recompensas, onde a sequência é a 3ª linha do 1º card. |
| Arena → **chefão** | 1 | 1 | Vê o chefão; **não há como agir a partir dele** (UX-11). |
| Arena → **liga** | — | — | **Beco sem saída:** a liga é um card sem destino. |
| Clube → **crew** → convite | 2 | 2 | Card da crew → Compartilhar convite. |
| Clube → **ranking** | 1 + 5 rolagens | 1 | Escondido embaixo do feed (UX-21). |
| Você → **recap da semana** | 3 | 3 | Você → Corridas → Compartilhar minha semana (UX-17). |
| Você → **Ajustes → Sair** | 2 + 4 rolagens | 2 | Sai sem confirmar. |

**Becos sem saída e voltas desnecessárias:**
- tela da aba Correr (3º CORRER);
- card do chefão sem toque;
- card da Liga sem destino;
- medalhas sem detalhe;
- "Domínio" e "Atlas" da Arena levam ao Mapa sem explicar;
- "Minha semana" vazia sem "Correr";
- a 404 em inglês.

**Grep de placeholders no `src/`** (`em breve`, `placeholder`, `TODO`, `provisório`):
- nenhum `TODO` ou `FIXME` no código de produção;
- "Em breve" só nos estados `unavailable` (servidor antigo ou flag desligada), conforme D-76:
  - `features/engagement/rewards-screen.tsx:89,241,377`;
  - `features/engagement/missions-screen.tsx:207`;
  - `features/social/feed/crew-feed.tsx:93`;
  - `features/screens/arena-screen.tsx:270` ("Liga em breve");
  - `components/mode-card.tsx:42` (variante `soon`, sem uso hoje);
- "Texto provisório da frase do líder" fica só em `app/dev/motion.tsx:234` (rota de desenvolvimento);
- `features/social/card/card-parts.tsx:92` ainda chama o selo geométrico de "marcador provisório do mascote", o que confirma UX-04.

**Recomendação:** antes da banca, conferir que nenhuma flag do Cloud deixa um "em breve" visível no roteiro de apresentação (é dependência de deploy, `DEPLOY.md` §10).

## 4. Arquitetura de navegação

### 4.1 O Correr duplicado: manter **só o CORRER grande do Mapa** e tirar a aba Correr

**Recomendação:** 4 abas, **Mapa · Arena · Clube · Você**. O CORRER de 72 pt do Mapa passa a ser o único "começar corrida" genérico. Os pontos de partida com contexto continuam, porque não são duplicados (cada um já escolhe o jogo):
- "Defender esta zona" (folha da zona);
- Fuga e Caça (Arena → Modos);
- "Correr" e "Caçar" (Missões);
- "Correr" (estados vazios).

**Por quê:**
1. **A aba não se comporta como aba.** Ela abre um modal e deixa para trás uma tela-fantasma com um 3º botão. Isso quebra o modelo mental de "aba = lugar" (HIG e Material).
2. **No celular, a aba não pode ser o botão dominante.** NativeTabs não deixa elevar o item central (D-73). No iOS ela é um ícone laranja do mesmo tamanho dos outros, ou seja, o botão principal fica mais fraco que o do Mapa.
3. **O Mapa é onde a corrida faz sentido.** Correr = pintar território. O Pokémon GO põe a ação principal sobre o mapa, e o Mapa já é a 1ª aba e a tela de "volta ao app" (D-72).
4. **"Correr a 1 toque a partir do Mapa"** (regra da E6) continua valendo. De Arena, Clube ou Você, são 2 toques (aba Mapa → CORRER), ou 1 pelo atalho contextual (Fuga/Caça na Arena, Correr nas Missões).
5. Uma barra com 4 abas é mais fácil de ler que uma com 5, e o Você ganha espaço.

**O que muda:**
- `components/app-tabs-config.tsx` sai com a entrada `correr` (`:33`);
- `components/app-tabs.tsx:35` e `app-tabs.web.tsx:26` deixam de ter o círculo;
- `app/(tabs)/correr.tsx` e `components/app-tabs-correr.tsx` são apagados;
- `/correr` passa a redirecionar para `/corrida` (links antigos);
- `tabBarClearance` é revisto;
- testes de abas e o e2e (`demo-mode-flow`, Maestro) são atualizados;
- **nova decisão D-xx substitui a D-73.**

**O que o Mapa mostra:** o mesmo de hoje, mas com o card acima do CORRER sempre útil:
- 1 vaga de alerta, com prioridade: ataque → missão em andamento → baú pronto → chefão → recap de domingo;
- a missão de boas-vindas sai sozinha ao ser cumprida (UX-02).

**Alternativa (se a equipe quiser manter 5 abas):** manter a aba Correr e **tirar o botão grande do Mapa**, que passaria a mostrar só o card contextual. Desvantagens:
- no aparelho, a ação mais importante vira um ícone de aba comum;
- a tela-fantasma continua (a aba precisa de uma tela);
- foge do "Mapa = herói + 1 ação" da F1.

Não recomendo.

### 4.2 Barra de abas

| Aba | Fica | Ajuste |
|---|---|---|
| Mapa | sim | herói; CORRER único; chip "Missões x/3" sempre visível (hoje só aparece com missão "em destaque") |
| Arena | sim | ganha uma ação: "Correr contra o Soneca" no card do chefão; a Liga ganha folha ou tela |
| Clube | sim | ranking antes do feed, ou um seletor "Feed · Ranking" no topo |
| Você | sim | entrada de recap e atalho de Missões no cartão (ver 4.3) |

### 4.3 Onde entram compartilhar, recap e missões (para não ficarem escondidos)

- **Compartilhar corrida:**
  - continua sendo a ação principal do Resumo (bom);
  - acrescentar "Compartilhar" no menu de cada corrida em Atividades e no card do feed ("Você · Ontem").
- **Recap da semana:**
  - a partir de sexta, um alerta no Mapa: "Sua semana: 12,2 km · Compartilhar";
  - uma notificação no domingo (já existe em Lembretes → "Resumo da semana");
  - e o botão de Atividades, que já existe.
- **Missões:**
  - chip fixo no Mapa ("🏆 1/3 hoje");
  - "Missões de hoje" na Arena (já existe);
  - cada missão com o botão "Ir", que abre a Nova corrida com o modo certo.
- **Recompensas:** pelo chip "Baú" e pelo cartão do Você (já existe). Dentro da tela, o baú vem **antes** do nível.
- **Ajustes:**
  - quebrar em 4 linhas: Conta · Segurança na corrida · Privacidade · Lembretes, cada uma com a sua tela;
  - "Sair" só em Conta, e com confirmação.

## 5. Comparação com 3 referências (só o aplicável)

> Referências pelo conhecimento público dos apps (sem captura nesta tarefa).

| Ponto | Strava | Nike Run Club | Pokémon GO | NOMADE RUN hoje | O que levar |
|---|---|---|---|---|---|
| **Barra de abas** | 5 abas; "Gravar" é uma aba comum que abre o gravador | 5 abas; "Correr" é a tela da corrida (não abre modal) | Sem barra: o mapa é a casa, com 1 botão central (Poké Ball) e o avatar no canto | 5 abas + Correr que abre modal e deixa uma tela-fantasma | Ou a aba **é** a corrida (NRC), ou não há aba e o mapa é a casa (GO). Nunca as duas coisas. → 4.1 |
| **Botão principal** | Um "Iniciar" grande dentro do gravador | "Iniciar" redondo e enorme na aba Correr | Ação sobre o mapa (toque no Pokémon) | CORRER do Mapa (bom) + aba + card + tela da aba | 1 botão dominante por tela (já é regra da E6) |
| **Primeira tela** | Feed de amigos | Home com o plano e o "Correr" | Mapa vivo com o avatar | Mapa vivo com o time, chips e CORRER (bom) | Manter. Corrigir a missão que não some. |
| **Perfil** | Números da semana, troféus e atividades em lista | Nível por cor (amarelo → preto), conquistas com nome | Cartão do treinador, medalhas com nome e progresso, tocáveis | Cartão com mascote (bom); medalhas mudas; nível divergente | Medalhas tocáveis com nome e "como ganhar"; **um** nível só |
| **Celebração** | Conquistas e recordes no fim da atividade, num cartão por vez | Animação de recorde e troféu, com voz | Tela cheia por evento (captura, nível, medalha), uma por vez, sempre com "OK" | Resumo empilha zona + XP 3× + nível 2× + missões + baú + sequência | **Uma** celebração de cada vez (zona → nível → baú); o resto em "Ver detalhes" |

## 6. Lista priorizada de correções

Esforço: **P** ≤ ½ dia · **M** 1–2 dias · **G** > 2 dias. Dono pela seção 18 do prompt (E6 telas, E7 engajamento e progressão, E8 social, E4 arte). E3 (domínio) aparece quando a regra mora em `src/domain`.

| id | Tela | Problema | Correção proposta | Dono | Esf. | Sev. | Captura |
|---|---|---|---|---|---|---|---|
| UX-01 | Mapa, abas | Correr em 3 lugares (aba, botão do Mapa, tela da aba) | Tirar a aba Correr (4 abas), apagar `RunTabScreen` e redirecionar `/correr` → `/corrida`; nova D-xx no lugar da D-73 | E6 | M | **Alto** | `mapa__cheio`, `correr-aba__cheio`, `x-aba-correr-toque` |
| UX-02 | Mapa | Missão de boas-vindas continua aberta depois de cumprida e esconde o alerta | Ligar o card ao estado real (corridas ≥ 1 e zona) e tirá-lo sozinho ao concluir, com celebração "Missão 1 feita"; `welcome-mission-card.tsx:27–40`, `onboarding-flow.ts:30` | E6 + E7 | P | **Alto** | `f1-20-depois-concluir` |
| UX-03 | Resumo, Você, Recompensas, card | Dois níveis diferentes (3 × 2; 5 × 6): `levelFromXp` (`domain/games.ts:184`) × `levelProgress` (`domain/progression.ts:141`) | Uma curva só (a da v2, `progression`) e uma fonte de XP; trocar em `profile-screen.tsx:59`, `summary-screen.tsx:194` e no card de compartilhar | E7 (+E3) | M | **Alto** | `f1-18-resumo`, `f1-21`, `voce__cheio`, `recompensas__cheio` |
| UX-04 | 15 componentes | `TeamBadge` geométrico ao lado do mascote/emblema (Boas-vindas, Entrar, Mapa, Corrida, Resumo, Zona, Clube, Crew, Feed, Meu time, Moderação) | Trocar por `TeamEmblem compact` (≥ 24 pt) ou pela cabeça do mascote; manter a forma **dentro** do emblema (daltonismo). Prioridade: Meu time, Mapa, Resumo, Boas-vindas/Entrar, ranking | E4 (variante pequena) + E6 | M | **Alto** | `voce-time__cheio`, `mapa__cheio`, `boas-vindas__…`, `clube__cheio--6` |
| UX-05 | Global | Erro do servidor (503) trava o app inteiro em "Não deu para abrir seu perfil" **mesmo com o perfil em cache** (o offline funciona), com "Sair da conta" como saída | Tratar o 503 como o offline: abrir com o perfil em cache e um aviso; Nova corrida sempre disponível (a corrida já é offline-first); tirar "Sair da conta" deste estado | E6 (+E9 sessão) | M | **Alto** | `mapa__erro-quente`, `arena__erro-quente`, `mapa__offline-quente` |
| UX-06 | 404 | "Unmatched Route" em inglês | Criar `src/app/+not-found.tsx` com arte vazia, "Essa página não existe" e o botão "Voltar ao mapa" | E6 | P | **Alto** | `rota-inexistente__cheio` |
| UX-07 | Recompensas, Arena, Missões | Progressão demais e sem explicação: nível, título, faixa, trilha, liga, sequência, congelamento, medalha, cosmético, pontos e XP | Glossário visual (folha "O que é?" em cada termo); esconder "Faixa" até a liga existir; "Como jogar" com 6 cartões (+ chefão, missões, baú) | E7 + E6 | M | Médio | `recompensas__cheio`, `arena__cheio--2` |
| UX-08 | Nova corrida, Arena | "Missão" como título dos modos (fere a D-74); Livre e Fuga com o mesmo ícone; ícones diferentes da Arena | Título "Modo"; usar `ModeIcon` da E4 nos 3 cards da Nova corrida | E6 | P | Médio | `nova-corrida__cheio`, `arena__cheio--2` |
| UX-09 | Zona, Mapa, Notificações | Prazo em 3 formatos ("17:30 para defender", "dobro até 02:30", "24h") | Um formato: "Faltam 17 h 30 min" (contagem) ou "até 02h30" (horário), com "pontos em dobro" por extenso | E6 | P | Médio | `zona__cheio`, `mapa__cheio`, `notificacoes__cheio` |
| UX-10 | Resumo | XP 3×, nível 2×, zona 2×, "pts" × "pontos" | Um herói (zona ou distância), 4 números, **um** bloco de recompensas; tirar os chips repetidos; "pontos" com separador de milhar | E6 + E7 | M | Médio | `f1-18-resumo*`, `resumo__cheio*` |
| UX-11 | Arena | Chefão sem ação (o toque não faz nada); Liga sem destino; missões cortadas com "…" | Botão "Correr contra o Soneca" no card; folha da Liga (grupo, quem sobe, prazo); cards de missão com 2 linhas sem cortar | E6 + E7 | M | Médio | `x-arena-raid-toque`, `arena__cheio--2` |
| UX-12 | Nova corrida, Corrida, Ajustes | Corrida Segura, Escolta ao vivo e Alerta de parada: 3 nomes | Um nome-guarda-chuva, "Corrida Segura", com 2 opções: "Compartilhar ao vivo" e "Avisar se eu parar"; o chip da corrida diz "Corrida Segura ligada/desligada" | E6 | P | Médio | `f1-17`, `voce-ajustes__cheio` |
| UX-13 | Corrida ativa | Banner "Pinte as ruas para virar" (frase incompleta) com ícone de alerta | "Zona dos Neon Striders · corra aqui para ajudar" (ou "…para virar Volt") e o ícone do time, não ⚠ | E6 | P | Médio | `f1-17-corrida-ativa` |
| UX-14 | Atividades (vazio) | "Nada neste período · Escolha um período maior" para quem nunca correu; compartilhar a semana com 0 km | Vazio "Sua 1ª corrida aparece aqui" + "Correr"; esconder "Compartilhar minha semana" com 0 km | E6 + E8 | P | Médio | `voce-atividades__vazio` |
| UX-15 | Você, Atividades, Resumo, Missões | "Corridas" abre "Atividades"; corrida × atividade × caminhada | Título e entrada "Atividades"; texto padrão "atividade (corrida ou caminhada)" no glossário da D-74 | E6 + E7 | P | Médio | `voce__cheio`, `x-voce-atividades-toque` |
| UX-16 | Ajustes, Editar perfil, Conta, Recompensas | Notificações em 3 lugares; "Sair" 2×; "Convidar" 2×; "Pausar" × "Pausa de saúde" | Ajustes em 4 telas (Conta · Segurança · Privacidade · Lembretes); notificações só em Lembretes; Sair só em Conta, com confirmação; um nome: "Pausa de saúde" | E6 (+E7 lembretes) | M | Médio | `voce-ajustes__cheio*`, `voce-editar__cheio--2`, `voce-conta__cheio` |
| UX-17 | Mapa, Você | Missões e recap escondidos (2–3 toques, sem chamada) | Chip fixo de Missões no Mapa; alerta de recap na sexta e no domingo; "Ir" em cada missão | E6 + E7 + E8 | M | Médio | `mapa__cheio`, `x-atividades-recap` |
| UX-18 | Confirmação do time | "Bora correr" leva à permissão de GPS | "Continuar" (ou "Ligar o GPS"); tirar a faixa escura atrás do nome do time | E6 | P | Baixo | `f1-11-confirmacao` |
| UX-19 | Arena → Como jogar | "Como jogar" explica só Corra/Pinte/Defenda; nada de chefão, missões, baú ou liga | Mais 3 cartões com arte da E4 (Chefão, Missões e baú, Liga); abrir sozinho na 1ª visita à Arena | E6 + E4 | P | Baixo | `x-arena-ajuda` |
| UX-20 | Boas-vindas | Sem herói do jogo (4 bolinhas e o wordmark em texto) | 4 mascotes correndo, ou o mapa dividido, e o `Logo` da E4 | E4 + E6 | M | Médio | `boas-vindas__primeira-abertura` |
| UX-21 | Clube | Ranking na 6ª rolagem; "Raio" com ícone de bandeira; rótulos somem depois de reagir; filtros cortados | Seletor "Corridas · Ranking" no topo; feed limitado a 3 com "Ver tudo"; ícone de raio; rótulo sempre visível | E8 | M | Médio | `clube__cheio*` |
| UX-22 | Feed da crew (rota) | Título duplo e conteúdo igual ao Clube | Um título só; avaliar se a rota precisa existir (só para o deep link) | E8 | P | Baixo | `compartilhar-feed__cheio` |
| UX-23 | Zonas de privacidade | Coordenadas cruas; "A 200 m deles" | Nome do endereço (ou "Perto de …"); "Num raio de 200 m destes endereços, ninguém vê sua rota" | E6 | P | Baixo | `zonas-privacidade__cheio` |
| UX-24 | Conta | "Índice de confiança: 100" e "JSON" | "Corridas sem suspeita ✓" (o número fica em "Ver mais"); "Baixar meus dados (arquivo)" | E6 | P | Baixo | `voce-conta__cheio` |
| UX-25 | Moderação | "(RN-009)" na interface | Tirar o código de requisito | E6 | P | Baixo | `moderacao__moderador` |
| UX-26 | Contatos de segurança | Ação principal em estilo secundário | "Adicionar contato" laranja (primário) | E6 | P | Baixo | `contatos-seguranca__cheio` |
| UX-27 | Missões | Missões do dia sem "Ir"; "Leve" sem sentido; "33,3%"; barra de 0/7 parcialmente cheia | Botão "Ir" (abre a Nova corrida com o modo); trocar "Leve" por "Fácil" (ou tirar); % inteiro; barra coerente | E7 | P | Médio | `missoes__cheio*`, `missoes__vazio` |
| UX-28 | Minha semana (vazio) | Sem arte, "Voltar" e X juntos, sem "Correr" | `EmptyArt` + "Correr" | E8 | P | Baixo | `compartilhar-semana__vazio` |
| UX-29 | Mapa, Corrida, Resumo | Zonas com número ("Jardim Goiás 59/60", "Setor Pedro Ludovico 35/36") | Nome + referência ("Jardim Goiás · perto do Estádio"), sem número; o número fica só como id interno | E6 (+E9 nomes) | M | Baixo | `resumo__cheio`, `f1-17` |
| UX-30 | Meu time, Onboarding | Lemas diferentes entre as telas; "Lume" sem apresentação | Uma fonte de texto por time (lema, mascote, líder) usada nas 2 telas; apresentar o nome do mascote no carrossel | E6 + E4 | P | Baixo | `voce-time__cheio`, `f1-10` |
| UX-31 | Mapa, Arena, Onboarding | "48 zonas em Goiânia" (do time) × "Domínio 0 zonas" (minhas); % da cidade dividida sem selo de demonstração; chips sem verbo | "Seu time: 48 zonas"; "Você: 0 zonas"; selo de demonstração no gráfico; "Chefão 36% de vida" | E6 | P | Médio | `mapa__cheio`, `arena__cheio--2`, `f1-04` |
| UX-32 | Mapa (conta nova) | Alerta de ataque toma a vaga da 1ª missão de quem tem 0 corridas | Com 0 corridas, a missão inicial vence o ataque na prioridade do alerta | E6 + E7 | P | Médio | `mapa__vazio` |
| UX-33 | Compartilhar | "1 KM NO TOTAL" com 0,70 km; modelo padrão "Nível novo" na corrida que conquistou zona | Mostrar 1 casa decimal abaixo de 10 km; modelo padrão = momento mais forte (zona > nível > corrida) | E8 | P | Baixo | `f1-19-compartilhar` |
| UX-34 | Você | Medalhas sem nome e sem toque | Medalha tocável → folha com nome, critério e progresso | E6 + E7 | P | Médio | `x-voce-medalhas-toque` |
| UX-35 | Crew | URL inteira no texto do convite; "Copiar código" quebra | Mostrar só o código; o link vai no compartilhamento; rótulo "Copiar" | E8 | P | Baixo | `clube-crew__cheio` |
| UX-36 | Ajustes | "Sair" sem confirmação; interruptor verde sobre laranja | Diálogo "Sair da conta?"; interruptor com uma cor de token (`action`) | E6 | P | Baixo | `x-ajustes-sair`, `voce-ajustes__cheio--3` |
| UX-38 | Você, Atividades, Arena, Recompensas, Clube | Offline **e carregando** mostram **zeros como se fossem dados** (0 km, 0 zonas, 0 medalhas); 5 padrões visuais de "sem conexão"; esqueleto infinito em Recompensas | Sem dado = "—" e uma faixa "Sem internet · mostrando o último salvo"; um componente `OfflineNotice` único; o esqueleto some quando há erro | E6 | M | **Alto** | `voce__offline-quente`, `voce-atividades__offline-quente`, `recompensas__offline-quente`, `clube__offline-quente`, `voce__carregando` |
| UX-39 | Recompensas → Cosméticos | Catálogo só em texto ("Faísca", "Cometa", "Rastro do mês bril…"): não dá para ver o que se ganha | Miniatura do rastro (traço colorido) em cada item; nome sem cortar | E4 + E7 | M | Baixo | `x-recompensas-cosmeticos-todos--2` |
| UX-37 | Web | Tela branca enquanto carrega | Fundo `#070708` no `+html.tsx` e uma marca centralizada | E6 | P | Baixo | `mapa__carregando` |

**Ordem sugerida para a F8:**
1. **UX-01, UX-02, UX-03, UX-04, UX-06** (o que a banca vê no roteiro);
2. **UX-05, UX-38, UX-09, UX-10, UX-11, UX-08, UX-12, UX-13** (coerência do loop principal e confiança nos dados);
3. o resto, por esforço.

## 7. O que já está bom (não mexer)

- Escolha do time (carrossel, líder, quiz): nota 5.
- Permissão de GPS (ilustração e garantia, botão único por regra da Apple).
- Corrida ativa: números grandes, "Faltam ~240 m para conquistar", SOS separado.
- Folha da zona: placar e "Defender esta zona".
- Notificações: agrupadas, com ação; o vazio tem o mascote dormindo.
- Estados vazios do Clube e das Notificações; "Como jogar" com arte.
- Marcação de demonstração em todo dado fictício (selo fixo + selos nos cards).
