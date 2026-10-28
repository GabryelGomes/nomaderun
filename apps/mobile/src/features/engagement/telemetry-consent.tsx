import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { useEngagement } from '@/store/engagement-store';
import { useSession } from '@/store/session-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { loadTelemetryConsent, setTelemetryOptIn } from './telemetry';
import { consentDate, TELEMETRY_COPY, TELEMETRY_RETENTION_DAYS } from './telemetry-model';

export type TelemetryConsentSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Depois de ligar ou desligar (com a mensagem para a tela). */
  onDecided?: (optIn: boolean, message: string) => void;
  testID?: string;
};

/**
 * Folha de consentimento da telemetria (D-82, LGPD art. 8º): o que coleta, o que nunca coleta, por quanto tempo
 * e como desligar, antes de qualquer envio. "Ligar" e "Agora não" têm o mesmo tamanho (nada de empurrão).
 */
export function TelemetryConsentSheet({ visible, onClose, onDecided, testID = 'telemetria-consentimento' }: TelemetryConsentSheetProps) {
  const { colors } = useTheme();
  const consent = useEngagement((s) => s.telemetry);
  const on = consent.data?.optIn === true;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const decide = async (optIn: boolean) => {
    setBusy(true);
    setMessage(null);
    const res = await setTelemetryOptIn(optIn);
    setBusy(false);
    if (res.ok) {
      const text = optIn ? 'Ligado. Obrigado por ajudar.' : 'Desligado. Pedimos ao servidor para apagar seus eventos.';
      onDecided?.(optIn, text);
      onClose();
      return;
    }
    if (!optIn) {
      // Desligado no aparelho mesmo sem resposta; o aviso ao servidor é refeito na próxima abertura.
      onDecided?.(false, 'Desligado neste aparelho. Avisamos o servidor assim que houver conexão.');
      onClose();
      return;
    }
    setMessage(res.error.message);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 7, 8, 0.6)' }}>
        <Pressable testID={`${testID}-fundo`} accessibilityLabel="Fechar sem mudar nada" onPress={onClose} style={{ flex: 1 }} />
        <Surface style={{ maxHeight: '88%', padding: space[6], borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <ScrollView contentContainerStyle={{ gap: space[4] }}>
            <View testID={testID} style={{ gap: space[2] }}>
              <Text variant="title" accessibilityRole="header">
                {TELEMETRY_COPY.title}
              </Text>
              <Text muted>{TELEMETRY_COPY.intro}</Text>
            </View>
            {TELEMETRY_COPY.sections.map((sec) => (
              <View key={sec.key} testID={`${testID}-${sec.key}`} accessible accessibilityLabel={`${sec.title}. ${sec.body}`} style={{ flexDirection: 'row', gap: space[3] }}>
                <View aria-hidden style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>
                  <Icon name={sec.icon} size={18} color={colors.accentText} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyBold">{sec.title}</Text>
                  <Text variant="small" muted>
                    {sec.body}
                  </Text>
                </View>
              </View>
            ))}
            <Text variant="caption" muted>
              {TELEMETRY_COPY.why}
            </Text>
            {message ? (
              <Text testID={`${testID}-mensagem`} variant="small" accessibilityLiveRegion="polite">
                {message}
              </Text>
            ) : null}
            {on ? (
              <View style={{ gap: space[2] }}>
                <Button testID={`${testID}-desligar`} label="Desligar e apagar" kind="secondary" wide disabled={busy} busy={busy} onPress={() => void decide(false)} />
                <Button testID={`${testID}-fechar`} label="Fechar" kind="ghost" wide onPress={onClose} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <View style={{ flex: 1 }}>
                  <Button testID={`${testID}-agora-nao`} label={TELEMETRY_COPY.decline} kind="secondary" wide disabled={busy} onPress={onClose} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID={`${testID}-ligar`} label={TELEMETRY_COPY.accept} wide disabled={busy} busy={busy} onPress={() => void decide(true)} />
                </View>
              </View>
            )}
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
}

/**
 * Bloco "Dados de uso" para Ajustes (E6a encaixa): interruptor desligado por padrão. Ligar abre a folha de
 * consentimento (ninguém liga sem ler); desligar vale na hora e apaga os eventos no servidor.
 */
export function TelemetrySettingsSection({ testID = 'telemetria' }: { testID?: string }) {
  const { colors } = useTheme();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const consent = useEngagement((s) => s.telemetry);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (signedIn && consent.status === 'idle') void loadTelemetryConsent();
  }, [signedIn, consent.status]);

  const unavailable = consent.status === 'unavailable';
  const on = consent.status === 'ready' && consent.data?.optIn === true;
  const caption = unavailable
    ? 'Ainda não disponível no servidor. Nada é enviado.'
    : on
      ? `${consent.data?.decidedAt ? `Ligado em ${consentDate(consent.data.decidedAt)}` : 'Ligado'}. Só 5 eventos, apagados em ${TELEMETRY_RETENTION_DAYS} dias.`
      : 'Desligado. Nada é enviado.';

  const toggle = async (next: boolean) => {
    setMessage(null);
    if (next) {
      setSheet(true);
      return;
    }
    setBusy(true);
    const res = await setTelemetryOptIn(false);
    setBusy(false);
    setMessage(res.ok ? 'Desligado. Pedimos ao servidor para apagar seus eventos.' : 'Desligado neste aparelho. Avisamos o servidor assim que houver conexão.');
  };

  return (
    <View testID={testID} style={{ gap: space[2] }}>
      <SectionHeader title="Dados de uso" testID={`${testID}-titulo`} />
      <Surface>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
          <Text variant="bodyBold" style={{ flex: 1 }}>
            {TELEMETRY_COPY.title}
          </Text>
          <Switch
            testID={`${testID}-interruptor`}
            accessibilityLabel={TELEMETRY_COPY.title}
            accessibilityHint={on ? 'Desliga e apaga os eventos enviados' : 'Abre a explicação antes de ligar'}
            value={on}
            disabled={unavailable || busy || consent.status === 'loading'}
            onValueChange={(v) => void toggle(v)}
          />
        </View>
        <Text testID={`${testID}-estado`} variant="caption" muted>
          {caption}
        </Text>
        <Button testID={`${testID}-saber-mais`} label="O que é coletado" kind="ghost" icon="eye" onPress={() => setSheet(true)} />
      </Surface>
      {message ? (
        <Text testID={`${testID}-mensagem`} variant="small" accessibilityLiveRegion="polite" color={colors.textSecondary}>
          {message}
        </Text>
      ) : null}
      <TelemetryConsentSheet visible={sheet} onClose={() => setSheet(false)} onDecided={(_, text) => setMessage(text)} />
    </View>
  );
}
