/**
 * T7.2.3 — motor da simulação de território com a regra REAL da pintura (D-62): `applyPaint`, `fadeCells`,
 * `refreshZoneOwner` e `seasonResetPaint` do domain, na mesma ordem do servidor (gravação v2 no
 * `finish-activity`, `job_fade_cells` às 03:00 e virada de temporada). Substitui a regra C própria da
 * simulação da F1 (`docs/melhoria/F1/jogo/sim/regras.ts`), que também importa este arquivo.
 *
 * Fica em `__tests__/` (fora da cobertura e da ponte das functions) e só importa o domain por caminho
 * relativo, para rodar no Jest e com `npx tsx` a partir de `docs/`.
 */
import {
  applyPaint,
  effectiveLayers,
  fadeCells,
  newZonePaint,
  PAINT_CELL_METERS,
  PAINT_FADE_MS,
  paintZoneOf,
  refreshZoneOwner,
  seasonResetPaint,
  zoneCounts,
  ZONE_MIN_CELLS,
  zoneOwnerByCells,
  type PaintCell,
  type PaintCounts,
  type PaintRunResult,
  type ZonePaint,
} from '../../paint';
import { FACTION_IDS, type FactionId } from '../../types';

/** Uma conquista do time de quem correu: zona, dono anterior e o índice do trecho que virou a zona. */
export type SimCapture = { zone: string; from: FactionId | null; to: FactionId; atCell: number };

export class PaintSim {
  private cells = new Map<string, PaintCell>();
  private zones = new Map<string, ZonePaint>();
  private byZone = new Map<string, Set<string>>();
  /** Trechos que cada corredor já pintou no dia (1 camada por corredor, trecho e dia — `paint_marks`). */
  private marks = new Map<number, Set<string>>();
  private marksDay = -1;
  private zoneOfCell = new Map<string, string>();

  /** Trechos pintados de uma zona (como gravados; o desbotar vale por `effectiveLayers`). */
  zoneCells(zoneId: string): PaintCell[] {
    const out: PaintCell[] = [];
    for (const c of this.byZone.get(zoneId) ?? []) out.push(this.cells.get(c)!);
    return out;
  }

  /**
   * Uma corrida: `cells` são os trechos na ordem do percurso (de `paintCellsOfRun`). O mundo passado ao
   * `applyPaint` é o que o servidor carrega: todos os trechos das zonas tocadas (pré-condição do contrato).
   */
  run(runner: number, cells: readonly string[], faction: FactionId, now: number, day: number): { captures: SimCapture[]; result: PaintRunResult } {
    if (day !== this.marksDay) {
      this.marks.clear();
      this.marksDay = day;
    }
    const today = this.marks.get(runner) ?? new Set<string>();
    const result = applyPaint(this.worldFor(cells), { cells, faction, now, paintedToday: today });

    for (const c of result.updatedCells) {
      this.cells.set(c.cell, c);
      let s = this.byZone.get(c.zoneId);
      if (!s) this.byZone.set(c.zoneId, (s = new Set()));
      s.add(c.cell);
    }
    for (const z of result.updatedZones) this.zones.set(z.zoneId, z);
    for (const c of result.paintedCells) today.add(c);
    this.marks.set(runner, today);

    return { captures: this.capturesOf(result, cells, faction), result };
  }

  /** O mundo que o servidor carrega para uma corrida: todos os trechos e o estado das zonas tocadas. */
  private worldFor(cells: readonly string[]): { cells: Record<string, PaintCell>; zones: Record<string, ZonePaint> } {
    const touched = new Set<string>();
    for (const c of cells) {
      let z = this.zoneOfCell.get(c);
      if (z === undefined) this.zoneOfCell.set(c, (z = paintZoneOf(c)));
      touched.add(z);
    }
    const world: { cells: Record<string, PaintCell>; zones: Record<string, ZonePaint> } = { cells: {}, zones: {} };
    for (const z of touched) {
      for (const c of this.zoneCells(z)) world.cells[c.cell] = c;
      const zp = this.zones.get(z);
      if (zp) world.zones[z] = zp;
    }
    return world;
  }

  /**
   * "E se um novato corresse agora?": aplica a corrida de alguém que nunca pintou nada sem gravar o resultado
   * (`applyPaint` não muda o mundo). Devolve as zonas que o time dele conquistaria.
   */
  probe(cells: readonly string[], faction: FactionId, now: number): SimCapture[] {
    return this.capturesOf(applyPaint(this.worldFor(cells), { cells, faction, now }), cells, faction);
  }

  /** Em que trecho da corrida cada conquista aconteceu (repetindo as trocas de placar na ordem do percurso). */
  private capturesOf(result: PaintRunResult, cells: readonly string[], faction: FactionId): SimCapture[] {
    const won = result.zones.filter((z) => z.ownerAfter === faction && z.ownerBefore !== faction);
    if (won.length === 0) return [];
    const index = new Map<string, number>();
    cells.forEach((c, i) => {
      if (!index.has(c)) index.set(c, i);
    });
    const state = new Map(won.map((z) => [z.zoneId, { counts: { ...z.countsBefore }, owner: z.ownerBefore, at: -1 }]));
    for (const ch of result.changes) {
      const s = state.get(ch.zoneId);
      if (!s || s.at >= 0) continue;
      if (ch.kind === 'novo') s.counts[faction]++;
      else if (ch.kind === 'virado') {
        s.counts[ch.before!.faction]--;
        s.counts[faction]++;
      }
      s.owner = zoneOwnerByCells(s.counts, s.owner);
      if (s.owner === faction) s.at = index.get(ch.cell) ?? cells.length - 1;
    }
    return won.map((z) => ({ zone: z.zoneId, from: z.ownerBefore, to: faction, atCell: Math.max(0, state.get(z.zoneId)!.at) }));
  }

  /** `job_fade_cells` (03:00): materializa o desbotar e reavalia o dono das zonas que perderam trechos. */
  fade(now: number): void {
    // Só os trechos com 7 dias ou mais sem passada mudam (fadeCell devolve os outros iguais).
    const due: PaintCell[] = [];
    for (const c of this.cells.values()) if (now - c.paintedAt >= PAINT_FADE_MS) due.push(c);
    this.applyCellJob(fadeCells(due, now), now);
  }

  /** Virada de temporada na v2: todo trecho vivo volta a 1 camada. */
  seasonReset(now: number): void {
    this.applyCellJob(seasonResetPaint([...this.cells.values()], now), now);
  }

  private applyCellJob({ kept, removed }: { kept: PaintCell[]; removed: string[] }, now: number) {
    const changedZones = new Set<string>();
    for (const id of removed) {
      const c = this.cells.get(id)!;
      this.cells.delete(id);
      this.byZone.get(c.zoneId)!.delete(id);
      changedZones.add(c.zoneId);
    }
    for (const c of kept) this.cells.set(c.cell, c);
    for (const z of changedZones) {
      const zone = this.zones.get(z) ?? newZonePaint(z);
      const { zone: next } = refreshZoneOwner(zone, zoneCounts(zone, this.zoneCells(z), now), now);
      this.zones.set(z, next);
    }
  }

  owner(zoneId: string): FactionId | null {
    return this.zones.get(zoneId)?.owner ?? null;
  }

  counts(zoneId: string, now: number): PaintCounts {
    return zoneCounts(this.zones.get(zoneId) ?? newZonePaint(zoneId), this.zoneCells(zoneId), now);
  }

  /**
   * Metros DENTRO da zona que um corredor de um time sem trechos nela precisa para tomá-la (mesma conta da F1:
   * virar os k trechos mais fracos do dono, com k > dono − k, k > 2º colocado e k ≥ 3; cada passada = 40 m).
   */
  costToTake(zoneId: string, now: number): number | null {
    const owner = this.owner(zoneId);
    if (!owner) return null;
    const c = this.counts(zoneId, now);
    const second = Math.max(...FACTION_IDS.filter((f) => f !== owner).map((f) => c[f]));
    const layers = this.zoneCells(zoneId)
      .filter((x) => x.faction === owner)
      .map((x) => effectiveLayers(x, now))
      .filter((l) => l > 0)
      .sort((a, b) => a - b);
    let k = 1;
    while (k <= layers.length && !(k > c[owner] - k && k > second && k >= ZONE_MIN_CELLS)) k++;
    const passes = layers.slice(0, Math.min(k, layers.length)).reduce((s, l) => s + l, 0) + Math.max(0, k - layers.length);
    return passes * PAINT_CELL_METERS;
  }
}
