/**
 * T7.2.5 — tela própria do feed da crew (`/compartilhar/feed`): o "Ver tudo" do Clube e o destino do link.
 * F8-B3 (UX-22): um título só ("Corridas da crew", o mesmo do Clube), no cabeçalho com "voltar"; antes havia
 * "Feed da crew" no cabeçalho, "Corridas da crew" na tela e um X.
 */
import { router, Stack } from 'expo-router';

import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useGame } from '@/store/game-store';

import { CREW_FEED_TEXT, CrewFeed } from './crew-feed';
import { FeedSettings } from './feed-settings';

export function CrewFeedScreen() {
  const faction = useGame((s) => s.faction);
  return (
    <ScreenScroll testID="tela-feed-crew" edges={['bottom']} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: CREW_FEED_TEXT.title }} />
      <CrewFeed faction={faction} onJoinCrew={() => router.push('/clube/crew')} />
      <SectionHeader title="Privacidade do feed" />
      <FeedSettings />
    </ScreenScroll>
  );
}
