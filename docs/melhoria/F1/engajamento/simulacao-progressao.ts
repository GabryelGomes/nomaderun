/**
 * NOMADE RUN — Reformulação v2, F1, Equipe E7 (Engajamento e retenção).
 * Simulação de progressão: XP, nível, temporada, baú do dia e cor de corredor para 3 perfis.
 *
 * Como rodar (na raiz do repositório):
 *   npx -y tsx docs/melhoria/F1/engajamento/simulacao-progressao.ts            # resumo em Markdown
 *   npx -y tsx docs/melhoria/F1/engajamento/simulacao-progressao.ts --curvas   # compara curvas candidatas
 *
 * Determinístico: sementes fixas (mulberry32). Usa o domain real para a neblina (`revealFog`)
 * e para a curva atual (`levelFromXp`). As regras PROPOSTAS ficam neste arquivo, como rascunho
 * do futuro `src/domain/progression.ts` (F3/F4); nada aqui é código de produção.
 */
import {
  CHEST_XP,
  FOG_XP_PER_CELL,
  levelFromXp as levelFromXpAtual,
  MAX_LEVEL,
  revealFog,
  STREAK_RUNS_PER_WEEK,
  XP_PER_100M,
  type ChestRarity,
} from '../../../../apps/mobile/src/domain/games';
import type { LatLng } from '../../../../apps/mobile/src/domain/types';

/* ---------------- utilidades determinísticas ---------------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

const M_PER_DEG_LAT = 111_320;
function move(p: LatLng, meters: number, headingRad: number): LatLng {
  const dLat = (meters * Math.cos(headingRad)) / M_PER_DEG_LAT;
  const dLng = (meters * Math.sin(headingRad)) / (M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}
function bearing(a: LatLng, b: LatLng): number {
  const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
  const dx = (b.lng - a.lng) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.atan2(dx, dy);
}

/** Percurso em laço a partir de casa: sai num rumo sorteado, vira um pouco a cada 100 m e volta na 2ª metade. */
function route(home: LatLng, km: number, r: () => number): LatLng[] {
  const STEP = 15;
  const total = km * 1000;
  let p = move(home, 150 * r(), 2 * Math.PI * r());
  let h = 2 * Math.PI * r();
  const pts: LatLng[] = [p];
  for (let d = STEP; d <= total; d += STEP) {
    if (d % 105 === 0) h += (gauss(r) * 25 * Math.PI) / 180;
    if (d > total / 2) {
      const back = bearing(p, home);
      h = h + 0.15 * Math.atan2(Math.sin(back - h), Math.cos(back - h));
    }
    p = move(p, STEP, h);
    pts.push(p);
  }
  return pts;
}

/* ---------------- perfis ---------------- */
type Profile = {
  id: 'iniciante' | 'regular' | 'avancado';
  label: string;
  km: number;
  /** Dias da semana com corrida (0 = segunda). */
  days: number[];
  /** Fração das corridas na Caça e na Fuga. */
  huntShare: number;
  ghostShare: number;
  ghostWin: number;
  /** Chance de concluir cada missão diária (leve, padrão, desafio) num dia de corrida. */
  daily: [number, number, number];
  /** Chance de concluir cada missão semanal (leve, padrão, desafio). */
  weekly: [number, number, number];
  seed: number;
};

export const PROFILES: Profile[] = [
  { id: 'iniciante', label: 'Iniciante (3 km, 2×/semana)', km: 3, days: [1, 4], huntShare: 0.25, ghostShare: 0.15, ghostWin: 0.5, daily: [1, 0.6, 0.2], weekly: [1, 0.5, 0.1], seed: 101 },
  { id: 'regular', label: 'Regular (5 km, 4×/semana)', km: 5, days: [0, 2, 4, 5], huntShare: 0.25, ghostShare: 0.2, ghostWin: 0.55, daily: [1, 0.9, 0.5], weekly: [1, 0.9, 0.5], seed: 202 },
  { id: 'avancado', label: 'Avançado (15 km, 6×/semana)', km: 15, days: [0, 1, 2, 3, 4, 5], huntShare: 0.15, ghostShare: 0.2, ghostWin: 0.65, daily: [1, 1, 0.8], weekly: [1, 1, 0.9], seed: 303 },
];

/* ---------------- regras PROPOSTAS (rascunho de progression.ts / missions.ts) ---------------- */
export const PROPOSTA = {
  /** 10 XP por km nos primeiros 5 km do dia, 5 XP/km de 5 a 15 km, 0 depois (teto saudável). */
  xpPerKmFull: 10,
  fullKmPerDay: 5,
  xpPerKmHalf: 5,
  halfKmUntil: 15,
  /** Corrida (ou caminhada) concluída com ≥ 1 km válido: +30 XP, uma vez por dia. */
  runCompleteXp: 30,
  /** Neblina: 2 XP por célula nova, no máximo 60 por corrida (exploração conta, mas não domina). */
  fogXpPerCell: 2,
  fogXpCapPerRun: 60,
  ghostXp: 50,
  /** Semana garantida (2ª corrida válida da semana): +50 XP na hora. */
  weekKeptXp: 50,
  dailyMissionXp: [20, 30, 40] as const,
  weeklyMissionXp: [100, 150, 200] as const,
  /** FTUE: 7 passos, total de 400 XP na primeira semana. */
  ftueXp: [100, 40, 40, 40, 60, 60, 60] as const,
  /** Baú do dia: 1 crédito por dia, guarda até 3, a corrida abre todos. */
  dailyChestMaxStored: 3,
  dailyChestOdds: { comum: 0.7, raro: 0.25, lendario: 0.05 } as Record<ChestRarity, number>,
  dailyChestPity: 20,
  /** XP do baú do dia (menor que o da Caça: o baú do dia é mais cosmético que XP). */
  dailyChestXp: { comum: 15, raro: 40, lendario: 100 } as Record<ChestRarity, number>,
  /** Temporada (mês): 24 degraus de 120 XP da temporada (bronze 8, prata 16, ouro 24); depois, estrelas só de prestígio. */
  seasonStepXp: 120,
  seasonSteps: 24,
};

/** Curva proposta: XP do nível n para n+1. */
export const xpForLevelProposta = (n: number) => Math.round((50 * n ** 1.3) / 10) * 10 + 50;

function levelFrom(totalXp: number, xpFor: (n: number) => number) {
  let level = 1;
  let rest = Math.max(0, totalXp);
  while (level < MAX_LEVEL && rest >= xpFor(level)) {
    rest -= xpFor(level);
    level++;
  }
  return level;
}

export function distanceXp(kmBeforeToday: number, kmRun: number): number {
  const P = PROPOSTA;
  let xp = 0;
  for (let k = 0; k < Math.floor(kmRun * 10); k++) {
    const at = kmBeforeToday + (k + 1) / 10;
    if (at <= P.fullKmPerDay) xp += P.xpPerKmFull / 10;
    else if (at <= P.halfKmUntil) xp += P.xpPerKmHalf / 10;
  }
  return Math.round(xp);
}

function rollRarity(r: () => number): ChestRarity {
  const x = r();
  return x < 0.7 ? 'comum' : x < 0.95 ? 'raro' : 'lendario';
}

/* ---------------- simulação ---------------- */
type Sources = Record<string, number>;
export type SimResult = {
  profile: Profile;
  weeks: number;
  runs: number;
  /** Corrida (índice 1..) e semana em que cada nível foi alcançado. */
  levelAtRunAtual: Map<number, { run: number; week: number }>;
  levelAtRunProposta: Map<number, { run: number; week: number }>;
  xpAtual: number;
  xpProposta: number;
  sourcesAtual: Sources;
  sourcesProposta: Sources;
  weeklyXpAtual: number[];
  weeklyXpProposta: number[];
  seasonSteps: number[];
  seasonXp: number[];
  /** Dia do mês em que fechou os 24 degraus (null = não fechou). */
  goldDays: (number | null)[];
  dailyChests: Record<ChestRarity, number>;
  fogCells: number;
  firstWeekFog: number;
  kmTotal: number;
};

export function simulate(p: Profile, weeks: number, xpFor = xpForLevelProposta): SimResult {
  const r = mulberry32(p.seed);
  const home: LatLng = { lat: -16.6869 + (r() - 0.5) * 0.02, lng: -49.2648 + (r() - 0.5) * 0.02 };
  const revealed = new Set<string>();
  const add = (s: Sources, k: string, v: number) => (s[k] = (s[k] ?? 0) + v);

  const sA: Sources = {};
  const sP: Sources = {};
  let xpA = 0;
  let xpP = 0;
  let runs = 0;
  let kmTotal = 0;
  const lvA = new Map<number, { run: number; week: number }>();
  const lvP = new Map<number, { run: number; week: number }>();
  const weeklyA: number[] = [];
  const weeklyP: number[] = [];
  const seasonXpByMonth = new Map<string, number>();
  const goldDay = new Map<string, number>();
  const chests: Record<ChestRarity, number> = { comum: 0, raro: 0, lendario: 0 };
  let stored = 1; // o 1º dia já tem 1 baú guardado (progresso dotado)
  let sincePity = 0;
  let firstWeekFog = 0;
  const start = Date.UTC(2026, 10, 2); // segunda, 2 nov 2026

  const mark = (week: number) => {
    const a = levelFrom(xpA, (n) => Math.round(100 * n ** 1.5));
    const b = levelFrom(xpP, xpFor);
    for (let l = 2; l <= a; l++) if (!lvA.has(l)) lvA.set(l, { run: runs, week });
    for (let l = 2; l <= b; l++) if (!lvP.has(l)) lvP.set(l, { run: runs, week });
  };

  for (let w = 0; w < weeks; w++) {
    const wA0 = xpA;
    const wP0 = xpP;
    let runsThisWeek = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(start + (w * 7 + d) * 86_400_000);
      const month = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}`;
      const xpPBefore = xpP;
      if (d > 0 || w > 0) stored = Math.min(PROPOSTA.dailyChestMaxStored, stored + 1);
      if (p.days.includes(d)) {
        runs++;
        runsThisWeek++;
        const km = p.km * (0.9 + 0.2 * r());
        kmTotal += km;
        const path = route(home, km, r);
        const fresh = revealFog(path, revealed);
        for (const c of fresh) revealed.add(c);
        if (w === 0) firstWeekFog += fresh.length;
        const hunt = r() < p.huntShare;
        const ghost = !hunt && r() < p.ghostShare;
        const won = ghost && r() < p.ghostWin;
        const huntChests = hunt ? Math.floor(1 + r() * 3) : 0;
        let huntXp = 0;
        for (let i = 0; i < huntChests; i++) huntXp += CHEST_XP[rollRarity(r)];

        // --- regra atual (run-engine.finishRun + baús da Caça) ---
        const aDist = Math.floor((km * 1000) / 100) * XP_PER_100M;
        const aFog = fresh.length * FOG_XP_PER_CELL;
        const aGhost = won ? 50 : 0;
        add(sA, 'distância', aDist);
        add(sA, 'neblina', aFog);
        add(sA, 'fantasma', aGhost);
        add(sA, 'baús da Caça', huntXp);
        xpA += aDist + aFog + aGhost + huntXp;

        // --- regra proposta ---
        const pDist = distanceXp(0, km);
        const pFog = Math.min(PROPOSTA.fogXpCapPerRun, fresh.length * PROPOSTA.fogXpPerCell);
        add(sP, 'distância', pDist);
        add(sP, 'corrida concluída', PROPOSTA.runCompleteXp);
        add(sP, 'neblina', pFog);
        add(sP, 'fantasma', won ? PROPOSTA.ghostXp : 0);
        add(sP, 'baús da Caça', huntXp);
        xpP += pDist + PROPOSTA.runCompleteXp + pFog + (won ? PROPOSTA.ghostXp : 0) + huntXp;
        // baú do dia: abre todos os guardados
        for (let i = 0; i < stored; i++) {
          sincePity++;
          let rar = rollRarity(r);
          if (sincePity >= PROPOSTA.dailyChestPity) rar = 'lendario';
          if (rar === 'lendario') sincePity = 0;
          chests[rar]++;
          add(sP, 'baú do dia', PROPOSTA.dailyChestXp[rar]);
          xpP += PROPOSTA.dailyChestXp[rar];
        }
        stored = 0;
        // missões diárias
        p.daily.forEach((chance, i) => {
          if (r() < chance) {
            add(sP, 'missões diárias', PROPOSTA.dailyMissionXp[i]);
            xpP += PROPOSTA.dailyMissionXp[i];
          }
        });
        if (runsThisWeek === STREAK_RUNS_PER_WEEK) {
          add(sP, 'semana garantida', PROPOSTA.weekKeptXp);
          xpP += PROPOSTA.weekKeptXp;
        }
        // FTUE: na 1ª semana, um passo por dia com corrida + os passos sem corrida (Crew, Compartilhar) no fim
        if (w === 0) {
          const step = runsThisWeek - 1;
          if (step < 4) {
            add(sP, 'primeira semana', PROPOSTA.ftueXp[step]);
            xpP += PROPOSTA.ftueXp[step];
          }
        }
        mark(w + 1);
      }
      if (w === 0 && d === 6) {
        // passos 5–7 (Crew, Liga, Compartilhar) não exigem corrida extra; passos de corrida que faltaram ficam
        const done = Math.min(4, runsThisWeek);
        const rest = PROPOSTA.ftueXp.slice(4).reduce((a, b) => a + b, 0);
        add(sP, 'primeira semana', rest);
        xpP += rest;
        void done;
        mark(1);
      }
      seasonXpByMonth.set(month, (seasonXpByMonth.get(month) ?? 0) + (xpP - xpPBefore));
      if (!goldDay.has(month) && (seasonXpByMonth.get(month) ?? 0) >= PROPOSTA.seasonStepXp * PROPOSTA.seasonSteps) goldDay.set(month, day.getUTCDate());
    }
    // missões semanais (fecham domingo)
    const wPBefore = xpP;
    p.weekly.forEach((chance, i) => {
      if (r() < chance) {
        add(sP, 'missões semanais', PROPOSTA.weeklyMissionXp[i]);
        xpP += PROPOSTA.weeklyMissionXp[i];
      }
    });
    const lastDay = new Date(start + (w * 7 + 6) * 86_400_000);
    const m = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}`;
    seasonXpByMonth.set(m, (seasonXpByMonth.get(m) ?? 0) + (xpP - wPBefore));
    mark(w + 1);
    weeklyA.push(xpA - wA0);
    weeklyP.push(xpP - wP0);
  }

  // meses completos simulados (descarta o último, que pode estar incompleto)
  const months = [...seasonXpByMonth.entries()].slice(0, -1);
  return {
    profile: p,
    weeks,
    runs,
    levelAtRunAtual: lvA,
    levelAtRunProposta: lvP,
    xpAtual: xpA,
    xpProposta: xpP,
    sourcesAtual: sA,
    sourcesProposta: sP,
    weeklyXpAtual: weeklyA,
    weeklyXpProposta: weeklyP,
    seasonXp: months.map(([, v]) => v),
    seasonSteps: months.map(([, v]) => Math.min(PROPOSTA.seasonSteps, Math.floor(v / PROPOSTA.seasonStepXp))),
    goldDays: months.map(([k]) => goldDay.get(k) ?? null),
    dailyChests: chests,
    fogCells: revealed.size,
    firstWeekFog,
    kmTotal,
  };
}

/* ---------------- relatório ---------------- */
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function cell(m: Map<number, { run: number; week: number }>, level: number, weeks: number) {
  const v = m.get(level);
  if (!v) return `não chega em ${weeks} sem.`;
  return `${v.run} ${v.run === 1 ? 'corrida' : 'corridas'} (sem. ${v.week})`;
}

function totalToReach(level: number, xpFor: (n: number) => number) {
  let t = 0;
  for (let n = 1; n < level; n++) t += xpFor(n);
  return t;
}

function main() {
  const WEEKS = 260; // 5 anos
  const args = process.argv.slice(2);
  if (args.includes('--curvas')) {
    const curves: [string, (n: number) => number][] = [
      ['atual 100·n^1,5', (n) => Math.round(100 * n ** 1.5)],
      ['60·n^1,2 + 40', (n) => Math.round((60 * n ** 1.2) / 10) * 10 + 40],
      ['50·n^1,3 + 50 (proposta)', xpForLevelProposta],
      ['80·n^1,1 + 40', (n) => Math.round((80 * n ** 1.1) / 10) * 10 + 40],
    ];
    for (const [name, f] of curves) {
      console.log(`\n### Curva ${name} — XP total p/ nível 5/10/20/30/50: ${[5, 10, 20, 30, 50].map((l) => fmt(totalToReach(l, f))).join(' / ')}`);
      for (const p of PROFILES) {
        const s = simulate(p, WEEKS, f);
        console.log(`- ${p.label}: ` + [5, 10, 20, 30, 50].map((l) => `n${l}: ${cell(s.levelAtRunProposta, l, WEEKS)}`).join(' · '));
      }
    }
    return;
  }

  const sims = PROFILES.map((p) => simulate(p, WEEKS));
  const LEVELS = [2, 5, 10, 20, 30, 40, 50];
  console.log('## Simulação de progressão (sementes 101/202/303, 260 semanas a partir de 2 nov 2026)\n');
  console.log('### Curva ATUAL (xpForLevel = 100·n^1,5; XP = 1/100 m + 10/célula de neblina + 50 fantasma + baús da Caça)\n');
  console.log('| Nível | ' + sims.map((s) => s.profile.label).join(' | ') + ' |');
  console.log('|---|' + sims.map(() => '---').join('|') + '|');
  for (const l of LEVELS) console.log(`| ${l} (${fmt(totalToReach(l, (n) => Math.round(100 * n ** 1.5)))} XP) | ` + sims.map((s) => cell(s.levelAtRunAtual, l, WEEKS)).join(' | ') + ' |');
  console.log('\n### Curva PROPOSTA (xpForLevel = 50·n^1,3 arredondado a 10 + 50; fontes da seção 4.1)\n');
  console.log('| Nível | ' + sims.map((s) => s.profile.label).join(' | ') + ' |');
  console.log('|---|' + sims.map(() => '---').join('|') + '|');
  for (const l of LEVELS) console.log(`| ${l} (${fmt(totalToReach(l, xpForLevelProposta))} XP) | ` + sims.map((s) => cell(s.levelAtRunProposta, l, WEEKS)).join(' | ') + ' |');

  console.log('\n### XP por semana (média)\n');
  console.log('| Perfil | Atual sem. 1 | Atual sem. 2–52 | Proposta sem. 1 | Proposta sem. 2–52 | Proposta ano 2 | Razão avançado/iniciante |');
  console.log('|---|---|---|---|---|---|---|');
  const base = avg(sims[0].weeklyXpProposta.slice(1, 52));
  const baseA = avg(sims[0].weeklyXpAtual.slice(1, 52));
  for (const s of sims) {
    console.log(
      `| ${s.profile.label} | ${fmt(s.weeklyXpAtual[0])} | ${fmt(avg(s.weeklyXpAtual.slice(1, 52)))} | ${fmt(s.weeklyXpProposta[0])} | ${fmt(avg(s.weeklyXpProposta.slice(1, 52)))} | ${fmt(avg(s.weeklyXpProposta.slice(52, 104)))} | atual ${(avg(s.weeklyXpAtual.slice(1, 52)) / baseA).toFixed(1)}× · proposta ${(avg(s.weeklyXpProposta.slice(1, 52)) / base).toFixed(1)}× |`,
    );
  }

  console.log('\n### De onde vem o XP (5 anos)\n');
  for (const s of sims) {
    const share = (src: Sources, tot: number) =>
      Object.entries(src)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${Math.round((100 * v) / tot)}%`)
        .join(', ');
    console.log(`- **${s.profile.label}** — atual: ${share(s.sourcesAtual, s.xpAtual)}. Proposta: ${share(s.sourcesProposta, s.xpProposta)}.`);
    console.log(`  - Neblina: ${fmt(s.firstWeekFog)} células na 1ª semana; ${fmt(s.fogCells)} em 5 anos. Distância total: ${fmt(s.kmTotal)} km.`);
  }

  console.log('\n### Temporada (mês) com 24 degraus de 120 XP (bronze 8, prata 16, ouro 24)\n');
  console.log('| Perfil | XP da temporada (média) | Degraus (média) | Mín.–máx. | Meses com bronze (8) | Prata (16) | Ouro (24) | Dia mediano do ouro |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const s of sims) {
    const st = s.seasonSteps.slice(1); // ignora o 1º mês (FTUE)
    const pct = (k: number) => `${Math.round((100 * st.filter((x) => x >= k).length) / st.length)}%`;
    const gd = s.goldDays.slice(1).filter((x): x is number => x !== null).sort((a, b) => a - b);
    const med = gd.length ? `dia ${gd[Math.floor(gd.length / 2)]}` : '—';
    console.log(`| ${s.profile.label} | ${fmt(avg(s.seasonXp.slice(1)))} | ${avg(st).toFixed(1)} | ${Math.min(...st)}–${Math.max(...st)} | ${pct(8)} | ${pct(16)} | ${pct(24)} | ${med} |`);
  }

  console.log('\n### Baú do dia (5 anos)\n');
  for (const s of sims) {
    const t = s.dailyChests.comum + s.dailyChests.raro + s.dailyChests.lendario;
    console.log(`- ${s.profile.label}: ${fmt(t)} baús (${(t / s.weeks).toFixed(1)}/semana) — comum ${fmt(s.dailyChests.comum)}, raro ${fmt(s.dailyChests.raro)}, lendário ${fmt(s.dailyChests.lendario)}.`);
  }

  console.log('\n### Faixa de corredor (distância total): semanas até cada faixa\n');
  const COLORS: [string, number][] = [
    // Faixas por material/brilho (E1, 01-pesquisa §5): não usam matiz para não confundir com a cor dos times.
    ['Asfalto', 0], ['Bronze', 10], ['Prata', 50], ['Ouro', 150], ['Neon', 400], ['Holográfico', 1000], ['Lenda', 2500], ['Nômade', 5000],
  ];
  console.log('| Faixa | km | ' + PROFILES.map((p) => p.label).join(' | ') + ' |');
  console.log('|---|---|' + PROFILES.map(() => '---').join('|') + '|');
  for (const [name, km] of COLORS) {
    console.log(`| ${name} | ${km} | ` + PROFILES.map((p) => (km === 0 ? 'início' : `${Math.ceil(km / (p.km * p.days.length))} sem.`)).join(' | ') + ' |');
  }
}

main();
