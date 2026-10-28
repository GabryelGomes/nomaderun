# E7 — Onda 4: `/missoes` enxuta (achado Médio da QA da E10)

> Branch `worktree-agent-af5b1ff39bd1b8904`, depois do merge de `claude/affectionate-gauss-e8gm77` (onda 4). 28/10/2026.

## Antes × depois (DOM, 390 px, modo demonstração, mesmo relógio)

| | Antes (`capturas/depois/`) | Depois (`capturas/e7-missoes-depois/`) |
|---|---|---|
| Palavras visíveis, cheio | 198 | **83** |
| Palavras visíveis, vazio | 206 | **85** |
| Selos de demonstração | 2 | **1** (o global) |
| Interativos sem nome / alvos < 44 px / erros | 0 / 0 / 0 | 0 / 0 / 0 |

Capturas: `docs/melhoria/capturas/depois/missoes__cheio__390.png` (antes) e `docs/melhoria/capturas/e7-missoes-depois/missoes__{cheio,vazio}__390.png` (depois, pngquant).

## O que mudou (`features/engagement/missions-screen.tsx`)

- **Selo:** saiu o `DemoBadge` da tela e o do cartão de volta (`demo={false}`); fica só o global do layout.
- **Primeira semana:** resumo "1/7 · prêmio: moldura Primeira Semana" e só o passo da vez (aberto, ou o próximo a liberar), com o atalho. Os 7 passos ficam atrás de **"Ver todos"** (`missoes-primeira-semana-ver-mais`). O resumo tem `accessibilityLabel` completo ("Um por dia, sem prazo…").
- **Missões:** título, anel com %, XP e "Trocar". O progresso em texto ("1,2 de 3 km") continua no `accessibilityLabel` do anel. O nível aparece só na **leve** ("Leve"), para a opção leve continuar visível (ética).
- **Prazos:** "Até 23h59" e "Até domingo". A regra da troca (1 por dia) fica no `accessibilityLabel` do prazo e no próprio botão.
- **Rodapé:** "Caminhar também conta."
- `testID`s mantidos; dois novos: `missoes-primeira-semana-ver-mais` e `missoes-hoje-prazo`.

## Testes

`npm run typecheck` e `eslint src`: 0 erros. `jest src/features/engagement` + `testids` + `reduced-motion`: 6 suítes, 59 testes verdes. Novo: "até 90 palavras e nenhum selo próprio" (`engagement-ui.test.tsx`).
