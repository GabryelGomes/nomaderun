/**
 * T7.3.2 (E6b) — previsão ao vivo com o retrato da pintura (`fetchPaintNear`, E3): pedir no 1º ponto e a cada
 * 1 km, trocar o retrato no meio da corrida sem perder metros, trechos, conquistas nem repetir avisos.
 */
import { describe, expect, it } from '@jest/globals';

import { cellCenter, zoneOf } from '@/domain/grid';
import type { LiveEvent, LiveSnapshot } from '@/domain/live-events';
import { paintCellOf, paintZoneOf } from '@/domain/paint';
import type { GeoPoint } from '@/domain/types';

import { createPaintedLiveTracker, PAINT_FETCH_IDLE, PAINT_REFETCH_METERS, PAINT_RETRY_MS, paintFetchDue } from '../live-paint';

const NOW = Date.UTC(2026, 9, 28, 12);
const HERE = { lat: -16.7097, lng: -49.2388 };
const ZONE = zoneOf(HERE);
const C = cellCenter(ZONE);

/** 1 ponto a cada ~10 m (3,3 m/s), em linha reta pelo centro da zona. */
function line(from: number, to: number, dLat = 0): GeoPoint[] {
  const out: GeoPoint[] = [];
  for (let i = from; i <= to; i++) out.push({ lat: C.lat + dLat, lng: C.lng - 0.0018 + i * 0.00009, t: NOW + i * 3000, accuracy: 5 });
  return out;
}

const neutral: LiveSnapshot = { cells: {}, zones: { [ZONE]: { owner: null, name: 'Parque' } } };

describe('paintFetchDue (quando pedir o retrato)', () => {
  const p: GeoPoint = { ...HERE, t: NOW };

  it('pede no 1º ponto; não pede com um pedido no ar nem com o servidor sem pintura', () => {
    expect(paintFetchDue(PAINT_FETCH_IDLE, p)).toBe(true);
    expect(paintFetchDue({ ...PAINT_FETCH_IDLE, inflight: true }, p)).toBe(false);
    expect(paintFetchDue({ ...PAINT_FETCH_IDLE, disabled: true }, p)).toBe(false);
  });

  it(`pede de novo só depois de ${PAINT_REFETCH_METERS} m do último centro`, () => {
    const s = { ...PAINT_FETCH_IDLE, center: HERE };
    expect(paintFetchDue(s, { lat: HERE.lat + 0.005, lng: HERE.lng, t: NOW })).toBe(false); // ~550 m
    expect(paintFetchDue(s, { lat: HERE.lat + 0.01, lng: HERE.lng, t: NOW })).toBe(true); // ~1,1 km
  });

  it('depois de uma falha de rede, espera 60 s (relógio dos pontos) para tentar de novo', () => {
    const s = { ...PAINT_FETCH_IDLE, failedAt: NOW };
    expect(paintFetchDue(s, { ...p, t: NOW + PAINT_RETRY_MS - 1 })).toBe(false);
    expect(paintFetchDue(s, { ...p, t: NOW + PAINT_RETRY_MS })).toBe(true);
  });
});

describe('createPaintedLiveTracker', () => {
  const run = (t: ReturnType<typeof createPaintedLiveTracker>, pts: GeoPoint[]) => pts.flatMap((p) => t.push(p));

  it('sem retrato do servidor, funciona como o tracker do domain (conquista a zona neutra)', () => {
    const t = createPaintedLiveTracker({ runId: 'r', faction: 'striders', fallback: neutral });
    const ev = run(t, line(0, 40));
    expect(ev.filter((e) => e.type === 'zona_conquistada')).toHaveLength(1);
    expect(t.summary().conquered).toEqual([ZONE]);
    expect(t.seeds()).toBe(0);
  });

  it('trocar o retrato no meio: metros e trechos somam, a conquista não se repete e a entrada não avisa de novo', () => {
    const t = createPaintedLiveTracker({ runId: 'r', faction: 'striders', fallback: neutral });
    run(t, line(0, 40));
    const before = t.summary();
    // O servidor ainda não sabe desta corrida: a zona aparece com o dono antigo e a herança.
    t.reseed({ snapshot: { cells: {}, zones: { [ZONE]: { owner: 'owls', name: 'Parque', inherited: 3 } } }, paintedToday: [] });
    expect(t.seeds()).toBe(1);
    // Volta pelo centro da zona (de 40 para 20), com o relógio andando.
    const back = line(20, 39)
      .reverse()
      .map((p, i) => ({ ...p, t: NOW + 41 * 3000 + i * 3000 }));
    const after: LiveEvent[] = run(t, back);
    const inZone = after.filter((e) => 'zoneId' in e && e.zoneId === ZONE);
    expect(inZone.some((e) => e.type === 'zona_conquistada')).toBe(false);
    expect(inZone.some((e) => e.type === 'zona_rival_entrou')).toBe(false);
    const s = t.summary();
    expect(s.conquered.filter((z) => z === ZONE)).toHaveLength(1);
    expect(s.meters).toBeGreaterThan(before.meters);
    expect(s.cellsPainted).toBeGreaterThanOrEqual(before.cellsPainted);
    expect(s.current?.owner).toBe('striders');
  });

  it('o que a corrida já pintou não pinta de novo depois da troca (voltar pelo mesmo caminho não soma)', () => {
    const t = createPaintedLiveTracker({ runId: 'r', faction: 'striders', fallback: neutral });
    run(t, line(0, 20));
    const painted = t.summary().cellsPainted;
    expect(painted).toBeGreaterThan(0);
    t.reseed({ snapshot: neutral, paintedToday: [] });
    // O mesmo caminho de novo, com o relógio andando.
    run(
      t,
      line(0, 20).map((p, i) => ({ ...p, t: NOW + 120_000 + i * 3000 })),
    );
    expect(t.summary().cellsPainted).toBe(painted);
  });

  it('usa os trechos do servidor: a zona com trechos rivais pede mais ruas do que a herança sozinha', () => {
    // Trechos dos Night Owls numa rua paralela (~55 m ao norte), dentro da mesma zona.
    const rivalCells = Object.fromEntries(
      line(0, 40, 0.0005)
        .map(paintCellOf)
        .filter((cell) => paintZoneOf(cell) === ZONE)
        .map((cell) => [cell, { faction: 'owls' as const, layers: 2 }]),
    );
    expect(Object.keys(rivalCells).length).toBeGreaterThan(3);
    const only = (cells: LiveSnapshot['cells']): LiveSnapshot => ({ cells, zones: { [ZONE]: { owner: 'owls', name: 'Parque', inherited: 3 } } });
    const a = createPaintedLiveTracker({ runId: 'a', faction: 'striders', fallback: only({}) });
    const b = createPaintedLiveTracker({ runId: 'b', faction: 'striders', fallback: only({}) });
    b.reseed({ snapshot: only(rivalCells), paintedToday: [] });
    a.push(line(0, 0)[0]);
    b.push(line(0, 0)[0]);
    expect(b.summary().current!.gapCells).toBeGreaterThan(a.summary().current!.gapCells);
  });

  it('trechos que a pessoa já pintou hoje (servidor) não pintam de novo', () => {
    const pts = line(0, 20);
    const today = pts.map(paintCellOf);
    const t = createPaintedLiveTracker({ runId: 'r', faction: 'striders', fallback: neutral });
    t.push(pts[0]);
    t.reseed({ snapshot: neutral, paintedToday: today });
    run(t, pts.slice(1));
    expect(t.summary().cellsPainted).toBe(0);
  });

  it('1ª conquista da vida (dado da E7): o evento chega épico', () => {
    const t = createPaintedLiveTracker({ runId: 'r', faction: 'striders', fallback: neutral, firstConquestEver: true });
    const conquest = run(t, line(0, 40)).find((e) => e.type === 'zona_conquistada');
    expect(conquest).toMatchObject({ level: 'epica', first: true });
  });

  it('localização simulada para a previsão, e um retrato novo não a religa', () => {
    const t = createPaintedLiveTracker({ runId: 'r', faction: 'striders', fallback: neutral });
    t.push({ ...line(0, 0)[0], mocked: true });
    t.reseed({ snapshot: neutral, paintedToday: [] });
    expect(run(t, line(1, 40))).toEqual([]);
    expect(t.summary().stopped).toBe(true);
    expect(t.seeds()).toBe(0);
  });
});
