# Design system da apresentação — "Pit Lane Neon"

Preto e laranja neon, com cara de telemetria de Fórmula 1 à noite. A referência principal é o site do piloto Lando Norris (base escura, um neon só, cursor que reage, tipografia enorme), com o verde-limão trocado pelo laranja. Os mesmos valores estão em [`design-tokens.json`](design-tokens.json).

## 1. Cores

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#070708` | Fundo de todos os slides (preto asfalto) |
| `bg-deep` | `#050506` | Fundo da página e das sobras |
| `surface` | `#0F1013` | Cards |
| `surface-hot` | `#120D0A` | Card em destaque (aceso) |
| `line` | `#24252B` | Borda dos cards |
| `ink` | `#F3F1ED` | Texto principal (branco quente) |
| `ink-2` | `#A8A6A1` | Texto secundário |
| `ink-3` | `#8A8883` | Numeração do rodapé |
| `orange` | `#FF6A13` | **Acento único**: números grandes, rota, item ativo, glow |
| `orange-text` | `#FF7A2A` | Laranja para texto pequeno (rótulos) |
| `glow-bg` | `#2B1407` | Mancha de luz laranja no fundo (radial-gradient) |

**Times** (só quando o assunto é time ou território; a forma sempre acompanha a cor, para daltônicos):

| Time | Cor | Forma |
|---|---|---|
| Neon Striders | `#2FA8FF` | círculo |
| Volt Runners | `#19E6A8` | triângulo |
| Night Owls | `#FF4FD8` | losango |
| Urban Coyotes | `#FFD60A` | quadrado |

## 2. Tipografia

| Papel | Fonte | Pesos |
|---|---|---|
| Títulos e números | **Unbounded** (Google Fonts) | 700–900 |
| Texto em contorno | **Unbounded Line** (`pdf/UnboundedLine-800.woff2`) | 800 |
| Texto corrido | **Inter** | 400–700 |
| Rótulos, placar, telemetria | **JetBrains Mono** (maiúsculas, letter-spacing 4–6px) | 400–700 |
| Telas do mockup (títulos) | **Archivo** expandido (`font-stretch:125%`) | 800–900 |

**Unbounded Line** é a Unbounded 800 com os contornos sobrepostos removidos (`pdf/corrigir_fonte.py`). Sem isso, o `-webkit-text-stroke` desenha riscos dentro das letras.

**Escala (slide 1920×1080):** título 56px · número-herói 112–200px · capa 176px · texto 26–34px · rótulo e rodapé 24px. Nada abaixo de 24px.

## 3. Grade do slide

- Palco fixo de 1920×1080 com margens de 128px (área útil de 1664×824).
- Slides com rodapé: `padding:128px 128px 160px`. O rodapé fica a 64px do fundo e **mostra só a numeração** (`03/10`).
- Topo de cada slide:
  - rótulo em JetBrains Mono laranja maiúsculo (ex.: `01 · CORRER`);
  - título em Unbounded 56px, que é a **conclusão** do slide.
- Slides de funcionalidade: texto à esquerda (até ~1050px) e celular à direita (`left:1290px; top:72px; 495×880`).
- Capa, Demonstração e Fechamento: mapa real em tela cheia, um degradê preto da esquerda (`#070708` → transparente em ~66%) e o texto por cima.

## 4. Efeitos

| Efeito | Como |
|---|---|
| Glow neon | `text-shadow`/`box-shadow` na **mesma cor**, em camadas: `0 0 18px`, `0 0 60px`, `0 0 120px`. Nunca sombra preta |
| Texto em contorno | `color:transparent; -webkit-text-stroke:3px #F3F1ED` com a fonte Unbounded Line |
| Card aceso | borda `#FF6A13` + `box-shadow:0 0 50px rgba(255,106,19,.25)` |
| Rota desenhando | `pathLength="1"`, `stroke-dasharray:1`, `stroke-dashoffset` de 1 para 0 em 2,8s |
| Pulso do corredor | 2 anéis, `scale(.12)` → `scale(1)` sumindo, 2,2s, defasados 1,1s |
| Zona disputada | contorno tracejado com `stroke-dashoffset` animado (marching ants) |
| Hover (web) | celulares inclinam em 3D (±14°), botão magnético com brilho que varre, cards sobem 6px |
| Cursor | brilho laranja radial de 560px seguindo o mouse com atraso (lerp 0,12) |
| Textura | grão de filme 6% e scanlines finas no mapa |
| Easing | `cubic-bezier(.23,1,.32,1)` (saída). Hover 100–160ms, entradas até 1,2s. Nunca `ease-in` |
| Acessibilidade | `prefers-reduced-motion`: só fades |

## 5. Mapa

- Base real: OpenStreetMap via Overture Maps (entorno do Parque Flamboyant, Goiânia).
- Cores:
  - terra `#0A0B0D`;
  - prédios `#121317`;
  - ruas de `#1B1C22` (residencial) a `#3B3D47` (via expressa);
  - parque `#0B1610`;
  - água `#08141F`;
  - nomes das avenidas em JetBrains Mono `#5E606B`.
- A cor fica só nos dados:
  - regiões dos times com 13% de preenchimento e borda neon com glow;
  - percurso laranja com núcleo claro.
- **Nunca** hexágonos visíveis.

## 6. Celular (mockup)

- Moldura escura de 390×844 com cantos de 60px, borda metálica e glow laranja embaixo.
- Barra de abas escura com o item ativo em laranja e um traço luminoso em cima.
- Botão principal: pílula laranja (`#FF8233` → `#FF5A00`) com texto preto em Archivo expandido e brilho varrendo.
