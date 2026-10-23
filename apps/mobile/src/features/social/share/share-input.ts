/**
 * T7.2.5 — resumo da corrida → entrada do card (`ShareRunInput`) e legenda. Puro, sem React.
 *
 * Privacidade (D-78): a rota só sai daqui pelo corte do domain (`clipRouteForSharing`), com as zonas de
 * privacidade da pessoa e uma semente nova por geração. Sem as zonas (sem internet, erro), a rota NÃO sai:
 * o card vai na versão "sem rota", com aviso. A data vem sem hora.
 */
import { formatDuration, formatKm } from '@/domain/geo';
import { clipRouteForSharing, type PrivacyCircle, type SharedRoute } from '@/domain/share-privacy';
import type { FactionId, LatLng } from '@/domain/types';
import type { RunSummary } from '@/features/run/summary-model';

import type { CardBoss, CardDate, CardLevel, CardRunStatus, CardZone, ShareRunInput } from '../card';

/** Aviso quando não deu para conferir as zonas de privacidade (a rota fica escondida). */
export const PRIVACY_NOTICE_NO_ZONES = 'Sem conferir suas zonas de privacidade, a rota fica escondida.';

/** Data local (fuso do aparelho) sem hora. */
export function cardDateOf(ms: number): CardDate {
  const d = new Date(ms);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** Semente de 32 bits para o corte (nova a cada geração; quem chama sorteia). */
export function randomSeed(random: () => number = Math.random): number {
  return Math.floor(random() * 0xffffffff) >>> 0;
}

export type ShareSource = {
  summary: RunSummary;
  /** `official` = resultado do servidor; qualquer outro estado vira "provisório". */
  official: boolean;
  path: readonly LatLng[];
  /** Fim da corrida (ou início, se não houver), em ms. */
  at: number;
  faction: FactionId;
  username: string | null;
  city: string | null;
  /** Zonas de privacidade da pessoa; `null` = não deu para carregar (a rota não sai). */
  privacyZones: readonly PrivacyCircle[] | null;
  seed: number;
  isDemo: boolean;
  /** Extras que o resumo pode passar (nível novo da E7, chefão da E9). */
  level?: CardLevel | null;
  boss?: CardBoss | null;
};

export type ShareInputResult = {
  input: ShareRunInput;
  /** Aviso extra (zonas não conferidas). O aviso do corte vem de `pickCardModels`. */
  notice: string | null;
};

const OUTCOMES = new Set<CardZone['outcome']>(['conquered', 'defended', 'influence', 'none']);

export function buildShareRunInput(src: ShareSource): ShareInputResult {
  const zonesKnown = src.privacyZones !== null;
  const route: SharedRoute = clipRouteForSharing(zonesKnown ? src.path : [], src.privacyZones ?? [], { seed: src.seed, hideEnds: true });
  const status: CardRunStatus = src.official ? src.summary.status : 'provisional';
  const zones: CardZone[] = src.summary.zones.map((z) => ({
    name: z.name,
    outcome: OUTCOMES.has(z.outcome as CardZone['outcome']) ? (z.outcome as CardZone['outcome']) : 'none',
    ownerBefore: z.ownerBefore,
    ownerAfter: z.ownerAfter,
    rp: z.rp,
  }));
  return {
    input: {
      status,
      faction: src.faction,
      meters: src.summary.meters,
      movingSeconds: src.summary.movingSeconds,
      points: src.summary.rpTotal,
      date: cardDateOf(src.at),
      city: src.city,
      username: src.username,
      zones,
      level: src.level ?? null,
      boss: src.boss ?? null,
      route,
      isDemo: src.isDemo,
    },
    notice: zonesKnown || src.path.length < 2 ? null : PRIVACY_NOTICE_NO_ZONES,
  };
}

/**
 * Legenda pronta para colar ("Copiar legenda" e "Compartilhar só o texto"). Sem hora, sem cidade quando a
 * pessoa desligou, e marcada quando o dado é de demonstração.
 */
export function shareCaption(input: ShareRunInput, opts: { showCity: boolean }): string {
  const km = `${formatKm(input.meters)} km`;
  const conquered = input.zones.find((z) => z.outcome === 'conquered');
  const official = input.status === 'valid' || input.status === 'partial';
  let text: string;
  if (input.boss?.defeated && official) text = `Ajudei a derrubar ${input.boss.name} correndo ${km} no NOMADE RUN.`;
  else if (input.level && official) text = `Cheguei ao nível ${input.level.reached} no NOMADE RUN com ${km} hoje.`;
  else if (conquered && official) text = `Corri ${km} e conquistei ${conquered.name} no NOMADE RUN.`;
  else text = `Corri ${km} em ${formatDuration(input.movingSeconds)} no NOMADE RUN.`;
  if (opts.showCity && input.city) text += ` Bora pintar ${input.city}!`;
  if (input.isDemo) text += ' (dados de demonstração)';
  return text;
}
