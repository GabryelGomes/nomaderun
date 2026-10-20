/**
 * Sessão de corrida (RF-004, RF-005, RF-025, UC-01).
 *
 * Cada ponto vai primeiro para a fila SQLite (com `seq`) e só depois para a tela; a cada 5 s o
 * sync envia os lotes assinados. GPS real: `watchPositionAsync` (Expo Go) ou a tarefa de
 * segundo plano (development build com `extra.backgroundLocation`), que grava direto na fila
 * enquanto esta sessão lê os pontos novos de lá. Simulação: volta no Parque Flamboyant em 10×,
 * com cadência realista. A tela fica acesa durante a corrida (expo-keep-awake).
 */
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { chestsInReach, CHEST_XP, ghostGap, type Chest } from '@/domain/games';
import { distanceMeters } from '@/domain/geo';
import { addPoint, averagePace, livePace, startRun, type LiveRun } from '@/domain/run-engine';
import type { LatLng } from '@/domain/types';
import { seedChests } from '@/demo/demo-data';
import { setBackgroundRun } from '@/services/location/background-task';
import { backgroundLocationEnabled, startBackgroundUpdates, stopBackgroundUpdates, watchFixes, type Fix, type FixSubscription } from '@/services/location/tracker';
import { getQueueStore } from '@/services/offline/queue';
import type { NewPoint, QueuedPoint } from '@/services/offline/types';
import { createCadence, stepCounter } from '@/services/sensors/step-counter';
import { SYNC_INTERVAL_MS } from '@/services/sync/sync-engine';
import { getSyncEngine } from '@/services/sync/sync-service';
import { useGame, type LocalRun } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { useZones } from '@/store/zones-store';
import { factions } from '@/theme/tokens';

import { setActiveRunId } from './active-run';
import { confirmRun, endRun, recordPoints, setRunPaused, startRecording } from './run-controller';
import { toGeoPoints } from './summary-model';
import { nearestNeutral, SIM_SPEED_MPS, simulationRoute } from './simulation';
import { createVoiceGuide, type VoiceGuide } from './voice-guide';

export type RunMode = 'gps' | 'simulacao';
export type Phase = 'countdown' | 'running' | 'paused' | 'finishing';

export const SIM_SPM = 168;
export const SIM_TIME_SCALE = 10; // um segundo simulado a cada 100 ms
const SIM_ALTITUDE = 750;

/** Baús da simulação: os dois primeiros ficam na rota para dar para testar a Caça. */
function simulationChests(route: LatLng[]): Chest[] {
  return seedChests(route[Math.floor(route.length * 0.15)]).map((c, i) =>
    i < 2 ? { ...c, position: route[Math.floor(route.length * (0.12 + i * 0.18))] } : c,
  );
}

export type ChestToast = { id: string; rarity: Chest['rarity']; xp: number };

export type FinishOutcome = { run: LocalRun | null; confirmed: boolean };

export function useRunSession(mode: RunMode) {
  const mission = useGame((s) => s.mission);
  const ghostPace = useGame((s) => s.ghostPace);
  const openChest = useGame((s) => s.openChest);
  const alreadyOpened = useGame((s) => s.openedChests);

  const [simRoute] = useState(() => (mode === 'simulacao' ? simulationRoute(nearestNeutral(useZones.getState().zones) ?? undefined) : []));
  const [chests, setChests] = useState<Chest[]>(() => (mode === 'simulacao' ? simulationChests(simRoute) : []));
  const [openedIds, setOpenedIds] = useState<string[]>(alreadyOpened);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [count, setCount] = useState(3);
  const [run, setRun] = useState<LiveRun>(() => startRun(Date.now()));
  const [elapsed, setElapsed] = useState(0);
  const [voice, setVoice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chestToast, setChestToast] = useState<ChestToast | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [pedometer, setPedometer] = useState<boolean | null>(null);

  // Espelhos mutáveis lidos/escritos só dentro de callbacks (nunca durante o render).
  const live = useRef({
    run,
    phase: 'countdown' as Phase,
    opened: new Set(alreadyOpened),
    simIndex: 0,
    simClock: 0,
    runId: null as string | null,
    writes: Promise.resolve() as Promise<unknown>,
    lastReadSeq: -1,
    voice: true,
    background: false,
  });

  const guideRef = useRef<VoiceGuide | null>(null);
  const say = useCallback((text: string) => {
    if (live.current.voice) Speech.speak(text, { language: 'pt-BR', rate: 1.02 });
  }, []);
  useEffect(() => {
    guideRef.current = createVoiceGuide(say, (f) => factions[f].name);
  }, [say]);

  const changePhase = useCallback((p: Phase) => {
    live.current.phase = p;
    setPhase(p);
  }, []);

  /** Atualiza a corrida ao vivo e os eventos de jogo com um ponto já gravado na fila. */
  const show = useCallback(
    (p: QueuedPoint | (NewPoint & { seq?: number })) => {
      const l = live.current;
      const [geo] = toGeoPoints([{ ...p, seq: p.seq ?? 0 }]);
      const next = addPoint(l.run, geo);
      l.run = next;
      setRun(next);
      guideRef.current?.distance(next.meters, livePace(next));
      const faction = useGame.getState().faction ?? 'striders';
      const zone = next.currentZone ? useZones.getState().zones[next.currentZone] : undefined;
      guideRef.current?.zone(next.currentZone, zone?.owner ?? null, faction);
      if (mission === 'fuga') guideRef.current?.ghost(ghostGap(next.meters, next.movingSeconds, ghostPace));
      if (mission === 'caca') {
        for (const c of chestsInReach(geo, chests, l.opened)) {
          l.opened.add(c.id);
          setOpenedIds([...l.opened]);
          openChest(c.id, CHEST_XP[c.rarity]);
          setChestToast({ id: c.id, rarity: c.rarity, xp: CHEST_XP[c.rarity] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          guideRef.current?.chest(c.rarity);
        }
      }
    },
    [chests, ghostPace, mission, openChest],
  );

  /** Ponto novo do GPS (primeiro plano) ou da simulação: grava na fila e mostra. */
  const ingest = useCallback(
    (p: NewPoint) => {
      const l = live.current;
      if (l.phase !== 'running' || !l.runId) return;
      const id = l.runId;
      l.writes = l.writes.then(() => recordPoints(id, [p])).catch(() => setError('Não foi possível gravar o ponto no aparelho. A corrida continua.'));
      show(p);
    },
    [show],
  );

  // Contagem 3-2-1, um toque leve por número; no "Vai!" cria a corrida na fila.
  useEffect(() => {
    if (phase !== 'countdown') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const t = setTimeout(async () => {
      if (count > 1) {
        setCount(count - 1);
        return;
      }
      const startedAt = Date.now();
      const fresh = startRun(startedAt);
      live.current.run = fresh;
      setRun(fresh);
      const userId = useSession.getState().session?.userId;
      if (userId) {
        try {
          const id = await startRecording({ userId, mission, ghostPace, simulated: mode === 'simulacao', startedAt });
          live.current.runId = id;
          setRunId(id);
          setActiveRunId(id);
        } catch {
          setError('Não foi possível preparar a gravação no aparelho. Os pontos não serão salvos.');
        }
      } else {
        setError('Sessão expirada: entre de novo para salvar a corrida.');
      }
      activateKeepAwakeAsync('nomade-run').catch(() => undefined);
      changePhase('running');
      say('Corrida iniciada.');
    }, 800);
    return () => clearTimeout(t);
  }, [phase, count, say, changePhase, mission, ghostPace, mode]);

  // Simulação: relógio 10×, com cadência realista (passos inteiros).
  useEffect(() => {
    if (mode !== 'simulacao' || phase !== 'running') return;
    const cadence = createCadence(SIM_SPM);
    const id = setInterval(() => {
      const l = live.current;
      l.simClock += 1;
      setElapsed(l.simClock);
      if (l.simIndex >= simRoute.length) l.simIndex = 0;
      const p = simRoute[l.simIndex++];
      ingest({ ...p, t: l.run.startedAt + l.simClock * 1000, accuracy: 5, speed: SIM_SPEED_MPS, altitude: SIM_ALTITUDE, mocked: false, steps: cadence() });
    }, 1000 / SIM_TIME_SCALE);
    return () => clearInterval(id);
  }, [mode, phase, ingest, simRoute]);

  // GPS real: pedômetro + primeiro plano (watch) ou segundo plano (tarefa gravando na fila).
  const gpsOn = mode === 'gps' && runId !== null;
  useEffect(() => {
    if (!gpsOn || !runId) return;
    let cancelled = false;
    let sub: FixSubscription | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const hasSteps = await stepCounter.start();
      if (cancelled) return;
      setPedometer(hasSteps);
      const onFix = (f: Fix) => {
        if (cancelled) return;
        if (mission === 'caca') setChests((cs) => (cs.length ? cs : seedChests(f)));
        ingest({ ...f, steps: stepCounter.take() });
      };
      if (backgroundLocationEnabled()) {
        setBackgroundRun(runId);
        live.current.background = await startBackgroundUpdates();
      }
      if (cancelled) return;
      if (live.current.background) {
        // A tarefa grava na fila; aqui só lemos o que chegou para atualizar a tela.
        poll = setInterval(async () => {
          const l = live.current;
          const pts = await getQueueStore().readPoints(runId, l.lastReadSeq + 1, 500);
          for (const p of pts) {
            l.lastReadSeq = p.seq;
            if (mission === 'caca') setChests((cs) => (cs.length ? cs : seedChests(p)));
            show(p);
          }
        }, 1000);
      } else {
        sub = await watchFixes(onFix, (m) => setError(m));
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      if (poll) clearInterval(poll);
    };
  }, [gpsOn, runId, ingest, show, mission]);

  // Relógio de parede no modo GPS.
  useEffect(() => {
    if (mode !== 'gps' || phase !== 'running') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [mode, phase]);

  // Envio em lotes a cada 5 s durante a corrida (RF-005).
  useEffect(() => {
    if (!runId) return;
    const id = setInterval(() => {
      void live.current.writes.then(() => getSyncEngine().syncRun(runId)).catch(() => undefined);
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runId]);

  useEffect(() => {
    if (!chestToast) return;
    const t = setTimeout(() => setChestToast(null), 3000);
    return () => clearTimeout(t);
  }, [chestToast]);

  // Ao sair da tela: para GPS, pedômetro, voz e libera a tela.
  useEffect(
    () => () => {
      Speech.stop();
      stepCounter.stop();
      deactivateKeepAwake('nomade-run').catch(() => undefined);
      if (live.current.background) void stopBackgroundUpdates();
      setBackgroundRun(null);
      setActiveRunId(null);
    },
    [],
  );

  const pause = useCallback(() => {
    changePhase('paused');
    if (live.current.runId) void setRunPaused(live.current.runId, true);
  }, [changePhase]);

  const resume = useCallback(() => {
    changePhase('running');
    if (live.current.runId) void setRunPaused(live.current.runId, false);
  }, [changePhase]);

  /**
   * Segurou 600 ms: grava o fim, calcula o provisório e tenta o resultado oficial
   * (espera até FINISH_WAIT_MS; sem internet segue com o provisório e o sync confirma depois).
   */
  const finish = useCallback(async (): Promise<FinishOutcome> => {
    const l = live.current;
    changePhase('finishing');
    Speech.stop();
    if (l.background) await stopBackgroundUpdates();
    setBackgroundRun(null);
    await l.writes.catch(() => undefined);
    const id = l.runId;
    if (!id) return { run: null, confirmed: false };
    const lastT = l.run.points.length ? l.run.points[l.run.points.length - 1].t : Date.now();
    const endedAt = mode === 'simulacao' ? lastT : Math.max(lastT, Date.now());
    const local = await endRun(id, endedAt).catch(() => null);
    setActiveRunId(null);
    if (!local) return { run: null, confirmed: false };
    const outcome = await confirmRun(id);
    return { run: local, confirmed: outcome?.status === 'synced' };
  }, [changePhase, mode]);

  const ghost = mission === 'fuga' ? ghostGap(run.meters, run.movingSeconds, ghostPace) : null;
  const position = run.points.length ? run.points[run.points.length - 1] : null;
  const closed = new Set(openedIds);
  const remaining = mission === 'caca' ? chests.filter((c) => !closed.has(c.id)) : [];
  const nearestChest = position
    ? (remaining.map((c) => ({ chest: c, meters: distanceMeters(position, c.position) })).sort((a, b) => a.meters - b.meters)[0] ?? null)
    : null;

  return {
    phase,
    count,
    run,
    runId,
    elapsed,
    position,
    path: run.points as LatLng[],
    pace: livePace(run),
    avgPace: averagePace(run),
    ghost,
    chests: remaining,
    nearestChest,
    chestToast,
    voice,
    error,
    mission,
    pedometer,
    toggleVoice: () => {
      live.current.voice = !live.current.voice;
      if (!live.current.voice) Speech.stop();
      setVoice(live.current.voice);
    },
    pause,
    resume,
    finish,
  };
}
