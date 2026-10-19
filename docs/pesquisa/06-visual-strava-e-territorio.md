# Pesquisa 6 — Visual no estilo Strava e território sem grade (out/2026)

> Valores marcados "não oficial" vêm de extratores de terceiros.

## 1. Identidade do Strava
- **Laranja:** `#FC5200` ("International Orange", web/app atual) e `#FC4C02` ("Tangelo", logo histórico).
- **Neutros (não oficial):** texto `#242428`, secundário `#43423F`, fundo quente `#F9F8F5`, superfície `#FAFAFA`; refresh de 2024 puxou os neutros para tons quentes.
- **Tipografia:** marca em Boathouse (proprietária); app reportado em **Inter**.
- **Mapas:** rota laranja forte sobre mapa claro dessaturado; heatmaps nas cores hot, blue, purple, gray e bluered; heatmap pessoal laranja (mais usado) e cinza (menos usado).
- **Cards:** branco sobre cinza-claro, mapa em cima, métricas grandes embaixo, CTA laranja em pílula.
- **Pode copiar:** o clima (fundo claro, um único acento laranja, números grandes, rota marcante). **Não pode:** logo, nome, selos e a fonte Boathouse. Por isso o NOMADE RUN usa um laranja próprio: **`#FF5A1F`**.

## 2. Como outros apps mostram território
| App | Visual |
|---|---|
| INTVL | Loop fechado vira polígono livre na cor do usuário; botão para esmaecer tudo exceto o seu território |
| KYRO (2026) | Área dentro do loop na sua cor, num mapa compartilhado da cidade |
| RunWar / Motera | Loop → polígono, fronteiras que se movem ao vivo |
| Zonner | Pinta as ruas internas do loop na sua cor |
| Konquo / Run An Empire | Hexágonos visíveis (o problema que o NOMADE tinha) |
| Zenly | Névoa que se dissolvia por onde você andava; estética orgânica, sem grade |
| Pikmin Bloom | Rastro de flores no mapa |

**Padrão comum dos apps de sucesso:** polígonos livres, preenchimento translúcido, borda na cor do dono e **nenhuma grade interna**.

## 3. Decisão para o NOMADE RUN
O motor H3 continua (regras justas e testadas), mas a exibição muda:
1. Zonas vizinhas do mesmo time são **unidas num polígono só** (`cellsToMultiPolygon`).
2. Os cantos são **arredondados** (Chaikin, 2 passadas).
3. Preenchimento translúcido (~0,2; o seu time ~0,3), borda de 2 px na cor do time com halo branco.
4. Zona disputada: contorno tracejado na cor do time atacante.
5. Percurso em laranja com borda branca, como no Strava.
6. Filtro "Só meu time", como no INTVL.

## 4. Paleta
| Token | Hex | Uso |
|---|---|---|
| primary | `#FF5A1F` | Ação principal, rota, aba ativa |
| primary-pressed | `#E24A12` | Pressionado |
| primary-text | `#C93F00` | Texto laranja sobre branco |
| ink | `#242428` | Texto |
| ink-2 | `#5E5E66` | Texto secundário |
| ink-3 | `#A5A5AE` | Desabilitado |
| bg | `#F7F6F3` | Fundo |
| surface | `#FFFFFF` | Cards |
| surface-2 | `#F0EFEC` | Chips |
| line | `#E4E3DF` | Divisores |
| success / danger / warning | `#1F9D55` / `#D92D20` / `#E8A317` | Estados |

**Times (seguros para daltonismo, nenhum laranja):** Neon Striders azul `#0072B2` (●), Volt Runners verde `#009E73` (▲), Night Owls magenta `#C0559A` (◆), Urban Coyotes amarelo `#D9B200` (■). A forma do ícone é a redundância para quem não distingue cores.

**Tipografia:** Inter (interface) e Inter Tight (números grandes, tabulares).

## Fontes
developers.strava.com/guidelines · brandpalettes.com/strava-colors · spikeapi.com · styles.refero.design · webdesignhot.com · designmd.co · pikspec.com · colorfyi.com · brandfetch.com · sensatype.com · griffdesigns.com/strava · 9to5google.com (dark mode 2024) · androidauthority.com (heatmap) · bikeradar.com (personal heatmap) · support.strava.com (stat maps) · blog.mapbox.com (Strava; Zenly) · intvl.com.au · nikmat.substack.com · fueledbylolz.com · konquo.com · rundida.com (KYRO) · motera.app · wibto.com · techcrunch.com (Zenly) · h3geo.org/docs/api/regions · turfjs.org (polygonSmooth)
