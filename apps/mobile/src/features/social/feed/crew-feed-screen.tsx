/**
 * T7.2.5 — tela própria do feed da crew (`/compartilhar/feed`). A E6 encaixa o `<CrewFeed>` no Clube na
 * onda 3; esta rota serve de atalho ("Ver tudo") e de evidência no modo demonstração.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { isDemoMode } from '@/services/api/env';
import { useGame } from '@/store/game-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CREW_FEED_TEXT, CrewFeed } from './crew-feed';
import { FeedSettings } from './feed-settings';

export function CrewFeedScreen() {
  const { colors } = useTheme();
  const faction = useGame((s) => s.faction);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <ScreenScroll testID="tela-feed-crew">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text variant="headline" style={{ flex: 1 }} accessibilityRole="header">
          {CREW_FEED_TEXT.title}
        </Text>
        {isDemoMode() ? <DemoBadge testID="feed-demonstracao" /> : null}
        <PressableScale testID="feed-fechar" accessibilityLabel="Fechar" onPress={close} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" color={colors.text} />
        </PressableScale>
      </View>
      <CrewFeed faction={faction} onJoinCrew={() => router.push('/clube/crew')} />
      <Text variant="title" accessibilityRole="header">
        Privacidade do feed
      </Text>
      <FeedSettings />
    </ScreenScroll>
  );
}
