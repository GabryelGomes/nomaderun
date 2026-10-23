/**
 * NOMADE RUN — Reformulação v2, F1, Equipe E7.
 * Catálogo de missões e notificações (rascunho do futuro `src/domain/missions.ts` e `reminders.ts`).
 *
 *   npx -y tsx docs/melhoria/F1/engajamento/catalogo.ts          # confere limites e imprime as tabelas
 *
 * Regras conferidas: missão ≤ 40 caracteres, notificação ≤ 60, ids únicos, cada cadência com opção leve,
 * nenhuma palavra de culpa. `{x}` e `{zona}` são trocados pelo valor real (o limite vale com o maior valor;
 * nome de zona com mais de 22 caracteres é cortado com reticências).
 */

export type Cadence = 'diaria' | 'semanal' | 'ftue' | 'volta';
export type Tier = 'leve' | 'padrao' | 'desafio';

export type Mission = {
  id: string;
  cadence: Cadence;
  tier: Tier;
  /** Texto final (≤ 40). `{x}` = alvo calculado. */
  text: string;
  /** Maior texto possível depois da troca de `{x}` (usado na conferência). */
  longest?: string;
  goal: string;
  xp: number;
  extra?: string;
  /** Como o servidor confere (campos do resultado oficial do finish-activity ou tabelas). */
  check: string;
};

export const MISSIONS: Mission[] = [
  // ---------- Diárias (sorteio: 1 leve + 1 padrão + 1 desafio por dia; trocar 1 por dia) ----------
  { id: 'd-mover-15', cadence: 'diaria', tier: 'leve', text: 'Mova-se 15 min (caminhar vale)', goal: '≥ 15 min de movimento válido em atividades do dia', xp: 20, check: 'soma de movingSeconds das atividades válidas/parciais do dia ≥ 900' },
  { id: 'd-1500m', cadence: 'diaria', tier: 'leve', text: 'Caminhe ou corra 1,5 km', goal: '≥ 1.500 m válidos no dia', xp: 20, check: 'soma de meters (trechos válidos) do dia ≥ 1500' },
  { id: 'd-neblina-5', cadence: 'diaria', tier: 'leve', text: 'Revele 5 trechos novos da Neblina', goal: '≥ 5 células novas de neblina no dia', xp: 20, check: 'soma de newFogCells do dia ≥ 5' },
  { id: 'd-km', cadence: 'diaria', tier: 'padrao', text: 'Corra {x} km hoje', longest: 'Corra 8,5 km hoje', goal: 'alvo = mediana das últimas 10 corridas, arredondada a 0,5 km, entre 2 e 8 km', xp: 30, check: 'soma de meters do dia ≥ alvo gravado na atribuição' },
  { id: 'd-pintar-3', cadence: 'diaria', tier: 'padrao', text: 'Pinte 3 zonas com a cor do time', goal: '≥ 3 zonas distintas com pontos de território > 0', xp: 30, check: 'count(distinct zone_id) em activity_zones do dia com rp > 0 ≥ 3' },
  { id: 'd-caca-2', cadence: 'diaria', tier: 'padrao', text: 'Abra 2 baús na Caça', goal: '≥ 2 baús da Caça abertos no dia', xp: 30, check: 'count(chest_opens) do dia ≥ 2' },
  { id: 'd-fantasma', cadence: 'diaria', tier: 'padrao', text: 'Termine à frente do fantasma', goal: 'uma Fuga com beatGhost = true', xp: 30, check: 'atividade do dia com mission = fuga e result.beatGhost = true' },
  { id: 'd-conquistar', cadence: 'diaria', tier: 'desafio', text: 'Conquiste uma zona', goal: '≥ 1 zona com outcome = conquered', xp: 40, check: 'activity_zones do dia com outcome = conquered ≥ 1' },
  { id: 'd-defender', cadence: 'diaria', tier: 'desafio', text: 'Defenda uma zona sob ataque', goal: '≥ 1 zona com outcome = defended', xp: 40, check: 'activity_zones do dia com outcome = defended ≥ 1 (só sorteada se o time tem zona sob ataque a ≤ 3 km)' },
  { id: 'd-crew', cadence: 'diaria', tier: 'desafio', text: 'Corra junto com alguém da crew', goal: 'uma atividade com bônus de grupo', xp: 40, check: 'result.group não nulo (M_grupo, RN-001); só sorteada para quem tem crew' },
  { id: 'd-neblina-20', cadence: 'diaria', tier: 'desafio', text: 'Revele 20 trechos novos da cidade', goal: '≥ 20 células novas de neblina no dia', xp: 40, check: 'soma de newFogCells do dia ≥ 20' },

  // ---------- Semanais (segunda 00:00 a domingo 23:59 BRT; 1 leve + 1 padrão + 1 desafio) ----------
  { id: 's-2-atividades', cadence: 'semanal', tier: 'leve', text: 'Faça 2 atividades na semana', goal: '2 atividades pontuadas (a mesma meta da sequência)', xp: 100, check: 'count(activities scored) na semana ≥ 2' },
  { id: 's-60-min', cadence: 'semanal', tier: 'leve', text: 'Some 60 minutos de movimento', goal: '≥ 3.600 s de movimento válido na semana', xp: 100, check: 'soma de movingSeconds na semana ≥ 3600' },
  { id: 's-km', cadence: 'semanal', tier: 'padrao', text: 'Some {x} km na semana', longest: 'Some 40 km na semana', goal: 'alvo = 90% da mediana semanal das últimas 4 semanas, nunca acima de +10% da maior delas; 6 a 40 km', xp: 150, check: 'soma de meters na semana ≥ alvo gravado' },
  { id: 's-pintar-10', cadence: 'semanal', tier: 'padrao', text: 'Pinte 10 zonas diferentes', goal: '≥ 10 zonas distintas com pontos > 0', xp: 150, check: 'count(distinct zone_id) com rp > 0 na semana ≥ 10' },
  { id: 's-bairros-2', cadence: 'semanal', tier: 'padrao', text: 'Corra em 2 bairros diferentes', goal: 'zonas em ≥ 2 distritos (H3 res. 7)', xp: 150, check: 'count(distinct districtOf(zone_id)) na semana ≥ 2' },
  { id: 's-conquistar-3', cadence: 'semanal', tier: 'desafio', text: 'Conquiste 3 zonas na semana', goal: '≥ 3 zonas com outcome = conquered', xp: 200, check: 'activity_zones da semana com outcome = conquered ≥ 3' },
  { id: 's-chefao', cadence: 'semanal', tier: 'desafio', text: 'Cause {x} km de dano no chefão', longest: 'Cause 15 km de dano no chefão', goal: 'alvo = 50% do alvo semanal de km; só com raid real ativo', xp: 200, check: 'soma do dano da pessoa no raid da semana ≥ alvo (tabela de raid da E9)' },
  { id: 's-crew-2', cadence: 'semanal', tier: 'desafio', text: 'Corra 2 vezes com a sua crew', goal: '2 atividades com bônus de grupo', xp: 200, check: 'count(activities com result.group) na semana ≥ 2' },

  // ---------- Primeira semana (FTUE): um passo libera por dia, nunca expira ----------
  { id: 'f1-dominio', cadence: 'ftue', tier: 'leve', text: 'Corra 500 m e pinte sua 1ª zona', goal: '≥ 500 m válidos com pontos numa zona', xp: 100, extra: 'baú do dia raro garantido', check: 'primeira atividade com meters ≥ 500 e alguma zona com rp > 0' },
  { id: 'f2-caca', cadence: 'ftue', tier: 'leve', text: 'Abra seu primeiro baú na Caça', goal: '1 baú da Caça aberto', xp: 40, check: 'count(chest_opens) ≥ 1 depois da liberação do passo' },
  { id: 'f3-fuga', cadence: 'ftue', tier: 'leve', text: 'Vença o fantasma em 1 km', goal: 'Fuga com ≥ 1 km e beatGhost = true (ritmo escolhido pela pessoa)', xp: 40, check: 'atividade mission = fuga, meters ≥ 1000, beatGhost = true' },
  { id: 'f4-raid', cadence: 'ftue', tier: 'leve', text: 'Cause 1 km de dano no chefão', goal: '1 km válido durante um raid real', xp: 40, extra: 'sem raid real: "Revele 10 trechos da Neblina"', check: 'dano no raid ≥ 1 km; fallback: newFogCells ≥ 10' },
  { id: 'f5-crew', cadence: 'ftue', tier: 'leve', text: 'Entre numa crew ou crie a sua', goal: 'ser membro de uma crew', xp: 60, check: 'existe linha em crew_members da pessoa (não precisa correr)' },
  { id: 'f6-liga', cadence: 'ftue', tier: 'leve', text: 'Some seus primeiros pontos na liga', goal: '1 atividade contando na liga da semana', xp: 60, extra: 'sem liga real: "Veja o ranking do seu time"', check: 'pontos de liga da semana > 0 (grupo da E9); fallback: evento ranking_opened' },
  { id: 'f7-compartilhar', cadence: 'ftue', tier: 'leve', text: 'Compartilhe o card de uma corrida', goal: 'concluir o compartilhamento de um card', xp: 60, extra: 'moldura "Primeira Semana"', check: 'RPC record_share(activity_id) depois do share sheet (declarado pelo app; só cosmético, 1 por dia)' },

  // ---------- Volta depois de sumir (7, 14, 30 dias sem atividade) ----------
  { id: 'v-7', cadence: 'volta', tier: 'leve', text: 'Volta leve: 10 minutos já contam', goal: '≥ 10 min de movimento', xp: 50, extra: 'baú do dia raro garantido', check: 'movingSeconds ≥ 600 na primeira atividade depois de 7+ dias' },
  { id: 'v-14', cadence: 'volta', tier: 'leve', text: 'Caminhe 1 km no seu ritmo', goal: '≥ 1 km válido', xp: 60, extra: 'baú do dia raro garantido', check: 'meters ≥ 1000 na primeira atividade depois de 14+ dias' },
  { id: 'v-30', cadence: 'volta', tier: 'leve', text: 'Recomece: 10 minutos, sem pressa', goal: '≥ 10 min de movimento', xp: 80, extra: 'baú lendário garantido + sequência recomeça com 1 semana', check: 'movingSeconds ≥ 600 na primeira atividade depois de 30+ dias' },
];

export type NotificationKind =
  | 'bau' | 'sequencia' | 'liga' | 'missao' | 'chefao' | 'temporada' | 'recap' | 'ftue' | 'volta'
  | 'invasao' | 'conquista' | 'moderacao';

export type Notif = {
  id: string;
  kind: NotificationKind;
  /** engajamento = entra no orçamento de 1/dia; jogo = alerta real com limite próprio. */
  budget: 'engajamento' | 'jogo';
  trigger: string;
  limit: string;
  window: string;
  text: string;
  longest?: string;
  pref: string;
  delivery: 'local' | 'servidor';
};

export const NOTIFICATIONS: Notif[] = [
  { id: 'n-chefao', kind: 'chefao', budget: 'engajamento', trigger: 'raid real com vida < 15% e termina em < 24 h; a pessoa causou dano nesse raid', limit: '1 por raid', window: '8h–21h', text: 'O chefão está com {x}% de vida. Sua corrida conta!', longest: 'O chefão está com 14% de vida. Sua corrida conta!', pref: 'raid', delivery: 'servidor' },
  { id: 'n-liga', kind: 'liga', budget: 'engajamento', trigger: 'domingo, liga real, a pessoa está a ≤ 2 posições da linha de subir', limit: '1 por semana', window: 'domingo 10h', text: 'A liga fecha hoje: você está a {x} posições de subir.', longest: 'A liga fecha hoje: você está a 2 posições de subir.', pref: 'league', delivery: 'servidor' },
  { id: 'n-sequencia', kind: 'sequencia', budget: 'engajamento', trigger: 'sábado, exatamente 1 de 2 atividades na semana', limit: '1 por semana', window: 'sábado, 1 h antes do horário habitual (8h–19h)', text: 'Falta 1 atividade para garantir a semana. Caminhar vale!', pref: 'streak', delivery: 'local' },
  { id: 'n-missao', kind: 'missao', budget: 'engajamento', trigger: 'missão semanal ≥ 70% e ainda aberta; sexta ou sábado', limit: '1 por semana', window: '1 h antes do horário habitual (8h–19h)', text: 'Faltam {x} km para a missão da semana.', longest: 'Faltam 12,5 km para a missão da semana.', pref: 'missions', delivery: 'local' },
  { id: 'n-bau', kind: 'bau', budget: 'engajamento', trigger: '3 baús do dia guardados (o máximo) e nenhuma atividade hoje', limit: '1 por semana', window: '1 h antes do horário habitual (8h–19h)', text: 'Seus 3 baús do dia estão guardados. Uma corrida abre todos.', pref: 'chests', delivery: 'local' },
  { id: 'n-ftue', kind: 'ftue', budget: 'engajamento', trigger: 'passo da primeira semana liberado e ainda não feito', limit: '1 por passo; só nos 14 primeiros dias', window: '9h', text: 'Passo {x} de 7 liberado: {passo}.', longest: 'Passo 7 de 7 liberado: compartilhe o card de uma corrida.', pref: 'missions', delivery: 'local' },
  { id: 'n-recap', kind: 'recap', budget: 'engajamento', trigger: 'segunda, a pessoa teve ≥ 1 atividade na semana anterior', limit: '1 por semana', window: 'segunda 8h', text: 'Sua semana: {x} km e {y} zonas pintadas. Veja o recap.', longest: 'Sua semana: 120,5 km e 99 zonas pintadas. Veja o recap.', pref: 'recap', delivery: 'local' },
  { id: 'n-temporada', kind: 'temporada', budget: 'engajamento', trigger: 'dia 1 do mês (temporada nova aberta pelo job)', limit: '1 por mês', window: 'dia 1, 9h', text: 'Temporada de {mês} começou: trilha nova e troca de time.', longest: 'Temporada de fevereiro começou: trilha nova e troca de time.', pref: 'season', delivery: 'local' },
  { id: 'n-volta-7', kind: 'volta', budget: 'engajamento', trigger: '7 dias sem atividade (e sem pausa de saúde ligada)', limit: '1 vez por ausência', window: 'horário habitual (8h–19h)', text: 'Sua missão de volta está pronta: 10 minutos já contam.', pref: 'comeback', delivery: 'local' },
  { id: 'n-volta-14', kind: 'volta', budget: 'engajamento', trigger: '14 dias sem atividade; texto da zona só se uma zona onde a pessoa correu está mesmo sob ataque', limit: '1 vez por ausência', window: 'horário habitual (8h–19h)', text: 'Baú raro garantido na sua próxima atividade. Sem pressa.', pref: 'comeback', delivery: 'local' },
  { id: 'n-volta-14-zona', kind: 'volta', budget: 'engajamento', trigger: 'variante do 14 dias: zona onde a pessoa correu em 30 dias está sob ataque agora', limit: 'substitui o anterior', window: 'horário habitual (8h–19h)', text: '{zona} está sob ataque. Bora defender?', longest: 'Parque Vaca Brava 12 está sob ataque. Bora defender?', pref: 'comeback', delivery: 'servidor' },
  { id: 'n-volta-21', kind: 'volta', budget: 'engajamento', trigger: '21 dias sem atividade: oferece a pausa de saúde (lesão, viagem, descanso)', limit: '1 vez por ausência', window: 'horário habitual (8h–19h)', text: 'Precisa de uma pausa? Sua sequência fica guardada.', pref: 'comeback', delivery: 'local' },
  { id: 'n-volta-30', kind: 'volta', budget: 'engajamento', trigger: '30 dias sem atividade; depois disso, silêncio total até a pessoa voltar', limit: '1 vez por ausência (último aviso)', window: 'horário habitual (8h–19h)', text: 'Quando quiser voltar, tem um baú lendário te esperando.', pref: 'comeback', delivery: 'local' },
  { id: 'n-invasao', kind: 'invasao', budget: 'jogo', trigger: 'já existe: rival passou de 50% numa zona do time onde a pessoa correu em 30 dias', limit: 'já existe: 1 por zona a cada 6 h, 5 por dia', window: 'novo: 7h–22h; fora disso só na central', text: 'Alerta de invasão! {zona} está sob ataque.', longest: 'Alerta de invasão! Parque Vaca Brava 12 está sob ataque.', pref: 'invasions', delivery: 'servidor' },
  { id: 'n-conquista', kind: 'conquista', budget: 'jogo', trigger: 'já existe: zona conquistada no finish-activity', limit: 'novo: agrupar numa só por corrida', window: 'imediato (a pessoa acabou de correr)', text: 'Você conquistou {x} zonas para o seu time!', longest: 'Você conquistou 12 zonas para o seu time!', pref: 'conquests', delivery: 'servidor' },
];

const GUILT = /(abandon|decepcion|sumiu|esqueceu|perder tudo|última chance|vai perder|não desista|falhou)/i;

function check() {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const m of MISSIONS) {
    if (ids.has(m.id)) errors.push(`id repetido ${m.id}`);
    ids.add(m.id);
    const t = m.longest ?? m.text;
    if (t.length > 40) errors.push(`missão ${m.id} tem ${t.length} caracteres: "${t}"`);
    if (GUILT.test(m.text)) errors.push(`missão ${m.id} com culpa`);
  }
  for (const c of ['diaria', 'semanal'] as const) {
    for (const tier of ['leve', 'padrao', 'desafio'] as const) {
      if (!MISSIONS.some((m) => m.cadence === c && m.tier === tier)) errors.push(`${c} sem opção ${tier}`);
    }
  }
  for (const n of NOTIFICATIONS) {
    if (ids.has(n.id)) errors.push(`id repetido ${n.id}`);
    ids.add(n.id);
    const t = n.longest ?? n.text;
    if (t.length > 60) errors.push(`notificação ${n.id} tem ${t.length} caracteres: "${t}"`);
    if (GUILT.test(n.text)) errors.push(`notificação ${n.id} com culpa`);
  }
  return errors;
}

const errors = check();
if (process.argv.includes('--tabelas')) {
  console.log('| id | Cadência | Nível | Texto (≤ 40) | Car. | Meta | XP | Extra | Validação no servidor |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const m of MISSIONS) console.log(`| \`${m.id}\` | ${m.cadence} | ${m.tier} | ${m.text} | ${(m.longest ?? m.text).length} | ${m.goal} | ${m.xp} | ${m.extra ?? '—'} | ${m.check} |`);
  console.log('\n| id | Orçamento | Gatilho verdadeiro | Limite | Janela (BRT) | Texto (≤ 60) | Car. | Preferência | Entrega |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const n of NOTIFICATIONS) console.log(`| \`${n.id}\` | ${n.budget} | ${n.trigger} | ${n.limit} | ${n.window} | ${n.text} | ${(n.longest ?? n.text).length} | \`${n.pref}\` | ${n.delivery} |`);
}
console.log(errors.length ? `\nFALHOU:\n- ${errors.join('\n- ')}` : `\nOK: ${MISSIONS.length} missões e ${NOTIFICATIONS.length} notificações dentro dos limites.`);
if (errors.length) process.exitCode = 1;
