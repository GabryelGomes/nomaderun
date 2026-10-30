# F1 · 01 — Pesquisa de produto e comportamento (Equipe E1)

> **Fase:** F1 (descoberta) · **Data:** 23/10/2026 · **Equipe:** E1 — Pesquisa de produto e comportamento
> **Escopo:** o que faz as pessoas **abrirem, entenderem e voltarem** a Pokémon GO, Strava, Duolingo, Ingress, Nike Run Club e jogos de território por corrida, e a ciência por trás disso, traduzida em padrões concretos e **éticos** para o NOMADE RUN.
> **Não repete** `docs/pesquisa/01-mercado-e-concorrentes.md` (mercado, preços, números de usuários) nem `docs/pesquisa/05-apresentacao.md`. Parte deles e aprofunda.
> **Apoio:** `docs/melhoria/F1/pesquisa/fichas-de-evidencia.md` traz cada número com fonte, data e grau de confiança, para citar no TCC.

**Legenda.**
- **[incerto]**: não confirmei na fonte primária. Veio de fonte secundária, de fontes que se contradizem ou de dados antigos.
- **Fonte A**: oficial ou científica. **Fonte B**: imprensa especializada. **Fonte C**: blog, fórum ou loja de apps.
- **Ambiente:** o WebFetch e o `curl` foram bloqueados pelo proxy em quase todos os domínios. Tudo foi levantado por busca na web, lendo trechos das páginas, o que explica a quantidade de [incerto].

---

## 0. Resumo executivo: 10 coisas que o NOMADE deve adotar já

1. **A escolha de time precisa de um "porquê" antes do "qual".**
   - O Pokémon GO só oferece o time no nível 5, quando a pessoa já viu um ginásio e entende a disputa.
   - O NOMADE escolhe logo depois da conta (pedido do dono, R8). Para isso funcionar, mostre antes **6 s da cidade em disputa**: o mapa com as 4 cores pulsando e a frase "A cidade está dividida".
   - Depois vêm os 4 cards e a confirmação, com a cor inundando a tela.
2. **Pertencimento nasce rápido e se perde rápido.**
   - Num experimento com 940 jogadores de Pokémon GO, cada um cooperou mais com quem era do mesmo time.
   - Esse viés **enfraqueceu** à medida que o jogo perdeu popularidade.
   - Por isso, o time precisa de alimentação semanal: meta da semana do time, página do time e "o time pintou X km hoje".
3. **Recompensar constância, não velocidade.**
   - O Local Legend do Strava premia quem fez **mais esforços em 90 dias**, independentemente do ritmo.
   - Para o NOMADE, isso vira o título **"Guardião da zona"**: quem mais correu ali em 30 dias.
   - É o antídoto para o "iniciante sem chance".
4. **Sequência semanal, com recuperação e pausa.**
   - O próprio Strava usa sequência **semanal**: 1 atividade de segunda a domingo, e dá para recuperar a semana enviando a atividade depois.
   - O Apple Fitness passou a permitir **pausar** os anéis por até 90 dias sem perder a sequência.
   - O estudo de Lally (2010) mostra que perder 1 dia não atrapalha a formação do hábito.
   - Mantenha "2 corridas por semana", com 1 congelamento por mês e o botão **"Pausa (lesão ou descanso)"**.
5. **Premiar a volta, não punir a falta.**
   - No megaestudo com 61 mil pessoas, a melhor intervenção recompensava quem **voltava depois de faltar**: +27% de idas à academia.
   - No NOMADE: "Bônus de retorno" na primeira corrida depois de 7 dias parado, com texto acolhedor e sem culpa.
6. **O fim da corrida é o pico.**
   - Pela regra do pico-fim, a memória da experiência é feita do momento mais intenso e do final.
   - O resumo cinematográfico deve **terminar** no feito mais forte e oferecer o card do Instagram ali, no auge.
7. **O sticker transparente é o formato que o corredor quer.**
   - O Strava lançou em abr/2025 os "Stat Stickers": rota em traço e números, colados por cima da foto da própria pessoa nos Stories.
   - O NOMADE deve oferecer 3 modelos:
     - **sticker PNG transparente**, para colar sobre a foto;
     - **Story cheio** (1080×1920);
     - **feed** (1080×1350).
8. **Progresso dotado na missão de boas-vindas.**
   - No estudo do lava-rápido, o cartão que já vinha com 2 carimbos foi concluído por 34% dos clientes; o vazio, por 19%.
   - A missão "Corra 500 m" começa com a barra em 20% ("você já criou sua conta e escolheu o time").
   - A 1ª corrida deve conquistar uma zona **garantidamente** (pedido para E3).
9. **Notificação boa é rara, útil e sabe parar.**
   - O Duolingo escolhe o lembrete por pessoa (+2% de retenção de novos usuários).
   - Depois de semanas sem resposta, ele **para** de enviar e avisa.
   - O NOMADE adota: no máximo 1 de engajamento por dia, só das 7h às 22h, uma escada de reativação que termina em silêncio, e textos com até 60 caracteres.
10. **Copiar o que o Strava faz bem, evitar o que irrita a comunidade:**
    - paywall no que era grátis (Year in Sport pago, dez/2025);
    - comparação que faz a pessoa se sentir mal (Weekly Snapshot);
    - kudos de robôs;
    - feed entupido de atividades repetidas;
    - mapa de calor que expôs bases militares (2018).
    - Para o NOMADE: retrospectiva sempre grátis, comparação só consigo mesmo, reações só de quem correu, feed resumido e privacidade por padrão.

---

## 1. Pokémon GO

### 1.1 Primeira abertura (FTUE)
**O que fazem:**
- O Professor Willow se apresenta e pede o nome; em seguida vem a personalização do avatar, que pode ser mudada depois.
- Ele "encontra" um Pokémon perto do jogador e entrega Poké Bolas: a **primeira captura é guiada e garantida**. Os iniciantes clássicos aparecem em volta do jogador.
- Depois, o professor manda visitar uma PokéStop e "solta" o jogador no mundo. [incerto: o tutorial atual pode ter mudado desde 2016]
- Em 2021, a Niantic testou sugestão de apelido, mais dicas de treinador e uma pesquisa especial (história guiada) para novos treinadores.

Fontes: GameSkinny (2016); nintendowire.com (2016); pokemongo.com/post/ux-testing-2021 (13/10/2021).

**Por que funciona:**
- **Competência imediata:** uma vitória nos primeiros 60 s.
- **Personagem-guia:** dá um rosto às regras.
- **Investimento:** o avatar é "meu" (efeito IKEA).

**Como adaptar ao NOMADE:**
- Um **guia-personagem** apresenta a cidade. Sugestão: o líder do time aparece só depois da escolha; antes, quem fala é um "narrador neutro" da cidade (decisão de arte para E4).
- A 1ª vitória precisa ser **garantida e rápida**. Como o NOMADE exige correr, a vitória do dia 0 pode ser **simbólica**: "Seu time ganhou você. +1 corredor para os Volt Runners", com o contador do time subindo na tela. A vitória real vem na 1ª corrida (missão de boas-vindas).

### 1.2 Escolha de time
**O que fazem:**
- **Quando:**
  - no nível 5, ao tocar num ginásio, e o professor apresenta os 3 assistentes;
  - o jogador já jogou algumas horas e **viu** os ginásios coloridos antes de escolher.
- **Os líderes** (revelados na Comic-Con de San Diego, jul/2016):
  - cada um representa um **valor**: força e coragem (Candela, vermelho), sabedoria e análise (Blanche, azul), intuição (Spark, amarelo);
  - cada um vem com uma ave lendária como mascote;
  - a fala de cada líder tem 2 a 3 frases sobre o que o time valoriza, sem desmerecer os outros [paráfrase, sem copiar a fala].
- **A tela de escolha:** frase curta, a ave lendária e a silhueta do líder nas cores do time. [incerto: a animação exata de confirmação e a "cor inundando a tela" não foram confirmadas em fonte escrita; aparecem em vídeos e na memória da comunidade]
- **Depois da escolha:**
  - **a jogabilidade é a mesma** para todos os times;
  - o time muda os ginásios que você defende, os bônus de bolas na raid e o líder que avalia seus Pokémon (o "appraisal": o líder "fala" com você o jogo todo).
- **Troca de time:** só a partir de fev/2019, com o Team Medallion (1.000 moedas, cerca de US$ 8) e no máximo 1 vez a cada 365 dias. Antes disso, só criando uma conta nova.

Fontes: techcrunch.com/2019/02/21 · sportskeeda.com (guia de times) · inverse.com/article/18743 · gameinformer.com (24/07/2016) · pokemongo.fandom.com/wiki/Team_Leaders · androidcentral.com.

**Por que cria pertencimento:**
1. **Efeito de grupo mínimo (Tajfel):**
   - basta pertencer a um grupo, mesmo arbitrário, para surgir favoritismo;
   - Peysakhovich e Rand (Yale, 2017) testaram isso com 940 jogadores de Pokémon GO em dilema do prisioneiro: **cooperaram mais com o próprio time**;
   - o viés **diminuiu** quando o jogo perdeu popularidade, ou seja, ele surge rápido mas é frágil (nationalaffairs.com, "all on the same page") [incerto: não confirmei publicação revisada por pares].
2. **Território reforça a identidade:**
   - Laato et al. (2021) analisaram ~243 mil mensagens de jogadores; o conflito por território virtual **reforçou a polarização** entre times (Internet Research, doi 10.1108/INTR-03-2020-0158);
   - em 515 jogadores, a identificação com o time previu **intensidade de jogo** e comportamento territorial (HICSS 2021, "Landlords of the Digital World").
3. **Escolha escassa = escolha importante:** trocar é caro e raro, então a escolha pesa.
4. **Valor em vez de vantagem:** como os times são iguais nas regras, a escolha é **identitária**: "quem eu sou", não "qual é o melhor".

**Como adaptar ao NOMADE:** tela detalhada na §11, passos 4 a 7. Regras derivadas da pesquisa:
- **Antes de escolher, mostrar a disputa:** 6 s do mapa da cidade pintado nas 4 cores, com a frase "A cidade está dividida. De que lado você corre?". Isso substitui as "horas de contexto" que o Pokémon GO dá antes do nível 5.
- **Cada time = 1 valor + 1 estilo**, nunca uma vantagem. Já é regra no prompt §9. Manter "só cosmético".
- **O líder fala em 2 frases:** a 1ª é o valor ("Nós corremos em matilha: ninguém fica para trás"); a 2ª é o convite ("Vem com a gente?"). **Nunca falar mal de outro time** (a pesquisa de Laato mostra que o conflito já polariza sozinho).
- **"Não sei escolher"** abre um quiz de 3 perguntas. A escolha continua livre e o resultado do quiz só **pré-seleciona**.
- **Escassez saudável:** "Você pode trocar 1 vez por temporada" (o servidor já faz isso). Mostrar a regra **antes** de confirmar, em 1 linha.
- **Manter o pertencimento vivo,** porque o viés de grupo é frágil: o time aparece no Mapa ("Volt Runners: 312 km hoje na cidade"), na meta semanal do time, no recap semanal e na voz do líder nas celebrações épicas.
- **Equilíbrio dos times:**
  - o Pokémon GO tem um time historicamente menor (Instinct), alvo de piada da comunidade (mein-mmo.de);
  - no NOMADE, mostre "time precisando de reforço" com **bônus cosmético** (selo "Reforço") e nunca de pontos;
  - pedido para E3: confirmar se um time pequeno não perde a cidade por tamanho, com normalização por ativos.

> **Alerta de saúde e segurança sobre os Night Owls.**
> - O lema atual em `theme/tokens.ts` é "Donos da madrugada", e o prompt §9 propõe "Owls = corridas noturnas".
> - Segundo a pesquisa anterior (01, §4), 32% das mulheres citam medo de roubo ou assédio como barreira.
> - Recomendação: a identidade dos Owls deve ser **"corredores do fim do dia, das luzes da cidade"**, sem nunca premiar com pontos correr de madrugada e sem incentivar rotas escuras.
> - Pedido para E4 (bio e lema) e E3 (garantir que nenhuma regra dê vantagem por horário).

### 1.3 Raids (chefões)
**O que fazem:**
- **Sala de espera:** 120 s, contados a partir do primeiro jogador. Se todos tocam "Pronto", a contagem cai para 10 s. Cabem até 20 jogadores por sala.
- **Batalha:** 180 s nas raids de nível 1 a 4 e 300 s no nível 5 e nas Mega.
- **Passe:** só é gasto quando a batalha começa e permite tentar de novo até o tempo do chefão acabar.
- **Raid remota:** limitada a 5 por dia desde 06/04/2023.
- **Party Play** (17/10/2023): grupo de até 4 pessoas **fisicamente próximas**. Cada ataque rápido carrega a "Party Power", que dobra o próximo ataque carregado; quanto mais membros, mais rápido carrega.

Fontes: bulbapedia (Raid Battle (GO)) · pokemongo.fandom.com/wiki/Raid_Battle · nintendolife (10/2023) · techxplore (10/2023).

**Por que funciona:**
- **Significado épico** e **pertencimento**: ninguém derrota sozinho.
- **Escassez real:** o chefão some quando o tempo acaba.
- **Antecipação** com contagem regressiva e vida visível (Schultz: a dopamina responde à **previsão** da recompensa).

**Como adaptar ao NOMADE** (Raid hoje é só demonstração; pedido para E3 e E9):
- **Um "Chefão da semana" por cidade,** com vida global = km que a cidade precisa correr. Exemplo: 300 km numa cidade pequena, calibrado por ativos (E3 simula).
- **Cada 100 m corridos = 1 golpe.** No resumo, os golpes viram **números de dano flutuando** e a barra de vida descendo (E5).
- **Janela de 7 dias,** que fecha domingo às 20h e mostra "faltam 2 d 4 h" no card. Escassez **verdadeira**: a contagem nunca é inventada.
- **"Golpe em grupo"** (o equivalente da Party Power): correr com 2 ou mais pessoas da crew a até 50 m umas das outras dá ×1,25 de dano. Isso usa o bônus de grupo que já existe no domain.
- **Recompensa:** todos que deram pelo menos 1 golpe ganham a medalha do chefão. O top 3 por time ganha uma moldura cosmética.
- **Sem "passe de raid"** e sem limite pago. Nada de vender tentativa.

### 1.4 Adventure Sync e metas semanais
**O que fazem:**
- O Pokémon GO conta a distância caminhada com o app fechado e, **toda segunda às 9h (horário local)**, entrega a recompensa da semana anterior.
- As faixas são **5, 25, 50 e 100 km**, cada uma com recompensa maior que a anterior (a de 100 km foi adicionada depois e quase não aparece na interface).
- Quem passa do teto não ganha mais nada.

Fontes: pogo.gamepress.gg · mein-mmo.de (recompensa semanal) · bulbapedia (Adventure Sync). [incerto: valores de poeira estelar mudaram com o tempo]

**Por que funciona:**
- **Meta fixa e semanal:** o descanso não pune.
- **Faixas:** cada pessoa escolhe a sua (autonomia).
- **Recompensa num dia fixo:** é um ritual de segunda-feira, que coincide com o **efeito do recomeço** (Dai, Milkman e Riis, 2014: academias enchem no início da semana).

**Como adaptar ao NOMADE:** **"Meta da semana"**:
- faixas **5, 15 e 30 km** (corredor de rua iniciante faz cerca de 10 a 15 km por semana) [proposta, E7 calibra];
- **recap e baú da semana entregues na segunda às 8h** (dentro da janela 7h–22h).

### 1.5 Amizade e presentes
**O que fazem:**
- **Níveis de amizade** por dias de interação: Bom (1 dia), Ótimo (7), Ultra (30) e Melhor (90).
- O nível só sobe **1 vez por dia por amigo**: abrir presente, raid junto, troca ou batalha contam.
- **Bônus por nível:** dano de raid de +3%, +5%, +7% e +10%, e bolas extras na captura.

Fontes: serebii.net/pokemongo/friends.shtml · pogo.gamepress.gg · bulbapedia (Friends (GO)).

**Por que funciona:** reciprocidade, progresso lento e um "ritual diário" leve que não exige jogar muito.

**Como adaptar ao NOMADE (P2):** **"Parceiros de corrida"**: níveis por **corridas juntos** (mesma hora e mesmo lugar), por exemplo 1, 5, 15 e 40 corridas. O bônus é só cosmético, como o rastro duplo no mapa.

### 1.6 O alerta científico do Pokémon GO
- **Howe et al. (BMJ, 2016)** acompanharam 1.182 jogadores de 18 a 35 anos.
- Na **1ª semana** depois de instalar o jogo, eles deram **+955 passos por dia**, cerca de 11 minutos a mais de caminhada.
- Em **6 semanas**, os passos **voltaram** ao nível de antes.

Fonte: pmc.ncbi.nlm.nih.gov/articles/PMC5154977.

**Lição:** a novidade acaba em cerca de 6 semanas. Os loops **semanais e de temporada** (§13 do prompt) não são enfeite: são o que mantém a pessoa depois que a novidade passa. A FTUE de 7 dias e a 1ª temporada precisam estar prontas no lançamento.

---

## 2. Strava

### 2.1 Feed, kudos e comentários
**O que fazem:**
- **Feed** com o mapa de cada atividade.
- **Kudos:** 1 toque.
- **Comentários livres.**

**Por que funciona:** reciprocidade e reconhecimento social.
- **Universidade Radboud:** acompanhou 329 corredores de 5 clubes por 1 ano. Quem recebeu mais kudos passou a **correr mais**, e alguns mudaram rotas e esforço para ter atividades "dignas de kudos".
- **Bekhuis e Tolsma:** quem recebeu kudos na Seven Hills Run de 2019 teve mais chance de se inscrever na prova seguinte.
- **Hallgren, Rønne e Wagner (Copenhague):** os kudos motivam e **criam pressão de desempenho**.

Fontes: runningmagazine.ca/?p=91520 · voxweb.nl · idrottsforum.org/hallgrenetal260512. [incerto: os dois primeiros estudos são observacionais e foram lidos pela imprensa]

**O que a comunidade reclama:**
- **Robôs e spam:** contas falsas dando kudos, pedindo para seguir e chamando para clubes (road.cc, notícia 239593).
- **Feed entupido** de idas e voltas do trabalho repetidas, até a pessoa parar de dar kudos (fóruns no road.cc).
- **Mensagens automáticas** ("Wow Nice Work") sem opção de desligar (singletrackworld, nov/2023).

**Como adaptar ao NOMADE:**
- A reação **"Bora!"** (prompt §14) só pode vir de **quem correu pelo menos 1 vez nos últimos 30 dias** e é da crew ou é amigo. Isso corta robôs na origem.
- **Sem comentários livres** no MVP (moderação pesada). Use **3 reações fixas com ícone**: "Bora!", "Que ritmo!", "Defendeu bem!".
- **Feed resumido:** juntar atividades repetidas ("Ana correu 3× esta semana · 14 km") em vez de 3 cartões iguais.
- **Notificação de reação agrupada,** 1 por dia no máximo: "5 pessoas mandaram Bora! hoje".

### 2.2 Clubes
**O que fazem:**
- Em 2025, os clubes quase **quadruplicaram** e passaram de 1 milhão; os de corrida cresceram 3,5×.
- Os eventos organizados por clubes cresceram cerca de 1,5×.
- Em jul/2026 entrou a aba **Eventos**, com filtros por data, local, formato e distância. As afiliações a clubes de corrida cresceram mais de 59% em 2025.
- Os clubes têm posts de administradores (avisos, rotas, perguntas), ranking semanal (top 10) e eventos.
- A Geração Z vê o clube de corrida como **infraestrutura social**, "no lugar de bares e apps de namoro".

Fontes: bike-magazin.de (relatório 2025) · insider.fitt.co (03/12/2025) · 9to5mac.com/2026/07/09 · endurance.biz (2026) · sportive.com.

**Por que funciona:** pertencimento local e encontro presencial. O efeito **Köhler** reforça: quem treina com um parceiro um pouco melhor **persiste mais** (Feltz, Kerr e Irwin, 2011; em estudos com parceiro virtual, a persistência subiu de 15% a 125%, conforme a tarefa) (sciencedaily.com 2011/05/110518161707; PMC4991586).

**Como adaptar ao NOMADE:** a crew já existe (RF-011 🟡). Faltam:
- **meta semanal da crew**, uma barra só, por exemplo "Crew COY: 46/80 km";
- **"Correndo agora"**: bolinha verde em quem está em corrida, **sem posição** (privacidade);
- **Encontro da crew:** evento com data e ponto de partida. P2, porque precisa de servidor.

### 2.3 Desafios mensais e medalhas
**O que fazem:**
- **Formato:** desafios de 1 dia a 1 mês, com meta de distância, tempo, altimetria ou dias ativos.
- **Progresso:** barra de progresso visível.
- **Recompensa:** **medalha digital na Estante de Troféus** ao concluir; alguns desafios de marca dão cupom.

Fontes: support.strava.com/hc/en-us/articles/216919177 · findyouredge.app (2026).

**Como adaptar ao NOMADE:** **"Desafio do mês"**:
- 1 por mês, ligado à temporada, por exemplo "Outubro: 50 km pela cidade";
- **medalha ilustrada pelo E4**, com 3 estados: bronze ao bater 50% da meta, prata em 100% e ouro em 150%;
- **Estante de medalhas** no Perfil, com as medalhas ainda não ganhas **em silhueta** (antecipação).

### 2.4 Segmentos, KOM/QOM e Local Legend
**O que fazem:**
- **KOM e QOM** premiam o **mais rápido** de um trecho.
- **Local Legend** (2020) premia quem fez **mais esforços no trecho em 90 dias móveis**, sem importar o ritmo.
- O título muda de dono quando os esforços antigos saem da janela, e há título geral e título feminino.

Fontes: dcrainmaker.com/2020/06/strava-legends-feature.html · androidcentral.com · zwiftinsider.com.

**Por que funciona:**
- O KOM é inalcançável para 99% das pessoas.
- O Local Legend premia **constância**, que **qualquer pessoa** pode ter. É competência alcançável, dentro da teoria da autodeterminação.

**Como adaptar ao NOMADE:** **"Guardião da zona"**:
- o título vai para quem **mais correu naquela zona nos últimos 30 dias** (contagem de corridas, não de ritmo nem de km);
- aparece na folha da zona (`zona/[id]`) com coroa de louros e "Você: 4 corridas · Guardião: 7";
- **Rei do trecho** (já listado na pesquisa 01) fica como versão rápida e opcional, mas o destaque visual é do Guardião;
- é o principal antídoto para "iniciante sem chance" (§6). Pedido para E3: o Guardião ganha só **título e moldura**; se ganhar algum bônus de defesa, que seja pequeno.

### 2.5 Recordes pessoais, melhores esforços, parciais e ritmo
**O que fazem:**
- **Melhores esforços** automáticos (400 m, 1 km, 1 milha, 5 km, 10 km…) e troféus de PR (1º, 2º e 3º melhor).
- **Parciais por km** e gráfico de ritmo.
- **Página de detalhes da atividade** redesenhada em abr/2025: tela cheia, com melhores esforços e conquistas de segmento **marcados ao longo da rota**.

Fonte: bikeradar.com (strava-sticker-stats-spring-2025-updates).

**Como adaptar ao NOMADE** (RF-006 🟡):
- **parciais por km** em barras horizontais, com a mais rápida em laranja;
- **recordes automáticos** de 1, 5 e 10 km e da maior distância;
- a **comemoração épica** de PR fica **só** para a melhor marca da vida, para não banalizar.

### 2.6 Compartilhar no Instagram (Stories, sticker de rota, modelos)
**O que fazem:**
- Em **03/04/2025** o Strava lançou os **Stat Stickers**: um adesivo com distância, altimetria e tempo, **o desenho da rota em traço** e o logo.
- Ele é exportado direto para os Stories ou baixado para usar em outras redes.
- O sticker se cola **por cima de qualquer foto** dentro do Instagram.
- **Requisito:** a atividade precisa estar visível para "todos" ou "seguidores"; atividade privada não compartilha.
- Antes disso, a comunidade recortava capturas de tela (remove.bg) ou usava apps de terceiros (FitnessOverlays, Runflick), o que mostra uma **demanda reprimida pelo formato transparente**.

Fontes: bikeradar.com (sticker stats, primavera de 2025) · communityhub.strava.com (Use Strava Stats Stickers on IG Stories) · remove.bg/b/strava-overlay-for-instagram-stories-and-posts · runflick.com/blog/share-strava-on-instagram.

**Como a integração técnica funciona** (Meta for Developers, "Sharing to Stories"):
- **Camadas:** o compositor dos Stories tem duas, um **fundo** (imagem ou vídeo, mínimo 720×1280, proporção 9:16) e um **sticker** (imagem, recomendado 640×480).
- **iOS:** usa a área de transferência e o esquema `instagram-stories://`, com o `appID` do Facebook (exigido desde jan/2023, segundo o react-native-share).
- **Android:** usa a intent `ADD_TO_STORY`.

Fonte: developers.facebook.com/docs/instagram-platform/sharing-to-stories.

> **Restrição do Expo Go (pedido para E8 e E2).**
> - A integração direta com os Stories exige código nativo (área de transferência com chaves próprias e esquema de URL), algo que o Expo Go provavelmente não oferece.
> - **Caminho seguro:** gerar o PNG (captura de view, **se** `react-native-view-shot` vier no Expo Go SDK 57) e abrir o menu do sistema com `expo-sharing`. A pessoa escolhe "Instagram → Stories".
> - Para o sticker transparente, salvar o PNG com fundo alfa na galeria; a pessoa cola com o sticker "Foto" do Instagram.
> - [incerto: confirmar na documentação do SDK 57]

**Como adaptar ao NOMADE:**
- **Modelo 1, Sticker:** PNG **transparente**, 1080×1080, com a rota neon em traço grosso (6 px), 3 números (km, tempo, ritmo), o emblema do time e o logo pequeno. É o formato "por cima da minha foto".
- **Modelo 2, Story:** 1080×1920, com mapa escuro, rota, números, mascote do time e "+2 zonas para os Volt Runners".
- **Modelo 3, Feed:** 1080×1350, mesmo conteúdo em grade.
- **Variações por feito:** zona conquistada, nível novo, chefão derrotado, recap semanal e "Seu ano no NOMADE" (prompt §14).
- **Privacidade antes de tudo:** cortar ou desfocar a rota dentro das zonas de privacidade, **sempre**, e mostrar na pré-visualização um selo "Início e fim ocultos".

### 2.7 Sequência semanal (o Strava já faz)
**O que fazem:**
- A sequência continua se houver **pelo menos 1 atividade de segunda a domingo** (60 s ou mais, de qualquer tipo).
- É possível **recuperar** a semana enviando depois a atividade que não foi enviada.
- Mostra faixas nas semanas 2 a 5 e nos marcos de 10, 15 e 25 semanas.
- **Não dá para desligar** esses avisos, e isso é uma reclamação.

Fonte: support.strava.com/hc/en-us/articles/36553427481997-Streaks-on-Strava.

**Para o NOMADE:** valida a decisão do prompt §5.4 (sequência semanal). Melhorias sobre o Strava:
- **marcos raros e bonitos** (4, 12, 26 e 52 semanas);
- **aviso de sequência desligável** em Preferências;
- **congelamento automático** (1 por mês) aplicado sem pedir, com aviso: "Usamos 1 congelamento. Sua sequência está salva."

### 2.8 Year in Sport e recaps
**O que fazem:**
- Retrospectiva anual personalizada, **grátis desde 2016**.
- Em **dez/2025** passou a ser **só para assinantes** (cerca de US$ 80 por ano), com revolta em Reddit e Facebook.
- O Strava justificou que "insights e storytelling" (Year in Sport e cartões mensais) agora são da assinatura.

Fontes: road.cc (strava-year-sport-now-only-subscribers-317425) · t3.com ("Dear Strava, we have a paywall problem…") · gadgetsandwearables.com/2025/12/20.

**Para o NOMADE:**
- **Recap semanal e "Seu ano no NOMADE" sempre grátis** (está alinhado à monetização da pesquisa 01: "retrospectiva sempre grátis").
- É o conteúdo mais compartilhável e um motor de aquisição gratuito. Esconder atrás de paywall é perder divulgação.

### 2.9 Beacon (segurança)
**O que fazem:**
- Desde ago/2021, o Beacon pelo celular é **grátis**.
- Ele compartilha a localização ao vivo com até 3 contatos por link enviado por SMS; quem recebe não precisa ter conta.
- O envio automático a partir de relógios conectados continua pago.

Fontes: androidauthority.com (strava-beacon-location-sharing-2741621) · cyclingweekly.com · road.cc 286033.

**Para o NOMADE:** a Corrida Segura já supera o Beacon gratuito (5 contatos, SOS e alerta de parada). Falta a **Escolta ao vivo** de verdade (RF-024 🟡). Na interface:
- o botão de segurança fica **sempre a 1 toque** na corrida;
- o onboarding **apresenta** a Corrida Segura com 1 ilustração (sem obrigar a configurar).

### 2.10 Mapa de calor e privacidade
**O que aconteceu:**
- Em **jan/2018**, o mapa de calor global do Strava revelou **bases militares**, inclusive desconhecidas, pelos padrões de corrida de soldados.
- O Strava respondeu que atividades privadas e zonas de privacidade já ficavam de fora, mas foi criticado por "jogar a responsabilidade no usuário".
- Em **ago/2021** e **2024** (Quick Edit), passou a permitir **esconder ritmo, frequência cardíaca, horário de início e calorias** de cada atividade, a maior parte para todos os usuários.

Fontes: wareable.com · bikeradar.com · dcrainmaker.com/2021/08/privacy-features-options.html · tomsguide.com (Quick Edit).

**Para o NOMADE:**
- **Zona de privacidade sugerida no 1º uso:** "Quer esconder o começo e o fim das suas corridas? (recomendado)", já com 200 m pré-marcados em volta do 1º ponto de partida.
- **Esconder o ritmo** no card e no feed (toggle). Ajuda quem tem vergonha do próprio ritmo, que é uma barreira real de iniciante.
- **Mapa de calor (RF-013):** só **pessoal** (sem ranking) e, se um dia for da cidade, agregado com piso mínimo de pessoas por célula. Pedido para E9.

### 2.11 O que a comunidade reclama (síntese)
| Reclamação | Evidência | Lição para o NOMADE |
|---|---|---|
| Paywall no que era grátis | Year in Sport pago (dez/2025); preço subiu de 15% a 70% em 2023 ("we just moved too fast") | Núcleo, segurança e retrospectivas sempre grátis |
| Comparação que faz mal | Weekly Snapshot "serve para me fazer sentir mal" (road.cc 307315); ansiedade de desempenho em corredoras (scmp.com 3288995); tese da utupub.fi (pressão) | Comparar **só consigo mesmo**; "semana passada" só se for para cima; toggle para esconder |
| Robôs e spam de kudos | road.cc 239593 | Reação só de quem corre e é da crew ou amigo |
| Feed poluído | fóruns (idas ao trabalho repetidas) | Feed resumido por pessoa e por semana |
| Avisos que não desligam | Sequência sem opção de desligar (suporte do Strava) | Toda notificação tem toggle por tipo |
| Fraude em placar | 3,9 mi de atividades removidas por e-bike (endurance.biz 2026) | Antifraude do NOMADE (HMAC, recálculo no servidor) + "corrida contestada" visível |
| Briga com parceiros | Processo contra a Garmin aberto em 30/09/2025 e retirado em 21/10/2025 depois da revolta dos usuários (bikeradar, techradar) | Exportar GPX livremente; não prender dados |
| Treino excessivo e lesão | marathonhandbook.com (does-strava-promote-unhealthy-training-habits); pogophysio | Sem incentivo a volume diário; mensagens de descanso |

---

## 3. Duolingo

**O que fazem e o que se sabe com números:**
- **Mais de 600 experimentos** na sequência em 4 anos (Lenny's Podcast, com Jackson Shuttleworth, recall.it).
- **Streak Wager** (aposta de gemas na própria sequência): aumentou a retenção em D1, D7 e D14, com **+14% em D7**. O pico em D7 coincide com o dia em que a recompensa sai (making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals).
- **Separar a meta diária da sequência** (basta 1 lição para manter a sequência): **+3,3% em D14** (blog.duolingo.com/improving-the-streak).
- **"Amuleto de fim de semana"** (protege a sequência no fim de semana): cerca de +4% de volta 1 semana depois e cerca de 5% a menos de sequências perdidas [incerto: fonte secundária, viblo.asia].
- **Notificações:**
  - o algoritmo "Recovering Difference Softmax" escolhe o lembrete por pessoa, dia a dia;
  - resultado: **+0,5% de usuários ativos por dia e +2% de retenção de novos usuários** (Yancey e Settles, KDD 2020, research.duolingo.com/papers/yancey.kdd20.pdf);
  - antes, o modelo de lembrete era sorteado.
- **Parar de insistir:** depois de cerca de 1 mês sem abrir, chega "Parece que esses lembretes não estão funcionando. Vamos parar por enquanto." e o envio de push para no dia seguinte (debugger.medium.com "duolingo needs to chill"; uxdesign.cc "duolingos-6-step-reactivation-experience").
- **Ligas:** 10 divisões (Bronze a Diamante), grupos de **30 pessoas** por semana e promoção ou rebaixamento por XP [incerto: os cortes variam por divisão nas fontes].
- **Usuário "ressuscitado":** quem ficou 30 dias ou mais inativo e voltou. O Duolingo trata como "quase recomeço" (blog.duolingo.com/back-from-the-brink…).
- **O mascote:** Duo celebra, torce e "cobra". Em fev/2025, a marca "matou" o Duo e o "ressuscitou" com XP coletivo (cerca de 50,9 bilhões) (npr, via wusf.org 26/02/2025).
- **Resultado do conjunto:** o churn mensal caiu de cerca de 47% (2020) para cerca de 37% depois das mudanças de 2022 (sensortower.com) [incerto: estimativa de terceiros].

**Por que funciona:**
- **Aversão à perda** (a sequência é "minha").
- **Compromisso** (a aposta).
- **Personalização** do gatilho (Fogg: prompt certo na hora certa).
- **Competição entre pares do mesmo tamanho** (grupo de 30).

**O que é tóxico e não copiar:**
- **Culpa:** o Duo "triste", "você decepcionou o Duo", o meme do mascote ameaçador e a campanha da "morte".
- **Sequência diária** (pune descanso, e correr todo dia lesiona).
- **Liga que exige moer XP** (favorece quem tem tempo).

**Como adaptar ao NOMADE:**
- **Aposta da sequência (P2):** "Aposte 1 congelamento: corra 2× por semana por 3 semanas e ganhe 2". O pico de D7 do Duolingo sugere entregar a 1ª recompensa da aposta **no dia 7**.
- **Separar meta de sequência:** a sequência semanal pede 2 corridas de **qualquer distância ≥ 1 km**; a meta de km é outra barra. Nunca exigir distância para manter a sequência.
- **Liga semanal do bairro:**
  - **30 pessoas** de nível parecido, pontuadas por **corridas e zonas**, não por km brutos (E3 define);
  - **promoção dos 7 primeiros** e rebaixamento só dos 3 últimos que **correram** (quem não correu fica parado, sem cair: descanso não pune);
  - [proposta, E3 e E7 calibram].
- **Reativação que sabe parar:** escada na §12.3.
- **Mascote expressivo sem culpa:** o mascote do time **comemora** e **chama**, mas nunca chora nem ameaça. Pedido para E4 e E5: as 3 poses do prompt (parado, vitória, derrota) com "derrota" = **cansado, ofegante e sorrindo**, não triste.

---

## 4. Ingress: campos de controle e "fechar áreas"

**O que fazem:**
- **Portais e links:** duas facções disputam portais; ligar 2 portais exige a chave do portal de destino, que é gasta na ligação.
- **Campos:** **3 portais ligados em triângulo** formam um **campo de controle**, que captura "Mind Units" (MU) proporcionais à **área × densidade populacional**.
- **Camadas:** campos sobrepostos somam MU, o que é uma estratégia avançada.
- **Alcance:** portais de nível mais alto permitem links mais longos e, portanto, campos maiores.

Fontes: ingress.fandom.com · fevgames.net/ingress/ingress-how-to-play-series · tomsguide.com (dicas para iniciantes).

**Por que funciona:**
- **Estratégia espacial** (pensar o mapa) e **cooperação** (um campo grande exige equipe).
- **Recompensa proporcional ao desenho** (criatividade).

**O que frustra:**
- **Campos gigantes** feitos por grupos organizados cobrem cidades inteiras.
- Para o novato, o mapa **já está tomado** e ele não consegue fazer nada visível.

**Como adaptar ao NOMADE** (candidato para E3 simular, **não** é decisão):
- **"Cerco do bairro":** quando o time domina **todas as zonas da borda** de uma região pequena (por exemplo, um anel de 6 a 8 zonas H3 em volta de 1 a 7 zonas internas), as zonas internas ficam **"Protegidas" por 24 h** e o time ganha um selo de conquista no recap.
- **Teto de tamanho:** o efeito vale só para regiões de no máximo cerca de 1 km² (anel de 1 a 2 células). Assim, campos gigantes não cobrem a cidade e o novato sempre tem onde agir.
- **Visual:** borda do cerco com contorno duplo na cor do time e brilho; nunca mostrar a grade (regra do projeto).
- **Explicável em 1 frase:** "Cerque um bairro com seu time e ele fica protegido por 1 dia."

---

## 5. Nike Run Club

**O que fazem:**
- **Níveis de corredor por cor,** conforme a distância total no app:

  | Cor | Distância total |
  |---|---|
  | Amarelo | 0–49 km |
  | Laranja | 50–249 km |
  | Verde | 250–999 km |
  | Azul | 1.000–2.499 km |
  | Roxo | 2.500–4.999 km |
  | Preto | 5.000–14.999 km |
  | Volt | 15.000 km ou mais |

  A cor do nível aparece no relógio durante a corrida (nike.com/help/a/nrc-run-level; 9to5mac.com 30/03/2020).
- **Troféus** de recordes (5 km mais rápido, maior corrida), **medalhas mensais**, acompanhamento de sequência e desafios semanais e mensais (notas de versão no apkmirror, 2020–2023).
- **Corridas guiadas por áudio** com treinadores e atletas.

[incerto: não confirmei os nomes atuais dos treinadores nem o catálogo de 2025–2026]

**Por que funciona:**
- **Identidade visível** ("sou corredor verde").
- **Progresso de longo prazo que nunca regride** (distância total só sobe).
- **Voz humana** na corrida (pertencimento e competência).

**Como adaptar ao NOMADE: "Faixa de corredor".**
- **Conflito de cor:** os times **já usam azul, verde, vermelho e amarelo**. Faixas por matiz (como no NRC) confundiriam "sou verde" (Volt) com "sou faixa verde".
- **Recomendação:** faixas por **material ou brilho**, numa moldura do avatar: Asfalto → Bronze → Prata → Ouro → Neon → Holográfico → Lenda. A cor do time continua dona da identidade.
- **Limiares para iniciante,** com a 1ª subida em 1 a 2 semanas, porque o NRC só muda aos 50 km, o que é longe para quem começa:

  | Faixa | Distância total |
  |---|---|
  | Asfalto | 0 km |
  | Bronze | 10 km |
  | Prata | 50 km |
  | Ouro | 150 km |
  | Neon | 400 km |
  | Holográfico | 1.000 km |
  | Lenda | 2.500 km |

  [proposta, E7 calibra com o XP]
- **Voz do líder** como "corrida guiada leve": o guia por voz já existe (RF-025 ✅). Acrescentar **1 frase do líder do time** no km 1 e na conquista ("Zona nossa! Segue firme.") e deixar o resto como está.

---

## 6. Jogos de território por corrida

| App | Mecânica | O que dá certo | O que frustra | Fontes |
|---|---|---|---|---|
| **INTVL** (Austrália) | Fechar loop captura a área; passar por cima rouba; 1 km² = 1 participação em sorteio mensal | Viral no TikTok; 2,5 mi+ de downloads em 182 países [autodeclarado]; modo bike (2026) | Território **roubado em horas** (quem anda ou pedala toma o que o corredor levou a semana para pintar); pedidos para **separar corrida e caminhada**; pedido para **fortificar**; suspeita de trapaça; ranking por área **acumulada** em vez de **mantida**; risco de volume excessivo para iniciantes | apps.apple.com/app/id6472631698; justuseapp.com; sportssteps.com; bikerumor.com; kotaku.com/download/intvl |
| **KYRO** (Coreia, jan/2026, Movements Lab) | Loop fechado (início e fim a até 50 m, largura de 20 m ou mais) vira território no mapa da cidade; clubes defendem juntos; ranking por bairro | Mapa compartilhado da cidade; clubes cooperando | Regra de loop **contraditória** entre a loja e o site; GPS distorce sob viadutos e no centro, e a área "não conta" depois de correr; bateria | rundida.com (guia KYRO); dexerto.com 3389630 |
| **Turf** (Suécia) | Ficar cerca de 20 s **dentro** da zona para tomar; pontos por tomar e **por hora mantida**; não retoma a mesma zona em 23 h; **reset mensal** | Comunidade fiel; temporada mensal; regra única ("estar lá") | Precisa parar na zona (ruim para corrida contínua) | en.wikipedia.org/wiki/Turf_(video_game); esoc.org.uk; geograph.ie 7380865 [regras de tempo: incerto] |
| **Run An Empire** (Reino Unido) | Grade hexagonal; cercar áreas; detecta "marcha irreal" pelo acelerômetro | Antifraude simples | Hexágonos visíveis (poluição); bateria; nicho | fitness-gaming.com; applevis.com |
| **Zonner** | [incerto: não encontrado em nenhuma busca; a pesquisa 06 o cita como "pinta as ruas internas do loop"] | — | — | — |

**Padrões que frustram** (confirmados ou recorrentes):
1. **Roubo rápido sem defesa:** horas de esforço apagadas por uma volta de outra pessoa.
2. **Modalidades misturadas:** bike e caminhada contra corrida.
3. **Loop gigante domina:** quem faz 20 km fechando um polígono enorme apaga dezenas de pessoas.
4. **Iniciante sem chance:** o mapa já está tomado.
5. **Mapa poluído:** grade e polígonos sobrepostos.
6. **GPS urbano ruim** faz a corrida "não contar" sem explicação.
7. **Volume excessivo:** perseguir território todo dia.

**O NOMADE já resolve parte disso:** H3 + esforço relativo + teto diário + escudo + decaimento + temporada + regiões suavizadas sem grade. **Recomendações extras para E3 avaliar:**
- **Janela de proteção pós-conquista:** zona recém-conquistada fica "fresca" por 12 h e exige 1,5× para ser tomada. Na folha da zona: "Protegida por 8 h".
- **Separar modalidades:** só corrida e caminhada rápida contam, com velocidade máxima e cadência no antifraude; bike nunca.
- **"Por que não contou?"** no resumo: trechos inválidos em cinza com **1 frase** (já existe: RF-006) e um ícone de "GPS fraco" quando a precisão passou de X m.
- **Ranking por zonas mantidas** no fim da semana, não por zonas tomadas, para premiar defesa e constância.
- **Volume:** o teto diário (300 RP por zona) já limita. Somar uma mensagem de descanso depois de 3 dias seguidos de corrida longa (opcional, E7).

---

## 7. Ciência da motivação (com o que cada estudo autoriza e não autoriza)

| Conceito | O que a evidência diz | Fonte | Uso no NOMADE |
|---|---|---|---|
| **Erro de predição de recompensa** (Schultz) | Neurônios de dopamina disparam quando a recompensa é **melhor que o previsto**; depois de aprendida, a resposta passa para o **sinal** que antecipa; recompensa esperada que não vem **derruba** o disparo | Schultz, Dayan e Montague, *Science* 1997; Schultz, *J. Neurophysiol.* 1998; gruber.yale.edu | Antecipação (baú fechado, barra quase cheia); surpresa honesta (baú raro); **nunca prometer e não entregar** (ex.: "zona conquistada" provisória que some → avisar "aguardando confirmação") |
| **Hook Model** (Eyal) | Gatilho → ação → recompensa variável → investimento | Eyal, *Hooked*, 2014 (crítica em sdtimes.com "ethics-addiction-and-dark-patterns") | Gatilho útil → correr → resultado variável → zonas, sequência e crew. **A ação é saudável (correr), não rolar a tela** |
| **Fogg B=MAP** | Comportamento acontece quando motivação, habilidade e prompt coincidem; priorizar **facilitar** (motivação oscila) | behaviormodel.org; thebehavioralscientist.com | 2 toques para correr; a notificação é "facilitadora" (traz o botão Correr); nada de motivação por culpa |
| **Autodeterminação** | Revisão de 66 estudos: motivação **autônoma** se associa a mais exercício; motivação **intrínseca** prevê adesão de **longo prazo**; satisfação de **competência** prevê participação | Ryan e Deci, *Am. Psychol.* 2000; Teixeira et al., *IJBNPA* 2012 (doi 10.1186/1479-5868-9-78) | Autonomia (modo, rota, time, meta escolhida); competência (vitórias pequenas, progresso claro); pertencimento (time, crew). **Recompensa extrínseca nunca substitui o prazer de correr** |
| **Octalysis** | Motores "chapéu branco" (significado, realização, criatividade) dão sensação de controle; "chapéu preto" (escassez, imprevisibilidade, perda) geram urgência e, usados demais, esgotamento | yukaichou.com (guia de gamificação) [autor vende o método] | Base: significado (defender a cidade), realização (medalhas), criatividade (rotas, cerco). Dosar: chefão com prazo e zona sob ataque, **só quando reais** |
| **Gradiente de meta** | Esforço acelera perto da meta (Hull, 1932); a ilusão de progresso acelera compras (Kivetz, Urminsky e Zheng, 2006) | en.wikipedia.org/wiki/Goal_pursuit | "Faltam 120 m para conquistar" durante a corrida; barra que muda de cor nos últimos 20% |
| **Progresso dotado** | Cartão de 10 carimbos com 2 de brinde: **34%** concluíram; cartão de 8 vazio: **19%** (mesmos 8 pagos) | Nunes e Drèze, 2006 (via uxdesign.cc, siliconcanals.com) | Missão de boas-vindas começa em 20%; meta semanal começa com "1 corrida de bônus" na 1ª semana |
| **Zeigarnik e Ovsiankina** | Meta-análise de 2025: **não há** vantagem de memória para tarefa incompleta (Zeigarnik), mas **há** tendência geral a **retomar** o que foi interrompido (Ovsiankina) | Ghibellini e Meier, *Humanit. Soc. Sci. Commun.* 2025 (ideas.repec.org s41599-025-05000-w) | Use o "retomar": "Sua missão está em 2/3. Continuar?". Não aposte em "a pessoa vai lembrar" |
| **Pico-fim** | A lembrança de uma experiência depende do pico e do fim, não da duração; na água fria, a pessoa preferiu **repetir** a sessão mais longa que terminava mais branda | Kahneman et al., *Psychol. Sci.* 1993; Redelmeier e Kahneman, 1996 (en.wikipedia.org/wiki/Peak–end_rule) | O resumo termina no feito mais forte; o desaquecimento vira "missão cumprida" com mascote comemorando; **nunca** terminar com erro ou "corrida inválida" (explicar antes, fechar com o positivo) |
| **Efeito IKEA** | Quem monta valoriza mais, **só se termina**; amadores avaliam o que criaram quase como o de especialistas | Norton, Mochon e Ariely, *J. Consumer Psychol.* 2012 (scholars.duke.edu/publication/861385) | Personalizar rastro, moldura e emblema; "minha zona", "minha rota"; o cerco desenhado pela crew |
| **Prova social** | No megaestudo, dizer que "cada vez mais gente se exercita" aumentou as idas em **24%** | Milkman et al., *Nature* 2021 (penntoday.upenn.edu) | "128 corredores pintaram Campinas hoje" no Mapa (só número real) |
| **Recompensa por retorno** | No mesmo estudo (61 mil pessoas, 54 programas de 4 semanas): a melhor intervenção, bônus por **voltar depois de faltar**, rendeu **+27%**; só 8% dos efeitos duraram depois do fim | penntoday.upenn.edu (wharton-study-best-ways-boost-workout-habits); scimex.org | "Bônus de retorno" honesto; e a lição de que **o efeito some se o loop some** |
| **Efeito do recomeço** | Mais gente vai à academia no início da semana, do semestre e depois do aniversário | Dai, Milkman e Riis, *Management Science* 2014 (faculty.wharton.upenn.edu) | Recap e meta nova na **segunda às 8h**; temporada nova no dia 1; "Feliz aniversário! Corrida de presente: ×2 de XP hoje" (cosmético) |
| **Efeito Köhler** | O membro mais fraco de uma dupla persiste mais quando o resultado depende dele | Feltz, Kerr e Irwin, *J. Sport Exerc. Psychol.* 2011; sciencedaily.com 2011 | Meta da crew conjuntiva leve ("todos com 1 corrida = baú da crew"); Fuga contra o fantasma de um amigo um pouco mais rápido |
| **Formação de hábito** | Média de **66 dias** até a automaticidade (amplitude de 18 a 254); **perder 1 dia não atrapalhou** | Lally et al., *Eur. J. Soc. Psychol.* 2010 (ucl.ac.uk 2009/aug; thebehavioralscientist.com) | Sequência semanal com congelamento; a temporada de cerca de 2 meses cobre o tempo de hábito; mensagem: "Faltar uma semana não apaga seu progresso" |
| **Novidade que se esgota** | Pokémon GO: +955 passos na 1ª semana; zero na 6ª | Howe et al., *BMJ* 2016 | FTUE de 7 dias + loops semanais prontos no lançamento |
| **Grupo mínimo** | Times arbitrários geram cooperação interna (940 jogadores); o viés enfraquece com o tempo | Peysakhovich e Rand, 2017 [incerto]; Laato et al. 2021 | Escolha de time com ritual; manter o time vivo toda semana; impedir toxicidade (sem chat livre) |

### 7.1 Riscos e ética
- **Paixão obsessiva:**
  - NUI Galway (2020, 272 pessoas): quem usa o app **para receber elogio** desenvolve mais "paixão obsessiva" por exercício (todayfm.com);
  - estudos espanhóis associam ansiedade-traço a vício em exercício (zaguan.unizar.es/record/96231).
  - **Mitigação:** o elogio vem do **feito** ("2 zonas defendidas") e não da comparação; nada de "seja o nº 1 da cidade" como meta padrão.
- **Pressão e comparação:** pesquisas com usuárias do Strava mostram motivação **e** ansiedade pós-atividade (scmp.com 3288995; marathonhandbook.com).
  - **Mitigação:** comparação padrão só consigo mesmo; ranking é opcional e por faixa de nível.
- **Recompensa variável como caça-níquel:**
  - Schüll (*Addiction by Design*, Princeton) descreve como máquinas de aposta maximizam o "tempo no aparelho";
  - Tristan Harris compara o celular a uma máquina caça-níquel (sdtimes.com).
  - **No NOMADE, a variabilidade fica no resultado da corrida** (o que você conquistou), nunca em "puxar para atualizar" ou em abrir pacotes repetidamente.
  - **Baú só abre com corrida real**, as chances ficam visíveis e não existe compra.
- **Padrões enganosos (FTC, "Bringing Dark Patterns to Light", set/2022):** escassez falsa, contagem regressiva falsa, obstrução, informação escondida (hunton.com 2022/09/27; agg.com).
  - **No NOMADE:** toda contagem vem do servidor e é verdadeira, e sair, excluir e desligar ficam sempre a 2 toques.
- **Lei brasileira, ECA Digital (Lei 15.211/2025):**
  - sancionada em 17/09/2025, em vigor desde **17/03/2026**;
  - o **art. 20 proíbe "caixas de recompensa" (loot boxes)** em jogos direcionados a crianças e adolescentes, ou de provável acesso por eles;
  - a ANPD fiscaliza; a ADI 7.999 no STF contesta a proibição (poder360.com; conjur.com.br 2025-out-22; tecmundo.com.br 502437).
  - **O NOMADE aceita cadastro a partir de 16 anos**, então menores podem usar.
  - **Recomendação:** os baús são **ganhos só correndo**, **nunca vendidos**, com chances públicas. [incerto: se baús grátis entram no conceito legal; a leitura comum é "caixa paga", mas confirme com orientador ou jurista antes da banca]
  - Pedido para E9 e E10: incluir no documento de conformidade.
- **Saúde:**
  - nenhum estudo isola a "sequência diária de corrida" como causa de lesão [incerto], mas fisioterapeutas alertam (pogophysio.com.au);
  - o **Gentler Streak**, app em que o descanso não quebra a sequência, foi o App do Ano para Apple Watch em 2023 (spabusiness.com);
  - o watchOS 11 permite **pausar os anéis** por até 90 dias sem perder a sequência (9to5mac.com 16/07/2024; macrumors.com 16/09/2024).
  - **O NOMADE copia a pausa:** "Pausar por lesão ou descanso" (1 a 8 semanas), que congela sequência, meta e decaimento **pessoal**. O decaimento da zona continua, por justiça.

---

## 8. Retenção de apps fitness (D1/D7/D30)

| Recorte | D1 | D7 | D30 | Fonte | Confiança |
|---|---|---|---|---|---|
| Saúde e fitness (Sendbird, via guia do Lovable) | 20–27% | ~7% | ~3% | lovable.dev/guides/what-is-a-good-retention-rate-for-an-app | C, [incerto] |
| Saúde e fitness (Adjust, via Business of Apps) | 27% | — | 7–8% | businessofapps.com/data/health-fitness-app-benchmarks; adjust.com/blog/what-makes-a-good-retention-rate | B, [incerto: ano do dado] |
| Saúde e fitness (AppsFlyer, via Business of Apps) | — | — | 3% | businessofapps.com (dado possivelmente de 2021) | B, [incerto] |
| Todos os apps, 2025–26 (Phiture: Adjust, AppsFlyer, Statista) | 25–26% | 11–13% | 5–7% | phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations | B |
| Strava (Apptopia, via Alchemer) | — | — | 16% iOS / 8% Android | alchemer.com (tough-love-tuesday…) | C, [incerto: ano] |
| Assinaturas de saúde e fitness (RevenueCat 2025) | — | — | — | Conversão mediana de teste para pago: **39,9%** (top 10%: 68,3%); 30% dos planos anuais cancelados no 1º mês (todas as categorias) | athletechnews.com; revenuecat.com | B |

**Leitura:**
- Num app fitness típico, **de cada 100 que instalam, cerca de 25 voltam no dia seguinte, cerca de 7 na semana seguinte e 3 a 8 no mês**.
- A queda mais brutal é entre **D1 e D7**. É onde a FTUE de 7 dias e a sequência semanal atuam.

**O que os melhores fazem diferente** (síntese das fontes acima):
1. **Valor no 1º dia:** captura garantida (Pokémon GO); a 1ª lição em menos de 1 minuto (Duolingo).
2. **Grafo social cedo:** o Strava pede para achar amigos no onboarding (aleaitsolutions.com, estudo de caso) e o clube vira motivo de voltar.
3. **Ritmo semanal** em vez de diário (Strava, Pokémon GO e Apple ajustaram para isso).
4. **Lembrete personalizado e com limite** (Duolingo: +2% de retenção de novos usuários).
5. **Recompensa por retorno** (megaestudo: +27%).
6. **Retrospectiva compartilhável** (Year in Sport, Duolingo Year in Review) como divulgação gratuita.

**Metas de projeto para o NOMADE** (piloto do TCC; telemetria mede depois):
- D1 ≥ 35%, D7 ≥ 15%, D30 ≥ 8%, cerca de 1,5× a média do setor.
- ≥ 60% de quem instala faz a 1ª corrida em 72 h.
- ≥ 15% das corridas compartilhadas.
- **Eventos a instrumentar** (pedido para E9 e E10):
  - `app_aberto`, `conta_criada`, `time_escolhido`, `permissao_local`;
  - `corrida_iniciada`, `corrida_concluida`, `zona_conquistada`;
  - `card_compartilhado`, `notificacao_aberta`, `notificacao_desligada`, `pausa_ativada`.

---

## 9. Playbook de dopamina do NOMADE

| # | Tática | Mecanismo | Tela | Risco ético | Mitigação |
|---|---|---|---|---|---|
| 1 | Cidade pinta em tempo real na cor do time | Recompensa imediata + criatividade | Corrida | Olhar o celular correndo (acidente) | Pintura **periférica**, sem exigir leitura; vibração em vez de texto; voz opcional |
| 2 | "Faltam 120 m para conquistar" | Gradiente de meta | Corrida, Mapa | Pressão para forçar o ritmo | Mede **distância**, nunca ritmo; sem contagem de tempo |
| 3 | Missão de boas-vindas começa em 20% e **garante** a 1ª zona | Progresso dotado + competência | Onboarding, Corrida | Falsa promessa se o GPS falhar | Se não conquistar, a zona vira "sua 1ª zona em disputa" e a missão continua; texto honesto |
| 4 | Baú do dia com raridade visível | Recompensa variável (Schultz) | Mapa, Caça | Caça-níquel; ECA Digital | Só abre **correndo**; chances públicas (ex.: 70/25/5%); nunca à venda; 1 por dia |
| 5 | Chefão da semana com vida global e prazo real | Significado épico + escassez verdadeira | Arena/Raid | Escassez falsa | Vida e prazo vêm do servidor; mesma contagem para todos |
| 6 | "Sua zona está sob ataque" | Aversão à perda **com ação possível** | Notificação, Mapa | Ansiedade; excesso | Só se for real e a pessoa correu ali em 30 dias; no máximo 1 por dia; desligável; nunca "você vai perder tudo" |
| 7 | Sequência semanal (2 corridas) + congelamento automático + pausa | Aversão à perda sem punir descanso | Perfil, Mapa | Correr lesionado para "não perder" | Pausa de 1 a 8 semanas; congelamento automático; marcos raros; aviso desligável |
| 8 | Guardião da zona (mais corridas em 30 dias) | Competência alcançável (Local Legend) | Folha da zona | Volume excessivo na mesma zona | Conta **corridas** (1 por dia no máximo), não km |
| 9 | Liga semanal de 30, por nível | Competição entre pares | Clube | Comparação tóxica | Não rebaixa quem não correu; ranking por nível; opção de sair da liga |
| 10 | Missões diárias e semanais e trilha da temporada | Realização + retomada (Ovsiankina) | Arena/Missões | Lista infinita de tarefas | 3 por dia, opcionais e com metas pequenas; trilha só cosmética |
| 11 | Coleção de medalhas (silhuetas das que faltam) | Posse + antecipação | Perfil | "Completar tudo" obsessivo | Nada exige corrida diária; medalhas de descanso ("Voltou depois da pausa") |
| 12 | Resumo cinematográfico que termina no pico | Pico-fim | Resumo | Exagerar corrida ruim | Sempre algo verdadeiro para celebrar (distância, constância); nunca termina em erro |
| 13 | Card do Instagram (sticker, Story, feed) | Influência social + identidade | Resumo | Expor a casa e a rotina | Zonas de privacidade sempre aplicadas; opção de esconder o ritmo; selo "início e fim ocultos" |
| 14 | "Bora!" da crew | Reciprocidade + pertencimento | Clube, Atividades | Pressão social; robôs | Só quem corre; agrupado em 1 aviso por dia; sem contagem pública de "Bora!" recebidos |
| 15 | Recap semanal na segunda às 8h | Recomeço + pico-fim | Notificação, Atividades | Semana fraca = vergonha | Destaca o melhor da semana; nunca compara com a semana anterior para baixo |
| 16 | Bônus de retorno (1ª corrida depois de 7+ dias) | Recompensa por volta (+27% no megaestudo) | Mapa, Resumo | Incentivar sumir para ganhar bônus | Bônus **cosmético** e pequeno (+50% de XP, não de pontos de território); 1 vez por mês |
| 17 | Faixa de corredor (moldura que só sobe) | Progresso de longo prazo | Perfil, avatar | — | Nunca regride; não depende de ritmo |
| 18 | Meta e contador do time ("Volt: 312 km hoje") | Grupo mínimo + prova social | Mapa, Página do time | Rivalidade tóxica | Sem chat livre; textos dos líderes nunca atacam outros times |
| 19 | Cerco do bairro (candidato) | Estratégia + IKEA | Mapa | Domínio de grupos grandes | Teto de cerca de 1 km²; dura 24 h |
| 20 | Corrida de aniversário (XP ×2 cosmético) | Recomeço | Notificação | Uso do dado de nascimento | Só se a pessoa informou a data e aceitou; desligável |

**Ritmo** (prompt §5.3, com a cadência sugerida):
- **micro** em todo toque (≤ 100 ms);
- **pequena** em toda corrida (zona pintada, XP);
- **média** 2 a 3 por semana (zona tomada, baú raro, liga);
- **épica** no máximo 1 por semana (nível, chefão, PR da vida).
- O resumo mostra **no máximo 1 épica**; as outras ficam para "ver todas".

---

## 10. Pedidos para outras equipes (dependências da E1)

| Para | Pedido |
|---|---|
| **E3** (jogo e território) | (a) Garantir que a corrida de boas-vindas de 500 m conquiste 1 zona neutra (hoje 30 RP; simular). (b) Avaliar a janela de proteção de 12 h depois da conquista. (c) Simular o "Cerco do bairro" com teto de cerca de 1 km². (d) Guardião da zona só com título. (e) Liga de 30 por nível, sem rebaixar quem não correu. (f) Nenhuma vantagem por horário (Night Owls). (g) Normalizar a força dos times por ativos |
| **E4** (arte) | Narrador neutro antes da escolha; líderes com fala de 2 frases sem atacar rivais; pose "derrota" = cansado e sorrindo; bio dos Owls sem madrugada; medalhas com silhueta; faixas de corredor por material (não por matiz) |
| **E5** (motion) | Cor do time inundando a tela em ≤ 600 ms + vibração forte; números de dano flutuando no chefão; resumo que termina no pico; versão "Reduzir movimento" de cada uma |
| **E6** (UX) | Fluxo da §11 com tempos; 2 toques para correr; botão de segurança sempre a 1 toque |
| **E7** (engajamento) | Catálogo de notificações da §12 (limites, horários, escada de reativação que termina em silêncio); faixas da meta semanal; aposta da sequência (P2) |
| **E8** (social) | 3 modelos (sticker transparente, Story, feed); confirmar `react-native-view-shot` e `expo-sharing` no Expo Go SDK 57; privacidade no card; reações fixas, sem comentário livre |
| **E9** (backend) | Eventos da §8; contagens do chefão e da liga no servidor; agregação de "Bora!" por dia; mapa de calor só pessoal |
| **E10** (QA) | Teste de 5 s na escolha de time ("o que isso faz? posso trocar?"); auditoria de padrões enganosos (lista da §14); conferir ECA Digital e LGPD |
| **E2** (skills e MCPs) | Confirmar quais módulos nativos de compartilhamento vêm no Expo Go 57 |

---

## 11. Jornada da primeira abertura recomendada (FTUE)

**Meta:**
- **≤ 90 s** do toque no ícone até o time confirmado;
- **≤ 2 min** até estar na tela "Pronto para correr";
- **1ª zona** na 1ª corrida (≤ 1 km).

O fluxo atual (`features/screens/onboarding-screen.tsx`: boas-vindas e nome → time → localização → notificações) já tem a ordem certa. Faltam o **contexto antes**, a **cerimônia depois** e a **missão no fim**.

| Passo | Tempo-alvo (acumulado) | O que a pessoa vê | Texto-exemplo | Mecanismo |
|---|---|---|---|---|
| 0. Splash | 0–2 s | Logo neon "desenhando" uma rota | — | Antecipação |
| 1. Boas-vindas | 2–8 s | Mapa escuro da cidade com rotas pintando sozinhas (vídeo ou animação leve); botão "Começar" | "Corra a sua cidade. Cada rua conta." | Promessa clara |
| 2. Conta rápida | 8–35 s | Entrar com e-mail (já existe); 16+, termos | "Leva 20 segundos." | Fogg: habilidade |
| 3. Nome | 35–42 s | 1 campo, teclado já aberto | "Como a cidade vai te chamar?" | IKEA |
| 4. **A cidade em disputa** (novo) | 42–48 s | Mapa da cidade com as 4 cores pulsando em regiões suavizadas, contador por time (demonstração rotulada se não houver dado real) | "A cidade está dividida. De que lado você corre?" | Contexto (o "nível 5" do Pokémon GO); grupo mínimo |
| 5. Os 4 times | 48–70 s | Carrossel de 4 cards grandes: mascote animado (respira e pisca), nome, 1 frase, estilo. Toque = líder entra (deslizando, 300 ms) e fala 2 frases. Link discreto "Não sei escolher" | Exemplo de estrutura: "Nós corremos em matilha. Ninguém fica para trás." / "Vem com a gente?" | Valor, não vantagem |
| 5b. Quiz (opcional) | +20 s | 3 perguntas com ícones: "Você corre mais… de manhã / fim de tarde / tanto faz"; "Sozinho ou em grupo?"; "Curto e rápido ou longo e constante?" | "Sugerimos os Urban Coyotes. A escolha é sua." | Autonomia |
| 6. Confirmação | 70–75 s | Botão "Correr com os Volt Runners" + linha "Dá para trocar 1 vez por temporada." | — | Escassez honesta |
| 7. **Cerimônia** | 75–80 s | A cor do time inunda a tela (círculo crescendo do botão, ≤ 600 ms), vibração forte, mascote comemora, líder diz 1 frase, contador do time +1 | "Bem-vindo aos Volt Runners!" / "Volt Runners: 1.249 → 1.250 corredores" | Pico emocional; pertencimento |
| 8. Localização | 80–95 s | Ilustração do mascote com mapa + "Permitir" | "Para pintar a cidade, precisamos ver por onde você corre." | Explicação antes da permissão (LGPD) |
| 9. Zona de privacidade (novo, opcional) | 95–105 s | Mapa com círculo de 200 m no ponto atual | "Esconder o início e o fim das corridas? (recomendado)" | Segurança por padrão |
| 10. Notificações | 105–115 s | 3 tipos com toggles já ligados: ataque à zona, chefão e sequência; todos desligáveis | "Avisamos só o que importa. No máximo 1 por dia." | Transparência |
| 11. **Missão de boas-vindas** | 115–120 s | Card com barra **já em 20%** e botão gigante "Correr agora" (ou "Depois" discreto) | "Missão 1: corra 500 m e pinte sua 1ª zona." | Progresso dotado |
| 12. Mapa (primeira vez) | — | 3 dicas em balões, 1 por vez, pulam ao tocar: botão Correr, seu time, baú do dia | "Toque em Correr quando estiver pronto." | Divulgação progressiva |
| 13. 1ª corrida | 500 m–1 km | Pintura ao vivo; aos 400 m: "Faltam 100 m!"; aos 500 m: vibração + "Zona conquistada!" (provisória, confirmada pelo servidor) | "Zona sua! Primeira de muitas." | Gradiente de meta; competência |
| 14. 1º resumo | — | Rota desenhando → números → **1ª zona** (épica) → medalha "Primeira zona" → card do Instagram | "Sua primeira zona. Mostre para a cidade?" | Pico-fim |

**Se a pessoa não correr no dia 0:**
- o Mapa mostra o card da missão no topo, com o pulso suave da barra a 20%;
- **1 notificação** no dia 1 às 18h: "Sua 1ª zona está a 500 m de você." (texto da §12).

### 11.1 Primeira semana (FTUE de 7 dias, prompt §13)
Missões curtas, **1 por dia, opcionais e cumulativas**: quem pula um dia faz duas depois, sem perder nada.

| Dia | Missão | Ensina |
|---|---|---|
| 1 | Corra 500 m (boas-vindas) | Domínio |
| 2 | Abra o baú do dia | Caça |
| 3 | Fuja do fantasma por 1 km | Fuga |
| 4 | Dê 1 golpe no chefão da semana | Raid |
| 5 | Entre numa crew ou mande 1 "Bora!" | Crew |
| 6 | Veja sua posição na liga | Liga |
| 7 | Compartilhe seu recap da semana | Compartilhar |

**Recompensa ao fechar 5 de 7:** moldura "Recruta" + baú raro garantido (anunciado desde o dia 1, com barra 0/7). Gradiente de meta + Ovsiankina.

---

## 12. Jornada de retorno

### 12.1 Regras (alinhadas ao prompt §5.4)
- **No máximo 1 notificação de engajamento por dia**, das **7h às 22h** no horário local.
- **Exceções com teto:** segurança sem limite; ataque real a zona até 1 por dia, desligável.
- **Toda notificação** é verdadeira, tem destino na tela (deep link), tem toggle por tipo e **≤ 60 caracteres** no corpo.
- **Proibido:** culpa, "decepcionou", "seu time precisa de você" quando não precisa, contagem falsa, emoji de choro.
- **Silêncio inteligente:** se a pessoa ignorou 3 notificações seguidas do mesmo tipo, aquele tipo cai para 1 por semana.

### 12.2 Gatilhos honestos (do mais útil ao menos)
| Gatilho | Condição real | Horário | Frequência máxima | Texto (≤ 60) |
|---|---|---|---|---|
| Zona sob ataque | Rival chegou a 50% numa zona sua em que você correu em 30 dias | Até 21h | 1 por dia | "Sua zona Cambuí está sob ataque. Defender?" |
| Chefão quase caindo | Vida < 20% e você deu golpe | 18h | 1 por chefão | "O chefão está com 12% de vida. Último golpe?" |
| Sequência em risco | Domingo, 1 de 2 corridas feitas | Sáb 9h | 1 por semana | "1 corrida mantém sua sequência da semana." |
| Baú do dia | Baú a ≤ 1 km de casa ou da rota comum | 7h30 | 3 por semana | "Baú do dia a 600 m da sua rota." |
| Recap semanal | Segunda | 8h | 1 por semana | "Sua semana no NOMADE está pronta. Bora ver?" |
| Liga fechando | Domingo, você está até 2 posições da promoção | Dom 10h | 1 por semana | "Faltam 2 posições para subir de divisão." |
| Meta do time | Time a ≤ 10% da meta semanal | 17h | 1 por semana | "Volt Runners a 18 km da meta. Bora junto?" |
| Missão de boas-vindas pendente | Dia 1 e 3 sem 1ª corrida | 18h | 2 no total | "Sua 1ª zona está a 500 m de você." |
| Bora! recebidos | Pelo menos 1 reação no dia | 20h | 1 por dia (agrupada) | "Ana e mais 4 mandaram Bora! na sua corrida." |
| Clima bom (opcional, P2) | Previsão sem chuva, 15–25 °C | 7h | 1 por semana | "Tempo bom para correr hoje. Sua zona agradece." |

### 12.3 Escada de reativação (volta depois de sumir)
| Dias sem correr | Ação | Texto (≤ 60) |
|---|---|---|
| 7 | 1 push acolhedor + "Bônus de retorno" ativo | "Sentimos sua falta. A próxima corrida vale bônus." |
| 14 | 1 push com fato real do mapa (só se for verdade) | "Seu bairro mudou de cor. Vem ver o mapa?" |
| 21 | Oferecer pausa (lesão ou descanso) | "Precisa de uma pausa? Guardamos sua sequência." |
| 30 | Última mensagem, e depois **silêncio** (só segurança e e-mail mensal de temporada, se aceito) | "Vamos parar os lembretes. Sua cidade te espera." |

**Ao voltar** (abrir depois de 14 dias ou mais), a tela "Bem-vindo de volta":
- **mostrar:** mascote acenando; "O que mudou" em 3 cartões (zonas suas que caíram ou resistiram, o time na cidade, o chefão da semana); missão fácil "Corra 1 km" com barra em 20%;
- **não mostrar:** sequência perdida, perdas em vermelho, "você perdeu X".
- **Texto:** "Que bom te ver! Uma corrida de 1 km para recomeçar?" (52 caracteres).

---

## 13. Paridade com o Strava

| Recurso Strava | NOMADE hoje | Falta | Vale copiar? | Prioridade |
|---|---|---|---|---|
| Gravação GPS, pausa, auto-pausa | ✅ RF-004 | — | — | — |
| Resumo com mapa, distância, tempo, ritmo | ✅ RF-006 | Parciais por km, gráfico de ritmo | Sim | **P0** |
| Melhores esforços e PR (1, 5, 10 km) | ⬜ | Tudo | Sim | **P0** |
| Compartilhar com imagem (Stories, sticker) | 🟡 só texto (RF-017) | Card PNG, sticker transparente, Story, feed | Sim, e melhor (time e zonas) | **P0** |
| Privacidade (zonas, esconder dados) | ✅ zonas (RNF-013) | Esconder ritmo no card; sugerir zona no onboarding | Sim | **P0** |
| Beacon (localização para contatos) | 🟡 Corrida Segura (RF-024) | Escolta ao vivo contínua | Sim | **P1** |
| Sequência semanal | ⬜ (prompt prevê) | Tudo + congelamento + pausa | Sim, e melhor (pausa) | **P0** |
| Kudos | ⬜ | "Bora!" + 2 reações fixas | Sim, com restrição anti-robô | **P1** |
| Feed social | ⬜ RF-014 | Feed da crew e dos amigos, resumido | Parcial (sem comentário livre) | **P1** |
| Clubes (posts, eventos, ranking) | 🟡 Crews RF-011 | Meta semanal, "correndo agora", convite por link | Sim | **P1** (eventos **P2**) |
| Desafios mensais com medalha | 🟡 RF-016 | Desafio do mês + estante de medalhas | Sim | **P1** |
| Segmentos e KOM/QOM | ⬜ (zonas cumprem o papel) | Rei do trecho (opcional) | Parcial | **P2** |
| Local Legend | ⬜ | Guardião da zona | **Sim, prioridade** | **P1** |
| Year in Sport | ⬜ | Recap semanal (P0) e anual (P2), grátis | Sim | **P0** semanal / **P2** anual |
| Mapa de calor | ⬜ RF-013 | Só pessoal | Parcial | **P2** |
| Rotas e planejamento | ⬜ | — | Não agora | — |
| Exportar GPX | ⬜ | Exportar arquivo | Sim (prompt §14) | **P1** |
| Antifraude em placar | ✅ HMAC e recálculo (RNF-006) | "Corrida contestada" visível | Sim | **P2** |

**Onde o NOMADE já é melhor que o Strava:**
- território vivo com times;
- chefão coletivo;
- Corrida Segura com SOS e alerta de parada **grátis**;
- antifraude no servidor desde o 1º dia;
- retrospectiva grátis (manter).

---

## 14. Anti-padrões a evitar (lista de checagem para E10)

1. **Culpa e ameaça:** "você decepcionou seu time", mascote chorando, "não abandone".
2. **Sequência diária** ou qualquer regra que exija correr dois dias seguidos.
3. **Escassez ou contagem falsa:** "só hoje" sem ser verdade; timer que reinicia.
4. **Caixa de recompensa paga** ou qualquer compra com resultado aleatório (proibida pelo ECA Digital para menores).
5. **Pagar para ganhar:** bônus de pontos de território, escudo ou tentativa de chefão à venda.
6. **Paywall no núcleo, na segurança ou na retrospectiva** (lição do Year in Sport).
7. **Comparação para baixo:** "você correu 40% menos que semana passada"; ranking global como padrão.
8. **Notificações em excesso:** mais de 1 de engajamento por dia, fora de 7h–22h, ou sem toggle.
9. **Avisos que não desligam** (lição da sequência do Strava).
10. **Reações de robô:** "Bora!" de contas sem corrida.
11. **Expor a casa:** card ou feed sem aplicar as zonas de privacidade; posição ao vivo para desconhecidos.
12. **Premiar horário perigoso:** bônus noturno ou de madrugada (Night Owls).
13. **Premiar volume sem teto:** mais pontos por correr 3 vezes no mesmo dia.
14. **Modalidades misturadas:** bike tomando zona de corredor.
15. **Roubo instantâneo sem defesa:** perder a zona horas depois de conquistar sem aviso.
16. **Grade de hexágonos visível** (regra do projeto).
17. **Final ruim:** resumo que termina em erro, "inválida" ou perda.
18. **Obstruir a saída:** desligar, sair do time, sair da liga, excluir conta escondidos ou com mais de 2 toques.
19. **Prometer e não entregar:** "zona conquistada" que some depois do servidor sem explicação (frustra pelo erro de predição).
20. **Puxar para atualizar como caça-níquel** ou conteúdo infinito para rolar; o app recompensa correr, não olhar.

---

## 15. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação da E1 |
|---|---|---|---|
| D1 | Quando escolher o time? | (a) Logo depois da conta (R8); (b) depois da 1ª corrida, como o Pokémon GO adia; (c) logo depois da conta, com a "cidade em disputa" antes | **(c):** cumpre o R8 e dá o contexto que o Pokémon GO ganha esperando o nível 5 |
| D2 | Identidade dos Night Owls | (a) Manter "madrugada"; (b) "fim do dia e luzes da cidade" | **(b):** segurança (32% das mulheres citam medo) e coerência com §5.4 |
| D3 | Faixas de corredor por cor (como o NRC)? | (a) Por matiz; (b) por material ou brilho (Asfalto → Lenda) | **(b):** matiz conflita com as cores dos times |
| D4 | Guardião da zona (Local Legend) vale só título ou tem bônus? | (a) Só título e moldura; (b) +10% de defesa | **(a)** no lançamento; E3 simula (b) |
| D5 | Comentários livres no feed? | (a) Sim; (b) só 3 reações fixas | **(b):** sem moderação pesada e sem toxicidade entre times |
| D6 | Sticker transparente no lançamento? | (a) Só card cheio; (b) card + sticker PNG | **(b):** é o formato que a comunidade do Strava pediu e ganhou em 2025; custo baixo |
| D7 | "Pausa por lesão ou descanso" | (a) Não; (b) 1 a 8 semanas, congela sequência e meta pessoais | **(b):** padrão da Apple (até 90 dias), ético e barato |
| D8 | Escada de reativação termina em silêncio aos 30 dias? | (a) Sim; (b) continuar semanal | **(a):** padrão do Duolingo e respeito ao §5.4 |
| D9 | Baús e ECA Digital | (a) Baú só por corrida, chances públicas, nunca vendido; (b) vender baú cosmético | **(a)**, e registrar na conformidade; confirmar a leitura jurídica com o orientador |
| D10 | Metas de retenção do piloto | D1/D7/D30 = 35/15/8% | Adotar como **alvo de projeto**, não como promessa na banca |

---

## 16. Tarefas propostas para F3/F4

| ID | Título | Equipe dona | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E1.1 | Etapa "A cidade em disputa" antes da escolha de time | E6 (com E4 e E5) | `apps/mobile/src/features/screens/` (onboarding), `components/art` | E4 (mapa ilustrado), E3 (dado por time) | Aparece entre o nome e o time; ≤ 6 s; dado real ou rótulo "demonstração"; teste de 5 s: ≥ 80% dizem "vou escolher um time para disputar a cidade" |
| T7.E1.2 | Cerimônia de confirmação do time | E5 | `components/motion`, `components/celebration` | E4 (mascotes e líderes) | Cor inunda a tela em ≤ 600 ms; vibração forte; frase do líder; contador do time +1; versão "Reduzir movimento" só com opacidade |
| T7.E1.3 | Missão de boas-vindas com progresso dotado e 1ª zona garantida | E3 (regra) + E6 (tela) | `src/domain`, `features/run`, `features/screens` | E9 (servidor aplica a regra) | Barra começa em 20%; corrida simulada de 500 m em zona neutra conquista 1 zona em teste de domain e no servidor; resumo termina na zona |
| T7.E1.4 | Sequência semanal + congelamento automático + pausa | E7 (regra) + E9 (servidor) | `src/domain`, `supabase/` | E3 | 2 corridas ≥ 1 km por semana; 1 congelamento por mês automático; pausa de 1 a 8 semanas; testes de propriedade (nenhuma semana com pausa quebra a sequência) |
| T7.E1.5 | Guardião da zona | E3 + E9 + E6 | `src/domain`, `supabase/`, `app/zona/[id]` | — | Conta corridas (1 por dia) em 30 dias; aparece na folha da zona com "Você: X · Guardião: Y"; teste de domain e pgTAP |
| T7.E1.6 | Cards de compartilhamento (sticker transparente, Story, feed) com privacidade | E8 | `features/share` (ou equivalente), `components/art` | E2 (módulos no Expo Go 57), E4 | 3 modelos gerados; zonas de privacidade cortadas em 100% dos testes; toggle de esconder ritmo; abre o menu do sistema |
| T7.E1.7 | Catálogo de notificações e escada de reativação | E7 + E9 | `features/notifications`, `supabase/functions` | E9 | Limite de 1 por dia e janela 7h–22h testados; textos ≤ 60 caracteres (teste estático); silêncio depois de 30 dias; toggle por tipo |
| T7.E1.8 | Tela "Bem-vindo de volta" | E6 + E7 | `features/screens` | T7.E1.7 | Aparece depois de 14 dias ou mais; 3 cartões "o que mudou" verdadeiros; missão de 1 km; nenhuma perda em vermelho |
| T7.E1.9 | Parciais por km e recordes pessoais | E6 + E3 | `src/domain`, `features/screens` (resumo e atividades) | — | Parciais em barras; PR de 1, 5 e 10 km e maior distância; épica só para PR da vida; testes de domain |
| T7.E1.10 | FTUE de 7 dias | E7 + E6 | `src/domain` (missões), `features/screens` (Arena/Missões) | T7.E1.3 | 7 missões opcionais e cumulativas; recompensa ao fechar 5 de 7; nenhuma exige dias seguidos |
| T7.E1.11 | Instrumentação de eventos de retenção | E9 + E10 | `services/api`, `supabase/` | — | Os 11 eventos da §8 gravados com consentimento; consulta D1/D7/D30 documentada |
| T7.E1.12 | Auditoria de padrões enganosos e ECA Digital | E10 | `docs/QA.md` | Todas | Os 20 itens da §14 checados por tela, com captura; nenhum achado crítico aberto |

---

## 17. Riscos e bloqueios

- **Rede:** WebFetch e `curl` bloqueados para quase todos os domínios. Os números vêm de trechos de busca. Por isso os itens [incerto] devem ser conferidos antes de ir para a monografia (ver `pesquisa/fichas-de-evidencia.md`).
- **Retenção:** os benchmarks são de fornecedores, com metodologias diferentes e conflitantes (D30 de 3% a 8%). Use faixas, não um número único.
- **Expo Go:** a integração direta com os Stories provavelmente exige código nativo fora do Expo Go. O plano é o PNG pelo menu do sistema (confirmar com E2 e E8).
- **ECA Digital:** a leitura sobre baús grátis é incerta e a ADI 7.999 está pendente.
- **Pertencimento frágil:** se a meta semanal do time e a página do time não forem entregues, a escolha de time vira só uma cor (o viés de grupo enfraquece com o tempo).
- **Novidade de 6 semanas:** se loops semanais e temporada não estiverem prontos, a retenção cai como no Pokémon GO (Howe, 2016).

---

## 18. Fontes

Organizadas por tema. As datas aparecem quando a página informa. Os grupos "Pokémon GO" e "Strava" também listam os estudos sobre esses apps.

**Pokémon GO**
- https://techcrunch.com/2019/02/21/pokemon-go-will-soon-let-you-change-teams-for-about-8-also-instinct-rules (21/02/2019)
- https://www.ggrecon.com/guides/pokemon-go-teams-join-change-switch-how-to/
- https://sportskeeda.com/pokemon/pokemon-go-teams-guide-how-change-factions-leaders
- https://esports.gg/news/pokemon/pokemon-go-can-you-change-teams/
- https://www.inverse.com/article/18743-designs-of-pokemon-go-team-leaders-mystic-valor-instinct (2016)
- https://gameinformer.com/b/news/archive/2016/07/24/niantic-reveals-pokemon-go-team-leaders.aspx (24/07/2016)
- https://www.gameskinny.com/news/pokemon-go-unveils-team-leaders/ (2016)
- https://pokemongo.fandom.com/wiki/Team_Leaders
- https://www.androidcentral.com/pokemon-go-which-team-valor-mystic-instinct
- https://mein-mmo.de/pokemon-go-spott-community-team-gelb/
- https://pokemongo.com/post/ux-testing-2021 (13/10/2021)
- https://nintendowire.com/blog/2016/07/05/first-impressions-pokemon-go/ (05/07/2016)
- https://www.gameskinny.com/urebt/a-trainers-diary-starting-out-on-pokemon-go
- https://bulbapedia.bulbagarden.net/wiki/Raid_Battle_(GO)
- https://pokemongo.fandom.com/wiki/Raid_Battle
- https://bulbapedia.bulbagarden.net/wiki/Adventure_Sync
- https://pogo.gamepress.gg/node/501706
- https://mein-mmo.de/en/pokemon-go-when-will-the-weekly-reward-arrive-time-content-eggs,412079/
- https://www.serebii.net/pokemongo/friends.shtml
- https://bulbapedia.bulbagarden.net/wiki/Friends_(GO)
- https://3ds.nintendolife.com/news/2023/10/pokemon-go-introduces-brand-new-multiplayer-feature-party-play (10/2023)
- https://techxplore.com/news/2023-10-pokemon-party-play-feature-team.amp (10/2023)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5154977 (Howe et al., BMJ 2016;355:i6270)
- https://www.nationalaffairs.com/blog/detail/findings-a-daily-roundup/all-on-the-same-page (Peysakhovich e Rand, 2017)
- https://emerald.com/insight/content/doi/10.1108/INTR-03-2020-0158/full/pdf (Laato et al., 2021)
- https://scholarspace.manoa.hawaii.edu/items/bf7252fa-3db8-4cd8-b24b-ae37eadfc63e (Laato et al., HICSS 2021)

**Strava**
- https://www.bikeradar.com/news/strava-sticker-stats-spring-2025-updates (abr/2025)
- https://communityhub.strava.com/what-s-new-10/use-strava-stats-stickers-on-ig-stories-ios-android-9344
- https://press.strava.com/articles/strava-updates-features-to-help-users-easily-plan-and-share-their-activities (03/04/2025)
- https://www.remove.bg/b/strava-overlay-for-instagram-stories-and-posts
- https://runflick.com/blog/share-strava-on-instagram (2026)
- https://support.strava.com/hc/en-us/articles/36553427481997-Streaks-on-Strava
- https://support.strava.com/hc/en-us/articles/216919177-Strava-Challenges
- https://www.findyouredge.app/news/strava-challenges-vs-edge-rewards-uk-2026
- https://dcrainmaker.com/2020/06/strava-legends-feature.html (06/2020)
- https://www.androidcentral.com/strava-announces-local-legends-new-way-compete-segments
- https://zwiftinsider.com/strava-local-legends
- https://runningmagazine.ca/?p=91520
- https://www.voxweb.nl/en/what-kudos-can-do-for-your-motivation-and-sports-pleasure
- https://idrottsforum.org/hallgrenetal260512/
- https://www.bike-magazin.de/en/magazine/backgrounds/strava-s-2025-annual-report-specialized-is-the-number-1-biker/
- https://insider.fitt.co/gen-z-drives-strength-social-workouts/ (03/12/2025)
- https://athletechnews.com/running-walking-strength-training-strava-year-in-sport-report/
- https://9to5mac.com/2026/07/09/strava-gets-an-events-tab-with-upcoming-races-group-runs-more/ (09/07/2026)
- https://endurance.biz/2026/industry-news/strava-targets-leaderboard-accuracy-and-rolls-out-navigation-and-club-event-updates/
- https://www.sportive.com/cycling/524251/strava-upgrades-club-features-still-no-coffee
- https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425 (12/2025)
- https://www.t3.com/tech/dear-strava-we-have-a-paywall-problem-thats-gone-a-step-too-far
- https://gadgetsandwearables.com/2025/12/20/strava-year-in-sport/ (20/12/2025)
- https://www.triathlete.com/culture/news/strava-apologizes-after-price-hike-backlash-we-just-moved-too-fast/ (2023)
- https://www.bikeperfect.com/news/strava-faces-backlash-as-platform-increases-monthly-subscription-price-by-25-percent (2023)
- https://road.cc/content/tech-news/stravas-weekly-snapshot-makes-me-feel-bad-307315
- https://road.cc/content/news/239593-are-you-getting-strava-kudos-or-follow-requests-bots
- https://singletrackworld.com/forum/bike-forum/when-did-the-strava-team-think-they-should-be-a-bit-more-annoying/ (11/2023)
- https://www.scmp.com/postmag/wellness/article/3288995/stravas-great-watch-your-mental-health-warn-researchers
- https://marathonhandbook.com/does-strava-promote-unhealthy-training-habits/
- https://www.utupub.fi/items/882b4675-8f2a-49e2-8309-16532ba33bc1/full
- https://www.pogophysio.com.au/?p=4971
- https://www.wareable.com/sport/strava-heat-maps-military-bases-5682 (01/2018)
- https://www.bikeradar.com/news/stravas-heatmap-reveals-military-bases-and-more (01/2018)
- https://dcrainmaker.com/2021/08/privacy-features-options.html (08/2021)
- https://www.tomsguide.com/wellness/fitness/strava-just-released-a-new-feature-and-its-available-to-all-users-5-things-you-can-now-change-with-quick-edit (2024)
- https://androidauthority.com/strava-beacon-location-sharing-2741621 (31/08/2021)
- https://www.cyclingweekly.com/products/strava-makes-beacon-feature-free-to-all-users (2021)
- https://www.bikeradar.com/news/strava-drops-lawsuit-against-garmin-21-days-after-filing-it (10/2025)
- https://www.techradar.com/health-fitness/fitness-apps/strava-drops-its-lawsuit-against-garmin-so-it-looks-like-all-your-features-are-here-to-stay-for-now (10/2025)
- https://www.alchemer.com/resources/blog/tough-love-tuesday-stravas-missed-opportunity-to-drive-mobile-app-retention-and-gain-actionable-product-feedback/
- https://www.aleaitsolutions.com/case-study/building-a-running-app-community-platform-with-strava/
- https://developers.facebook.com/docs/instagram-platform/sharing-to-stories

**Duolingo**
- https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals
- https://blog.duolingo.com/improving-the-streak
- https://www.recall.it/summary/lennys-podcast/behind-the-product-duolingo-streaks-or-jackson-shuttleworth-group-pm-retention-team
- https://research.duolingo.com/papers/yancey.kdd20.pdf (KDD 2020)
- https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/
- https://debugger.medium.com/duolingo-needs-to-chill-8f1832745ca0
- https://uxdesign.cc/duolingos-6-step-reactivation-experience-9ad65f04a569
- https://blog.duolingo.com/back-from-the-brink-what-duolingo-learned-about-its-resurrected-users
- https://www.wusf.org/2025-02-26/duolingos-owl-mascot-is-alive-after-all-what-did-it-gain-from-faking-his-death (26/02/2025)
- https://duolingo.deconstructoroffun.com/mechanics/leagues
- https://sensortower.com/blog/duolingos-gamified-success-a-language-learning-triumph
- https://viblo.asia/p/duolingo-streak-vi-sao-nguoi-hoc-co-giu-chuoi-ymJXDZ0qJkq [secundária]

**Ingress**
- https://ingress.fandom.com/wiki/Illuminator
- https://fevgames.net/ingress/ingress-how-to-play-series/
- https://tomsguide.com/us/ingress-tips-new-players,review-2257.html

**Nike Run Club**
- https://www.nike.com/help/a/nrc-run-level
- https://9to5mac.com/2020/03/30/nike-run-club-update/ (30/03/2020)
- https://www.apkmirror.com/apk/nike-inc/nike-run-club/nike-run-club-3-3-0-release

**Jogos de território**
- https://apps.apple.com/app/id6472631698 (INTVL)
- https://justuseapp.com/en/app/6472631698/intvl/reviews
- https://sportssteps.com/intvl-app-turning-every-run-into-a-game-of-territory-and-triumph/
- https://bikerumor.com/intvl-launches-bike-mode-opening-pokemon-go-style-territory-game-for-cyclists/
- https://kotaku.com/download/intvl
- https://fueledbylolz.com/2026/06/09/intvl-running-app-review/ (09/06/2026)
- https://rundida.com/guide/kyro-territory-run-guide/
- https://www.dexerto.com/gaming/new-running-app-turns-your-neighborhood-into-a-real-life-civ-7-game-3389630/
- https://en.wikipedia.org/wiki/Turf_(video_game)
- https://www.esoc.org.uk/news/turf-the-art-of-armpitying
- https://www.geograph.ie/photo/7380865
- https://www.fitness-gaming.com/news/fitness-and-sports/run-an-empire.html
- https://applevis.com/apps/ios/games/run-empire

**Ciência e ética**
- https://www.its.caltech.edu/~jkenny/nb250c/papers/Schultz-1997.pdf (Schultz, Dayan e Montague, 1997)
- https://gruber.yale.edu/recipient/wolfram-schultz
- https://behaviormodel.org/
- https://www.thebehavioralscientist.com/?p=3058
- https://ijbnpa.biomedcentral.com/track/pdf/10.1186/1479-5868-9-78 (Teixeira et al., 2012)
- https://yukaichou.com/the-ultimate-guide-to-gamification-past-present-and-future/
- https://en.wikipedia.org/wiki/Goal_pursuit
- https://uxdesign.cc/endowed-progress-effect-give-your-users-a-head-start-97d52d8b0396
- https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html (Ghibellini e Meier, 2025)
- https://ius.uzh.ch/dam/jcr:5ae9adc9-61ec-4174-b37c-4b752f36c23b/Kahnemann%20et%20al.%20-%20When%20More%20Pain%20is%20Preferred%20to%20Less%20(1993).pdf
- https://en.wikipedia.org/wiki/Peak%E2%80%93end_rule
- https://scholars.duke.edu/publication/861385 (Norton, Mochon e Ariely, 2012)
- https://penntoday.upenn.edu/news/wharton-study-best-ways-boost-workout-habits (Milkman et al., Nature 2021)
- https://www.scimex.org/newsfeed/which-programs-give-gym-goers-the-biggest-boost
- https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf
- https://www.sciencedaily.com/releases/2011/05/110518161707.htm (Feltz et al., 2011)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4991586
- https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit (Lally et al.)
- https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit
- https://todayfm.com/news/nuig-study-warns-fitness-app-users-may-develop-obsessive-tendencies-949954
- https://zaguan.unizar.es/record/96231
- https://sdtimes.com/addiction/ethics-addiction-and-dark-patterns/
- https://mitpressbookstore.mit.edu/book/9780691278285 (Schüll, *Addiction by Design*)
- https://hunton.com/privacy-and-information-security-law/ftc-releases-report-on-dark-patterns (27/09/2022)
- https://www.agg.com/news-insights/publications/the-ftc-blacklists-dark-patterns/
- https://www.poder360.com.br/poder-governo/eca-digital-entra-em-vigor-nesta-3a-feira-entenda-o-que-muda/ (17/03/2026)
- https://www.conjur.com.br/2025-out-22/impactos-do-eca-digital-no-segmento-de-jogos-eletronicos/ (22/10/2025)
- https://www.tecmundo.com.br/voxel/502437-loot-boxes-serao-proibidas-no-brasil-apos-sancao-de-lula-entenda-impacto-da-lei-felca-nos-games.htm
- https://9to5mac.com/2024/07/16/close-your-ringsbut-in-watchos-11-its-okay-if-you-dont/ (16/07/2024)
- https://macrumors.com/2024/09/16/apple-releases-watchos-11 (16/09/2024)
- https://www.spabusiness.com/wellness-news/Kind-activity-tracker-Gentler-Streak-wins-Apple-Watch-App-of-the-Year/350559

**Retenção e notificações**
- https://lovable.dev/guides/what-is-a-good-retention-rate-for-an-app
- https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/
- https://businessofapps.com/data/health-fitness-app-benchmarks
- https://www.adjust.com/blog/what-makes-a-good-retention-rate/
- https://athletechnews.com/fitness-apps-monetizable-winner-take-all-or-most/ (RevenueCat 2025)
- https://www.revenuecat.com/blog/company/the-state-of-subscription-apps-2025-launch.md
- https://onesignal.com/mobile-app-benchmarks-2024
- https://grow.urbanairship.com/rs/313-QPJ-195/images/WP_App_Retention_Rates_Benchmarks.pdf
