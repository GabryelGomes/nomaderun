import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ErrorNotice, InfoNotice, TextField } from '@/features/auth/form-ui';
import { saveProfile } from '@/features/auth/session-controller';
import { validateCity, validateUsername } from '@/features/auth/validation';
import { DEFAULT_NOTIFICATION_PREFS, type DistanceUnit, type NotificationPrefs } from '@/services/api/types';
import { useSession } from '@/store/session-store';

import { pickAndUploadAvatar } from './avatar-picker';
import { factions, fonts, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const PREFS: { key: keyof NotificationPrefs; title: string; body: string }[] = [
  { key: 'invasions', title: 'Invasões', body: 'Quando um rival ataca uma zona do seu time.' },
  { key: 'conquests', title: 'Conquistas', body: 'Quando você conquista ou defende uma zona.' },
  { key: 'missions', title: 'Missões', body: 'Missões novas, baús e fim de temporada.' },
  { key: 'moderation', title: 'Moderação', body: 'Resultado da revisão de uma corrida sua.' },
];

const UNITS: { id: DistanceUnit; label: string }[] = [
  { id: 'km', label: 'Quilômetros (km)' },
  { id: 'mi', label: 'Milhas (mi)' },
];

export function initialsOf(name: string): string {
  const parts = name.replace(/[_.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[1][0] : (parts[0][1] ?? '');
  return (first + second).toUpperCase();
}

/** Editar perfil (RF-002): nome de usuário, cidade natal, unidade e preferências de notificação. */
export function EditProfileScreen() {
  const { colors } = useTheme();
  const profile = useSession((s) => s.profile);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [unit, setUnit] = useState<DistanceUnit>(profile?.unit ?? 'km');
  const [prefs, setPrefs] = useState<NotificationPrefs>(profile?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const faction = profile?.faction ?? 'striders';
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const changePhoto = async () => {
    setPhotoError(null);
    setUploading(true);
    try {
      const res = await pickAndUploadAvatar();
      if (res && !res.ok) setPhotoError(res.error.message);
    } catch {
      setPhotoError('Não foi possível abrir a galeria de fotos.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const err = validateUsername(username);
    const cityErr = validateCity(city);
    setUsernameError(err);
    setCityError(cityErr);
    setSaved(false);
    if (err || cityErr) return;
    setBusy(true);
    setError(null);
    const res = await saveProfile({ username, city, unit, notificationPrefs: prefs });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === 'CONFLICT') setUsernameError(res.error.message);
      else setError(res.error.message);
      return;
    }
    setSaved(true);
    if (router.canGoBack()) router.back();
  };

  return (
    <ScrollView
      testID="tela-editar-perfil"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Stack.Screen options={{ title: 'Editar perfil', headerLargeTitleEnabled: false }} />

      <Surface>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
          <Pressable
            testID="perfil-foto"
            accessibilityRole="button"
            accessibilityLabel={profile?.avatarUrl ? 'Foto de perfil. Toque para trocar.' : `Foto de perfil: iniciais ${initialsOf(username)}. Toque para enviar uma foto.`}
            disabled={uploading}
            onPress={changePhoto}
            style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: factions[faction].color, overflow: 'hidden' }}>
            {profile?.avatarUrl ? (
              <Image testID="perfil-foto-imagem" source={{ uri: profile.avatarUrl }} style={{ width: 64, height: 64 }} contentFit="cover" />
            ) : (
              <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 28 }} color={factions[faction].onColor}>
                {initialsOf(username)}
              </Text>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">Foto de perfil</Text>
            <Text variant="small" muted>
              {uploading ? 'Enviando foto…' : profile?.avatarUrl ? 'Toque na foto para trocar. JPEG, PNG ou WebP até 2 MB.' : 'Toque nas iniciais para enviar uma foto. Sem foto, mostramos suas iniciais na cor do seu time.'}
            </Text>
          </View>
        </View>
        <ErrorNotice message={photoError} testID="perfil-foto-erro" />
      </Surface>

      <View style={{ gap: space[4] }}>
        <TextField
          testID="perfil-usuario"
          label="Nome de usuário"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          error={usernameError}
          help="De 3 a 20 caracteres: letras, números, ponto ou sublinhado."
        />
        <TextField testID="perfil-cidade" label="Cidade natal" value={city} onChangeText={setCity} placeholder="Ex.: Goiânia" autoComplete="off" maxLength={80} error={cityError} help="Conta pontos para a sua cidade no placar entre cidades. Pode ser trocada uma vez por temporada." />
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Unidade de distância" />
        <Surface>
          {UNITS.map((u) => {
            const on = unit === u.id;
            return (
              <Pressable
                key={u.id}
                testID={`perfil-unidade-${u.id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={u.label}
                onPress={() => setUnit(u.id)}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Text variant="bodyBold" style={{ flex: 1 }}>
                  {u.label}
                </Text>
                {on ? <Icon name="check" size={20} color={colors.action} /> : null}
              </Pressable>
            );
          })}
        </Surface>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Notificações" />
        <Surface>
          {PREFS.map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyBold">{p.title}</Text>
                <Text variant="small" muted>
                  {p.body}
                </Text>
              </View>
              <Switch
                testID={`perfil-notificacao-${p.key}`}
                accessibilityLabel={`Notificações de ${p.title.toLowerCase()}`}
                value={prefs[p.key]}
                onValueChange={(v) => setPrefs((cur) => ({ ...cur, [p.key]: v }))}
              />
            </View>
          ))}
        </Surface>
      </View>

      <ErrorNotice message={error} testID="perfil-erro" />
      {saved ? <InfoNotice testID="perfil-salvo" title="Perfil atualizado" body="Suas alterações foram salvas." /> : null}
      <Button testID="perfil-salvar" label={busy ? 'Salvando…' : 'Salvar alterações'} size="lg" wide disabled={busy} onPress={save} />
    </ScrollView>
  );
}
