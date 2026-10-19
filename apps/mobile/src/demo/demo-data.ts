/**
 * DEMONSTRATION DATA — not real users or real territory.
 * The prototype has no backend yet; this file seeds a believable city around
 * Parque Flamboyant (Goiânia) so every screen can be tried. Production reads all of this from the API.
 */
import { cellCenter, cellsAround, zoneOf } from '@/domain/grid';
import { cityScore, type Chest, type ChestRarity } from '@/domain/games';
import { distanceMeters, offset } from '@/domain/geo';
import { emptyInfluence, newZone, type Zone } from '@/domain/territory';
import type { FactionId, LatLng } from '@/domain/types';

export const DEMO_CENTER: LatLng = { lat: -16.7097, lng: -49.2388 };
export const DEMO_CITY = 'Goiânia';

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const PLACES: { name: string; at: LatLng; landmark?: boolean }[] = [
  { name: 'Parque Flamboyant', at: { lat: -16.7097, lng: -49.2388 }, landmark: true },
  { name: 'Lago do Flamboyant', at: { lat: -16.7112, lng: -49.2398 }, landmark: true },
  { name: 'Shopping Flamboyant', at: { lat: -16.7108, lng: -49.2362 }, landmark: true },
  { name: 'Estádio Serra Dourada', at: { lat: -16.7066, lng: -49.2342 }, landmark: true },
  { name: 'Parque Areião', at: { lat: -16.6985, lng: -49.2508 }, landmark: true },
  { name: 'Jardim Goiás', at: { lat: -16.705, lng: -49.236 } },
  { name: 'Setor Pedro Ludovico', at: { lat: -16.722, lng: -49.247 } },
  { name: 'Setor Marista', at: { lat: -16.7, lng: -49.258 } },
  { name: 'Vila Redenção', at: { lat: -16.718, lng: -49.226 } },
  { name: 'Setor Sul', at: { lat: -16.69, lng: -49.25 } },
  { name: 'Alto da Glória', at: { lat: -16.725, lng: -49.232 } },
];

const zoneNames = new Map<string, string>();
const hoodCounters = new Map<string, number>();
const LANDMARK_ZONES = new Map(PLACES.filter((p) => p.landmark).map((p) => [zoneOf(p.at), p.name]));

/** Unique human name: the zone that contains a landmark takes its name, others "<bairro> <n>". */
export function zoneName(id: string): string {
  const cached = zoneNames.get(id);
  if (cached) return cached;
  let name = LANDMARK_ZONES.get(id);
  if (!name) {
    const c = cellCenter(id);
    const hood = PLACES.filter((p) => !p.landmark).sort((a, b) => distanceMeters(c, a.at) - distanceMeters(c, b.at))[0];
    const n = (hoodCounters.get(hood.name) ?? 0) + 1;
    hoodCounters.set(hood.name, n);
    name = `${hood.name} ${n}`;
  }
  zoneNames.set(id, name);
  return name;
}

/** Territory sectors by bearing from the park, so the demo city has readable fronts. */
function sectorOwner(p: LatLng): FactionId {
  const dy = p.lat - DEMO_CENTER.lat;
  const dx = p.lng - DEMO_CENTER.lng;
  // Borders wander with distance, like real neighborhood limits, instead of straight pie slices.
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 22 * Math.sin(Math.hypot(dx, dy) * 900); // 0 = east, 90 = north
  if (angle > -40 && angle <= 50) return 'coyotes';
  if (angle > 50 && angle <= 140) return 'volt';
  if (angle > 140 || angle <= -130) return 'striders';
  return 'owls';
}

/** Smooth value in [-1, 1] that changes over a few hundred meters: coherent patches, not salt and pepper. */
function patch(p: LatLng): number {
  return (Math.sin(p.lat * 1100 + 0.7) + Math.sin(p.lng * 950 - 1.9) + Math.sin((p.lat + p.lng) * 700)) / 3;
}

/** Two passes of a majority filter: no lone cells, no pinholes. Real territory grows in blocks. */
function tidy(zones: Record<string, Zone>) {
  for (let pass = 0; pass < 2; pass++) {
    const owners = new Map(Object.values(zones).map((z) => [z.id, z.owner]));
    for (const z of Object.values(zones)) {
      const counts = new Map<FactionId | null, number>();
      for (const n of cellsAround(z.id, 1)) {
        if (n === z.id || !owners.has(n)) continue;
        const o = owners.get(n) ?? null;
        counts.set(o, (counts.get(o) ?? 0) + 1);
      }
      const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      if (top === z.owner || n < 4) continue;
      const influence = emptyInfluence();
      if (top) influence[top] = Math.round(160 + (z.influence[z.owner ?? top] || 300));
      zones[z.id] = { ...z, owner: top, influence };
    }
  }
}

export function seedZones(): Record<string, Zone> {
  const rand = seeded(42);
  const zones: Record<string, Zone> = {};
  const centerZone = zoneOf(DEMO_CENTER);
  for (const id of cellsAround(centerZone, 9)) {
    const c = cellCenter(id);
    const d = distanceMeters(c, DEMO_CENTER);
    const r = rand();
    // Unclaimed areas come in patches and grow with distance, so the edge of the map invites exploration.
    if (d > 400 && r >= 0 && patch(c) > 0.45 - d / 9000) {
      zones[id] = newZone(id);
      continue;
    }
    const owner = d < 280 ? 'striders' : sectorOwner(c);
    const influence = emptyInfluence();
    influence[owner] = Math.round(140 + rand() * 900);
    const rival = (['striders', 'coyotes', 'owls', 'volt'] as FactionId[])[Math.floor(rand() * 4)];
    if (rival !== owner) influence[rival] = Math.round(influence[owner] * rand() * 0.35);
    zones[id] = { ...newZone(id), owner, influence, shield: Math.floor(rand() * 3) };
  }
  tidy(zones);
  // Along the east leg of the demo run: neutral and weakly held zones, so a demo run can conquer.
  const lakeLoop = 31;
  const eastLeg = [...new Set(demoRoute().slice(lakeLoop).map(zoneOf))].filter((id) => id !== centerZone);
  const half = Math.ceil(eastLeg.length / 2);
  eastLeg.forEach((id, i) => {
    const weak = emptyInfluence();
    weak.coyotes = i < half ? 12 : 40;
    zones[id] = { ...newZone(id), owner: i < half ? null : 'coyotes', influence: weak };
  });
  // The park itself is under attack by the Coyotes: the defense story of UC-02.
  const park = zones[centerZone];
  zones[centerZone] = {
    ...park,
    owner: 'striders',
    influence: { ...emptyInfluence(), striders: 1240, coyotes: 812 },
    shield: 2,
    attackStartedAt: Date.now() - 6.5 * 3600_000,
    attacker: 'coyotes',
  };
  Object.keys(zones).sort().forEach(zoneName);
  return zones;
}

/** The demo run: a loop around the park lake, then east into Coyotes territory and back. */
export function demoRoute(): LatLng[] {
  const pts: LatLng[] = [];
  const lake = { lat: -16.7108, lng: -49.2394 };
  for (let a = 200; a <= 560; a += 12) pts.push(offset(lake, 330, a));
  let p = pts[pts.length - 1];
  for (let i = 0; i < 26; i++) {
    p = offset(p, 32, 95);
    pts.push(p);
  }
  for (let i = 0; i < 12; i++) {
    p = offset(p, 32, 10);
    pts.push(p);
  }
  for (let i = 0; i < 24; i++) {
    p = offset(p, 32, 265);
    pts.push(p);
  }
  return pts;
}

export function seedChests(near: LatLng, seed = Date.now()): Chest[] {
  const rand = seeded(Math.floor(seed / 86_400_000) + 7);
  const count = 5 + Math.floor(rand() * 4);
  return Array.from({ length: count }, (_, i) => {
    const roll = rand();
    const rarity: ChestRarity = roll < 0.05 ? 'lendario' : roll < 0.3 ? 'raro' : 'comum';
    const distance = rarity === 'lendario' ? 1600 + rand() * 900 : 150 + rand() * 1200;
    return { id: `chest-${i}`, rarity, position: offset(near, distance, rand() * 360) };
  });
}

export const DEMO_RAID = {
  boss: 'Mormaço de Outubro',
  city: DEMO_CITY,
  hpKm: 3600,
  damageKm: 2312,
  endsInHours: 19,
  topCrews: [
    { name: 'Flamboyant Runners', km: 412 },
    { name: 'Pace Goiás', km: 355 },
    { name: 'Corujas do Sul', km: 298 },
  ],
};

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kaio', 'Lara', 'Marcos', 'Nina', 'Otávio', 'Paula', 'Rafa', 'Sara', 'Téo', 'Vivi', 'Will', 'Yara', 'Zeca', 'Bia', 'Caio', 'Duda', 'Enzo', 'Flora', 'Gui'];

export function demoLeague(you: { name: string; faction: FactionId; xp: number }) {
  const rand = seeded(7);
  const others = FIRST.map((n, i) => ({
    name: `${n} ${String.fromCharCode(65 + ((i * 7) % 26))}.`,
    faction: (['striders', 'coyotes', 'owls', 'volt'] as FactionId[])[Math.floor(rand() * 4)],
    points: Math.round(80 + rand() * 900),
    you: false,
  }));
  return [...others, { name: you.name, faction: you.faction, points: Math.max(1, you.xp), you: true }]
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function demoCityWar() {
  return [
    { city: 'Goiânia', rp: 1_840_000, runners: 21_400 },
    { city: 'Anápolis', rp: 560_000, runners: 3_900 },
    { city: 'Brasília', rp: 2_310_000, runners: 38_700 },
    { city: 'Uberlândia', rp: 420_000, runners: 4_100 },
    { city: 'São Paulo', rp: 6_900_000, runners: 402_000 },
    { city: 'Pirenópolis', rp: 9_000, runners: 14 },
  ]
    .map((c) => ({ ...c, score: cityScore(c.rp, c.runners) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export const DEMO_CREW = {
  name: 'Flamboyant Runners',
  tag: 'FLR',
  members: 24,
  weeklyGoalKm: 300,
  weeklyKm: 212,
  nextMeetup: { when: 'Sábado, 6h30', where: 'Portão principal do Parque Flamboyant', going: 17 },
};
