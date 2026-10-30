/**
 * T7.2.5 — `<InviteCard>`: convite da crew (código + "Copiar") ou do app. Mora só no Clube e na Crew (UX-16).
 * O texto pronto, com o link, vai pelo menu do sistema (`Share.share`); na tela fica só o código (UX-35).
 */
import { useState } from 'react';
import { Share, View } from 'react-native';

import { Button } from '@/components/button';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { isDemoMode } from '@/services/api/env';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { copyText } from '../clipboard';
import { appInviteLink, appInviteText, crewInviteLink, crewInviteText, normalizeInviteCode } from './invite';

export type InviteCardProps =
  | { kind: 'crew'; crewName: string; code: string; faction: FactionId | null; city?: string | null; testID?: string }
  | { kind: 'app'; place?: string | null; faction?: FactionId | null; testID?: string };

export function InviteCard(props: InviteCardProps) {
  const { colors } = useTheme();
  const demo = isDemoMode();
  const [copied, setCopied] = useState(false);
  const testID = props.testID ?? (props.kind === 'crew' ? 'convite-crew' : 'convite-app');
  const code = props.kind === 'crew' ? normalizeInviteCode(props.code) : null;
  const link = props.kind === 'crew' ? crewInviteLink(props.code) : appInviteLink();
  const message =
    props.kind === 'crew'
      ? crewInviteText({ crewName: props.crewName, faction: props.faction, code: props.code, city: props.city, link, isDemo: demo })
      : appInviteText({ place: props.place, faction: props.faction, link, isDemo: demo });

  const copy = async (text: string) => {
    if (await copyText(text)) setCopied(true);
  };

  // UX-35: só o código fica na tela (com "Copiar" ao lado); o link e o texto pronto vão no compartilhamento.
  return (
    <Surface>
      <View testID={testID} style={{ gap: space[3] }}>
        <Text variant="title">{props.kind === 'crew' ? 'Convidar para a crew' : 'Convidar amigos'}</Text>
        {code ? (
          <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: 16, backgroundColor: colors.surfaceSunken }}>
            <View accessible accessibilityLabel={`Código da crew: ${code.split('').join(' ')}`} style={{ alignItems: 'center' }}>
              <Text variant="caption" muted>
                CÓDIGO
              </Text>
              <Text variant="headline" tabular selectable style={{ letterSpacing: 4 }}>
                {code}
              </Text>
            </View>
            <Button testID={`${testID}-copiar-codigo`} accessibilityLabel={copied ? 'Código copiado' : 'Copiar o código da crew'} label={copied ? 'Copiado' : 'Copiar'} icon={copied ? 'check' : 'copy'} kind="secondary" onPress={() => void copy(code)} />
          </View>
        ) : (
          <Text variant="small" muted>
            Chame quem corre com você.
          </Text>
        )}
        <Button testID={`${testID}-enviar`} label="Compartilhar convite" icon="share" wide onPress={() => void Share.share({ message }).catch(() => undefined)} />
      </View>
    </Surface>
  );
}
