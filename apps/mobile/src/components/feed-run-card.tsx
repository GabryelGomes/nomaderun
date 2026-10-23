import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { FactionId, LatLng } from '@/domain/types';
import { neonTeam } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { DemoBadge } from './demo-badge';
import { PressableScale } from './motion/pressable';
import { routeSvgPath, thinRoute } from './route-path';
import { TeamBadge } from './team-badge';
import { Text } from './text';

export type FeedRunCardProps = {
  testID: string;
  /** Rota da corrida. De outra pessoa: já cortada pelo domain (zonas de privacidade). */
  path: readonly LatLng[];
  /** Quando e qual modo (ex.: "Hoje, 6:42 · Livre"). */
  title: string;
  /** Distância formatada (ex.: "5,02 km"). */
  distance: string;
  /** Tempo e ritmo (ex.: "28:10 · 5:37 /km"). */
  detail?: string;
  /** Selos curtos (ex.: "2 zonas", "Baú raro"). No máximo 3 aparecem. */
  badges?: readonly string[];
  /** Versão social (feed da crew): quem correu. */
  author?: { name: string; faction: FactionId | null };
  /** Cor do traço (padrão: neon do time do autor ou laranja). */
  color?: string;
  /** Ação do canto (ex.: "Bora!" da E8). */
  aside?: ReactNode;
  demo?: boolean;
  onPress?: () => void;
};

const MINI = 88;

/** Mini-mapa da rota em SVG: só o traço neon sobre o grafite (sem mapa-base). Decorativo. */
export function RouteMiniMap({ path, color, size = MINI }: { path: readonly LatLng[]; color: string; size?: number }) {
  const { colors } = useTheme();
  const d = useMemo(() => routeSvgPath(thinRoute(path), size, size, 10), [path, size]);
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
      {d ? (
        <Svg width={size} height={size}>
          <Path d={d} stroke={color} strokeOpacity={0.35} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** Uma frase para o leitor de tela com tudo que o card mostra. */
export function feedRunLabel(p: Pick<FeedRunCardProps, 'title' | 'distance' | 'detail' | 'badges' | 'author' | 'demo'>): string {
  return [p.author?.name, p.title, p.distance, p.detail, ...(p.badges ?? []).slice(0, 3), p.demo ? 'Demonstração' : null].filter(Boolean).join(', ');
}

/** Corrida no histórico (Você › Corridas) e no feed da crew (E8), com o mini-mapa da rota. */
export function FeedRunCard({ testID, path, title, distance, detail, badges = [], author, color, aside, demo, onPress }: FeedRunCardProps) {
  const { colors } = useTheme();
  const stroke = color ?? (author?.faction ? neonTeam[author.faction] : colors.action);
  const label = feedRunLabel({ title, distance, detail, badges, author, demo });
  const body = (
    <>
      <RouteMiniMap path={path} color={stroke} />
      <View style={{ flex: 1, gap: 2 }}>
        {author ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <TeamBadge faction={author.faction} size={20} />
            <Text variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {author.name}
            </Text>
          </View>
        ) : null}
        <Text variant="caption" muted numberOfLines={1}>
          {title}
        </Text>
        <Text variant="title" tabular numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {distance}
        </Text>
        {detail ? (
          <Text variant="small" muted tabular numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        {badges.length > 0 || demo ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginTop: space[1] }}>
            {badges.slice(0, 3).map((b) => (
              <View key={b} style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken }}>
                <Text variant="caption" maxFontSizeMultiplier={1.3}>
                  {b}
                </Text>
              </View>
            ))}
            {demo ? <DemoBadge /> : null}
          </View>
        ) : null}
      </View>
      {aside ? <View style={{ alignSelf: 'center' }}>{aside}</View> : null}
    </>
  );
  const frame = {
    flexDirection: 'row' as const,
    gap: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    borderCurve: 'continuous' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  };
  return onPress ? (
    <PressableScale testID={testID} accessibilityLabel={label} accessibilityHint="Abre a corrida" onPress={onPress} hitSlop={0} style={frame}>
      {body}
    </PressableScale>
  ) : (
    <View testID={testID} accessible={!aside} accessibilityLabel={aside ? undefined : label} style={frame}>
      {body}
    </View>
  );
}
