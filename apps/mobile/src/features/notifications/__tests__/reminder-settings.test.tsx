/**
 * T7.2.4 (E7, D-69): ajustes dos lembretes — um interruptor por tipo, silêncio da pessoa e "pausar por 7 dias".
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('@/features/engagement/local-store', () => ({ readLocal: async () => null, writeLocal: async () => undefined }));

/* eslint-disable import/first */
import { act } from 'react-test-renderer';

import { render, type Rendered } from '@/components/__tests__/render-helpers';
import { brtCalendar } from '@/domain/progression';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/services/api/types';

import { EMPTY_DEVICE_PREFS, type DeviceReminderPrefs } from '../reminder-state';
import { REMINDER_TOGGLES, ReminderSettings } from '../reminder-settings';
/* eslint-enable import/first */

const NOW = brtCalendar.at('2026-10-23', 9);
const mounted: Rendered[] = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.renderer.unmount()));
});

function show(prefs: NotificationPrefs, device: DeviceReminderPrefs) {
  const changes: { prefs: NotificationPrefs[]; device: DeviceReminderPrefs[] } = { prefs: [], device: [] };
  const r = render(<ReminderSettings prefs={prefs} device={device} now={NOW} onChangePrefs={(p) => changes.prefs.push(p)} onChangeDevice={(d) => changes.device.push(d)} />);
  mounted.push(r);
  return { r, changes };
}

describe('ajustes dos lembretes', () => {
  it('um interruptor por tipo; chave ausente aparece ligada; desligar manda a chave', () => {
    const { r, changes } = show(DEFAULT_NOTIFICATION_PREFS, EMPTY_DEVICE_PREFS);
    for (const t of REMINDER_TOGGLES) {
      const sw = r.host(`lembretes-${t.key}`);
      expect(sw.props.value ?? sw.props.on ?? true).toBeTruthy();
      expect(t.title.length).toBeLessThanOrEqual(30);
    }
    const chests = r.all('lembretes-chests').find((n) => typeof n.props.onValueChange === 'function')!;
    act(() => chests.props.onValueChange(false));
    expect(changes.prefs[0]).toMatchObject({ chests: false, invasions: true });
    expect(r.text()).toContain('No máximo 1 por dia, das 8h às 21h');
  });

  it('silêncio só amplia o padrão; pausar por 7 dias e retomar', () => {
    const { r, changes } = show(DEFAULT_NOTIFICATION_PREFS, EMPTY_DEVICE_PREFS);
    r.press('lembretes-silencio-20');
    r.press('lembretes-manha-9');
    r.press('lembretes-pausar');
    expect(changes.device).toEqual([
      { quietStart: 20, quietEnd: null, snoozeUntil: null },
      { quietStart: null, quietEnd: 9, snoozeUntil: null },
      { quietStart: null, quietEnd: null, snoozeUntil: NOW + 7 * 86_400_000 },
    ]);
    const paused = show(DEFAULT_NOTIFICATION_PREFS, { ...EMPTY_DEVICE_PREFS, snoozeUntil: NOW + 7 * 86_400_000 });
    expect(paused.r.text()).toContain('Lembretes pausados até 30/10.');
    paused.r.press('lembretes-retomar');
    expect(paused.changes.device[0].snoozeUntil).toBeNull();
  });
});
