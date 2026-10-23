# E4 · Onda 1 (F3) — Sistema de arte e galeria `/dev/arte`

> **Equipe:** E4 (direção de arte). **Tarefas:** T7.1.10 (sistema de arte) e T7.1.11 (galeria). **Data:** 23/10/2026.
> **Pastas alteradas:** `apps/mobile/src/components/art/**`, `apps/mobile/src/app/dev/arte.tsx` e este relatório (com `E4-onda1/`).
> Nenhuma biblioteca instalada; nenhum documento de coordenação alterado.

## 1. Resumo

- **Antes:** a arte da F1 existia só como 57 SVGs gerados por scripts (`docs/melhoria/F1/arte/fonte/*.cjs`). O app não tinha nenhum componente de ilustração.
- **Depois:** `src/components/art/` tem o sistema completo em react-native-svg + Reanimated 4.5:
  - primitivas neon com 3 níveis de qualidade;
  - 9 famílias: mascotes (4 × 4 poses), emblemas, chefões (5 × 4 estados × dano 0/1/2), baús (3 × 3), 12 medalhas (3 níveis + bloqueada), 8 ícones de modos, 8 estados vazios, 3 cartões do tutorial e 4 fundos de aba.
- A geometria é um **porte direto** da F1 (mesmos paths). A comparação lado a lado está em `E4-onda1/comparacao-f1.png`: as peças são idênticas.
- **Arte nova desta onda:**
  - pose "dormindo" dos 4 mascotes;
  - golpe, furioso e derrotado da Soneca, do Rei Buzina e da Fuligem;
  - as camadas de dano dos 5 chefões;
  - 7 medalhas novas e os níveis por estrelas;
  - 4 estados vazios novos (sem zonas, sem medalhas, sem contatos, sem localização);
  - o cartão "Pinte" na regra v2 (D-62);
  - os 4 fundos.
- **Galeria** `/dev/arte`: mostra todas as peças, com troca de qualidade, de time, de nível das medalhas e o "parado" vivo. Foi conferida no export web, sem nenhum erro no console (capturas `galeria-web-*.png`).

## 2. Como o sistema funciona

```
art/
  neon/core.ts        ArtNode (dados) → expand(nodes, qualidade) → Prim (elementos SVG); pivô, forma do time, espelho
  neon/palette.ts     cores do Pit Lane Neon (neon.ts) + VILLAIN #B15CFF e EMBER locais
  neon/render.tsx     <Prims>, <ArtSvg>, <ArtLayer> (camada animável), <ArtFrame> (acessibilidade), <StaticArt>
  neon/markup.ts      a mesma árvore em texto SVG (só para a evidência em PNG)
  team/   boss/   chest/   medal/   mode-icons/   empty/   tutorial/   backgrounds/
          cada família = *-art.ts (geometria pura, sem React) + componente .tsx
  index.ts            exporta tudo
```

- **Brilho sem filtro.** Cada traço tem até 4 camadas da mesma geometria: halo largo (4,6 × t, 7%), halo médio (2,4 × t, 20%), núcleo e filete quente. Não há `feGaussianBlur` nem sombra preta, e o desenho roda igual no Android, no iOS e na web.
- **Qualidade** (`quality`):

  | Nível | Camadas | Uso |
  |---|---|---|
  | `completo` | 4 | herói |
  | `leve` | 2 (halo médio a 26% + núcleo) | listas e cards |
  | `plano` | só o núcleo | ícones e capturas |
  | `auto` (padrão) | escolhe pelo tamanho | ≥ 96 pt → completo; ≥ 40 → leve; menor → plano |

  Mascote Lume medido: **227 / 153 / 99 elementos** (`E4-onda1/mascotes-qualidade.png`).
- **Sem lógica de jogo.** A tela decide pose, estado, raridade, nível e dano. Os componentes só desenham.
- **Animação:**
  - **Estático por padrão:** um `Svg` só, o caso mais barato.
  - **Em camadas:** com `animated` ou `parts`, a peça vira camadas (`Svg` dentro de `Animated.View`), cada uma com `transformOrigin` no pivô. Assim o movimento é só transform e opacidade da camada, e nenhum path é animado.
  - **"Parado" vivo (`animated`):**
    - mascote: respira (`scaleY` 1 → 1,015, 4 s), balança a cabeça (±1,5°, defasagem de 1 s) e pisca (120 ms; intervalos fixos por time, de 2,6 a 5,6 s);
    - chefão: flutua (±3, 2,4 s) e, no Mormaço, os raios giram (40 s);
    - com `useReducedMotion()`, nada se mexe;
    - os valores são lidos e escritos só em efeitos e worklets (`get`/`set`), nunca durante a renderização (React Compiler).
- **Acessibilidade.** Toda peça fica dentro de um `View`:
  - **decorativa:** `aria-hidden`, `accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"`;
  - **informativa:** `accessibilityRole="image"` com `accessibilityLabel`;
  - chefão, baú e medalha são informativos por padrão ("Chefão Mormaço, furioso", "Baú raro, fechado", "Medalha Explorador, nível 2 de 3"); `decorative` os esconde;
  - os demais são decorativos, a menos que recebam `accessibilityLabel`;
  - nenhuma peça recebe toque (`pointerEvents: 'none'`).
- **Texto fora do SVG:** o nome no emblema completo é um `Text` sobreposto à faixa (`allowFontScaling={false}`, porque a faixa é arte de tamanho fixo).

## 3. API dos componentes

Todos aceitam `size` (largura em pt; a altura segue o viewBox), `color`, `quality` (`'auto' | 'completo' | 'leve' | 'plano'`), `accessibilityLabel`, `testID` e `style`.

| Componente | Props próprias | viewBox | Pivôs para a E5 |
|---|---|---|---|
| `Mascot` | `team`, `pose` (`parado`·`vitoria`·`derrota`·`dormindo`), `animated`, `parts` | 200 × 220 | `MASCOT_PIVOTS`: `corpo` (100, 220), `cabeca` (100, 150), `olhos` (100, 100) |
| `TeamEmblem` | `team`, `compact` (padrão: compacto abaixo de 64 pt) | 200 × 200 | — |
| `Boss` | `id` (`soneca`·`rei-buzina`·`fuligem`·`mormaco`·`paredao`), `state` (`parado`·`golpe`·`furioso`·`derrotado`), `dano` (0·1·2), `animated`, `parts`, `decorative` | 240 × 240 | `BOSS_PIVOTS`: `corpo` (120, 228), `raios` (120, 112) |
| `Chest` | `rarity` (`comum`·`raro`·`lendario`), `state` (`fechado`·`abrindo`·`aberto`), `parts`, `decorative` | 160 × 160 | `CHEST_PIVOTS`: `tampa` (30, 86, dobradiça), `corpo` (80, 148) |
| `Medal` | `kind` (12, ver `MEDAL_KINDS`), `tier` (1·2·3), `locked`, `decorative` | 120 × 150 | `MEDAL_PIVOTS.roseta` (60, 98) |
| `ModeIcon` | `kind` (`dominio`·`atlas`·`fuga`·`caca`·`raid`·`liga`·`cidades`·`crews`), `accent` | 64 × 64 | — |
| `EmptyArt` | `kind` (8, ver `EMPTY_KINDS`), `team` (mascote em "sem notificações" e "sem localização") | 240 × 160 | — |
| `TutorialArt` | `step` (`corra`·`pinte`·`defenda`), `team`, `rival` | 240 × 180 | — |
| `TabBackground` | `kind` (`arena`·`clube`·`voce`·`atividades`), `team`, `opacity` (sempre ≤ `MAX_BACKGROUND_OPACITY` = 0,06) | 390 × 844, `slice` | — |

**`parts` (para a E5):** recebe o resultado de `useAnimatedStyle` para cada grupo (tipo `ArtPartStyle`). O componente já põe o pivô em `transformOrigin`. Exemplo da tampa abrindo:

```tsx
const lid = useAnimatedStyle(() => ({ transform: [{ rotate: `${-open.get() * 30}deg` }] }));
<Chest rarity="lendario" state="fechado" parts={{ tampa: lid }} />
```

Chefão em golpe:
- empilhe `<Boss state="golpe" />` sobre o `parado`, com a opacidade de 1 → 0 em 300 ms;
- faça o tremor com `parts.corpo`.

Também exportados: os rótulos (`BOSS_NAMES`, `MEDAL_LABELS`, `EMPTY_LABELS`…), as listas (`BOSS_IDS`, `MASCOT_POSES`…), `bossLabel`, `chestLabel`, `medalLabel`, `tierColor` e `ART` (paleta).

## 4. Testes

`src/components/art/__tests__/art.test.tsx`: **12 testes, 12 passando**. Há 1 teste de renderização por família e 2 das regras do traço. Os testes usam `react-test-renderer` (dependência do `jest-expo`) e o mock do Reanimated no padrão do projeto.

| Família | O que confere |
|---|---|
| neon | completo > leve > plano em elementos (mascote ≤ 240); `auto` pelo tamanho; nenhum `filter`/`blur`; só `g`, `path`, `circle`, `rect` e `ellipse` (sem `text`) |
| team | 16 mascotes renderizam com a cor e o tamanho pedidos; as 4 poses geram árvores diferentes; o modo animado tem 4 camadas; o emblema completo escreve o nome por `Text` e o compacto não |
| boss | 60 combinações; rótulo "Chefão …"; os 4 estados são diferentes; o dano 2 tem mais elementos que o 1, e o 1 mais que o 0; cor e `decorative` |
| chest | 9 combinações; só o lendário usa o gradiente; `parts` gera 4 camadas |
| medal | 12 tipos × 3 níveis + bloqueada; rótulo; largura e altura (1,25 ×) |
| mode-icons | 8 ícones em 28 pt com a cor |
| empty | 8 estados decorativos; o mascote na cor do time |
| tutorial | 3 cartões com a cor do time |
| backgrounds | 4 fundos decorativos com opacidade ≤ 6%, mesmo pedindo 50% |

Verificações em `apps/mobile`, antes de cada commit:

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ok |
| `./node_modules/.bin/eslint src` | 0 problemas |
| `npx jest --maxWorkers=2` | 51 suítes passando e 4 puladas; **429 testes passando** e 26 pulados |

- `testids.test.ts` e `reduced-motion.test.ts` continuam verdes. Os arquivos que animam (`mascot.tsx`, `boss.tsx`) consultam `useReducedMotion`.
- O aviso "worker process has failed to exit gracefully" já existia: é o vazamento do Jest que a E10 trata na T7.1.19.

## 5. Evidência (PNG, comprimidos com `pngquant --quality=85-98`)

- **Gerador:** `E4-onda1/gerar-evidencia.cjs`. Ele usa os mesmos módulos `*-art.ts` e a mesma `expand()` dos componentes, transpilados na hora, e captura com o Playwright. Para regenerar:

  ```
  NODE_PATH=/opt/node22/lib/node_modules node docs/melhoria/relatorios/E4-onda1/gerar-evidencia.cjs [família…]
  ```
- **Componentes reais:** capturas da galeria `/dev/arte` no export web (`expo export -p web`).

| Família | Arquivo |
|---|---|
| Conferência F1 × F3 | ![](E4-onda1/comparacao-f1.png) |
| Mascotes (4 × 4) | ![](E4-onda1/mascotes.png) |
| Qualidade e tamanho real | ![](E4-onda1/mascotes-qualidade.png) |
| Emblemas | ![](E4-onda1/emblemas.png) |
| Chefões (5 × 4) | ![](E4-onda1/chefoes.png) |
| Chefões, dano 0/1/2 | ![](E4-onda1/chefoes-dano.png) |
| Baús (3 × 3) | ![](E4-onda1/baus.png) |
| Medalhas | ![](E4-onda1/medalhas.png) |
| Ícones dos modos (64/40/28) | ![](E4-onda1/icones-modos.png) |
| Estados vazios | ![](E4-onda1/vazios.png) |
| Tutorial | ![](E4-onda1/tutorial.png) |
| Fundos (real e 100%) | ![](E4-onda1/fundos.png) |
| Galeria no navegador (componentes reais) | ![](E4-onda1/galeria-web-1.png) ![](E4-onda1/galeria-web-2.png) ![](E4-onda1/galeria-web-3.png) |

**Crítica e rodadas desta onda:**
- **Zs da pose dormindo.** Na rodada 1 eles batiam na orelha caída do Faro. Foram para o canto superior direito.
- **Rachaduras do dano.** Na rodada 1 eram finas demais a 150 pt. Ficaram com 2,4 de traço, sulco escuro e ramificação. O Paredão ganhou um tijolo faltando no dano 2.
- **Soneca menos infantil (crítica da F1).** Ganhou sobrancelhas em V e braços-ponteiro com garras. No derrotado, os braços ficam caídos.
- **Medalha Chefão bloqueada.** A silhueta mantinha o violeta; agora fica cinza.
- **Mascote em "sem localização".** Passou a ficar por cima do mapa tracejado.

**O que ainda pode melhorar:**
- os bustos continuam frontais (corpo em corrida é a T7.2.7);
- o ícone Fuga dentro da medalha fica fino a 64 pt;
- a 28 pt, Liga e Cidade × Cidade são legíveis, mas são os mais densos.

## 6. Pendências, pedidos e riscos

**Pedidos:**
- **E6 (onda 2):** trocar a constante local `VILLAIN` (`art/neon/palette.ts`) pelo token `neon.villain` quando ele existir. É 1 linha, e todos os componentes leem dali.
- **Coordenador, rota da galeria:**
  - não criei `src/app/dev/_layout.tsx`;
  - no export web sem backend configurado, `/dev/arte` abriu sem login: a rota fica fora dos `Stack.Protected` do `_layout.tsx`, e o `route-guard` não a bloqueou;
  - com backend configurado e sem sessão não testei. Se o guard redirecionar, é preciso liberar `dev/*` no `_layout.tsx`;
  - em produção nativa, a própria tela redireciona para `/`.
- **E5:**
  - use `parts` com os pivôs exportados;
  - para a confirmação do time, a pose `vitoria` + `parts.corpo`;
  - os loops do "parado" já respeitam o "Reduzir movimento". O fade de 150 ms entre estados é de vocês (D-71).
- **E3/E7:**
  - os critérios das 12 medalhas (o desenho já existe);
  - o cartão "Pinte" segue a D-62 (ruas na cor do time). Se a regra mudar, aviso para ajustar.
- **E9:** os ids dos chefões (`soneca`, `rei-buzina`, `fuligem`, `mormaco`, `paredao`) e as raridades (`comum`, `raro`, `lendario`) são estáveis.
- **E10:**
  - medir FPS com 4 mascotes `animated` (16 `Svg`) num Android médio;
  - conferir a legibilidade em 28, 40 e 56 pt na galeria.

**Riscos:**
- **O modo em camadas usa 4 `Svg` por mascote.** Para listas, use o estático (padrão) com `quality="leve"`.
- **Ids do gradiente.** O prisma do baú lendário usa um id por instância (`useId`, sem ":"). Na web, os ids são globais no documento; testei vários baús lendários na mesma página sem conflito.
- **Fonte da faixa do emblema.** Usa `fonts.display` (Inter Tight 800). Se a fonte não carregar, o texto cai na fonte do sistema, mas a largura da faixa já tem folga.
