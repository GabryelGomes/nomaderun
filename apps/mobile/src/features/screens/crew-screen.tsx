import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState, SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ErrorNotice, TextField } from '@/features/auth/form-ui';
import { CREW_MAX_MEMBERS, createCrew, getMyCrew, joinCrew, leaveCrew, normalizeCrewTag, removeCrewMember, validateCrewName, validateCrewTag, validateInviteCode } from '@/services/api/crews-repo';
import { useSession } from '@/store/session-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useResource } from './use-resource';

/** Gestão da crew (RF-011, RN-011): criar, entrar por código, sair, membros e ranking interno. */
export function CrewScreen() {
  const { colors } = useTheme();
  const userId = useSession((s) => s.session?.userId ?? null);
  const faction = useSession((s) => s.profile?.faction ?? null);
  const { data, error, loading, reload } = useResource(() => getMyCrew(userId ?? ''), [userId]);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [code, setCode] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setBusy(key);
    setActionError(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setActionError(res.error?.message ?? 'Algo deu errado. Tente de novo.');
      return false;
    }
    await reload();
    return true;
  };

  const create = async () => {
    const ne = validateCrewName(name);
    const te = validateCrewTag(tag);
    setNameError(ne);
    setTagError(te);
    if (ne || te) return;
    if (await run('criar', () => createCrew(name, tag))) {
      setName('');
      setTag('');
    }
  };

  const join = async () => {
    const ce = validateInviteCode(code);
    setCodeError(ce);
    if (ce) return;
    if (await run('entrar', () => joinCrew(code))) setCode('');
  };

  return (
    <ScrollView
      testID="tela-crew"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Stack.Screen options={{ title: data?.crew.name ?? 'Crew', headerLargeTitleEnabled: false }} />
      <ErrorNotice message={actionError} testID="crew-erro" />

      {loading && data === null && !error ? (
        <ActivityIndicator color={colors.action} />
      ) : error && data === null ? (
        <EmptyState title={error.code === 'NETWORK' ? 'Sem internet' : 'Não foi possível carregar'} body={error.message} action={<Button testID="crew-tentar" label="Tentar de novo" kind="secondary" onPress={reload} />} />
      ) : data ? (
        <>
          <Surface>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <TeamBadge faction={data.crew.faction} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="headline" testID="crew-nome">
                  {data.crew.name}
                </Text>
                <Text muted>
                  [{data.crew.tag}] · {data.members.length} de {CREW_MAX_MEMBERS} corredores
                </Text>
              </View>
            </View>
            <View style={{ padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceSunken, gap: 2 }}>
              <Text variant="caption" muted>
                Código de convite
              </Text>
              <Text variant="title" selectable testID="crew-codigo">
                {data.crew.inviteCode}
              </Text>
              <Text variant="small" muted>
                Só corredores dos {data.crew.faction ? factions[data.crew.faction].name : 'mesmo time'} podem entrar.
              </Text>
            </View>
          </Surface>

          <View style={{ gap: space[3] }}>
            <SectionHeader title="Ranking da crew" />
            <Text muted>Pontos de cada membro na temporada atual.</Text>
            <Surface>
              {data.members.map((m, i) => (
                <View key={m.userId} testID={`crew-membro-${m.username}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 4 }}>
                  <Text variant="bodyBold" tabular style={{ width: 24 }}>
                    {i + 1}
                  </Text>
                  <TeamBadge faction={m.faction} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text variant={m.userId === userId ? 'bodyBold' : 'body'}>
                      {m.username}
                      {m.userId === userId ? ' (você)' : ''}
                    </Text>
                    {m.role === 'leader' ? (
                      <Text variant="caption" muted>
                        Líder
                      </Text>
                    ) : null}
                  </View>
                  <Text tabular>{m.rp.toLocaleString('pt-BR')} RP</Text>
                  {data.isLeader && m.userId !== userId ? (
                    <Button
                      testID={`crew-remover-${m.username}`}
                      label="Remover"
                      kind="ghost"
                      disabled={busy !== null}
                      onPress={() => run(`remover-${m.userId}`, () => removeCrewMember(data.crew.id, m.userId))}
                    />
                  ) : null}
                </View>
              ))}
            </Surface>
          </View>

          {confirmLeave ? (
            <Surface>
              <Text variant="bodyBold">Sair da crew?</Text>
              <Text variant="small" muted>
                {data.isLeader && data.members.length > 1
                  ? 'O membro mais antigo vira o novo líder.'
                  : data.members.length === 1
                    ? 'Você é o único membro: a crew será apagada.'
                    : 'Você pode entrar em outra crew depois.'}
              </Text>
              <Button testID="crew-sair-confirmar" label={busy === 'sair' ? 'Saindo…' : 'Sair da crew'} kind="danger" disabled={busy !== null} onPress={() => run('sair', leaveCrew).then(() => setConfirmLeave(false))} />
              <Button testID="crew-sair-cancelar" label="Cancelar" kind="ghost" onPress={() => setConfirmLeave(false)} />
            </Surface>
          ) : (
            <Button testID="crew-sair" label="Sair da crew" kind="secondary" onPress={() => setConfirmLeave(true)} />
          )}
        </>
      ) : (
        <>
          <Text muted>
            Uma crew reúne até {CREW_MAX_MEMBERS} corredores do mesmo time{faction ? ` (${factions[faction].name})` : ''}. Você pode estar em uma crew por vez.
          </Text>
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Entrar com código" />
            <View style={{ gap: space[3] }}>
              <TextField
                testID="crew-codigo-convite"
                label="Código de convite"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                error={codeError}
              />
              <Button testID="crew-entrar" label={busy === 'entrar' ? 'Entrando…' : 'Entrar na crew'} disabled={busy !== null} onPress={join} />
            </View>
          </View>
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Criar uma crew" />
            <View style={{ gap: space[3] }}>
              <TextField testID="crew-criar-nome" label="Nome da crew" value={name} onChangeText={setName} maxLength={30} error={nameError} help="De 3 a 30 caracteres." />
              <TextField
                testID="crew-criar-sigla"
                label="Sigla"
                value={tag}
                onChangeText={(t) => setTag(normalizeCrewTag(t))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={5}
                error={tagError}
                help="De 3 a 5 letras, aparece ao lado do seu nome nos rankings."
              />
              <Button testID="crew-criar" label={busy === 'criar' ? 'Criando…' : 'Criar crew'} disabled={busy !== null} onPress={create} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
