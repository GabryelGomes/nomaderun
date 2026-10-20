import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { EmptyState, SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { useResource } from '@/features/screens/use-resource';
import { listActivitiesInReview } from '@/services/api/moderation-repo';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { FLAG_TITLE, formatDateTime, formatKm, REVIEW_REASON_TEXT } from './labels';

/** Lista de corridas em revisão (RF-018). Pensada para o navegador, funciona no celular. */
export function ModerationListScreen() {
  const { colors } = useTheme();
  const role = useSession((s) => s.profile?.role);
  const { data, error, loading, reload } = useResource(listActivitiesInReview, []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView
      testID="tela-moderacao"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading && data !== null} onRefresh={reload} />}
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12], width: '100%', maxWidth: 960, alignSelf: 'center' }}>
      <View style={{ gap: space[3] }}>
        <SectionHeader title="Corridas em revisão" />
        <Text muted>Corridas que não pontuaram por suspeita de fraude ou índice de confiança baixo. Toda decisão exige justificativa e avisa o corredor.</Text>
        {error && !data ? (
          <EmptyState title="Não foi possível carregar" body={error.message} action={<Button testID="moderacao-tentar" label="Tentar de novo" kind="secondary" onPress={reload} />} />
        ) : !data ? (
          <ActivityIndicator color={colors.action} />
        ) : data.length === 0 ? (
          <EmptyState title="Fila vazia" body="Nenhuma corrida aguardando revisão agora." />
        ) : (
          <Surface>
            {data.map((a) => (
              <Pressable
                key={a.id}
                testID={`moderacao-corrida-${a.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Revisar corrida de ${a.username}, ${formatKm(a.meters)}`}
                onPress={() => router.push({ pathname: '/moderacao/[id]', params: { id: a.id } })}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken }}>
                  <Icon name="warning" size={16} color={colors.danger} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">
                    {a.username} · {formatKm(a.meters)}
                  </Text>
                  <Text variant="small" muted>
                    {formatDateTime(a.startedAt)} · {a.flags.map((f) => FLAG_TITLE[f] ?? f).join(', ') || 'Sem alertas de trecho'}
                  </Text>
                  {a.reviewReason ? (
                    <Text variant="caption" muted>
                      {REVIEW_REASON_TEXT[a.reviewReason] ?? a.reviewReason}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron" size={18} color={colors.textSecondary} />
              </Pressable>
            ))}
          </Surface>
        )}
      </View>

      {role === 'admin' ? (
        <View style={{ gap: space[3] }}>
          <SectionHeader title="Administração" />
          <Surface>
            <Pressable
              testID="moderacao-contas"
              accessibilityRole="button"
              accessibilityLabel="Contas"
              onPress={() => router.push('/moderacao/contas')}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyBold">Contas</Text>
                <Text variant="small" muted>
                  Inativar ou reativar contas de corredores.
                </Text>
              </View>
              <Icon name="chevron" size={18} color={colors.textSecondary} />
            </Pressable>
          </Surface>
        </View>
      ) : null}
    </ScrollView>
  );
}
