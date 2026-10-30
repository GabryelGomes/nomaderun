# 08 — Social e compartilhamento (E8) · F1

> Equipe E8 · Fase F1 (descoberta e desenho) · 2026-10-23 · branch `claude/affectionate-gauss-e8gm77`
> Nada de código de produção foi alterado. Protótipos, provas e imagens estão em `docs/melhoria/F1/social/`.

## 0. Resumo

- **O card é o produto.** Fizemos 5 modelos (corrida, conquista de zona, nível novo, chefão derrotado, recap semanal), mais "Meu ano no NOMADE" (futuro) e um **adesivo transparente** (o "Stats Sticker" do Strava). Cada modelo existe em Stories (1080×1920) e feed (1080×1350), e os principais também têm versão **sem rota**. Os PNGs foram gerados a partir da rota real do mockup, revisados e refeitos em 3 rodadas.
- **Técnica:** o card é **SVG puro** (react-native-svg 15.15.4, que já está no app). A exportação usa `Svg.toDataURL` → `File` (expo-file-system 57) → `Sharing.shareAsync`. Não precisa de biblioteca nova. O **plano B** é o `react-native-view-shot`: ele vem no Expo Go SDK 57 (4.0.3), mas tem o risco de versão apontado pela E2. A **web** tem caminho próprio: provamos que, sem embutir a fonte, o card sai com Times New Roman.
- **Privacidade:** o card e o feed passam por um corte único, `clipForSharing`, que esconde as zonas de privacidade com **folga sorteada**, o começo e o fim da corrida (150–250 m) e as pontas soltas. Assim, a borda do corte não desenha um círculo que entregue a casa (ataque publicado na USENIX Security 2018). O teste de propriedade rodou 3.000 casos: **0 pontos dentro de zona**.
- **Instagram:** o caminho garantido é o **menu do sistema com a imagem**. Postar direto nos Stories exige o Facebook App ID e código nativo, que o Expo Go não tem. Não prometemos esse caminho.
- **Feed da crew** só com reações prontas ("Bora!", Fogo, Raio), sem comentário livre. Também desenhamos: **convite por link com fallback web** (o `nomaderun://` não abre no Expo Go) e **exportar GPX** já com o corte de privacidade.

## 1. Paridade com o Strava

### 1.1 Tabela

Legenda: ✔ tem · ◐ parcial · ✘ não tem. Prioridade: **P0** entra na v2; **P1** entra se couber na F4 ou logo depois; **P2** fica para depois; **Não** = não copiar.

| Recurso | Strava | NOMADE hoje | Vale copiar? | Como adaptar ao jogo de território |
|---|---|---|---|---|
| **Compartilhar nos Stories** (Stats Sticker transparente com rota, 2025) | ✔ grátis | ◐ só texto (RF-017) | **P0** | 5 cards + **adesivo transparente** para colar sobre a própria foto. A rota neon pinta as zonas dos times. Sem logo do Strava nem do Instagram |
| **Feed com mapa de cada corrida** | ✔ grátis | ✘ (RF-014) | **P0** | Feed **da crew** com mini-mapa já cortado pela privacidade, números e conquistas (zona, chefão) |
| **Kudos** | ✔ | ✘ | **P0** | "Bora!" + 2 reações prontas (Fogo, Raio), com animação da E5 (momento 35) |
| **Comentários** | ✔ | ✘ | **Não** | Exigem moderação pesada. As reações prontas cobrem a reciprocidade |
| **Controles de privacidade do mapa** (zona por endereço, esconder início/fim, esconder o mapa todo) | ✔ | ◐ zonas existem (RN-010), mas card e feed ainda não usam | **P0** | `clipForSharing`: zona + folga sorteada + pontas escondidas por padrão + versão sem rota |
| **Clubes** (posts, eventos, ranking) | ✔ | ◐ Crews (até 30, código) | **P1** | Convite por link, selo da crew no card, encontro da crew (E7/E9) |
| **Desafios mensais com medalha / estante de troféus** | ✔ | ◐ RF-016 | **P1** | Missões e medalhas são da E7. A E8 faz o card de medalha (mesmo molde do "nível novo") |
| **Segmentos e KOM/QOM (hoje "CR")** | ✔ (placar completo pago) | ◐ a zona é o nosso "segmento" e o dono é o time | **P2** | "Recorde da zona" (travessia mais rápida) só se a E3 aprovar: premiar velocidade foge do esforço relativo |
| **Local Legend** (quem mais passou no segmento em 90 dias, sem olhar o ritmo) | ✔ | ✘ | **P1** | **"Guardião da zona":** quem mais correu na zona em 30 dias. Premia constância, não velocidade, como a nossa regra de esforço. Liga com o prefeito (RN-012 ⬜) → pedido para a E3 |
| **Recordes pessoais e best efforts** | ✔ (parte paga) | ✘ (RF-006 🟡) | **P1** | Selo "Recorde pessoal" no card (dados `personal_records` da E9) |
| **Parciais por km** | ✔ | ✘ | **P1** | No resumo (E6) e como herói da versão **sem rota** (ritmo não revela lugar) |
| **Gráfico de ritmo** | ✔ (análise paga) | ✘ | **P2** | Mini-gráfico no card da corrida longa (≥ 5 km) |
| **Year in Sport** (pago desde dez/2025, com revolta dos usuários) | ✔ pago | ✘ | **P1** | **"Meu ano no NOMADE" grátis** (diferencial). O recap **semanal** entra já (P0, com a E7) |
| **Beacon** (posição ao vivo para 3 contatos, grátis no celular) | ✔ | ◐ Corrida Segura: 5 contatos, SOS, alerta de parada; falta a escolta ao vivo (RF-024) | P1 (fora da E8) | Registrado para a Corrida Segura. **Nunca** misturar com o feed |
| **Heatmap global / pessoal** (pessoal é pago) | ✔ | ◐ Neblina pessoal ✔; mapa de calor ⬜ (RF-013) | **P2 / Não (global)** | Pessoal: "ruas que corri" no card do ano. Global: **não**, pela lição de 2018 (bases militares) |
| **Flyby** (rever quem cruzou seu caminho) | ✔ (Labs, opt-out) | ✘ | **Não** | Há relato de ciclista seguida até em casa com Flyby. Conflita com a promessa de privacidade |
| **Fotos na atividade** (no Brasil, 5,2× mais kudos com foto) | ✔ | ✘ | **P2** | Exige moderação de imagem. O **adesivo** resolve: a foto vai para o Instagram, não para o nosso servidor |
| **Exportar GPX** | ✔ | ✘ | **P1** | Botão na corrida, com o corte de privacidade ligado por padrão (§8) |
| **Atividade em grupo** | ✔ | ◐ bônus de grupo ×1,25 no domain | **P2** | "Corremos juntos" no item do feed quando o bônus de grupo valer |

**Resumo P0:** cards + adesivo, feed da crew com mini-mapa cortado, "Bora!" e reações, privacidade padrão (pontas escondidas + versão sem rota).
**Resumo P1:** convite por link, "Guardião da zona", recordes e parciais no card, card de medalha, "Meu ano no NOMADE", GPX.

### 1.2 Comunidades e Instagram: o que muda no nosso desenho

- **O Brasil é o mercado mais "clube" do Strava:**
  - segundo mercado do app, com ~21 mi de usuários;
  - clubes de corrida cresceram 8,6× em 2025 no país (outra leitura do mesmo relatório fala em quase 800% de clubes novos);
  - 56% veem o clube como lugar para conhecer gente.

  → O card precisa servir **à crew**: selo da crew (P1) e, no futuro, um "recap da crew" para o Instagram da assessoria ou do grupo.
- **Postar o treino nos Stories virou ritual.** O Strava transformou isso em produto com o Stats Sticker (2025): um adesivo transparente com rota e números, colado sobre a foto.

  → Nós temos o adesivo **e** o card pronto. O card é para quem não tem foto; o adesivo, para quem tem.
- **Privacidade virou pauta.** O caso do heatmap de 2018 e o estudo da USENIX mostraram que esconder só um círculo em volta de casa não basta.

  → A nossa promessa pública pode ser: **"seu card nunca mostra onde você mora"**. Ela é verificável por teste.

## 2. Os cards

### 2.1 Regras de desenho (valem para todo modelo)

- **Hierarquia fixa:** rota (ou arte do momento) → **número herói** → conquistas → time. Logo pequeno no topo.
- **Pit Lane Neon:**
  - fundo `#070708`;
  - um neon só (laranja `#FF6A13`), com núcleo claro na rota;
  - cor do time só no que é do time: pílula, zonas, selo;
  - a forma do time sempre acompanha a cor (daltônicos).
- **Fontes do app:** Inter Tight 800/600 nos números e Inter 700/500 nos rótulos, as mesmas carregadas no `_layout.tsx`. Não usamos fonte nova.
- **Só o que o react-native-svg desenha:** path, circle, rect, line, polygon, text/tspan, g, gradientes linear e radial, clipPath e mask.
  - **Sem `filter`:** o brilho da rota vem de 4 traços empilhados da mesma cor mais um núcleo claro.
  - O brilho do número herói é uma "poça de luz" (elipse com degradê radial).
  - **Testado e descartado:** contorno empilhado no texto. Fica com cara de "letra com borda marrom" (rodada 1).
- **Mapa sem tiles:** só zonas dos times (regiões suavizadas, **nunca hexágonos**), uma grade de pontos quase invisível e a rota. Não depende de licença de mapa nem de rede, e o enquadramento usa **só a parte visível** da rota.
- **Área segura dos Stories:** o essencial fica entre y = 250 e y = 1670. O topo e o rodapé ficam livres para a interface do Instagram. O rodapé só traz o slogan e, quando for o caso, o selo.
- **Dados de demonstração** levam sempre o selo "DADOS DE DEMONSTRAÇÃO", inclusive no adesivo.
- **Texto:** data sem hora ("QUINTA · 23 OUT · GOIÂNIA"). A hora entrega rotina. A cidade e o @ podem ser desligados.

### 2.2 Os modelos

| # | Modelo | Quando aparece | Herói | Dados | Versão sem rota |
|---|---|---|---|---|---|
| 1 | **Corrida** | sempre (corrida oficial `valid`/`partial`) | rota + **km** | km, tempo, ritmo, pontos, zonas conquistadas/reforçadas, time, data | pista oval genérica + selo do time + "ROTA PROTEGIDA" |
| 2 | **Conquista de zona** | ≥ 1 zona `conquered` | **nome da zona** + "de → para" (time anterior → meu time) + **+pontos** | `SummaryZone.name/ownerBefore/ownerAfter/rp`, km/tempo/ritmo | emblema do time com raios (sem mapa) |
| 3 | **Nível novo** | o XP da corrida passou de nível (E7) | anel de nível + **número** + barra do próximo nível já andando (progresso dotado) | nível, XP que falta, km/zonas/corridas totais | não tem rota (não precisa) |
| 4 | **Chefão derrotado** | a corrida contribuiu e o chefão caiu (E9 raid) | emblema partido + carimbo **DERROTADO** + **meu dano** | nome, km da cidade, dias, meu dano, crew e posição | não tem rota |
| 5 | **Recap semanal** | segunda-feira (job da E7) ou em Atividades | **km da semana** + barras por dia + 3 mini-rotas | km, corridas, tempo, zonas, sequência semanal | só barras e números |
| 6 | **Meu ano no NOMADE** (futuro) | dezembro | "ruas que corri" em neon + **km do ano** | km, corridas, zonas, melhor ritmo | só números |
| 7 | **Adesivo** (PNG transparente) | variação do 1 | rota + km + linha de números | igual ao 1 | sem rota: só números |

**Escolha automática (função pura `pickCardModels`):**
- ordem do carrossel: momento mais raro primeiro (chefão > nível > conquista > corrida);
- o modelo "Corrida" aparece sempre;
- corrida `rejected` não tem card;
- corrida provisória só tem o modelo 1, sem pontos e com "Provisório";
- **mais de 60% da rota escondida** → abre na versão sem rota, com o aviso "Escondemos a maior parte da rota para proteger sua casa".

### 2.3 Imagens (protótipos reais)

| Arquivo | O que mostra |
|---|---|
| `social/visao-geral-stories.png`, `visao-geral-feed.png`, `visao-geral-sem-rota.png` | todos os modelos lado a lado |
| `social/card-01-corrida-{stories,feed}.png` | modelo 1 |
| `social/card-02-conquista-zona-{stories,feed}.png` | modelo 2 |
| `social/card-03-nivel-novo-{stories,feed}.png` | modelo 3 |
| `social/card-04-chefao-derrotado-{stories,feed}.png` | modelo 4 (o emblema é provisório; a ilustração é da E4) |
| `social/card-05-recap-semanal-{stories,feed}.png` | modelo 5 |
| `social/card-06-seu-ano-futuro-{stories,feed}.png` | modelo 6 |
| `social/card-0{1,2,5}-*-stories-sem-rota.png` | versões com privacidade total |
| `social/adesivo-transparente-corrida.png`, `adesivo-sobre-foto-exemplo.png` | adesivo PNG com alfa e o teste de leitura sobre uma "foto" clara |
| `social/privacidade-antes-depois.png` | o que só a pessoa vê × o que card e feed mostram |
| `social/prova-tecnica/web-comparacao-fontes.png` | o card rasterizado na web sem a fonte embutida (em cima) e com ela (embaixo) |

**Como regenerar** (da raiz): `NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/F1/social/prototipo/gerar-cards.cjs <pasta-temp>`.

**Dados usados:**
- a volta real de 2,02 km do mockup (`docs/apresentacao/mockup/build/mapa.json`, Parque Flamboyant, dados © OpenStreetMap via Overture, ODbL);
- os números do modo demonstração (`DEMO_RAID`, `DEMO_CREW`).

### 2.4 Autocrítica (3 rodadas)

1. **Rodada 1 (amadora):**
   - o "brilho" do texto feito com contorno virou borda marrom;
   - a vírgula do herói batia nos números;
   - o chefão com "olhos de X" parecia emoji;
   - o mapa tinha uma faixa dura no topo;
   - com a casa no início da volta, a rota virou dois cacos.
2. **Rodada 2:**
   - poça de luz no lugar do contorno;
   - mapa sangrando até o topo, com máscara de fade;
   - rota encaixada numa "caixa de enquadramento" abaixo do cabeçalho;
   - emblema abstrato partido;
   - barras finas no recap.

   Os cards de exemplo passaram a usar uma corrida que **não começa em casa**, com só as pontas escondidas. O caso "casa no caminho" ficou na imagem de privacidade, que é onde ele ensina.
3. **Rodada 3:**
   - a rota parou de colidir com o logo;
   - a rachadura do chefão ficou incandescente;
   - "Meu ano" trocou cópias deslocadas da mesma rota (pareciam rabiscos) por trechos de ruas reais com intensidade variável;
   - a versão sem rota do recap ganhou barras maiores;
   - o adesivo ganhou sombra leve para foto clara e o selo de demonstração.

**O que ainda falta para "dar vontade de postar":**
- **arte da E4:**
  - mascote do time no lugar do selo (nível novo);
  - ilustração do chefão;
  - logo oficial (o ícone do app ainda é o padrão do Expo);
- **animação de abertura** da prévia (rota desenhando em 2,8 s, números subindo) → E5;
- a imagem continua estática.

## 3. Privacidade no card, no feed e no GPX

### 3.1 O problema

O dono lê todos os pontos da própria corrida (policy `activity_points_read`). Então **qualquer código no app que desenhe a rota para fora do aparelho tem que cortar antes**. Hoje nada corta, porque o card é só texto.

Além disso, esconder só um círculo em volta de casa não basta. Hassan, Hussain e Bates (USENIX Security 2018) recuperaram o endereço escondido de **95,1%** dos usuários moderadamente ativos: a rota sai sempre na **borda de um círculo**, e com algumas corridas a geometria dá o centro.

### 3.2 Regra proposta (`clipForSharing`)

Implementação de referência: `social/prototipo/privacidade.cjs`. Na F3, vira `src/domain/share-privacy.ts`.

1. Densificar a rota (1 ponto a cada 8 m), para nenhum segmento atravessar uma zona sem ser cortado.
2. Esconder os pontos a até **raio + folga** de cada zona. A folga é **sorteada por zona a cada geração (25–85 m)**, então a borda não é um círculo fixo.
3. Esconder o **começo e o fim** (150–250 m sorteados), mesmo fora de zona. Fica **ligado por padrão**, como o "esconder início/fim" do Strava, e protege quem sai do trabalho ou da casa de alguém.
4. Aparar mais **0–60 m** sorteados em cada ponta que encosta num trecho escondido.
5. Descartar pedaços com **menos de 150 m**.
6. Enquadrar o card **só pela parte visível**.
7. Se nada sobrar → `mode: 'noRoute'`, e o app usa a versão sem rota.

**Sorteio:** no app, com `crypto.getRandomValues` (`expo-crypto`, já usado no app). Cada geração sai um pouco diferente, e é isso que impede alguém de juntar vários cards e calcular o centro.

**Prova:**
- `privacidade-antes-depois.png`: com a casa no início da volta, 1.139 m de 2.016 m ficam escondidos;
- `prototipo/teste-propriedade.cjs`: 3.000 rotas e zonas aleatórias, **0 pontos dentro de zona** e folga mínima de 27,4 m até a borda.

**Teste de propriedade na F3 (fast-check):**
- nenhum ponto visível a ≤ raio de qualquer zona;
- nenhum ponto visível nos primeiros/últimos 150 m;
- nenhum pedaço com menos de 150 m;
- a saída é subconjunto da rota densificada.

### 3.3 Outras regras

- **Feed:** a rota do feed é cortada **no servidor**, com a mesma função do domain (Edge Function v2), porque quem vê não pode ler as zonas de quem correu. Ela é simplificada (≤ 80 pontos) e codificada com precisão de 4 casas (~11 m).
- **Sem hora** no card e no feed ("hoje", "ontem", "23 out").
- **Baús nunca aparecem** no card (pedido da E7: o baú diário é sorteado perto da última corrida e revelaria a área).
- **GPX:** corte de privacidade ligado por padrão. Desligar pede confirmação ("O arquivo vai ter o caminho completo, inclusive perto de casa").

## 4. Técnica de geração

### 4.1 Escolha: SVG puro → `toDataURL` → arquivo → menu do sistema

O código lido em `node_modules` confirma:

| Plataforma | O que o `Svg.toDataURL(cb, opts)` faz | Consequência |
|---|---|---|
| **Android** (`SvgView.java`) | bitmap do tamanho da view **em pixels**; `{width,height}` aumenta o bitmap, mas desenha na escala da view; PNG 100 | montar uma **cópia escondida** com `1080/PixelRatio.get()` × `1920/PixelRatio.get()` dp e passar `{width:1080,height:1920}` |
| **iOS** (`RNSVGSvgViewModule.mm`) | `UIGraphicsImageRenderer` na escala da tela; `{width,height}` em **pontos**; tenta de novo uma vez e devolve vazio se falhar | a mesma cópia escondida, **sem** opções; prazo de 6 s no nosso lado |
| **Web** (`elements.web.ts`) | clona o `<svg>`, carrega como `<img>` e desenha no canvas | o `<img>` de SVG é isolado e **perde as fontes da página** → caminho web próprio (§4.3) |

**APIs exatas** (SDK 57, conferidas em `node_modules` e com `tsc` sobre os tipos do app):

```ts
svgRef.current.toDataURL((base64) => ..., Platform.OS === 'android' ? { width: 1080, height: 1920 } : undefined);
const file = new File(Paths.cache, `nomade-${id}-${fmt}.png`);   // expo-file-system 57.0.7
if (file.exists) file.delete();
file.create();
file.write(base64, { encoding: 'base64' });                       // FileWriteOptions.encoding
await Sharing.isAvailableAsync();                                  // expo-sharing 57.0.23
await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar corrida' });
```

**Prova técnica** (`social/prova-tecnica/share-card-native.tsx`, fora do app):
- componente mínimo com prévia + cópia escondida, `svgToBase64` com prazo, `writePng`, `rasterizeWeb` e `shareOrDownloadWeb`;
- **passou no `tsc --strict`** contra os tipos do app (react-native-svg 15.15.4, expo-file-system 57.0.7, expo-sharing 57.0.23);
- **não foi rodado no aparelho** (não há Expo Go aqui) → o teste em aparelho é critério de aceite da T7.E8.4.

**Limites conhecidos:**
- **Tamanho:** ~0,7–1,3 MB por PNG nos protótipos; o base64 passa pela ponte (≈ 1,7 MB de string), aceitável. O Instagram pede no mínimo 720×1280 para fundo de Stories; o nosso tem 1080×1920.
- **Memória:** o bitmap de 1080×1920 ARGB tem ~8 MB. Gerar um por vez e nunca durante a corrida.
- **Textura:** fontes de terceiros não entram; só as 4 já carregadas. `<Image>` dentro do SVG (mascote em PNG) é assíncrono e pode sair em branco no `toDataURL` → **pedido para a E4: mascotes e emblemas em vetor (componentes SVG)**.
- **Mask:** usada no fade do mapa. Se falhar no aparelho, volta-se ao retângulo com degradê da rodada 1 (testado).
- **Texto:** não há medida de texto antes de desenhar. Para isso existe a tabela de avanços das fontes (`prototipo/font-metrics.json`, gerada do TTF), usada para pílulas e centralização. Vai para `features/social/card/font-metrics.ts`.

### 4.2 Plano B e plano C

- **Plano B — `react-native-view-shot` (`captureRef`):**
  - **vem no Expo Go SDK 57** (4.0.3, no `apps/expo-go/package.json` da branch `sdk-57`);
  - a E2 apontou que o `npx expo install` instala a 5.1.0 (risco R1). Se usado, fixar a **4.0.3** e testar nos dois sistemas;
  - captura a View inteira (fontes e Text do RN) e evita o detalhe de escala do `toDataURL`;
  - fica como reserva se fonte ou máscara falharem no SVG nativo.
- **Plano C — Skia (`makeImageSnapshot`/`drawAsImage`):**
  - vem no Expo Go 57 (2.6.2), faz brilho de verdade (blur) e tamanho exato fora da tela;
  - custa uma biblioteca grande e, na web, o CanvasKit (~3 MB) → só se a E5 já adotar Skia.

### 4.3 Web

- **O `Svg.toDataURL` da web perde as fontes.** A prova (`prova-tecnica/prova-web.cjs` + `web-comparacao-fontes.png`) mostra o card em Times sem a fonte embutida e certo com ela. Rasterizar 1080×1920 levou ~0,3 s no Chromium.
- **Caminho web:**
  1. serializar o `<svg>`;
  2. inserir `<style>@font-face{src:url(data:font/ttf;base64,…)}</style>` com as 4 fontes (carregadas uma vez do asset do expo-font);
  3. desenhar num canvas 1080×1920;
  4. gerar o PNG com `canvas.toBlob`;
  5. se `navigator.canShare({files})` aceitar (Chrome Android, Safari iOS), usar `navigator.share({files})`; senão, **baixar** (`<a download>`).
- **Não usar o `Sharing.shareAsync` na web.** Ele chama `navigator.share({url})`: compartilha uma URL, não a imagem, e só funciona em HTTPS.
- No Chromium de desktop (headless) não há `navigator.share` → o botão vira **"Baixar imagem"**.

### 4.4 Instagram: o que dá e o que não dá

- **Dá:**
  - menu do sistema com o PNG → Instagram (Stories, Feed, Direct) e WhatsApp (status, conversa);
  - no Android, o Instagram registra alvos separados no seletor;
  - no iOS, a extensão do Instagram aparece na folha → **verificar no aparelho** quais destinos aparecem (critério de aceite).
- **Não dá no Expo Go:**
  - "abrir direto nos Stories com fundo e adesivo" (`instagram-stories://share` + pasteboard no iOS, Intent `com.instagram.share.ADD_TO_STORY` no Android);
  - exige **Facebook App ID** (obrigatório desde jan/2023) e código nativo;
  - registrado como **futuro, com dev build**.
- **Legenda:** o `shareAsync` só leva o arquivo. A legenda ("Corri 2,02 km e conquistei o Jardim Goiás no NOMADE RUN") fica num botão secundário **"Copiar legenda"** (`expo-clipboard`: confirmado no `apps/expo-go/package.json` da branch `sdk-57`; instalação pela coordenação) ou, sem ele, no `Share.share({message})` atual.

## 5. Fluxo de compartilhar

### 5.1 Caminho

**Resumo → "Compartilhar" → tela de compartilhar (carrossel de modelos) → "Compartilhar" → menu do sistema → app de destino.**
São **3 toques** do resumo até o Instagram.

### 5.2 Tela de compartilhar

Rota sugerida `/compartilhar/[id]`, em modal de tela cheia; a E6 confirma.

| Elemento | Texto | testID | accessibilityLabel |
|---|---|---|---|
| Título | "Compartilhar" | — | — |
| Carrossel (prévia grande, 1 modelo por página, bolinhas) | — | `compartilhar-modelo-{n}` | "Modelo {nome}, {i} de {total}" |
| Alternância de formato | "Stories" · "Feed" · "Adesivo" | `compartilhar-formato-{stories\|feed\|adesivo}` | "Formato Stories" … |
| Chave | "Mostrar rota" | `compartilhar-rota` | "Mostrar rota no card" |
| Chave | "Mostrar meu @" | `compartilhar-usuario` | "Mostrar meu nome de usuário" |
| Chave | "Mostrar cidade" | `compartilhar-cidade` | "Mostrar a cidade" |
| Aviso de privacidade (1 linha, só quando cortou) | "Escondemos o começo, o fim e suas zonas de privacidade." | — | — |
| Botão primário | "Compartilhar" | `compartilhar-enviar` | "Compartilhar imagem" |
| Secundário | "Copiar legenda" | `compartilhar-legenda` | "Copiar legenda" |
| Secundário (web sem Web Share) | "Baixar imagem" | `compartilhar-baixar` | "Baixar imagem" |

### 5.3 Estados

| Estado | O que a pessoa vê |
|---|---|
| **Abrindo** | esqueleto com brilho no lugar da prévia (≤ 300 ms) |
| **Gerando** | o botão vira "Gerando imagem…" com indicador; a prévia pulsa de leve; meta < 1,5 s; o botão fica bloqueado contra toque duplo |
| **Menu aberto/fechado** | ao voltar, toast curto "Pronto. Bora!", `record_share` (E7: 60 XP uma vez e a moldura "Primeira Semana") e telemetria `share_done {model, format, withRoute}` |
| **Erro ao gerar** (vazio, prazo de 6 s, falta de memória) | "Não deu para gerar a imagem." + "Tentar de novo" + "Compartilhar só o texto" (o `Share.share` atual) |
| **Compartilhar indisponível** (`isAvailableAsync` falso) | o botão vira "Baixar imagem" (web) ou "Compartilhar só o texto" |
| **Sem permissão** | não há permissão a pedir: o `expo-sharing` usa arquivo do cache. "Salvar na galeria" fica no próprio menu do sistema. Um botão "Salvar" dedicado com o `expo-media-library` é P2 e depende de teste no Expo Go Android |
| **Sem internet** | funciona: o card é gerado no aparelho com os dados da corrida e as zonas guardadas |
| **Corrida provisória / rejeitada** | provisória: só o modelo 1, sem pontos, com "Provisório"; rejeitada: botão escondido |
| **Leitor de tela** | cada página do carrossel lê "Card de corrida: 2,02 quilômetros, 10 minutos e 29 segundos, ritmo 5:12 por quilômetro, 1 zona conquistada" |
| **Reduzir movimento** | sem a animação de desenho da rota; prévia estática |

**Limpeza:** apagar `Paths.cache/nomade-*.png` com mais de 1 dia ao abrir a tela.

## 6. Feed e aplausos

- **Quem vê o quê:**
  - **só a crew** (D4 da E9, opção a);
  - a pessoa controla em Perfil → Privacidade:
    - "Mostrar minhas corridas para a crew" (padrão ligado, avisado ao entrar na crew);
    - "Mostrar o mapa das minhas corridas" (padrão ligado, sempre cortado).
  - Corridas `rejected` e `review` não entram.
- **Onde fica:** aba "Atividades da crew" em `/clube/crew`, ou rota `/feed` (a E6 decide). Só Realtime nos aplausos; a lista carrega por página (20 itens, `FlatList` virtualizada).
- **Item do feed:**
  - avatar, nome, selo do time e "hoje"/"ontem"/data (sem hora);
  - **mini-mapa** 16:9 com a rota cortada, sem tiles, só o tom do time;
  - km · tempo · ritmo em números grandes;
  - fichas de conquista: "Conquistou Jardim Goiás", "−2,1 km no chefão", "Recorde pessoal";
  - barra de reações.
- **Reações** (`reaction` da E9):
  - `bora` = **"Bora!"** (principal, com o momento 35 da E5: ícone pula, 6 faíscas, contador +1, vibração `tap`);
  - `fogo` = "Fogo" (ritmo forte);
  - `raio` = "Raio" (conquista).
  - 1 reação por pessoa por item (trocar ou desfazer é permitido). Tocar no contador abre a lista de quem reagiu, só nomes da crew.
- **Antispam:**
  - sem aplaudir a si mesmo;
  - 200 reações por dia (E9);
  - toque com trava de 300 ms;
  - sem "aplaudir todos";
  - nada de ranking de quem dá mais "Bora!" (evita farm).
- **Notificação de aplauso:**
  - a central recebe sempre (Realtime);
  - o **push é agrupado, no máximo 1 por dia**, das 7h às 22h, e **conta no limite de 1 notificação de engajamento por dia** da E7 (§5.4 do prompt). Exemplo: "Sua corrida de hoje ganhou 5 Bora! da crew".
  - Isso é mais restrito que a proposta da E9 (1 por item por hora) → decisão D-E8-3.
- **Vazio:** ilustração da E4 + "Entre numa crew para ver as corridas dela" + "Entrar com código" / "Criar crew".
- **Erro / sem internet:** a última página fica guardada; faixa "Sem conexão. Mostrando o que já carregou".

## 7. Convites

- **Limite do Expo Go:** o app roda no Expo Go via EAS Update, e lá o esquema `nomaderun://` **não abre o app** (o Expo Go usa `exp://`). Por isso o convite é um **link HTTPS** com página web de reserva. O deep link entra quando houver dev build ou loja.
- **Link de crew:** `https://<domínio-da-prévia-web>/c/ABCD1234`. O código é o `crews.invite_code` que já existe. A página web (export web na Vercel, X4) mostra:
  - nome, sigla, time e nº de membros (sem nomes);
  - "Abrir no app" (link de abertura do Expo Go do projeto na demonstração; loja no futuro);
  - "Copiar código", para colar em Crew → "Entrar com código" (já existe: `joinCrew`).
- **Link do app (indicação):** `https://<domínio>/i/<código-pessoal>`. O código é gerado pelo servidor; não é o @.
- **Texto do convite** (com `Share.share`):
  - crew: "Bora correr com a {Crew} no NOMADE RUN? A gente pinta {cidade} de {cor do time}. Entra com o código {CÓDIGO}: {link}";
  - app: "Tô dominando {bairro} no NOMADE RUN. Escolhe seu time e vem: {link}".
- **Recompensa (cosmética, para os dois):**
  - moldura de card "Bando" + 50 XP (uma vez por par);
  - libera quando o convidado faz a **primeira corrida válida de ≥ 1 km**;
  - teto de 5 recompensas por mês para quem convida;
  - nada que dê vantagem no território (§5.4).
- **Onde fica:** Crew → "Convidar" (líder e membros); Perfil → "Convidar amigos".

## 8. GPX

- **Onde:** detalhe da corrida em Atividades → menu "⋯" → **"Exportar GPX"** (a E6 encaixa; a E8 entrega `useExportGpx`).
- **Formato:** GPX 1.1, `creator="NOMADE RUN"`, um `<trk>` com `<name>` "Corrida NOMADE — 23/10/2026" e um `<trkseg>` por pedaço visível. Cada `<trkpt lat lon>` leva `<ele>` (se houver) e `<time>` ISO 8601.
  - **Com o corte ligado (padrão):** os pontos dentro das zonas e as pontas somem, e o `<time>` também, para não deixar o ritmo apontar onde estava o trecho escondido.
  - **Com o corte desligado:** sai tudo, com confirmação.
- **Arquivo:** `File(Paths.cache, 'nomade-<id>.gpx')`, `write(xml)` e `shareAsync(uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx' })`.
- **Strava:** o envio de arquivo é pelo site do Strava. Texto de ajuda: "Para subir no Strava, use 'Enviar atividade' no site do Strava".
- **Função pura** `buildGpx(points, opts)`, com testes:
  - XML válido (bate com o XSD 1.1);
  - escape de nome;
  - coordenadas com 6 casas;
  - nenhum ponto em zona quando o corte está ligado.

## 9. Contrato para a E9

Ajustado ao `09-backend.md` (§4.5 e §4.8). **As diferenças estão marcadas com ⚠.**

1. **`share_card(activity_id)`:** do jeito proposto (só o dono; estatísticas, zonas conquistadas, dano no chefão, recordes, data e time).
   - ⚠ **A rota do card é cortada no app**, com `clipForSharing` do domain. O dono já lê os pontos e as zonas, e assim o card funciona sem internet.
   - Se a E9 mantiver a polyline no RPC (útil para web e app antigo), ela precisa usar **o mesmo algoritmo**, com **folga sorteada** em volta das zonas e pontas sorteadas. Os 200 m fixos que a E9 propôs deixam a borda num círculo exato.
   - Proposta: o cálculo vive no domain e roda na Edge Function, não em SQL.
2. **`feed_items`** como proposto, mais:
   - ⚠ `payload.route`: polyline codificada (precisão 4, ≤ 80 pontos, ≤ 600 bytes), **cortada na Edge Function com o mesmo domain**, ou `null` quando `feed_show_map = false` ou nada sobra;
   - `payload.routeHidden: boolean`;
   - `payload.highlights`: lista curta (`zone_conquered{name}`, `raid_damage{km}`, `pr{distance}`);
   - **sem horário** no payload (só a data local).
3. **`kudos`** como proposto (`bora | fogo | raio`, `KUDOS_SELF`, `KUDOS_LIMIT` 200/dia, Realtime).
   - ⚠ Notificação: central sempre; **push agrupado no máximo 1 por dia**, das 7h às 22h, contando no orçamento de engajamento da E7 (D-E8-3).
4. **`user_settings`:**
   - `share_runs_to_feed` (padrão `true`);
   - `feed_show_map` (padrão `true`);
   - `share_hide_ends` (padrão `true`, só o dono lê).
5. **Convites:**
   - `invite_preview(code)` para **anon**: nome, sigla, time e nº de membros, **sem nomes**; com limite de chamadas e código de 8 caracteres;
   - `referrals(inviter_id, invitee_id unique, crew_id null, status pending|rewarded, created_at)`;
   - RPC `claim_referral(code)` no cadastro;
   - a recompensa sai na gravação v2 quando o convidado tem a 1ª corrida válida ≥ 1 km; teto de 5 por mês; recompensa cosmética no catálogo da E7.
   - Pedido opcional: rotacionar o `invite_code` da crew (líder).
6. **`weekly_recap(week_start)`** como proposto + `days[7]` (km por dia) e `routes[3]` (polylines já cortadas, ≤ 40 pontos cada) para as mini-rotas.
7. **`record_share(kind, format, with_route)`** (E7): idempotente por dia, só XP baixo e cosmético.
8. **Testes que a E8 pede:**
   - pgTAP: item de fora da crew invisível; `payload.route` sem ponto a ≤ raio de zona; nenhum `time` no payload;
   - Deno: o corte da Edge Function é igual ao do domain (mesma semente → mesma saída).

## 10. Pedidos para outras equipes

- **E3 (domain):**
  - receber `src/domain/share-privacy.ts` (corte) e `src/domain/gpx.ts` (montagem), ou autorizar a E8 a criá-los, registrando-os na ponte das functions;
  - avaliar o "Guardião da zona" (Local Legend adaptado) junto com o prefeito.
- **E4:**
  - mascotes e emblemas **em SVG (componentes)**, não PNG;
  - ilustração do chefão (estados "derrotado" e "partido");
  - **logo oficial** NOMADE RUN (o ícone do app ainda é o padrão do Expo);
  - molduras cosméticas de card ("Primeira Semana", "Bando");
  - ilustração do feed vazio.
  - Também: o rosa das Night Owls diverge (`#FF2D55` em `neon.ts` × `#FF4FD8` no `DESIGN-SYSTEM.md` e no `mapa.json`). Unificar.
- **E5:**
  - momento 35 ("Bora!");
  - entrada da prévia do card: rota desenhando + números subindo, com versão "Reduzir movimento";
  - toast "Pronto. Bora!".
- **E6:**
  - lugar do `<ShareButton>` no resumo;
  - rota `/compartilhar/[id]`, onde fica o feed e "Exportar GPX" no detalhe da corrida;
  - textos da §5.
- **E7:**
  - `record_share`;
  - recap semanal (gatilho e notificação);
  - orçamento de push que inclua o aplauso agrupado;
  - catálogo de cosméticos (molduras).
- **E10:**
  - dados de demonstração do feed, do `share_card` e do `weekly_recap` (`src/services/api/demo/**`);
  - teste de aparelho do `toDataURL`/compartilhar (Android e iOS);
  - captura dos cards no export web.
- **E2:**
  - registrar o `expo-clipboard` (já confirmado no Expo Go `sdk-57`) e o comando de instalação;
  - se o plano B for acionado, fixar o view-shot em 4.0.3.

## 11. Decisões para o coordenador

| ID | Pergunta | Opções | Recomendação |
|---|---|---|---|
| **D-E8-1** | Onde o corte de privacidade é calculado? | (a) só no servidor (SQL do `share_card`, como a E9 propôs); (b) **domain puro, usado pelo app (card e GPX) e pela Edge Function (feed)**; (c) só no app | **(b).** Uma fonte de regra (CLAUDE.md), funciona sem internet e é testável por propriedade. Exige a folga sorteada que o SQL não tem |
| **D-E8-2** | Quem cria `share-privacy.ts` e `gpx.ts` em `src/domain` (pasta da E3)? | (a) a E3; (b) a E8, com autorização e registro na ponte | **(b).** A E8 escreve e a E3 revisa |
| **D-E8-3** | Push de aplauso | (a) 1 por item por hora (E9); (b) **1 por dia, agrupado, dentro do limite de engajamento** | **(b).** O §5.4 proíbe mais de 1 push de engajamento por dia |
| **D-E8-4** | Quem vê o feed | (a) só a crew; (b) crew + "seguir"; (c) o time | **(a)** na F4. "Seguir" só com lista de bloqueio e moderação (P2) |
| **D-E8-5** | Técnica de imagem | (a) **SVG `toDataURL`**; (b) view-shot; (c) Skia | **(a)**, com (b) fixado em 4.0.3 como reserva, ativável só se o teste no aparelho falhar |
| **D-E8-6** | Esconder começo e fim por padrão | ligado / desligado | **Ligado** (desligável por corrida quando o início não está em zona) |
| **D-E8-7** | Domínio do link de convite | prévia Vercel (X4) / domínio próprio | Prévia Vercel na F4; domínio próprio só se o TCC tiver um |
| **D-E8-8** | Instalar o `expo-clipboard` (vem no Expo Go) para "Copiar legenda" | sim / não (cair no `Share.share` de texto) | **Sim** (mexe em `package.json`: coordenação) |

## 12. Tarefas propostas para F3/F4

| ID | Título | Dona | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| **T7.E8.1** | Corte de privacidade para compartilhar | E8 (revisão da E3) | `src/domain/share-privacy.ts` + testes; ponte das functions (`_shared/domain.ts`, os dois `deno.json`) | D-E8-1, D-E8-2 | funções puras com lat/lng; teste de propriedade (fast-check, ≥ 1.000 casos): nenhum ponto a ≤ raio, pontas ≥ 150 m, pedaços ≥ 150 m; cobertura ≥ 95%; `domain_bridge.test.ts` verde |
| **T7.E8.2** | Modelo do card (puro) | E8 | `src/features/social/card/card-model.ts`, `font-metrics.ts`, `pick-models.ts` | T7.E8.1, `share_card` (E9) ou dados locais | `pickCardModels` cobre as regras da §2.2 (rejeitada sem card, provisória só o modelo 1, > 60% escondido → sem rota); `measureText` com erro < 3% contra a medida real do navegador nas strings do card |
| **T7.E8.3** | Componentes SVG dos cards | E8 (arte da E4) | `src/features/social/card/*.tsx` | T7.E8.2; E4 (logo, mascotes SVG) | 5 modelos × 2 formatos + sem rota + adesivo; só tokens Pit Lane Neon; teste de renderização com e sem rota (textos certos); selo "DADOS DE DEMONSTRAÇÃO" no modo demonstração |
| **T7.E8.4** | Exportar e compartilhar (`useShareCard`) | E8 | `src/features/social/share/*` | T7.E8.3 | Android e iOS no Expo Go: PNG de **1080×1920 e 1080×1350 exatos**, fontes certas, < 1,5 s; prazo e erro tratados; web com fonte embutida + Web Share ou download; cache limpo; evidência: PNGs gerados pelo app (web) e capturas do aparelho |
| **T7.E8.5** | Tela de compartilhar + `<ShareButton>` | E8 (encaixe da E6) | `src/app/compartilhar/[id].tsx` (ou onde a E6 definir), `src/features/social/share-screen.tsx` | T7.E8.4; E5 (entrada da prévia) | 3 toques do resumo ao menu do sistema; todos os estados da §5.3; `testID` + `accessibilityLabel` em tudo (o `testids.test.ts` passa); leitor de tela lê o card |
| **T7.E8.6** | Feed da crew e reações "Bora!" | E8 (backend da E9) | `src/features/social/feed/*`, `src/services/api/feed-repo.ts` (com o ok do coordenador), rota do feed | T7.E9.8; E5 (momento 35); D-E8-4 | só a crew; mini-mapa a partir de `payload.route` (sem tiles); reação otimista com reversão no erro; Realtime de `kudos`; vazio, erro e sem internet; app novo com servidor antigo esconde o feed sem quebrar |
| **T7.E8.7** | Convites por link | E8 (página web e RPC da E9) | `src/features/social/invite/*`, página web de reserva (rota web pública) | E9 (`invite_preview`, `referrals`), D-E8-7 | link abre a página com dados da crew e "copiar código"; entrar pelo código continua funcionando; recompensa só após 1ª corrida válida ≥ 1 km; teto de 5 por mês |
| **T7.E8.8** | Exportar GPX | E8 (encaixe da E6) | `src/domain/gpx.ts` (ou `features/social/gpx`), `src/features/social/gpx/use-export-gpx.ts` | T7.E8.1, D-E8-2 | GPX 1.1 válido contra o XSD; corte ligado por padrão (teste de propriedade); confirmação ao desligar; abre o menu do sistema com `application/gpx+xml` |
| **T7.E8.9** | Recap semanal e "Meu ano" (só o desenho do segundo) | E8 (dados de E7/E9) | `src/features/social/card/recap-*.tsx` | T7.E8.3; `weekly_recap` (E9); gatilho (E7) | o card abre a partir da notificação de segunda e de Atividades; mini-rotas cortadas; versão sem rota |
| **T7.E8.10** | Relatório de evidências | E8 | `docs/melhoria/relatorios/08-social-F4.md` | todas | PNG real de cada modelo gerado pelo export web no modo demonstração; tabela de paridade atualizada; testes com resultado |

## 13. Riscos de privacidade e bloqueios

| Risco | Tratamento |
|---|---|
| Código do card desenhar a rota bruta (o dono lê tudo pela RLS) | O componente de card **só aceita `SharedRoute`** (tipo de saída do `clipForSharing`), nunca `LatLng[]`. Revisão da E10 + teste que falha se um ponto em zona chegar ao SVG |
| Ataque do círculo (centro da zona deduzido de várias corridas) | folga sorteada por geração + pontas sorteadas + aparo nas bordas + pedaços curtos descartados |
| Rotina pela hora ou pelo ritmo do trecho escondido | sem hora no card e no feed; GPX cortado sem `<time>` |
| Código de crew vaza e estranhos entram e veem o feed | o feed já sai cortado; chave "mostrar minhas corridas"; rotação do código pelo líder (pedido à E9); limite de 30 membros |
| Baú e "zona sob ataque" revelando a área | baús fora do card; a zona aparece pelo nome, que já é público no mapa |
| Fonte ou máscara diferentes no SVG nativo | teste no aparelho (T7.E8.4); reservas: retângulo com degradê e view-shot 4.0.3 |
| View-shot com JS e nativo em versões diferentes (R1 da E2) | só como plano B, versão fixada e testada |
| "Direto nos Stories" prometido por engano | documentado: só o menu do sistema no Expo Go |
| `nomaderun://` não abre no Expo Go | convite por HTTPS + código digitado |
| Mascote ou imagem raster sumindo no `toDataURL` | pedido à E4: arte em SVG |
| Peso das imagens no repositório (≈ 15 MB em `social/`) | aceitável na F1; na F4 as evidências podem ir em JPEG ou só na pasta de relatórios |

**Bloqueios desta F1:**
- o `docs.expo.dev` e o `support.strava.com` não abriram pelo proxy. A documentação da Expo foi conferida no código instalado (`node_modules`, SDK 57) e no GitHub do Expo (branch `sdk-57`);
- sem aparelho e sem Expo Go aqui: o `toDataURL` nativo **não foi executado**, só verificado no código e no `tsc`.

## 14. Arquivos desta entrega

- `docs/melhoria/F1/08-social.md` (este relatório)
- `docs/melhoria/F1/social/*.png`: cards, versões sem rota, adesivo, visão geral e privacidade
- `docs/melhoria/F1/social/prototipo/`:
  - `gerar-cards.cjs` (gerador SVG → PNG);
  - `privacidade.cjs` (corte de referência);
  - `teste-propriedade.cjs`;
  - `font-metrics.json` + `metricas_fontes.py` (medida de texto sem DOM).
- `docs/melhoria/F1/social/prova-tecnica/`:
  - `share-card-native.tsx` (prova nativa, passa no `tsc`);
  - `prova-web.cjs` + `web-comparacao-fontes.png` (prova da fonte na web).

## 15. Fontes

**Strava:**
- Stats Sticker (2025): https://www.bikeradar.com/news/strava-sticker-stats-spring-2025-updates
- Guia de terceiros sobre o adesivo nos Stories: https://www.remove.bg/pt-br/b/strava-overlay-for-instagram-stories-and-posts
- Local Legends: https://support.strava.com/hc/en-us/articles/360043099552-Local-Legends · https://dcrainmaker.com/2020/06/strava-legends-feature.html
- Desafios e estante de troféus: https://support.strava.com/hc/en-us/articles/216919177-Strava-Challenges · https://support.strava.com/hc/en-us/articles/216918557-The-Strava-Trophy-Case
- Feed, kudos e comentários (coleção da central de ajuda): https://support.strava.com/en-us/collections/19668897-feed-kudos-and-comments · análise de UX: https://uxdesign.cc/why-over-100-million-athletes-are-hooked-on-strava-545708e17552
- Recursos da assinatura (best efforts, análise de ritmo): https://support.strava.com/hc/articles/216917657-Strava-Subscription-Features · https://the5krunner.com/2023/08/31/strava-welcome-expansion-to-best-efforts/
- Segmentos, KOM e CR (2026): https://www.runnerspicks.com/blog/strava-segments-strategy-how-to-hunt-koms/
- Year in Sport pago: https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425 · https://www.t3.com/tech/dear-strava-we-have-a-paywall-problem-thats-gone-a-step-too-far
- Beacon grátis: https://www.cyclingweekly.com/products/strava-makes-beacon-feature-free-to-all-users · https://www.coachweb.com/fitness-apps/9051/strava-s-beacon-safety-feature-is-now-free-to-use
- Heatmaps (global, pessoal, noturno, semanal): https://bikebiz.com/strava-expands-mapping-tools-with-night-and-weekly-heatmaps/
- Controles de privacidade do mapa: https://www.kaspersky.com/blog/running-apps-privacy-settings-part2-strava/52409 · https://androidauthority.com/how-to-hide-start-location-strava-3234283 · https://road.cc/content/tech-news/stravas-edit-map-visibility-gives-greater-privacy-control-285569
- Flyby e o relato de perseguição: https://zwiftinsider.com/stravas-flyby-team/ · https://totalwomenscycling.com/news/reader-story-followed-home-with-strava-flybys
- Heatmap e bases militares (2018): https://www.helpnetsecurity.com/2018/01/29/strava-user-heatmap-reveals-patterns-of-life-in-western-military-bases/ · https://www.bikeradar.com/news/stravas-heatmap-reveals-military-bases-and-more

**Privacidade (artigo):**
- Hassan, Hussain, Bates. *Analysis of Privacy Protections in Fitness Tracking Social Networks — or — You can run, but can you hide?* USENIX Security 2018: https://www.usenix.org/conference/usenixsecurity18/presentation/hassan · PDF: https://www.usenix.org/system/files/conference/usenixsecurity18/sec18-hassan_0.pdf

**Brasil e comunidades:**
- https://www.mktesportivo.com/2025/08/criacao-de-clubes-de-corrida-no-brasil-cresce-800-em-um-ano-no-strava/
- https://forbes.com.br/forbes-life/2025/12/corrida-e-a-atividade-fisica-mais-praticada-por-brasileiros-mostra-relatorio/
- https://www.meioemensagem.com.br/marketing/como-a-strava-esta-construindo-uma-comunidade-no-brasil
- `docs/pesquisa/01-mercado-e-concorrentes.md`

**Instagram (Sharing to Stories, Facebook App ID obrigatório):**
- https://developers.facebook.com/docs/instagram-platform/sharing-to-stories
- https://developers.facebook.com/blog/post/2022/10/10/introducing-important-update-to-Instagram-sharing-to-stories/

**Técnica:**
- Expo Go SDK 57 (módulos embutidos: view-shot 4.0.3, Skia 2.6.2, react-native-svg 15.15.4, expo-sharing, expo-media-library): https://raw.githubusercontent.com/expo/expo/sdk-57/apps/expo-go/package.json
- Código instalado e lido:
  - `apps/mobile/node_modules/react-native-svg/src/elements.web.ts`;
  - `.../android/src/main/java/com/horcrux/svg/SvgView.java` e `SvgViewModule.java`;
  - `.../apple/RNSVGSvgViewModule.mm` e `apple/Elements/RNSVGSvgView.mm`;
  - `apps/mobile/node_modules/expo-sharing/build/SharingNativeModule.web.js` e `Sharing.types.d.ts`;
  - `apps/mobile/node_modules/expo-file-system/build/File.types.d.ts`.
- Documentação oficial (referência; não abriu pelo proxy): https://docs.expo.dev/versions/v57.0.0/sdk/sharing/ · https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ · https://docs.expo.dev/versions/v57.0.0/sdk/captureRef/

**Formatos:**
- GPX 1.1: https://www.topografix.com/GPX/1/1/

**Mapa do protótipo:**
- © OpenStreetMap contributors, via Overture Maps Foundation (ODbL); ver `docs/apresentacao/mockup/README.md`.
