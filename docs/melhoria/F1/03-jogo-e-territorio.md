# F1 · E3 — Jogo e território

> Equipe E3 (game design e território) · Reformulação v2 · 23/10/2026
> Simulação reprodutível: [`jogo/`](jogo/README.md) · resultados brutos: [`jogo/sim/resultados/`](jogo/sim/resultados/)

## 0. Resumo em 12 linhas

1. **Regra nova em 1 frase:** **"Corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela."**
2. A regra atual (RP, influência, 30, 1,1×, 50%, escudo, fortificar, decaimento, teto) **não cabe em 1 frase** e **trava o mapa**: na simulação, tomar uma zona dominada custa **8 a 10 km correndo dentro dela** (mediana), 94% das zonas exigem mais de 3 km, e **38–55% das zonas ficam com o mesmo dono as 8 semanas inteiras**.
3. **O iniciante quase não ganha:** um novato iniciante que chega num bairro já ocupado conquista na 1ª corrida em **8–13%** dos casos, e **32–61% nunca conquistam nada em até 8 semanas**. Com a pintura: **42–62% na 1ª corrida e 0–12% nunca** (e o 1º trecho pintado aparece nos primeiros ~40 m, em 100% das corridas).
4. "Semanas com pelo menos 1 conquista" para o iniciante: **30% → 77%** (bairro denso, times equilibrados).
5. Defesa passa a importar: zona perdida retomada em ≤ 7 dias **49% → 67%**. O decaimento atual é essencial (sem ele, 70% das zonas viram eternas), mas pune quem corre 2×/semana.
6. **Fechar o circuito (M2) e o bônus de azarão não entram na regra do mapa**: pioram o novato (1ª corrida 62% → 35%) e aumentam as zonas eternas. O circuito fica como **momento épico cosmético** (XP + animação), sem pintar área.
7. A barra limitada (M4 puro) foi testada: **caótica** (50–61% das zonas trocam de dono por semana; a conquista do iniciante some em 65% dos casos).
8. **Pontos de esforço relativo continuam**, mas para **ranking, liga e Cidade × Cidade**; o mapa é de quem pinta. "O mapa é de quem corre a rua; o ranking é de quem se supera."
9. **Bugs reais** em quase todos os modos (seção 4): promessa falsa "Conquista garantida" na corrida, ataque que nunca expira, Fuga com bônus garantido (×1,5 sempre), Raid e Liga anunciados como reais sendo demonstração, "lendários ficam longe" falso no servidor.
10. **Raid desenhado por completo** (seção 9): chefão semanal por cidade, vida calibrada pelos km da cidade (cai sexta–domingo em 8 de 8 semanas simuladas), 3 fases, dano 10/km, ponto fraco ×2, crítico 10% visível, teto diário, recompensas coletiva e individual.
11. Migração **aditiva**: tabela de trechos, `influence` continua preenchida (contagem de trechos), app antigo continua funcionando; virada na troca de temporada.
12. 9 tarefas propostas para F3/F4 (seção 13) e 7 decisões para o coordenador (seção 12).

---

## 1. Mapa das regras atuais

### 1.1 Constantes e fórmulas

| Regra | Valor | Onde está (arquivo:linha) | Onde roda | Como chega na tela |
|---|---|---|---|---|
| RP por zona | `metros × 0,1 × esforço × sequência × fantasma × grupo × defesa`, arredondado | `apps/mobile/src/domain/scoring.ts:59-78` | servidor (`supabase/functions/_shared/scoring.ts:236`) e app (provisório, `features/run/summary-model.ts:92`) | resumo ("+RP") e "+N RP" ao vivo |
| Esforço relativo | ritmo-base ÷ ritmo, entre 0,8 e 1,3 | `scoring.ts:10-11,22-26` | idem | não aparece ao vivo |
| Ritmo-base | mediana das 10 últimas; **360 s/km sem histórico** | `scoring.ts:9,33-39` | idem | — |
| Sequência | +5% por unidade, até 10 (o domain chama de "dias"; o servidor passa **semanas**) | `scoring.ts:12-13,28-30`; `_shared/scoring.ts:228` | idem | não aparece |
| Fantasma / grupo / defesa | ×1,5 / ×1,25 / ×2 | `scoring.ts:14-16` | idem | faixa "Pontos em dobro" (`run-screen.tsx:335`) |
| Teto diário | 300 RP por pessoa, zona e dia | `scoring.ts:17,75-77` | servidor | não aparece |
| Conquista de neutra | 30 RP | `territory.ts:8,79-87` | servidor | barra "Faltam X RP" (`run-screen.tsx:402`) |
| Tomada de rival | 110% da influência do dono (e ≥ 30) | `territory.ts:9,92-100` | servidor | idem |
| Sob ataque / fim do ataque | rival ≥ 50% / < 40% do dono | `territory.ts:11-12,102-111` | servidor | alerta no Mapa (`map-screen.tsx:128-131`), folha da zona |
| Janela de defesa | 24 h | `territory.ts:13,124-125` | servidor | contagem na folha (`zone-sheet.tsx:110-115`) |
| Escudo | até 3; rival perde 10/20/30% | `territory.ts:15-16,66-71` | servidor | "Escudo nível N" (`zone-sheet.tsx:199`) |
| Fortificar | dono com ≥ 500 m no dia sobe 1; dia sem corrida do dono desce 1 | `territory.ts:17,146-155`; job `20261020120300_views_and_jobs.sql:150-180` (00:05) | SQL | — |
| Decaimento | **diário** ×0,9; < 5 vira 0; dono < 30 perde | `territory.ts:19-20,128-143`; job `views_and_jobs.sql:116-145` (03:00) | SQL | zona some do mapa |
| Temporada | influência ×0,3 no dia 1 | `territory.ts:22,158-162`; `views_and_jobs.sql:211-226` | SQL | — |
| Neblina | H3 res 10, raio 30 m, 10 XP por célula | `games.ts:15-33` | servidor | camada "explorado" |
| XP | 1 por 100 m + 10 por célula + 50 se vencer o fantasma | `run-engine.ts:172-175`, `games.ts:91` | servidor | resumo |

### 1.2 O que o jogador vê hoje

- **Durante a corrida:** cartão da zona atual com "+N RP" e "Faltam X RP para conquistar" (`run-screen.tsx:383-404`), faixa "Território dos X" ao entrar em zona rival e voz "Território dos X" (`voice-guide.ts:25-29`). **A rota não pinta nada**; não há marco de 25/50/75%; a conquista só aparece no resumo, depois da confirmação do servidor.
- **No mapa:** regiões suavizadas por dono; alerta "Sob ataque" da primeira zona atacada.
- **Na folha da zona:** barra de influência dos 4 times, números de influência, escudo, histórico.

---

## 2. Diagnóstico da regra atual (respostas da seção 7.1 do prompt)

Números da simulação, bairro de 271 zonas, 90 veteranos + 25 novatos, times equilibrados (tabela completa na seção 6).

| Pergunta | Resposta | Evidência |
|---|---|---|
| Cabe em 1 frase? | **Não.** São 9 mecanismos com 14 constantes | seção 1.1 |
| A pessoa vê que está ganhando? | **Não de verdade.** O ao vivo usa `metros × 0,1` e ignora esforço, escudo, teto e sequência | `run-screen.tsx:254-256` (bug E-01) |
| O iniciante conquista no 1º dia? | **Quase nunca num bairro ocupado:** 13% na 1ª corrida; 32% nunca em 8 semanas (60% com times desequilibrados) | tabela 6.2 |
| Quem corre muito domina para sempre? | **Sim:** 38% das zonas com o mesmo dono nas 8 semanas; tomar exige 8 km dentro da zona (mediana) | tabela 6.2 |
| Explorar vale mais que repetir? | **Não no território.** Repetir a mesma volta dá os mesmos RP. Só o XP da Neblina premia explorar, e ele despenca 75% em 12 semanas (tabela 6.6) | `scoring.ts:59-78` |
| Defender é possível e recompensador? | **Pouco:** só 49% das zonas perdidas voltam em 7 dias; o ataque nunca expira de verdade (bug E-03) | tabela 6.2 |

**Onde a diversão morre no Domínio:** na **2ª semana do novato**. Ele corre 3 km, vê "Faltam 1.364 RP para conquistar", não ganha nada e, quando ganha uma zona neutra com 30–33 RP, **ela é neutralizada na mesma madrugada** pelo decaimento diário (30 × 0,9 = 27 < 30). O INTVL tem a queixa espelhada: o jogador urbano "segura a área por umas 10 horas" e a regra premia a geografia, não o esforço ([review](https://fueledbylolz.com/2026/06/09/intvl-running-app-review/amp/), [App Store](https://apps.apple.com/app/id6472631698)).

---

## 3. Fidelidade da simulação

A regra A **chama o próprio domain** (`scoreZone`, `applyRunPoints`, `fortifyZone`, `decayZone`, `seasonReset`) na ordem dos jobs do servidor. O script `sim/verifica-atual.ts` gera os pontos de GPS completos de 400 corridas e compara com o `finishRun` oficial. Resultado: **diferença máxima de influência 0,000000 e o mesmo nº de conquistas em 400/400 corridas**.

---

## 4. Auditoria dos modos

Legenda: ✅ funciona · 🟡 funciona com bugs/lacunas · 🎭 só demonstração · ⛔ não existe.

### 4.1 Domínio 🟡

| ID | Bug | Arquivo:linha | Efeito |
|---|---|---|---|
| E-01 | Previsão ao vivo usa `metros × 0,1` e ignora esforço, escudo, sequência e teto; mostra **"Conquista garantida ao terminar"** sem garantia | `features/screens/run-screen.tsx:254-256,402` | Novato a 7:15/km, 1ª corrida (ritmo-base padrão 360): 320 m na zona → tela diz "garantida" (32 RP), servidor dá 320×0,1×0,83 = **26,5 RP → não conquista**. Promessa falsa (ética 5.4) |
| E-02 | Alvo ao vivo de zona rival = `influência do dono × 1,1`, sem o mínimo de 30 e sem o escudo | `run-screen.tsx:255` | Barra chega a 100% antes da hora em zona com escudo |
| E-03 | **Ataque nunca expira**: `attackStartedAt` só é limpo se o rival cair abaixo de 40% do dono numa corrida; decaimento e jobs não limpam | `domain/territory.ts:103-111`; `views_and_jobs.sql:130-134` | Zona fica "sob ataque" para sempre; **nenhum alerta novo dispara** para ela (condição `attackStartedAt === null`) |
| E-04 | Mapa usa `isUnderAttack` sem prazo e promete "defender vale pontos em dobro" após as 24 h | `features/screens/map-screen.tsx:128-131,231` | Promessa falsa; o dobro só vale 24 h (`territory.ts:124-125`) |
| E-05 | Ícone de ataque sem prazo | `zone-sheet.tsx:138`; `run-screen.tsx:386` | Sinal visual eterno |
| E-06 | Empate favorece `striders` (ordem de `FACTION_IDS`, comparação `>`) | `territory.ts:55` | Regra não simétrica entre times |
| E-07 | Zona neutra é dada ao **time mais forte**, mesmo que não seja quem correu | `territory.ts:79-84` | Após neutralização com rival entre 30 e 33, a próxima corrida de qualquer time entrega a zona ao rival |
| E-08 | Virada de temporada multiplica por 0,3 sem reavaliar o dono | `territory.ts:158-162`; `views_and_jobs.sql:222-224` | Dono fica com influência < 30 até as 03:00 |
| E-09 | Decaimento **diário** de 10% | `territory.ts:127-143`; cron `views_and_jobs.sql:246` | Iniciante (2×/sem) perde ~35% entre corridas; zona recém-conquistada com 30–33 cai na mesma noite |
| E-10 | Sequência dá **+5% por semana até +50% para sempre** (o domain chama de dias; recebe semanas) | `scoring.ts:28-30`; `_shared/scoring.ts:228` | Vantagem permanente do veterano no território |
| E-11 | `validPath` O(n²) (`some` dentro de `filter`) | `domain/run-engine.ts:170` | 1 ponto/s em 15 km ≈ 29 milhões de comparações no servidor |
| E-12 | `addPoint` copia o vetor de pontos a cada fixo | `run-engine.ts:33-34` | Custo quadrático de memória na corrida longa (risco de travada, E5/E10) |
| E-13 | Jargão "RP" na tela | `run-screen.tsx:391,402`; `zone-sheet.tsx:218` | Viola P12 |

**Demonstração:** a zona do parque "sob ataque" e os vizinhos fracos (`demo/demo-data.ts:113-131`) usam `Date.now()`; ok como demonstração.
**Diversão:** ver seção 2. **Direção:** regra nova (seção 7).

### 4.2 Neblina / "Onde já corri" ✅ (vira Atlas)

- Funciona no domain e no servidor (`games.ts:15-33`, `fog_cells`).
- **Bug E-14:** o mapa mostra só as **últimas 600 células** (`map-screen.tsx:125`, `fog.slice(-600)`); o veterano vê o Atlas incompleto.
- **Onde a diversão morre:** o XP da Neblina é 80–85% do XP na 1ª semana e cai **4×** em 12 semanas (tabela 6.6). Sem meta por bairro, o modo vira uma camada esquecida.
- **Direção:** Atlas por distrito H3 res 7 (`grid.ts:11`): "% do bairro explorado", medalha a cada 25/50/75/100%, revelação animada. Função pura `districtExploration(revealed, district)` (T7.E3.7).

### 4.3 Fuga 🟡

| ID | Bug | Arquivo:linha | Efeito |
|---|---|---|---|
| E-15 | **Estratégia dominante:** o corredor escolhe o fantasma (5:00 a 7:00, `run-screen.tsx:48`); o servidor aceita até 15:00 (`supabase/functions/_shared/validate.ts:18-19`). Quem corre a 6:00 escolhe 7:00 e ganha **×1,5 em todas as zonas + 50 XP em toda corrida** | `run-engine.ts:129-131,147`; `scoring.ts:63` | Fuga vira "bônus grátis" |
| E-16 | Iniciante a 7:15/km nunca vence nem o fantasma mais lento (7:00) | `run-screen.tsx:48` | Injusto para quem mais precisa |
| E-17 | Vitória é só "terminar à frente"; ultrapassagens e distância ao vivo não viram eventos | `games.ts:40-49` | Sem pico de emoção |

**Direção:** fantasma **relativo ao próprio ritmo-base** (3 níveis: "Seu ritmo" = base; "Desafio" = base × 0,97; "Recorde" = melhor ritmo das 10 últimas), bônus de XP (não de território) e eventos `fantasma_alcancou` / `fantasma_ultrapassado` com a "corda" ao vivo (E5/E6). Fantasma de amigo = rota real de outra pessoa (RF-012).

### 4.4 Caça ✅ (com textos falsos)

- Sorteio real no servidor (`20261021120100_chests.sql:44-66`), abertura validada (`_shared/scoring.ts:349-363`).
- **E-18:** a Arena diz "Os lendários ficam longe" (`arena-screen.tsx:27`), mas o servidor sorteia posição e raridade **independentes** (`chests.sql:58,64`). Só a demonstração afasta os lendários (`demo/demo-data.ts:163`).
- **E-19:** as chances 70/25/5% (`chests.sql:33`) **não aparecem** em lugar nenhum (transparência, 5.4).
- **E-20:** baús caem em lago, condomínio ou avenida (sem base de ruas, D-39). Com 5–8 baús uniformes num disco de 3 km, o mais próximo fica a **~950 m** (mediana): o iniciante de 3 km alcança 1 por dia se for direto.
- **Diversão:** boa ideia, mas sem radar ao vivo além de "Baú mais próximo a X m" e sem animação de abertura.
- **Direção:** lendário a ≥ 1,5 km (no SQL, E9); chances na tela; radar; baú preso ao trecho de rua mais próximo quando houver base de ruas.

### 4.5 Raid 🎭

- **Só demonstração:** `DEMO_RAID` fixo (`demo/demo-data.ts:168-178`), "termina em 19 h" eterno.
- **E-21 (ética):** a Arena marca Raid como **"Em toda corrida"** (`arena-screen.tsx:25`) e diz "Domínio, Neblina e Raid valem em toda corrida" (`arena-screen.tsx:87`). **Nenhuma corrida causa dano** em lugar nenhum. É contador falso, proibido na seção 5.4. Correção imediata: texto "Em breve" até o servidor existir.
- **Direção:** mecânica completa na seção 9.

### 4.6 Liga do Bairro 🎭

- Regra pura existe (`games.ts:63-75`); servidor não agrupa (RN-015 🟡).
- **E-22:** divisão fixa `const division = 1` (`arena-screen.tsx:41`).
- **E-23:** os pontos do jogador são o **XP total da vida** contra adversários de 80–980 (`demo/demo-data.ts:184-194`, linha 191). Depois de poucas corridas a pessoa é sempre 1ª e "promovida" para sempre.
- **E-24:** "Duas corridas esta semana mudam isso" (`arena-screen.tsx:155`) não tem cálculo por trás.
- **Direção:** pontos semanais = `km × 10 × esforço (0,8–1,3)` + 20 por zona conquistada + 10 por zona retomada, teto 300/dia; grupos de 30 por volume das 4 últimas semanas; fecha domingo 21:00. Funções `leaguePoints` e `leagueGroups` no domain (T7.E3.6), servidor E9.

### 4.7 Cidade × Cidade 🟡

- Real quando há cidades com 20+ ativos (`views_and_jobs.sql:77-95`); demonstração rotulada caso contrário (`club-screen.tsx:138-140`).
- **E-25:** `soma ÷ √corredores` ainda cresce com √N (`games.ts:9-12`). Com o mesmo esforço por pessoa, a cidade 4× maior faz 2× mais pontos. O comentário "cidades pequenas competem" é só parcialmente verdade.
- **Diversão:** o corredor não vê o próprio impacto. **Direção:** placar por **média por corredor ativo** (com mínimo de 20) ou torre por divisões de porte; "sua corrida valeu +0,4 para Goiânia".

### 4.8 Crews ✅

- Real (crews, M_grupo no servidor, D-40). **E-26:** a barra da crew mostra `membros ÷ 30` (`club-screen.tsx:160`), que não é meta de nada.
- O encontro é demonstração rotulada (`club-screen.tsx:197-221`).
- **Diversão morre:** sem meta coletiva semanal. **Direção:** meta semanal de km da crew (soma) com barra, aplausos (E8) e "crew pintou 48 trechos hoje".

### 4.9 Missões ⛔

- Não existem. "Missão" hoje é o modo da corrida (`store/game-store.ts:11`). A preferência `missions` existe no banco (`20261020120000_extensions_and_schema.sql:61`).
- **Direção (E7):** os eventos da seção 8 são o gatilho das missões ("pinte 30 trechos novos", "retome 1 zona", "dê 50 de dano no chefão").

### 4.10 Rabisco ⛔ e Bandeira ⛔

- **E-27:** `MissionId` inclui `'rabisco'` (`store/game-store.ts:11`), mas o banco só aceita `livre|fuga|caca` (`extensions_and_schema.sql:108`). Se alguém ligar o modo, o envio da corrida quebra.
- A Arena anuncia "Chega na v1.0" e "v2" (`arena-screen.tsx:28-29`).
- **Recomendação:**
  - **Bandeira:** sai da Arena. Exige eventos ao vivo simultâneos, fora do escopo.
  - **Rabisco:** fica como "Em breve", com arte, no fim da lista.
  - **Opcional na F4**, se sobrar tempo: Rabisco = comparar o traçado com a forma da semana pela distância de Fréchet discreta (função pura simples), nota de 0 a 100, card para compartilhar (E8).

### 4.11 Resumo da auditoria

| Modo | Funciona? | Só demonstração? | O jogador vê | Onde a diversão morre |
|---|---|---|---|---|
| Domínio | 🟡 13 bugs | não | número RP, barra | 2ª semana do novato: nada muda, conquista evapora |
| Neblina | ✅ (1 bug) | não | camada do mapa | quando o bairro já foi revelado (XP cai 4×) |
| Fuga | 🟡 | não | texto "N m à frente" | vira bônus grátis; o iniciante nunca vence |
| Caça | ✅ | não | "baú a X m" | baús inalcançáveis; sem animação nem chances |
| Raid | 🎭 | **sim** | número fixo | é falso |
| Liga | 🎭 | **sim** | tabela fixa | sempre 1º |
| Cidade × Cidade | 🟡 | parcial | lista | impacto invisível |
| Crews | ✅ | encontro | nome, membros | sem meta coletiva |
| Missões | ⛔ | — | — | — |
| Rabisco / Bandeira | ⛔ | anúncio | cartão cinza | promessa vazia |

---

## 5. Mecânicas avaliadas

| Critério | **A atual** | **B barra limitada (M4)** | **C pintar ruas (M1)** ⭐ | **D pintura + circuito (M2)** | **M3 bandeiras** (não simulado) |
|---|---|---|---|---|---|
| Regra em 1 frase | não | "corra na zona para encher a barra do seu time" | **"pinte as ruas; a zona é de quem pintou mais"** | 2 frases | 2 frases + campos |
| Ao vivo | número RP | barra subindo | **a rota pinta trecho a trecho; barra de duas cores; "faltam 3 trechos"** | idem + miolo ao fechar | ícone no mapa |
| Justiça para o iniciante | ruim (13% na 1ª) | ótima (95%), mas a conquista some (65%) | **boa (62%)** | média (35%) | depende da distância |
| Explorar compensa | não | só com "rua nova ×2" | **sim, por natureza** (rua já sua só reforça) | sim | sim |
| Defesa | escudo/dobro opaco | instável | **camadas (até 3) + retomar ruas** | idem | sim |
| Anti-domínio | ruim (38–55% eternas) | ótimo (0%), caótico | **bom (11–25%)** | médio (21–40%) | — |
| Antifraude | validação atual | idem | idem + só entre pontos válidos ≤ 100 m | polígono pode ser forjado com GPS falso | precisa base de pontos |
| Custo no app | já existe | baixo | médio (domain + traço colorido) | médio | alto (base de pontos) |
| Custo no servidor | já existe | baixo (mesma tabela) | **médio (tabela de trechos)** | alto | alto |
| Banco atual | igual | `influence` reaproveitada | **aditivo** (`zone_cells`; `influence` = contagem) | aditivo | novo |
| Veredito | sai | rejeitada (caos) | **recomendada** | circuito só como cosmético | futuro (marcos) |

Outras variantes testadas e rejeitadas (tabelas 6.3 e 6.4):

| Variante | Rejeitada porque |
|---|---|
| C sem desbotar | +4 a 13 pontos de zonas eternas |
| C + proteção de 24 h após conquistar | reduz a conquista do novato (62% → 45%) |
| C + margem de 2 trechos | reduz o novato e não melhora a evaporação |
| C + reforço na conquista | reduz a evaporação (52% → 42%), mas também o novato. Fica como **ajuste reservado** (D7) |
| Azarão (rival tira 2 camadas se o time tem < 15% do mapa) | efeito pequeno (57% vs 59% para o maior time) |

---

## 6. Simulação

### 6.1 Método

**Mapas:**
- **Bairro de 271 zonas:** exatamente as zonas do seed (`supabase/seed.sql`, disco H3 k=9 no Parque Flamboyant), com ruas em grade de 100 m levemente tortas e 8% de quadras maiores.
- **Ruas reais do Flamboyant:** 5.330 nós de rua do `mapa.json` (Overture/OSM, raio de 2,1 km), que tocam 144 zonas.

**Corredores:**

| Perfil | Volume | Ritmo | Parte dos veteranos |
|---|---|---|---|
| Iniciante | 3 km, 2×/sem | ~7:15/km | 50% |
| Regular | 5 km, 4×/sem | ~6:00/km | 35% |
| Avançado | 15 km, 6×/sem | ~5:00/km | 15% |

- Cada corredor tem uma casa e 2 voltas favoritas (65% das corridas); nas outras, explora uma volta nova. 8% das corridas planejadas não acontecem.
- Ritmo do dia com variação de ±4%. Ritmo-base e sequência semanal são calculados como no servidor.

**Tempo:**
- 4 semanas de aquecimento: o mapa já existe quando a medição começa.
- Depois, **8 semanas medidas**, com as viradas de temporada reais (01/11 e 01/12).
- **25 novatos por 271 zonas** (20 iniciantes + 5 regulares) chegam ao longo das semanas 1 a 6. É deles o "tempo até a 1ª conquista".

**Times:**
- Equilibrados: 25% cada.
- Desequilibrados: 45 / 30 / 15 / 10%. O time maior é o `volt`, último na ordem de desempate (E-06).

**Reprodutibilidade:**
- Sementes 1, 2 e 3, com média entre elas.
- A mesma agenda de corridas alimenta todas as regras (números aleatórios comuns).

**Métricas:**

| Métrica | Como foi medida |
|---|---|
| Rotatividade | Dono no fim da semana ≠ dono no fim da semana anterior |
| Zona eterna | Mesmo dono em todos os fins de dia das 8 semanas |
| Evaporou | A zona não era mais do time quando o iniciante voltou a correr |
| Retomada | O dono antigo recupera a zona em ≤ 7 dias |
| Custo de tomar | Metros dentro da zona para 1 rival com esforço 1,0 |
| Gini por jogador | Zonas creditadas a quem mais contribuiu no time dono |

### 6.2 Tabela principal: atual × recomendada

Bairro de 271 zonas, 90 veteranos.

| Métrica | Alvo | **Atual (A)**<br>times equilibrados | **Pintura (C)**<br>times equilibrados | **Atual (A)**<br>times desequilibrados | **Pintura (C)**<br>times desequilibrados |
|---|---|---:|---:|---:|---:|
| 1º trecho pintado (1ª corrida) | 100% em ≤ 100 m | — | **100% (~40 m)** | — | **100%** |
| Novato iniciante conquista uma zona na 1ª corrida | ≥ 50% | 13% | **62%** | 8% | **45%** |
| … nos primeiros 1 km | — | 8% | 32% | 3% | 25% |
| km até a 1ª zona (mediana, novato iniciante) | ≤ 3 km | 11,6 | **2,0** | ∞ (maioria nunca) | **3,4** |
| Novato iniciante que nunca conquista em até 8 semanas | ≤ 10% | 32% | **0%** | 60% | **10%** |
| Semanas com ≥ 1 conquista: iniciante | ≥ 60% | 30% | **77%** | 17% | **58%** |
| Semanas com ≥ 1 conquista: regular | — | 60% | 98% | 47% | 90% |
| Semanas com ≥ 1 conquista: avançado | — | 97% | 100% | 88% | 100% |
| Zonas que mudam de dono por semana | 15–30% | 17% | 32% | 11% | 23% |
| Zonas eternas (8 semanas) | ≤ 15% | 38% | **11%** | 55% | **25%** |
| Zona perdida retomada em ≤ 7 dias | ≥ 60% | 49% | **67%** | 49% | **67%** |
| Custo para 1 rival tomar (mediana, dentro da zona) | ≤ 1,5 km | **8,1 km** | **0,8 km** | 10,1 km | 0,9 km |
| Zonas que exigem > 3 km dentro delas | 0% | 94% | 0% | 98% | 0% |
| Conquista do iniciante que já evaporou na volta | ≤ 40% | 41% | 52% ⚠ | 37% | 51% ⚠ |
| Gini por jogador | menor é melhor | 0,75 | 0,70 | 0,75 | 0,70 |
| Iniciantes com ≥ 1 zona no fim | — | 26% | 38% | 24% | 35% |
| Parte das zonas do maior time (parte dos jogadores) | ≈ parte dos jogadores | 34% (30%) | 34% (30%) | **60% (46%)** | 57% (46%) |

**Outros cenários:**

| Métrica | Atual (A)<br>baixa densidade (30) | Pintura (C)<br>baixa densidade (30) | Atual (A)<br>ruas reais | Pintura (C)<br>ruas reais |
|---|---:|---:|---:|---:|
| Novato iniciante conquista na 1ª corrida | 25% | **77%** | 12% | **42%** |
| Novato iniciante que nunca conquista | 7% | **0%** | 52% | **12%** |
| Semanas com conquista: iniciante | 63% | **77%** | 25% | **59%** |
| Zonas eternas | 25% | 15% | 36% | 15% |
| Custo para tomar | 2,9 km | 0,7 km | 8,0 km | 0,7 km |
| Rotatividade semanal | 21% | 30% | 17% | 24% |

**Leitura:**
- A pintura cumpre os alvos de justiça, exploração, anti-domínio e defesa.
- O único alvo não cumprido é a **evaporação** (≈ 50%): num bairro cheio, o avançado rival repinta a rua do iniciante antes da volta dele.
- Duas respostas, sem mexer na regra:
  1. **Retomar é fácil** (67% em 7 dias): a notificação "sua rua foi pintada, retome" vira um loop bom. É "evitar perda" com defesa possível (5.2).
  2. **Atalho de ajuste:** o "reforço na conquista" (todas as ruas do time na zona ganham +1 camada) baixa a evaporação para 42% e custa 10 pontos no novato. Fica guardado como parâmetro (D7).

### 6.3 Todas as regras, bairro denso, times equilibrados

Médias de 3 sementes. Completo em `resultados/completo.md`.

| Métrica | A | A0 sem decaimento | B barra 100 | B barra 300 | C | C + proteção 24 h | C sem desbotar | D | D + azarão |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Novato iniciante: conquista na 1ª corrida | 13% | 0% | 95% | 85% | **62%** | 45% | 50% | 35% | 45% |
| Novato iniciante: nunca conquistou | 32% | 70% | 0% | 0% | **0%** | 2% | 2% | 3% | 3% |
| Semanas com conquista: iniciante | 30% | 8% | 99% | 96% | **77%** | 58% | 72% | 63% | 68% |
| Conquistas/semana: avançado | 5,0 | 1,0 | 88,2 | 51,8 | 20,0 | 9,8 | 18,7 | 15,6 | 17,1 |
| Evaporou na volta | 41% | 15% | 65% | 64% | 52% | 44% | 51% | 51% | 53% |
| Rotatividade semanal | 17% | 6% | 61% | 44% | 32% | 35% | 28% | 25% | 26% |
| Zonas eternas | 38% | 70% | 0% | 5% | **11%** | 8% | 15% | 21% | 20% |
| Retomada em ≤ 7 dias | 49% | 27% | 78% | 72% | **67%** | 75% | 67% | 68% | 68% |
| Custo para tomar | 8,1 km | 32,4 km | 0,4 km | 0,8 km | 0,8 km | 0,8 km | 0,9 km | 0,9 km | 0,9 km |

**Efeito do decaimento** (A × A0):
- Sem decaimento, 70% das zonas viram eternas e 70% dos novatos iniciantes nunca conquistam.
- O decaimento atual é **o único freio** da regra A, e é ele que apaga a conquista do iniciante.
- Na pintura, o desbotar (7 dias por camada) **não pune o descanso**: uma rua com 3 camadas aguenta 3 semanas sem corrida.

### 6.4 Ajuste fino da pintura

Bairro denso, times equilibrados (`resultados/ajuste.md`).

| Métrica | C | C + margem 2 | C + reforço | C + margem 2 + reforço |
|---|---:|---:|---:|---:|
| Novato iniciante: conquista na 1ª corrida | **62%** | 50% | 52% | 45% |
| Semanas com conquista: iniciante | **77%** | 70% | 66% | 57% |
| Evaporou na volta | 52% | 50% | 42% | **37%** |
| Zonas eternas | 11% | 13% | **9%** | 10% |
| Retomada em ≤ 7 dias | **67%** | 65% | 65% | 60% |

### 6.5 Raid: calibração da vida

Bairro denso, semente 1 (`sim/raid.ts`).

| Semana | Vida | Caiu em | Corredores com recompensa | Maior parte de 1 corredor | Golpe final |
|---:|---:|---|---:|---:|---|
| 1 | 14.536 | sexta 17h | 94% | 5,6% | avançado |
| 2 | 15.893 | sábado 6h | 95% | 5,6% | regular |
| 3 | 16.123 | sexta 18h | 94% | 5,7% | avançado |
| 4 | 17.589 | sábado 9h | 95% | 5,8% | regular |
| 5 | 17.589 | sexta 18h | 98% | 6,0% | **iniciante** |
| 6 | 19.331 | sábado 18h | 96% | 5,4% | avançado |
| 7 | 19.877 | sábado 15h | 95% | 4,6% | **iniciante** |
| 8 | 20.430 | domingo 6h | 99% | 5,9% | regular |

O chefão cai **sexta a domingo** (antecipação durante a semana, pico no fim de semana). O teto diário impede que 1 pessoa faça mais de ~6% do dano.

### 6.6 Economia de XP atual

XP por corrida, por fonte (`sim/xp-neblina.ts`). **Pedido para a E7.**

| Perfil | Semana 1: Neblina / distância | Semana 12: Neblina / distância | Queda do XP total por corrida |
|---|---|---|---:|
| Iniciante | 177 / 30 | 21 / 30 | **−75%** |
| Regular | 246 / 50 | 19 / 50 | −77% |
| Avançado | 607 / 148 | 69 / 149 | −71% |

Como a curva de nível cresce (`100 × n^1,5`, `games.ts:95`), o ritmo de subir de nível despenca justo quando o hábito precisa se firmar. **Pedido E7:** XP por trecho pintado e por missão, Neblina com teto e medalha por bairro.

---

## 7. Regra recomendada: "Pintar a cidade"

### 7.1 Em 1 frase (para uma criança)

> **Corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela.**

Divulgação progressiva (P10), uma ideia por cartão do "?":
1. "Passar de novo na sua rua deixa a tinta mais forte (até 3 camadas)."
2. "O rival precisa passar uma vez para cada camada da sua tinta."
3. "Tinta sem ninguém passando desbota uma camada por semana."

### 7.2 Números

| Constante (domain) | Valor | Por quê |
|---|---|---|
| `PAINT_CELL_RES` | **11** (trecho de ~29 m de aresta, ~40 m de rua, 49 por zona) | rua a rua sem base de ruas (D-39); compatível com H3 res 9 |
| `PAINT_MAX_LAYERS` | **3** | defesa possível sem eternidade |
| Pintura do time | +1 camada por trecho por corrida (no máx. 1 por corredor por dia) | anti-volta-no-quarteirão |
| Passada do rival | −1 camada; chegando a 0, o trecho vira do rival com 1 camada | 1 passada vira rua fraca |
| `PAINT_FADE_DAYS` | **7** (−1 camada por semana sem passada do time dono) | nada é eterno; descanso de 2 semanas não zera |
| `ZONE_MIN_CELLS` | **3** (~120 m de rua) | conquista no 1º dia sem ser trivial |
| Dono da zona | time com mais trechos; empate mantém o dono | plural, simétrico |
| Interpolação | só entre 2 pontos **válidos** a ≤ 100 m | buraco de GPS não pinta linha reta pelo quarteirão |
| Virada de temporada | todos os trechos voltam a 1 camada | reset parcial (RN-006) |
| Pontos (ex-RP) | `scoreZone` continua, só para ranking/liga/cidades | esforço relativo (G3) onde a competição é entre pessoas |
| Sob ataque | rival com ≥ 50% dos trechos do dono, **ou** ≥ 3 trechos virados em 24 h; expira em 24 h sem nova virada | substitui E-03 |

**Saem do mapa:** RP como moeda de território, 30, 1,1×, escudo, fortificar, defesa ×2, sequência no território, teto de 300.
**Ficam (renomeados):** "pontos" no ranking e na liga.

### 7.3 Três exemplos ilustrados

**Exemplo 1 — Ana, 1º dia, zona neutra.**
Legenda: `·` rua vazia, `A` tinta do time da Ana.

```
Antes:                       Depois de 300 m:
 · · · · ·                    A A A A A
 ·       ·                    ·       ·
 · · · · ·                    · · · · ·
Zona neutra (0 trechos)       Ana 5 trechos → ZONA CONQUISTADA (mín. 3)
```

- Aos ~40 m: "Primeiro trecho pintado!" (micro).
- Aos ~120 m: 3 trechos, conquista (média).

**Exemplo 2 — Bruno, regular, ataca uma zona dos Corujas.**
`C1` = trecho dos Corujas com 1 camada, `C3` = com 3.

```
Zona "Setor Sul 4":
  C1 C1 C3 C3 C1 C1 C1     Corujas 7 trechos · Bruno 0
Bruno passa por 5 trechos:
  B  B  C2 C2 B  C1 C1     os C1 viram B; os C3 viram C2
  Placar: Bruno 3 × Corujas 4 → "faltam 2 trechos (~80 m)" (ou 1, se virar um C1)
Bruno dá a volta e pinta 2 ruas vazias da zona:
  Bruno 5 × Corujas 4 → ZONA CONQUISTADA
```

Os 2 trechos `C2` continuam dos Corujas. O retorno deles é a revanche.

**Exemplo 3 — Carla defende.**
Na segunda, os Coyotes viram 4 ruas da zona dela (aviso "Sua zona Parque Areião está sob ataque: Coyotes 6 × 7 você").
Na terça, Carla corre 1 km ali:
- repinta as 4 ruas (cada uma com 1 camada dos Coyotes);
- reforça as outras 3.

Resultado: **Carla 11 × 2** ("zona defendida", média). Se ela não corresse, a zona continuaria dela até um rival passar à frente. A tinta desbota 1 camada por semana, sem castigo por descansar.

### 7.4 Casos de borda

| Caso | Regra |
|---|---|
| Ida e volta na mesma rua na mesma corrida | conta 1 vez por trecho |
| 3 corridas no dia na mesma volta | 1 camada por corredor por trecho por dia |
| Trecho de outra zona cortado no meio | o trecho (res 11) pertence a 1 só zona (pai res 9). Sem ambiguidade |
| GPS sem sinal por 300 m | só os trechos dos pontos válidos; sem linha reta |
| Zona bloqueada (`blocked`) | não pinta (mantém `run-engine.ts:140`) |
| Zona de privacidade (RN-010) | **pinta e pontua**, mas o trecho não aparece para terceiros (seção 7.6) |
| Empate no plural | mantém o dono; neutra continua neutra |
| Troca de time (RF-003) | trechos pintados ficam com o time antigo |
| Corrida rejeitada / em revisão | não pinta; aprovação da moderação pinta com o estado do momento (como hoje, D-26) |
| Corrida offline | o app mostra a previsão; o servidor aplica na ordem de chegada; a virada pode diferir (aviso "resultado oficial") |

### 7.5 Antifraude

- Só trechos de **passos válidos** de `validateActivity` (RN-007/008) pintam.
- Índice de confiança e revisão continuam iguais.
- Teto natural: a pintura é limitada pela distância (15 km ≈ 375 trechos). Não há multiplicador que possa ser explorado.
- Servidor manda: o app só prevê. `finish-activity` recalcula tudo com trava por zona (`version`, como hoje).

### 7.6 Privacidade (importante)

Trecho pintado é rota. Por isso:
- o **mapa público** continua mostrando **só zonas** (regiões suavizadas e barra de duas cores);
- a **rua pintada** aparece só **na sua corrida** (ao vivo, no resumo e no card);
- para a previsão ao vivo, o servidor entrega a pintura dos arredores (`time + camadas`, **sem autor e sem hora**), **sem os trechos dentro de zonas de privacidade** de qualquer pessoa.

Decisão D3.

---

## 8. Feedback ao vivo: eventos para E5, E6 e E7

O domain emite os eventos a partir de `addPoint` (previsão no app) e de `finish-activity` (oficial). Todos têm `runId`, `t` (ms) e `atMeters` (distância da corrida).

| Evento | Quando | Dados | Nível (5.3) | Sugestão (E5/E6) |
|---|---|---|---|---|
| `trecho_pintado` | trecho vazio ou seu | `cell`, `zoneId`, `kind: 'novo'\|'reforco'`, `layers` | micro | a rota engrossa na cor do time; **sem vibração** por trecho (a cada ~40 m seria ruído) |
| `trecho_virado` | trecho rival virou seu | `cell`, `zoneId`, `from`, `layers: 1` | micro+ | respingo de tinta no ponto; vibração leve com intervalo mínimo de 10 s |
| `trecho_enfraquecido` | rival perdeu 1 camada, não virou | `cell`, `zoneId`, `owner`, `layersLeft` | micro | rachadura discreta |
| `zona_entrou` | mudou de zona | `zoneId`, `name`, `owner`, `counts`, `mine`, `gapCells`, `gapMeters` | — | cartão da zona com barra de duas cores "Você 3 × 7 Corujas" |
| `zona_progresso` | cruzou 25/50/75% do necessário | `zoneId`, `pct`, `gapCells`, `gapMeters` | pequena | anel enche; 75% = "faltam 80 m!" (gradiente de meta) |
| `zona_conquistada` | seu time passou a ter mais trechos | `zoneId`, `name`, `from`, `counts`, `provisional: true` | média | cor inunda a região, vibração de sucesso, voz "Zona conquistada!"; o oficial vem no resumo |
| `zona_defendida` | sua zona sob ataque voltou à margem ≥ 2, ou você virou de volta ≥ 3 trechos | `zoneId`, `retaken`, `counts` | média | escudo pulsando |
| `zona_rival_entrou` | entrou em zona de outro time | `zoneId`, `owner`, `gapCells` | — | faixa atual (`run-screen.tsx:298-339`) com "faltam N trechos" |
| `circuito_fechado` | rota voltou a ≤ 50 m de um ponto de ≥ 1 km atrás e a área de dentro ≥ 0,05 km² | `areaM2`, `perimeterM` | pequena/épica | só cosmético (+XP, efeito de laço); **não pinta área** |
| `fantasma_*` | ultrapassou / foi alcançado | `gapMeters` | pequena | "corda" ao vivo |
| `bau_aberto` | já existe | `chestId`, `rarity`, `xp` | pequena→épica | animação de abertura |
| `raid_golpe` | após `finish-activity` | `damage`, `crit`, `weakPointMeters`, `bossHpAfter`, `phaseAfter`, `finalBlow` | média/épica | "seu golpe" no resumo |

**Regras de ritmo:**
- no máximo **1 vibração a cada 10 s**, exceto conquista;
- voz só para conquista, 75% e entrada em zona rival;
- com "Reduzir movimento", opacidade em vez de movimento.

**Cálculo de "faltam N trechos"** (função pura `conquestGap(counts, faction)`): `max(MIN − meus, ⌈(dono − meus + 1) ÷ 2⌉)`, assumindo que cada trecho virado vale 2 no placar. Mostrado como "≈ N × 40 m".

---

## 9. Raid — chefão da semana (mecânica completa)

### 9.1 Regra em 1 frase

> **"Toda semana um chefão invade a cidade: cada quilômetro que você corre tira 10 de vida dele."**

### 9.2 Calendário e vida

| Item | Valor |
|---|---|
| Janela | **segunda 06:00 → domingo 21:00** (Brasília); nada de notificação depois das 21h |
| Escopo | por cidade (`profiles.city`); cidade com < 5 ativos entra no chefão da região mais próxima |
| Vida | `max(500, 0,75 × mediana dos km válidos da cidade nas 4 semanas anteriores × 10 × fator)` |
| Ajuste do fator | caiu antes de sábado → +10%; fugiu → −10%; limites 0,7–1,5 |
| Alvo de design | cair **sexta a domingo**; ≥ 90% dos ativos recompensados (simulação: 94–99%, tabela 6.5) |

### 9.3 Fases (para E4/E5)

| Fase | Vida | Estado do chefão | Mecânica |
|---|---|---|---|
| 1 — Desperta | 100% → 67% | parado, respirando | dano normal |
| 2 — Furioso | 67% → 33% | furioso (cor muda, tremor) | surgem **3 pontos fracos por dia** (zonas sorteadas por semente da cidade+dia, preferindo parques); metros dentro valem **dano ×2** |
| 3 — Última resistência | 33% → 0 | ferido, piscando | pontos fracos continuam; **contagem regressiva** visível; corrida em grupo (M_grupo) dá ×1,25 no dano |
| Derrotado | 0 | queda animada | golpe final registrado (quem, cosmético) |
| Fugiu | domingo 21:00 com vida > 0 | foge rindo | sem punição; "volta mais forte" (o fator cai, então a próxima é mais fácil) |

Animações pedidas à E4/E5: parado, levando golpe, furioso, derrotado, fugindo, e mais o número de dano flutuando e a barra de vida com as fases marcadas.

### 9.4 Dano por corrida

```
dano = (km_válidos + km_em_ponto_fraco × (2 − 1)) × 10 × (crítico ? 2 : 1) × (grupo na fase 3 ? 1,25 : 1)
dano = min(dano, 300 − dano_do_corredor_hoje)
```

- **Crítico:** 10% (chance **visível**), sorteio determinístico por `hash(activityId)`. Sem dinheiro, sem loot pago.
- **Teto diário:** 300 por pessoa (~30 km). Ninguém derruba sozinho; o maior corredor faz ~6% (tabela 6.5).
- Só corridas **válidas e pontuadas** dão dano; cada atividade dá dano 1 vez (`raid_hits.activity_id` único).
- O iniciante vê o **próprio golpe** ("30 de dano · você está entre os 112 que enfrentaram o Mormaço") e não "0,3%".

### 9.5 Recompensas

| Tipo | Condição | Recompensa |
|---|---|---|
| Coletiva | chefão derrotado e você deu ≥ 10 de dano (1 km) | **Baú do chefão**: até quinta 23:59 = lendário 15% / raro 85%; sexta–sábado = raro; domingo = comum (chances na tela) |
| Coletiva | idem | **medalha do chefão** (coleção, 1 por espécie) + 200 XP |
| Individual | sempre | XP = dano ÷ 2 (até 300/semana) |
| Individual | top 10 de dano da cidade | título cosmético "Caçador do Mormaço" por 1 semana |
| Individual | golpe final | moldura de avatar cosmética |
| Crew | crew com mais dano | emblema na página da crew |
| Cidade | derrotado | +1 troféu no Cidade × Cidade |

Nada de vantagem de território pelo Raid: o mapa continua só da pintura.

### 9.6 Elenco de chefões (nomes próprios, sem marcas de terceiros; arte da E4)

| Chefão | Tema | Fraqueza (texto do ponto fraco) |
|---|---|---|
| **Mormaço** | calor do cerrado | sombra dos parques |
| **Ladeira** | subida sem fim | quem sobe ruas novas |
| **Sofá Supremo** | preguiça de domingo | corrida antes das 8h |
| **Buzinão** | trânsito | ruas de bairro |
| **Poeira de Agosto** | seca | parques e lagos |
| **Garoa Cinzenta** | dia nublado | corrida em grupo |

A "fraqueza" é só sabor de texto do ponto fraco. A mecânica é sempre a mesma (zona ×2), para manter 1 frase.

### 9.7 Dados e servidor (pedido para a E9)

**Tabelas:**
- `raids(id, city, boss_id, starts_at, ends_at, hp_max, hp, phase, factor, status: 'active'|'defeated'|'escaped', defeated_at, final_blow_user)`;
- `raid_hits(activity_id pk, raid_id, user_id, crew_id, damage, crit, weak_meters, created_at)`;
- `raid_weak_points(raid_id, day, zone_id)`.

**RLS:** leitura de agregados; `user_id` só no próprio ranking.

**Fluxo:**
- dano calculado em `finish-activity` com o domain;
- `update raids set hp = greatest(0, hp - $dano) … returning` na mesma transação;
- idempotente por `activity_id`.

**Realtime:** canal `raid:<city>` com `hp` e `phase`. O app anima "golpe de outros" agregando a cada 30 s.

**Jobs (pg_cron):**
- abrir segunda 06:00;
- sortear pontos fracos às 06:00;
- fechar domingo 21:00;
- entregar baús e medalhas.

**Domain** (`raid.ts`, E3): `raidHpFor(weeklyKm[], factor)`, `raidPhase(hp, max)`, `raidDamage(input)`, `critRoll(activityId)`, `rewardTier(defeatedAt, startsAt)`, `nextFactor(defeatedAt|null)`, `weakPointsFor(cityZones, seed, day)`.

---

## 10. Os outros modos com a regra nova (resumo de regras)

| Modo | Regra revisada (curta) | Recompensa |
|---|---|---|
| Domínio | pintura (seção 7) | trecho (micro), zona (média), retomada (média) |
| Atlas (Neblina) | % explorado por bairro (distrito res 7) | medalha 25/50/75/100% por bairro; XP com teto |
| Fuga | fantasma do **seu** ritmo-base (3 níveis), amigo ou dono da zona | XP e medalha; **sem** multiplicador de território |
| Caça | lendário a ≥ 1,5 km; chances visíveis; radar | XP + cosmético raro |
| Raid | seção 9 | baú, medalha, título |
| Liga | pontos semanais de esforço relativo; grupos de 30 por volume; top 5 sobe | divisão nova animada no domingo |
| Cidade × Cidade | média por corredor ativo (mín. 20) | troféu da cidade; "sua corrida +0,4" |
| Crews | meta semanal de km da crew; trechos pintados juntos | emblema |
| Missões (E7) | baseadas nos eventos da seção 8 | XP, baú comum |
| Rabisco / Bandeira | "em breve" / fora | — |

---

## 11. Plano de migração

### 11.1 Domain (E3) — sempre funções novas; nada some antes da E9 migrar

| Arquivo | Conteúdo | Status |
|---|---|---|
| `src/domain/paint.ts` (novo) | constantes da seção 7.2; tipos `PaintCell`, `ZonePaint`; `cellsAlong(points, steps)`, `paintCell`, `zoneOwnerByCells`, `applyPaint(run, state, faction, now)` → `{cells, zones, events}`, `fadeCells(cells, now)`, `seasonResetPaint`, `conquestGap`, `attackState` | novo |
| `src/domain/live-events.ts` (novo) | tipos dos eventos da seção 8 e o acumulador incremental para o app | novo |
| `src/domain/raid.ts` (novo) | seção 9.7 | novo |
| `src/domain/league.ts` (novo) ou em `games.ts` | `leaguePoints`, `leagueGroups` | novo |
| `territory.ts` | correções E-03 (`isUnderAttack(zone, now)`), E-06 (desempate simétrico, `null` no empate), E-07, E-08; **marcar `@deprecated`** o que o mapa deixar de usar | ajuste |
| `run-engine.ts` | `finishRun` ganha `paint` no resultado (opcional, aditivo); corrigir E-11 e E-12 | ajuste |
| ponte | registrar cada arquivo novo em `supabase/functions/_shared/domain.ts`, `supabase/functions/deno.json` e `supabase/scripts/deno.json` | obrigatório |

### 11.2 Banco (E9) — só aditivo

**Tabela nova `zone_cells`:**
- colunas: `cell text pk, zone_id text references zones, faction text, layers smallint check 1..3, painted_at timestamptz, painted_by uuid, season text`;
- índice por `zone_id`;
- RLS: cliente nunca lê `painted_by` / `painted_at` (como `zone_events`, D-26).

**Tabela `zones`:**
- `influence` continua **preenchida com a contagem de trechos × 10**. O app antigo segue vendo dono, barra e números coerentes.
- Coluna nova `rule_version smallint default 1`.

**Configuração:** tabela `game_config(key, value)` com `territory_rule = 'v1'|'v2'` e data de virada.

**Jobs:**
- `job_fade_cells` diário (substitui `job_decay_zones` + `job_fortify_zones` quando estiver na v2);
- virada de temporada: `layers = 1`.

**Raid:** tabelas da seção 9.7.

**RPC nova:** `zone_paint_near(lat, lng, radius)` → `cell, faction, layers`, sem trechos em zonas de privacidade.

### 11.3 Functions (E9)

- `finish-activity` calcula **os dois**: pontos (`scoreZone`, para ranking) e pintura (mapa v2, se `territory_rule = 'v2'`).
- Resposta com campos **novos e opcionais**: `paint: { cells, flipped, zones: [{zoneId, before, after, counts}] }`, `raid: { damage, crit, … }`. O app antigo ignora.
- `zone` / `zones`: acrescentar `cells` (contagem por time) ao lado de `influence`.

### 11.4 Compatibilidade

| Combinação | Resultado |
|---|---|
| App antigo × servidor novo (v2) | vê dono e barra corretos (`influence` = trechos × 10); o "Faltam X RP" ao vivo fica impreciso (já era, E-01); o resumo vem do servidor. Aceitável; pedir atualização pelo EAS Update |
| App novo × servidor antigo (v1) | sem `paint` na resposta, o app cai no modo atual (barra RP) |
| Fila offline com corridas antigas | pontuam pela regra vigente no servidor na hora do envio |

### 11.5 Ordem de deploy

1. **E9:** migração aditiva + `finish-activity` em **modo sombra** (grava `zone_cells`, mas o dono continua pela v1) por 1–2 semanas, comparando com a simulação.
2. **App (EAS Update):** pintura ao vivo, eventos, textos corrigidos (E-01, E-04, E-18, E-21 a E-24). Funciona com v1 e v2.
3. **Virada na troca de temporada** (01/12 ou 01/01), via `game_config`.
   - Recomendado: cada zona com dono recebe **"herança" de 3 trechos virtuais** do dono (só contagem), que desbotam em 7 dias.
   - Assim ninguém perde tudo na virada e o mapa se renova em 1–3 semanas (D2).
4. Desligar os jobs v1 depois de 1 temporada.

---

## 12. Decisões para o coordenador

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Regra do mapa na v2 | A atual corrigida / B barra / **C pintura** / D pintura + circuito | **C**: única que cumpre justiça, exploração, anti-domínio e defesa (tabela 6.2) |
| D2 | Como virar | reset neutro / herança de 3 trechos / converter influência em trechos | **herança de 3 trechos na virada de temporada** |
| D3 | Pintura visível a terceiros? | rua a rua no mapa público / só zonas / zonas + snapshot sem autor | **só zonas no mapa; rua só na própria corrida; snapshot sem autor e sem zonas de privacidade para a previsão** |
| D4 | O que fazer com RP | apagar / **manter como "pontos" para ranking, liga e cidades** | manter (esforço relativo onde a disputa é entre pessoas) |
| D5 | Raid neste ciclo | demonstração rotulada / **real mínimo** (vida, dano, fases, baú) | real mínimo (E9) + "em breve" até lá; **corrigir já o texto falso** (E-21) |
| D6 | Rabisco e Bandeira | manter cartões / **Bandeira sai, Rabisco "em breve"** / implementar Rabisco | Bandeira sai; Rabisco "em breve" (F4 opcional) |
| D7 | "Reforço na conquista" (evaporação 52% → 42%) | ligar / **deixar como parâmetro desligado** | parâmetro desligado; reavaliar com telemetria |

---

## 13. Tarefas propostas (F3/F4)

| ID | Título | Dono | Pastas | Depende de | Critério de aceite |
|---|---|---|---|---|---|
| T7.E3.1 | Regra "Pintar a cidade" no domain | E3 | `apps/mobile/src/domain/paint.ts`, `__tests__/`, ponte (3 arquivos) | D1 | Funções da seção 11.1. Testes de exemplo (os 3 da seção 7.3) e **de propriedade**: no máx. 1 dono por zona; camadas em 1..3; simetria entre times (trocar os rótulos troca o resultado); passada rival nunca aumenta camada rival; desbotar nunca aumenta; repintar o mesmo trecho na mesma corrida é idempotente; trecho só de passos válidos. Cobertura do domain ≥ 90%; `domain_bridge` verde |
| T7.E3.2 | Eventos ao vivo e previsão incremental | E3 | `domain/live-events.ts`, `run-engine.ts` | T7.E3.1 | `addPoint` emite os eventos da seção 8 com os dados da tabela; O(1) amortizado por ponto (corrige E-12); teste que 15 km a 1 Hz roda em < 200 ms no Node |
| T7.E3.3 | Raid no domain | E3 | `domain/raid.ts` | D5 | Funções da seção 9.7. Propriedades: dano ≥ 0; teto diário respeitado; fase monotônica com a vida; crítico determinístico por id; vida ≥ 500 |
| T7.E3.4 | Correções do domain atual | E3 | `territory.ts`, `run-engine.ts`, `scoring.ts` | — | E-03, E-06, E-07, E-08, E-11 corrigidos com teste de regressão cada; `streakDays` renomeado para `streakUnits` (sem quebrar a assinatura) |
| T7.E3.5 | Fuga justa | E3 (domain) + E6 (tela) + E9 (`validate.ts`) | `domain/games.ts`, `run-screen.tsx`, `_shared/validate.ts` | — | Fantasma derivado do ritmo-base (3 níveis); servidor recusa fantasma fora de ±20% do ritmo-base; bônus vira XP; propriedade: iniciante a 7:15 consegue vencer o nível "Seu ritmo" |
| T7.E3.6 | Liga real (regra) | E3 (domain) + E9 (grupos, job) + E6 (tela) | `domain/league.ts` | D4 | `leaguePoints` e `leagueGroups` puros; teste de que os grupos têm ≤ 30 e volume parecido; a Arena deixa de usar XP total (E-22/E-23) |
| T7.E3.7 | Atlas por bairro | E3 (domain) + E6 + E7 (medalhas) | `domain/games.ts` | — | `districtExploration` com % por distrito res 7; corrige E-14 (mapa sem o corte de 600) |
| T7.E3.8 | Simulação como teste de regressão do balanceamento | E3 + E10 | `docs/melhoria/F1/jogo/sim/` (ou `apps/mobile/scripts/`) | T7.E3.1 | `rodar.ts --rapido` com asserções dos alvos da tabela 6.2 (novato ≥ 50% na 1ª corrida; eternas ≤ 15%; custo ≤ 1,5 km) usando o `paint.ts` real; roda no CI semanal |
| T7.E3.9 | Especificação de contrato para a E9 | E3 → E9 | `docs/melhoria/relatorios/` | T7.E3.1, T7.E3.3 | Diff exato das assinaturas, payload `paint` e `raid` em `finish-activity`, SQL de referência do `job_fade_cells`; E9 confirma |

### Pedidos para outras equipes

| Para | Pedido |
|---|---|
| **E6** | **Correções de texto já na F3:** E-01 (tirar "Conquista garantida"), E-04, E-13 (sem "RP"), E-18, E-19 (chances), E-21 (Raid "Em breve"), E-22 a E-24 (Liga rotulada de verdade), E-26 |
| **E6** | Cartão da zona com barra de duas cores e "faltam N trechos (≈ X m)"; rota grossa na cor do time; "?" com os 3 cartões da seção 7.1 |
| **E5** | Animações por evento (seção 8), ritmo de vibração, inundação de cor na conquista, chefão em 5 estados |
| **E4** | 6 chefões (seção 9.6), baú do chefão, medalhas de chefão e de bairro (Atlas), respingo de tinta no traço Pit Lane Neon |
| **E7** | Missões sobre eventos; XP por trecho e teto da Neblina (tabela 6.6); sequência só semanal, sem efeito no território |
| **E8** | Card de compartilhar com **as ruas pintadas da própria corrida** (respeitando zonas de privacidade) |
| **E9** | Seções 9.7 e 11.2–11.5; modo sombra; `zone_paint_near`; lendário ≥ 1,5 km no `roll_chests` (E-18); limpeza de ataque vencido no job (E-03) |
| **E10** | Teste estático de que nenhuma tela de jogo mostra "RP"; e2e da corrida simulada mostrando `zona_conquistada`; desempenho de `addPoint` |

---

## 14. Riscos e bloqueios

| Risco | Impacto | Mitigação |
|---|---|---|
| Trecho = rota (privacidade) | alto | D3; nunca expor autor nem hora; excluir zonas de privacidade |
| Evaporação ~50% no bairro denso | médio (frustração) | loop de retomada (67% em 7 dias), notificação honesta, D7 como ajuste |
| Custo no servidor (≈ 375 trechos por corrida de 15 km) | médio | upsert em lote com trava por zona; `zone_cells` indexada; modo sombra mede antes |
| Modelo sem "rota escolhida para atacar" | os números do novato podem estar **subestimados** | missão de boas-vindas guiando até a zona fraca/neutra mais próxima (a simulação de rota já existe, D-37) |
| H3 res 11 em avenidas largas (2 trechos lado a lado) | baixo | cada passada conta os trechos tocados; aceitável |
| Corrida offline aplicada fora de ordem | baixo | servidor é a verdade; resumo marca "oficial" |
| Prazo: E9 precisa de tabela + job + function + raid | alto | ordem de deploy em 3 passos; raid mínimo primeiro; textos falsos corrigidos já |
| Mudança de regra sentida como "perdi minhas zonas" | médio | virada na temporada + herança + comunicação "Temporada 2: pinte a cidade" |
| Saúde ("vontade de conquistar aumenta a quilometragem", INTVL) | médio | teto diário de dano no Raid, 1 camada/dia por trecho, nenhuma recompensa por corrida diária |

**Bloqueios:** nenhum para a F1. Para a F3: D1, D2, D3 e D5.

---

## 15. Fontes

- INTVL — [review](https://fueledbylolz.com/2026/06/09/intvl-running-app-review/amp/), [App Store](https://apps.apple.com/app/id6472631698): fechamento de volta frágil, área segurada por ~10 h, "premia geografia e não esforço", aumento rápido de quilometragem.
- Código e números: este repositório (arquivo:linha em cada item) e `jogo/sim/resultados/*.md`.
