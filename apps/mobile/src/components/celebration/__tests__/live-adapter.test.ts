/**
 * T7.2.9 — adaptador `LiveEvent` (E3) → `CelebrationEvent` (E5) e o ritmo ao vivo (1 vibração a cada 10 s,
 * exceto a conquista; voz só em conquista, 75% e zona rival).
 */
import { describe, expect, it, jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- fábrica do jest.mock só pode usar require
jest.mock('react-native-reanimated', () => require('../../motion/__tests__/render-mocks').reanimated);

/* eslint-disable import/first */
import { LIVE_EVENT_LEVEL, type LiveEvent } from '@/domain/live-events';
import { emptyPaintCounts } from '@/domain/paint';

import {
  celebrationLevelOf,
  createLiveFeedback,
  LIVE_HAPTIC_MIN_GAP_MS,
  LIVE_HAPTICS,
  liveEventId,
  liveEventsToCelebrations,
  liveEventToCelebration,
  liveVoiceLine,
  liveZoneName,
  UNNAMED_ZONE,
} from '../adapters';
import { planCelebrations } from '../queue';
/* eslint-enable import/first */

const base = { runId: 'r1', atMeters: 1200, level: 'micro' as const };
const counts = emptyPaintCounts();
const zoneInfo = { zoneId: 'z1', name: 'Setor Bueno', owner: 'owls' as const, counts, gapCells: 2, gapMeters: 80 };

/** Um evento de cada tipo, com o nível padrão da E3. */
function all(t0 = 1_000_000): LiveEvent[] {
  return [
    { ...base, t: t0, level: LIVE_EVENT_LEVEL.trecho_pintado, type: 'trecho_pintado', cell: 'c1', zoneId: 'z1', kind: 'novo', layers: 1 },
    { ...base, t: t0 + 1000, level: LIVE_EVENT_LEVEL.trecho_virado, type: 'trecho_virado', cell: 'c2', zoneId: 'z1', from: 'owls', layers: 1 },
    { ...base, t: t0 + 2000, level: LIVE_EVENT_LEVEL.trecho_enfraquecido, type: 'trecho_enfraquecido', cell: 'c3', zoneId: 'z1', owner: 'owls', layersLeft: 1 },
    { ...base, ...zoneInfo, t: t0 + 3000, level: LIVE_EVENT_LEVEL.zona_entrou, type: 'zona_entrou', mine: false },
    { ...base, ...zoneInfo, t: t0 + 4000, level: LIVE_EVENT_LEVEL.zona_rival_entrou, type: 'zona_rival_entrou' },
    { ...base, t: t0 + 5000, level: LIVE_EVENT_LEVEL.zona_progresso, type: 'zona_progresso', zoneId: 'z1', pct: 75, gapCells: 2, gapMeters: 83 },
    { ...base, t: t0 + 6000, level: LIVE_EVENT_LEVEL.faltam_metros, type: 'faltam_metros', zoneId: 'z1', gapCells: 1, gapMeters: 40 },
    { ...base, t: t0 + 7000, level: LIVE_EVENT_LEVEL.zona_conquistada, type: 'zona_conquistada', zoneId: 'z1', name: 'Setor Bueno', from: 'owls', counts, provisional: true, first: false },
    { ...base, t: t0 + 8000, level: LIVE_EVENT_LEVEL.zona_defendida, type: 'zona_defendida', zoneId: 'z2', name: null, retaken: 3, counts, provisional: true },
  ];
}

const ctx = { faction: 'volt' as const };

describe('nível', () => {
  it('a escala em português da E3 vira a escala da E5', () => {
    expect(celebrationLevelOf('micro')).toBe('micro');
    expect(celebrationLevelOf('pequena')).toBe('small');
    expect(celebrationLevelOf('media')).toBe('medium');
    expect(celebrationLevelOf('epica')).toBe('epic');
  });
});

describe('liveEventToCelebration', () => {
  it('só conquista, defesa e marco viram celebração; o resto é do HUD', () => {
    const out = all().map((e) => [e.type, liveEventToCelebration(e, ctx)?.kind ?? null]);
    expect(Object.fromEntries(out)).toEqual({
      trecho_pintado: null,
      trecho_virado: null,
      trecho_enfraquecido: null,
      zona_entrou: null,
      zona_rival_entrou: null,
      zona_progresso: 'zone-milestone',
      faltam_metros: null,
      zona_conquistada: 'zone-captured',
      zona_defendida: 'zone-defended',
    });
  });

  it('conquista: time de quem corre, nível da regra, frase no passado e sem pontos (previsão)', () => {
    const e = all()[7];
    const c = liveEventToCelebration(e, ctx);
    expect(c).toEqual({ id: liveEventId(e), kind: 'zone-captured', level: 'medium', label: 'conquistou Setor Bueno', payload: { zone: 'Setor Bueno', faction: 'volt' } });
    const first = liveEventToCelebration({ ...e, first: true, level: 'epica' } as LiveEvent, ctx);
    expect(first?.level).toBe('epic');
    expect(first?.label).toBe('conquistou Setor Bueno, a sua primeira zona');
  });

  it('marco: fração e quanto falta; defesa sem nome usa o cache do mapa ou "Zona sem nome"', () => {
    const [, , , , , prog, , , def] = all();
    expect(liveEventToCelebration(prog, ctx)).toMatchObject({ kind: 'zone-milestone', level: 'small', label: 'chegou a 75% de Zona sem nome', payload: { zone: UNNAMED_ZONE, fraction: 0.75, gapMeters: 83 } });
    expect(liveEventToCelebration(prog, { ...ctx, zoneName: (id) => (id === 'z1' ? 'Setor Bueno' : null) })?.label).toBe('chegou a 75% de Setor Bueno');
    expect(liveEventToCelebration(def, ctx)).toMatchObject({ kind: 'zone-defended', level: 'medium', label: `defendeu ${UNNAMED_ZONE}`, payload: { zone: UNNAMED_ZONE, faction: 'volt' } });
    expect(liveZoneName(def, { zoneName: () => '  Vila Nova ' })).toBe('Vila Nova');
  });

  it('ids estáveis e únicos por evento; a lista não repete', () => {
    const evs = all();
    const ids = evs.map(liveEventId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[5]).toBe('r1:zona_progresso:z1:75:1005000');
    expect(liveEventId(evs[0])).toBe(liveEventId({ ...evs[0] }));
    const list = liveEventsToCelebrations([...evs, ...evs], ctx);
    expect(list.map((c) => c.kind)).toEqual(['zone-milestone', 'zone-captured', 'zone-defended']);
  });

  it('a lista entra direto no orquestrador (resumo)', () => {
    const list = liveEventsToCelebrations(all(), ctx);
    const plan = planCelebrations(list, { reduced: false, screenReader: false });
    expect(plan.moments).toHaveLength(3);
    // o anúncio segue a ordem da corrida; o roteiro deixa as médias por último
    expect(plan.announcement).toBe('Você chegou a 75% de Zona sem nome, conquistou Setor Bueno e defendeu Zona sem nome.');
    expect(plan.moments.map((m) => m.kind)).toEqual(['zone-milestone', 'zone-defended', 'zone-captured']);
  });
});

describe('createLiveFeedback (ritmo ao vivo)', () => {
  it('no máximo 1 vibração a cada 10 s, exceto a conquista', () => {
    const fb = createLiveFeedback(ctx);
    const t0 = 5_000_000;
    const ev = all(t0);
    const virado = ev[1];
    const rival = ev[4];
    const conquista = ev[7];
    expect(fb.push(virado).haptic).toBe('selection');
    expect(fb.push({ ...rival, t: virado.t + 3000 }).haptic).toBeNull(); // dentro dos 10 s
    expect(fb.push({ ...conquista, t: virado.t + 4000 }).haptic).toBe('success'); // conquista fura o ritmo
    expect(fb.push({ ...virado, t: virado.t + 4000 + LIVE_HAPTIC_MIN_GAP_MS - 1 }).haptic).toBeNull();
    expect(fb.push({ ...virado, t: virado.t + 4000 + LIVE_HAPTIC_MIN_GAP_MS }).haptic).toBe('selection');
    fb.reset();
    expect(fb.push({ ...virado, t: 0 }).haptic).toBe('selection');
  });

  it('trechos pintados, enfraquecidos, entrada e "faltam" nunca vibram', () => {
    const fb = createLiveFeedback(ctx);
    const ev = all();
    for (const i of [0, 2, 3, 6]) expect(fb.push({ ...ev[i], t: ev[i].t * 100 }).haptic).toBeNull();
    expect(Object.entries(LIVE_HAPTICS).filter(([, p]) => p !== null).map(([k]) => k)).toEqual(['trecho_virado', 'zona_rival_entrou', 'zona_progresso', 'zona_conquistada', 'zona_defendida']);
  });

  it('voz só em conquista, 75% e zona rival; o feedback leva a celebração junto', () => {
    const ev = all();
    const lines = ev.map((e) => liveVoiceLine(e));
    expect(lines.filter((l) => l !== null)).toEqual(['Zona dos Night Owls: Setor Bueno', 'Faltam 80 metros!', 'Zona conquistada!']);
    expect(liveVoiceLine({ ...ev[5], pct: 50 } as LiveEvent)).toBeNull();
    expect(liveVoiceLine({ ...ev[5], gapMeters: 0 } as LiveEvent)).toBeNull();
    const f = createLiveFeedback(ctx).push(ev[7]);
    expect(f.celebration?.kind).toBe('zone-captured');
    expect(f.voice).toBe('Zona conquistada!');
  });
});
