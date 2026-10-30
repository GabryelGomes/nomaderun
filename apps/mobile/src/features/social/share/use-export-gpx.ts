/**
 * T7.2.5 — `useExportGpx`: GPX 1.1 da corrida → arquivo → menu do sistema (ou download na web).
 *
 *  - **Corte ligado por padrão** (D-78): começo, fim e zonas de privacidade somem, e o horário também
 *    (`buildGpx` com a `SharedRoute`). Sem as zonas (sem internet), o corte ligado não exporta nada.
 *  - **Rota completa** só com `fullRoute: true`, que a tela só passa depois de uma confirmação explícita.
 *  - Onde a E6 encaixa: detalhe da corrida → "⋯" → "Exportar GPX".
 */
import { useCallback, useRef, useState } from 'react';

import { buildGpx, gpxFileName, GPX_MIME_TYPE, GPX_UTI, type GpxPoint, type GpxSource } from '@/domain/gpx';
import { clipRouteForSharing, type PrivacyCircle } from '@/domain/share-privacy';
import { isDemoMode } from '@/services/api/env';
import { listPrivacyZones } from '@/services/api/privacy-zones-repo';

import { failureOf, SHARE_FAILURE_TEXT } from './share-flow';
import { shareTextFile } from './share-image';
import { cardDateOf, randomSeed } from './share-input';

export const GPX_HELP = 'Para subir no Strava, use "Enviar atividade" no site do Strava.';

export const GPX_TEXT = {
  export: 'Exportar GPX',
  working: 'Gerando GPX…',
  done: 'GPX pronto.',
  downloaded: 'GPX baixado.',
  noZones: 'Não deu para conferir suas zonas de privacidade. Tente de novo com internet.',
  nothingLeft: 'Sobrou pouco da rota depois de esconder o começo, o fim e suas zonas de privacidade.',
  noPoints: 'Esta corrida não tem pontos de GPS para exportar.',
} as const;

export type ExportGpxState = { kind: 'idle' } | { kind: 'working' } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

export type ExportGpxInput = {
  activityId: string;
  /** Pontos da corrida (só `lat`/`lng` contam no corte; `t`/`ele` só saem na rota completa). */
  points: readonly GpxPoint[];
  /** Quando a corrida terminou (ms): vira só a data no nome, sem hora. */
  at: number;
  /** Rota completa, sem corte. Só depois da confirmação da pessoa. */
  fullRoute?: boolean;
  /** Zonas já carregadas; sem elas, o hook busca. `null` = não deu para carregar. */
  zones?: readonly PrivacyCircle[] | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Nome do GPX: "Corrida NOMADE — 23/10/2026" (sem hora). */
export function gpxTitle(at: number): string {
  const d = cardDateOf(at);
  return `Corrida NOMADE — ${pad(d.day)}/${pad(d.month)}/${d.year}`;
}

/** Monta o GPX (puro): `null` quando não há o que exportar, com o motivo. */
export function prepareGpx(input: ExportGpxInput, zones: readonly PrivacyCircle[] | null, seed: number, demo: boolean): { xml: string } | { error: string } {
  if (input.points.length < 2) return { error: GPX_TEXT.noPoints };
  let source: GpxSource;
  if (input.fullRoute) source = { kind: 'full', points: input.points, confirmedFullRoute: true };
  else {
    if (zones === null) return { error: GPX_TEXT.noZones };
    const route = clipRouteForSharing(input.points, zones, { seed, hideEnds: true });
    if (route.mode === 'noRoute') return { error: GPX_TEXT.nothingLeft };
    source = { kind: 'shared', route };
  }
  const description = [demo ? 'Dados de demonstração.' : null, input.fullRoute ? null : 'Começo, fim e zonas de privacidade escondidos.', `Exportado do NOMADE RUN. ${GPX_HELP}`].filter(Boolean).join(' ');
  return { xml: buildGpx(source, { name: gpxTitle(input.at), description }) };
}

export type UseExportGpx = { state: ExportGpxState; exportGpx: (input: ExportGpxInput) => Promise<void>; reset: () => void };

export function useExportGpx(): UseExportGpx {
  const [state, setState] = useState<ExportGpxState>({ kind: 'idle' });
  const busy = useRef(false);

  const exportGpx = useCallback(async (input: ExportGpxInput) => {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: 'working' });
    try {
      let zones = input.zones;
      if (zones === undefined && !input.fullRoute) {
        const res = await listPrivacyZones();
        zones = res.ok ? res.data.map((z) => ({ lat: z.lat, lng: z.lng, radiusM: z.radiusM })) : null;
      }
      const built = prepareGpx(input, zones ?? (input.fullRoute ? [] : null), randomSeed(), isDemoMode());
      if ('error' in built) {
        setState({ kind: 'error', message: built.error });
        return;
      }
      const outcome = await shareTextFile({ content: built.xml, fileName: gpxFileName(input.activityId), mimeType: GPX_MIME_TYPE, uti: GPX_UTI, title: GPX_TEXT.export });
      setState(outcome === 'cancelled' ? { kind: 'idle' } : { kind: 'done', message: outcome === 'downloaded' ? GPX_TEXT.downloaded : GPX_TEXT.done });
    } catch (e) {
      setState({ kind: 'error', message: SHARE_FAILURE_TEXT[failureOf(e)] });
    } finally {
      busy.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ kind: 'idle' }), []);
  return { state, exportGpx, reset };
}
