/**
 * T7.2.5 — página de reserva do link de convite (`/compartilhar/convite/[codigo]`), aberta na prévia web
 * por quem recebeu o convite. Não chama o servidor (o `invite_preview` para anônimos ainda não existe):
 * mostra o código, copia e explica onde colar. Sem nome de ninguém.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyArt } from '@/components/art';
import { Button } from '@/components/button';
import { ScreenScroll } from '@/components/screen';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { copyText } from '../clipboard';
import { INVITE_CODE_RE, normalizeInviteCode } from './invite';

export function InviteLanding() {
  const { colors } = useTheme();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const code = normalizeInviteCode(decodeURIComponent(codigo ?? ''));
  const valid = INVITE_CODE_RE.test(code);
  const [copied, setCopied] = useState(false);
  return (
    <ScreenScroll testID="tela-convite">
      <View style={{ alignItems: 'center', gap: space[3], paddingTop: space[6] }}>
        <EmptyArt kind="sem-crew" size={200} />
        <Text variant="headline" style={{ textAlign: 'center' }} accessibilityRole="header">
          {valid ? 'Bora correr junto?' : 'Convite inválido'}
        </Text>
        <Text variant="body" muted style={{ textAlign: 'center' }}>
          {valid ? 'Você recebeu um convite para uma crew do NOMADE RUN.' : 'Peça um link novo para quem te convidou.'}
        </Text>
      </View>
      {valid ? (
        <Surface>
          <View style={{ gap: space[3] }}>
            <View accessible accessibilityLabel={`Código do convite: ${code.split('').join(' ')}`} style={{ alignItems: 'center', paddingVertical: space[3], borderRadius: 16, backgroundColor: colors.surfaceSunken }}>
              <Text variant="caption" muted>
                CÓDIGO
              </Text>
              <Text variant="metric" tabular selectable style={{ letterSpacing: 4 }}>
                {code}
              </Text>
            </View>
            <Text variant="small" muted>
              No app, abra Clube → Crew → “Entrar com código” e cole o código. A crew precisa ser do mesmo time que você.
            </Text>
            <Button testID="convite-copiar" label={copied ? 'Código copiado' : 'Copiar código'} icon={copied ? 'check' : undefined} wide onPress={() => void copyText(code).then(setCopied)} />
            <Button testID="convite-abrir" label="Abrir o NOMADE RUN" kind="secondary" wide onPress={() => router.replace('/')} />
          </View>
        </Surface>
      ) : (
        <Button testID="convite-abrir" label="Abrir o NOMADE RUN" kind="secondary" wide onPress={() => router.replace('/')} />
      )}
    </ScreenScroll>
  );
}
