# Jogo e território — material da E3 (F1)

Relatório principal: [`../03-jogo-e-territorio.md`](../03-jogo-e-territorio.md).

## Simulação (`sim/`)

TypeScript rodando com `npx -y tsx`, importando o domain atual (`apps/mobile/src/domain`) por caminho relativo.
A regra C usa o mesmo motor do teste de regressão do app (`apps/mobile/src/domain/__tests__/sim/paint-sim.ts`).
Tudo com semente fixa: rodar de novo dá os mesmos números.

| Arquivo | O que faz | Tempo |
|---|---|---|
| `sim/base.ts` | RNG com semente, H3, mapas (ruas reais do Flamboyant em `docs/apresentacao/mockup/build/mapa.json` e bairro sintético com as 271 zonas do seed) e geometria das rotas | — |
| `sim/agentes.ts` | Corredores (iniciante 3 km 2×/sem, regular 5 km 4×/sem, avançado 15 km 6×/sem), times, novatos e agenda de corridas | — |
| `sim/regras.ts` | Regras comparadas: A (atual, chamando o domain), B (barra limitada, M4), C (pintar ruas, M1 — **desde a onda 2, a regra real do domain via `applyPaint`**), C-F1 (a regra própria da F1), D (C-F1 + fechar circuito, M2) e variantes | — |
| `sim/regressao.ts` | **Regressão (onda 2, T7.2.3):** a regra real em 91 e 271 zonas, 3 sementes, times equilibrados e desequilibrados, com sondas do novato → `resultados/regressao.{md,json}`. A amostra pequena roda no Jest/CI: `apps/mobile/src/domain/__tests__/territory-sim.test.ts` (motor em `__tests__/sim/`) | ~1,5 min |
| `sim/rodar.ts` | Roda todos os cenários e grava `resultados/completo.{md,json}` | ~6 min |
| `sim/ajuste.ts` | Ajuste fino da pintura (margem, reforço na conquista) → `resultados/ajuste.{md,json}` | ~3 min |
| `sim/verifica-atual.ts` | Prova que a regra A da simulação é idêntica ao `finishRun` (400 corridas, diferença 0) | ~25 s |
| `sim/raid.ts` | Calibração da vida do chefão semanal | ~10 s |
| `sim/xp-neblina.ts` | Economia de XP atual (Neblina × distância) semana a semana | ~40 s |

```bash
npx -y tsx docs/melhoria/F1/jogo/sim/verifica-atual.ts
npx -y tsx docs/melhoria/F1/jogo/sim/rodar.ts            # completo (3 sementes, 5 cenários)
npx -y tsx docs/melhoria/F1/jogo/sim/rodar.ts --rapido   # 1 semente, bairro de 271 zonas
npx -y tsx docs/melhoria/F1/jogo/sim/ajuste.ts          # histórico da F1 (regra própria C-F1)
npx -y tsx docs/melhoria/F1/jogo/sim/regressao.ts       # regra real, alvos da D-62
npx -y tsx docs/melhoria/F1/jogo/sim/raid.ts
npx -y tsx docs/melhoria/F1/jogo/sim/xp-neblina.ts
```

Limites do modelo: os corredores não escolhem a rota para atacar zonas fracas (na vida real o app vai sugerir
"faltam 3 trechos ali"); todos correm em ruas, sem trilhas fora do mapa; não há grupos de crew (M_grupo) nem Fuga.
