/**
 * Dados de demonstração dos testes do card (marcados `isDemo: true`): a volta real de 2,02 km do mockup
 * (`docs/apresentacao/mockup/build/mapa.json`, entorno do Parque Flamboyant; © OpenStreetMap via Overture,
 * ODbL) e os números do modo demonstração usados no protótipo da F1.
 */
import { clipRouteForSharing, type PrivacyCircle, type SharedRoute } from '@/domain/share-privacy';
import type { LatLng } from '@/domain/types';

import type { ShareRunInput, ShareWeekInput } from '../card-model';

export const DEMO_ORIGIN: LatLng = { lat: -16.703532431578115, lng: -49.237952747320996 };

/** Pontos em metros (x para leste, y para baixo), como no `mapa.json`. */
// prettier-ignore
export const DEMO_ROUTE_M: readonly [number, number][] = [[-129, -69], [-131, -81], [-138, -89], [-156, -101], [-169, -112], [-180, -125], [-188, -142], [-201, -172], [-182, -248], [-174, -310], [-177, -338], [-185, -361], [-179, -363], [-191, -399], [-192, -405], [-188, -411], [-176, -414], [-164, -415], [-116, -409], [-105, -404], [-98, -398], [-97, -380], [-94, -381], [-78, -309], [-27, -201], [-26, -145], [-23, -138], [-16, -130], [-11, -125], [50, -82], [114, 11], [124, 10], [131, 8], [139, 3], [144, -5], [141, 69], [157, 114], [164, 130], [175, 144], [183, 151], [195, 156], [252, 170], [262, 170], [267, 258], [241, 264], [193, 300], [161, 318], [156, 329], [157, 344], [148, 338], [132, 321], [90, 291], [47, 279], [27, 255], [-17, 205], [-88, 96], [-118, 44], [-121, 35], [-128, 3], [-131, -25], [-131, -47], [-129, -69]];

export function metersToLatLng([x, y]: readonly [number, number], origin: LatLng = DEMO_ORIGIN): LatLng {
  return {
    lat: origin.lat - y / 110_574,
    lng: origin.lng + x / (111_320 * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

export const DEMO_ROUTE: LatLng[] = DEMO_ROUTE_M.map((p) => metersToLatLng(p));

/** Zona "Casa" a ~60 m do início da volta (raio padrão de 200 m), como no protótipo da F1. */
export const DEMO_HOME: PrivacyCircle = { ...metersToLatLng([DEMO_ROUTE_M[0][0] + 45, DEMO_ROUTE_M[0][1] + 40]), radiusM: 200 };

/** Rota do card de exemplo: a casa não fica no caminho, mas o começo e o fim somem por padrão. */
export const demoSharedRoute = (seed = 7): SharedRoute => clipRouteForSharing(DEMO_ROUTE, [], { seed });

export function demoRunInput(over: Partial<ShareRunInput> = {}): ShareRunInput {
  return {
    status: 'valid',
    faction: 'striders',
    meters: 2016,
    movingSeconds: 629,
    points: 183,
    date: { year: 2026, month: 10, day: 23 },
    city: 'Goiânia',
    username: 'gabryel',
    zones: [
      { name: 'Jardim Goiás', outcome: 'conquered', ownerBefore: 'coyotes', ownerAfter: 'striders', rp: 46 },
      { name: 'Setor Marista', outcome: 'influence', ownerBefore: 'striders', ownerAfter: 'striders', rp: 31 },
      { name: 'Areião', outcome: 'defended', ownerBefore: 'striders', ownerAfter: 'striders', rp: 22 },
      { name: 'Parque Flamboyant', outcome: 'influence', ownerBefore: 'volt', ownerAfter: 'volt', rp: 12 },
    ],
    level: { reached: 8, xpToNext: 1900, progressToNext: 0.05, totals: { meters: 86_000, zones: 14, runs: 23 } },
    boss: { name: 'Mormaço de Outubro', defeated: true, myDamageMeters: 6300, cityName: 'Goiânia', cityMeters: 3_600_000, days: 5, crew: { name: 'Flamboyant Runners', rank: 1, meters: 412_000 } },
    route: demoSharedRoute(),
    isDemo: true,
    ...over,
  };
}

/** Semana de 19 a 25 de outubro de 2026 (segunda a domingo). */
export function demoWeekInput(over: Partial<ShareWeekInput> = {}): ShareWeekInput {
  const second = DEMO_ROUTE_M.map(([x, y]) => metersToLatLng([-y * 0.9, -x * 1.1]));
  const third = DEMO_ROUTE_M.map(([x, y]) => metersToLatLng([x * 1.15 + 600, -y * 0.85 - 300]));
  return {
    faction: 'striders',
    weekStart: { year: 2026, month: 10, day: 19 },
    dayMeters: [0, 4100, 0, 3600, 0, 4700, 0],
    runs: 3,
    movingSeconds: 3840,
    zones: 4,
    streakWeeks: 4,
    routes: [demoSharedRoute(), clipRouteForSharing(second, [], { seed: 3 }), clipRouteForSharing(third, [], { seed: 5 })],
    city: 'Goiânia',
    username: 'gabryel',
    isDemo: true,
    ...over,
  };
}
