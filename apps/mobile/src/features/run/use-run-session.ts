import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { chestsInReach, CHEST_XP, ghostGap, type Chest } from '@/domain/games';
import { distanceMeters, formatPace, offset } from '@/domain/geo';
import { addPoint, averagePace, livePace, startRun, type LiveRun } from '@/domain/run-engine';
import type { GeoPoint, LatLng } from '@/domain/types';
import { demoRoute, seedChests } from '@/demo/demo-data';
import { useGame } from '@/store/game-store';

export type RunMode = 'gps' | 'simulacao';
export type Phase = 'countdown' | 'running' | 'paused';

const SIM_SPEED_MPS = 3.2; // ~11.5 km/h, 5:12 min/km
const SIM_SPM = 168;
const SIM_TIME_SCALE = 10; // one simulated second every 100 ms

/** Resamples a polyline into one point per `stepM` meters. */
function resample(route: LatLng[], stepM: number): LatLng[] {
  const out: LatLng[] = [route[0]];
  let carry = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const seg = distanceMeters(a, b);
    if (seg === 0) continue;
    const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
    let d = stepM - carry;
    while (d <= seg) {
      out.push(offset(a, d, bearing));
      d += stepM;
    }
    carry = seg - (d - stepM);
  }
  return out;
}

/** Out and back, so the simulated runner never "teleports" when the route restarts. */
function simulationRoute(): LatLng[] {
  const outbound = resample(demoRoute(), SIM_SPEED_MPS);
  return [...outbound, ...outbound.slice(0, -1).reverse()];
}

/** Chests for the simulation: the first two sit on the route so the Caça mission can be tried. */
function simulationChests(route: LatLng[]): Chest[] {
  return seedChests(route[Math.floor(route.length * 0.15)]).map((c, i) =>
    i < 2 ? { ...c, position: route[Math.floor(route.length * (0.12 + i * 0.18))] } : c,
  );
}

export type ChestToast = { id: string; rarity: Chest['rarity']; xp: number };

export function useRunSession(mode: RunMode) {
  const mission = useGame((s) => s.mission);
  const ghostPace = useGame((s) => s.ghostPace);
  const openChest = useGame((s) => s.openChest);
  const alreadyOpened = useGame((s) => s.openedChests);

  const [simRoute] = useState(() => (mode === 'simulacao' ? simulationRoute() : []));
  const [chests, setChests] = useState<Chest[]>(() => (mode === 'simulacao' ? simulationChests(simRoute) : []));
  const [openedIds, setOpenedIds] = useState<string[]>(alreadyOpened);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [count, setCount] = useState(3);
  const [run, setRun] = useState<LiveRun>(() => startRun(Date.now()));
  const [elapsed, setElapsed] = useState(0);
  const [voice, setVoice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chestToast, setChestToast] = useState<ChestToast | null>(null);

  // Mutable mirrors read and written only inside callbacks (never during render).
  const live = useRef({ run, phase, opened: new Set(alreadyOpened), lastKm: 0, simIndex: 0, simClock: 0 });

  const say = useCallback(
    (text: string) => {
      if (voice) Speech.speak(text, { language: 'pt-BR', rate: 1.02 });
    },
    [voice],
  );

  const changePhase = useCallback((p: Phase) => {
    live.current.phase = p;
    setPhase(p);
  }, []);

  const ingest = useCallback(
    (p: GeoPoint) => {
      const l = live.current;
      if (l.phase !== 'running') return;
      const next = addPoint(l.run, p);
      l.run = next;
      setRun(next);
      const km = Math.floor(next.meters / 1000);
      if (km > l.lastKm) {
        l.lastKm = km;
        say(`${km} quilômetro${km > 1 ? 's' : ''}. Ritmo ${formatPace(livePace(next)).replace(':', ' e ')}.`);
      }
      if (mission === 'caca') {
        for (const c of chestsInReach(p, chests, l.opened)) {
          l.opened.add(c.id);
          setOpenedIds([...l.opened]);
          openChest(c.id, CHEST_XP[c.rarity]);
          setChestToast({ id: c.id, rarity: c.rarity, xp: CHEST_XP[c.rarity] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          say(c.rarity === 'lendario' ? 'Baú lendário aberto!' : `Baú ${c.rarity} aberto.`);
        }
      }
    },
    [chests, mission, openChest, say],
  );

  // 3-2-1 countdown, one light haptic per number (expo-animation: haptic paired with the visual).
  useEffect(() => {
    if (phase !== 'countdown') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const t = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1);
        return;
      }
      const fresh = startRun(Date.now());
      live.current.run = fresh;
      setRun(fresh);
      changePhase('running');
      say('Corrida iniciada.');
    }, 800);
    return () => clearTimeout(t);
  }, [phase, count, say, changePhase]);

  // Simulation clock: 10× real time, with a realistic cadence.
  useEffect(() => {
    if (mode !== 'simulacao' || phase !== 'running') return;
    const id = setInterval(() => {
      const l = live.current;
      l.simClock += 1;
      setElapsed(l.simClock);
      if (l.simIndex >= simRoute.length) l.simIndex = 0;
      const p = simRoute[l.simIndex++];
      ingest({ ...p, t: l.run.startedAt + l.simClock * 1000, accuracy: 5, steps: SIM_SPM / 60 });
    }, 1000 / SIM_TIME_SCALE);
    return () => clearInterval(id);
  }, [mode, phase, ingest, simRoute]);

  // Real GPS (foreground). Production uses a background location service (Product Book §6.1).
  useEffect(() => {
    if (mode !== 'gps' || phase === 'countdown') return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm.status !== 'granted') {
        setError('Sem permissão de localização. Ative em Ajustes ou use a simulação.');
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          if (cancelled) return;
          const here = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          if (mission === 'caca') setChests((cs) => (cs.length ? cs : seedChests(here)));
          ingest({ ...here, t: loc.timestamp, accuracy: loc.coords.accuracy ?? undefined, mocked: loc.mocked });
        },
      );
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [mode, phase, ingest, mission]);

  // Wall clock for GPS mode.
  useEffect(() => {
    if (mode !== 'gps' || phase !== 'running') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [mode, phase]);

  useEffect(() => {
    if (!chestToast) return;
    const t = setTimeout(() => setChestToast(null), 3000);
    return () => clearTimeout(t);
  }, [chestToast]);

  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

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
    toggleVoice: () => setVoice((v) => !v),
    pause: () => changePhase('paused'),
    resume: () => changePhase('running'),
  };
}
