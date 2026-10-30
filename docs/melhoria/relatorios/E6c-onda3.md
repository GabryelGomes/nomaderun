# E6c — onda 3 (T7.3.3): Arena e Clube

> Equipe E6c (nova frente da E6) · Reformulação v2 · base `092497c` + merge da `claude/affectionate-gauss-e8gm77` (encaixe da E7).

## 1. O que mudou

### Arena (`arena-screen.tsx`, `arena-screen.model.ts`, `arena-screen-help.tsx`)
- **Herói:** o chefão da semana com a arte da E4 (`Boss`).
  - O estado e as rachaduras vêm da vida real: fases 1/2/3 viram dano 0/1/2, a fase 3 deixa o chefão "furioso" e a derrota o deixa "derrotado".
  - Mostra a barra de vida (`ProgressBar` em 3 segmentos, violeta só para vilões), "36% de vida · Fase 2", "Foge em 2 d" e o bloco "Sua parte".
  - O selo "Demonstração" aparece quando `isDemo` vem marcado ou no modo demonstração.
- **Sem Raid ou com erro (D-76):** silhueta do vilão com "O chefão ainda não chegou" ou "Chefão chega segunda, 6h". No erro, aparece "Sem conexão" com o botão "Tentar de novo". Nenhum número é mostrado.
- **Missões de hoje:** 3 anéis da E7 (`ProgressRing`) que abrem `/missoes`, mais o link "Ver todas". Sem missão real, a seção some.
- **Modos (grade 2×2 com `ModeIcon`):** cada modo mostra um dado real.

  | Modo | Dado mostrado | Toque |
  |---|---|---|
  | Fuga | ritmo do fantasma escolhido | abre a corrida com o modo |
  | Caça | baús abertos | abre a corrida com o modo |
  | Domínio | zonas conquistadas | abre o mapa |
  | Atlas | % do bairro mais explorado (`districtsExploration`) | abre o mapa |

- **Liga:** faixa com "Liga Rua · 17º de 30 · top 5 sobe". Fora da liga: "Corra para entrar". Sem o recurso: "Liga em breve".
- **"?" no cabeçalho:** abre uma folha com 3 cartões `TutorialArt` (corra, pinte, defenda). Com "Reduzir movimento", a folha esmaece em vez de deslizar.
- **Saiu da tela:** o botão "Correr agora", que repetia a aba Correr, e os cards "Em breve" de Raid, Rabisco e Bandeira.

### Clube (`club-screen.tsx`, `club-ranking.ts`)
- **Herói da crew:** emblema do time (`TeamEmblem`), "[FLR] · 6 corredores" e "115,0 km esta semana".
  - Embaixo, uma barra com "6 de 6 correram".
  - Os dados vêm do `ranking_runners` da semana, filtrado pela sigla da crew (`crewWeek`).
  - Tocar no herói abre a crew.
- **Sem crew:** `EmptyArt sem-crew`, "Corra junto, conquiste mais" e o botão "Entrar ou criar crew".
- **Corridas da crew:** `<CrewFeed>` da E8, embutido na tela.
- **Convite:** `<InviteCard kind="crew">` aparece quando a pessoa está sozinha na crew.
- **Ranking:**
  - pódio mantido e unidade "pts";
  - 1 linha de filtro: Corredores · Crews · Times · **Cidades**, mais o chip "Semana · Todos ▾", que abre período e escopo;
  - a Guerra de Cidades virou o quadro "Cidades", sempre com dado real. O placar de demonstração que aparecia em conta real saiu;
  - o "Próximo encontro" falso saiu.
- **E7:** `markRankingOpened()` roda ao montar o ranking.

### Crew (`crew-screen.tsx`)
- Emblema no topo.
- `<InviteCard kind="crew">` no lugar da caixa do código.
- Seção "Temporada" com os pontos em "pts".
- Sem crew, aparece uma ilustração com 1 frase. Os textos de ajuda e de erro ficaram mais curtos.

### Maestro
- `.maestro/07-arena-clube.yaml` cobre este caminho:
  1. Arena e o "?" (folha de ajuda);
  2. Fuga, que abre a Nova corrida;
  3. Clube, quadro Cidades;
  4. Crew.

## 2. Régua de texto (`node docs/melhoria/F1/ux/medir-texto.mjs --comparar antes`)

| Tela | Antes | Depois | Meta | Blocos longos | Imagem |
|---|---:|---:|---:|---|---|
| (tabs)/arena | 195 | **30** | 45 | 10 → 0 | não → sim |
| (tabs)/clube | 108 | **39** | 45 | 3 → 0 | não → sim |
| (tabs)/clube/crew | 109 | **69** | 70 | 1 → 0 | não → sim |

O total das telas de jogo caiu para 904 palavras, com média de 39.

**Notas de honestidade:**
- **Folha "?" da Arena:** é detalhe sob demanda, num arquivo à parte, e a régua não a conta. Ela tem 32 palavras: título, 3 verbos e 3 frases de até 10 palavras.
- **Clube:** o número inclui o `extra: 12` fixo da régua, que corresponde ao texto vazio do ranking.
- **Componentes da E8:** os textos de `CrewFeed` e `InviteCard` estão em arquivos da E8 e não entram na régua.

## 3. Capturas (modo demonstração, 390 pt, pngquant)

- **Pastas:**
  - `E6c-onda3/antes/`: tela visível e página inteira, `arena`, `clube` e `clube-crew` (cheio) e `arena`/`clube` (vazio);
  - `E6c-onda3/depois/`: as mesmas capturas.
- **Como foram feitas:** export com `--clear` e `TMPDIR` próprio, e `capturas.cjs` com as opções `--rotas=arena,clube,clube-crew --larguras=390`.
- **Conferências:**
  - a página inteira veio de um script auxiliar no scratchpad;
  - o testID novo `arena-ajuda-abrir` está no bundle;
  - 0 páginas com erro e 0 pedidos ao servidor.

## 4. Testes

- **Novo:** `src/features/screens/__tests__/e6c-arena-clube.test.tsx`, com 9 testes:
  - chefão real;
  - selo de demonstração;
  - Raid e Liga indisponíveis, sem nenhum número;
  - erro;
  - grade de modos;
  - fase → arte;
  - prazo e porcentagem;
  - semana da crew;
  - quadro Cidades.
- **Verificações:** `npm run typecheck` ok; `eslint src` com 0 problemas.
- **Jest completo** (`--silent --maxWorkers=2`): 116 suítes passando e 4 puladas (já eram); 1.324 testes passando e 26 pulados.
- `testids`, `reduced-motion` e `animated-styles` estão verdes. O `rankings-privacy-track` (club-ranking) não mudou e continua verde.

## 5. Pendências e pedidos

| Para | Pedido |
|---|---|
| **E9/E3** | **Meta de km da crew:** o servidor não tem. Por isso, a barra do herói mostra "todos correrem" (quem correu ÷ membros), que é dado real. Com um `crew_week` oficial (meta e km), a troca é de 1 linha |
| **E9** | **Semana da crew:** é calculada com `ranking_runners` (semana, time da crew, limite de 500). Uma crew de um time com mais de 500 corredores ativos pode perder membros na soma |
| **E6/E4** | **Ícone de ajuda:** o `Icon` não tem "?" e o botão usa o caractere. A E4 pode desenhar um ícone de ajuda |
| **Coordenador** | **Régua:** atualizar o `extra: 12` do Clube no `medir-texto.mjs`, que não é meu, se o texto vazio do ranking mudar. A folha `arena-screen-help.tsx` pode entrar como "Arena · ajuda" |
| **E3** | **Atlas:** mostra o % do bairro mais explorado. Se houver o "bairro atual", trocar |
