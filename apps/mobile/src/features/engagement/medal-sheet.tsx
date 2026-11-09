/**
 * Medalhas tocáveis (UX-34): a folha mostra o nome, o critério do próximo nível e o progresso com o número real
 * da pessoa (corridas, zonas, trechos do Atlas, semanas seguidas). Transparência: dá para ver como se ganha cada
 * uma. "Reduzir movimento" troca o deslizar por esmaecer.
 */
import { Modal, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { MEDAL_LABELS, Medal, type MedalKind, type MedalTier } from '@/components/art';
import { IconButton } from '@/components/button';
import { ProgressBar } from '@/components/motion';
import { Text } from '@/components/text';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type MedalMetric = 'runs' | 'zones' | 'atlasCells' | 'streakWeeks';

const CRITERION: Record<MedalMetric, (n: number) => string> = {
  runs: (n) => (n === 1 ? 'Complete 1 corrida' : `Complete ${n} corridas`),
  zones: (n) => (n === 1 ? 'Conquiste 1 zona' : `Conquiste ${n} zonas`),
  atlasCells: (n) => `Revele ${n} trechos do Atlas`,
  streakWeeks: (n) => `Feche ${n} semanas seguidas`,
};

export type MedalInfo = {
  kind: MedalKind;
  name: string;
  tier: number;
  /** "Nível 2 de 3", "Ainda não é sua". */
  status: string;
  /** O que falta para o próximo nível (ou o critério do último, quando já é máxima). */
  criterion: string;
  /** Progresso até o próximo nível; `null` quando já está no máximo. */
  progress: { value: number; target: number; label: string } | null;
  a11y: string;
};

/** Contas da folha (pura): o nível atual, o próximo degrau e quanto falta, só com o número real. */
export function medalInfo(kind: MedalKind, metric: MedalMetric, value: number, steps: readonly [number, number, number]): MedalInfo {
  const v = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
  const tier = steps.filter((s) => v >= s).length;
  const name = MEDAL_LABELS[kind];
  const next = tier < steps.length ? steps[tier] : null;
  const status = tier === 0 ? 'Ainda não é sua' : `Nível ${tier} de ${steps.length}`;
  const criterion = next !== null ? CRITERION[metric](next) : `${CRITERION[metric](steps[steps.length - 1])}: feito!`;
  const progress = next !== null ? { value: Math.min(v, next), target: next, label: `${v} de ${next}` } : null;
  const a11y = `${name}. ${status}. ${next !== null ? `Próximo nível: ${criterion}. Você tem ${v} de ${next}.` : 'Nível máximo.'}`;
  return { kind, name, tier, status, criterion, progress, a11y };
}

export type MedalSheetProps = { info: MedalInfo | null; onClose: () => void; testID?: string };

export function MedalSheet({ info, onClose, testID = 'medalha-folha' }: MedalSheetProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Modal visible={info !== null} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable testID={`${testID}-fundo`} accessibilityRole="button" accessibilityLabel="Fechar a medalha" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(7,7,8,0.6)' }} />
      {info ? (
        <View testID={testID} style={{ gap: space[3], padding: space[6], paddingBottom: space[8], borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <Medal kind={info.kind} tier={Math.max(1, info.tier) as MedalTier} locked={info.tier === 0} size={88} />
            <View accessible accessibilityLabel={info.a11y} style={{ flex: 1, gap: 2 }}>
              <Text variant="title" accessibilityRole="header">
                {info.name}
              </Text>
              <Text variant="small" color={info.tier > 0 ? colors.accentText : colors.textSecondary}>
                {info.status}
              </Text>
            </View>
            <IconButton testID={`${testID}-fechar`} icon="close" label="Fechar" tone="sunken" size={44} onPress={onClose} />
          </View>
          <Text variant="bodyBold">{info.criterion}</Text>
          {info.progress ? (
            <View style={{ gap: space[1] }}>
              <ProgressBar value={info.progress.value / info.progress.target} color={colors.action} trackColor={colors.surfaceSunken} height={8} accessibilityLabel={`${info.progress.label}`} />
              <Text variant="caption" muted tabular>
                {info.progress.label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Modal>
  );
}
