/**
 * Raid (chefão da semana) — calibração da vida e do dano com a mesma agenda de corridas.
 * Proposta da E3 (F1): dano = 10 por km válido; ponto fraco ×2; golpe crítico 10% ×2 (chance visível);
 * teto de 300 de dano por corredor por dia; janela segunda 06:00 → domingo 21:00;
 * vida = 0,75 × mediana dos km semanais da cidade nas 4 semanas anteriores × 10, com ajuste ±10%/semana.
 *
 *   npx -y tsx docs/melhoria/F1/jogo/sim/raid.ts
 */
import { montarAgenda, TOTAL_DIAS, type Perfil } from './agentes';
import { mapaBairro271, rng } from './base';

export const RAID = {
  DANO_POR_KM: 10,
  CRITICO_CHANCE: 0.1,
  CRITICO_MULT: 2,
  PONTO_FRACO_MULT: 2,
  PONTOS_FRACOS_POR_DIA: 3,
  TETO_DANO_DIA: 300,
  FRACAO_DA_SEMANA: 0.75,
  VIDA_MIN: 500,
  AJUSTE: 0.1,
  INICIO_H: 6, // segunda 06:00
  FIM_H: 6 * 24 + 21, // domingo 21:00
  MIN_KM_RECOMPENSA: 1,
};

export const fase = (vida: number, max: number) => (vida <= 0 ? 4 : vida / max > 2 / 3 ? 1 : vida / max > 1 / 3 ? 2 : 3);

const g = mapaBairro271();
const { corredores, corridas } = montarAgenda(g, { semente: 1, times: 'equilibrados', densidade: 90 });
const r = rng(4242);
const semanas = Math.floor(TOTAL_DIAS / 7);
const kmSemana: number[] = [];
let fator = 1;
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
console.log('| Semana | Vida | Caiu em | Corredores com recompensa | Maior parte de 1 corredor | Parte média de 1 iniciante | Golpe final |');
console.log('|---:|---:|---|---:|---:|---:|---|');
for (let w = 0; w < semanas; w++) {
  const doW = corridas.filter((c) => Math.floor(c.dia / 7) === w);
  kmSemana.push(doW.reduce((s, c) => s + c.rota.metros, 0) / 1000);
  if (w < 4) continue; // as 4 primeiras semanas só calibram
  const hist = kmSemana.slice(w - 4, w).sort((a, b) => a - b);
  const med = (hist[1] + hist[2]) / 2;
  const max = Math.max(RAID.VIDA_MIN, Math.round(RAID.FRACAO_DA_SEMANA * med * RAID.DANO_POR_KM * fator));
  let vida = max;
  const dano = new Map<number, number>();
  const hoje = new Map<string, number>();
  let caiu: string | null = null;
  let finalizador: Perfil | null = null;
  let fracos = new Set<string>();
  let diaFracos = -1;
  for (const c of doW) {
    const h = (c.dia % 7) * 24 + ((c.agora / 3_600_000) % 24) - 3;
    if (h < RAID.INICIO_H || h > RAID.FIM_H || vida <= 0) continue;
    if (c.dia !== diaFracos) {
      diaFracos = c.dia;
      fracos = new Set(Array.from({ length: RAID.PONTOS_FRACOS_POR_DIA }, () => r.pick(g.zonas)));
    }
    const ph = fase(vida, max);
    const kmFraco = ph >= 2 ? c.rota.zonaMetros.filter(([z]) => fracos.has(z)).reduce((s, [, m]) => s + m, 0) / 1000 : 0;
    const km = c.rota.metros / 1000;
    let d = (km + kmFraco * (RAID.PONTO_FRACO_MULT - 1)) * RAID.DANO_POR_KM;
    if (r.next() < RAID.CRITICO_CHANCE) d *= RAID.CRITICO_MULT;
    const key = `${c.corredor}|${c.dia}`;
    d = Math.min(d, RAID.TETO_DANO_DIA - (hoje.get(key) ?? 0));
    if (d <= 0) continue;
    hoje.set(key, (hoje.get(key) ?? 0) + d);
    dano.set(c.corredor, (dano.get(c.corredor) ?? 0) + d);
    vida -= d;
    if (vida <= 0) {
      caiu = `${DIAS[c.dia % 7]} ${Math.floor(h % 24)}h`;
      finalizador = corredores[c.corredor].perfil;
    }
  }
  const total = [...dano.values()].reduce((s, x) => s + x, 0);
  const ativos = new Set(doW.map((c) => c.corredor)).size;
  const elegiveis = [...dano.values()].filter((x) => x >= RAID.MIN_KM_RECOMPENSA * RAID.DANO_POR_KM).length;
  const ini = [...dano].filter(([k]) => corredores[k].perfil === 'iniciante').map(([, x]) => x / total);
  console.log(
    `| ${w - 3} | ${max} | ${caiu ?? 'fugiu'} | ${((100 * elegiveis) / ativos).toFixed(0)}% | ${((100 * Math.max(...dano.values())) / total).toFixed(1)}% | ${((100 * ini.reduce((a, b) => a + b, 0)) / (ini.length || 1)).toFixed(2)}% | ${finalizador ?? '—'} |`,
  );
  // ajuste dinâmico: caiu antes de sábado → +10%; fugiu → −10%
  const diaQueda = caiu ? DIAS.indexOf(caiu.split(' ')[0]) : 7;
  fator = Math.min(1.5, Math.max(0.7, fator + (diaQueda < 5 ? RAID.AJUSTE : diaQueda === 7 ? -RAID.AJUSTE : 0)));
}
