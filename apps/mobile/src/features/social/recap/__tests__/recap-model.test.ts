/**
 * @jest-environment node
 *
 * T7.3.7 — recap semanal (puro): semana, link, leitura tolerante do `weekly-recap`, adaptador da rota cortada
 * no servidor e, no recap local, o corte no aparelho (propriedade: nenhum ponto dentro de zona).
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { distanceMeters } from '@/domain/geo';
import { clipRouteForSharing } from '@/domain/share-privacy';
import { decodeServerRoute, encodePolyline } from '@/services/api/feed-repo';
import { toWeeklyRecap } from '@/services/api/recap-repo';

import { buildWeekCard } from '../../card/card-model';
import { isCardRoute, isOwnServerRoute, ownRouteFromServer } from '../../card/card-route';
import { frameRoutes, visibleRoutes } from '../../card/route-geometry';
import { DEMO_HOME, DEMO_ROUTE } from '../../card/__tests__/fixtures';
import { PRIVACY_NOTICE_NO_ZONES } from '../../share/share-input';
import { addDaysIso, buildRecapWeekInput, mondayOf, recapCaption, recapFromActivities, recapHref } from '../recap-model';

const base = { seed: 1, faction: 'striders' as const, username: null, city: 'Goiânia', isDemo: true };

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('semana e link', () => {
  it('segunda-feira da semana (domingo volta 6 dias) e soma de dias', () => {
    expect(mondayOf(new Date(2026, 9, 23, 22, 30).getTime())).toBe('2026-10-19');
    expect(mondayOf(new Date(2026, 9, 25, 9).getTime())).toBe('2026-10-19');
    expect(mondayOf(new Date(2026, 9, 26, 0, 5).getTime())).toBe('2026-10-26');
    expect(addDaysIso('2026-10-26', -7)).toBe('2026-10-19');
    expect(addDaysIso('2026-12-28', 6)).toBe('2027-01-03');
  });

  it('link da tela, com e sem semana', () => {
    expect(recapHref()).toBe('/compartilhar/semana');
    expect(recapHref('2026-10-19')).toBe('/compartilhar/semana?inicio=2026-10-19');
    expect(recapHref('19/10')).toBe('/compartilhar/semana');
  });
});

describe('leitura do weekly-recap', () => {
  it('contrato da E9, com rotas em polylines de precisão 4', () => {
    const pl = encodePolyline(DEMO_ROUTE.slice(10, 30));
    const r = toWeeklyRecap({ weekStart: '2026-10-19', weekEnd: '2026-10-25', final: true, days: [0, 4100, 0, 3600, 4700, 0, 0], meters: 12400, runs: 3, movingSeconds: 3840, zones: 2, streakWeeks: 4, isDemo: true, routes: [{ pieces: [pl], routeHidden: true }, { pieces: ['%%%'], routeHidden: true }] }, 'x');
    expect(r).toMatchObject({ weekStart: '2026-10-19', weekEnd: '2026-10-25', final: true, runs: 3, meters: 12400, zones: 2, streakWeeks: 4, isDemo: true, activityIds: [] });
    expect(r.dayMeters).toEqual([0, 4100, 0, 3600, 4700, 0, 0]);
    expect(r.routes).toHaveLength(1); // a polyline inválida some
  });

  it('formato estranho vira o neutro, sem lançar', () => {
    const r = toWeeklyRecap({ days: 'x', runs: -3, meters: Number.NaN, routes: 7 }, '2026-10-19');
    expect(r).toMatchObject({ weekStart: '2026-10-19', weekEnd: '2026-10-25', final: false, runs: 0, meters: 0, routes: [], isDemo: false });
    expect(r.dayMeters).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(toWeeklyRecap(null, '').weekEnd).toBe('');
  });
});

describe('rota do card: adaptador da rota cortada no servidor', () => {
  it('polylines → rota do card, sem cortar de novo (mesmos pontos, com a precisão da polyline)', () => {
    const shown = DEMO_ROUTE.slice(8, 40);
    const server = decodeServerRoute([encodePolyline(shown)])!;
    const own = ownRouteFromServer(server)!;
    expect(isOwnServerRoute(own)).toBe(true);
    expect(isCardRoute(own)).toBe(true);
    expect(own.pieces[0]).toHaveLength(shown.length);
    own.pieces[0].forEach((p, i) => expect(distanceMeters(p, shown[i])).toBeLessThan(12));
    expect(frameRoutes([own], { x: 0, y: 0, w: 300, h: 300 })).not.toBeNull();
  });

  it('objeto montado à mão e pedaço curto não passam', () => {
    const forged = { mode: 'route', pieces: [DEMO_ROUTE], endsHidden: true };
    expect(isCardRoute(forged)).toBe(false);
    expect(visibleRoutes([forged as never])).toHaveLength(0);
    expect(ownRouteFromServer({ pieces: [[DEMO_ROUTE[0]]] })).toBeNull();
    expect(ownRouteFromServer(null)).toBeNull();
  });

  it('só o recap semanal chama o adaptador (a rota do feed, de outra pessoa, nunca vira card)', () => {
    const src = join(__dirname, '..', '..', '..', '..');
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(p);
        } else if (/\.tsx?$/.test(name) && !p.endsWith('card-route.ts')) {
          // uso de verdade: fora das linhas de import/export (o índice do card só reexporta)
          const uses = readFileSync(p, 'utf8')
            .split('\n')
            .filter((l) => /\bownRouteFromServer\b/.test(l) && !/^\s*(import|export|\*|\/\/|\/\*)/.test(l));
          if (uses.length) callers.push(p.slice(src.length + 1));
        }
      }
    };
    walk(src);
    expect(callers).toEqual([join('features', 'social', 'recap', 'recap-model.ts')]);
  });
});

describe('recap → card', () => {
  const serverRecap = () =>
    toWeeklyRecap({ weekStart: '2026-10-19', days: [0, 4100, 0, 3600, 4700, 0, 0], runs: 3, movingSeconds: 3840, zones: 2, streakWeeks: 4, isDemo: true, routes: [{ pieces: [encodePolyline(DEMO_ROUTE.slice(8, 40))] }] }, '2026-10-19');

  it('rotas do servidor entram como estão, sem zonas nem pontos locais', () => {
    const { input, notice } = buildRecapWeekInput({ ...base, recap: serverRecap(), paths: new Map(), privacyZones: null });
    expect(notice).toBeNull();
    expect(input.routes).toHaveLength(1);
    const model = buildWeekCard(input);
    expect(model.routes).toHaveLength(1);
    expect(model.km).toBe('12,4');
    expect(model.isDemo).toBe(true);
    expect(buildWeekCard(input, { withRoute: false, showCity: true, showUsername: false }).routes).toHaveLength(0);
  });

  it('recap local sem as zonas de privacidade: sem rotas e com aviso', () => {
    const recap = recapFromActivities([{ id: 'a', status: 'valid', startedAt: new Date(2026, 9, 20, 7).getTime(), meters: 2020, movingSeconds: 629, conquered: 1 }], '2026-10-19', 2, true);
    const { input, notice } = buildRecapWeekInput({ ...base, recap, paths: new Map([['a', DEMO_ROUTE]]), privacyZones: null });
    expect(input.routes).toHaveLength(0);
    expect(notice).toBe(PRIVACY_NOTICE_NO_ZONES);
  });

  it('propriedade (200 casos): no recap local, nenhum ponto das mini-rotas dentro de zona de privacidade', () => {
    const rnd = seeded(42);
    for (let k = 0; k < 200; k++) {
      const c = DEMO_ROUTE[Math.floor(rnd() * DEMO_ROUTE.length)];
      const zones = [DEMO_HOME, { lat: c.lat + (rnd() - 0.5) * 0.002, lng: c.lng + (rnd() - 0.5) * 0.002, radiusM: 50 + rnd() * 200 }];
      const recap = recapFromActivities(
        [
          { id: 'a', status: 'valid', startedAt: new Date(2026, 9, 20, 7).getTime(), meters: 2020, movingSeconds: 629, conquered: 0 },
          { id: 'b', status: 'partial', startedAt: new Date(2026, 9, 22, 7).getTime(), meters: 1500, movingSeconds: 500, conquered: 0 },
        ],
        '2026-10-19',
        0,
        false,
      );
      const { input } = buildRecapWeekInput({ ...base, seed: Math.floor(rnd() * 2 ** 32), recap, paths: new Map([['a', DEMO_ROUTE], ['b', [...DEMO_ROUTE].reverse()]]), privacyZones: zones });
      for (const r of input.routes) for (const p of r.pieces.flat()) for (const z of zones) expect(distanceMeters(p, z)).toBeGreaterThan(z.radiusM);
    }
  });

  it('recap local: só corridas pontuadas da semana, dia certo e as mais longas primeiro', () => {
    const at = (d: number, h = 7) => new Date(2026, 9, d, h).getTime();
    const r = recapFromActivities(
      [
        { id: 'seg', status: 'valid', startedAt: at(19), meters: 3000, movingSeconds: 900, conquered: 1 },
        { id: 'dom', status: 'partial', startedAt: at(25, 23), meters: 5000, movingSeconds: 1500, conquered: 2 },
        { id: 'rev', status: 'review', startedAt: at(21), meters: 9000, movingSeconds: 2000, conquered: 0 },
        { id: 'fora', status: 'valid', startedAt: at(26, 0), meters: 4000, movingSeconds: 1000, conquered: 0 },
      ],
      '2026-10-19',
      3,
      false,
    );
    expect(r.dayMeters).toEqual([3000, 0, 0, 0, 0, 0, 5000]);
    expect(r).toMatchObject({ runs: 2, meters: 8000, movingSeconds: 2400, zones: 3, streakWeeks: 3, activityIds: ['dom', 'seg'], routes: [] });
  });

  it('legenda sem hora, com cidade só quando pedida e marca de demonstração', () => {
    const { input } = buildRecapWeekInput({ ...base, recap: serverRecap(), paths: new Map(), privacyZones: null });
    expect(recapCaption(input, '12,4', { showCity: true })).toBe('Minha semana no NOMADE RUN: 12,4 km em 3 corridas e 2 zonas conquistadas. Bora pintar Goiânia! (dados de demonstração)');
    expect(recapCaption({ ...input, isDemo: false, zones: 0, runs: 1 }, '2,0', { showCity: false })).toBe('Minha semana no NOMADE RUN: 2,0 km em 1 corrida.');
  });
});

it('fixture: a rota de demonstração cortada no aparelho também é rota de card', () => {
  expect(isCardRoute(clipRouteForSharing(DEMO_ROUTE, [], { seed: 3 }))).toBe(true);
});
