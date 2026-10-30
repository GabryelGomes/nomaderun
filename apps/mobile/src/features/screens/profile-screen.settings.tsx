import { router, type Href } from 'expo-router';

import { Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SettingsGroup, SettingsRow, ToggleRow } from '@/components/settings-row';
import { canModerate } from '@/features/moderation/guard';
import { useGame } from '@/store/game-store';
import { useMotionPrefs } from '@/store/motion-prefs-store';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';

/** As 4 telas de Ajustes (UX-16, F8-B3). Cada uma com a sua rota, dentro da aba Você. */
export const SETTINGS_ROUTES = {
  conta: '/perfil/conta',
  seguranca: '/perfil/seguranca',
  privacidade: '/perfil/privacidade',
  lembretes: '/perfil/lembretes',
} as const;

/**
 * Ajustes (engrenagem de "Você"). F8-B3 (UX-16): antes, 5 rolagens com notificações em 3 lugares, "Convidar" e
 * "Sair" duplicados. Agora, 4 linhas que abrem 4 telas curtas (Conta · Segurança na corrida · Privacidade ·
 * Lembretes) e as 2 preferências do aparelho (vibração e celebrações). O convite mora só no Clube; "Sair", só
 * em Conta (com confirmação); os avisos e a Pausa de saúde, só em Lembretes.
 */
export function SettingsScreen() {
  const staff = useSession((s) => canModerate(s.profile?.role));
  const escortOn = useGame((s) => s.escortOn);
  const stopAlertOn = useGame((s) => s.stopAlertOn);
  const haptics = useMotionPrefs((s) => s.haptics);
  const skipCelebrations = useMotionPrefs((s) => s.skipCelebrations);
  const safetyOn = escortOn || stopAlertOn;
  const go = (href: string) => () => router.push(href as Href);

  return (
    <ScreenScroll testID="tela-ajustes" edges={['bottom']} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stagger gap={space[6]}>
        <SettingsGroup testID="ajustes-telas">
          <SettingsRow testID="ajustes-conta" icon="profile" title="Conta" accessibilityLabel="Conta: perfil, dados e sair" onPress={go(SETTINGS_ROUTES.conta)} />
          <SettingsRow testID="ajustes-seguranca" icon="shield" title="Segurança na corrida" value={safetyOn ? 'Ligada' : undefined} onPress={go(SETTINGS_ROUTES.seguranca)} />
          <SettingsRow testID="ajustes-privacidade" icon="eye" title="Privacidade" onPress={go(SETTINGS_ROUTES.privacidade)} />
          <SettingsRow testID="ajustes-lembretes" icon="bell" title="Lembretes" accessibilityLabel="Lembretes: avisos, horários e Pausa de saúde" onPress={go(SETTINGS_ROUTES.lembretes)} />
          {staff ? <SettingsRow testID="perfil-moderacao" icon="eye" title="Moderação" onPress={go('/moderacao')} /> : null}
        </SettingsGroup>

        <SettingsGroup title="Neste aparelho">
          {/* E5: "Vibração" desligada não cala os alertas de segurança. */}
          <ToggleRow testID="ajustes-vibracao" icon="vibrate" title="Vibração" value={haptics} onChange={() => useMotionPrefs.getState().setHaptics(!haptics)} />
          <ToggleRow
            testID="ajustes-pular-celebracoes"
            icon="sparkles"
            title="Pular celebrações"
            value={skipCelebrations}
            onChange={() => useMotionPrefs.getState().setSkipCelebrations(!skipCelebrations)}
          />
        </SettingsGroup>
      </Stagger>
    </ScreenScroll>
  );
}
