# Referências, skills e como a apresentação foi feita

## 1. Referências visuais

| Referência | O que veio dela |
|---|---|
| **Site do Lando Norris** (agência Off+Brand; DesignRush Best Website Design, abr/2026) | Base escura com um único neon, brilho que reage ao cursor, tipografia enorme, sensação tecnológica (WebGL, rolagem cinematográfica). Trocamos o verde-limão (#CBF902) pelo laranja |
| **McLaren** (cor papaya + antracite) | Laranja sobre cinza-quase-preto |
| **Telemetria e torre de classificação da F1** | Placar Cidade × Cidade (P1, P2…), números em fonte mono, selo "AO VIVO" |
| **Strava** | Rota laranja forte sobre mapa dessaturado, números grandes, um acento só |
| **Google Maps / Waze em modo noturno** | O mapa precisa parecer mapa: ruas, quarteirões, nomes de avenidas |
| **INTVL, KYRO, Zenly** | Território em polígonos livres e translúcidos, sem grade (pesquisa 06) |

Fontes:
- [DesignRush: Lando Norris website design](https://designrush.com/best-designs/websites/lando-norris-website-design)
- [Máquina do Esporte](https://maquinadoesporte.com.br/?p=213383)
- [TechRound: Norris ventures](https://techround.co.uk/tech/5-tech-and-racing-ventures-pushing-the-norris-name-beyond-f1/)
- `docs/pesquisa/06-visual-strava-e-territorio.md`

## 2. Referências de apresentação

Os detalhes e as fontes estão em `docs/pesquisa/05-apresentacao.md`.

| Referência | O que veio dela |
|---|---|
| Airbnb 2009 | Capa diz o produto numa frase; uma tela por slide |
| Modelo Sequoia | Problema → solução → por que agora → produto → time |
| Y Combinator | Diga o que faz na primeira frase; demo na ordem do problema; cópia local da demo |
| Guy Kawasaki 10/20/30 | Poucos slides e fonte grande |
| iPhone 2007 | Regra de três (Correr · Explorar · Conquistar) e demo ao vivo |
| Expectativa de banca | Objetivos, metodologia, requisitos, arquitetura, testes, resultados e limitações |

## 3. Skills usadas

As skills foram encontradas seguindo o método do **find-skills**:
1. ranking do skills.sh;
2. busca por palavra-chave;
3. checagem de installs, dono e licença.

O site skills.sh e o comando `npx skills find` estavam bloqueados no ambiente de trabalho, por isso a busca foi feita pela web e os `SKILL.md` foram baixados direto do GitHub. Todas estão em `.agents/skills/`, com origem em `.agents/skills/SOURCES.md`.

| Skill | Repositório | Para que foi usada |
|---|---|---|
| find-skills | `vercel-labs/skills` | Método de busca e escolha das skills |
| frontend-design | `anthropics/skills` | Direção visual e anti-"cara de template" |
| web-design-guidelines | `vercel-labs/agent-skills` | Contraste, acessibilidade, hierarquia |
| synthwave | `sickn33/agentic-awesome-skills` | Glow neon como luz (sombras na cor), fundo quase preto |
| emil-design-eng | `emilkowalski/skills` | Easing de saída, durações de hover, reduced-motion |
| motion-design | `lottiefiles/motion-design-skill` | Pulso do corredor (2,2s), camadas de movimento, defasagem |
| svg-animation | `iart-ai/web-animation-skills` | Rota se desenhando (`pathLength=1`), corredor seguindo o caminho (`animateMotion`) |
| app-store-screenshots | `parthjadhav/app-store-screenshots` | Mockups de celular: densidade dentro, vazio fora, glow |
| mapbox-cartography | `mapbox/mapbox-agent-skills` | Mapa escuro com cinzas neutros e cor reservada aos dados |
| mapbox-style-patterns | `mapbox/mapbox-agent-skills` | Hierarquia de ruas e rótulos |
| creating-presentations | `aaronvanston/agent-skills` | Título = conclusão; menos de 5 s para ler; notas em tópicos |
| vc-pitch-deck | `pedronauck/skills` | Uma ideia por slide; slide 1 diz o que o app faz; demo com plano B |
| pitch-deck | `sorawit-w/agent-skills` | Arco de slides; notas do apresentador |
| pitch-deck-builder | `leadmagic/gtm-skills` | As 3 coisas que a plateia deve lembrar |
| slides | `neethanwu/slides` | Tamanho pela duração (~10 slides para ~10 min) |
| frontend-slides | `zarazhangrui/frontend-slides` | Palco fixo 16:9 escalado (a página web) |
| storytelling / brand-storytelling | `clawic/skills`, `pedronauck/skills` | Arco problema → solução → prova → fechamento |
| copywriting | `coreyhaines31/marketingskills` | Frases claras, sem vícios de texto gerado |
| enhance-prompt | `google-labs-code/stitch-skills` | Estrutura do prompt copia-e-cola (`docs/07-PROMPT-COPIA-E-COLA.md`) |

A skill **pptx** (`anthropics/skills`) foi consultada, mas não está no repositório por causa da licença proprietária.

Para instalar uma skill num projeto (onde o skills.sh não for bloqueado):

```bash
npx skills add <dono>/<repo>      # ex.: npx skills add emilkowalski/skills
```

## 4. Como cada parte foi feita

### Mapa real
1. **Dados:** `mockup/build/fetch.py` lê do bucket público do **Overture Maps** (release 2026-09-23.1, dados do OpenStreetMap) as ruas, prédios, parques e água num retângulo em volta do Parque Flamboyant. Usa `pyarrow` e filtra pelo `bbox`.
2. **Território:** `mockup/build/export-game.ts` roda o código do próprio app (`apps/mobile/src`) e exporta as regiões dos times, a zona disputada e os baús.
3. **Mapa escuro e rota:** `mockup/build/mapa.py`:
   - projeta tudo em metros;
   - monta o grafo das ruas (`networkx`);
   - traça uma **volta de 2,02 km pelas ruas reais** em volta do parque;
   - grava `mapa.json`.
4. **Mockup:** `mockup/build/gen.py` junta o mapa, as telas de celular, o CSS (`mockup.css`) e o JS (`mockup.js`) e gera `NOMADE RUN Mockup.html`.
5. **Imagens dos slides:** `mockup/build/shots2.js` (Playwright) fotografa o mockup em modo estático e gera a capa e os celulares em PNG transparente.

### Slides
- Cada slide é um HTML (`slides/slides/<id>.html`), na ordem de `slides/deck.json`.
- **PDF:** `pdf/montar_pdf.py` junta os slides num HTML de impressão e `pdf/gerar_pdf.js` imprime em PDF com o Chromium.
- **Página web:** `web/montar_web.py` junta os 10 slides e mais 2 do mockup, com navegação (setas, clique, toque, `F` tela cheia, `N` notas).
- **Fonte em contorno:** `pdf/corrigir_fonte.py` remove os contornos sobrepostos da Unbounded 800 e gera a `UnboundedLine-800.woff2`.

### Atribuição
Mapa: © OpenStreetMap contributors, via Overture Maps Foundation (ODbL). O crédito fica no último slide e no rodapé do mockup.
