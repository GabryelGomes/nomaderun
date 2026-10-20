import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState, SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ErrorNotice, TextField } from '@/features/auth/form-ui';
import { useResource } from '@/features/screens/use-resource';
import { listUsers, setUserStatus, type ManagedUser } from '@/services/api/moderation-repo';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { canManageUser } from './guard';

const STATUS_TEXT: Record<string, string> = { active: 'Ativa', inactive: 'Inativa', suspended: 'Suspensa da competição' };
const ROLE_TEXT: Record<string, string> = { runner: 'Corredor', moderator: 'Moderador', admin: 'Administrador' };

/** Admin: inativar/reativar contas (`admin_set_user_status`). Inativa bloqueia o login. */
export function AdminUsersScreen() {
  const { colors } = useTheme();
  const role = useSession((s) => s.profile?.role);
  const me = useSession((s) => s.session?.userId ?? null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, loading, reload, setData } = useResource(() => listUsers(query), [query]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (role !== 'admin') return <Redirect href="/moderacao" />;

  const toggle = async (u: ManagedUser) => {
    const next = u.status === 'inactive' ? 'active' : 'inactive';
    setBusyId(u.id);
    setActionError(null);
    const res = await setUserStatus(u.id, next);
    setBusyId(null);
    if (!res.ok) {
      setActionError(res.error.message);
      return;
    }
    setData((cur) => (cur ?? []).map((x) => (x.id === u.id ? { ...x, status: res.data.status } : x)));
  };

  return (
    <ScrollView
      testID="tela-admin-contas"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12], width: '100%', maxWidth: 960, alignSelf: 'center' }}>
      <View style={{ gap: space[3] }}>
        <SectionHeader title="Contas" />
        <Text muted>Uma conta inativa não consegue entrar e some dos rankings. Reativar devolve o acesso.</Text>
        <TextField
          testID="admin-busca"
          label="Buscar por nome de usuário"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(search)}
        />
        <Button testID="admin-buscar" label="Buscar" kind="secondary" onPress={() => setQuery(search)} />
        <ErrorNotice message={actionError} testID="admin-erro" />
      </View>

      {error && !data ? (
        <EmptyState title="Não foi possível carregar" body={error.message} action={<Button testID="admin-tentar" label="Tentar de novo" kind="secondary" onPress={reload} />} />
      ) : !data || (loading && data.length === 0) ? (
        <ActivityIndicator color={colors.action} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhuma conta" body="Nenhum nome de usuário corresponde à busca." />
      ) : (
        <Surface>
          {data.map((u) => {
            const manageable = canManageUser(role, me, u.id);
            return (
              <View key={u.id} testID={`admin-conta-${u.username}`} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <TeamBadge faction={u.faction} size={28} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">{u.username}</Text>
                  <Text variant="small" muted>
                    {ROLE_TEXT[u.role]} · {STATUS_TEXT[u.status] ?? u.status} · confiança {u.trust}
                  </Text>
                </View>
                {manageable ? (
                  <Button
                    testID={`admin-alternar-${u.username}`}
                    label={busyId === u.id ? 'Salvando…' : u.status === 'inactive' ? 'Reativar' : 'Inativar'}
                    kind={u.status === 'inactive' ? 'secondary' : 'danger'}
                    disabled={busyId !== null}
                    onPress={() => toggle(u)}
                  />
                ) : (
                  <Text variant="caption" muted>
                    {u.id === me ? 'Você' : ''}
                  </Text>
                )}
              </View>
            );
          })}
        </Surface>
      )}
    </ScrollView>
  );
}
