/**
 * HUD da corrida ativa (T7.2.7, E6b): a ponte entre os eventos ao vivo do domain (`live-events.ts`, E3) e a
 * tela. Puro: sem React, sem relógio. Testado em `__tests__/live-hud.test.ts`.
 *
 * - `liveSnapshotFromZones`: o retrato que o `createLiveTracker` precisa, montado com o que o app já tem
 *   (dono de cada zona, herança de 3 trechos virtuais na virada da D-62, bloqueio e ataque). Sem trechos
 *   pintados: o retrato com trechos (`zone_paint_near`) chega com o repositório de pintura da E3/E9.
 * - `hudFor`: o que o cartão da zona mostra (anel, "faltam X m", zona do time, conquista provável).
 * - `toastForEvent` + `enqueueToast`: os avisos de recompensa durante a corrida, com o nível de cada evento.
 */
import { isUnderAttackAt, type Zone } from '@/domain/territory';
import type { CelebrationLevel as LiveLevel, LiveEvent, LiveSnapshot, LiveZoneState } from '@/domain/live-events';
import { PAINT_INHERIT_CELLS } from '@/domain/paint';
import type { FactionId } from '@/domain/types';

/** Nome curto de zona vindo do servidor; sem nome, a tela usa o nome local. */
export type ZoneNames = Readonly<Record<string, { name?: string | null } | undefined>>;

/**
 * Retrato dos arredores para a previsão ao vivo. Herança da D-62: zona com dono vale 3 trechos virtuais do
 * dono (é o que a gravação v2 aplica na virada). Ataque só dentro da janela (`isUnderAttackAt`, E-03).
 */
export function liveSnapshotFromZones(zones: Readonly<Record<string, Zone>>, names: ZoneNames, now: number): LiveSnapshot {
  const out: Record<string, LiveSnapshot['zones'][string]> = {};
  for (const z of Object.values(zones)) {
    out[z.id] = {
      owner: z.owner,
      name: names[z.id]?.name ?? null,
      inherited: z.owner ? PAINT_INHERIT_CELLS : 0,
      blocked: z.blocked,
      underAttack: isUnderAttackAt(z, now),
    };
  }
  return { cells: {}, zones: out };
}

/**
 * Retrato "preguiçoso": cada zona é lida do store na hora em que a corrida a toca pela 1ª vez (o tracker
 * guarda o placar dali em diante). Assim, zonas que chegam do servidor depois da largada (carga por área)
 * também valem, sem refazer o tracker.
 */
export function lazyLiveSnapshot(read: () => { zones: Readonly<Record<string, Zone>>; names: ZoneNames }, now: number): LiveSnapshot {
  const zones = new Proxy({} as Record<string, LiveSnapshot['zones'][string]>, {
    get(_t, id) {
      if (typeof id !== 'string') return undefined;
      const { zones: all, names } = read();
      const z = all[id];
      return z ? liveSnapshotFromZones({ [id]: z }, names, now).zones[id] : undefined;
    },
  });
  return { cells: {}, zones };
}

export type HudState =
  | { kind: 'searching' }
  | { kind: 'mine'; zoneId: string; owner: FactionId }
  | { kind: 'conquered'; zoneId: string }
  | { kind: 'gap'; zoneId: string; owner: FactionId | null; progress: number; gapMeters: number; mine: number };

/**
 * Estado do cartão da zona. O progresso é `meus trechos ÷ (meus trechos + os que faltam)`: honesto, sobe
 * só com a pintura e chega a 1 quando a zona vira do time.
 */
export function hudFor(current: LiveZoneState | null, faction: FactionId, conquered: readonly string[]): HudState {
  if (!current) return { kind: 'searching' };
  if (conquered.includes(current.zoneId)) return { kind: 'conquered', zoneId: current.zoneId };
  if (current.owner === faction || current.gapCells === 0) return { kind: 'mine', zoneId: current.zoneId, owner: faction };
  const mine = current.counts[faction];
  const progress = mine + current.gapCells > 0 ? mine / (mine + current.gapCells) : 0;
  return { kind: 'gap', zoneId: current.zoneId, owner: current.owner, progress, gapMeters: current.gapMeters, mine };
}

/** Escala da E5 (`RewardToast`): o nível da E3 traduzido. */
export type ToastSize = 'small' | 'medium' | 'epic';
export const TOAST_SIZE: Readonly<Record<LiveLevel, ToastSize | null>> = { micro: null, pequena: 'small', media: 'medium', epica: 'epic' };

export type RunToast = {
  id: string;
  /** Pequeno ou médio: durante a corrida não há épico. */
  size: Exclude<ToastSize, 'epic'>;
  /** A vibração do toast: entrar em zona rival já vibra com o aviso da faixa (1 vibração por fato). */
  haptics: boolean;
  /** Borda da tela acende na cor (conquista). */
  edgeGlow: boolean;
  title: string;
  subtitle?: string;
  /** Cor: time do corredor (conquista, defesa, progresso) ou do rival (entrou na zona dele). */
  faction: FactionId;
};

const PCT_TEXT: Record<25 | 50 | 75, string> = { 25: '25% da zona', 50: 'Metade da zona', 75: '75% da zona' };

/**
 * Evento ao vivo → aviso de recompensa. Eventos `micro` (trecho pintado, "faltam X m") só atualizam o HUD.
 * `name` resolve o nome da zona (servidor ou local).
 */
export function toastForEvent(e: LiveEvent, faction: FactionId, name: (zoneId: string, fromEvent: string | null) => string): RunToast | null {
  const level = TOAST_SIZE[e.level];
  if (!level) return null;
  // Durante a corrida nada pesado (E5): o épico (1ª conquista da vida) vira médio com a borda acesa.
  const size: RunToast['size'] = level === 'epic' ? 'medium' : level;
  const id = `${e.type}-${'zoneId' in e ? e.zoneId : ''}-${e.t}`;
  switch (e.type) {
    case 'zona_conquistada':
      return { id, size, haptics: true, edgeGlow: true, title: e.first ? 'Sua 1ª zona!' : 'Zona conquistada', subtitle: name(e.zoneId, e.name), faction };
    case 'zona_defendida':
      return { id, size, haptics: true, edgeGlow: false, title: 'Zona defendida', subtitle: name(e.zoneId, e.name), faction };
    case 'zona_progresso':
      return { id, size, haptics: true, edgeGlow: false, title: PCT_TEXT[e.pct], subtitle: `Faltam ${e.gapMeters} m`, faction };
    case 'zona_rival_entrou':
      return { id, size, haptics: false, edgeGlow: false, title: 'Zona rival', subtitle: name(e.zoneId, e.name), faction: e.owner };
    default:
      return null;
  }
}

const RANK: Record<RunToast['size'], number> = { small: 0, medium: 1 };
/** Fila curta: o GPS vem primeiro, então no máximo 3 avisos esperando. */
export const TOAST_QUEUE_MAX = 3;

/**
 * Põe o aviso na fila (o primeiro é o que está na tela). Cheia, sai o mais fraco que espera (nunca o que
 * está na tela); se o novo for o mais fraco de todos, ele é que fica de fora.
 */
export function enqueueToast(queue: readonly RunToast[], t: RunToast): RunToast[] {
  if (queue.some((q) => q.id === t.id)) return [...queue];
  const next = [...queue, t];
  if (next.length <= TOAST_QUEUE_MAX) return next;
  let weakest = 1;
  for (let i = 2; i < next.length; i++) if (RANK[next[i].size] < RANK[next[weakest].size]) weakest = i;
  next.splice(weakest, 1);
  return next;
}

/** Âncora do mapa da corrida: a grade de ~500 m onde o corredor está. Muda só ao cruzar a grade. */
export const ANCHOR_STEP_DEG = 0.0045;
export function mapAnchorKey(p: { lat: number; lng: number }): string {
  return `${Math.round(p.lat / ANCHOR_STEP_DEG)}:${Math.round(p.lng / ANCHOR_STEP_DEG)}`;
}
export function anchorFromKey(key: string): { lat: number; lng: number } {
  const [a, b] = key.split(':').map(Number);
  return { lat: a * ANCHOR_STEP_DEG, lng: b * ANCHOR_STEP_DEG };
}
