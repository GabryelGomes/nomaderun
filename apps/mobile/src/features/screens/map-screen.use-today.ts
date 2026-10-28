/**
 * Mapa (T7.3.2, E6b): `useMapToday()` junta a faixa de hoje da E7 e o chefão da E3 no `MapToday` que o
 * `MapScreen` desenha. O Raid é lido ao abrir e a cada volta para a aba (sem rajada de pedidos).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useTodayStrip } from '@/features/engagement';
import { useNow } from '@/features/use-now';
import { isDemoMode } from '@/services/api/env';
import { fetchRaidCurrent, type RaidCurrent, type Unavailable } from '@/services/api/raid-repo';

import type { MapToday } from './map-screen.model';
import { mapTodayFrom } from './map-screen.today';

/** Lê o Raid de novo só se a última leitura tem mais que isto. */
const RAID_STALE_MS = 5 * 60_000;

export function useMapToday(): MapToday {
  const strip = useTodayStrip();
  const now = useNow(60_000);
  const [raid, setRaid] = useState<{ data: RaidCurrent | Unavailable; at: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const at = Date.now();
      if (raid && at - raid.at < RAID_STALE_MS) return;
      void fetchRaidCurrent().then((res) => {
        // Erro de rede: o chip some (sem número inventado) e a próxima volta para a aba tenta de novo.
        if (alive && res.ok) setRaid({ data: res.data, at });
      });
      return () => {
        alive = false;
      };
    }, [raid]),
  );

  const loaded = !strip.loading;
  return useMemo(
    () => mapTodayFrom({ strip: loaded ? strip : null, raid: raid?.data ?? null, now, demo: isDemoMode() }),
    [strip, loaded, raid, now],
  );
}
