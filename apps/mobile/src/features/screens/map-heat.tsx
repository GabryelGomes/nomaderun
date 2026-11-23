import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Chip } from '@/components/chip-row';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { heatColor, heatSpots } from '@/components/territory-map.layers';
import type { HeatSpot, MapBounds } from '@/components/territory-map.types';
import { fetchZoneHeat, type HeatPeriod } from '@/services/api/heat-repo';
import { space } from '@/theme/tokens';

import { heatBounds } from './map-heat.model';

/** Períodos do mapa de calor (RF-013): últimas 24 horas, últimos 7 dias ou a temporada. */
export const HEAT_PERIODS: readonly (readonly [HeatPeriod, string, string])[] = [
  ['24h', '24 h', 'Últimas 24 horas'],
  ['7d', '7 dias', 'Últimos 7 dias'],
  ['season', 'Temporada', 'Temporada inteira'],
];

export type HeatState = { status: 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'error'; spots: HeatSpot[] };

/** Lê o calor da área visível só com a camada ligada; troca de período ou de área relê. */
export function useZoneHeat(enabled: boolean, bounds: MapBounds, period: HeatPeriod): HeatState {
  const box = useMemo(() => heatBounds(bounds), [bounds]);
  const key = `${period}:${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`;
  // Resultado guardado com a chave do pedido: enquanto a chave atual não chega, o estado é "carregando".
  const [result, setResult] = useState<HeatState & { key: string }>({ key: '', status: 'idle', spots: [] });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void fetchZoneHeat(box, period).then((res) => {
      if (!alive) return;
      if (!res.ok) return setResult({ key, status: 'error', spots: [] });
      if (!Array.isArray(res.data)) return setResult({ key, status: 'unavailable', spots: [] });
      const spots = heatSpots(res.data);
      setResult({ key, status: spots.length ? 'ready' : 'empty', spots });
    });
    return () => {
      alive = false;
    };
  }, [enabled, box, period, key]);
  if (!enabled) return { status: 'idle', spots: [] };
  return result.key === key ? { status: result.status, spots: result.spots } : { status: 'loading', spots: result.spots };
}

const STATUS_TEXT: Record<HeatState['status'], string> = {
  idle: '',
  loading: 'Carregando o calor desta área…',
  ready: 'Mais quente = mais corridas e mais trocas de dono.',
  empty: 'Ninguém correu por aqui neste período.',
  unavailable: 'O mapa de calor ainda não chegou ao servidor.',
  error: 'Não deu para carregar o calor. Confira a conexão.',
};

/** Cartão da camada Calor: escolha do período e legenda curta. */
export function HeatPanel({ period, onPeriod, status }: { period: HeatPeriod; onPeriod: (p: HeatPeriod) => void; status: HeatState['status'] }) {
  return (
    <Surface>
      <View testID="mapa-calor" style={{ gap: space[2] }}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Período do mapa de calor" style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
          {HEAT_PERIODS.map(([key, label, spoken]) => (
            <Chip key={key} testID={`mapa-calor-${key}`} accessibilityLabel={spoken} label={label} selected={period === key} onPress={() => onPeriod(key)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 3 }}>
            {[0.3, 0.6, 1].map((w) => (
              <View key={w} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: heatColor(w), opacity: 0.35 + 0.65 * w }} />
            ))}
          </View>
          <Text testID="mapa-calor-legenda" variant="small" muted style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {STATUS_TEXT[status]}
          </Text>
        </View>
      </View>
    </Surface>
  );
}
