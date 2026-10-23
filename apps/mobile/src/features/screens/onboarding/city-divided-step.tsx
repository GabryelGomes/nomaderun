import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';
import Svg from 'react-native-svg';

import { expand } from '@/components/art/neon/core';
import { StaticArt } from '@/components/art/neon/render';
import { DemoBadge } from '@/components/demo-badge';
import { FadeUp, ShimmerSkeleton, Stagger } from '@/components/motion';
import { TeamShapeGlyph } from '@/components/team-badge';
import { Text } from '@/components/text';
import { FACTION_IDS } from '@/domain/types';
import { getFactionRanking } from '@/services/api/leaderboard-repo';
import { neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CITY_BOX, CITY_STEP_MS, cityDividedNodes, cityShares, type CityShares } from './city-divided';

const EVEN = { striders: 25, volt: 25, owls: 25, coyotes: 25 } as const;

/**
 * "A cidade está dividida" (D-72): o mapa com as 4 cores e a fatia de cada time, por até 6 s. Passa sozinho para a
 * escolha do time (menos com leitor de tela, que avança pelo botão). Sem dado do servidor, a divisão de exemplo
 * aparece com o selo "Demonstração".
 */
export function CityDividedStep({ onNext }: { onNext: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<CityShares | null>(null);
  const next = useRef(onNext);
  useEffect(() => {
    next.current = onNext;
  }, [onNext]);

  useEffect(() => {
    let alive = true;
    void getFactionRanking().then((r) => {
      if (alive) setData(cityShares(r.ok ? r.data : null));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Até 6 s na tela; com leitor de tela não avança sozinho (a pessoa decide quando seguir).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    // Na web o react-native-web sempre responde "leitor ligado" (não dá para saber): lá a etapa passa sozinha.
    const reader = process.env.EXPO_OS === 'web' ? Promise.resolve(false) : AccessibilityInfo.isScreenReaderEnabled();
    void reader
      .catch(() => false)
      .then((reader) => {
        if (alive && !reader) timer = setTimeout(() => next.current(), CITY_STEP_MS);
      });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const shares = data?.shares ?? EVEN;
  const prims = useMemo(() => expand(cityDividedNodes(shares), 'leve'), [shares]);
  const artWidth = Math.min(width - space[6] * 2, 360);
  const summary = FACTION_IDS.map((f) => `${factions[f].name} ${shares[f]}%`).join(', ');

  return (
    <View testID="onboarding-cidade" style={{ gap: space[6] }}>
      <View style={{ gap: space[2] }}>
        <Text variant="headline" accessibilityRole="header">
          A cidade está dividida
        </Text>
        <Text variant="lead" muted>
          De que lado você corre?
        </Text>
      </View>
      <FadeUp delay={150} distance={16} style={{ alignItems: 'center' }}>
        <StaticArt box={{ ...CITY_BOX, width: artWidth }} prims={prims} accessibilityLabel={data ? `Mapa da cidade dividida entre os 4 times: ${summary} das zonas.` : 'Mapa da cidade dividida entre os 4 times'} testID="onboarding-cidade-mapa" />
      </FadeUp>
      {data ? (
        <Stagger delay={350} gap={space[2]}>
          {[...FACTION_IDS]
            .sort((a, b) => shares[b] - shares[a])
            .map((f) => (
              <View key={f} testID={`onboarding-cidade-${f}`} accessible accessibilityLabel={`${factions[f].name}: ${shares[f]}% das zonas`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View aria-hidden>
                  <Svg width={20} height={20}>
                    <TeamShapeGlyph shape={factions[f].shape} size={20} color={neonTeam[f]} />
                  </Svg>
                </View>
                <Text variant="bodyBold" numberOfLines={1} style={{ width: 128 }}>
                  {factions[f].name}
                </Text>
                <View style={{ flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
                  <View style={{ width: `${shares[f]}%`, height: 8, borderRadius: radius.pill, backgroundColor: neonTeam[f] }} />
                </View>
                <Text variant="bodyBold" tabular style={{ width: 44, textAlign: 'right' }}>
                  {shares[f]}%
                </Text>
              </View>
            ))}
        </Stagger>
      ) : (
        <ShimmerSkeleton shape="line" lines={4} accessibilityLabel="Carregando a divisão da cidade" testID="onboarding-cidade-carregando" />
      )}
      {data?.source === 'demonstracao' ? <DemoBadge testID="onboarding-cidade-demonstracao" label="Demonstração" /> : null}
    </View>
  );
}
