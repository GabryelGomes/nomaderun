import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SettingsGroup, SettingsRow, ToggleRow } from '@/components/settings-row';
import { Text } from '@/components/text';
import type { IconName } from '@/components/icon';
import { saveProfile } from '@/features/auth/session-controller';
import { HealthPauseSheet, TelemetrySettingsSection } from '@/features/engagement';
import { ReminderSettingsSection } from '@/features/notifications/reminder-settings';
import { FeedSettings } from '@/features/social/feed';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/services/api/types';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';

/**
 * F8-B3 (UX-16): 3 das 4 telas de Ajustes (a 4ª, Conta, é `account-screen.tsx`). Cada uma cabe numa tela,
 * com um título só e linhas sem subtítulo (D-74); só a Segurança na corrida explica em 1 frase.
 */

/** Segurança na corrida (UX-12): um nome só e as mesmas 2 opções da Nova corrida, mais os contatos. */
export function SafetySettingsScreen() {
  const contacts = useGame((s) => s.safetyContacts.length);
  const escortOn = useGame((s) => s.escortOn);
  const stopAlertOn = useGame((s) => s.stopAlertOn);
  const toggleEscort = useGame((s) => s.toggleEscort);
  const toggleStopAlert = useGame((s) => s.toggleStopAlert);
  return (
    <ScreenScroll testID="tela-ajustes-seguranca" edges={['bottom']} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stagger gap={space[6]}>
        <SettingsGroup title="Corrida Segura" note="No SOS e nestas opções, seus contatos recebem sua localização.">
          <ToggleRow testID="perfil-escolta" icon="location" title="Compartilhar ao vivo" value={escortOn} onChange={() => toggleEscort()} />
          <ToggleRow testID="perfil-alerta-parada" icon="timer" title="Avisar se eu parar" value={stopAlertOn} onChange={() => toggleStopAlert()} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow
            testID="perfil-contatos-seguranca"
            icon="shield"
            title="Contatos de segurança"
            value={contacts > 0 ? String(contacts) : undefined}
            onPress={() => router.push('/contatos-seguranca' as Href)}
          />
        </SettingsGroup>
      </Stagger>
    </ScreenScroll>
  );
}

/** Privacidade: zonas de privacidade, o feed da crew e os dados de uso (opt-in, E7). */
export function PrivacySettingsScreen() {
  return (
    <ScreenScroll testID="tela-ajustes-privacidade" edges={['bottom']} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stagger gap={space[6]}>
        <SettingsGroup title="Sua rota" note="O começo e o fim perto de casa ficam escondidos.">
          <SettingsRow testID="perfil-zonas-privacidade" icon="home" title="Zonas de privacidade" onPress={() => router.push('/zonas-privacidade' as Href)} />
          {/* E8: corridas e mapa no feed da crew. Some sozinho quando o servidor não tem o feed. */}
          <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
            <FeedSettings />
          </View>
        </SettingsGroup>
        <TelemetrySettingsSection />
      </Stagger>
    </ScreenScroll>
  );
}

/** Avisos da conta que não são lembretes (os de missões moram nos Lembretes, com a mesma chave). */
const ALERTS: { key: Exclude<keyof NotificationPrefs, 'missions'>; title: string; icon: IconName }[] = [
  { key: 'invasions', title: 'Invasões', icon: 'warning' },
  { key: 'conquests', title: 'Conquistas', icon: 'flag' },
  { key: 'moderation', title: 'Revisão das corridas', icon: 'eye' },
];

/**
 * Lembretes: o único lugar das notificações (UX-16). Avisos do jogo, os lembretes da E7 (horários e silêncio) e
 * a Pausa de saúde, com esse nome só. Cada interruptor grava na hora (antes, os avisos ficavam em Editar perfil
 * e só valiam depois de "Salvar").
 */
export function RemindersSettingsScreen() {
  const prefs = useSession((s) => s.profile?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS);
  const [pending, setPending] = useState<Partial<NotificationPrefs>>({});
  const [error, setError] = useState<string | null>(null);
  const [pause, setPause] = useState(false);
  const value: NotificationPrefs = { ...prefs, ...pending };

  const change = async (key: keyof NotificationPrefs, on: boolean) => {
    setPending((p) => ({ ...p, [key]: on }));
    setError(null);
    const current = useSession.getState().profile?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;
    const res = await saveProfile({ notificationPrefs: { ...current, [key]: on } });
    setPending((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
    if (!res.ok) setError(res.error.message);
  };

  return (
    <ScreenScroll testID="tela-ajustes-lembretes" edges={['bottom']} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stagger gap={space[6]}>
        <SettingsGroup title="Avisos do jogo">
          {ALERTS.map((a) => (
            <ToggleRow key={a.key} testID={`perfil-notificacao-${a.key}`} icon={a.icon} title={a.title} value={value[a.key] !== false} onChange={(on) => void change(a.key, on)} />
          ))}
        </SettingsGroup>
        {error ? (
          <Text testID="ajustes-avisos-erro" variant="small" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {/* A seção da E7 guarda uma cópia das preferências: remonta quando um aviso daqui muda, para não gravar a cópia velha. */}
        <ReminderSettingsSection key={ALERTS.map((a) => String(prefs[a.key])).join('-')} testID="lembretes" />

        <SettingsGroup>
          <SettingsRow testID="ajustes-pausa" icon="moon" title="Pausa de saúde" onPress={() => setPause(true)} />
        </SettingsGroup>
      </Stagger>
      <HealthPauseSheet visible={pause} onClose={() => setPause(false)} testID="ajustes-pausa-folha" />
    </ScreenScroll>
  );
}
