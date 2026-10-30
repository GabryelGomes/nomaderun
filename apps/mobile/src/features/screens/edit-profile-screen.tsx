import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { FadeUp, Pressable, RevealText, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ErrorNotice, InfoNotice, TextField } from '@/features/auth/form-ui';
import { saveProfile } from '@/features/auth/session-controller';
import { validateCity, validateUsername } from '@/features/auth/validation';
import type { DistanceUnit } from '@/services/api/types';
import { useSession } from '@/store/session-store';

import { pickAndUploadAvatar } from './avatar-picker';
import { initialsOf } from './profile-screen.model';
import { neonTeam } from '@/theme/neon';
import { fonts, palette, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const UNITS: { id: DistanceUnit; label: string }[] = [
  { id: 'km', label: 'Quilômetros (km)' },
  { id: 'mi', label: 'Milhas (mi)' },
];

export { initialsOf };

/** Editar perfil (RF-002): foto, nome de usuário, cidade natal e unidade. Os avisos ficam em Ajustes → Lembretes (UX-16). */
export function EditProfileScreen() {
  const { colors } = useTheme();
  const profile = useSession((s) => s.profile);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [unit, setUnit] = useState<DistanceUnit>(profile?.unit ?? 'km');
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
    const res = await saveProfile({ username, city, unit });
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
    <ScreenScroll
      testID="tela-editar-perfil"
      edges={[]}
      contentInsetAdjustmentBehavior="automatic"
      gap={space[6]}
      footerProps={{ safeBottom: false }}
      footer={<Button testID="perfil-salvar" label={busy ? 'Salvando…' : 'Salvar alterações'} size="lg" wide disabled={busy} onPress={save} />}>
      <Stack.Screen options={{ title: 'Editar perfil', headerLargeTitleEnabled: false }} />

      <Stagger gap={space[6]}>
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <Pressable
              testID="perfil-foto"
              hitSlop={0}
              accessibilityRole="button"
              accessibilityLabel={profile?.avatarUrl ? 'Foto de perfil. Toque para trocar.' : `Foto de perfil: iniciais ${initialsOf(username)}. Toque para enviar uma foto.`}
              disabled={uploading}
              onPress={changePhoto}
              style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: neonTeam[faction], overflow: 'hidden' }}>
              {profile?.avatarUrl ? (
                <Image testID="perfil-foto-imagem" source={{ uri: profile.avatarUrl }} style={{ width: 64, height: 64 }} contentFit="cover" />
              ) : (
                <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 28 }} color={palette.ink}>
                  {initialsOf(username)}
                </Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">Foto de perfil</Text>
              <Text variant="small" muted>
                {uploading ? 'Enviando foto…' : profile?.avatarUrl ? 'Toque para trocar · JPEG, PNG ou WebP até 2 MB' : 'Toque nas iniciais para pôr uma foto'}
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
            help="3 a 20 letras, números, ponto ou sublinhado"
          />
          <TextField testID="perfil-cidade" label="Cidade natal" value={city} onChangeText={setCity} placeholder="Ex.: Goiânia" autoComplete="off" maxLength={80} error={cityError} help="Pontua no placar entre cidades · 1 troca por temporada" />
        </View>

        <View style={{ gap: space[3] }}>
          <RevealText variant="title" header delay={200} style={{ paddingHorizontal: space[1] }}>
            Unidade de distância
          </RevealText>
          <Surface>
            {UNITS.map((u) => {
              const on = unit === u.id;
              return (
                <Pressable
                  key={u.id}
                  testID={`perfil-unidade-${u.id}`}
                  hitSlop={0}
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

        {/* UX-16: os avisos saíram daqui; moram só em Ajustes → Lembretes (gravam na hora). */}
      </Stagger>

      <ErrorNotice message={error} testID="perfil-erro" />
      {saved ? (
        <FadeUp>
          <InfoNotice testID="perfil-salvo" title="Perfil atualizado" body="Tudo salvo." />
        </FadeUp>
      ) : null}
    </ScreenScroll>
  );
}
