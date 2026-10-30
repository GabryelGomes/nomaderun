import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Switch, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SettingsRow } from '@/components/settings-row';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { signOut } from '@/features/auth/session-controller';
import { HealthPauseSheet, TelemetrySettingsSection } from '@/features/engagement';
import { canModerate } from '@/features/moderation/guard';
import { ReminderSettingsSection } from '@/features/notifications/reminder-settings';
import { FeedSettings } from '@/features/social/feed';
import { InviteCard } from '@/features/social/invite';
import { useGame } from '@/store/game-store';
import { useMotionPrefs } from '@/store/motion-prefs-store';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Ajustes (engrenagem de "Você", T7.3.1). Tudo o que saiu do perfil mora aqui, em grupos curtos: conta,
 * Corrida Segura, privacidade (com o feed da crew, E8), jogo (vibração, celebrações e pausa, E5/E7), lembretes
 * (E7) e o convite do app (E8). Linhas sem subtítulo (D-74); só a Corrida Segura explica em 1 frase.
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const unread = useNotifications(selectUnreadCount);
  const staff = useSession((s) => canModerate(s.profile?.role));
  const city = useSession((s) => s.profile?.city ?? null);
  const faction = useSession((s) => s.profile?.faction ?? null);
  const contacts = useGame((s) => s.safetyContacts.length);
  const escortOn = useGame((s) => s.escortOn);
  const stopAlertOn = useGame((s) => s.stopAlertOn);
  const toggleEscort = useGame((s) => s.toggleEscort);
  const toggleStopAlert = useGame((s) => s.toggleStopAlert);
  const haptics = useMotionPrefs((s) => s.haptics);
  const skipCelebrations = useMotionPrefs((s) => s.skipCelebrations);
  const [pause, setPause] = useState(false);

  return (
    <ScreenScroll testID="tela-ajustes" edges={['bottom']} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stagger gap={space[6]}>
        <Group title="Conta">
          <SettingsRow testID="perfil-editar" icon="edit" title="Editar perfil" onPress={() => router.push('/perfil/editar' as Href)} />
          <SettingsRow
            testID="perfil-notificacoes"
            icon="bell"
            title="Notificações"
            value={unread > 0 ? (unread === 1 ? '1 nova' : `${unread} novas`) : undefined}
            onPress={() => router.push('/notificacoes' as Href)}
          />
          <SettingsRow testID="perfil-conta" icon="lock" title="Conta e privacidade" onPress={() => router.push('/perfil/conta' as Href)} />
          {staff ? <SettingsRow testID="perfil-moderacao" icon="shield" title="Moderação" onPress={() => router.push('/moderacao' as Href)} /> : null}
        </Group>

        {/* UX-12: um nome só ("Corrida Segura") e as mesmas 2 opções da Nova corrida. */}
        <Group title="Corrida Segura" note="No SOS e nestas opções, seus contatos recebem sua localização.">
          <ToggleRow testID="perfil-escolta" icon="location" title="Compartilhar ao vivo" value={escortOn} onChange={toggleEscort} />
          <ToggleRow testID="perfil-alerta-parada" icon="timer" title="Avisar se eu parar" value={stopAlertOn} onChange={toggleStopAlert} />
          <SettingsRow
            testID="perfil-contatos-seguranca"
            icon="shield"
            title="Contatos de segurança"
            value={contacts > 0 ? String(contacts) : undefined}
            onPress={() => router.push('/contatos-seguranca' as Href)}
          />
        </Group>

        <Group title="Privacidade" note="O começo e o fim perto de casa ficam escondidos.">
          <SettingsRow testID="perfil-zonas-privacidade" icon="home" title="Zonas de privacidade" onPress={() => router.push('/zonas-privacidade' as Href)} />
          {/* E8: corridas e mapa no feed da crew. Some sozinho quando o servidor não tem o feed. */}
          <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
            <FeedSettings />
          </View>
        </Group>

        <Group title="Jogo">
          {/* E5: preferências do aparelho. "Vibração" desligada não cala os alertas de segurança. */}
          <ToggleRow testID="ajustes-vibracao" icon="vibrate" title="Vibração" value={haptics} onChange={() => useMotionPrefs.getState().setHaptics(!haptics)} />
          <ToggleRow
            testID="ajustes-pular-celebracoes"
            icon="sparkles"
            title="Pular celebrações"
            value={skipCelebrations}
            onChange={() => useMotionPrefs.getState().setSkipCelebrations(!skipCelebrations)}
          />
          <SettingsRow testID="ajustes-pausa" icon="moon" title="Pausa de saúde" onPress={() => setPause(true)} />
        </Group>

        <ReminderSettingsSection testID="lembretes" />

        <TelemetrySettingsSection />

        <InviteCard kind="app" place={city} faction={faction} testID="convite-app" />

        <View style={{ borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
          <SettingsRow testID="perfil-sair" icon="logout" title="Sair" destructive accessibilityLabel="Sair desta conta neste aparelho" onPress={() => void signOut()} />
        </View>
      </Stagger>
      <HealthPauseSheet visible={pause} onClose={() => setPause(false)} testID="ajustes-pausa-folha" />
    </ScreenScroll>
  );
}

/** Grupo de linhas: título, 1 frase opcional e as linhas num cartão só. */
function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <SectionHeader title={title} />
      {note ? (
        <Text variant="caption" muted style={{ paddingHorizontal: space[1] }}>
          {note}
        </Text>
      ) : null}
      <Surface padded={false} style={{ overflow: 'hidden', gap: 0 }}>
        {children}
      </Surface>
    </View>
  );
}

/** Linha com interruptor (mesma altura e ícone da `SettingsRow`). */
function ToggleRow({ testID, icon, title, value, onChange }: { testID: string; icon: IconName; title: string; value: boolean; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2] }}>
      <Icon name={icon} size={22} color={colors.text} />
      <Text variant="bodyBold" style={{ flex: 1 }}>
        {title}
      </Text>
      <Switch testID={testID} accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: colors.action, false: colors.lineControl }} />
    </View>
  );
}
