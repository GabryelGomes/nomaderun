// Must load before h3-js (see h3-runtime.ts).
import './h3-runtime';

import { cellToParent, latLngToCell } from 'h3-js';

import type { ActivityValidation } from './anti-cheat';
import { ZONE_RES } from './grid';
import type { ZoneEvent, ZoneGoal } from './territory';
import { FACTION_IDS, type FactionId, type GeoPoint, type LatLng } from './types';

/**
 * D-62 — Território v2, "Pintura de ruas".
 *
 * "Corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela."
 *
 * - Trecho = célula H3 res 11 (~40 m de rua), com 1 a 3 camadas de um time.
 * - Passar no trecho pinta (vazio) ou reforça (seu) 1 camada; a passada do rival tira 1 camada e, se zerar,
 *   o trecho vira do rival com 1 camada.
 * - Uma camada desbota a cada 7 dias sem passada do time dono do trecho (calculado a partir de `paintedAt`,
 *   por isso o desbotar é idempotente e não depende do horário do job).
 * - Dono da zona (H3 res 9): o time com mais trechos, com no mínimo 3. Empate mantém o dono; sem dono no
 *   empate, a zona fica neutra.
 * - Virada da v1: cada zona com dono recebe 3 trechos virtuais do dono, que valem por 7 dias.
 * - Reforço na conquista: parâmetro, desligado por padrão (D-62).
 *
 * Tudo aqui é puro: o instante vem sempre em `now` (epoch ms).
 */

export const PAINT_CELL_RES = 11;
export const PAINT_MAX_LAYERS = 3;
export const PAINT_FADE_DAYS = 7;
export const PAINT_FADE_MS = PAINT_FADE_DAYS * 24 * 60 * 60 * 1000;
/** Trechos mínimos para uma zona ter dono (~120 m de rua). */
export const ZONE_MIN_CELLS = 3;
/** Só interpola entre dois pontos válidos a até 100 m (buraco de GPS não pinta linha reta pelo quarteirão). */
export const PAINT_INTERP_MAX_M = 100;
/** Passo da amostragem entre dois pontos (menor que meio trecho, para não pular célula). */
export const PAINT_SAMPLE_M = 10;
/** Metros de rua por trecho, para mostrar "faltam N trechos (≈ X m)". */
export const PAINT_CELL_METERS = 40;
/** Herança na virada v1 → v2: trechos virtuais do dono por zona e por quanto tempo valem. */
export const PAINT_INHERIT_CELLS = 3;
export const PAINT_INHERIT_MS = PAINT_FADE_MS;
/** Sob ataque: rival com ≥ 50% dos trechos do dono, ou ≥ 3 trechos do dono virados; expira em 24 h. */
export const PAINT_ATTACK_RATIO = 0.5;
export const PAINT_ATTACK_FLIPS = 3;
export const PAINT_ATTACK_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Defesa: o dono vira de volta pelo menos 3 trechos numa corrida, ou o rival cai abaixo de 50%. */
export const PAINT_DEFENSE_RETAKES = 3;

export type PaintOptions = {
  /** D-62 / D7 da E3: ao conquistar, todos os trechos do time na zona ganham +1 camada. Desligado. */
  reinforceOnConquest: boolean;
};

export const PAINT_DEFAULTS: Readonly<PaintOptions> = Object.freeze({ reinforceOnConquest: false });

/** Um trecho pintado. `layers` é o valor em `paintedAt`; o valor atual vem de `effectiveLayers`. */
export type PaintCell = {
  cell: string;
  zoneId: string;
  faction: FactionId;
  layers: number;
  /** Última passada do time dono do trecho (ou início do relógio do desbotar), epoch ms. */
  paintedAt: number;
};

export type PaintCounts = Record<FactionId, number>;

export type PaintInheritance = { faction: FactionId; cells: number; until: number };

export type PaintAttack = {
  attacker: FactionId;
  /** Quando o ataque começou e a última virada/enfraquecimento do rival (o ataque expira 24 h depois). */
  since: number;
  lastAt: number;
  /** Trechos do dono virados pelo atacante desde `since`. */
  flips: number;
};

/** Estado de uma zona na regra v2. */
export type ZonePaint = {
  zoneId: string;
  owner: FactionId | null;
  inherited: PaintInheritance | null;
  attack: PaintAttack | null;
  blocked?: boolean;
};

export type PaintWorld = {
  /** Todos os trechos pintados das zonas que a corrida toca (o servidor carrega por `zone_id`). */
  cells: Readonly<Record<string, PaintCell>>;
  zones: Readonly<Record<string, ZonePaint>>;
};

export type PaintKind = 'novo' | 'reforco' | 'virado' | 'enfraquecido';

export type PaintCellChange = {
  cell: string;
  zoneId: string;
  kind: PaintKind;
  before: { faction: FactionId; layers: number } | null;
  after: { faction: FactionId; layers: number };
};

export type PaintSkipReason = 'bloqueada' | 'hoje';

export type PaintZoneOutcome = 'conquistada' | 'defendida' | 'reforcada' | 'atacada' | 'pintada';

export type PaintZoneChange = {
  zoneId: string;
  ownerBefore: FactionId | null;
  ownerAfter: FactionId | null;
  countsBefore: PaintCounts;
  countsAfter: PaintCounts;
  /** Do ponto de vista de quem correu. */
  outcome: PaintZoneOutcome;
  /** Trechos que esta corrida pintou na zona (novos + reforços + virados + enfraquecidos). */
  touched: number;
  flipped: number;
};

export type PaintRunInput = {
  /** Trechos percorridos, em ordem (de `paintCellsOfRun`). Repetidos contam 1 vez. */
  cells: readonly string[];
  faction: FactionId;
  now: number;
  /** Trechos que este corredor já pintou hoje (1 camada por corredor por trecho por dia). */
  paintedToday?: ReadonlySet<string>;
  /** Zonas bloqueadas (não pintam), além das marcadas com `blocked` no mundo. */
  blockedZones?: ReadonlySet<string>;
  options?: Partial<PaintOptions>;
};

export type PaintRunResult = {
  changes: PaintCellChange[];
  skipped: { cell: string; reason: PaintSkipReason }[];
  zones: PaintZoneChange[];
  /** Mesmos tipos de `territory.ts` (notificações e histórico do servidor não mudam). */
  events: ZoneEvent[];
  /** Trechos para gravar (upsert). */
  updatedCells: PaintCell[];
  /** Zonas tocadas, já com dono, herança e ataque atualizados. */
  updatedZones: ZonePaint[];
  /** Trechos que esta corrida pintou: o servidor junta ao "já pintou hoje" do corredor. */
  paintedCells: string[];
};

/* ---------- células ---------- */

export const paintCellOf = (p: LatLng) => latLngToCell(p.lat, p.lng, PAINT_CELL_RES);
export const paintZoneOf = (cell: string) => cellToParent(cell, ZONE_RES);

export const emptyPaintCounts = (): PaintCounts => ({ striders: 0, coyotes: 0, owls: 0, volt: 0 });

/** Trechos de um segmento a → b, em ordem; só interpola se a distância for ≤ PAINT_INTERP_MAX_M. */
export function cellsOfSegment(a: LatLng, b: LatLng, meters: number): string[] {
  const out = [paintCellOf(a)];
  if (meters <= PAINT_INTERP_MAX_M) {
    const n = Math.ceil(meters / PAINT_SAMPLE_M);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      out.push(paintCellOf({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }));
    }
  }
  out.push(paintCellOf(b));
  return out;
}

/**
 * Trechos pintados por uma corrida, na ordem em que foram percorridos e sem repetição.
 * Só passos válidos de `validateActivity` pintam (RN-007/008); corrida rejeitada não pinta.
 */
export function paintCellsOfRun(points: readonly GeoPoint[], validation: ActivityValidation): string[] {
  if (validation.status === 'rejected') return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of validation.steps) {
    if (!s.valid) continue;
    for (const c of cellsOfSegment(points[s.from], points[s.to], s.meters)) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return out;
}

/* ---------- camadas e desbotar ---------- */

const fadedSteps = (cell: PaintCell, now: number) => Math.floor(Math.max(0, now - cell.paintedAt) / PAINT_FADE_MS);

/** Camadas do trecho no instante `now` (0 = desbotou por completo). */
export function effectiveLayers(cell: PaintCell, now: number): number {
  return Math.max(0, Math.min(PAINT_MAX_LAYERS, cell.layers) - fadedSteps(cell, now));
}

/**
 * Materializa o desbotar em `now`: devolve o trecho com as camadas atuais (o relógio guarda o resto) ou
 * `null` se ele desbotou por completo. Idempotente: `fadeCell(fadeCell(c, t), t)` = `fadeCell(c, t)`.
 */
export function fadeCell(cell: PaintCell, now: number): PaintCell | null {
  const lost = fadedSteps(cell, now);
  const layers = Math.min(PAINT_MAX_LAYERS, cell.layers) - lost;
  if (layers <= 0) return null;
  if (lost === 0 && layers === cell.layers) return cell;
  return { ...cell, layers, paintedAt: cell.paintedAt + lost * PAINT_FADE_MS };
}

/** Job diário (substitui decaimento + fortificar na v2): o que regravar e o que apagar. */
export function fadeCells(cells: readonly PaintCell[], now: number): { kept: PaintCell[]; removed: string[] } {
  const kept: PaintCell[] = [];
  const removed: string[] = [];
  for (const c of cells) {
    const next = fadeCell(c, now);
    if (next) kept.push(next);
    else removed.push(c.cell);
  }
  return { kept, removed };
}

/** Virada de temporada (RN-006 na v2): todo trecho vivo volta a 1 camada, com o relógio reiniciado. */
export function seasonResetPaint(cells: readonly PaintCell[], now: number): { kept: PaintCell[]; removed: string[] } {
  const kept: PaintCell[] = [];
  const removed: string[] = [];
  for (const c of cells) {
    if (effectiveLayers(c, now) > 0) kept.push({ ...c, layers: 1, paintedAt: now });
    else removed.push(c.cell);
  }
  return { kept, removed };
}

/**
 * Uma passada de `faction` no trecho. Vazio (ou desbotado) → novo com 1 camada; do time → +1 (até 3) e o
 * relógio reinicia; do rival → −1 camada (o relógio dele continua) ou, se zerar, vira do time com 1.
 */
export function paintTransition(
  prev: PaintCell | null | undefined,
  cell: string,
  faction: FactionId,
  now: number,
): { next: PaintCell; kind: PaintKind } {
  const zoneId = prev?.zoneId ?? paintZoneOf(cell);
  const current = prev ? fadeCell(prev, now) : null;
  if (!current) return { next: { cell, zoneId, faction, layers: 1, paintedAt: now }, kind: 'novo' };
  if (current.faction === faction) {
    return { next: { ...current, layers: Math.min(PAINT_MAX_LAYERS, current.layers + 1), paintedAt: now }, kind: 'reforco' };
  }
  if (current.layers > 1) return { next: { ...current, layers: current.layers - 1 }, kind: 'enfraquecido' };
  return { next: { cell, zoneId, faction, layers: 1, paintedAt: now }, kind: 'virado' };
}

/* ---------- dono da zona ---------- */

/**
 * Dono pela maioria de trechos: o time com mais trechos, se tiver pelo menos ZONE_MIN_CELLS e estiver
 * sozinho no topo. Empate no topo mantém o dono atual (se ele estiver no empate); senão a zona fica neutra.
 * Simétrico entre times: não depende da ordem de FACTION_IDS.
 */
export function zoneOwnerByCells(counts: PaintCounts, currentOwner: FactionId | null): FactionId | null {
  let top = 0;
  for (const f of FACTION_IDS) top = Math.max(top, counts[f]);
  if (top < ZONE_MIN_CELLS) return null;
  const leaders = FACTION_IDS.filter((f) => counts[f] === top);
  if (leaders.length === 1) return leaders[0];
  return currentOwner && leaders.includes(currentOwner) ? currentOwner : null;
}

/** Trechos virtuais da herança que ainda valem em `now`. */
export const inheritedCells = (zone: ZonePaint, now: number) =>
  zone.inherited && now < zone.inherited.until ? zone.inherited.cells : 0;

/** Placar da zona em `now`: trechos vivos por time + herança. `cells` pode ter trechos de outras zonas. */
export function zoneCounts(zone: ZonePaint, cells: Iterable<PaintCell>, now: number): PaintCounts {
  const counts = emptyPaintCounts();
  for (const c of cells) {
    if (c.zoneId === zone.zoneId && effectiveLayers(c, now) > 0) counts[c.faction]++;
  }
  if (zone.inherited) counts[zone.inherited.faction] += inheritedCells(zone, now);
  return counts;
}

/**
 * Trechos que faltam para `faction` ficar com a zona, contando só trechos novos (estimativa honesta:
 * virar um trecho rival de 1 camada vale 2 no placar, então pode faltar menos, nunca mais).
 */
export function conquestGap(counts: PaintCounts, faction: FactionId, currentOwner: FactionId | null): number {
  if (zoneOwnerByCells(counts, currentOwner) === faction) return 0;
  const mine = counts[faction];
  let top = 0;
  for (const f of FACTION_IDS) if (f !== faction) top = Math.max(top, counts[f]);
  return Math.max(ZONE_MIN_CELLS - mine, top - mine + 1);
}

/** "≈ X m" para um número de trechos. */
export const paintGapMeters = (cells: number) => Math.max(0, cells) * PAINT_CELL_METERS;

export type PaintZoneGap = {
  goal: ZoneGoal;
  /** Trechos NOVOS a pintar (estimativa honesta: virar trecho rival só adianta). */
  cells: number;
  /** "Faltam X m" (≈ cells × 40 m). */
  meters: number;
  /** Na defesa, a outra saída: virar de volta este número de trechos do rival (0 fora da defesa). */
  retakes: number;
};

/**
 * HUD "faltam X m" da regra v2 (pedido da E6), para conquistar ou defender a zona.
 * - Zona de outro time ou neutra: `conquestGap` trechos novos.
 * - Zona sua sob ataque: trechos novos até o rival mais forte ficar abaixo de 50% dos seus
 *   (PAINT_ATTACK_RATIO), ou virar de volta PAINT_DEFENSE_RETAKES trechos (o que vier antes) — a mesma regra
 *   de `applyPaint` e de `createLiveTracker`.
 * - Zona sua sem ataque: manter (0). Zona bloqueada: nada a fazer.
 */
export function paintZoneGap(
  counts: PaintCounts,
  faction: FactionId,
  owner: FactionId | null,
  opts: { underAttack?: boolean; retaken?: number; blocked?: boolean } = {},
): PaintZoneGap {
  const gap = (goal: ZoneGoal, cells: number, retakes = 0): PaintZoneGap => ({ goal, cells, meters: paintGapMeters(cells), retakes });
  if (opts.blocked) return gap('bloqueada', 0);
  if (owner !== faction) return gap('conquistar', conquestGap(counts, faction, owner));
  if (!opts.underAttack) return gap('manter', 0);
  let rival = 0;
  for (const f of FACTION_IDS) if (f !== faction) rival = Math.max(rival, counts[f]);
  const retakes = Math.max(0, PAINT_DEFENSE_RETAKES - Math.max(0, Math.floor(opts.retaken ?? 0)));
  // Defendida quando o rival fica abaixo de 50% dos seus trechos: meus + n > rival ÷ 0,5.
  const cells = rival > 0 ? Math.max(0, Math.floor(rival / PAINT_ATTACK_RATIO) - counts[faction] + 1) : 0;
  if (cells === 0 || retakes === 0) return gap('manter', 0);
  return gap('defender', cells, retakes);
}

/** Ataque ainda vale em `now` (expira 24 h depois da última virada do rival). Corrige a E-03 na v2. */
export const paintAttackActive = (zone: ZonePaint, now: number) =>
  zone.attack !== null && now - zone.attack.lastAt <= PAINT_ATTACK_WINDOW_MS;

/** A zona está sob ataque em `now`, pelo placar atual. */
export function isZoneUnderAttackV2(zone: ZonePaint, counts: PaintCounts, now: number): boolean {
  if (!zone.owner || !zone.attack || zone.attack.attacker === zone.owner || !paintAttackActive(zone, now)) return false;
  return attackPressure(counts, zone.owner, zone.attack.attacker, zone.attack.flips);
}

function attackPressure(counts: PaintCounts, owner: FactionId, attacker: FactionId, flips: number) {
  return (counts[attacker] > 0 && counts[attacker] >= counts[owner] * PAINT_ATTACK_RATIO) || flips >= PAINT_ATTACK_FLIPS;
}

/* ---------- virada v1 → v2 ---------- */

/** D-62: na virada, cada zona com dono começa com 3 trechos virtuais do dono, que valem 7 dias. */
export function inheritZonesV1(
  zones: readonly { id: string; owner: FactionId | null; blocked?: boolean }[],
  now: number,
): ZonePaint[] {
  return zones.map((z) => ({
    zoneId: z.id,
    owner: z.blocked ? null : z.owner,
    inherited: z.owner && !z.blocked ? { faction: z.owner, cells: PAINT_INHERIT_CELLS, until: now + PAINT_INHERIT_MS } : null,
    attack: null,
    ...(z.blocked ? { blocked: true } : {}),
  }));
}

export const newZonePaint = (zoneId: string): ZonePaint => ({ zoneId, owner: null, inherited: null, attack: null });

/**
 * Reavalia o dono depois do desbotar (job diário). Devolve a zona e o evento de neutralização ou troca,
 * com os mesmos tipos de `territory.ts`.
 */
export function refreshZoneOwner(zone: ZonePaint, counts: PaintCounts, now: number): { zone: ZonePaint; events: ZoneEvent[] } {
  const inherited = zone.inherited && now < zone.inherited.until ? zone.inherited : null;
  const attack = paintAttackActive(zone, now) ? zone.attack : null;
  if (zone.blocked) return { zone: { ...zone, owner: null, inherited, attack: null }, events: [] };
  const owner = zoneOwnerByCells(counts, zone.owner);
  const events: ZoneEvent[] = [];
  if (owner !== zone.owner) {
    // Mudou de dono: sem dono novo, havia um antigo.
    if (owner) events.push({ type: 'captured', zoneId: zone.zoneId, faction: owner, from: zone.owner });
    else events.push({ type: 'neutralized', zoneId: zone.zoneId, from: zone.owner! });
  }
  return { zone: { ...zone, owner, inherited, attack: owner === zone.owner ? attack : null }, events };
}

/* ---------- aplicar uma corrida ---------- */

/**
 * Aplica a pintura de uma corrida (oficial no servidor; previsão no app). Não muda `world`.
 * `world.cells` precisa ter todos os trechos pintados das zonas que a corrida toca.
 */
export function applyPaint(world: PaintWorld, input: PaintRunInput): PaintRunResult {
  const options: PaintOptions = { ...PAINT_DEFAULTS, ...input.options };
  const { faction, now } = input;
  const overlay = new Map<string, PaintCell>();
  const get = (c: string): PaintCell | undefined => overlay.get(c) ?? world.cells[c];
  const zoneOf = (id: string) => world.zones[id] ?? newZonePaint(id);
  const isBlocked = (id: string) => (world.zones[id]?.blocked ?? false) || (input.blockedZones?.has(id) ?? false);

  const changes: PaintCellChange[] = [];
  const skipped: PaintRunResult['skipped'] = [];
  const touchedZones: string[] = [];
  const perZone = new Map<string, { touched: number; flipped: number; retaken: number; hitOwner: number }>();
  const seen = new Set<string>();

  for (const cell of input.cells) {
    if (seen.has(cell)) continue;
    seen.add(cell);
    const zoneId = paintZoneOf(cell);
    if (isBlocked(zoneId)) {
      skipped.push({ cell, reason: 'bloqueada' });
      continue;
    }
    if (input.paintedToday?.has(cell)) {
      skipped.push({ cell, reason: 'hoje' });
      continue;
    }
    const prev = get(cell);
    const prevLive = prev ? fadeCell(prev, now) : null;
    const { next, kind } = paintTransition(prev, cell, faction, now);
    overlay.set(cell, next);
    changes.push({
      cell,
      zoneId,
      kind,
      before: prevLive ? { faction: prevLive.faction, layers: prevLive.layers } : null,
      after: { faction: next.faction, layers: next.layers },
    });
    let z = perZone.get(zoneId);
    if (!z) {
      z = { touched: 0, flipped: 0, retaken: 0, hitOwner: 0 };
      perZone.set(zoneId, z);
      touchedZones.push(zoneId);
    }
    z.touched++;
    if (kind === 'virado') z.flipped++;
    const owner = zoneOf(zoneId).owner;
    if (prevLive && owner && (kind === 'virado' || kind === 'enfraquecido') && prevLive.faction === owner) z.hitOwner++;
    if (kind === 'virado' && owner === faction) z.retaken++;
  }

  // Trechos de cada zona tocada (mundo + o que a corrida mudou), agrupados uma vez só.
  const zoneCells = new Map<string, Map<string, PaintCell>>();
  const zoneOverlay = new Map<string, PaintCell[]>();
  for (const id of touchedZones) {
    zoneCells.set(id, new Map());
    zoneOverlay.set(id, []);
  }
  for (const c of Object.values(world.cells)) zoneCells.get(c.zoneId)?.set(c.cell, c);
  for (const v of overlay.values()) zoneOverlay.get(v.zoneId)?.push(v);

  const zones: PaintZoneChange[] = [];
  const events: ZoneEvent[] = [];
  const updatedZones: ZonePaint[] = [];

  for (const zoneId of touchedZones) {
    const zone = zoneOf(zoneId);
    const cellsBefore = zoneCells.get(zoneId)!;
    const countsBefore = zoneCounts(zone, cellsBefore.values(), now);
    // Placar depois = o de antes ajustado só pelos trechos que a corrida mudou (= zoneCounts dos trechos depois).
    let countsAfter: PaintCounts = { ...countsBefore };
    for (const v of zoneOverlay.get(zoneId)!) {
      const prev = cellsBefore.get(v.cell);
      if (prev && effectiveLayers(prev, now) > 0) countsAfter[prev.faction]--;
      if (effectiveLayers(v, now) > 0) countsAfter[v.faction]++;
    }
    const stats = perZone.get(zoneId)!;

    const ownerBefore = zone.owner;
    let ownerAfter = zoneOwnerByCells(countsAfter, ownerBefore);

    if (ownerAfter === faction && ownerBefore !== faction && options.reinforceOnConquest) {
      const cellsAfter = new Map(cellsBefore);
      for (const v of zoneOverlay.get(zoneId)!) cellsAfter.set(v.cell, v);
      for (const [c, v] of cellsAfter) {
        if (v.faction !== faction) continue;
        const live = fadeCell(v, now);
        if (!live) continue;
        const boosted: PaintCell = { ...live, layers: Math.min(PAINT_MAX_LAYERS, live.layers + 1), paintedAt: now };
        cellsAfter.set(c, boosted);
        overlay.set(c, boosted);
      }
      countsAfter = zoneCounts(zone, cellsAfter.values(), now);
      ownerAfter = zoneOwnerByCells(countsAfter, ownerBefore);
    }

    // Herança: some quando vence e quando a zona muda de dono.
    const liveInherit = zone.inherited && now < zone.inherited.until ? zone.inherited : null;
    const inherited = liveInherit && ownerAfter === liveInherit.faction ? liveInherit : null;
    if (inherited !== zone.inherited) {
      // Mesmo resultado de recontar com a herança nova: tira a antiga e põe a que ficou.
      countsAfter = { ...countsAfter };
      if (zone.inherited) countsAfter[zone.inherited.faction] -= inheritedCells(zone, now);
      if (inherited) countsAfter[inherited.faction] += inheritedCells({ ...zone, inherited }, now);
    }

    // Ataque (E-03 na v2: expira sozinho em 24 h).
    let attack = paintAttackActive(zone, now) ? zone.attack : null;
    let outcome: PaintZoneOutcome = 'pintada';
    const wasUnderAttack = isZoneUnderAttackV2(zone, countsBefore, now);

    if (ownerAfter !== ownerBefore) {
      attack = null;
      if (ownerAfter) events.push({ type: 'captured', zoneId, faction: ownerAfter, from: ownerBefore });
      else events.push({ type: 'neutralized', zoneId, from: ownerBefore! });
      if (ownerAfter === faction) outcome = 'conquistada';
    } else if (ownerAfter && ownerAfter !== faction) {
      if (stats.hitOwner > 0) {
        const flips = (attack && attack.attacker === faction ? attack.flips : 0) + stats.flipped;
        if (attackPressure(countsAfter, ownerAfter, faction, flips)) {
          const fresh = !attack || attack.attacker !== faction;
          attack = { attacker: faction, since: fresh ? now : attack!.since, lastAt: now, flips };
          if (fresh) events.push({ type: 'under_attack', zoneId, owner: ownerAfter, attacker: faction });
          outcome = 'atacada';
        }
      }
    } else if (ownerAfter === faction) {
      outcome = 'reforcada';
      if (attack && (!attackPressure(countsAfter, faction, attack.attacker, 0) || stats.retaken >= PAINT_DEFENSE_RETAKES)) {
        attack = null;
        if (wasUnderAttack) {
          events.push({ type: 'defended', zoneId, owner: faction });
          outcome = 'defendida';
        }
      }
    }

    const nextZone: ZonePaint = { ...zone, owner: ownerAfter, inherited, attack };
    updatedZones.push(nextZone);
    zones.push({ zoneId, ownerBefore, ownerAfter, countsBefore, countsAfter, outcome, touched: stats.touched, flipped: stats.flipped });
  }

  return {
    changes,
    skipped,
    zones,
    events,
    updatedCells: [...overlay.values()],
    updatedZones,
    paintedCells: changes.map((c) => c.cell),
  };
}
