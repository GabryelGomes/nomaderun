/**
 * Dados do resumo de uma corrida (RF-006): primeiro a fila local (provisória ou recém-confirmada),
 * depois o histórico do servidor; se não estiver em nenhum, busca no servidor.
 */
import { useCallback, useEffect, useState } from 'react';

import type { LatLng } from '@/domain/types';
import { getActivity, getActivityPath, type ActivitySummary } from '@/services/api/activities-repo';
import { getSyncEngine } from '@/services/sync/sync-service';
import { useGame, type LocalRun } from '@/store/game-store';

import { wireSyncEvents } from './run-controller';
import { officialSummary, type RunSummary } from './summary-model';

export type RecordState = 'loading' | 'missing' | 'provisional' | 'syncing' | 'official' | 'failed';

export type RunRecordView = {
  state: RecordState;
  summary: RunSummary | null;
  path: LatLng[];
  simulated: boolean;
  mission: LocalRun['mission'];
  endedAt: number | null;
  error: string | null;
};

export function recordFromLocal(local: LocalRun): RunRecordView {
  const state: RecordState =
    local.state === 'synced' ? 'official' : local.state === 'failed' ? 'failed' : local.state === 'syncing' ? 'syncing' : 'provisional';
  return { state, summary: local.summary, path: local.path, simulated: local.simulated, mission: local.mission, endedAt: local.endedAt, error: local.error };
}

export function recordFromServer(a: ActivitySummary, path: LatLng[]): RunRecordView {
  return {
    state: a.result ? 'official' : 'syncing',
    summary: a.result ? officialSummary(a.result) : null,
    path,
    simulated: false,
    mission: a.mission,
    endedAt: a.endedAt,
    error: null,
  };
}

export function useRunRecord(id: string | undefined) {
  const local = useGame((s) => (id ? s.localRuns.find((r) => r.id === id) : undefined));
  const listed = useGame((s) => (id ? s.serverRuns.find((r) => r.id === id) : undefined));
  const [fetched, setFetched] = useState<ActivitySummary | null | undefined>(undefined);
  const [serverPath, setServerPath] = useState<LatLng[]>([]);
  const [retrying, setRetrying] = useState(false);

  const needsServer = !!id && (!local || local.path.length === 0);
  useEffect(() => {
    if (!id || !needsServer) return;
    let alive = true;
    void getActivityPath(id).then((r) => alive && r.ok && setServerPath(r.data));
    if (!local && !listed) void getActivity(id).then((r) => alive && setFetched(r.ok ? r.data : null));
    return () => {
      alive = false;
    };
  }, [id, needsServer, local, listed]);

  // Corrida ainda provisória: tenta confirmar ao abrir o resumo.
  const pending = local?.state === 'pending';
  useEffect(() => {
    wireSyncEvents();
    if (id && pending) void getSyncEngine().syncRun(id).catch(() => undefined);
  }, [id, pending]);

  const retry = useCallback(async () => {
    if (!id) return;
    setRetrying(true);
    await getSyncEngine()
      .syncRun(id, { force: true })
      .catch(() => undefined);
    setRetrying(false);
  }, [id]);

  let view: RunRecordView;
  if (local && (local.state !== 'synced' || local.summary)) view = recordFromLocal(local);
  else if (listed ?? fetched) view = recordFromServer((listed ?? fetched)!, serverPath);
  else view = { state: fetched === null ? 'missing' : id ? 'loading' : 'missing', summary: null, path: [], simulated: false, mission: 'livre', endedAt: null, error: null };
  if (view.path.length === 0 && serverPath.length) view = { ...view, path: serverPath };
  return { ...view, retry, retrying };
}
