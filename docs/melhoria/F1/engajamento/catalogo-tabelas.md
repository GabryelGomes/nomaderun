<!-- Gerado por: npx -y tsx docs/melhoria/F1/engajamento/catalogo.ts --tabelas (2026-10-23). Não edite à mão. -->

| id | Cadência | Nível | Texto (≤ 40) | Car. | Meta | XP | Extra | Validação no servidor |
|---|---|---|---|---|---|---|---|---|
| `d-mover-15` | diaria | leve | Mova-se 15 min (caminhar vale) | 30 | ≥ 15 min de movimento válido em atividades do dia | 20 | — | soma de movingSeconds das atividades válidas/parciais do dia ≥ 900 |
| `d-1500m` | diaria | leve | Caminhe ou corra 1,5 km | 23 | ≥ 1.500 m válidos no dia | 20 | — | soma de meters (trechos válidos) do dia ≥ 1500 |
| `d-neblina-5` | diaria | leve | Revele 5 trechos novos da Neblina | 33 | ≥ 5 células novas de neblina no dia | 20 | — | soma de newFogCells do dia ≥ 5 |
| `d-km` | diaria | padrao | Corra {x} km hoje | 17 | alvo = mediana das últimas 10 corridas, arredondada a 0,5 km, entre 2 e 8 km | 30 | — | soma de meters do dia ≥ alvo gravado na atribuição |
| `d-pintar-3` | diaria | padrao | Pinte 3 zonas com a cor do time | 31 | ≥ 3 zonas distintas com pontos de território > 0 | 30 | — | count(distinct zone_id) em activity_zones do dia com rp > 0 ≥ 3 |
| `d-caca-2` | diaria | padrao | Abra 2 baús na Caça | 19 | ≥ 2 baús da Caça abertos no dia | 30 | — | count(chest_opens) do dia ≥ 2 |
| `d-fantasma` | diaria | padrao | Termine à frente do fantasma | 28 | uma Fuga com beatGhost = true | 30 | — | atividade do dia com mission = fuga e result.beatGhost = true |
| `d-conquistar` | diaria | desafio | Conquiste uma zona | 18 | ≥ 1 zona com outcome = conquered | 40 | — | activity_zones do dia com outcome = conquered ≥ 1 |
| `d-defender` | diaria | desafio | Defenda uma zona sob ataque | 27 | ≥ 1 zona com outcome = defended | 40 | — | activity_zones do dia com outcome = defended ≥ 1 (só sorteada se o time tem zona sob ataque a ≤ 3 km) |
| `d-crew` | diaria | desafio | Corra junto com alguém da crew | 30 | uma atividade com bônus de grupo | 40 | — | result.group não nulo (M_grupo, RN-001); só sorteada para quem tem crew |
| `d-neblina-20` | diaria | desafio | Revele 20 trechos novos da cidade | 33 | ≥ 20 células novas de neblina no dia | 40 | — | soma de newFogCells do dia ≥ 20 |
| `s-2-atividades` | semanal | leve | Faça 2 atividades na semana | 27 | 2 atividades pontuadas (a mesma meta da sequência) | 100 | — | count(activities scored) na semana ≥ 2 |
| `s-60-min` | semanal | leve | Some 60 minutos de movimento | 28 | ≥ 3.600 s de movimento válido na semana | 100 | — | soma de movingSeconds na semana ≥ 3600 |
| `s-km` | semanal | padrao | Some {x} km na semana | 20 | alvo = 90% da mediana semanal das últimas 4 semanas, nunca acima de +10% da maior delas; 6 a 40 km | 150 | — | soma de meters na semana ≥ alvo gravado |
| `s-pintar-10` | semanal | padrao | Pinte 10 zonas diferentes | 25 | ≥ 10 zonas distintas com pontos > 0 | 150 | — | count(distinct zone_id) com rp > 0 na semana ≥ 10 |
| `s-bairros-2` | semanal | padrao | Corra em 2 bairros diferentes | 29 | zonas em ≥ 2 distritos (H3 res. 7) | 150 | — | count(distinct districtOf(zone_id)) na semana ≥ 2 |
| `s-conquistar-3` | semanal | desafio | Conquiste 3 zonas na semana | 27 | ≥ 3 zonas com outcome = conquered | 200 | — | activity_zones da semana com outcome = conquered ≥ 3 |
| `s-chefao` | semanal | desafio | Cause {x} km de dano no chefão | 29 | alvo = 50% do alvo semanal de km; só com raid real ativo | 200 | — | soma do dano da pessoa no raid da semana ≥ alvo (tabela de raid da E9) |
| `s-crew-2` | semanal | desafio | Corra 2 vezes com a sua crew | 28 | 2 atividades com bônus de grupo | 200 | — | count(activities com result.group) na semana ≥ 2 |
| `f1-dominio` | ftue | leve | Corra 500 m e pinte sua 1ª zona | 31 | ≥ 500 m válidos com pontos numa zona | 100 | baú do dia raro garantido | primeira atividade com meters ≥ 500 e alguma zona com rp > 0 |
| `f2-caca` | ftue | leve | Abra seu primeiro baú na Caça | 29 | 1 baú da Caça aberto | 40 | — | count(chest_opens) ≥ 1 depois da liberação do passo |
| `f3-fuga` | ftue | leve | Vença o fantasma em 1 km | 24 | Fuga com ≥ 1 km e beatGhost = true (ritmo escolhido pela pessoa) | 40 | — | atividade mission = fuga, meters ≥ 1000, beatGhost = true |
| `f4-raid` | ftue | leve | Cause 1 km de dano no chefão | 28 | 1 km válido durante um raid real | 40 | sem raid real: "Revele 10 trechos da Neblina" | dano no raid ≥ 1 km; fallback: newFogCells ≥ 10 |
| `f5-crew` | ftue | leve | Entre numa crew ou crie a sua | 29 | ser membro de uma crew | 60 | — | existe linha em crew_members da pessoa (não precisa correr) |
| `f6-liga` | ftue | leve | Some seus primeiros pontos na liga | 34 | 1 atividade contando na liga da semana | 60 | sem liga real: "Veja o ranking do seu time" | pontos de liga da semana > 0 (grupo da E9); fallback: evento ranking_opened |
| `f7-compartilhar` | ftue | leve | Compartilhe o card de uma corrida | 33 | concluir o compartilhamento de um card | 60 | moldura "Primeira Semana" | RPC record_share(activity_id) depois do share sheet (declarado pelo app; só cosmético, 1 por dia) |
| `v-7` | volta | leve | Volta leve: 10 minutos já contam | 32 | ≥ 10 min de movimento | 50 | baú do dia raro garantido | movingSeconds ≥ 600 na primeira atividade depois de 7+ dias |
| `v-14` | volta | leve | Caminhe 1 km no seu ritmo | 25 | ≥ 1 km válido | 60 | baú do dia raro garantido | meters ≥ 1000 na primeira atividade depois de 14+ dias |
| `v-30` | volta | leve | Recomece: 10 minutos, sem pressa | 32 | ≥ 10 min de movimento | 80 | baú lendário garantido + sequência recomeça com 1 semana | movingSeconds ≥ 600 na primeira atividade depois de 30+ dias |

| id | Orçamento | Gatilho verdadeiro | Limite | Janela (BRT) | Texto (≤ 60) | Car. | Preferência | Entrega |
|---|---|---|---|---|---|---|---|---|
| `n-chefao` | engajamento | raid real com vida < 15% e termina em < 24 h; a pessoa causou dano nesse raid | 1 por raid | 8h–21h | O chefão está com {x}% de vida. Sua corrida conta! | 49 | `raid` | servidor |
| `n-liga` | engajamento | domingo, liga real, a pessoa está a ≤ 2 posições da linha de subir | 1 por semana | domingo 10h | A liga fecha hoje: você está a {x} posições de subir. | 51 | `league` | servidor |
| `n-sequencia` | engajamento | sábado, exatamente 1 de 2 atividades na semana | 1 por semana | sábado, 1 h antes do horário habitual (8h–19h) | Falta 1 atividade para garantir a semana. Caminhar vale! | 56 | `streak` | local |
| `n-missao` | engajamento | missão semanal ≥ 70% e ainda aberta; sexta ou sábado | 1 por semana | 1 h antes do horário habitual (8h–19h) | Faltam {x} km para a missão da semana. | 39 | `missions` | local |
| `n-bau` | engajamento | 3 baús do dia guardados (o máximo) e nenhuma atividade hoje | 1 por semana | 1 h antes do horário habitual (8h–19h) | Seus 3 baús do dia estão guardados. Uma corrida abre todos. | 59 | `chests` | local |
| `n-ftue` | engajamento | passo da primeira semana liberado e ainda não feito | 1 por passo; só nos 14 primeiros dias | 9h | Passo {x} de 7 liberado: {passo}. | 57 | `missions` | local |
| `n-recap` | engajamento | segunda, a pessoa teve ≥ 1 atividade na semana anterior | 1 por semana | segunda 8h | Sua semana: {x} km e {y} zonas pintadas. Veja o recap. | 55 | `recap` | local |
| `n-temporada` | engajamento | dia 1 do mês (temporada nova aberta pelo job) | 1 por mês | dia 1, 9h | Temporada de {mês} começou: trilha nova e troca de time. | 60 | `season` | local |
| `n-volta-7` | engajamento | 7 dias sem atividade (e sem pausa de saúde ligada) | 1 vez por ausência | horário habitual (8h–19h) | Sua missão de volta está pronta: 10 minutos já contam. | 54 | `comeback` | local |
| `n-volta-14` | engajamento | 14 dias sem atividade; texto da zona só se uma zona onde a pessoa correu está mesmo sob ataque | 1 vez por ausência | horário habitual (8h–19h) | Baú raro garantido na sua próxima atividade. Sem pressa. | 56 | `comeback` | local |
| `n-volta-14-zona` | engajamento | variante do 14 dias: zona onde a pessoa correu em 30 dias está sob ataque agora | substitui o anterior | horário habitual (8h–19h) | {zona} está sob ataque. Bora defender? | 52 | `comeback` | servidor |
| `n-volta-21` | engajamento | 21 dias sem atividade: oferece a pausa de saúde (lesão, viagem, descanso) | 1 vez por ausência | horário habitual (8h–19h) | Precisa de uma pausa? Sua sequência fica guardada. | 50 | `comeback` | local |
| `n-volta-30` | engajamento | 30 dias sem atividade; depois disso, silêncio total até a pessoa voltar | 1 vez por ausência (último aviso) | horário habitual (8h–19h) | Quando quiser voltar, tem um baú lendário te esperando. | 55 | `comeback` | local |
| `n-invasao` | jogo | já existe: rival passou de 50% numa zona do time onde a pessoa correu em 30 dias | já existe: 1 por zona a cada 6 h, 5 por dia | novo: 7h–22h; fora disso só na central | Alerta de invasão! {zona} está sob ataque. | 56 | `invasions` | servidor |
| `n-conquista` | jogo | já existe: zona conquistada no finish-activity | novo: agrupar numa só por corrida | imediato (a pessoa acabou de correr) | Você conquistou {x} zonas para o seu time! | 41 | `conquests` | servidor |

OK: 29 missões e 15 notificações dentro dos limites.
