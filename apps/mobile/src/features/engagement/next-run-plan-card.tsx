import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { FadeUp } from '@/components/motion';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { nextRunPlanOptions, type PlanOption } from '@/domain/reminders';
import { replanReminders } from '@/features/notifications/reminders';
import { notificationPermissionStatus, requestNotificationPermission } from '@/features/run/notification-permission';
import { useEngagement } from '@/store/engagement-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { answerPlan, planQuestionDue } from './next-run-plan';

export type NextRunPlanCardProps = {
  /** Relógio da tela (o resumo usa o instante em que abriu). */
  now: number;
  testID?: string;
};

type Phase = { kind: 'checking' } | { kind: 'asking' } | { kind: 'planned'; option: PlanOption; avisos: boolean } | { kind: 'gone' };

/**
 * D-94 — "Quando você corre de novo?" no fim do resumo: 3 horários (amanhã, depois, fim de semana de manhã) e
 * "Agora não" com o mesmo peso visual de um link (recusa neutra, sem confirmshaming). Escolher vira 1 aviso local
 * `plano` no horário (dentro do limite de 1 por dia e 4 por semana, D-69). Aparece no 1º resumo e depois no
 * máximo 1 vez por semana, só sem plano marcado. Se a pessoa nunca decidiu sobre avisos, pedir a permissão aqui é
 * pedir no contexto: ela acabou de pedir um lembrete.
 */
export function NextRunPlanCard({ now, testID = 'plano-proxima' }: NextRunPlanCardProps) {
  const { colors } = useTheme();
  const recent = useEngagement((s) => s.status.data?.recentStartTimes ?? null);
  const options = useMemo(() => nextRunPlanOptions(now, recent ?? []), [now, recent]);
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void planQuestionDue(now).then((due) => alive && setPhase(due ? { kind: 'asking' } : { kind: 'gone' }));
    return () => {
      alive = false;
    };
  }, [now]);

  const choose = async (option: PlanOption) => {
    setBusy(true);
    await answerPlan(option.at, now);
    let status = await notificationPermissionStatus();
    if (status === 'undetermined') status = (await requestNotificationPermission()) ? 'granted' : 'denied';
    void replanReminders();
    setBusy(false);
    setPhase({ kind: 'planned', option, avisos: status === 'granted' });
  };

  const decline = async () => {
    await answerPlan(null, now);
    setPhase({ kind: 'gone' });
  };

  if (phase.kind === 'checking' || phase.kind === 'gone') return null;

  if (phase.kind === 'planned') {
    return (
      <FadeUp>
        <View testID={`${testID}-combinado`} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Combinado: ${phase.option.a11y}. ${phase.avisos ? 'Um aviso no horário.' : 'Plano anotado; os avisos estão desligados.'}`}>
        <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Icon name="check" size={22} color={colors.accentText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyBold">{`Combinado: ${phase.option.label}`}</Text>
            <Text variant="small" muted>
              {phase.avisos ? 'Um aviso no horário. Só esse.' : 'Plano anotado. Avisos desligados.'}
            </Text>
          </View>
        </Surface>
        </View>
      </FadeUp>
    );
  }

  return (
    <FadeUp testID={testID}>
      <Surface style={{ gap: space[3] }}>
        <View style={{ gap: 2 }}>
          <Text variant="title" accessibilityRole="header">
            Quando você corre de novo?
          </Text>
          <Text variant="small" muted>
            Um aviso no horário. Caminhar vale.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {options.map((o, i) => (
            <View key={o.at} style={{ flexGrow: 1, flexBasis: '30%', minWidth: 96, borderRadius: radius.pill }}>
              <Button testID={`${testID}-opcao-${i + 1}`} label={o.label} kind="secondary" wide disabled={busy} onPress={() => void choose(o)} />
            </View>
          ))}
        </View>
        <Button testID={`${testID}-agora-nao`} label="Agora não" kind="ghost" disabled={busy} onPress={() => void decline()} />
      </Surface>
    </FadeUp>
  );
}
