/**
 * Adaptador dos eventos ao vivo da corrida (`LiveEvent`, E3 — `src/domain/live-events.ts`) para as
 * celebrações da E5 (`CelebrationEvent`) — T7.2.9. Puro: sem React, sem relógio (o tempo vem de `e.t`).
 *
 * A E6b usa no HUD da corrida (toast + vibração + voz, com o ritmo da E3) e no resumo (fila do
 * `CelebrationSequence`). Lembrete de honestidade: a conquista ao vivo é uma PREVISÃO (`provisional`); o
 * resultado oficial vem do servidor no resumo.
 *
 * Só 3 dos 9 eventos viram celebração (`zona_conquistada`, `zona_defendida`, `zona_progresso`). Os outros
 * são do HUD (rota engrossando, cartão da zona, "faltam X m") e devolvem `null` aqui; a vibração e a voz
 * deles saem de `createLiveFeedback`.
 */
import type { CelebrationLevel as LiveLevel, LiveEvent } from '@/domain/live-events';
import type { FactionId } from '@/domain/types';
import type { HapticPattern } from '@/theme/motion';
import { factions } from '@/theme/tokens';

import type { CelebrationEvent, CelebrationLevel } from '../queue';

/** Escala da E3 (português) → escala da E5 (D-71). */
export const LIVE_LEVEL_MAP: Readonly<Record<LiveLevel, CelebrationLevel>> = Object.freeze({ micro: 'micro', pequena: 'small', media: 'medium', epica: 'epic' });

export function celebrationLevelOf(level: LiveLevel): CelebrationLevel {
  return LIVE_LEVEL_MAP[level] ?? 'small';
}

/** Nome mostrado quando a zona ainda não tem nome (nem no evento nem no cache do mapa). */
export const UNNAMED_ZONE = 'Zona sem nome';

export type LiveAdapterContext = {
  /** Time de quem corre (o evento de conquista diz de quem era a zona, não para quem foi). */
  faction: FactionId;
  /** Nome da zona quando o evento não traz (ex.: o cache do mapa). */
  zoneName?: (zoneId: string) => string | null | undefined;
};

function zoneOf(e: LiveEvent): string | null {
  return 'zoneId' in e ? e.zoneId : null;
}

/** Nome da zona: o do evento, o do contexto ou "Zona sem nome". */
export function liveZoneName(e: LiveEvent, ctx?: Pick<LiveAdapterContext, 'zoneName'>): string {
  const own = 'name' in e ? e.name : null;
  const id = zoneOf(e);
  const fromCtx = id && ctx?.zoneName ? ctx.zoneName(id) : null;
  return (own ?? fromCtx ?? '').trim() || UNNAMED_ZONE;
}

/**
 * Id estável do evento (a mesma passada gera o mesmo id; o orquestrador e o HUD usam para não repetir):
 * `corrida:tipo:zona-ou-trecho[:marco]:instante`.
 */
export function liveEventId(e: LiveEvent): string {
  const where = 'cell' in e ? e.cell : (zoneOf(e) ?? '-');
  const mark = e.type === 'zona_progresso' ? `:${e.pct}` : '';
  return `${e.runId}:${e.type}:${where}${mark}:${e.t}`;
}

/**
 * Um `LiveEvent` → um `CelebrationEvent` (ou `null`, se o evento não é celebração). O nível vem da regra
 * (E3), não da tela: `media` → `medium`, e a 1ª conquista da vida já chega `epica` → `epic`.
 */
export function liveEventToCelebration(e: LiveEvent, ctx: LiveAdapterContext): CelebrationEvent | null {
  const level = celebrationLevelOf(e.level);
  const id = liveEventId(e);
  switch (e.type) {
    case 'zona_conquistada': {
      const zone = liveZoneName(e, ctx);
      return { id, kind: 'zone-captured', level, label: e.first ? `conquistou ${zone}, a sua primeira zona` : `conquistou ${zone}`, payload: { zone, faction: ctx.faction } };
    }
    case 'zona_defendida': {
      const zone = liveZoneName(e, ctx);
      return { id, kind: 'zone-defended', level, label: `defendeu ${zone}`, payload: { zone, faction: ctx.faction } };
    }
    case 'zona_progresso': {
      const zone = liveZoneName(e, ctx);
      return { id, kind: 'zone-milestone', level, label: `chegou a ${e.pct}% de ${zone}`, payload: { zone, fraction: e.pct / 100, gapMeters: Math.max(0, e.gapMeters) } };
    }
    default:
      return null;
  }
}

/** Vários eventos (ex.: os da corrida inteira, para o resumo): só as celebrações, sem repetir id. */
export function liveEventsToCelebrations(events: readonly LiveEvent[], ctx: LiveAdapterContext): CelebrationEvent[] {
  const seen = new Set<string>();
  const out: CelebrationEvent[] = [];
  for (const e of events) {
    const c = liveEventToCelebration(e, ctx);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/* ---------------------------------------------------------------- ritmo ao vivo (HUD) */

/** Regra de ritmo da E3: no máximo 1 vibração a cada 10 s durante a corrida, exceto a conquista. */
export const LIVE_HAPTIC_MIN_GAP_MS = 10_000;

/** Vibração de cada evento ao vivo (antes do ritmo). `null`: não vibra (seria ruído a cada ~40 m). */
export const LIVE_HAPTICS: Readonly<Record<LiveEvent['type'], HapticPattern | null>> = Object.freeze({
  trecho_pintado: null,
  trecho_virado: 'selection',
  trecho_enfraquecido: null,
  zona_entrou: null,
  zona_rival_entrou: 'tap',
  zona_progresso: 'tap',
  faltam_metros: null,
  zona_conquistada: 'success',
  zona_defendida: 'impact',
});

/** A frase falada (voz só em conquista, 75% e entrada em zona rival — E3). `null`: em silêncio. */
export function liveVoiceLine(e: LiveEvent, ctx?: Pick<LiveAdapterContext, 'zoneName'>): string | null {
  switch (e.type) {
    case 'zona_conquistada':
      return 'Zona conquistada!';
    case 'zona_progresso':
      return e.pct === 75 && e.gapMeters > 0 ? `Faltam ${Math.max(10, Math.round(e.gapMeters / 10) * 10)} metros!` : null;
    case 'zona_rival_entrou':
      return `Zona dos ${factions[e.owner].name}: ${liveZoneName(e, ctx)}`;
    default:
      return null;
  }
}

export type LiveFeedback = {
  /** O momento a mostrar (toast do HUD); `null` se o evento é só do HUD. */
  celebration: CelebrationEvent | null;
  /** Vibração depois do ritmo de 10 s (passe para `haptic()`); `null`: não vibra agora. */
  haptic: HapticPattern | null;
  /** Frase para a voz (se a pessoa ligou a voz). */
  voice: string | null;
};

/**
 * Feedback ao vivo com estado (o ritmo de 10 s). Uma instância por corrida:
 *
 * ```ts
 * const feedback = createLiveFeedback({ faction, zoneName });
 * for (const e of tracker.push(point)) {
 *   const f = feedback.push(e);
 *   if (f.haptic) haptic(f.haptic);           // já respeita a preferência "Vibração"
 *   if (f.celebration) showToast(f.celebration);
 *   if (f.voice && voiceOn) speak(f.voice);
 * }
 * ```
 */
export function createLiveFeedback(ctx: LiveAdapterContext, minGapMs: number = LIVE_HAPTIC_MIN_GAP_MS) {
  let lastAt = Number.NEGATIVE_INFINITY;
  return {
    push(e: LiveEvent): LiveFeedback {
      const want = LIVE_HAPTICS[e.type];
      let pattern: HapticPattern | null = null;
      if (want) {
        const exempt = e.type === 'zona_conquistada';
        if (exempt || e.t - lastAt >= minGapMs) {
          pattern = want;
          lastAt = e.t;
        }
      }
      return { celebration: liveEventToCelebration(e, ctx), haptic: pattern, voice: liveVoiceLine(e, ctx) };
    },
    /** Nova corrida: zera o ritmo. */
    reset() {
      lastAt = Number.NEGATIVE_INFINITY;
    },
  };
}
