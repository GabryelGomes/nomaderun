# Regressão do território v2 (regra real: `applyPaint`)

Gerado por `regressao.ts` (sementes 1, 2, 3; 4 semanas de aquecimento + 8 medidas; densidade 90 veteranos por 271 zonas; sondas do novato: 40 primeiras corridas hipotéticas a cada 4 dias medidos).

| Cenário | Novato na 1ª corrida (sondas) | … nos primeiros 1 km | Novatos (agentes) na 1ª corrida | Novatos que nunca conquistaram | Zonas eternas | Giro semanal | Custo para tomar (mediana) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Teste do Jest (91 zonas) · times equilibrados | 60% | 29% | 71% (21) | 0% | 10% | 32% | 0,77 km |
| Bairro da F1 (271 zonas) · times equilibrados | 62% | 32% | 77% (60) | 0% | 11% | 33% | 0,80 km |
| Bairro da F1 (271 zonas) · times desequilibrados (45/30/15/10%) | 47% | 24% | 62% (60) | 2% | 24% | 24% | 0,95 km |
