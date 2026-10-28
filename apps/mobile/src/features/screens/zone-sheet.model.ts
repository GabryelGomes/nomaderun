/**
 * Folha da zona (T7.3.2, E6b) — contas puras: placar de 2 cores, 1 frase de regra, "faltam X m" e a ação.
 * Sem React e sem relógio (o `now` vem da tela).
 *
 * Regra do placar:
 * - **v2** (o servidor responde o `zone_paint_near`): trechos pintados por time + a herança do dono, e o
 *   "faltam X m" do `paintZoneGap` (E3);
 * - **v1** (servidor sem a pintura): domínio (`zone.influence`) e o "faltam X m" do `influenceGapV1` (E3).
 */
import type { LiveSnapshot } from '@/domain/live-events';
import { emptyPaintCounts, paintZoneGap, paintZoneOf, type PaintCounts } from '@/domain/paint';
import { DEFENSE_WINDOW_MS, influenceGapV1, isUnderAttackAt, type Zone } from '@/domain/territory';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { factions } from '@/theme/tokens';

/** Nome curto do time no placar ("Striders", "Owls"). */
export const shortTeam = (f: FactionId) => factions[f].name.split(' ').slice(-1)[0];

/** Trechos de cada time dentro da zona, no retrato da pintura, mais a herança do dono (D-62). */
export function paintCountsOf(snapshot: LiveSnapshot, zoneId: string): PaintCounts {
  const counts = emptyPaintCounts();
  for (const [cell, v] of Object.entries(snapshot.cells)) if (v.layers > 0 && paintZoneOf(cell) === zoneId) counts[v.faction]++;
  const z = snapshot.zones[zoneId];
  if (z?.owner && z.inherited) counts[z.owner] += z.inherited;
  return counts;
}

export type ZoneBar = { left: FactionId; leftValue: number; right: FactionId | null; rightValue: number; share: number };

/** Placar de 2 cores: o dono (ou o seu time, numa zona neutra) contra o rival mais forte. */
export function zoneBar(counts: Readonly<Record<FactionId, number>>, owner: FactionId | null, mine: FactionId): ZoneBar | null {
  const left = owner ?? mine;
  let right: FactionId | null = null;
  for (const f of FACTION_IDS) if (f !== left && counts[f] > 0 && (right === null || counts[f] > counts[right])) right = f;
  const l = Math.max(0, counts[left]);
  const r = right ? Math.max(0, counts[right]) : 0;
  if (l + r <= 0) return null;
  return { left, leftValue: l, right, rightValue: r, share: l / (l + r) };
}

export type ZoneView = {
  rule: 'v1' | 'v2';
  owner: FactionId | null;
  /** "Dos Night Owls · sob ataque" / "Zona neutra". */
  ownerLine: string;
  bar: ZoneBar | null;
  /** Fim da janela de defesa (ms), só com ataque valendo agora. */
  attackEndsAt: number | null;
  /** 1 frase de regra (≤ 90 caracteres). */
  ruleLine: string;
  /** "Faltam ~X m para conquistar" (ou `null` quando não há o que fazer). */
  gapLine: string | null;
  cta: string;
};

const GAP_VERB = { conquistar: 'conquistar', defender: 'defender' } as const;

export function zoneView(input: {
  zone: Zone;
  faction: FactionId;
  now: number;
  /** Retrato da pintura (regra v2) ou `null` (regra v1 / ainda sem resposta). */
  paint: LiveSnapshot | null;
  basePaceSecPerKm: number;
}): ZoneView {
  const { zone, faction, now, paint } = input;
  const attacked = isUnderAttackAt(zone, now);
  const mine = zone.owner === faction;
  const owner = zone.owner;
  const ownerLine = owner ? `Dos ${factions[owner].name}${attacked ? ' · sob ataque' : ''}` : 'Zona neutra';
  const attackEndsAt = attacked && zone.attackStartedAt !== null ? zone.attackStartedAt + DEFENSE_WINDOW_MS : null;
  const cta = mine ? (attacked ? 'Defender esta zona' : 'Reforçar esta zona') : 'Correr aqui';

  let gapLine: string | null = null;
  let bar: ZoneBar | null;
  let ruleLine: string;
  if (paint) {
    const counts = paintCountsOf(paint, zone.id);
    const meta = paint.zones[zone.id];
    bar = zoneBar(counts, owner, faction);
    const g = paintZoneGap(counts, faction, owner, { underAttack: attacked || meta?.underAttack === true, blocked: zone.blocked || meta?.blocked === true });
    if (g.goal === 'bloqueada') gapLine = 'Zona fechada para disputa';
    else if ((g.goal === 'conquistar' || g.goal === 'defender') && g.meters > 0) gapLine = `Faltam ~${g.meters} m de ruas para ${GAP_VERB[g.goal]}`;
    ruleLine = mine && attacked ? 'Pinte as ruas de volta para expulsar o rival.' : 'A zona fica com o time que pintou mais ruas nela.';
  } else {
    bar = zoneBar(zone.influence, owner, faction);
    const g = influenceGapV1({ zone, faction, now, paceSecPerKm: input.basePaceSecPerKm, basePaceSecPerKm: input.basePaceSecPerKm });
    if (g.goal === 'bloqueada') gapLine = 'Zona fechada para disputa';
    else if ((g.goal === 'conquistar' || g.goal === 'defender') && g.meters > 0) {
      gapLine = g.reachableToday ? `Faltam ~${g.meters} m aqui para ${GAP_VERB[g.goal]}` : 'Teto de hoje atingido: volte amanhã';
    }
    ruleLine = mine && attacked ? 'Corra aqui: seus pontos valem em dobro.' : 'A zona fica com o time de maior domínio aqui.';
  }
  return { rule: paint ? 'v2' : 'v1', owner, ownerLine, bar, attackEndsAt, ruleLine, gapLine, cta };
}

/** Tempo até o fim da defesa, "17:27" (h:mm). */
export function countdownText(endsAt: number, now: number): string {
  const left = Math.max(0, endsAt - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, '0')}`;
}
