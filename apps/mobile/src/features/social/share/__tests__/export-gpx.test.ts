import { describe, expect, it } from '@jest/globals';

import { distanceMeters } from '@/domain/geo';

import { DEMO_HOME, DEMO_ROUTE } from '../../card/__tests__/fixtures';
import { GPX_TEXT, gpxTitle, prepareGpx } from '../use-export-gpx';

const AT = new Date(2026, 9, 23, 7, 42).getTime();
const points = DEMO_ROUTE.map((p, i) => ({ ...p, t: AT - (DEMO_ROUTE.length - i) * 10_000, ele: 750 }));
const trkpts = (xml: string) => [...xml.matchAll(/<trkpt lat="(-?[\d.]+)" lon="(-?[\d.]+)"/g)].map((m) => ({ lat: Number(m[1]), lng: Number(m[2]) }));

describe('GPX da corrida (corte ligado por padrão)', () => {
  it('nome com a data sem hora', () => {
    expect(gpxTitle(AT)).toBe('Corrida NOMADE — 23/10/2026');
  });

  it('cortado: sem horário, nenhum ponto na zona de privacidade, descrição avisa', () => {
    const zone = { ...DEMO_ROUTE[30], radiusM: 60 };
    const r = prepareGpx({ activityId: 'a1', points, at: AT }, [zone], 5, false);
    if (!('xml' in r)) throw new Error(r.error);
    expect(r.xml).not.toContain('<time>');
    expect(r.xml).toContain('<name>Corrida NOMADE — 23/10/2026</name>');
    expect(r.xml).toContain('Começo, fim e zonas de privacidade escondidos.');
    const pts = trkpts(r.xml);
    expect(pts.length).toBeGreaterThan(10);
    for (const p of pts) expect(distanceMeters(p, zone)).toBeGreaterThan(zone.radiusM);
    for (const p of pts) expect(distanceMeters(p, DEMO_ROUTE[0])).toBeGreaterThan(140);
  });

  it('sem conferir as zonas, o corte não exporta nada', () => {
    expect(prepareGpx({ activityId: 'a1', points, at: AT }, null, 5, false)).toEqual({ error: GPX_TEXT.noZones });
  });

  it('rota completa só quando pedida (com horários); demonstração marcada', () => {
    const r = prepareGpx({ activityId: 'a1', points, at: AT, fullRoute: true }, null, 5, true);
    if (!('xml' in r)) throw new Error(r.error);
    expect(trkpts(r.xml)).toHaveLength(points.length);
    expect(r.xml).toContain('<time>');
    expect(r.xml).toContain('Dados de demonstração.');
  });

  it('casa perto da saída de uma volta curta → nada sobra; corrida sem pontos', () => {
    expect(prepareGpx({ activityId: 'a1', points, at: AT }, [DEMO_HOME], 5, false)).toEqual({ error: GPX_TEXT.nothingLeft });
    expect(prepareGpx({ activityId: 'a1', points: [], at: AT }, [], 5, false)).toEqual({ error: GPX_TEXT.noPoints });
  });
});
