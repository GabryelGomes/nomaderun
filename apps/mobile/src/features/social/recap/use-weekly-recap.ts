/**
 * T7.3.7 — carrega o recap semanal para o card: a Edge Function `weekly-recap` da E9 (rotas já cortadas no
 * servidor). Servidor antigo: o recap montado das próprias corridas, com as zonas de privacidade e os pontos
 * das até 3 corridas mais longas (o corte, nesse caso, fica na tela com a semente da abertura).
 *
 * Sem semana pedida: a semana atual; se ela ainda não tem corrida (segunda cedo), a anterior.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PrivacyCircle } from '@/domain/share-privacy';
import type { LatLng } from '@/domain/types';
import { getActivityPath, listMyActivities } from '@/services/api/activities-repo';
import { listPrivacyZones } from '@/services/api/privacy-zones-repo';
import { getWeeklyRecap, isRecapUnavailable, type WeeklyRecap } from '@/services/api/recap-repo';
import type { Result } from '@/services/api/errors';

import { addDaysIso, mondayOf, recapFromActivities, weekStartMs } from './recap-model';

export type WeeklyRecapState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      recap: WeeklyRecap;
      /** `server` = `weekly_recap`; `local` = montado das corridas (servidor sem o recap). */
      source: 'server' | 'local';
      paths: ReadonlyMap<string, readonly LatLng[]>;
      /** `null` = não deu para carregar (as rotas não saem). */
      zones: PrivacyCircle[] | null;
    };

export type WeeklyRecapDeps = {
  /** Sequência de semanas (para o recap local). */
  streakWeeks: number;
  isDemo: boolean;
  now?: () => number;
};

async function loadWeek(weekStart: string, deps: WeeklyRecapDeps, askServer: string | null): Promise<Result<{ recap: WeeklyRecap; source: 'server' | 'local' }>> {
  const server = await getWeeklyRecap(askServer);
  if (server.ok) return { ok: true, data: { recap: server.data.weekStart ? server.data : { ...server.data, weekStart }, source: 'server' } };
  if (!isRecapUnavailable(server.error)) return server;
  const acts = await listMyActivities({ from: weekStartMs(weekStart), to: weekStartMs(addDaysIso(weekStart, 7)) });
  if (!acts.ok) return acts;
  const list = acts.data.map((a) => ({
    id: a.id,
    status: a.status,
    startedAt: a.startedAt,
    meters: a.meters,
    movingSeconds: a.movingSeconds,
    conquered: a.result?.zones?.filter((z) => z.outcome === 'conquered').length ?? 0,
  }));
  return { ok: true, data: { recap: recapFromActivities(list, weekStart, deps.streakWeeks, deps.isDemo), source: 'local' } };
}

export function useWeeklyRecap(weekStart: string | null, deps: WeeklyRecapDeps) {
  const [attempt, setAttempt] = useState(0);
  // O resultado fica preso ao pedido (semana + tentativa): pedido novo = "carregando" sem setState no efeito.
  const key = `${weekStart ?? ''}|${attempt}`;
  const [stored, setStored] = useState<{ key: string; value: WeeklyRecapState } | null>(null);
  const setState = useCallback((value: WeeklyRecapState) => setStored({ key, value }), [key]);
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = depsRef.current;
      const current = mondayOf((d.now ?? Date.now)());
      let week = await loadWeek(weekStart ?? current, d, weekStart);
      if (!weekStart && week.ok && week.data.recap.runs === 0) {
        const prevStart = addDaysIso(week.data.recap.weekStart, -7);
        const prev = await loadWeek(prevStart, d, prevStart);
        if (prev.ok && prev.data.recap.runs > 0) week = prev;
      }
      if (!alive) return;
      if (!week.ok) {
        setState({ status: 'error', message: week.error.message });
        return;
      }
      // Rotas do servidor já vêm cortadas: zonas e pontos só fazem falta no recap local.
      const local = week.data.source === 'local' && week.data.recap.activityIds.length > 0;
      const [zonesRes, ...pathRes] = local ? await Promise.all([listPrivacyZones(), ...week.data.recap.activityIds.map((id) => getActivityPath(id))]) : [null];
      if (!alive) return;
      const paths = new Map<string, readonly LatLng[]>();
      week.data.recap.activityIds.forEach((id, i) => {
        const r = pathRes[i];
        if (r?.ok && r.data.length >= 2) paths.set(id, r.data);
      });
      const zones = zonesRes?.ok ? zonesRes.data.map((z) => ({ lat: z.lat, lng: z.lng, radiusM: z.radiusM })) : null;
      setState({ status: 'ready', recap: week.data.recap, source: week.data.source, paths, zones });
    })();
    return () => {
      alive = false;
    };
  }, [weekStart, setState]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: WeeklyRecapState = stored && stored.key === key ? stored.value : { status: 'loading' };
  return { state, retry };
}
