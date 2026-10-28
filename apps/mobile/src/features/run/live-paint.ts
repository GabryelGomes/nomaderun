/**
 * Previsão ao vivo com o retrato da pintura (T7.3.2, E6b). Puro: sem React, sem relógio, sem rede.
 *
 * O `createLiveTracker` do domain (E3) lê o retrato uma vez, na criação. O retrato verdadeiro dos trechos
 * (`fetchPaintNear`, E3/E9) chega pela rede depois da largada e de novo a cada 1 km. Este invólucro:
 * - começa com o retrato que o app já tem (zonas do mapa, herança de 3 trechos — `lazyLiveSnapshot`);
 * - a cada retrato novo (`reseed`), cria outro tracker do domain sobre o retrato do servidor **mais** o que
 *   esta corrida já pintou (o servidor só aplica a pintura no fim), sem pintar de novo o mesmo trecho;
 * - mantém o que já aconteceu: metros, trechos, conquistas e defesas (sem repetir o aviso), e a 1ª conquista
 *   da vida só uma vez.
 *
 * O retrato vem sem autor e sem hora (D-62). A previsão continua uma previsão: o servidor decide no fim.
 */
import { createLiveTracker, type LiveEvent, type LiveSnapshot, type LiveSummary, type LiveTracker } from '@/domain/live-events';
import { distanceMeters } from '@/domain/geo';
import type { FactionId, GeoPoint, LatLng } from '@/domain/types';

/** Pede o retrato de novo quando a pessoa se afasta mais que isto do centro do último pedido. */
export const PAINT_REFETCH_METERS = 1000;
/** Depois de uma falha de rede, espera isto (no relógio dos pontos) antes de tentar de novo. */
export const PAINT_RETRY_MS = 60_000;

export type PaintSeed = { snapshot: LiveSnapshot; paintedToday: readonly string[] };

export type PaintFetchState = {
  /** Centro do último pedido que deu certo (ou que está em andamento). */
  center: LatLng | null;
  inflight: boolean;
  /** Servidor sem a pintura (regra v1 ou servidor antigo): não pede mais nesta corrida. */
  disabled: boolean;
  /** Instante (do ponto) da última falha de rede. */
  failedAt: number | null;
};

export const PAINT_FETCH_IDLE: PaintFetchState = { center: null, inflight: false, disabled: false, failedAt: null };

/** Se este ponto pede um retrato novo: o 1º ponto, ou 1 km longe do último centro (e sem pedido no ar). */
export function paintFetchDue(s: PaintFetchState, p: GeoPoint): boolean {
  if (s.disabled || s.inflight) return false;
  if (s.failedAt !== null && p.t - s.failedAt < PAINT_RETRY_MS) return false;
  if (!s.center) return true;
  return distanceMeters(s.center, p) > PAINT_REFETCH_METERS;
}

export type PaintedLiveTracker = LiveTracker & {
  /** Retrato novo do servidor: troca o tracker do domain sem perder o que a corrida já fez. */
  reseed(seed: PaintSeed): void;
  /** Quantos retratos do servidor já entraram (0 = ainda no retrato do mapa). */
  seeds(): number;
};

type CellEffect = { faction: FactionId; layers: number };

/**
 * Tracker ao vivo que aceita retratos novos no meio da corrida. `fallback` é o retrato do mapa (antes do
 * 1º retrato do servidor, e para as zonas que o retrato do servidor não traz).
 */
export function createPaintedLiveTracker(opts: { runId: string; faction: FactionId; fallback: LiveSnapshot; firstConquestEver?: boolean }): PaintedLiveTracker {
  const { runId, faction, fallback } = opts;
  /** O que esta corrida fez em cada trecho (vale por cima do retrato do servidor). */
  const runCells = new Map<string, CellEffect>();
  const conquered: string[] = [];
  const defended: string[] = [];
  let firstEver = opts.firstConquestEver ?? false;
  let seed: PaintSeed | null = null;
  let seedCount = 0;
  let offset = { meters: 0, cellsPainted: 0, cellsFlipped: 0 };
  let stopped = false;
  let lastPoint: GeoPoint | null = null;
  /** Depois de trocar o retrato, a entrada na zona em que a pessoa já estava não vira aviso de novo. */
  let suppressEntry: string | null = null;

  function snapshotFor(s: PaintSeed | null): LiveSnapshot {
    if (!s) return fallback;
    const cells: Record<string, CellEffect> = { ...s.snapshot.cells };
    for (const [cell, v] of runCells) cells[cell] = v;
    const serverZones = s.snapshot.zones;
    const zones = new Proxy({} as Record<string, LiveSnapshot['zones'][string]>, {
      get(_t, id) {
        if (typeof id !== 'string') return undefined;
        const base = serverZones[id] ?? fallback.zones[id];
        // Zona conquistada nesta corrida: já é do time na previsão (a herança do dono antigo não volta).
        if (conquered.includes(id)) return { ...(base ?? { owner: null }), owner: faction, inherited: 0 };
        return base;
      },
    });
    return { cells, zones };
  }

  function make(): LiveTracker {
    const paintedToday = new Set<string>([...(seed?.paintedToday ?? []), ...runCells.keys()]);
    return createLiveTracker({ runId, faction, snapshot: snapshotFor(seed), paintedToday, firstConquestEver: firstEver });
  }

  let tracker = make();

  /** Guarda o efeito de cada evento e devolve só o que é novo para a tela. */
  function absorb(events: LiveEvent[]): LiveEvent[] {
    const out: LiveEvent[] = [];
    for (const raw of events) {
      const e = offset.meters ? ({ ...raw, atMeters: raw.atMeters + offset.meters } as LiveEvent) : raw;
      switch (e.type) {
        case 'trecho_pintado':
          runCells.set(e.cell, { faction, layers: e.layers });
          break;
        case 'trecho_virado':
          runCells.set(e.cell, { faction, layers: 1 });
          break;
        case 'trecho_enfraquecido':
          runCells.set(e.cell, { faction: e.owner, layers: e.layersLeft });
          break;
        case 'zona_entrou':
        case 'zona_rival_entrou':
          if (suppressEntry !== null) {
            const same = e.zoneId === suppressEntry;
            suppressEntry = null;
            if (same) continue;
          }
          break;
        case 'zona_conquistada':
          if (conquered.includes(e.zoneId)) continue;
          conquered.push(e.zoneId);
          firstEver = false;
          break;
        case 'zona_defendida':
          if (defended.includes(e.zoneId)) continue;
          defended.push(e.zoneId);
          break;
        default:
          break;
      }
      out.push(e);
    }
    return out;
  }

  return {
    push(p: GeoPoint): LiveEvent[] {
      if (stopped) return [];
      const events = tracker.push(p);
      if (tracker.summary().stopped) stopped = true;
      else lastPoint = p;
      return absorb(events);
    },
    summary(): LiveSummary {
      const s = tracker.summary();
      return {
        meters: offset.meters + s.meters,
        cellsPainted: offset.cellsPainted + s.cellsPainted,
        cellsFlipped: offset.cellsFlipped + s.cellsFlipped,
        conquered: [...conquered],
        defended: [...defended],
        current: s.current,
        stopped: stopped || s.stopped,
      };
    },
    reseed(next: PaintSeed) {
      if (stopped) return;
      const s = tracker.summary();
      offset = { meters: offset.meters + s.meters, cellsPainted: offset.cellsPainted + s.cellsPainted, cellsFlipped: offset.cellsFlipped + s.cellsFlipped };
      suppressEntry = s.current?.zoneId ?? null;
      seed = next;
      seedCount++;
      tracker = make();
      // Continua do último ponto (sem ele, o trecho entre o último ponto e o próximo se perderia).
      if (lastPoint) absorb(tracker.push(lastPoint));
      suppressEntry = null;
    },
    seeds: () => seedCount,
  };
}
