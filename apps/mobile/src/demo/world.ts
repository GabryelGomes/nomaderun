/**
 * MUNDO DE DEMONSTRAÇÃO (D-77, T7.1.18) — nada aqui é real.
 *
 * Gera, de forma determinística (semente fixa + relógio recebido), a cidade de Goiânia que o servidor de
 * demonstração (`src/services/api/demo`) serve ao app: corredores fictícios (todos com o sufixo `.demo`),
 * crews, zonas (as mesmas de `seedZones()`), corridas anteriores do corredor de demonstração, notificações,
 * contatos e zonas de privacidade. Tudo marcado como demonstração.
 *
 * Regra do projeto: `src/demo/**` continua puro (sem React, Expo ou React Native), porque o
 * `supabase/scripts/gen-seed.ts` (Deno) importa `demo-data.ts`. Este arquivo só usa o domain e o `demo-data`.
 */
import { cellCenter, cellsAround, districtOf, zoneOf } from '@/domain/grid';
import { distanceMeters, offset } from '@/domain/geo';
import type { Zone } from '@/domain/territory';
import type { FactionId, LatLng } from '@/domain/types';

import { DEMO_CENTER, DEMO_CITY, demoCityWar, demoRoute, seedZones, zoneName } from './demo-data';

/** Todo id de usuário da demonstração começa com este prefixo (o transporte real recusa esses ids). */
export const DEMO_ID_PREFIX = 'demo-';
export const DEMO_USER_ID = `${DEMO_ID_PREFIX}corredor`;
export const DEMO_EMAIL = 'demonstracao@nomaderun.invalid';
export const DEMO_USERNAME = 'voce.demo';
/** Marca que acompanha todo dado de demonstração exportado (LGPD, compartilhar, capturas). */
export const DEMO_MARK = 'Demonstração';
/** Cidade das zonas de demonstração. */
export const DEMO_CITY_LABEL = DEMO_CITY;

export const isDemoUserId = (id: string | null | undefined): boolean => typeof id === 'string' && id.startsWith(DEMO_ID_PREFIX);

const FACTIONS: FactionId[] = ['striders', 'coyotes', 'owls', 'volt'];
const DAY_MS = 86_400_000;

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function demoRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DemoRole = 'runner' | 'moderator' | 'admin';

export type DemoStats = { rp: number; meters: number; runs: number };

export type DemoRunner = {
  id: string;
  username: string;
  faction: FactionId | null;
  city: string;
  /** Distrito (H3 res. 7) onde o corredor mais corre: escopo "Meu distrito" do ranking. */
  district: string;
  xp: number;
  trust: number;
  role: DemoRole;
  status: 'active' | 'inactive' | 'suspended';
  season: DemoStats;
  week: DemoStats;
  createdAt: number;
};

export type DemoCrew = { id: string; name: string; tag: string; faction: FactionId; inviteCode: string; leaderId: string; createdAt: number };
export type DemoMembership = { crewId: string; userId: string; role: 'leader' | 'member'; joinedAt: number };

export type DemoPoint = { seq: number; lat: number; lng: number; t: number; accuracy: number | null; speed: number | null; altitude: number | null; mocked: boolean | null; steps: number | null };

export type DemoRun = {
  id: string;
  userId: string;
  mission: 'livre' | 'fuga' | 'caca';
  startedAt: number;
  points: DemoPoint[];
  /** Corridas de outros corredores semeadas já em revisão (roteiro "moderador"). */
  review?: { reason: 'LOW_TRUST' | 'NO_PEDOMETER_LONG_RUN'; flags: string[] };
};

export type DemoNotification = {
  id: string;
  type: 'invasion' | 'territory_lost' | 'conquest' | 'moderation' | 'mission' | 'system';
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: number;
  readAt: number | null;
};

export type DemoPrivacyZone = { id: string; label: string; lat: number; lng: number; radiusM: number; createdAt: number };
export type DemoContact = { id: string; name: string; phone: string; createdAt: number };
export type DemoCity = { city: string; rp: number; activeRunners: number; eligible: boolean; score: number | null };

export type DemoWorld = {
  now: number;
  me: DemoRunner;
  /** Os outros corredores (fictícios). */
  runners: DemoRunner[];
  crews: DemoCrew[];
  memberships: DemoMembership[];
  zones: Record<string, Zone>;
  zoneNames: Record<string, string>;
  /** Corridas anteriores do corredor de demonstração (o servidor recalcula o resultado com o domain). */
  myRuns: DemoRun[];
  /** Corridas de terceiros em revisão (só no roteiro do moderador). */
  reviewRuns: DemoRun[];
  notifications: DemoNotification[];
  privacyZones: DemoPrivacyZone[];
  contacts: DemoContact[];
  cities: DemoCity[];
};

/**
 * Perfil do mundo:
 *  - `cheio`: o corredor de demonstração com histórico, crew, notificações, contatos e zona de privacidade;
 *  - `vazio`: conta nova com time escolhido e nada mais (estados vazios das telas);
 *  - `sem-time`: conta nova sem time (primeira abertura → escolha do time).
 */
export type WorldProfile = 'cheio' | 'vazio' | 'sem-time';

export type WorldOptions = {
  now: number;
  profile?: WorldProfile;
  /** O corredor de demonstração vira moderador e há corridas de terceiros em revisão. */
  moderator?: boolean;
};

const FIRST_NAMES = ['ana', 'bruno', 'carla', 'diego', 'elisa', 'fabio', 'gabi', 'heitor', 'iara', 'joao', 'kaio', 'lara', 'marcos', 'nina', 'otavio', 'paula', 'rafa', 'sara', 'teo', 'vivi', 'will', 'yara', 'zeca', 'bia'];
const CITIES = [DEMO_CITY, DEMO_CITY, DEMO_CITY, DEMO_CITY, 'Anápolis', 'Brasília'];

const CREWS: Omit<DemoCrew, 'id' | 'leaderId' | 'createdAt'>[] = [
  { name: 'Flamboyant Runners', tag: 'FLR', faction: 'striders', inviteCode: 'DEMOFLR1' },
  { name: 'Pace Goiás', tag: 'PCG', faction: 'coyotes', inviteCode: 'DEMOPCG1' },
  { name: 'Corujas do Sul', tag: 'CDS', faction: 'owls', inviteCode: 'DEMOCDS1' },
  { name: 'Volt Serra', tag: 'VLT', faction: 'volt', inviteCode: 'DEMOVLT1' },
];

/** Polilinha reamostrada com um ponto a cada `stepM` metros. */
function resample(route: LatLng[], stepM: number): LatLng[] {
  const out: LatLng[] = [route[0]];
  let carry = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const seg = distanceMeters(a, b);
    if (seg === 0) continue;
    const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
    let d = stepM - carry;
    while (d <= seg) {
      out.push(offset(a, d, bearing));
      d += stepM;
    }
    carry = seg - (d - stepM);
  }
  return out;
}

/** Pontos como a fila do app guarda: 1 por segundo a ~11,5 km/h, com passos de pedômetro. */
export function demoRunPoints(route: LatLng[], startedAt: number, opts: { shift?: LatLng; roundTrip?: boolean } = {}): DemoPoint[] {
  const base = resample(route, 3.2);
  const path = opts.roundTrip ? [...base, ...base.slice(0, -1).reverse()] : base;
  const dLat = opts.shift?.lat ?? 0;
  const dLng = opts.shift?.lng ?? 0;
  return path.map((p, s) => ({
    seq: s,
    lat: p.lat + dLat,
    lng: p.lng + dLng,
    t: startedAt + s * 1000,
    accuracy: 5,
    speed: 3.2,
    altitude: 750,
    mocked: false,
    steps: s % 5 === 0 ? 2 : 3,
  }));
}

function runner(rand: () => number, i: number, now: number, districts: string[], faction: FactionId): DemoRunner {
  const seasonRuns = 4 + Math.floor(rand() * 18);
  const seasonMeters = Math.round(seasonRuns * (3000 + rand() * 6000));
  const seasonRp = Math.round(seasonMeters / 10 + rand() * 400);
  const weekShare = 0.12 + rand() * 0.3;
  return {
    id: `${DEMO_ID_PREFIX}corredor-${String(i + 1).padStart(2, '0')}`,
    username: `${FIRST_NAMES[i % FIRST_NAMES.length]}.demo`,
    faction,
    city: CITIES[Math.floor(rand() * CITIES.length)],
    district: districts[Math.floor(rand() * districts.length)],
    xp: Math.round(seasonMeters / 100 + rand() * 900),
    trust: 70 + Math.floor(rand() * 31),
    role: 'runner',
    status: 'active',
    season: { rp: seasonRp, meters: seasonMeters, runs: seasonRuns },
    week: { rp: Math.round(seasonRp * weekShare), meters: Math.round(seasonMeters * weekShare), runs: Math.max(1, Math.round(seasonRuns * weekShare)) },
    createdAt: now - (40 + Math.floor(rand() * 200)) * DAY_MS,
  };
}

/** Desloca a rota do lago para outros cantos da cidade, para o histórico variar de zonas e neblina. */
const RUN_SHIFTS: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0.004, lng: -0.006 },
  { lat: -0.005, lng: 0.003 },
  { lat: 0.008, lng: 0.004 },
  { lat: -0.003, lng: -0.009 },
  { lat: 0.001, lng: 0.008 },
];

export function createWorld(opts: WorldOptions): DemoWorld {
  const now = opts.now;
  const profile = opts.profile ?? 'cheio';
  const full = profile === 'cheio';
  const rand = demoRandom(20261023);

  const zones = seedZones();
  const centerZone = zoneOf(DEMO_CENTER);
  // O ataque ao parque começou 6h30 antes do relógio da demonstração (o seed usa o relógio da máquina).
  const park = zones[centerZone];
  if (park) zones[centerZone] = { ...park, attackStartedAt: now - 6.5 * 3600_000 };
  const zoneNames = Object.fromEntries(Object.keys(zones).map((id) => [id, zoneName(id)]));
  const districts = [...new Set(cellsAround(centerZone, 9).map(districtOf))].sort();
  const myDistrict = districtOf(centerZone);

  const runners: DemoRunner[] = FIRST_NAMES.map((_, i) => runner(rand, i, now, districts, FACTIONS[i % FACTIONS.length]));

  const me: DemoRunner = {
    id: DEMO_USER_ID,
    username: DEMO_USERNAME,
    faction: profile === 'sem-time' ? null : 'striders',
    city: DEMO_CITY,
    district: myDistrict,
    xp: full ? 1850 : 0,
    trust: full ? 96 : 100,
    role: opts.moderator ? 'moderator' : 'runner',
    status: 'active',
    season: { rp: 0, meters: 0, runs: 0 },
    week: { rp: 0, meters: 0, runs: 0 },
    createdAt: now - (full ? 60 : 0) * DAY_MS,
  };

  // Crews: o líder é o primeiro corredor da facção; o corredor de demonstração entra na FLR no perfil cheio.
  const crews: DemoCrew[] = CREWS.map((c, i) => {
    const leader = runners.find((r) => r.faction === c.faction) ?? runners[i];
    return { ...c, id: `${DEMO_ID_PREFIX}crew-${c.tag.toLowerCase()}`, leaderId: leader.id, createdAt: now - (90 + i * 7) * DAY_MS };
  });
  const memberships: DemoMembership[] = [];
  for (const c of crews) {
    const mates = runners.filter((r) => r.faction === c.faction).slice(0, 5);
    mates.forEach((r, k) => memberships.push({ crewId: c.id, userId: r.id, role: r.id === c.leaderId ? 'leader' : 'member', joinedAt: c.createdAt + k * DAY_MS }));
  }
  if (full) memberships.push({ crewId: crews[0].id, userId: me.id, role: 'member', joinedAt: now - 30 * DAY_MS });

  // Histórico: 6 corridas nas últimas 3 semanas (a de hoje não existe: o fluxo da demonstração corre agora).
  const route = demoRoute();
  const myRuns: DemoRun[] = full
    ? RUN_SHIFTS.map((shift, k) => {
        const startedAt = now - (1 + k * 3) * DAY_MS - 2.5 * 3600_000;
        return { id: `${DEMO_ID_PREFIX}corrida-${k + 1}`, userId: me.id, mission: k === 2 ? 'caca' : 'livre', startedAt, points: demoRunPoints(route, startedAt, { shift, roundTrip: k % 3 === 0 }) };
      })
    : [];

  const reviewRuns: DemoRun[] = opts.moderator
    ? runners.slice(0, 3).map((r, k) => {
        const startedAt = now - (k + 1) * 5 * 3600_000;
        return {
          id: `${DEMO_ID_PREFIX}revisao-${k + 1}`,
          userId: r.id,
          mission: 'livre',
          startedAt,
          points: demoRunPoints(route, startedAt, { shift: RUN_SHIFTS[(k + 2) % RUN_SHIFTS.length] }),
          review: { reason: k === 1 ? 'NO_PEDOMETER_LONG_RUN' : 'LOW_TRUST', flags: [] },
        };
      })
    : [];

  const parkCenter = cellCenter(centerZone);
  const lostZone = Object.keys(zones).find((id) => zones[id].owner === 'coyotes' && distanceMeters(cellCenter(id), DEMO_CENTER) < 1500) ?? centerZone;
  const notifications: DemoNotification[] = full
    ? [
        {
          id: `${DEMO_ID_PREFIX}notificacao-1`,
          type: 'invasion',
          title: 'Alerta de Invasão!',
          body: `Seu território em ${zoneNames[centerZone]} está sendo conquistado pelos Urban Coyotes. Corra lá nas próximas 24h para defender.`,
          data: { zoneId: centerZone, lat: parkCenter.lat, lng: parkCenter.lng, demonstracao: true },
          createdAt: now - 2 * 3600_000,
          readAt: null,
        },
        {
          id: `${DEMO_ID_PREFIX}notificacao-2`,
          type: 'territory_lost',
          title: 'Território perdido',
          body: `${zoneNames[lostZone]} agora pertence aos Urban Coyotes. Corra lá para reconquistar.`,
          data: { zoneId: lostZone, demonstracao: true },
          createdAt: now - 26 * 3600_000,
          readAt: null,
        },
        {
          id: `${DEMO_ID_PREFIX}notificacao-3`,
          type: 'mission',
          title: 'Missão da semana',
          body: 'Duas corridas nesta semana mantêm a sua sequência. Falta uma.',
          data: { demonstracao: true },
          createdAt: now - 3 * DAY_MS,
          readAt: now - 3 * DAY_MS + 3600_000,
        },
        {
          id: `${DEMO_ID_PREFIX}notificacao-4`,
          type: 'system',
          title: 'Você está na demonstração',
          body: 'Tudo aqui é fictício: nenhuma corrida, zona ou mensagem sai deste aparelho.',
          data: { demonstracao: true },
          createdAt: now - 4 * DAY_MS,
          readAt: now - 4 * DAY_MS + 600_000,
        },
      ]
    : [];

  const privacyZones: DemoPrivacyZone[] = full
    ? [{ id: `${DEMO_ID_PREFIX}privacidade-1`, label: 'Casa (demonstração)', ...offset(DEMO_CENTER, 1800, 300), radiusM: 200, createdAt: now - 50 * DAY_MS }]
    : [];
  const contacts: DemoContact[] = full
    ? [
        { id: `${DEMO_ID_PREFIX}contato-1`, name: 'Mãe (demonstração)', phone: '+55 62 90000-0001', createdAt: now - 45 * DAY_MS },
        { id: `${DEMO_ID_PREFIX}contato-2`, name: 'Treinador (demonstração)', phone: '+55 62 90000-0002', createdAt: now - 44 * DAY_MS },
      ]
    : [];

  const cities: DemoCity[] = demoCityWar().map((c) => ({ city: c.city, rp: c.rp, activeRunners: c.runners, eligible: c.score !== null, score: c.score }));

  return { now, me, runners, crews, memberships, zones, zoneNames, myRuns, reviewRuns, notifications, privacyZones, contacts, cities };
}
