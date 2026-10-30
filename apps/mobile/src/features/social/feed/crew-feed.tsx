/**
 * T7.2.5 — `<CrewFeed>`: o feed da crew pronto para a E6 encaixar no Clube (onda 3).
 *
 *  - só a crew vê (D-79); reações prontas "Bora!", "Fogo" e "Raio", sem comentário;
 *  - estados: carregando (esqueleto), sem crew (arte + "Entrar com código" / "Criar crew"), indisponível
 *    (servidor antigo ou feed desligado), erro sem nada carregado (tentar de novo) e erro com a última
 *    página na tela (faixa "Sem conexão…");
 *  - `embedded` (padrão): lista simples + "Ver mais", para viver dentro da `ScrollView` da tela;
 *    `embedded={false}`: `FlatList` virtualizada com paginação ao rolar (tela própria).
 */
import { FlatList, View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { OfflineNotice } from '@/components/offline-notice';
import { ShimmerSkeleton } from '@/components/motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import type { FeedItem } from '@/services/api/feed-repo';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CrewFeedCard } from './crew-feed-card';
import { localToday } from './feed-model';
import { useCrewFeed } from './use-crew-feed';

export const CREW_FEED_TEXT = {
  title: 'Corridas da crew',
  noCrewTitle: 'Entre numa crew para ver as corridas dela',
  noCrewBody: 'Na crew, cada corrida aparece aqui e ganha "Bora!" dos colegas.',
  emptyTitle: 'Ninguém correu ainda',
  emptyBody: 'A próxima corrida da crew aparece aqui.',
  unavailableTitle: 'Feed indisponível',
  unavailableBody: 'O feed da crew ainda não está ligado no servidor.',
  errorTitle: 'Não deu para carregar o feed',
  offline: 'Sem conexão. Mostrando o que já carregou.',
  more: 'Ver mais',
  all: 'Ver tudo',
  retry: 'Tentar de novo',
  join: 'Entrar com código',
  create: 'Criar crew',
} as const;

export type CrewFeedProps = {
  /** Time da pessoa (arte do estado vazio). */
  faction?: FactionId | null;
  /** Ações do estado "sem crew" (a E6 liga às telas de crew). */
  onJoinCrew?: () => void;
  onCreateCrew?: () => void;
  /** Dentro de uma ScrollView (padrão) ou como lista própria. */
  embedded?: boolean;
  pageSize?: number;
  /** Prévia (Clube, UX-21): mostra só os N primeiros e troca o "Ver mais" por "Ver tudo". */
  limit?: number;
  onSeeAll?: () => void;
  testID?: string;
};

export function CrewFeed({ faction, onJoinCrew, onCreateCrew, embedded = true, pageSize, limit, onSeeAll, testID = 'feed-crew' }: CrewFeedProps) {
  const { colors } = useTheme();
  const feed = useCrewFeed({ pageSize });
  const today = localToday();

  if (feed.status === 'loading') {
    return (
      <View testID={testID} style={{ gap: space[3] }}>
        <ShimmerSkeleton shape="card" height={220} accessibilityLabel="Carregando o feed da crew" testID={`${testID}-carregando`} />
        <ShimmerSkeleton shape="card" height={220} accessibilityLabel="Carregando o feed da crew" />
      </View>
    );
  }

  if (feed.status === 'noCrew') {
    return (
      <View testID={testID}>
        <EmptyState
          testID={`${testID}-sem-crew`}
          art={<EmptyArt kind="sem-crew" team={faction ?? undefined} size={180} />}
          title={CREW_FEED_TEXT.noCrewTitle}
          body={CREW_FEED_TEXT.noCrewBody}
          action={
            onJoinCrew || onCreateCrew ? (
              <View style={{ gap: space[2], alignSelf: 'stretch' }}>
                {onJoinCrew ? <Button testID={`${testID}-entrar`} label={CREW_FEED_TEXT.join} onPress={onJoinCrew} wide /> : null}
                {onCreateCrew ? <Button testID={`${testID}-criar`} label={CREW_FEED_TEXT.create} kind="secondary" onPress={onCreateCrew} wide /> : null}
              </View>
            ) : undefined
          }
        />
      </View>
    );
  }

  if (feed.status === 'unavailable') {
    return (
      <View testID={testID}>
        {/* Regra 1 da F8: sem "Em breve"; o estado diz o que é, sem prometer data. */}
        <EmptyState testID={`${testID}-indisponivel`} icon="club" title={CREW_FEED_TEXT.unavailableTitle} body={CREW_FEED_TEXT.unavailableBody} compact />
      </View>
    );
  }

  if (feed.status === 'error') {
    // D-95: o aviso único de "sem conexão" (antes, um título grande com arte, diferente do resto do app).
    return (
      <View testID={testID}>
        <OfflineNotice testID={`${testID}-erro`} code={feed.errorCode} hasData={false} onRetry={() => void feed.reload()} />
      </View>
    );
  }

  // Erro de carga com a última página na tela: o mesmo aviso; erro de uma ação (reagir, tirar): 1 linha curta.
  const banner = feed.error ? (
    feed.errorCode ? (
      <OfflineNotice testID={`${testID}-aviso`} code={feed.errorCode} hasData onRetry={() => void feed.reload()} />
    ) : (
      <View testID={`${testID}-aviso`} accessibilityLiveRegion="polite" style={{ paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: 12, backgroundColor: colors.surfaceSunken }}>
        <Text variant="small">{feed.error}</Text>
      </View>
    )
  ) : null;

  if (feed.items.length === 0) {
    return (
      <View testID={testID} style={{ gap: space[3] }}>
        {banner}
        <EmptyState testID={`${testID}-vazio`} art={<EmptyArt kind="sem-corridas" team={faction ?? undefined} size={160} />} title={CREW_FEED_TEXT.emptyTitle} body={CREW_FEED_TEXT.emptyBody} compact />
      </View>
    );
  }

  const renderItem = (item: FeedItem) => <CrewFeedCard key={item.id} item={item} today={today} onReact={(id, r) => void feed.react(id, r)} onRemove={(id) => void feed.remove(id)} />;
  const more = feed.hasMore ? (
    <Button testID={`${testID}-mais`} label={feed.loadingMore ? 'Carregando…' : CREW_FEED_TEXT.more} kind="secondary" busy={feed.loadingMore} disabled={feed.loadingMore} onPress={() => void feed.loadMore()} />
  ) : null;

  if (embedded) {
    const shown = limit !== undefined ? feed.items.slice(0, limit) : feed.items;
    const seeAll = limit !== undefined && onSeeAll && (feed.items.length > limit || feed.hasMore);
    return (
      <View testID={testID} style={{ gap: space[3] }}>
        {banner}
        {shown.map(renderItem)}
        {limit !== undefined ? (seeAll ? <Button testID={`${testID}-ver-tudo`} label={CREW_FEED_TEXT.all} kind="secondary" icon="chevron" onPress={onSeeAll} /> : null) : more}
      </View>
    );
  }

  return (
    <FlatList
      testID={testID}
      data={feed.items}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => renderItem(item)}
      ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
      ListHeaderComponent={banner}
      ListFooterComponent={more}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasMore && !feed.loadingMore) void feed.loadMore();
      }}
      initialNumToRender={4}
      windowSize={7}
    />
  );
}
