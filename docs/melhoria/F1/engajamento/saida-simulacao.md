<!-- Gerado por: npx -y tsx docs/melhoria/F1/engajamento/simulacao-progressao.ts (2026-10-23). Não edite à mão. -->

## Simulação de progressão (sementes 101/202/303, 260 semanas a partir de 2 nov 2026)

### Curva ATUAL (xpForLevel = 100·n^1,5; XP = 1/100 m + 10/célula de neblina + 50 fantasma + baús da Caça)

| Nível | Iniciante (3 km, 2×/semana) | Regular (5 km, 4×/semana) | Avançado (15 km, 6×/semana) |
|---|---|---|---|
| 2 (100 XP) | 1 corrida (sem. 1) | 1 corrida (sem. 1) | 1 corrida (sem. 1) |
| 5 (1.703 XP) | 9 corridas (sem. 5) | 5 corridas (sem. 2) | 2 corridas (sem. 1) |
| 10 (11.106 XP) | 139 corridas (sem. 70) | 59 corridas (sem. 15) | 13 corridas (sem. 3) |
| 20 (67.135 XP) | não chega em 260 sem. | 781 corridas (sem. 196) | 163 corridas (sem. 28) |
| 30 (189.029 XP) | não chega em 260 sem. | não chega em 260 sem. | 782 corridas (sem. 131) |
| 40 (392.197 XP) | não chega em 260 sem. | não chega em 260 sem. | não chega em 260 sem. |
| 50 (689.513 XP) | não chega em 260 sem. | não chega em 260 sem. | não chega em 260 sem. |

### Curva PROPOSTA (xpForLevel = 50·n^1,3 arredondado a 10 + 50; fontes da seção 4.1)

| Nível | Iniciante (3 km, 2×/semana) | Regular (5 km, 4×/semana) | Avançado (15 km, 6×/semana) |
|---|---|---|---|
| 2 (100 XP) | 1 corrida (sem. 1) | 1 corrida (sem. 1) | 1 corrida (sem. 1) |
| 5 (880 XP) | 3 corridas (sem. 2) | 4 corridas (sem. 1) | 3 corridas (sem. 1) |
| 10 (4.300 XP) | 13 corridas (sem. 7) | 12 corridas (sem. 3) | 12 corridas (sem. 2) |
| 20 (21.100 XP) | 61 corridas (sem. 31) | 61 corridas (sem. 16) | 55 corridas (sem. 10) |
| 30 (53.660 XP) | 160 corridas (sem. 80) | 164 corridas (sem. 41) | 144 corridas (sem. 24) |
| 40 (104.130 XP) | 313 corridas (sem. 157) | 320 corridas (sem. 80) | 288 corridas (sem. 48) |
| 50 (174.160 XP) | não chega em 260 sem. | 544 corridas (sem. 136) | 492 corridas (sem. 82) |

### XP por semana (média)

| Perfil | Atual sem. 1 | Atual sem. 2–52 | Proposta sem. 1 | Proposta sem. 2–52 | Proposta ano 2 | Razão avançado/iniciante |
|---|---|---|---|---|---|---|
| Iniciante (3 km, 2×/semana) | 520 | 166 | 843 | 665 | 675 | atual 1.0× · proposta 1.0× |
| Regular (5 km, 4×/semana) | 1.627 | 442 | 1.615 | 1.295 | 1.258 | atual 2.7× · proposta 1.9× |
| Avançado (15 km, 6×/semana) | 5.549 | 1.849 | 2.734 | 2.148 | 2.058 | atual 11.1× · proposta 3.2× |

### De onde vem o XP (5 anos)

- **Iniciante (3 km, 2×/semana)** — atual: distância 50%, baús da Caça 30%, neblina 15%, fantasma 5%. Proposta: missões semanais 29%, baú do dia 25%, missões diárias 14%, corrida concluída 9%, distância 9%, semana garantida 8%, baús da Caça 5%, fantasma 1%, neblina 1%, primeira semana 0%.
  - Neblina: 44 células na 1ª semana; 459 em 5 anos. Distância total: 1.559 km.
- **Regular (5 km, 4×/semana)** — atual: distância 60%, baús da Caça 22%, neblina 13%, fantasma 5%. Proposta: missões semanais 27%, missões diárias 21%, distância 15%, baú do dia 15%, corrida concluída 9%, baús da Caça 6%, semana garantida 4%, fantasma 1%, neblina 1%, primeira semana 0%.
  - Neblina: 143 células na 1ª semana; 1.137 em 5 anos. Distância total: 5.197 km.
- **Avançado (15 km, 6×/semana)** — atual: distância 71%, neblina 21%, baús da Caça 6%, fantasma 2%. Proposta: distância 28%, missões diárias 23%, missões semanais 21%, baú do dia 9%, corrida concluída 9%, baús da Caça 3%, semana garantida 2%, neblina 2%, fantasma 2%, primeira semana 0%.
  - Neblina: 462 células na 1ª semana; 6.756 em 5 anos. Distância total: 23.387 km.

### Temporada (mês) com 24 degraus de 120 XP (bronze 8, prata 16, ouro 24)

| Perfil | XP da temporada (média) | Degraus (média) | Mín.–máx. | Meses com bronze (8) | Prata (16) | Ouro (24) | Dia mediano do ouro |
|---|---|---|---|---|---|---|---|
| Iniciante (3 km, 2×/semana) | 2.887 | 22.8 | 19–24 | 100% | 100% | 48% | dia 29 |
| Regular (5 km, 4×/semana) | 5.499 | 24.0 | 24–24 | 100% | 100% | 100% | dia 17 |
| Avançado (15 km, 6×/semana) | 8.996 | 24.0 | 24–24 | 100% | 100% | 100% | dia 10 |

### Baú do dia (5 anos)

- Iniciante (3 km, 2×/semana): 1.559 baús (6.0/semana) — comum 1.070, raro 371, lendário 118.
- Regular (5 km, 4×/semana): 1.819 baús (7.0/semana) — comum 1.222, raro 455, lendário 142.
- Avançado (15 km, 6×/semana): 1.819 baús (7.0/semana) — comum 1.240, raro 434, lendário 145.

### Faixa de corredor (distância total): semanas até cada faixa

| Faixa | km | Iniciante (3 km, 2×/semana) | Regular (5 km, 4×/semana) | Avançado (15 km, 6×/semana) |
|---|---|---|---|---|
| Asfalto | 0 | início | início | início |
| Bronze | 10 | 2 sem. | 1 sem. | 1 sem. |
| Prata | 50 | 9 sem. | 3 sem. | 1 sem. |
| Ouro | 150 | 25 sem. | 8 sem. | 2 sem. |
| Neon | 400 | 67 sem. | 20 sem. | 5 sem. |
| Holográfico | 1000 | 167 sem. | 50 sem. | 12 sem. |
| Lenda | 2500 | 417 sem. | 125 sem. | 28 sem. |
| Nômade | 5000 | 834 sem. | 250 sem. | 56 sem. |
