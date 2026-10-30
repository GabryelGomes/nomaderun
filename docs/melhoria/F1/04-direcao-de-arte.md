# F1 · E4 — Direção de arte e ilustração

> **Equipe:** E4 (direção de arte). **Fase:** F1, descoberta e design. **Data:** 23/10/2026.
> **Escopo de escrita:** este arquivo e `docs/melhoria/F1/arte/`. Nenhum código de produção foi alterado.

## 0. Resumo em 10 linhas

1. **Problema:** fora o Mapa, as abas só têm texto. Os times são um nome, uma cor e uma frase, e o chefão da Raid é um título em negrito (`docs/ui-audit/d59-app-neon-390.png`, `t63-arena-375.png`).
2. **Proposta:** um sistema de ilustração **"neon line-art geométrico"** com o mesmo brilho do Pit Lane Neon, em SVG parametrizado (cor, pose, estado, tamanho), pronto para virar `react-native-svg` + Reanimated.
3. **Times com alma:** 4 mascotes (Lume, Faísca, Breu, Faro), 4 líderes, biografias, estilo de corrida, grito de guerra e vibração própria.
4. **Chefões:** 5 vilões de rua (Soneca, Rei Buzina, Fuligem, Mormaço, Paredão), uma família visual única (contorno violeta e olhos incandescentes).
5. **Protótipos reais:** 57 SVGs renderizados em PNG e revisados em **3 rodadas**:
   - 4 mascotes × 3 poses, 8 emblemas, 2 chefões completos (4 estados) e mais 3 no elenco;
   - 6 baús, 5 medalhas, 4 estados vazios, 8 ícones de modo e 3 cartões do tutorial.
6. **Folha de contato:** `arte/folha.png`. **Aplicação em tela de celular:** `arte/aplicacao.png`.
7. **Fonte reproduzível:** `arte/fonte/*.cjs` gera todos os SVGs. É a mesma lógica dos componentes da F3 (o porte é direto).
8. **Ética (com a E1):** "derrota" = cansado, ofegante e sorrindo. Night Owls = "luzes da cidade", não madrugada. Mormaço e Fuligem nunca incentivam correr no calor extremo ou na fumaça.
9. **Decisões pendentes:** cor reservada aos vilões, lema dos Owls, nomes dos personagens, busto × corpo inteiro (§15).
10. **F3/F4:** 11 tarefas propostas (§17).

---

## 1. Diagnóstico visual do app atual

| Tela (captura) | O que tem | O que falta |
|---|---|---|
| Arena (`t63-arena-375.png`, `d59`) | Card da Raid com número grande e barra cinza; lista de modos com ícones do sistema (SF Symbols / Material) | O chefão não tem rosto. Os modos são texto com um ícone genérico, que não é da marca |
| Atividades, Clube e Perfil (`d59`) | Cards de texto, contadores "0" | Estados vazios sem ilustração: "Nenhuma corrida neste período" é só um parágrafo |
| Escolha de time (`t62-onboarding-360.png`) | 4 linhas com o selo (círculo com a forma) e o lema | Não há mascote, líder nem emoção: escolher um time parece preencher um formulário |
| Selos (`team-badge.tsx`, `neon-badges.tsx`) | Forma do time em branco sobre um círculo de cor sólida | Bom como sinal pequeno (≤ 24 px), sem personalidade nos tamanhos grandes |
| Mockup da apresentação (`docs/apresentacao/mockup/imagens/tel-conquista.png`) | O neon que queremos: traço luminoso, raios, laranja com brilho | O app ainda não chegou a esse nível de "pôster" |

**Conclusão:** o design system (cores, brilho, tipografia) já está pronto. Falta a **camada de personagens e objetos** que dá motivo para olhar a tela.

---

## 2. O traço: regras do sistema de ilustração

### 2.1 Princípios
- **Linha luminosa sobre o escuro.** Fundo `#070708`; o desenho é feito de traços, e o preenchimento é só um escuro opaco (`#0A0B0E`) com 6–16% da cor do traço, para tapar o que fica atrás.
- **Geometria antes de detalhe.** Retas, arcos e poucos nós. Rostos com ângulos (sobrancelhas em cunha, olhos amendoados), como emblemas de esporte e e-sport.
- **Três cores por peça, no máximo:** a cor do dono (time, raridade ou vilão), o **laranja `#FF6A13`** como acento (orelha interna, rastro, raios) e o **branco quente `#F3F1ED`** para olhos, dentes e brilho.
- **A forma do time sempre presente** (acessibilidade, não depender só da cor), em 4 lugares:
  - a **aura** atrás da cabeça;
  - o **número de peito** (o "peitoral" da corrida, com a forma);
  - a **moldura do emblema**;
  - detalhes do rosto: pintas redondas (Lume), olhos em losango (Breu), pupilas quadradas (Faro).
- **Expressivo, não infantil:** sobrancelha e pálpebra contam a emoção. Nada de olho de boneco, bochecha rosada ou lágrima.
- **Corrida no DNA:** linhas de velocidade, número de peito, regata, tênis e rota.

### 2.2 Construção do brilho (sem filtro, roda no Android)
Cada traço é desenhado em 4 camadas da **mesma** geometria (`fonte/neon.cjs`, função `neon()`):

| Camada | Espessura | Opacidade | Função |
|---|---|---|---|
| Halo externo | 4,6 × t | 7% | brilho largo |
| Halo médio | 2,4 × t | 20% | brilho próximo |
| Núcleo | t | 100% | a linha |
| Filete quente | 0,36 × t | 35–60%, cor misturada com 72% de branco | o "tubo de neon" aceso |

É o mesmo efeito do `textGlow` e do `buttonGlow` do `neon.ts`, só que em vetor. **Nenhuma sombra preta, nenhum `feGaussianBlur`.** Se a E2 confirmar o Skia no Expo Go SDK 57, os heróis (vitória, chefão derrotado) podem ganhar um blur real. Não é obrigatório.

### 2.3 Grades e espessuras
| Família | viewBox | Traço principal | Detalhe |
|---|---|---|---|
| Mascote (busto) | 200 × 220 | 3,6 | 2–2,6 |
| Emblema | 200 × 200 | 4 (moldura) | 2 |
| Chefão | 240 × 240 (chão em y = 226) | 3,4–4,2 | 1,6–2,6 |
| Baú | 160 × 160 | 3,6 | 2,2 |
| Medalha | 120 × 150 | 3 | 1,6 |
| Estado vazio | 240 × 160 | 3,4 | 2–2,4 |
| Tutorial | 240 × 180 | 3,4–4 | 1,6 |
| Ícone de modo | 64 × 64 | 3 | 2–2,4 |

### 2.4 Paleta
| Dono | Cor | Claro (filete) | Profundo (preenchimento) | Tinta 12% |
|---|---|---|---|---|
| Neon Striders | `#2FA8FF` | `#C5E7FF` | `#0D1E2B` | `#2FA8FF1F` |
| Volt Runners | `#19E6A8` | `#BFF8E7` | `#0A261E` | `#19E6A81F` |
| Night Owls | `#FF2D55` | `#FFC4CF` | `#2A0C13` | `#FF2D551F` |
| Urban Coyotes | `#FFD60A` | `#FFF4BA` | `#2A2408` | `#FFD60A1F` |
| **Vilões (proposta)** | `#B15CFF` | `#E9D1FF` | `#1F132B` | `#B15CFF1F` |
| Acento da marca | `#FF6A13` | — | `#2B1407` (`neon.glowBg`) | — |
| Brasa (furioso) | `#FF4A1C` | — | — | — |
| Raridade comum / rara / lendária | branco quente / laranja / **prisma das 4 cores** | | | |

O violeta foi escolhido porque não colide com nenhum time nem com o laranja, e lê como "ameaça" no neon. Precisa virar token: **decisão D1**, e o `tokens.ts`/`neon.ts` são da E6.

---

## 3. Bíblia dos times

> **Regra de ouro (E1):** cada time = **1 valor + 1 estilo**, nunca vantagem de pontos. O líder fala em 2 frases (valor + convite) e **nunca fala mal de outro time**.

### 3.1 Neon Striders: azul `#2FA8FF`, círculo
- **Mascote: Lume, o guepardo.** É o animal mais rápido, mas o que vence é o **controle**. As pintas são **círculos** (a forma do time), e as "linhas de lágrima" laranja do guepardo funcionam como marca de mira.
- **Líder: Íris Valente.** Ex-meio-fundista de pista (800 m), treinadora de intervalados. Calma, exata, fala pouco e sorri de canto. Usa relógio e conta passos.
  - Fala 1 (escolha): "Ritmo não é velocidade. É saber quanto você ainda tem. Encontra o seu passo com a gente?"
  - Fala 2 (conquista): "Passo certo, zona nossa. Viu como a precisão pinta a cidade?"
- **Bio curta (60 caracteres):** "Ritmo exato, passo no lugar: cada quilômetro no tempo certo."
- **Bio longa:**
  - Os Striders nasceram nas pistas de atletismo de Goiânia, entre gente que conta voltas, não desculpas.
  - Acreditam que correr bem é correr **do jeito certo**: aquecer, segurar o ritmo e acelerar no fim.
  - Pintam a cidade quilômetro a quilômetro, sem pressa e sem parar.
  - Para um Strider, o relógio é aliado, não juiz.
- **Estilo de corrida (identidade):** ritmo constante, intervalados, "negativar" a segunda metade.
- **Grito de guerra:** "Passo certo, cidade azul!"
- **Vibração "metrônomo":** 3 × leve com intervalo regular de 180 ms.
- **Poses:**
  - parado: olhar focado, sorriso de canto;
  - vitória: olhos fechados de satisfação, boca aberta, raios azuis;
  - derrota: cansado, ofegante, sorrindo.

### 3.2 Volt Runners: verde `#19E6A8`, triângulo
- **Mascote: Faísca, a lebre elétrica.** Vira a fábula do avesso: "na fábula a lebre dormiu; a nossa não para". Tem raios laranja dentro das orelhas, o rosto em triângulo e um sorriso marrento com os dentões.
- **Líder: Téo Faria.** Ultramaratonista, otimista incansável, piadista. Mede a corrida em "baterias" e nunca em dor.
  - Fala 1: "Cansou? Ótimo, agora começa a parte boa. Vem carregar com a gente?"
  - Fala 2: "A bateria recarrega correndo. Bora mais um quilômetro?"
- **Bio curta (70 caracteres):** "Na fábula a lebre dormiu. A nossa não para: cada quilômetro recarrega."
- **Bio longa:**
  - Os Volt Runners são os corredores de longão de domingo, que saem com o sol e voltam com histórias.
  - Para eles, a distância é uma bateria que enche: quanto mais longe, mais energia.
  - Preferem constância a pressa e celebram cada quilômetro a mais do que na semana passada.
  - Um Volt nunca corre para fugir do cansaço, mas para descobrir o que vem depois dele.
- **Estilo de corrida:** resistência e distância, o longão da semana.
- **Grito de guerra:** "Liga, carrega, não para!"
- **Vibração "carga":** leve → média → forte (90 ms entre elas) e fecha com "sucesso".
- **Poses:**
  - parado: olhos amendoados ansiosos, sorriso torto;
  - vitória: gargalhada com os dentões e orelhas em pé;
  - derrota: orelhas caídas para os lados, ofegante e sorrindo.

### 3.3 Night Owls: vermelho `#FF2D55`, losango
- **Mascote: Breu, a coruja.** Penachos em duas pontas, "disco facial" em dois losangos, olhos laranja com **pupila em losango** e bico branco. É a mais "fria" dos quatro: confiante, de poucas palavras.
- **Líder: Nara Lis.** Fotógrafa de rua, corre depois do expediente, quando a cidade acende. Observadora, gentil, misteriosa. **É a porta-voz da Corrida Segura.**
  - Fala 1: "A cidade muda quando as luzes acendem. Corre com a gente nesse brilho?"
  - Fala 2: "Rua iluminada, contato avisado e o bairro pintado de vermelho. Bonito, né?"
- **Bio curta (73 caracteres):** "Correm quando a cidade acende as luzes e pintam o fim do dia de vermelho."
- **Bio longa:**
  - Os Night Owls saem quando o expediente acaba e a cidade troca o sol pelos postes.
  - Conhecem as avenidas iluminadas, os parques abertos e o caminho de volta mais seguro.
  - Correm de fone, em silêncio, e deixam o rastro vermelho como assinatura.
  - Para um Owl, o fim do dia não é cansaço: é a melhor hora da cidade.
- **Estilo de corrida:** corridas do fim do dia, nas luzes da cidade, **sempre com a Corrida Segura**. Nenhuma regra premia o horário.
- **Alerta (E1):** o lema atual "Donos da madrugada" incentiva correr em horário de risco. **Proposta:** "Donos das luzes da cidade" (ver D3).
- **Grito de guerra:** "Acende a cidade!"
- **Vibração "asa":** média, leve (70 ms), pausa de 300 ms, média.
- **Poses:**
  - parado: sobrancelhas em V, olhar frio;
  - vitória: olhos laranja em arco, penachos em pé;
  - derrota: pálpebras pesadas, ofegante.

### 3.4 Urban Coyotes: amarelo `#FFD60A`, quadrado
- **Mascote: Faro, o coiote.** Orelhas enormes (a direita com um corte, marca de rua), juba nas bochechas, nariz e pupilas **quadrados** e uma **bandana laranja** com estampa de quadrados. Sorriso de lado com um canino: o malandro gente boa da matilha.
- **Líder: Bento Rocha.** Organiza o treino de sábado na praça há 20 anos. Voz de comando e coração enorme; sabe o nome de todo mundo.
  - Fala 1: "Aqui ninguém fica para trás. Nem você. Chega mais?"
  - Fala 2: "Sozinho você corre. Em matilha, a gente pinta o bairro inteiro."
- **Bio curta (77 caracteres):** "Correm em matilha pela cidade: ninguém fica para trás, e o bairro é de todos."
- **Bio longa:**
  - Os Urban Coyotes nasceram nos grupos de corrida de praça e nos treinos de sábado com café depois.
  - Correm juntos, esperam quem está atrás e comemoram a zona de todo mundo como se fosse sua.
  - Conhecem os atalhos, os bebedouros e cada vira-lata do caminho.
  - Para um Coyote, a corrida só termina quando o último chega.
- **Estilo de corrida:** em grupo, com a crew e no treino coletivo.
- **Grito de guerra:** "Ninguém fica pra trás!"
- **Vibração "matilha":** 4 × média rápidas (60 ms) e uma forte.
- **Poses:**
  - parado: uma sobrancelha erguida e sorriso de lado;
  - vitória: uivo de boca aberta;
  - derrota: orelhas caídas e ofegante, sorrindo.

### 3.5 Quiz "Não sei escolher" (proposta para E6/E7; a escolha continua livre)
1. **Sua corrida ideal é…** (a) bater o ritmo certinho → Striders · (b) ir mais longe que semana passada → Volt · (c) ver a cidade acesa no fim do dia → Owls · (d) correr com a galera → Coyotes.
2. **No fim da corrida você…** (a) confere as parciais · (b) já planeja o próximo longão · (c) tira foto da cidade · (d) espera o grupo e vai tomar um café.
3. **Seu superpoder é…** (a) foco · (b) fôlego · (c) olhar · (d) parceria.

A maioria das respostas pré-seleciona um time. Em caso de empate, vale a resposta da pergunta 1.

---

## 4. Chefões da Raid

**Regra da família:** **contorno violeta** (vilão) + **1 material** próprio (laranja, branco ou cinza) + **olhos brancos incandescentes**. Todos com chão tracejado (um "palco") e silhuetas bem diferentes entre si, para reconhecer de longe.

**Estados e regra de exibição (para E3/E5/E9):**

| Estado | Quando | O que muda no desenho |
|---|---|---|
| `parado` | vida de 100% a 34% | pose de ameaça; a partir de 66%, camada de **dano 1** (rachaduras) |
| `golpe` | ao sincronizar uma corrida com dano (800 ms) | versão clara (flash), olhos espremidos `> <`, estrela de impacto, inclina para trás |
| `furioso` | vida ≤ 33% | cor em brasa, halo mais forte, olhos maiores, boca aberta com presas, tremor e vapor |
| `derrotado` | vida 0 | cai, olhos em X, peças soltas, fumaça, brilho a 60% |

| # | Chefão | Obstáculo urbano | Silhueta | Material | Fala de entrada | Fala de derrota | Protótipo |
|---|---|---|---|---|---|---|---|
| 1 | **Soneca** | preguiça, "só amanhã" | despertador redondo com sinos-chifres e perninhas | branco (sinos) | "Só mais cinco minutinhos... a semana inteira." | "Tá bom, tá bom... levantei." | parado |
| 2 | **Rei Buzina** | trânsito, carro em cima da faixa | carro-trono com coroa de 3 cones, faróis no lugar dos olhos, grade de dentes | laranja (cones) | "Aqui quem manda é o engarrafamento. Buzina pra mim!" | "Tá... abre o sinal." | parado |
| 3 | **Fuligem** | fumaça, poluição | nuvem densa com escapamentos no lugar dos braços | cinza | "Respira fundo... se tiver coragem." | "Ventou... e eu sumi." | parado |
| 4 | **Mormaço** | calor, ar parado | sol de lâminas com corte "synthwave" no disco, sorriso de serra | laranja | "Quarenta graus e ar parado. Só me vence quem corre cedo." | "Isso é... chuva?" | **4 estados** |
| 5 | **Paredão** | concreto, muro, ladeira | golem de tijolos, ombros largos, cabeça afundada, vergalhões laranja | laranja (rachaduras) | "Cimento, muro e ladeira. Por aqui ninguém passa." | "...desmoronei." | **4 estados** |

**Calendário sugerido (Chefão da semana, conforme a pesquisa da E1):**
- **Soneca:** janeiro, a volta das férias.
- **Mormaço:** setembro e outubro, o calor de Goiânia. Mantém o "Mormaço de Outubro" do `demo-data.ts`.
- **Fuligem:** novembro, quando as chuvas limpam o ar.
- **Rei Buzina:** março, a volta às aulas.
- **Paredão:** o resto do ano, em rodízio.

**Proteção de saúde (X1):**
- O Mormaço e a Fuligem são metáforas. Nenhum texto diz "corra no calor" ou "corra na fumaça", e a fala do Mormaço já ensina a correr cedo.
- **Pedido para E7/E9:** não agendar a Fuligem nos meses de queimadas (agosto e setembro em Goiás). Se houver alerta de calor extremo, o card mostra "Corra cedo e leve água".

**Dano progressivo (proposta):** a prop `dano: 0 | 1 | 2` acrescenta camadas de rachadura. O nível 1 entra aos 66% e o nível 2 aos 33%, junto com o furioso. Assim a cidade **vê** o chefão apanhar.

---

## 5. Baús (3 raridades)

| Raridade | Cor | Forma (sem depender da cor) | Parado |
|---|---|---|---|
| Comum | branco quente | tampa arqueada, 2 tiras, cadeado simples | sem movimento |
| Raro | laranja | + cantoneiras, rebites e uma nervura na tampa | brilho que percorre a borda a cada 4 s |
| Lendário | **prisma** (gradiente com as 4 cores dos times: o baú "é da cidade") | + coroa de cristal com gema e raios ao fundo | raios girando devagar (12 s) e gema pulsando |

Os estados `fechado`, `abrindo` e `aberto` foram desenhados (raro e lendário). A raridade casa com o tipo `ChestRarity` que já existe (`'comum' | 'raro' | 'lendario'`).

---

## 6. Medalhas (12)

**Base comum:** fita em V, roseta de 24 dentes, anel interno e ícone central. **Nível sem amarelo nem dourado** (o amarelo é dos Coyotes):
- bronze: 1 estrela, laranja com brilho baixo;
- prata: 2 estrelas, branco quente;
- ouro: 3 estrelas, laranja pleno e raios.

**Bloqueada:** silhueta tracejada em cinza com cadeado, para a "estante" do Perfil (antecipação, como sugere a E1).

| # | Medalha | Ícone | Critério sugerido (E3/E7 definem) | Protótipo |
|---|---|---|---|---|
| 1 | Primeiros passos | tênis | 1ª corrida | — |
| 2 | Explorador | rosa dos ventos | revelar 100 células / um bairro no Atlas | ✅ |
| 3 | Conquistador | bandeira fincada numa zona | 1ª zona conquistada | ✅ |
| 4 | Defensor | escudo com check | defender uma zona sob ataque | — |
| 5 | Sequência | chama | 4 semanas seguidas | ✅ |
| 6 | Caçador | baú pequeno | abrir 10 baús | — |
| 7 | Chefão | máscara do chefão (uma variação por chefão) | dar ao menos 1 golpe | ✅ |
| 8 | Fuga | dois corredores, um tracejado | vencer 5 fugas | — |
| 9 | Liga | 3 colunas e uma estrela | subir de divisão | — |
| 10 | Crew | 3 cabeças | bater a meta semanal da crew | — |
| 11 | Temporada | estrela de 8 pontas | completar a trilha da temporada | — |
| 12 | Desafio do mês | calendário + número do mês (bronze 50%, prata 100%, ouro 150%) | ex.: 50 km em novembro | — |
| — | Bloqueada | cadeado | — | ✅ |

---

## 7. Ícones dos modos (8)

Os ícones de Domínio, Atlas (Neblina), Fuga, Caça, Raid, Liga, Cidade × Cidade e Crews foram **todos desenhados** (`modo-*.svg`), em traço único branco quente com um acento laranja. A exceção é a Raid, com o violeta dos vilões. A proposta é substituir os SF Symbols/Material **só na Arena** (cards de modo). A barra de abas e os controles continuam no `Icon` nativo. Missões e Desafios ganham ícone na F3, se entrarem.

---

## 8. Estados vazios (8)

**Regra:** 1 ilustração + 1 frase (≤ 90 caracteres) + 1 ação. Onde fizer sentido, o **mascote do time do usuário** aparece (o vazio vira personalidade).

| # | Situação | Ilustração | Frase | Ação | Protótipo |
|---|---|---|---|---|---|
| 1 | Sem corridas | tênis com linhas de velocidade e rota tracejada até um ponto pulsando | "Sua primeira corrida pinta o bairro." | Correr | ✅ |
| 2 | Sem crew | 1 corredor aceso e 2 vagas tracejadas com "+" | "Correr junto vale mais. Crie ou entre numa crew." | Criar ou entrar | ✅ |
| 3 | Sem conexão | sinal com o arco externo apagado e um "x" | "Sem internet. Sua corrida fica salva e sobe depois." | Tentar de novo | ✅ |
| 4 | Sem notificações | **mascote do time dormindo** com "Z" | "Tudo calmo no seu território." | — | ✅ (Breu) |
| 5 | Sem zonas | bandeira tracejada sobre uma região apagada | "Corra 500 m para pintar sua primeira zona." | Correr | — |
| 6 | Sem medalhas | estante com 3 silhuetas bloqueadas | "Sua estante começa na primeira corrida." | Ver medalhas | — |
| 7 | Sem contatos de segurança | escudo com uma pessoa tracejada | "Adicione alguém de confiança para correr tranquilo." | Adicionar contato | — |
| 8 | Sem localização | pino com arcos tracejados e o mascote olhando o mapa | "Ative a localização para pintar a cidade." | Permitir | — |

---

## 9. Cartões do tutorial (3)

Os três foram desenhados sobre um "mapa" de ruas apagadas, com a cor do time como parâmetro:

1. **Corra:** a rota laranja se desenha até um ponto que pulsa.
2. **Pinte:** a zona se enche com a cor do time, com o círculo do time no centro.
3. **Defenda:** a zona do time com escudo e check laranja, e o anel tracejado do rival em volta (o mesmo sinal de ataque do `TeamBadge`).

**Dependência:** o cartão "Pinte" precisa mostrar a **regra nova** de território da E3. O desenho atual é genérico e será ajustado.

---

## 10. Fundos sutis das abas (especificação; estáticos, `aria-hidden`, sem toque)

| Aba | Fundo | Opacidade |
|---|---|---|
| Mapa | nenhum (o mapa é o herói) | — |
| Arena | grade em perspectiva "synthwave" no topo com uma linha de horizonte laranja e, atrás do card do chefão, um halo violeta | 4–6% |
| Atividades | curvas de nível / rotas em branco quente | 3% |
| Clube | padrão com as 4 formas dos times espalhadas | 3% |
| Perfil | aura gigante da forma do **meu** time, na cor do time | 6% |

Com "Reduzir movimento" ou durante a corrida, nada se mexe. Fora isso, há no máximo um deslocamento de 30 s, que pode ser desligado.

---

## 11. Especificação de animação (para a E5)

**Contrato com os componentes:** cada peça expõe **grupos com id e pivô** (`cabeca` com pivô em (100,150) no busto; `olhos`; `aura`; `raios`; `tampa` com pivô na dobradiça (30,86); `corpo`). Movimento só de **transform e opacidade** (P9). O movimento do desenho inteiro vai num `Animated.View` em volta do `Svg`, que é o mais barato. Os detalhes internos usam `useAnimatedProps` num `G`. O `d` dos paths nunca é animado.

| Peça | Animação | Como | Duração | Vibração |
|---|---|---|---|---|
| Mascote · parado (loop) | respirar | `corpo` scaleY 1 → 1,015 | 4 s, ease-in-out, ida e volta | — |
| | cabeça | rotate ±1,5° com defasagem de 1 s | 4 s | — |
| | piscar | `olhos` scaleY 1 → 0,1 → 1 | 120 ms, a cada 3–6 s aleatório | — |
| | assinatura de cada time | Lume: pintas acendem em sequência (600 ms) · Faísca: raios das orelhas tremeluzem (a cada 2,5 s) · Breu: olhos pulsam brilho (2,8 s) · Faro: orelha cortada gira 6° (a cada 5 s) | — | — |
| Mascote · vitória | pulo | agacha (scaleY 0,92, 80 ms) → sobe 14 px com spring → raios entram em cascata (scale 0 → 1, 30 ms entre eles) → faíscas | 900 ms e depois volta ao parado | padrão do time |
| Mascote · derrota | fôlego | cabeça desce 6 px e inclina 5° (spring suave); linhas de fôlego piscam | 700 ms + loop de 1 s, volta em 2 s | — |
| Emblema · entrada | desenho | moldura com `strokeDashoffset` (draw-on) → cabeça com scale 0,8 → 1 (spring) → faixa desliza | 600 + 300 + 200 ms | leve |
| Emblema · parado | brilho | um segmento claro percorre a moldura (dash animado) | 3 s, loop | — |
| Confirmação do time | inundar | círculo na cor do time cresce do emblema até a tela inteira; mascote em vitória; fala do líder | 1,2 s | padrão do time (forte) |
| Chefão · parado | flutuar | translateY ±3 px | 2,4 s | — |
| | assinatura | Mormaço: raios giram 360° em 40 s · Paredão: respira pesado (scaleX 1,01) · Soneca: tique-taque ±2° em passos de 1 s · Rei Buzina: faróis piscam · Fuligem: contorno pulsa em X/Y alternados | — | — |
| Chefão · golpe | flash + tremor | sobrepõe a arte `golpe` (opacidade 1 → 0 em 300 ms); translateX [-8, 8, -5, 5, 0]; número de dano flutuando e "barra fantasma" (E5) | 800 ms | média |
| Chefão · furioso | tremor contínuo | ±1,5 px a cada 120 ms; halo pulsando (600 ms); vapor subindo | loop | — |
| Chefão · derrotado | queda | cai (rotate 14°, translateY 30, spring pouco amortecido) → explode em 8–12 partículas com as **formas dos 4 times** → fica a arte `derrotado` a 60% | 2 s | sucesso |
| Baú · abrindo | abrir | treme 3× (±4°, 90 ms, crescente) → fresta de luz → `tampa` salta (spring) → raios (scale 0 → 1) → item sobe | 1,5 s | crescente: leve → média → forte |
| Medalha · ganha | carimbo | scale 1,6 → 1 com overshoot e rotate -8° → 0 + flash + faísca | 300 ms + 300 ms | média |
| Medalha · desbloqueio | traço | o contorno tracejado vira contínuo (dash animado) e o ícone acende | 500 ms | leve |
| Estado vazio | 1 detalhe vivo | tênis: linhas de velocidade · crew: "+" pulsa · conexão: arcos acendem em sequência · notificações: "Z" sobem e somem | 1,2–2 s, loop | — |
| Tutorial | explicar | rota com draw-on (1,2 s) → zona pinta (fill 0 → 22%, 600 ms) → escudo carimba | 2,4 s | leve no fim |

**Reduzir movimento:** sem loops; poses e estados trocam por **fade de 200 ms**; o draw-on vira a arte completa.
**Durante a corrida:** só as artes estáticas, nenhum loop (§11 do prompt).

---

## 12. Guia de uso: onde cada peça entra (proposta para a E6 decidir)

| Tela | Peça | Tamanho | Observação |
|---|---|---|---|
| Escolha de time (onboarding) | 4 mascotes parados (grade 2 × 2) → toque abre o líder → confirmação com o mascote em vitória | cards de ~170 px; herói de 300 px | ver `arte/aplicacao.png`, telas 1 e 3 |
| Página do time (Perfil › Meu time) | emblema animado + mascote + bio longa + líder | herói de 240 px | — |
| Mapa (cabeçalho) | emblema **compacto** do meu time | 32–40 px | abaixo de 24 px continua o `TeamBadge` |
| Arena | card da Raid com o chefão (herói) + grade de modos com os ícones novos | chefão de ~150 px; ícones de 44 px | `aplicacao.png`, tela 2 |
| Resumo da corrida | golpe no chefão; baú abrindo; medalha carimbando; mascote em vitória | 120–200 px | ordem de "pico" da §3 do prompt |
| Atividades / Clube / Notificações / Corrida Segura | estados vazios | 200–240 px | §8 |
| Perfil | estante de medalhas (ganhas e bloqueadas) | 64–80 px | — |
| Folha "?" de cada modo | cartões do tutorial | largura total | — |
| Card do Instagram (E8) | mascote em vitória + emblema | herói | — |
| Ranking de times | emblemas compactos | 32 px | — |

**Teste em tamanho real (feito):**
- os mascotes ficam legíveis com **40 px**;
- os emblemas com faixa de texto **não** funcionam com 32 px; por isso foi criada a versão **compacta**, sem faixa;
- abaixo de 24 px fica o `TeamBadge` atual.

---

## 13. Arquitetura proposta para a F3 (`apps/mobile/src/components/art/`)

```
art/
  neon/neon-path.tsx      // primitiva NeonPath/NeonShape/GlowFill (as 4 camadas) + prop quality
  neon/palette.ts         // lê neonTeam/neon de theme (sem hex novo fora do token do vilão)
  team/mascot.tsx         // <Mascot team pose="parado|vitoria|derrota|dormindo" size quality animated />
  team/faces/*.ts         // dados de path de Lume, Faísca, Breu e Faro (copiados de fonte/times.cjs)
  team/emblem.tsx         // <TeamEmblem team size compact />  (nome do time fica num <Text> fora do SVG)
  team/leader.tsx         // <LeaderBust team size />  (a desenhar)
  boss/boss.tsx           // <Boss id state dano size />
  chest/chest.tsx         // <Chest rarity state size />
  medal/medal.tsx         // <Medal kind tier locked size />
  mode-icons/mode-icon.tsx
  empty/empty-art.tsx     // <EmptyArt kind team? />
  tutorial/tutorial-art.tsx
  backgrounds/tab-background.tsx
  index.ts
```

**Níveis de qualidade (desempenho):** um mascote "completo" tem cerca de 230 elementos SVG (4 camadas por traço).

| `quality` | Camadas | Quando usar |
|---|---|---|
| `full` | 4 (halo largo, halo médio, núcleo, filete) | herói, no máximo 2 por tela |
| `lite` | 2 (halo médio + núcleo), cerca de metade dos elementos | listas, cards e tamanhos < 96 px |
| `flat` | só o núcleo | < 40 px e capturas de teste |

- As strings de path são constantes de módulo; os componentes usam `memo`.
- **Acessibilidade:**
  - ilustração decorativa fica dentro de `View aria-hidden`, como o `TeamBadge` já faz (o Svg com props `accessibility*` vaza para o DOM na web);
  - ilustração com informação (estado do chefão, raridade, medalha) tem `accessibilityLabel` no `View` que a envolve.
- **Texto:** não colocar `<text>` dentro do SVG no app, porque a fonte não é garantida. A faixa do emblema recebe o nome por um `Text` sobreposto.
- **Testes:** 1 por família (renderiza sem erro, aplica `color` e `size`, cada pose ou estado gera uma árvore diferente). Para a evidência, um PNG por família da galeria `/dev/arte`.

---

## 14. Crítica honesta (rodadas e o que ainda falta)

**Rodadas feitas:** 3 nos mascotes e emblemas, 2 nos chefões e itens, mais 1 teste em tamanho real.

| Rodada | Problema visto no PNG | Correção |
|---|---|---|
| Mascotes 1 | Lume parecia **urso de pelúcia** (orelhas redondas no topo, pintas na testa); Faísca **fofo demais** (olho de boneco, dente solto); Faro com **focinho comprido** e bandana batendo no queixo | Lume ganhou orelhas baixas e laterais, bochechas largas, juba e pintas nas bochechas; Faísca, olhos amendoados e sorriso de canto com os dentes dentro da boca; Faro, focinho curto, juba e bandana mais baixa |
| Emblemas 1 | Cabeça pequena demais (a lebre sumia no triângulo); "URBAN COYOTES" estourava a faixa | Cabeça de 64–80% da moldura; texto menor; versão compacta |
| Mascotes 2 | Raios da vitória cortados no topo | Raios recentralizados |
| Mascotes 3 (com a E1) | "Derrota" triste parecia culpa (o anti-padrão do Duolingo) | Derrota = cansado, ofegante e **sorrindo**, com gota de suor e fôlego |
| Chefões 1 | Mormaço cortado nas bordas e com pontas "quebradas"; **Paredão parecia um robô de cartola**; os sinos da Soneca disformes; "chinelo" sem sentido; escapamentos da Fuligem viraram palitos | Raios simples e afiados, com escala; Paredão de ombros largos, cabeça afundada e sobrancelha em V; sinos em cúpula; escapamentos com volume e boca |
| Itens 1 | Baú lendário aberto cortado; tênis parecia **bota**; ícone do Domínio lia como "proibido" | Escala no aberto; tênis de perfil baixo; Domínio = zona meio pintada com fronteira e ponto |
| Aplicação | Emblema com faixa ilegível em 32 px | Emblema compacto (sem faixa) para tamanhos pequenos |

**O que ficou bom:**
- **Família coerente:** o mesmo traço, o mesmo brilho e uma cor por personagem. A folha de contato lê como um único jogo, não como clip-art.
- O neon combina com o mockup da apresentação e com o `neon.ts`, sem filtros.
- **A forma do time aparece em todo lugar** (aura, número de peito, moldura, pupilas): o daltônico não perde o time.
- Os mascotes têm **atitude diferente** entre si: foco (Lume), marra (Faísca), frieza (Breu) e malandragem (Faro).
- **Rei Buzina** e **Paredão furioso/derrotado** são as melhores peças: silhueta forte e humor sem infantilizar.
- A raridade dos baús lê pela forma e não só pela cor.
- Tudo é parametrizado e reproduzível (`fonte/gerar.cjs`): mudar uma cor ou um traço refaz as 57 peças.

**O que ainda precisa melhorar:**
- **Os bustos são frontais e simétricos.** Falta **corpo em movimento**: a vitória muda o rosto e os raios, mas não há pose de corrida. Uma versão 3/4 ou de corpo inteiro na tela de escolha daria muito mais energia (D4).
- Lume ainda lembra um "gato grande" genérico. Breu, de longe, lembra um gato pelos penachos. Dá para melhorar com um disco facial mais marcado e um bico maior.
- O Faísca é "marrento" e pode dividir opiniões. Vale testar com 5 pessoas (E10).
- **Os líderes não foram desenhados** (só nome, personalidade e falas). Na F3, eles precisam de busto no mesmo traço.
- Só 2 chefões têm os 4 estados. Soneca, Rei Buzina e Fuligem estão só parados.
- A **Soneca** é a mais infantil do elenco: precisa de mais ameaça (sobrancelha, sombra, ponteiros como garras).
- O Mormaço, de longe, lembra um "sol emoji". A assinatura (raios girando e corte synthwave) ajuda, mas um rosto mais autoral seria melhor.
- As medalhas estão todas no mesmo laranja: falta mostrar os 3 níveis (bronze, prata, ouro).
- Foram prototipados 4 dos 8 estados vazios e nenhum fundo de aba.
- O brilho por camadas é "duro" em telas grandes (vitória em 300 px). Um blur real com Skia deixaria mais luxuoso, se estiver disponível.

---

## 15. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Cor dos chefões | (a) **violeta `#B15CFF`** para toda a família · (b) uma cor por chefão · (c) só laranja | **(a)**: não colide com times nem com a marca; vira o token `neon.villain` (pedido para a E6 no `neon.ts`) |
| D2 | Nomes de mascotes e líderes | aprovar Lume/Íris, Faísca/Téo, Breu/Nara, Faro/Bento · deixar os donos do TCC escolherem | Aprovar como **proposta** e mostrar aos donos. Trocar nome não muda a arte |
| D3 | Lema dos Night Owls | manter "Donos da madrugada" · trocar por "Donos das luzes da cidade" | **Trocar** (segurança; a E1 também pede). `tokens.ts` é da E6 |
| D4 | Mascote em busto ou corpo inteiro | busto (feito) · corpo inteiro em corrida | **Busto na F3** (qualidade e desempenho garantidos); corpo inteiro só para a tela de escolha, na F4, se houver tempo |
| D5 | Chefão da demonstração | manter "Mormaço de Outubro" · trocar | **Manter**: o chefão "Mormaço" + o evento "de Outubro"; os 5 em rodízio semanal (§4) |
| D6 | Níveis de medalha | bronze/prata/ouro com cores metálicas · com estrelas + brilho | **Estrelas + brilho** (o amarelo é dos Coyotes) |
| D7 | Texto dentro do SVG | sim · não | **Não**: nome por `Text`, fora do SVG |
| D8 | Brilho com Skia | camadas (feito) · Skia nos heróis | **Camadas** como padrão; Skia só se a E2 confirmar no Expo Go 57 |

## 16. Pedidos para outras equipes

- **E2:** confirmar se `@shopify/react-native-skia` vem no Expo Go SDK 57 (blur real nos heróis). Sem Skia, seguimos com camadas.
- **E3:**
  - a regra final de território para os cartões "Pinte" e "Defenda";
  - a vida e as fases do chefão (100/66/33) e o dano por distância;
  - os critérios das 12 medalhas (com a E7).
- **E5:** as animações da §11 sobre os grupos com id. É de vocês o componente de número de dano, as partículas e a inundação de cor da confirmação.
- **E6:**
  - onde cada peça entra (§12);
  - o token `neon.villain` e o lema dos Owls em `tokens.ts`;
  - a nova tela "Escolha seu time";
  - a rota `src/app/dev/arte.tsx` (galeria só em `__DEV__`/web) fica na pasta de vocês: autorizar a E4 a criá-la ou criar a casca.
- **E7:**
  - os textos e critérios das medalhas;
  - o quiz "Não sei escolher" (§3.5);
  - a voz do líder nas celebrações;
  - não agendar a Fuligem em meses de queimada (§4).
- **E8:** o card do Instagram com o mascote em vitória + emblema; o mascote no recap semanal.
- **E9:** ids estáveis dos chefões (`soneca`, `rei-buzina`, `fuligem`, `mormaco`, `paredao`) na tabela da Raid. As raridades dos baús já batem (`comum`, `raro`, `lendario`).
- **E10:**
  - capturas da galeria e legibilidade em 32, 40 e 56 px;
  - FPS com 4 mascotes animados na tela de escolha num Android médio;
  - teste de 5 pessoas sobre a "vontade" de escolher cada time.

## 17. Tarefas propostas para F3/F4

| ID | Título | Dona | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E4.1 | Primitivas neon + paleta + níveis de qualidade | E4 | `src/components/art/neon/**` | D1 (token da E6) | `NeonPath`/`GlowFill` com `quality` full/lite/flat; teste de render; nenhum hex fora dos tokens |
| T7.E4.2 | Mascotes ×4 × 4 poses + parado animado | E4 (loop simples) / E5 (vitória) | `art/team/**` | T7.E4.1 | renderiza as 16 combinações; respira e pisca com Reanimated; `useReducedMotion` → estático; 60 fps com 4 na tela (E10 mede) |
| T7.E4.3 | Emblemas (completo/compacto) + bustos dos 4 líderes | E4 | `art/team/**` | T7.E4.1, D2 | emblema legível em 32 px (compacto); líderes no mesmo traço; revisão em PNG |
| T7.E4.4 | Chefões ×5 × 4 estados + dano 0/1/2 | E4 | `art/boss/**` | T7.E4.1, E3 (fases), E9 (ids) | 20 artes + camadas de dano; `accessibilityLabel` com nome e estado; teste por estado |
| T7.E4.5 | Baús ×3 × 3 estados | E4 | `art/chest/**` | T7.E4.1 | grupo `tampa` com pivô exposto para a E5; raridade legível sem cor (forma) |
| T7.E4.6 | Medalhas ×12 + 3 níveis + bloqueada | E4 | `art/medal/**` | E3/E7 (lista final) | 12 ícones no mesmo traço; níveis por estrelas; estado bloqueado tracejado |
| T7.E4.7 | Ícones dos modos ×8 (+ Missões/Desafios) | E4 | `art/mode-icons/**` | T7.E4.1 | substituem os ícones da Arena (integração da E6); legíveis em 28 px |
| T7.E4.8 | Estados vazios ×8 + cartões do tutorial ×3 | E4 | `art/empty/**`, `art/tutorial/**` | E3 (regra), E6 (textos) | 8 + 3 artes; vazio usa o mascote do time quando indicado |
| T7.E4.9 | Fundos das abas ×4 | E4 | `art/backgrounds/**` | E6 (aprovação) | estáticos, `aria-hidden`, opacidade ≤ 6%; contraste do texto não cai (E10) |
| T7.E4.10 | Galeria `/dev/arte` + testes + PNG por família | E4 (+ E6 na rota) | `src/app/dev/arte.tsx`, `art/**/__tests__` | T7.E4.2–9 | só em `__DEV__`/web; 1 teste por família; PNG em `docs/melhoria/relatorios/` |
| T7.E4.11 | (F4, opcional) Mascote de corpo inteiro em corrida para a tela de escolha | E4 + E5 | `art/team/**` | D4 | 4 personagens em pose de passada, revisados em PNG; se não ficar no nível, não entra |

## 18. Riscos e bloqueios

| Risco | Efeito | Mitigação |
|---|---|---|
| Muitas camadas no Android | queda de FPS na tela de escolha e no resumo | níveis `lite`/`flat`, `memo`, animar `Animated.View` por fora; medir cedo (E10) |
| Diferenças entre `react-native-svg` web e nativo (gradiente `url()`, `strokeLinejoin`, `useAnimatedProps` na web) | arte diferente entre web e Expo Go | galeria nas duas plataformas; fallback de animação por `Animated.View` |
| Coerência ao crescer o elenco (líderes, chefões restantes) | peças "desencontradas" | sempre usar as primitivas e o gerador; revisar a folha inteira a cada lote |
| Chefões de calor e fumaça | incentivo indireto a correr em condição ruim | falas e agenda já tratadas (§4); a E7 revisa os textos |
| Semelhança com marcas | problema de originalidade | tudo foi desenhado do zero com formas geométricas e nomes próprios; nada de Pokémon, Strava ou Nike |
| Prazo da F3 | 5 famílias + líderes é muito trabalho | começar por mascotes, emblemas e Raid (o que o dono pediu); medalhas e vazios em seguida; corpo inteiro só se sobrar tempo |
| Bloqueio | — | **Nenhum** na F1. Na F3 dependo de D1 (token) e da rota `/dev/arte` (pasta da E6) |

## 19. Arquivos entregues

- `docs/melhoria/F1/04-direcao-de-arte.md` (este relatório).
- `docs/melhoria/F1/arte/folha.png`: folha de contato com as 57 peças.
- `docs/melhoria/F1/arte/aplicacao.png`: 3 telas de celular com a arte aplicada (escolha de time, Arena, boas-vindas ao time) e o teste de tamanhos pequenos.
- `docs/melhoria/F1/arte/*.svg` (57 arquivos):
  - `mascote-{striders,volt,owls,coyotes}-{parado,vitoria,derrota}.svg` (12);
  - `emblema-{time}.svg` e `emblema-{time}-compacto.svg` (8);
  - `chefao-mormaco-{parado,golpe,furioso,derrotado}.svg` e `chefao-paredao-{…}.svg` (8);
  - `chefao-{soneca,rei-buzina,fuligem}-parado.svg` (3);
  - `bau-{comum,raro,lendario}-fechado.svg`, `bau-raro-{abrindo,aberto}.svg`, `bau-lendario-aberto.svg` (6);
  - `medalha-{explorador,conquistador,sequencia,chefao,bloqueada}.svg` (5);
  - `vazio-{sem-corridas,sem-crew,sem-conexao,sem-notificacoes}.svg` (4);
  - `modo-{dominio,atlas,fuga,caca,raid,liga,cidades,crews}.svg` (8);
  - `tutorial-{corra,pinte,defenda}.svg` (3).
- `docs/melhoria/F1/arte/fonte/`: `neon.cjs` (traço e brilho), `times.cjs`, `chefoes.cjs`, `itens.cjs` e `gerar.cjs`.
  - Para regenerar: `node docs/melhoria/F1/arte/fonte/gerar.cjs <pasta-das-folhas-html>`.
  - Para o PNG: abrir `folha.html` no Playwright, com fundo `#070708`.
