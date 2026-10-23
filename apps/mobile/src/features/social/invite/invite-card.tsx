/**
 * T7.2.5 — `<InviteCard>`: convite da crew (código + link + texto pronto) ou do app. A E6 encaixa em
 * Crew → "Convidar" e em Você → "Convidar amigos". Compartilha pelo menu do sistema (`Share.share`).
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
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const testID = props.testID ?? (props.kind === 'crew' ? 'convite-crew' : 'convite-app');
  const code = props.kind === 'crew' ? normalizeInviteCode(props.code) : null;
  const link = props.kind === 'crew' ? crewInviteLink(props.code) : appInviteLink();
  const message =
    props.kind === 'crew'
      ? crewInviteText({ crewName: props.crewName, faction: props.faction, code: props.code, city: props.city, link, isDemo: demo })
      : appInviteText({ place: props.place, faction: props.faction, link, isDemo: demo });

  const copy = async (what: 'code' | 'link', text: string) => {
    if (await copyText(text)) setCopied(what);
  };

  return (
    <Surface>
      <View testID={testID} style={{ gap: space[3] }}>
        <Text variant="title">{props.kind === 'crew' ? 'Convidar para a crew' : 'Convidar amigos'}</Text>
        {code ? (
          <View accessible accessibilityLabel={`Código da crew: ${code.split('').join(' ')}`} style={{ alignItems: 'center', paddingVertical: space[2], borderRadius: 16, backgroundColor: colors.surfaceSunken }}>
            <Text variant="caption" muted>
              CÓDIGO
            </Text>
            <Text variant="headline" tabular selectable style={{ letterSpacing: 4 }}>
              {code}
            </Text>
          </View>
        ) : null}
        <Text variant="small" muted selectable>
          {message}
        </Text>
        <Button testID={`${testID}-enviar`} label="Compartilhar convite" icon="share" wide onPress={() => void Share.share({ message }).catch(() => undefined)} />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {code ? (
            <View style={{ flex: 1 }}>
              <Button testID={`${testID}-copiar-codigo`} label={copied === 'code' ? 'Código copiado' : 'Copiar código'} kind="secondary" wide onPress={() => void copy('code', code)} />
            </View>
          ) : null}
          {link ? (
            <View style={{ flex: 1 }}>
              <Button testID={`${testID}-copiar-link`} label={copied === 'link' ? 'Link copiado' : 'Copiar link'} kind="secondary" wide onPress={() => void copy('link', link)} />
            </View>
          ) : null}
        </View>
      </View>
    </Surface>
  );
}
