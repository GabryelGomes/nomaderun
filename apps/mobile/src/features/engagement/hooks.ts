/**
 * Hooks do engajamento para as outras telas (E7, T7.2.4):
 * - `useTodayStrip()` → faixa de hoje do Mapa (E6b);
 * - `useRunRewards(official)` → bloco "Recompensas" do resumo (E6b);
 * - `useWelcomeBack()` → "Bem-vindo de volta" depois de 14+ dias (E6 liga o gatilho);
 * - `useEngagementData()` → as 4 partes do store, carregando na primeira vez.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { DailyItem } from '@/components/daily-strip';
import { useNow } from '@/features/use-now';
import { isDemoMode } from '@/services/api/env';
import { parseRunEngagement, type RunEngagement } from '@/services/api/engagement-repo';
import { useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';

import { recordRunResult, refreshEngagement } from './controller';
import { readLocal, writeLocal } from './local-store';
import { todayData, type TodayCoach, type TodayData } from './today';
import { daysAway, shouldWelcomeBack, welcomeBackCards, type WelcomeCard } from './welcome-back';

/** As 4 partes do store; dispara a primeira carga quando a pessoa está logada e nada foi lido ainda. */
export function useEngagementData() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const status = useEngagement((s) => s.status);
  const missions = useEngagement((s) => s.missions);
  const chest = useEngagement((s) => s.chest);
  const track = useEngagement((s) => s.track);
  const loadedAt = useEngagement((s) => s.loadedAt);
  const now = useNow(60_000);
  useEffect(() => {
    if (signedIn && loadedAt === null) void refreshEngagement(Date.now());
  }, [signedIn, loadedAt]);
  const refresh = useCallback(() => refreshEngagement(Date.now()), []);
  return { status, missions, chest, track, now, refresh, demo: isDemoMode() };
}

export type TodayStrip = Omit<TodayData, 'chips' | 'coach'> & {
  /** Prontos para `<DailyStrip items={…} />` (até 3, só verdades; cada um abre a tela certa). */
  items: DailyItem[];
  /** Props para `<MissionCoachCard {...coach} />` (primeira semana ou volta), ou `null`. */
  coach: (Omit<TodayCoach, 'href'> & { demo: boolean; onPress: () => void }) | null;
  loading: boolean;
};

/** Faixa de hoje do Mapa: sequência, baú do dia e missão em destaque. */
export function useTodayStrip(): TodayStrip {
  const { status, missions, chest, now, demo } = useEngagementData();
  return useMemo(() => {
    const data = todayData({ status: status.data, missions: missions.data, chest: chest.data, now });
    const items: DailyItem[] = data.chips.map((c) => ({
      key: c.key,
      testID: c.testID,
      icon: c.icon,
      value: c.value,
      label: c.label,
      tone: 'action',
      onPress: () => router.push(c.href),
    }));
    const coach = data.coach
      ? (({ href, ...rest }) => ({ ...rest, demo, onPress: () => router.push(href) }))(data.coach)
      : null;
    const loading = status.status === 'loading' || missions.status === 'loading' || chest.status === 'loading';
    return { ...data, items, coach, loading };
  }, [status, missions, chest, now, demo]);
}

/**
 * Bloco `extras.engagement` da corrida confirmada. Lê do resultado oficial e guarda no store (as telas de
 * missões e recompensas recarregam). `null` = servidor v1 (sem bloco): o resumo não mostra a seção.
 */
export function useRunRewards(official: unknown): RunEngagement | null {
  const id = (official as { activityId?: unknown } | null)?.activityId;
  const block = useMemo(() => parseRunEngagement(official), [official]);
  useEffect(() => {
    // Uma vez por corrida, mesmo que o resultado chegue de novo como outro objeto.
    if (typeof id !== 'string' || recordedRuns.has(id)) return;
    recordedRuns.add(id);
    recordRunResult(official, Date.now());
  }, [id, official]);
  return block;
}

const recordedRuns = new Set<string>();

export type WelcomeBack = {
  visible: boolean;
  daysAway: number | null;
  cards: WelcomeCard[];
  /** Fecha e não mostra de novo nesta ausência. */
  dismiss: () => void;
};

const SEEN_KEY = 'welcome-back-seen';

/** "Bem-vindo de volta": 14+ dias sem atividade, 1 vez por ausência. */
export function useWelcomeBack(): WelcomeBack {
  const { status, missions, chest, now } = useEngagementData();
  const [seenFor, setSeenFor] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void readLocal<number>(SEEN_KEY).then((v) => alive && setSeenFor(v ?? null));
    return () => {
      alive = false;
    };
  }, []);
  const last = status.data?.lastActivityAt ?? null;
  const visible = seenFor !== undefined && status.status === 'ready' && shouldWelcomeBack(last, now, seenFor);
  const dismiss = useCallback(() => {
    setSeenFor(last);
    void writeLocal(SEEN_KEY, last);
  }, [last]);
  return {
    visible,
    daysAway: daysAway(last, now),
    cards: visible ? welcomeBackCards(status.data, missions.data, chest.data) : [],
    dismiss,
  };
}
