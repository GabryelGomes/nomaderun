# F8 · 01 — Primeira experiência e retenção (pesquisa de produto e comportamento)

> **Fase:** 8 — Finalização 100% · **Data:** 30/10/2026 · **Equipe:** E1 — Pesquisa de produto e comportamento
> **Ponto de partida:** a F1 (`docs/melhoria/F1/01-pesquisa.md`) já cobriu Pokémon GO, Strava, Duolingo, Ingress, NRC, jogos de território, a ciência básica e os benchmarks de retenção. **Este documento não repete isso.** Ele vai mais fundo em três pontos: o **momento da escolha** (comparando 10 produtos), a **evidência de verdade** por trás de cada princípio e o **que falta no app v2 que já existe**.
> **O que o app já tem (conferido no código em 30/10/2026):**
> - Primeira abertura (D-72): boas-vindas → cadastro → nome → "A cidade está dividida" → carrossel com líder e quiz → cor do time inundando a tela → localização → Mapa com a missão de boas-vindas (2 de 3 passos já feitos).
> - Primeira semana com 7 passos, baú do dia, sequência semanal com congelamento e pausa, Raid semanal, Liga, escada de volta (7/14/21/30 dias), limite de 1 aviso por dia, filtro de palavras de culpa (`domain/reminders.ts`), feed da crew com "Bora!" e cards de compartilhar.
>
> **Como ler a força da evidência**
> - **[forte]**: ensaio randomizado, meta-análise, artigo revisado por pares ou dado oficial da empresa com método descrito.
> - **[fraca]**: imprensa especializada, análise de terceiros, dado oficial sem método, ou fonte única.
> - **[opinião]**: blog, análise de designer, guia de fã ou inferência da E1.
> - **[incerto]**: não confirmei na fonte primária.
>
> **Limite do ambiente:** o WebFetch não resolve a maior parte dos domínios aqui (testado com `support.zombiesrungame.com` e `ingress.wiki.gg`). Tudo veio de busca na web, lendo os trechos que a busca devolve. Por isso, contagens de toques e falas exatas de telas de terceiros **não foram medidas**: onde aparecem, estão marcadas como estimativa.

---

## Resumo: 10 achados principais

1. **Quase ninguém pede para escolher o lado antes de mostrar o jogo.**
   - Pokémon GO pede o time no nível 5, Ingress Prime no fim do tutorial e Hogwarts Legacy depois do prólogo. A Supercell nem deixa escolher: o personagem inicial é fixo.
   - Só o Destiny pede a classe no 1º minuto, e mesmo assim deixa criar outros 2 personagens depois.
   - O NOMADE escolhe cedo (decisão do dono) e já compensa com a tela "A cidade está dividida". **O que falta é valor antes do cadastro.**
2. **Valor antes da conta é o padrão mais forte que o NOMADE ainda não usa.**
   - O Duolingo dá a 1ª lição antes de pedir conta. Um executivo atribui a essa mudança cerca de **+20% de usuários ativos por dia** [fraca: citação de terceiros].
   - Proposta: mostrar a cidade, deixar escolher o time e fazer a cerimônia **antes** do cadastro, com o botão "Garanta seu lugar nos Volt Runners".
3. **"Sugestão, não sentença".**
   - No Hogwarts Legacy, o Chapéu sugere a casa e o jogador pode recusar.
   - O quiz do NOMADE já só pré-seleciona. Mantenha, e mostre os 4 times **sempre** visíveis depois do quiz.
4. **Identidade precisa de um marcador visível no mesmo segundo.**
   - O Splatfest entrega a **camiseta do time** no ato do voto e a recolhe no fim do evento.
   - No NOMADE, a cerimônia deve terminar mostrando **"seu rastro agora é desta cor"** e a moldura do time no avatar.
5. **Dopamina não é prazer, é "querer" e "aprender com a surpresa".**
   - Berridge e Robinson: a dopamina mede a vontade (*wanting*), não o gosto (*liking*) [forte].
   - Schultz: ela dispara quando o resultado é **melhor que o previsto** [forte].
   - Para o app: surpresa **honesta** no resultado da corrida, e nunca "puxar para atualizar".
6. **Sequência intacta aumenta o uso, e sequência quebrada derruba, sobretudo quando a pessoa se culpa.**
   - Silverman e Barasch (*JCR* 2023, 7 estudos) [forte]: o efeito cai quando dá para **consertar** a sequência.
   - O congelamento e a pausa da D-63 estão certos. Falta o texto "consertável" na hora da quebra.
7. **Para atividade física, a gamificação funciona, mas com efeito pequeno a médio, e a competição em grupo é a que mais dura.**
   - Meta-análise: g = 0,42 [forte].
   - Ensaio STEP UP: competição deu **+920 passos/dia** e foi o **único** braço que manteve efeito depois do fim [forte].
   - Times disputando a cidade é o formato certo. O cuidado é nunca reduzir isso a "1 contra 1".
8. **O gatilho de retorno mais forte é um plano, não uma notificação.**
   - Intenção de implementação ("quando e onde vou correr"): d = 0,65 em 94 testes [forte].
   - O app ainda **não pergunta** quando será a próxima corrida. É a melhoria mais barata e de maior impacto para o D1 e o D2.
9. **Sem push remoto, os gatilhos "verdadeiros" do jogo não chegam com o app fechado.**
   - Os avisos são só locais (D-69, limitação do Expo Go). "Sua zona está sob ataque" e "o chefão está a 12%" são os melhores gatilhos honestos do gênero, mas só chegam com o app aberto.
   - É a maior lacuna de retenção do D7 ao D30. Decisão para os autores (build de desenvolvimento com push).
10. **A linha ética do Brasil ficou mais dura em 2026.**
    - O ECA Digital (Lei 15.211/2025, art. 20) proíbe caixas de recompensa em jogos de acesso provável por menores, e o Decreto 12.880/2026 exige verificação de idade de quem as oferece [fraca para o detalhe do decreto].
    - O NOMADE aceita 16+, então o baú tem de continuar **grátis, ganho correndo e com chances públicas**. A Lei 14.852/2024 (marco dos games) **não** proíbe loot box: ela trata de classificação e de controle de compras de menores.

---

## 1. Da primeira abertura à escolha do time (0 a 3 minutos)

### 1.1 Como 10 produtos fazem o momento da escolha

> "Toques até a 1ª recompensa": **não encontrei medição publicada para nenhum deles**. A coluna traz o que as fontes descrevem em tempo ou em etapas. Os números com "~" são estimativas da E1 a partir das descrições [opinião].

| Produto | Quando escolhe | Ordem até a escolha | 1ª recompensa | Como apresenta cada opção | Troca | Como celebra | Fonte |
|---|---|---|---|---|---|---|---|
| **Pokémon GO** (times) | Nível 5, ao tocar num ginásio (horas de jogo) | Professor → avatar → captura guiada → PokéStops → nível 5 → 3 líderes | Captura garantida nos primeiros minutos | Líder + ave lendária + 1 valor (coragem, sabedoria, intuição), sem estatística | 1 vez a cada 365 dias, paga (Team Medallion, desde fev/2019) | Tela na cor do time e o líder passa a "falar" com você (avaliação de Pokémon) | F1 §1.2; pokemongo.com/news/teamchange2019 [forte para a troca] |
| **Ingress Prime** (facções) | Depois de um "onboarding completo" | Tutorial (XM, portais, ressonadores, links, campos) → escolha | Primeiro portal capturado no tutorial | Duas facções com ideologia (Iluminados × Resistência), cor verde × azul | 1 troca permitida a partir de 40.000 AP; depois disso, só recomeçando a conta (*Recursion*) [fraca: wiki de fã] | Não confirmei [incerto] | nianticlabs.com/blog/ingress-prime [forte para a ordem]; wiki de fã |
| **Duolingo** (sem time) | Escolhe idioma e motivo | Idioma → **1ª lição** → "por que você aprende" → meta diária → notificações → nível → sequência começa → meta de sequência (versão 2024) | 1ª lição concluída + sequência de 1 dia | Perguntas curtas com ícones, Duo comentando | Livre | Duo comemora; contador da sequência acende | uxdesign.cc "Duolingo's onboarding 2 years on" [opinião]; taplytics.com [fraca] |
| **Zombies, Run!** | Não escolhe: você **é** o "Runner 5" | Comece → missão de abertura (corrida livre, sem instrução) → plano semana 1 | História em áudio durante a 1ª corrida | Personagens com voz; o jogador é recrutado | — | Narrativa: a cidade de Abel recebe você | zombiesrungame.com/episode/M-E01 [fraca]; suporte do app (via busca) [fraca] |
| **Strava** | Sem time; pergunta o objetivo | Perfil (idade) → "para que você vai usar" (evento, saúde, explorar, hábito, conhecer gente, competir) → achar amigos → "Gravar agora" ou "Conectar aparelho" | 1ª atividade gravada + kudos | Lista de objetivos | Livre | Kudos de seguidores | screensdesign.com (análise de onboarding) [opinião] |
| **Nike Run Club** | Sem time | Conta → "First Run" (corrida guiada que ensina o app) | 1ª corrida guiada com o treinador | Voz do treinador (Coach Bennett): "comece leve" | — | Troféu e nível por distância | nike.com/a/running-goals [fraca]; fitisafeministissue.com [opinião] |
| **Clash Royale** | Não escolhe: baralho inicial fixo | Abre o jogo → **batalha guiada em segundos** → baú | Vitória e baú logo após o tutorial | Cartas aparecem conforme ganha | — | Abertura de baú | playtestcloud.com; pocketgamer.biz (FTUE) [opinião] |
| **Brawl Stars** | Não escolhe: começa com a Shelly | Tutorial obrigatório (andar e atirar) → partida de treino → partidas reais | Troféus; o 2º personagem (Nita) com 10 troféus [fraca: pode ter mudado] | Personagens liberados na "estrada de troféus" | — | Desbloqueio com animação | godisageek.com; sportskeeda.com [fraca] |
| **Hogwarts Legacy** (casas) | Depois do prólogo [incerto: cerca de 1 h] | Prólogo → Cerimônia do Chapéu (perguntas) → Chapéu **sugere** → jogador aceita ou escolhe outra | Entrada no salão com a cor da casa | Pergunta de personalidade; só 1 pergunta pesa no resultado [fraca] | Não troca depois | Cerimônia no salão, uniforme e sala comunal da casa | videogameschronicle.com; primagames.com [fraca] |
| **Splatoon 3** (Splatfest) | Cada evento mensal, numa barraca da cidade | Prévia de 1 semana → vota no time → **ganha a camiseta na hora** → batalhas | Camiseta + conchas na prévia | Tema do evento (ex.: "Doce × Azedo × Picante"); cada idol da Deep Cut "representa" um time | Travado até o fim do evento; a camiseta é devolvida no fim | Resultado por categorias (votos, conchas, vitórias e tricolor) | videogameschronicle.com; gfinityesports.com; nintendowire.com [fraca] |
| **Destiny 2** (classe) | **No 1º minuto** | Criação: Titã, Caçador ou Arcano (com descrição e prévia 3D) → raça e aparência (cosméticas) | Primeira missão | Papel de cada classe (resistente, ágil, místico) | Não troca, mas cria até 3 personagens (1 de cada classe) | Despertar do personagem | pcgamesn.com; maxroll.gg [fraca] |
| **Destiny 2** (Faction Rally, 2017–2019) | Evento semanal | Promete lealdade a 1 de 3 facções por 1 semana | Engramas da facção | Arma exclusiva de cada facção | Uma promessa por evento | Facção vencedora compra a arma por 1.000 Glimmer; as outras pagam 50.000 | gamespot.com; destinypedia.com [fraca] |

**O que a tabela ensina (leitura da E1) [opinião baseada na tabela]:**
- **Escolha cedo só funciona com valor e reversibilidade.** O Destiny escolhe no minuto 1, mas a classe tem papel claro e dá para ter as 3. Pokémon GO, Ingress e Hogwarts escolhem depois de a pessoa entender o mundo.
- **Ação vem antes do menu.** Clash Royale, Brawl Stars e Duolingo levam a pessoa à ação antes de qualquer cadastro ou configuração.
- **Os times bons são de valor, não de vantagem.** Pokémon GO e Splatfest não dão estatística diferente. O Destiny dá, mas são classes, não times.
- **Identidade visível na hora:** a camiseta do Splatfest, o uniforme de Hogwarts e o líder que "fala" com você no Pokémon GO.
- **Escassez de troca dá peso à escolha:** 1 vez por ano (Pokémon GO), 1 vez só (Ingress), nunca (Hogwarts) e por evento (Splatfest). O NOMADE, com 1 troca por temporada, está no meio-termo saudável.
- **Time grande precisa de contrapeso.** No Tricolor do Splatfest, o time que lidera enfrenta os outros dois ao mesmo tempo [fraca: o formato 4×2×2 aparece em guias, sem a regra oficial]. No Faction Rally, quem perdeu ainda pode comprar a arma, só que mais caro.

### 1.2 Onde o NOMADE está hoje (estimativa de toques)

Fluxo atual (`app/(auth)/boas-vindas` → `cadastro` → `app/(tabs)/onboarding`):

| Passo | Toques | Digitação | Recompensa |
|---|---|---|---|
| Boas-vindas "Começar" | 1 | — | — |
| Cadastro: e-mail, senha, 16+ e termos, "Criar" | ~3–4 | e-mail e senha | — |
| Nome (só se vier vazio) | 1 | nome | — |
| "A cidade está dividida" → continuar | 1 | — | Contexto |
| Card do time, líder e "Entrar" | 2 | — | — |
| **Cerimônia** (cor inunda a tela) | 1 ("Bora correr") | — | **1ª recompensa emocional** |
| Localização | 1 | — | — |
| Mapa: missão 2 de 3 | — | — | Progresso dotado |

- **Total até a 1ª recompensa:** ~9 a 10 toques, mais 2 a 3 campos digitados, entre 60 e 120 s [estimativa da E1].
- **Meta proposta:** ≤ 5 toques e **zero digitação** até a cerimônia (ver regra 2).

### 1.3 Dez regras práticas para o NOMADE (com a tela exata)

| # | Regra | De onde vem | Tela exata no NOMADE | Como medir | Custo |
|---|---|---|---|---|---|
| 1 | **Contexto antes da escolha, em ≤ 6 s**: o mapa com as 4 cores e a frase "A cidade está dividida". Já existe; só manter o teto de 6 s e o botão "Pular" a partir de 2 s | Pokémon GO e Ingress dão horas de contexto; o NOMADE comprime isso em segundos | `features/screens/onboarding/city-divided-step.tsx` | Tempo na tela ≤ 6 s em 90% das sessões | — (já feito) |
| 2 | **Valor antes da conta**: Boas-vindas → Cidade → Times → **Cerimônia** → Cadastro ("Garanta seu lugar nos Volt Runners") → Localização. O time fica guardado no aparelho e `choose_faction` roda logo depois do cadastro | Duolingo: cadastro adiado (≈ +20% de usuários ativos por dia [fraca]) | `app/(auth)/boas-vindas.tsx`, `cadastro.tsx`, `onboarding-screen.tsx` (ordem dos passos) e um `pendingFaction` no store de onboarding | Taxa de quem começa e chega a "time escolhido": hoje ≈ cadastro × escolha | **M** (precisa da E6 e do E9 para o guarda de rotas) |
| 3 | **Escolha identitária, sem estatística**: cada card mostra mascote, líder, **1 valor** e **1 estilo** ("corre em matilha"). Nunca "+10% de pontos" | Pokémon GO e Splatfest: times iguais nas regras | Carrossel em `onboarding-screen.tsx` + `components/leader-sheet.tsx` | Distribuição entre os times; nenhum acima de 40% na 1ª semana | — (manter) |
| 4 | **O quiz sugere, a pessoa decide**: o resultado diz "Combina com você: Urban Coyotes", com os 4 cards à vista e o sugerido já marcado | Hogwarts Legacy: o Chapéu sugere e o jogador pode recusar | `onboarding/team-quiz.tsx` → volta ao carrossel | % de quem troca a sugestão (esperado entre 15 e 30%, sinal de autonomia) | **P** |
| 5 | **A regra de troca aparece antes de confirmar, em 1 linha**: "Dá para trocar 1 vez por temporada." | Pokémon GO (1 por ano), Ingress (1 vez), Splatfest (travado no evento) | Botão de confirmar no carrossel e em `faction-screen.tsx` (já avisa as consequências) | Pedidos de troca na 1ª semana < 5% | **P** (texto) |
| 6 | **Marcador de identidade imediato**: a cerimônia termina com "Seu rastro agora é **amarelo**", o traço da rota desenhado na cor do time e a moldura do avatar trocada | Camiseta do Splatfest; uniforme de Hogwarts | `components/celebration/team-confirm.tsx` (último quadro) | — | **P** |
| 7 | **A cerimônia dura ≤ 3 s, dá para pular com um toque e termina numa ação** ("Bora correr"). Com "Reduzir movimento", vira fade de 150 ms (D-71) | Clash Royale e Brawl Stars levam à ação logo após o tutorial | `team-confirm.tsx` | Tempo da cerimônia; % que pula | — (conferir) |
| 8 | **O líder continua falando depois**: 1 frase do líder no resumo da 1ª corrida, no recap semanal e quando o time vence a semana. Máx. 1 fala por tela, ≤ 90 caracteres | Pokémon GO: a avaliação feita pelo líder; Zombies, Run!: vozes durante a corrida | `features/screens/summary-screen.tsx`, recap e `components/art/leader` | % que lê o recap até o fim | **P** (catálogo de falas) |
| 9 | **1ª recompensa tangível na entrada do time**: a moldura "Recruta" do time liberada na cerimônia, visível no perfil. Hoje a missão é "sem prêmio prometido" | Splatfest (camiseta), Duolingo (sequência de 1 dia) | `team-confirm.tsx` → `features/engagement/cosmetics.ts` | % que abre o perfil no D0 | **P** |
| 10 | **1º sucesso garantido em menos de 100 m**: comemorar o **1º trecho pintado** (~40 m), que acontece em 100% das corridas, e não só a 1ª zona, que pela simulação da D-62 sai em 62% das 1as corridas | NRC ("First Run") e Zombies, Run! (missão de abertura sem meta) | `features/screens/run-screen.tsx` (micro-celebração 1 vez na vida) e `welcome-mission.ts` | % de 1as corridas com alguma celebração = 100% | **P** |

**Regra 11 (bônus, se houver dado real):**
- Selo **"Precisa de reforço"** no card do time com menos ativos na cidade (por exemplo, < 20% dos ativos dos últimos 7 dias). O bônus é só cosmético (selo "Reforço" no perfil).
- Fonte: o contrapeso do Tricolor no Splatfest e o time pequeno do Pokémon GO (F1).
- Tela: carrossel. Custo **M** (precisa de RPC com a contagem de ativos por time). Nunca em conta real com dado inventado (D-76).

---

## 2. Neurociência aplicada, sem charlatanismo

**Regra de redação para o TCC e para a interface:**
- **Não escrever** "o app libera dopamina", "vício bom" ou "hackear o cérebro". Nenhum desses é mensurável aqui, e a literatura não autoriza.
- **Escrever:** "o design usa previsão e surpresa de forma compatível com o modelo de erro de predição de recompensa (Schultz, 1997)".

### 2.1 Dopamina e antecipação: erro de predição (Schultz) e "querer × gostar" (Berridge)

**O que é:**
- Schultz, Dayan e Montague (1997) mostraram que os neurônios de dopamina de primatas disparam quando a recompensa é **melhor que a prevista** e ficam no nível de base quando ela vem como esperado. Depois do aprendizado, o disparo passa para o **sinal** que anuncia a recompensa, e cai abaixo da base quando a recompensa prevista **não vem**.
- Berridge e Robinson (1998; revisões em 2009, 2016 e 2024) separam três coisas: **querer** (saliência de incentivo, mediada pela dopamina), **gostar** (prazer, que depende de outros circuitos, como os "pontos quentes" opioides) e **aprender**. Em ratos quase sem dopamina, o "gostar" do açúcar fica normal.
- Ou seja, a dopamina é **motivação e aprendizado**, não "prazer". Isso tem duas consequências de design:
  - a antecipação (o sinal) pesa tanto quanto a recompensa;
  - prometer e não entregar **pune** o comportamento.

**Fontes:** Schultz, Dayan e Montague, *Science* 275:1593, 1997 (doi 10.1126/science.275.5306.1593) [forte] · Berridge e Robinson, *Brain Res. Rev.* 1998; Berridge, Robinson e Aldridge, *Curr. Opin. Pharmacol.* 2009 [forte] · Robinson e Berridge, *Annu. Rev. Psychol.* 2024 [forte].

**Aplicações:**
1. **Sinal confiável antes da recompensa (antecipação).**
   - Tela: corrida (`run-screen.tsx`).
   - Mecânica: aviso "Faltam 120 m para a zona" e, no fim, contagem regressiva na barra.
   - Número: o aviso aparece aos 80% do caminho (ex.: 400 de 500 m), **só 1 vez por zona**, para o sinal continuar valendo.
2. **Nunca prometer o que o servidor pode negar.**
   - Tela: resumo (`summary-screen.tsx`).
   - Mecânica: a zona aparece como "provisória" até a confirmação do servidor. Se o servidor negar, o texto é neutro e informativo ("O trecho não contou: GPS fraco").
   - Número: prometido × confirmado ≥ 95% (meta de QA); abaixo disso, o "Faltam X m" perde valor como sinal.
3. **Surpresa melhor que o previsto, só no resultado.**
   - Tela: resumo.
   - Mecânica: 1 "bônus inesperado" **real** por corrida no máximo (ex.: "Recorde: maior número de ruas pintadas"; ver ideia 5.4).
   - Número: aparece em no máximo ~1 de cada 4 corridas. Se vier sempre, vira o previsto e para de surpreender.

### 2.2 Recompensa variável: de Skinner a Eyal, com as críticas

**O que é:**
- Esquemas de reforço de **razão variável** (Skinner) produzem respostas altas e persistentes, como numa máquina caça-níquel.
- Eyal (*Hooked*, 2014) transformou isso no ciclo gatilho → ação → recompensa variável → investimento.
- **Críticas:**
  - o modelo é parecido demais com os métodos de cassino e pode gerar vício comportamental (ensaio da Thoughtworks);
  - James Williams (*The Guardian*) chamou o livro de "a bíblia" da guerra pela atenção;
  - a defesa ética de Eyal, o "teste do traficante" (você usaria o produto como espera que os outros usem?), é autodeclarada;
  - não achei crítica acadêmica revisada do *modelo* em si [incerto]. A crítica forte está em Schüll (*Addiction by Design*) sobre máquinas de aposta (F1 §7.1).

**Fontes:** Eyal, *Hooked*, 2014 [opinião: livro de negócios] · thoughtworks.com/insights/blog/addicted-industry-matures [opinião] · Schüll, *Addiction by Design*, Princeton, 2012 [forte: etnografia acadêmica].

**Aplicações (a variabilidade fica na corrida, nunca na tela):**
1. **Baú do dia.**
   - Tela: `rewards-screen.tsx` e `chest-opening.tsx`.
   - Mecânica: só abre com atividade ≥ 1 km, mostra as chances na própria tela e tem a garantia do 20º (já é a D-66).
   - Número: chances **visíveis antes de abrir**; no máximo 3 baús guardados.
2. **Crítico no chefão.**
   - Tela: Raid.
   - Mecânica: crítico de 10% com a chance escrita (D-67), resolvido **depois** da corrida, nunca por toque.
   - Número: 1 sorteio por corrida, não por km, para não premiar "corridas picadas".
3. **Proibido:**
   - variabilidade em "puxar para atualizar", em abrir pacotes em sequência ou em "toque para tentar de novo";
   - qualquer sorteio que custe dinheiro ou moeda comprável.

### 2.3 Progresso visível: gradiente de meta (Hull → Kivetz)

**O que é:**
- Hull (1932/34) viu ratos correndo mais rápido perto da comida.
- Kivetz, Urminsky e Zheng (*JMR*, 2006) testaram isso com cartões de café: quem recebeu um cartão de 12 carimbos com 2 **já preenchidos** completou as 10 compras **mais rápido** do que quem recebeu um cartão comum de 10 (mediana de 10 × 15 dias, segundo resumo de terceiros [fraca para o número]).
- As compras **aceleram** conforme a meta se aproxima, e a **ilusão** de progresso já basta para acelerar.

**Fonte:** Kivetz, Urminsky e Zheng, "The Goal-Gradient Hypothesis Resurrected", *JMR* 43(1):39–58, 2006 [forte].

**Aplicações:**
1. **Barra da meta semanal** (sequência: 2 atividades).
   - Tela: Mapa e "Você".
   - Mecânica: a barra muda de cor e ganha brilho nos últimos 20%.
   - Número: "Falta 1" aparece em destaque **só** quando falta 1.
2. **Raid.**
   - Tela: Arena.
   - Mecânica: a barra de vida do chefão mostra a fase atual e "Faltam X km da cidade para a fase 2".
   - Número: o rótulo de distância só aparece quando faltam ≤ 15% da fase.
3. **Liga.**
   - Tela: Clube.
   - Mecânica: "Você está a 38 pontos de subir" (já há o aviso `n-liga`).
   - Número: só mostrar a distância quando ela for ≤ 1 corrida típica da pessoa, para não virar pressão.

### 2.4 Progresso dotado (Nunes e Drèze)

**O que é:**
- Num lava-rápido (300 cartões), o cartão de 10 carimbos com **2 de brinde** foi concluído por **34%** dos clientes, contra **19%** do cartão de 8 sem brinde. O esforço exigido era o mesmo.
- O brinde inicial faz a meta parecer "já em andamento".

**Fonte:** Nunes e Drèze, *J. Consumer Research* 32(4):504–512, 2006 [forte]. O número 19% foi confirmado em fonte secundária; o 34% aparece como "+82%" em resumos [fraca para o número exato].

**Aplicações:**
1. **Missão de boas-vindas.**
   - Tela: Mapa.
   - Mecânica: "Conta ✓ · Time ✓ · Correr 500 m" (já existe, 2 de 3).
   - Número: manter **2 de 3**, nunca 0 de 1.
2. **Primeira semana.**
   - Tela: `missions-screen.tsx`.
   - Mecânica: a trilha de 7 passos começa com o passo 0 "Escolheu o time ✓" já marcado.
   - Número: 1 de 8 marcado no início.
3. **Temporada nova.**
   - Tela: recompensas.
   - Mecânica: a trilha da temporada começa com o 1º degrau preenchido para quem correu na temporada anterior (premia quem volta, não pune quem faltou).
   - Número: 1 degrau de ~10.

### 2.5 Zeigarnik (memória) × Ovsiankina (retomar)

**O que é:**
- A meta-análise de Ghibellini e Meier (2025, 59 publicações) **não achou** vantagem de memória para tarefas interrompidas (o "efeito Zeigarnik" popular), mas achou uma **tendência geral a retomar** o que ficou interrompido (efeito Ovsiankina).
- Para design, o que vale é: "deixar uma tarefa aberta e **fácil de retomar**". Não vale dizer que "a pessoa não vai esquecer".

**Fonte:** Ghibellini e Meier, *Humanit. Soc. Sci. Commun.* 12, 2025 (doi 10.1057/s41599-025-05000-w) [forte].

**Aplicações:**
1. **Missão aberta no topo do Mapa.**
   - Mecânica: card "Missão 1: falta correr 500 m", com o botão Correr a 1 toque.
   - Número: máx. **1** tarefa aberta em destaque, não 3.
2. **Rua começada.**
   - Tela: resumo.
   - Mecânica: "Você pintou 2 de 3 trechos da zona Cambuí Norte. Volta nela?"
   - Número: só quando faltar 1 trecho (o mínimo de dono é 3; D-62).
3. **Não usar Zeigarnik como "lembrete de culpa":** nada de selo vermelho ou contador de pendências (ver §3).

### 2.6 Identidade de grupo: grupo mínimo (Tajfel) e por que escolher um time gera pertencimento

**O que é:**
- No experimento de Tajfel et al. (1971), 48 meninos de Bristol foram divididos ao acaso, supostamente por preferirem Klee ou Kandinsky. Ao distribuir dinheiro, eles favoreceram o próprio grupo **até à custa do maior ganho conjunto**.
- Basta a **categorização** para surgir favoritismo.
- **Limites:** o cenário é artificial e as apostas são baixas; numa replicação na Nova Zelândia (Wetherell, 1982), crianças polinésias foram mais generosas com o outro grupo.
- No Pokémon GO, a identificação com o time previu intensidade de jogo e comportamento territorial, e o conflito por território polarizou os times (Laato et al., 2021; F1 §1.2). O viés de grupo **enfraquece** quando o jogo perde força (F1).

**Fontes:** Tajfel, Billig, Bundy e Flament, *Eur. J. Soc. Psychol.* 1(2), 1971 [forte] · Laato et al., *Internet Research*, 2021 [forte] · Peysakhovich e Rand, 2017 [incerto: não confirmei a revisão por pares].

**Aplicações:**
1. **Ritual + marcador.**
   - Telas: cerimônia e perfil.
   - Mecânica: cor, rastro e moldura do time (regras 6 e 9).
   - Número: o marcador aparece em **3 lugares** desde o D0: avatar, rastro e card de compartilhar.
2. **Destino comum semanal.**
   - Tela: Mapa (faixa do topo na segunda).
   - Mecânica: "Semana dos Volt: 2º lugar em Campinas, 312 km". Todo mundo do time "ganha" junto, como no Faction Rally do Destiny.
   - Número: 1 resultado por semana, entregue no recap.
3. **Freio na polarização.**
   - Telas: todas.
   - Mecânica: líderes **nunca** falam mal de outro time; não há chat livre entre times (D-79: reações prontas); o rival é "o outro time", nunca uma pessoa.
   - Número: 0 textos com ataque a time (checar no catálogo de falas).

### 2.7 Sequências (streaks): o que funciona e os riscos

**O que é:**
- Silverman e Barasch (*JCR* 49(6), 2023; 7 estudos) mostraram três coisas:
  - **sequências exibidas** aumentam o engajamento futuro em relação a sequências quebradas, independentemente do comportamento real;
  - a quebra derruba mais quando a pessoa **se culpa**;
  - a queda é menor quando dá para **consertar**.
- Números do Duolingo:
  - quem chega a 7 dias tem **3,6×** mais chance de **terminar o curso** (é correlação, e a métrica é conclusão, não "engajamento") [fraca: dado oficial sem método];
  - separar a meta diária da sequência rendeu +3,3% de retenção no D14 [fraca: oficial, teste A/B descrito por alto];
  - a "aposta de sequência" rendeu +14% no D7 [fraca].
- **Risco:**
  - em usuários de pulseiras de atividade, a culpa e a ansiedade foram **incomuns**, mas mais prováveis em perfis de baixa conscienciosidade (Ryan et al., *BMC Psychology*, 2019, n = 237) [forte];
  - uma pré-publicação de 2025 descreve **pressão** como motor e conflito emocional [fraca];
  - em corrida, sequência **diária** empurra para treinar sem descanso (F1 §7.1).

**Fontes:** Silverman e Barasch, doi 10.1093/jcr/ucac029 [forte] · blog.duolingo.com/how-duolingo-streak-builds-habit; blog.duolingo.com/improving-the-streak; making.duolingo.com (streaks) [fraca] · Ryan, Edney e Maher, *BMC Psychol.* 2019 (doi 10.1186/s40359-019-0315-y) [forte].

**Aplicações (já coerentes com a D-63; o que muda é o texto e o momento):**
1. **Semanal, não diária.**
   - Tela: Mapa/"Você".
   - Mecânica: 2 atividades por semana, e caminhar vale.
   - Número: manter **2**; nunca subir automaticamente.
2. **Quebra consertável e sem culpa.**
   - Tela: aviso da segunda-feira.
   - Mecânica: "Semana passada ficou em 1 de 2. O congelamento do mês segurou sua sequência." Se não havia congelamento: "Sequência nova começa hoje. Seu recorde (6 semanas) fica guardado."
   - Número: o **recorde** aparece sempre ao lado da sequência atual, para a quebra não "apagar" a história. Hoje ele aparece na volta (`welcome-back.ts`); falta no card da sequência.
3. **Saúde acima da sequência.**
   - Tela: `health-pause-sheet.tsx`.
   - Mecânica: pausa de 1 a 4 semanas, 1 vez por temporada, **sem pergunta de justificativa**.
   - Número: a pausa fica a 2 toques do card da sequência.

### 2.8 O que de fato funciona para atividade física (o "número de verdade" para a banca)

- **Meta-análise** de ensaios randomizados (2010–2020; 16 estudos, 2.407 pessoas):
  - gamificação aumentou a atividade física com efeito **pequeno a médio** (g = 0,42);
  - contra controles **ativos**, foi menor (g = 0,23);
  - persistiu um pouco depois do fim (g = 0,15).
  - Mazeas et al., *JMIR* 24(1):e26779, 2022 [forte].
- **STEP UP** (602 adultos, 24 semanas):
  - **competição** em grupo rendeu +920 passos/dia; apoio, +689; colaboração, +637;
  - **só a competição** manteve efeito nas 12 semanas sem jogo (+569).
  - Patel et al., *JAMA Intern. Med.*, 2019 [forte].
- **Megaestudo** de 61.293 pessoas e 54 programas:
  - 45% das intervenções aumentaram as idas à academia (9 a 27%);
  - a melhor foi **microrrecompensa por voltar depois de faltar**;
  - só 8% dos efeitos duraram depois de 4 semanas.
  - Milkman et al., *Nature* 600:478, 2021 [forte].
- **Intenção de implementação:** planos "quando X, faço Y" aumentam o alcance de metas com d = 0,65 (94 testes). A atualização de 2024 (642 testes) dá d entre 0,27 e 0,66, conforme o formato.
  - Gollwitzer e Sheeran, *Adv. Exp. Soc. Psychol.* 38, 2006 [forte].

**Leitura para o NOMADE:**
- A disputa **entre times** é o formato com melhor evidência de duração.
- O **bônus de volta** e o **plano da próxima corrida** são os dois empurrões com melhor relação custo/efeito.
- Prometer na banca algo como "o app dobra a atividade" seria falso. O efeito esperado é **moderado**.

---

## 3. Linha ética: o que NÃO fazer

### 3.1 O que a regra diz (Brasil, UE, Reino Unido)

| Norma | O que diz | Impacto no NOMADE | Força |
|---|---|---|---|
| **ECA Digital, Lei 15.211/2025, art. 20** | "São vedadas as caixas de recompensa (loot boxes) oferecidas em jogos eletrônicos direcionados a crianças e a adolescentes ou de acesso provável por eles". Em vigor desde 17/03/2026; a ANPD fiscaliza; há ação no STF contestando | O app aceita 16+, então é de **acesso provável** por adolescentes. Baú **nunca vendido**, nunca trocável por moeda comprável, com chances públicas | [forte] para a existência e o texto (citado por várias fontes); a leitura "só vale para caixa paga" vem de comentário ("mediante o pagamento prévio") [fraca] |
| **Decreto 12.880, de 18/03/2026** (regulamenta o ECA Digital) | Exige verificação de idade mais rigorosa; quem oferece caixas de recompensa deve verificar a idade [fraca: 1 fonte] | Mais um motivo para o baú do NOMADE não ser "caixa de recompensa" no sentido legal: grátis, só correndo | [forte] para a existência do decreto (camara.leg.br); [fraca] para o detalhe |
| **Nota Técnica MJSP nº 55/2026** | Pede à ANPD que monitore jogos com caixas de recompensa sem verificação de idade | Mostra que a fiscalização é real | [fraca] (só o título e o resumo) |
| **Lei 14.852/2024** (marco legal dos games) | Define jogo eletrônico, trata de classificação indicativa, fomento e **controles para transações financeiras de menores**. **Não proíbe loot box** (a proibição está no ECA Digital) | Se um dia houver compra no app: controle parental e limite para menores | [fraca] (resumos de escritórios e da Câmara) |
| **Parlamento Europeu, 18/01/2023** | Resolução sobre proteção do consumidor em jogos online: abordagem comum para loot boxes, preocupação com menores | Referência para o TCC | [forte] |
| **Parlamento Europeu, 26/11/2025** (2025/2060(INI), 483–82–86) | Pede que a futura Lei de Equidade Digital (DFA) cubra loot boxes, moedas virtuais e padrões enganosos | — | [forte] |
| **Lei de Equidade Digital (DFA)** | Proposta prevista para o **4º tri de 2026**; não achei texto publicado até 30/10/2026. A consulta pública apoiou mostrar o **preço real** dos itens em moeda virtual e as **chances** das caixas | Mostrar chances e não ter moeda virtual paga | [fraca] (escritórios e BEUC) |
| **Reino Unido** (resposta do governo, 2022; princípios da indústria, 2023) | Menores **não** devem comprar loot box sem aprovação dos pais; a associação com problemas de aposta existe, mas a causalidade não está provada; 11 princípios da Ukie com controles técnicos para restringir menores | — | [forte] (gov.uk) |
| **Brignull, deceptive.design** | Catálogo de padrões enganosos: confirmshaming, nagging (insistência), escassez falsa, urgência falsa, prova social falsa, obstrução, difícil de cancelar, pré-seleção, linguagem ambígua, interferência visual, ação forçada, custos escondidos, entre outros (16 tipos na versão atual [fraca para a lista completa]) | Lista de checagem do QA (E10) | [opinião] (praticante de referência; usado pela FTC e pela UE) |

### 3.2 Lista de "nunca" (para colar no prompt das equipes)

1. **Nunca vender** baú, sorteio ou qualquer coisa com resultado aleatório, nem trocar sorteio por moeda que se compra.
2. **Nunca esconder as chances**: elas aparecem **antes** de abrir, na mesma tela.
3. **Nunca usar culpa**: "Sentimos sua falta", "Você abandonou…", "Não desista", "Vai perder tudo". O filtro `GUILT_PATTERN` já bloqueia; estender a missões, ao resumo e às falas dos líderes.
4. **Nunca fazer confirmshaming** no botão de recusa ("Não, prefiro ficar parado"). A recusa é neutra: "Agora não".
5. **Nunca usar urgência falsa**: toda contagem regressiva vem do servidor e é verdadeira (fim da Raid, da liga, da temporada).
6. **Nunca usar prova social falsa**: "128 corredores hoje" só com número real; no modo demonstração, com o selo "Demonstração" (D-76/77).
7. **Nunca insistir** com aviso repetido. O limite é de 1 por dia e 4 por semana; com 3 avisos ignorados, cai para 1 por semana; depois de 30 dias, silêncio (D-69).
8. **Nunca premiar** correr de madrugada, correr doente, correr mais de 30 km/dia ou correr todo dia sem descanso.
9. **Nunca pedir permissão antes do valor**, nem empilhar permissões. Localização vem depois da cerimônia, notificações vêm depois da 1ª corrida, cada uma com o seu "porquê".
10. **Nunca dificultar sair**: desligar avisos, pausar, sair da crew, trocar de time e excluir a conta ficam a ≤ 2 toques da tela de ajustes.
11. **Nunca comparar** a pessoa com outra por padrão. A comparação padrão é consigo mesma; ranking é opcional e por faixa.
12. **Nunca fazer FOMO pago**: nenhum item "por tempo limitado" que se compra. Cosmético de evento só se ganha correndo, e volta em outro evento.
13. **Nunca expor** rota com início e fim reais (zonas de privacidade e corte no domain, D-78).
14. **Nunca dizer** que o app "libera dopamina" ou "vicia". O termo certo é "motiva" e "ajuda a criar hábito".
15. **Nunca pedir** para menores de 16 (piso do cadastro), e não colocar compra nenhuma no app sem rever o ECA Digital.

---

## 4. Retorno no dia 1, 2, 7 e 30

### 4.1 Benchmarks (com a força de cada fonte)

| Recorte | D1 | D7 | D30 | Fonte | Força |
|---|---|---|---|---|---|
| Saúde e fitness (blog citando AppsFlyer e Adjust 2025) | 27–28% | 17–18% | 8–9% | enable3.io/blog/app-retention-benchmarks-2025 | [fraca] |
| Saúde e fitness (Trysonar) | 27% | 13% | 8% | trysonar.app/blog/app-user-retention-benchmarks-and-what-moves-it | [fraca] |
| Saúde e fitness (Phiture, arredondado) | ~20% | ~8% | 3–4% | phiture.com/mobilegrowthstack | [fraca] |
| Saúde e fitness (Braze) | — | — | 3,9% iOS / 3,4% Android | braze.com/resources/articles/mobile-app-retention | [fraca] |
| Todos os apps (Adjust) | 26% | 13% | 7% | adjust.com/blog/what-makes-a-good-retention-rate | [fraca] |
| Apps de corrida (Strava, NRC, Runna) | — | — | — | **Não achei dado público de coorte** | — |

**Leitura:**
- As fontes discordam em até 2× no D30 (de 3% a 9%). O que se repete é o formato da curva: **a maior perda é entre o D1 e o D7**.
- A Braze lembra que, em fitness, frequência importa mais que "voltou no D30": quem abre todo dia em janeiro e 2 vezes em março conta como perdido.
- **Meta do piloto do TCC** (mantida da F1, compatível com essas faixas): D1 ≥ 35%, D7 ≥ 15%, D30 ≥ 8%, medidos pela telemetria opt-in (D-82). Apresentar como **meta**, nunca como resultado.

### 4.2 O que traz de volta em cada dia (apps de corrida e jogos de território)

| Dia | Gatilho que funciona | Evidência | NOMADE tem? | Lacuna |
|---|---|---|---|---|
| **D0 → D1** | **Plano da próxima corrida** ("Quando você corre de novo?") e lembrete **na hora escolhida** | Intenção de implementação, d = 0,65 [forte] | **Não.** O lembrete usa o "horário habitual" padrão das 19h (`reminders.ts`) | Pergunta no fim do 1º resumo, com 3 botões: "Amanhã 7h", "Sábado de manhã" e "Escolher". Agenda 1 aviso local |
| D0 → D1 | 1º sucesso garantido + compartilhar no pico | Pico-fim (F1); Strava | Parcial: há missão e card; a 1ª zona sai em 62% das 1as corridas | Celebrar o 1º trecho (regra 10) |
| **D2** | **Território que muda**: "Seu trecho na R. X foi repintado pelos Coyotes" (verdadeiro, 1 por dia, agrupado) | Jogos de território; aversão à perda [opinião] | Existe como `n-invasao`, mas é **servidor → só com o app aberto** (sem push remoto) | Push remoto (build de desenvolvimento, EAS). **Maior lacuna** |
| D2 | Passo 2 da 1ª semana liberado | Ovsiankina [forte] | Sim (`n-ftue`, 1 passo por dia, sem prazo) | — |
| **D7** | **Fechamento semanal**: sequência, liga (segunda 03:20), Raid (domingo 21:00), recap da segunda | Efeito do recomeço (Dai, Milkman e Riis, 2014) [forte] | Sim (`n-recap`, `n-liga`, `n-chefao`) | **Resultado do time na semana** (destino comum, §2.6) não existe como momento |
| D7 | Bônus por voltar depois de faltar | Megaestudo, melhor braço [forte] | Sim (`v-7`: "10 minutos já contam" + baú raro) | — |
| D7 | Grafo social: crew e amigos | STEP UP (competição em grupo) [forte]; Strava: clubes ×4 em 2025 [fraca] | Crew e convite existem (`InviteCard` em `crew-screen.tsx`); passo 5 da 1ª semana é "Entre numa crew" | O convite só aparece dentro da Crew: oferecer "Chame 1 amigo para correr com você" no **1º resumo** (D0), 1 vez |
| **D30** | Temporada nova (troca de time, trilha nova), recap do mês, título "Guardião da zona" | Efeito do recomeço [forte]; Local Legend do Strava (F1) [fraca] | Temporada e `n-temporada` existem; Guardião não confirmado | Ritual de "aniversário de zona" (ideia 5.9) |
| D30 | Escada de volta que termina em silêncio | Duolingo para de enviar (F1) [fraca] | Sim (7/14/21/30 dias e depois silêncio) | — |

### 4.3 O que fazer, por ordem de impacto (custo × efeito esperado)

1. **Plano da próxima corrida no 1º resumo + aviso na hora escolhida** (P). Evidência forte e custo baixo; atua no ponto de maior perda (do D1 ao D7). Telas: `summary-screen.tsx` e `domain/reminders.ts` (novo tipo `plano`, respeitando 1 aviso por dia e a janela das 8h às 21h).
2. **Push remoto para os gatilhos do jogo** (invasão, chefão em fase final, liga) (G, depende dos autores: build de desenvolvimento, conta Apple/Google e EAS). Sem isso, D7 e D30 ficam só com lembretes locais "genéricos".
3. **Valor antes da conta** (regra 2) (M). Atua no topo do funil (instalou → escolheu o time).
4. **Resultado semanal do time** no recap da segunda e no topo do Mapa (M). Mantém vivo o pertencimento, que é frágil (§2.6), e dá a sensação de vitória para quem correu pouco.
5. **1º trecho celebrado + moldura "Recruta" na cerimônia** (P). Garante 100% de 1as experiências com recompensa.
6. **Convite de amigo no 1º resumo** (P): o `InviteCard` já existe na Crew; falta oferecê-lo no D0, 1 vez, depois do card de compartilhar.
7. **Fala do líder em 3 momentos** (P).
8. **Recorde de território e aniversário de zona** (P/M), para manter a surpresa no D30.

---

## 5. Dez ideias novas de "momento de prazer"

> Todas respeitam a D-71 (SVG + Reanimated, sem som, vibração com intervalo ≥ 150 ms, "Reduzir movimento" vira fade de 150 ms) e a §3. Custo: **P** ≤ 1 dia · **M** 2 a 4 dias · **G** > 1 semana.

| # | Momento | O que acontece (específico) | Mecanismo | Onde entra | Custo |
|---|---|---|---|---|---|
| 5.1 | **"Primeiro trecho!"** (1 vez na vida) | Aos ~40 m da 1ª corrida, o rastro ganha um brilho que corre pela linha (opacidade de 0 para 1 e de volta, 400 ms), vibração leve e o selo "Primeiro trecho pintado" desliza do topo por 1,5 s | Sucesso garantido; antecipação confirmada | `run-screen.tsx` + `components/celebration/reward-toast.tsx` | P |
| 5.2 | **"Seu rastro agora é desta cor"** | Último quadro da cerimônia: uma linha de rota desenha-se em 600 ms na cor do time, e a moldura do avatar troca (escala de 0,9 para 1 com mola) | Marcador de identidade (camiseta do Splatfest) | `team-confirm.tsx` | P |
| 5.3 | **Líder comenta o feito** | No resumo, um balão com o rosto do líder e 1 frase ligada ao feito **real** ("3 trechos defendidos. Assim se segura a rua."), entrando 300 ms depois dos números. Catálogo de ~30 falas por líder, por tipo de feito | Personagem-guia; reconhecimento de competência (autodeterminação) | `summary-screen.tsx` + `components/art/leader` | P |
| 5.4 | **Recorde de território** | Se a corrida pintou mais trechos que qualquer outra da pessoa: o número conta de 0 até o valor com o rótulo "Recorde: 47 trechos", e o selo pulsa 2 vezes. Comparação só consigo mesmo | Surpresa melhor que o previsto (Schultz); "best efforts" do Strava | `summary-screen.tsx` + cálculo puro em `domain/progression.ts` | P |
| 5.5 | **Antes e depois do bairro** | No resumo, o mapa mostra as zonas **antes** da corrida e faz uma transição de 800 ms para o **depois**, com as zonas viradas acendendo uma por vez (intervalo de 120 ms, máx. 5) | Pico-fim; efeito IKEA ("eu mudei a cidade") | `summary-screen.tsx` (mapa estático, regiões suavizadas, nunca hexágonos) | M |
| 5.6 | **Golpe que abre fase** | Se a corrida da pessoa foi a que levou o chefão abaixo de 67% ou de 33%: o chefão "cambaleia" (animação de golpe existente), aparece a tarja "Você abriu a fase 2!" e os pontos fracos surgem | Contribuição visível em meta coletiva (efeito Köhler, F1) | Arena (Raid) + `components/celebration/boss.tsx` | M (servidor indica quem cruzou o limite) |
| 5.7 | **Eco da crew** | 1 vez por dia, agrupado: "Rafa reforçou 3 trechos que você pintou". Toque abre o mapa com os trechos em destaque. Nunca entre 22h e 7h | Relação (autodeterminação); prova social real | Feed da crew + central de avisos | M |
| 5.8 | **Carimbo de bairro novo** | 1ª corrida num bairro novo: no resumo, um "carimbo" de passaporte com o nome do bairro cai na tela (escala de 1,3 para 1 com mola e leve rotação), e a página "Atlas" ganha o carimbo | Exploração (motor de descoberta); colecionismo sem sorteio | `summary-screen.tsx` + perfil/Atlas | P/M |
| 5.9 | **Aniversário de zona** | Zona mantida pelo time por 30 dias com a pessoa entre os 3 que mais pintaram: o título "Guardião de Cambuí Norte" aparece no perfil, com uma cerimônia curta (escudo surgindo, 1,2 s) na próxima abertura | Constância > velocidade (Local Legend, F1); antídoto do "novato sem chance" | Perfil + Mapa (folha da zona) | M (servidor) |
| 5.10 | **A semana do time** | Na segunda, 1ª abertura: faixa no topo do Mapa na cor do time ("Volt Runners: 2º em Campinas, 312 km") e o mascote fazendo a pose de comemoração (ou de "bora virar" se perdeu). Some depois de 1 toque ou de 4 s | Destino comum (Faction Rally do Destiny); efeito do recomeço | Mapa (`map-screen.tsx`) + recap | M |

---

## 6. Perguntas para o coordenador

1. **Valor antes da conta:** aprovar mudar a ordem para Cidade → Times → Cerimônia → Cadastro (regra 2)? Mexe no guarda de rotas e no `choose_faction` pós-cadastro (E6 + E9).
2. **Push remoto:** os autores aceitam um build de desenvolvimento com push (EAS) antes da banca? Sem ele, os gatilhos de invasão e do chefão não chegam com o app fechado.
3. **Plano da próxima corrida:** aprovar o novo tipo de aviso `plano` (conta no limite de 1 por dia e 4 por semana)?
4. **Selo "Precisa de reforço":** liberar a RPC de contagem de ativos por time, usada só para um selo cosmético?
5. **Revisão jurídica:** confirmar com o orientador que o baú grátis, ganho correndo e com chances públicas, não é "caixa de recompensa" no sentido do art. 20 do ECA Digital e do Decreto 12.880/2026.

---

## 7. Fontes

> Força: **[forte]** · **[fraca]** · **[opinião]**. "Via busca" significa que li o trecho devolvido pela busca, sem abrir a página (o WebFetch está bloqueado neste ambiente).

**Neurociência e comportamento**
1. Schultz, Dayan e Montague (1997). A neural substrate of prediction and reward. *Science* 275:1593. https://www.gatsby.ucl.ac.uk/~dayan/papers/sdm97.html [forte]
2. Berridge e Robinson (1998). What is the role of dopamine in reward…? *Brain Res. Rev.* https://drugbank.ca/articles/A1545 [forte]
3. Berridge, Robinson e Aldridge (2009). Dissecting components of reward. *Curr. Opin. Pharmacol.* https://www.wisebrain.org/media/Papers/BerridgeRobinson&AldridgeDissectingcomponentsofrewardCurrentOpinPharm2009.pdf [forte]
4. Berridge e Robinson (2016). Liking, wanting, and the incentive-sensitization theory of addiction. *Am. Psychol.* https://pmc.ncbi.nlm.nih.gov/articles/PMC5171207/ [forte]
5. Nasser et al. (2017). The dopamine prediction error. *Front. Psychol.* https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5319959/ [forte]
6. Eyal (2014). *Hooked*. Críticas: https://www.thoughtworks.com/insights/blog/addicted-industry-matures [opinião]
7. Kivetz, Urminsky e Zheng (2006). The goal-gradient hypothesis resurrected. *JMR* 43(1). https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf [forte]
8. Nunes e Drèze (2006). The endowed progress effect. *JCR* 32(4). Resumo: https://coglode.com/nuggets/endowed-progress-effect [forte para o estudo; fraca para o 34%]
9. Ghibellini e Meier (2025). Interruption, recall and resumption: a meta-analysis of the Zeigarnik and Ovsiankina effects. https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html [forte]
10. Tajfel et al. (1971). Social categorization and intergroup behaviour. Resumo: https://en.wikipedia.org/wiki/Minimal_group_paradigm [forte para o estudo; o resumo é secundário]
11. Silverman e Barasch (2023). On or off track: how (broken) streaks affect consumer decisions. *JCR*. https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions · https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb [forte]
12. Ryan, Edney e Maher (2019). Anxious or empowered? *BMC Psychology*. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6607598/ [forte]
13. Humphreys, Jensen e Gluchowski (2025). Tracking the tension (pré-publicação). https://www.medrxiv.org/content/10.64898/2025.12.03.25341327.full.pdf [fraca]
14. Mazeas et al. (2022). Effects of gamification on physical activity: meta-analysis. *JMIR*. https://www.jmir.org/2022/1/E26779/ [forte]
15. Patel et al. (2019). STEP UP trial. *JAMA Intern. Med.* https://pennmedicine.org/news/news-releases/2019/september/using-a-wearable-device-to-exercise-more-add-competition-to-improve-your-results [forte; nota de imprensa da universidade]
16. Milkman et al. (2021). Megastudies improve the impact of applied behavioural science. *Nature* 600. https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost [forte]
17. Gollwitzer e Sheeran (2006). Implementation intentions and goal achievement: a meta-analysis. https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f [forte]

**Produtos e jogos**
18. Duolingo — streaks e hábito. https://blog.duolingo.com/how-duolingo-streak-builds-habit [fraca: oficial sem método]
19. Duolingo — separar a meta diária da sequência. https://blog.duolingo.com/improving-the-streak [fraca]
20. Duolingo — aposta de sequência e amuleto de fim de semana. https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals [fraca]
21. Duolingo — cadastro adiado (+20% de usuários ativos por dia). https://taplytics.com/blog/duolingo-ab-test-onboarding [fraca]
22. Duolingo — onboarding de 2024. https://uxdesign.cc/duolingos-onboarding-2-years-on-3cbccad139f7 [opinião]
23. Niantic — Ingress Prime (onboarding antes da escolha da facção). https://nianticlabs.com/blog/ingress-prime/ [forte]
24. Ingress — troca de facção (40.000 AP). https://ingress.wiki.gg/wiki/Faction (via busca) [fraca]
25. Pokémon GO — troca de time. https://pokemongo.com/news/teamchange2019 [forte]
26. Pokémon GO — atualização de níveis de 2025. https://pokemongo.com/en/news/pgo-leveling-update-details-2025 [forte]
27. Zombies, Run! — missão de abertura. https://zombiesrungame.com/episode/M-E01 e suporte (via busca) [fraca]
28. Nike Run Club — "comece leve" / planos. https://www.nike.com/a/running-goals [fraca]
29. Strava — análise do onboarding. https://screensdesign.com/articles/strava-onboarding-design/ [opinião]
30. Strava — Year in Sport 2025 (clubes ×4, 1 milhão). https://www.bikeradar.com/news/strava-year-in-sport-2025 [fraca]
31. Clash Royale — FTUE. https://www.pocketgamer.biz/ftue-clash-royale/ · https://blog.playtestcloud.com/first-time-user-experience-can-make-or-break-your-game/ [opinião]
32. Brawl Stars — personagem inicial e estrada de troféus. https://www.godisageek.com/2021/04/brawl-stars-brawlers-beginners-guide-and-play-it-on-pc [fraca]
33. Hogwarts Legacy — Cerimônia do Chapéu. https://www.videogameschronicle.com/guide/hogwarts-legacy-sorting-hat-guide/ · https://primagames.com/gaming/hogwarts-legacy-sorting-hat-house-choose-guide [fraca]
34. Splatoon 3 — Splatfest (voto, camiseta, travado). https://www.videogameschronicle.com/guide/splatoon-3-splatfest-start-time-options-and-how-to-pick-a-team · https://www.gfinityesports.com/guides/splatoon-3-conch-shells [fraca]
35. Splatoon 3 — Splatfest dos líderes da Deep Cut. https://nintendowire.com/news/2023/09/11/shiver-is-victorious-as-deep-cuts-leader-in-latest-splatfest-results/ [fraca]
36. Destiny 2 — classes. https://www.pcgamesn.com/destiny-2/destiny-2-class-guide · https://maxroll.gg/destiny-2/getting-started/first-steps-in-destiny-2 [fraca]
37. Destiny 2 — Faction Rally. https://www.gamespot.com/articles/destiny-2s-first-faction-rallies-winner-revealed-l/1100-6453751/ · https://www.destinypedia.com/Faction_Rally [fraca]

**Retenção**
38. https://enable3.io/blog/app-retention-benchmarks-2025 [fraca]
39. https://trysonar.app/blog/app-user-retention-benchmarks-and-what-moves-it [fraca]
40. https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/ [fraca]
41. https://www.braze.com/resources/articles/mobile-app-retention [fraca]
42. https://www.adjust.com/blog/what-makes-a-good-retention-rate/ [fraca]

**Ética e regulação**
43. ECA Digital, art. 20 (texto citado). https://www.tecmundo.com.br/voxel/502437-loot-boxes-serao-proibidas-no-brasil-apos-sancao-de-lula-entenda-impacto-da-lei-felca-nos-games.htm · https://www.poder360.com.br/poder-governo/eca-digital-entra-em-vigor-nesta-3a-feira-entenda-o-que-muda/ [forte para o texto]
44. Decreto 12.880/2026. https://www2.camara.leg.br/legin/fed/decret/2026/decreto-12880-18-marco-2026-798813-norma-pe.html · https://cesconbarrieu.com.br/eca-digital-regulamentado-o-que-sua-empresa-precisa-fazer-agora/ [forte para a existência; fraca para o detalhe]
45. MJSP — Nota Técnica 55 (caixas de recompensa sem verificação de idade). https://www.gov.br/mj/pt-br/assuntos/noticias-1/mjsp-pede-a-anpd-que-monitore-jogos-eletronicos-com-caixas-de-recompensa-que-nao-implementaram-verificacao-de-idade/NotaTcnican55.pdf [fraca]
46. Lei 14.852/2024. https://www2.camara.leg.br/legin/fed/lei/2024/lei-14852-3-maio-2024-795567-norma-pl.html · https://www.mayerbrown.com/ja/insights/publications/2024/05/brazil-passes-legal-framework-for-games-legislation [forte para a lei; fraca para o resumo]
47. Parlamento Europeu, 18/01/2023. https://gameworldobserver.com/2023/01/18/european-parliament-votes-against-loot-boxes-addiction [fraca]
48. Parlamento Europeu, 26/11/2025 (2025/2060(INI)). https://oeil.europarl.europa.eu/oeil/en/document-summary?id=1874426 [forte]
49. Lei de Equidade Digital (andamento). https://www.lewissilkin.com/insights/2026/01/14/european-commission-issues-responses-to-digital-fairness-consultation-102m1s7 · https://www.beuc.eu/sites/default/files/publications/BEUC-X-2026-019_Checklist_Towards_the_Digital_Fairness_Act.pdf [fraca]
50. Reino Unido — resposta do governo (2022). https://www.gov.uk/government/consultations/loot-boxes-in-video-games-call-for-evidence/outcome/government-response-to-the-call-for-evidence-on-loot-boxes-in-video-games [forte]
51. Reino Unido — princípios da indústria (2023). https://www.gov.uk/guidance/loot-boxes-in-video-games-update-on-improvements-to-industry-led-protections [forte]
52. Brignull — padrões enganosos. https://deceptive.design/book/contents/chapter-13 · https://www.boye-co.com/blog/2024/1/the-shadowy-world-of-deceptive-design [opinião]

**Do próprio projeto (não repetido aqui):** `docs/melhoria/F1/01-pesquisa.md` (§1–§18) e `docs/melhoria/F1/pesquisa/fichas-de-evidencia.md`.
