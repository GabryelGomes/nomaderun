import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { PressableScale } from '@/components/motion';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { brtCalendar } from '@/domain/progression';
import { saveProfile } from '@/features/auth/session-controller';
import { useNow } from '@/features/use-now';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/services/api/types';
import { useSession } from '@/store/session-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { EMPTY_DEVICE_PREFS, type DeviceReminderPrefs } from './reminder-state';
import { readDevicePrefs, replanReminders, writeDevicePrefs } from './reminders';

type ReminderKey = 'chests' | 'streak' | 'missions' | 'league' | 'raid' | 'season' | 'recap' | 'comeback';

/** Cada tipo de lembrete com o seu interruptor (transparência: a pessoa desliga o que quiser). */
export const REMINDER_TOGGLES: readonly { key: ReminderKey; title: string }[] = [
  { key: 'chests', title: 'Baú do dia guardado' },
  { key: 'streak', title: 'Falta 1 para a semana' },
  { key: 'missions', title: 'Missões e primeira semana' },
  { key: 'raid', title: 'Chefão da semana' },
  { key: 'league', title: 'Fim da liga' },
  { key: 'season', title: 'Temporada nova' },
  { key: 'recap', title: 'Resumo da semana' },
  { key: 'comeback', title: 'Volta depois de uma pausa' },
];

const LATE = [null, 20, 19] as const;
const EARLY = [null, 9, 10] as const;
export const SNOOZE_DAYS = 7;

export type ReminderSettingsProps = {
  prefs: NotificationPrefs;
  device: DeviceReminderPrefs;
  onChangePrefs: (next: NotificationPrefs) => void;
  onChangeDevice: (next: DeviceReminderPrefs) => void;
  /** Relógio da tela (`useNow`). */
  now: number;
  testID?: string;
};

const isOn = (prefs: NotificationPrefs, key: ReminderKey) => prefs[key] !== false;

function Choice({ testID, label, a11y, on, onPress }: { testID: string; label: string; a11y: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={a11y}
      onPress={onPress}
      containerStyle={{ flex: 1 }}
      style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: on ? colors.action : colors.lineControl, backgroundColor: on ? neon.activeFill : 'transparent' }}>
      <Text variant="small" color={on ? colors.accentText : colors.text}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Ajustes dos lembretes (D-69): um interruptor por tipo, o silêncio da pessoa (só amplia o padrão de 21h às 8h)
 * e "pausar por 7 dias". Componente de apresentação; `ReminderSettingsSection` liga na conta e no aparelho.
 */
export function ReminderSettings({ prefs, device, onChangePrefs, onChangeDevice, now, testID = 'lembretes' }: ReminderSettingsProps) {
  const { colors } = useTheme();
  const snoozed = device.snoozeUntil !== null && device.snoozeUntil > now;
  return (
    <View testID={testID} style={{ gap: space[3] }}>
      <SectionHeader title="Lembretes" testID={`${testID}-titulo`} />
      <Text variant="caption" muted>
        No máximo 1 por dia, das 8h às 21h, e nunca no dia em que você já correu.
      </Text>
      <Surface>
        {REMINDER_TOGGLES.map((t) => (
          <View key={t.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}>
            <Text variant="bodyBold" style={{ flex: 1 }}>
              {t.title}
            </Text>
            <Switch
              testID={`${testID}-${t.key}`}
              accessibilityLabel={`Lembrete: ${t.title}`}
              value={isOn(prefs, t.key)}
              onValueChange={(v) => onChangePrefs({ ...prefs, [t.key]: v })}
            />
          </View>
        ))}
      </Surface>
      <Surface>
        <Text variant="bodyBold">Sem lembretes depois das</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[2] }}>
          {LATE.map((h) => (
            <Choice key={String(h)} testID={`${testID}-silencio-${h ?? 21}`} label={`${h ?? 21}h`} a11y={`Sem lembretes depois das ${h ?? 21} horas`} on={device.quietStart === h} onPress={() => onChangeDevice({ ...device, quietStart: h })} />
          ))}
        </View>
        <Text variant="bodyBold">Nem antes das</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[2] }}>
          {EARLY.map((h) => (
            <Choice key={String(h)} testID={`${testID}-manha-${h ?? 8}`} label={`${h ?? 8}h`} a11y={`Nem antes das ${h ?? 8} horas`} on={device.quietEnd === h} onPress={() => onChangeDevice({ ...device, quietEnd: h })} />
          ))}
        </View>
      </Surface>
      {snoozed ? (
        <View style={{ gap: space[2] }}>
          <Text testID={`${testID}-pausados`} variant="small" color={colors.textSecondary}>
            {`Lembretes pausados até ${brtCalendar.clock(device.snoozeUntil!).dayId.split('-').reverse().slice(0, 2).join('/')}.`}
          </Text>
          <Button testID={`${testID}-retomar`} label="Retomar lembretes" kind="secondary" wide onPress={() => onChangeDevice({ ...device, snoozeUntil: null })} />
        </View>
      ) : (
        <Button testID={`${testID}-pausar`} label={`Pausar lembretes por ${SNOOZE_DAYS} dias`} kind="secondary" wide onPress={() => onChangeDevice({ ...device, snoozeUntil: now + SNOOZE_DAYS * 86_400_000 })} />
      )}
    </View>
  );
}

/**
 * Pronto para a tela de conta (E6): lê e grava as preferências da conta (`saveProfile`) e as do aparelho, e
 * replaneja os lembretes a cada mudança.
 */
export function ReminderSettingsSection({ testID }: { testID?: string }) {
  const now = useNow(60_000);
  const profilePrefs = useSession((s) => s.profile?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS);
  const [prefs, setPrefs] = useState<NotificationPrefs>(profilePrefs);
  const [device, setDevice] = useState<DeviceReminderPrefs>(EMPTY_DEVICE_PREFS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void readDevicePrefs().then((d) => alive && setDevice(d));
    return () => {
      alive = false;
    };
  }, []);

  const changePrefs = async (next: NotificationPrefs) => {
    setPrefs(next);
    setError(null);
    const res = await saveProfile({ notificationPrefs: next });
    if (!res.ok) {
      setPrefs(profilePrefs);
      setError(res.error.message);
    }
  };

  const changeDevice = async (next: DeviceReminderPrefs) => {
    setDevice(next);
    await writeDevicePrefs(next);
    void replanReminders();
  };

  return (
    <View style={{ gap: space[2] }}>
      <ReminderSettings prefs={prefs} device={device} now={now} onChangePrefs={(p) => void changePrefs(p)} onChangeDevice={(d) => void changeDevice(d)} testID={testID} />
      {error ? (
        <Text testID={`${testID ?? 'lembretes'}-erro`} variant="small" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
