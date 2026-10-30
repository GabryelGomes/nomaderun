/**
 * Mini-mapa 16:9 do item do feed: só o traço neon da rota sobre o grafite, sem mapa-base (sem tiles, sem
 * coordenada na tela). Aceita **só** `ServerClippedRoute` (a rota cortada pelo servidor); qualquer outro
 * valor, ou rota escondida, vira o desenho "rota protegida".
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { isServerClippedRoute, type ServerClippedRoute } from '@/services/api/feed-repo';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { miniMapPaths } from './feed-model';

export type ServerRouteMapProps = { route: ServerClippedRoute | null; color: string; width: number };

export function ServerRouteMap({ route, color, width }: ServerRouteMapProps) {
  const { colors } = useTheme();
  const height = Math.round((width * 9) / 16);
  const safe = isServerClippedRoute(route) ? route : null;
  const paths = useMemo(() => miniMapPaths(safe, width, height, 14), [safe, width, height]);
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
      {paths.length ? (
        <Svg width={width} height={height}>
          {paths.map((d, i) => (
            <Path key={`g${i}`} d={d} stroke={color} strokeOpacity={0.28} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {paths.map((d, i) => (
            <Path key={`c${i}`} d={d} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      ) : (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Svg width={44} height={44}>
            <Circle cx={22} cy={22} r={18} stroke={color} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="4 5" fill="none" />
            <Circle cx={22} cy={22} r={6} fill={color} />
          </Svg>
          <Text variant="caption" muted>
            Rota protegida
          </Text>
        </View>
      )}
    </View>
  );
}
