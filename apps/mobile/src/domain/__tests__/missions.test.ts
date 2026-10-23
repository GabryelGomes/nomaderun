import { describe, expect, it } from '@jest/globals';

import {
  comebackAssignment,
  comebackMissionId,
  dailyKmTarget,
  drawMissions,
  formatMissionKm,
  FTUE_STEP_IDS,
  ftueAssignment,
  ftueBarProgress,
  ftueSteps,
  MISSION_CATALOG,
  MISSION_TARGETS,
  MISSION_TEXT_MAX,
  missionById,
  missionProgress,
  missionText,
  missionXpSource,
  raidKmTarget,
  rerollMission,
  resolveMissionTarget,
  settleMission,
  weeklyKmTarget,
  type MissionActivity,
  type MissionAssignment,
  type MissionContext,
  type MissionDef,
  type MissionEvidence,
} from '../missions';
import { brtCalendar } from '../progression';
import { hasGuiltWords } from '../reminders';
import { forAll } from './prop';

/** Ids do catálogo da F1 (`docs/melhoria/F1/engajamento/catalogo.ts`): a E9 grava esses ids no banco. */
const F1_IDS = [
  'd-mover-15', 'd-1500m', 'd-neblina-5', 'd-km', 'd-pintar-3', 'd-caca-2', 'd-fantasma', 'd-conquistar', 'd-defender', 'd-crew', 'd-neblina-20',
  's-2-atividades', 's-60-min', 's-km', 's-pintar-10', 's-bairros-2', 's-conquistar-3', 's-chefao', 's-crew-2',
  'f1-dominio', 'f2-caca', 'f3-fuga', 'f4-raid', 'f5-crew', 'f6-liga', 'f7-compartilhar',
  'v-7', 'v-14', 'v-30',
];

const CTX: MissionContext = {
  userId: 'user-1',
  hasCrew: false,
  zoneUnderAttackNearby: false,
  raidActive: false,
  leagueActive: false,
  recentRunMeters: [5000, 5200, 4800],
  recentWeekMeters: [20_000, 18_000, 22_000, 20_000],
};

const DAY = '2026-10-23';
const NOON = brtCalendar.at(DAY, 12);

function act(over: Partial<MissionActivity> = {}): MissionActivity {
  return {
    id: 'a1',
    endedAt: NOON,
    status: 'valid',
    meters: 0,
    movingSeconds: 0,
    atlasCells: 0,
    zonesPainted: [],
    districts: [],
    conquered: 0,
    defended: 0,
    huntChests: 0,
    beatGhost: null,
    group: false,
    raidMeters: 0,
    ...over,
  };
}

function assignmentFor(def: MissionDef, over: Partial<MissionAssignment> = {}): MissionAssignment {
  return {
    missionId: def.id,
    cadence: def.cadence,
    period: DAY,
    slot: 0,
    target: resolveMissionTarget(def, CTX),
    variant: 'base',
    availableFrom: brtCalendar.at(DAY),
    availableUntil: brtCalendar.at(brtCalendar.addDays(DAY, 1)),
    progress: 0,
    completedAt: null,
    rerolled: false,
    ...over,
  };
}

/** Evidência que cumpre qualquer missão do catálogo. */
const EVERYTHING: MissionEvidence = {
  activities: [
    act({
      id: 'big',
      meters: 60_000,
      movingSeconds: 20_000,
      atlasCells: 50,
      zonesPainted: Array.from({ length: 12 }, (_, i) => `z${i}`),
      districts: ['d1', 'd2', 'd3'],
      conquered: 5,
      defended: 2,
      huntChests: 3,
      beatGhost: true,
      group: true,
      raidMeters: 20_000,
    }),
    act({ id: 'big2', meters: 2000, movingSeconds: 600, group: true, beatGhost: true }),
  ],
  inCrew: true,
  leaguePoints: 40,
  rankingOpenedAt: [NOON],
  sharedAt: [NOON],
};

describe('D-65 — catálogo de missões', () => {
  it('tem exatamente os 29 ids da F1, sem repetição', () => {
    expect(MISSION_CATALOG.map((m) => m.id)).toEqual(F1_IDS);
    expect(new Set(F1_IDS).size).toBe(29);
    expect(MISSION_CATALOG.filter((m) => m.cadence === 'diaria')).toHaveLength(11);
    expect(MISSION_CATALOG.filter((m) => m.cadence === 'semanal')).toHaveLength(8);
    expect(MISSION_CATALOG.filter((m) => m.cadence === 'ftue')).toHaveLength(7);
    expect(MISSION_CATALOG.filter((m) => m.cadence === 'volta')).toHaveLength(3);
  });

  it('diárias e semanais têm os 3 níveis, e sempre há missão leve sem exigência', () => {
    for (const cadence of ['diaria', 'semanal'] as const) {
      for (const tier of ['leve', 'padrao', 'desafio'] as const) {
        expect(MISSION_CATALOG.some((m) => m.cadence === cadence && m.tier === tier && !m.requires)).toBe(true);
      }
      expect(MISSION_CATALOG.filter((m) => m.cadence === cadence && m.tier === 'leve').every((m) => !m.requires)).toBe(true);
    }
  });

  it('XP por nível (20/30/40 e 100/150/200) e primeira semana com 400 XP', () => {
    const xp = { diaria: { leve: 20, padrao: 30, desafio: 40 }, semanal: { leve: 100, padrao: 150, desafio: 200 } };
    for (const m of MISSION_CATALOG) {
      if (m.cadence === 'diaria' || m.cadence === 'semanal') expect(m.xp).toBe(xp[m.cadence][m.tier]);
    }
    expect(FTUE_STEP_IDS.reduce((s, id) => s + (missionById(id)?.xp ?? 0), 0)).toBe(400);
    expect(missionById('nao-existe')).toBeUndefined();
  });

  it('todo texto tem no máximo 40 caracteres com o maior {x} possível, e nenhum tem culpa', () => {
    const kmValues = (min: number, max: number) => Array.from({ length: (max - min) * 2 + 1 }, (_, i) => (min + i / 2) * 1000);
    const targets: Record<string, number[]> = {
      dailyKm: kmValues(MISSION_TARGETS.dailyKm.min, MISSION_TARGETS.dailyKm.max),
      weeklyKm: kmValues(MISSION_TARGETS.weeklyKm.min, MISSION_TARGETS.weeklyKm.max),
      raidKm: kmValues(MISSION_TARGETS.raidKm.min, MISSION_TARGETS.raidKm.max),
    };
    let longest = '';
    for (const m of MISSION_CATALOG) {
      const values = typeof m.target === 'number' ? [m.target] : targets[m.target];
      for (const v of values) {
        for (const variant of m.fallback ? (['base', 'fallback'] as const) : (['base'] as const)) {
          const text = missionText(m, v, variant);
          expect(text).not.toContain('{x}');
          expect(text.length).toBeLessThanOrEqual(MISSION_TEXT_MAX);
          expect(hasGuiltWords(text)).toBe(false);
          if (text.length > longest.length) longest = text;
        }
      }
    }
    expect(longest.length).toBeGreaterThan(30);
  });

  it('glossário D-74: "Atlas" no lugar de "Neblina"', () => {
    expect(MISSION_CATALOG.some((m) => /neblina/i.test(m.text) || /neblina/i.test(m.fallback?.text ?? ''))).toBe(false);
  });

  it('fonte do XP no ledger', () => {
    expect(missionXpSource(missionById('d-km') as MissionDef)).toBe('mission');
    expect(missionXpSource(missionById('f2-caca') as MissionDef)).toBe('ftue');
    expect(missionXpSource(missionById('v-7') as MissionDef)).toBe('comeback');
  });
});

describe('alvos adaptativos', () => {
  it('d-km: mediana das últimas 10, arredondada a 0,5 km, entre 2 e 8 km', () => {
    expect(dailyKmTarget([])).toBe(2000);
    expect(dailyKmTarget([4300, 4700, 5100])).toBe(4500);
    expect(dailyKmTarget([4000, 5000])).toBe(4500);
    expect(dailyKmTarget([12_000, 15_000])).toBe(8000);
    expect(dailyKmTarget([800, Number.NaN, -1])).toBe(2000);
    expect(dailyKmTarget([...Array(10).fill(3000), ...Array(10).fill(9000)])).toBe(3000);
  });

  it('s-km: 90% da mediana de 4 semanas, até +10% da maior, entre 6 e 40 km', () => {
    expect(weeklyKmTarget([])).toBe(6000);
    expect(weeklyKmTarget([20_000, 20_000, 20_000, 20_000])).toBe(18_000);
    expect(weeklyKmTarget([0, 0, 0, 0])).toBe(6000);
    expect(weeklyKmTarget([90_000, 90_000])).toBe(40_000);
    expect(weeklyKmTarget([10_000, 30_000, 50_000, 70_000, 900_000])).toBe(36_000);
  });

  it('propriedade: o alvo semanal nunca passa de +10% da maior semana (acima do piso de 6 km)', () => {
    forAll(
      (r) => Array.from({ length: r.int(1, 4) }, () => r.float(0, 80_000)),
      (weeks) => {
        const t = weeklyKmTarget(weeks);
        expect(t).toBeGreaterThanOrEqual(6000);
        expect(t).toBeLessThanOrEqual(40_000);
        expect(t).toBeLessThanOrEqual(Math.max(6000, Math.max(...weeks) * 1.1 + 250));
      },
    );
  });

  it('s-chefao: metade do alvo semanal, entre 1 e 15 km', () => {
    expect(raidKmTarget(6000)).toBe(3000);
    expect(raidKmTarget(40_000)).toBe(15_000);
    expect(raidKmTarget(1000)).toBe(1000);
    expect(resolveMissionTarget(missionById('s-chefao') as MissionDef, CTX)).toBe(9000);
  });

  it('texto com o alvo em km no padrão brasileiro', () => {
    expect(formatMissionKm(8500)).toBe('8,5');
    expect(formatMissionKm(8000)).toBe('8');
    expect(missionText(missionById('d-km') as MissionDef, 8500)).toBe('Corra 8,5 km hoje');
    expect(missionText(missionById('f4-raid') as MissionDef, 10, 'fallback')).toBe('Revele 10 trechos do Atlas');
    expect(missionText(missionById('d-mover-15') as MissionDef, 900, 'fallback')).toBe('Mova-se 15 min (caminhar vale)');
  });
});

describe('sorteio por semente', () => {
  it('3 diárias (leve, padrão, desafio) na janela do dia, e o mesmo resultado para a mesma pessoa e dia', () => {
    const a = drawMissions(CTX, 'diaria', DAY);
    expect(a).toHaveLength(3);
    expect(a.map((m) => missionById(m.missionId)?.tier)).toEqual(['leve', 'padrao', 'desafio']);
    expect(a.map((m) => m.slot)).toEqual([0, 1, 2]);
    expect(a.every((m) => m.period === DAY && m.availableFrom === brtCalendar.at(DAY) && m.availableUntil === brtCalendar.at('2026-10-24'))).toBe(true);
    expect(drawMissions(CTX, 'diaria', DAY)).toEqual(a);
  });

  it('3 semanais com período ISO; qualquer dia da semana dá o mesmo sorteio', () => {
    const w = drawMissions(CTX, 'semanal', DAY);
    expect(w).toHaveLength(3);
    expect(w[0].period).toBe('2026-W43');
    expect(w[0].availableFrom).toBe(brtCalendar.at('2026-10-19'));
    expect(w[0].availableUntil).toBe(brtCalendar.at('2026-10-26'));
    expect(drawMissions(CTX, 'semanal', '2026-10-25')).toEqual(w);
  });

  it('propriedade: sempre 1 leve, 1 de cada nível, e nunca missão impossível para a pessoa', () => {
    forAll(
      (r) => ({
        ctx: { ...CTX, userId: `u${r.int(1, 1e9)}`, hasCrew: r.bool(), zoneUnderAttackNearby: r.bool(), raidActive: r.bool() },
        day: brtCalendar.addDays('2026-01-01', r.int(0, 700)),
        cadence: r.pick(['diaria', 'semanal'] as const),
      }),
      ({ ctx, day, cadence }) => {
        const drawn = drawMissions(ctx, cadence, day);
        const defs = drawn.map((d) => missionById(d.missionId) as MissionDef);
        expect(defs.map((d) => d.tier)).toEqual(['leve', 'padrao', 'desafio']);
        expect(defs.every((d) => d.cadence === cadence)).toBe(true);
        for (const d of defs) {
          if (d.requires === 'crew') expect(ctx.hasCrew).toBe(true);
          if (d.requires === 'raid') expect(ctx.raidActive).toBe(true);
          if (d.requires === 'zoneUnderAttack') expect(ctx.zoneUnderAttackNearby).toBe(true);
        }
      },
    );
  });

  it('o sorteio varia entre pessoas e dias (não é sempre a mesma missão)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(drawMissions({ ...CTX, userId: `u${i}` }, 'diaria', DAY)[1].missionId);
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe('troca de 1 missão por dia', () => {
  const current = drawMissions(CTX, 'diaria', DAY);

  it('troca por outra do mesmo nível que não está na lista, de forma reproduzível', () => {
    const out = rerollMission(CTX, current, 0, 0);
    if (!out.ok) throw new Error(out.reason);
    expect(out.assignment.rerolled).toBe(true);
    expect(out.assignment.slot).toBe(0);
    expect(out.assignment.missionId).not.toBe(current[0].missionId);
    expect(missionById(out.assignment.missionId)?.tier).toBe('leve');
    expect(out.assignment.availableFrom).toBe(current[0].availableFrom);
    expect(rerollMission(CTX, current, 0, 0)).toEqual(out);
  });

  it('recusa: limite do dia, missão concluída, sem opção, slot inexistente e missão semanal', () => {
    expect(rerollMission(CTX, current, 0, 1)).toEqual({ ok: false, reason: 'limit' });
    const done = current.map((a) => (a.slot === 1 ? { ...a, completedAt: NOON } : a));
    expect(rerollMission(CTX, done, 1, 0)).toEqual({ ok: false, reason: 'completed' });
    const leves = MISSION_CATALOG.filter((m) => m.cadence === 'diaria' && m.tier === 'leve').map((m, i) => assignmentFor(m, { slot: i === 0 ? 0 : 10 + i }));
    expect(rerollMission(CTX, leves, 0, 0)).toEqual({ ok: false, reason: 'no_option' });
    expect(rerollMission(CTX, current, 7, 0)).toEqual({ ok: false, reason: 'slot' });
    const weekly = drawMissions(CTX, 'semanal', DAY);
    expect(rerollMission(CTX, weekly, 0, 0)).toEqual({ ok: false, reason: 'cadence' });
  });
});

describe('progresso e conclusão', () => {
  it('cada missão do catálogo (e cada versão alternativa) conclui com a evidência certa', () => {
    for (const m of MISSION_CATALOG) {
      for (const variant of m.fallback ? (['base', 'fallback'] as const) : (['base'] as const)) {
        const a = assignmentFor(m, { variant, target: variant === 'fallback' && m.fallback ? m.fallback.target : resolveMissionTarget(m, CTX) });
        const out = settleMission(a, EVERYTHING, NOON + 1);
        expect([m.id, variant, out.completedNow]).toEqual([m.id, variant, true]);
        expect(out.xp).toBe(m.xp);
        expect(out.assignment.progress).toBe(a.target);
      }
    }
  });

  it('zonas e bairros contam ids distintos somados entre atividades', () => {
    const a = assignmentFor(missionById('d-pintar-3') as MissionDef);
    const ev: MissionEvidence = { activities: [act({ id: 'x', zonesPainted: ['z1', 'z2'] }), act({ id: 'y', zonesPainted: ['z2'] })] };
    expect(missionProgress(a, ev)).toBe(2);
    expect(missionProgress(a, { activities: [...ev.activities, act({ id: 'z', zonesPainted: ['z3'] })] })).toBe(3);
  });

  it('só atividades pontuadas, dentro da janela e cada id uma vez', () => {
    const a = assignmentFor(missionById('d-1500m') as MissionDef);
    const ev: MissionEvidence = {
      activities: [
        act({ id: 'ok', meters: 800 }),
        act({ id: 'ok', meters: 800 }),
        act({ id: 'rej', meters: 5000, status: 'rejected' }),
        act({ id: 'rev', meters: 5000, status: 'under_review' }),
        act({ id: 'ontem', meters: 5000, endedAt: brtCalendar.at('2026-10-22', 23, 59) }),
        act({ id: 'amanha', meters: 5000, endedAt: brtCalendar.at('2026-10-24') }),
        act({ id: 'parcial', meters: 300, status: 'partially_valid' }),
      ],
    };
    expect(missionProgress(a, ev)).toBe(1100);
  });

  it('Fuga da primeira semana exige 1 km; passo 1 exige 500 m com zona pintada', () => {
    const f3 = assignmentFor(missionById('f3-fuga') as MissionDef, { availableUntil: null });
    expect(missionProgress(f3, { activities: [act({ meters: 900, beatGhost: true })] })).toBe(0);
    expect(missionProgress(f3, { activities: [act({ meters: 1000, beatGhost: true })] })).toBe(1);
    const f1 = assignmentFor(missionById('f1-dominio') as MissionDef, { availableUntil: null });
    expect(missionProgress(f1, { activities: [act({ meters: 499, zonesPainted: ['z'] })] })).toBe(0);
    expect(missionProgress(f1, { activities: [act({ meters: 500, zonesPainted: [] })] })).toBe(0);
    expect(missionProgress(f1, { activities: [act({ meters: 500, zonesPainted: ['z'] })] })).toBe(1);
  });

  it('fatos sem corrida: crew, liga, ranking e compartilhamento (só dentro da janela)', () => {
    const share = assignmentFor(missionById('f7-compartilhar') as MissionDef);
    expect(missionProgress(share, { activities: [], sharedAt: [NOON - 86_400_000] })).toBe(0);
    expect(missionProgress(share, { activities: [] })).toBe(0);
    const crew = assignmentFor(missionById('f5-crew') as MissionDef);
    expect(missionProgress(crew, { activities: [], inCrew: false })).toBe(0);
    const liga = assignmentFor(missionById('f6-liga') as MissionDef);
    expect(missionProgress(liga, { activities: [], leaguePoints: 0 })).toBe(0);
    const ranking = assignmentFor(missionById('f6-liga') as MissionDef, { variant: 'fallback', target: 1 });
    expect(missionProgress(ranking, { activities: [] })).toBe(0);
    expect(missionProgress(ranking, { activities: [], rankingOpenedAt: [NOON] })).toBe(1);
  });

  it('missão desconhecida não anda nem dá XP', () => {
    const a = { ...assignmentFor(missionById('d-km') as MissionDef), missionId: 'nao-existe', target: 1 };
    expect(missionProgress(a, EVERYTHING)).toBe(0);
  });

  it('conclui no máximo 1 vez e o progresso nunca volta para trás', () => {
    const a = assignmentFor(missionById('d-1500m') as MissionDef);
    const first = settleMission(a, { activities: [act({ meters: 2000 })] }, NOON);
    expect(first).toMatchObject({ completedNow: true, xp: 20, assignment: { completedAt: NOON, progress: 1500 } });
    const again = settleMission(first.assignment, EVERYTHING, NOON + 5);
    expect(again).toEqual({ assignment: first.assignment, completedNow: false, xp: 0 });
    const partial = settleMission({ ...a, progress: 1200 }, { activities: [act({ meters: 300 })] }, NOON);
    expect(partial).toMatchObject({ completedNow: false, xp: 0, assignment: { progress: 1200, completedAt: null } });
  });

  it('propriedade: qualquer sequência de evidências conclui no máximo 1 vez, com progresso que só sobe e ≤ alvo', () => {
    forAll(
      (r) => ({
        def: r.pick(MISSION_CATALOG.filter((m) => m.cadence === 'diaria' || m.cadence === 'semanal')),
        batches: Array.from({ length: r.int(1, 8) }, (_, b) =>
          Array.from({ length: r.int(0, 3) }, (_, i) =>
            act({
              id: `a${r.int(0, 6)}`,
              endedAt: NOON + (b * 3 + i) * 60_000,
              status: r.pick(['valid', 'partially_valid', 'rejected'] as const),
              meters: r.float(0, 6000),
              movingSeconds: r.float(0, 2400),
              atlasCells: r.int(0, 12),
              zonesPainted: Array.from({ length: r.int(0, 3) }, () => `z${r.int(0, 15)}`),
              districts: [`d${r.int(0, 3)}`],
              conquered: r.int(0, 2),
              defended: r.int(0, 1),
              huntChests: r.int(0, 2),
              beatGhost: r.pick([true, false, null]),
              group: r.bool(0.3),
              raidMeters: r.float(0, 5000),
            }),
          ),
        ),
      }),
      ({ def, batches }) => {
        let a = assignmentFor(def, { availableUntil: null });
        let completions = 0;
        let xp = 0;
        const seen: MissionActivity[] = [];
        for (const batch of batches) {
          seen.push(...batch);
          const before = a.progress;
          const out = settleMission(a, { activities: seen }, NOON + seen.length);
          if (out.completedNow) completions++;
          xp += out.xp;
          a = out.assignment;
          expect(a.progress).toBeGreaterThanOrEqual(before);
          expect(a.progress).toBeLessThanOrEqual(a.target);
        }
        expect(completions).toBeLessThanOrEqual(1);
        expect(xp).toBe(completions * def.xp);
      },
    );
  });
});

describe('primeira semana: 7 passos, um por dia, sem prazo', () => {
  const start = brtCalendar.at('2026-10-20', 19);

  it('o passo 1 abre na criação; o resto espera', () => {
    const steps = ftueSteps({ startedAt: start, completedAt: {}, now: start + 60_000 });
    expect(steps.map((s) => s.status)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(steps.map((s) => s.id)).toEqual([...FTUE_STEP_IDS]);
    expect(ftueBarProgress(steps)).toBeCloseTo(0.2, 10);
  });

  it('o passo seguinte abre às 00:00 (Brasília) do dia seguinte à conclusão, e nada expira', () => {
    const done1 = brtCalendar.at('2026-10-20', 20);
    const nextDay = brtCalendar.at('2026-10-21');
    const before = ftueSteps({ startedAt: start, completedAt: { 'f1-dominio': done1 }, now: nextDay - 1 });
    expect(before[1]).toMatchObject({ status: 'locked', unlocksAt: nextDay });
    const after = ftueSteps({ startedAt: start, completedAt: { 'f1-dominio': done1 }, now: nextDay + 30 * 86_400_000 });
    expect(after.map((s) => s.status)).toEqual(['done', 'open', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(ftueBarProgress(after)).toBeCloseTo(0.2 + 0.8 / 7, 10);
  });

  it('passo concluído fora de ordem não conta antes de abrir', () => {
    const steps = ftueSteps({ startedAt: start, completedAt: { 'f3-fuga': start + 1000 }, now: start + 2000 });
    expect(steps[2]).toMatchObject({ status: 'locked', completedAt: null });
  });

  it('todos os passos feitos enchem a barra', () => {
    const completedAt: Record<string, number> = {};
    let t = start;
    for (const id of FTUE_STEP_IDS) {
      completedAt[id] = t + 3_600_000;
      t = brtCalendar.at(brtCalendar.addDays(brtCalendar.clock(t + 3_600_000).dayId, 1), 10);
    }
    const steps = ftueSteps({ startedAt: start, completedAt, now: t });
    expect(steps.every((s) => s.status === 'done')).toBe(true);
    expect(ftueBarProgress(steps)).toBeCloseTo(1, 10);
  });

  it('Raid e Liga usam a versão alternativa enquanto não existem de verdade', () => {
    expect(ftueAssignment('f4-raid', start, { raidActive: false, leagueActive: false })).toMatchObject({
      slot: 4, variant: 'fallback', target: 10, period: 'ftue', availableUntil: null,
    });
    expect(ftueAssignment('f4-raid', start, { raidActive: true, leagueActive: false })).toMatchObject({ variant: 'base', target: 1000 });
    expect(ftueAssignment('f6-liga', start, { raidActive: false, leagueActive: false })).toMatchObject({ slot: 6, variant: 'fallback' });
    expect(ftueAssignment('f6-liga', start, { raidActive: false, leagueActive: true })).toMatchObject({ variant: 'base' });
    expect(ftueAssignment('f1-dominio', start, { raidActive: false, leagueActive: false })).toMatchObject({ slot: 1, variant: 'base', target: 1 });
    expect(ftueAssignment('d-km', start, { raidActive: true, leagueActive: true })).toBeNull();
    expect(ftueAssignment('nao-existe', start, { raidActive: true, leagueActive: true })).toBeNull();
  });
});

describe('volta depois de sumir', () => {
  it('missão de volta aos 7, 14 e 30 dias (prêmio fixo)', () => {
    expect(comebackMissionId(6)).toBeNull();
    expect(comebackMissionId(7)).toBe('v-7');
    expect(comebackMissionId(13)).toBe('v-7');
    expect(comebackMissionId(14)).toBe('v-14');
    expect(comebackMissionId(30)).toBe('v-30');
    expect(comebackMissionId(400)).toBe('v-30');
    expect(missionById('v-30')?.bonus).toEqual({ dailyChest: 'lendario', streakRestart: true });
  });

  it('atribuição sem prazo, a partir de agora', () => {
    expect(comebackAssignment('2026-10-20', NOON)).toBeNull();
    expect(comebackAssignment('2026-10-15', NOON)).toMatchObject({
      missionId: 'v-7', cadence: 'volta', period: 'volta-2026-10-23', target: 600, availableFrom: NOON, availableUntil: null,
    });
    expect(comebackAssignment('2026-09-01', NOON)?.missionId).toBe('v-30');
  });
});
