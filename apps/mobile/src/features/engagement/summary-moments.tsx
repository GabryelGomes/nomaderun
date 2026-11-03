/**
 * Momentos de prazer do resumo (F8 · B2): "Primeiro trecho!", "Recorde: 47 trechos", carimbo de bairro novo e o
 * líder comentando o feito real. Só com dado confirmado pelo servidor; sem dado, nada aparece.
 *
 * Animação simples (FadeUp/esmaecer, que já respeitam "Reduzir movimento"). Pontos de encaixe para a E5 (onda C):
 * `FirstPaintMoment` (brilho que corre pela linha), `DistrictStampMoment` (mola com leve rotação) e o
 * `PRStamp` do recorde (já é da E5). Cada um tem `testID` fixo para a galeria `/dev/motion`.
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { LEADER_NAMES, LeaderBust } from '@/components/art';
import { PRStamp } from '@/components/celebration';
import { FadeUp } from '@/components/motion';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import type { RunSummary } from '@/features/run/summary-model';
import { listMyActivities, paintMilestonesOf } from '@/services/api/activities-repo';
import { neon, neonTeam } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { leaderLine } from './leader-lines';
import { HISTORY_PAGE, newDistrictStamp, summaryLeaderFeat, type StampRun } from './moments';

/** "Primeiro trecho pintado" — 1 vez na vida (encaixe da E5: brilho que corre pela linha). */
export function FirstPaintMoment({ team, testID = 'momento-primeiro-trecho' }: { team: FactionId; testID?: string }) {
  const { colors } = useTheme();
  return (
    <FadeUp testID={testID}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel="Primeiro trecho pintado. Uma vez na vida, e foi agora."
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 2, borderColor: neonTeam[team], backgroundColor: colors.surface, boxShadow: `0 0 16px ${neonTeam[team]}55` }}>
        <View aria-hidden style={{ width: 8, alignSelf: 'stretch', borderRadius: radius.pill, backgroundColor: neonTeam[team] }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">Primeiro trecho!</Text>
          <Text variant="small" muted>
            Uma vez na vida, e foi agora.
          </Text>
        </View>
      </View>
    </FadeUp>
  );
}

/** Carimbo de passaporte do bairro novo (encaixe da E5: mola de 1,3 para 1 com leve rotação). */
export function DistrictStampMoment({ name, testID = 'momento-bairro-novo' }: { name: string; testID?: string }) {
  return (
    <FadeUp testID={testID} distance={0}>
      <View accessible accessibilityLabel={`Carimbo novo no Atlas: ${name}`} style={{ alignItems: 'center' }}>
        <View style={{ transform: [{ rotate: '-4deg' }], paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.sm, borderWidth: 3, borderStyle: 'dashed', borderColor: neon.orange, alignItems: 'center', gap: 2 }}>
          <Text variant="label" color={neon.orangeText} style={{ textTransform: 'uppercase' }}>
            Bairro novo no Atlas
          </Text>
          <Text variant="title" color={neon.orangeText} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>
    </FadeUp>
  );
}

/** Balão do líder (máx. 1 por tela). O busto é decorativo; o leitor de tela recebe o nome e a frase. */
export function LeaderComment({ team, text, delay = 300, testID = 'lider-comenta' }: { team: FactionId; text: string; delay?: number; testID?: string }) {
  const { colors } = useTheme();
  const name = LEADER_NAMES[team];
  return (
    <FadeUp testID={testID} delay={delay}>
      <View accessible accessibilityLabel={`${name}, líder do time: ${text}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 52, height: 57 }}>
          <LeaderBust team={team} pose="falando" size={52} quality="leve" />
        </View>
        <View style={{ flex: 1, gap: 2, padding: space[3], borderRadius: radius.lg, borderBottomLeftRadius: radius.sm, borderWidth: 1, borderColor: neonTeam[team], backgroundColor: colors.surface }}>
          <Text variant="label" color={neonTeam[team]}>
            {name}
          </Text>
          <Text variant="body">{text}</Text>
        </View>
      </View>
    </FadeUp>
  );
}

/** Histórico completo (até 200) só quando a corrida pontuou em alguma zona: é o que decide o "bairro novo". */
function useStampHistory(enabled: boolean): StampRun[] | null {
  const [history, setHistory] = useState<StampRun[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void listMyActivities({ limit: HISTORY_PAGE }).then((res) => alive && res.ok && setHistory(res.data));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? history : null;
}

export type SummaryMomentsProps = {
  runId: string;
  team: FactionId;
  /** Resposta oficial crua (`extras.milestones`), do cache do resumo ou de `activities.v2_extras`. */
  official: unknown;
  summary: RunSummary | null;
  /** O resultado é o oficial do servidor (provisório nunca comemora). */
  confirmed: boolean;
};

/**
 * Os momentos do resumo, na ordem: 1º trecho (ou recorde, nunca os dois), carimbo de bairro novo e a fala do
 * líder. Nada aparece com resultado provisório, rejeitado ou em revisão.
 */
export function SummaryMoments({ runId, team, official, summary, confirmed }: SummaryMomentsProps) {
  const counts = confirmed && !!summary && (summary.status === 'valid' || summary.status === 'partial');
  const milestones = useMemo(() => (counts ? paintMilestonesOf(official) : null), [counts, official]);
  const scoredZones = useMemo(() => (counts && summary ? summary.zones.filter((z) => z.rp > 0) : []), [counts, summary]);
  const history = useStampHistory(scoredZones.length > 0 && !milestones?.firstPaint);
  const stamp = useMemo(() => (scoredZones.length > 0 ? newDistrictStamp({ runId, zones: scoredZones, history }) : null), [runId, scoredZones, history]);
  if (!counts || !summary) return null;
  const conquered = summary.zones.find((z) => z.outcome === 'conquered');
  const defended = summary.zones.find((z) => z.outcome === 'defended');
  const feat = summaryLeaderFeat({
    counts,
    milestones,
    conqueredZone: conquered?.name ?? null,
    defendedZone: defended?.name ?? null,
    newDistrict: stamp?.name ?? null,
    beatGhost: summary.beatGhost,
    meters: summary.meters,
  });
  const line = leaderLine(team, feat, runId);
  const record = milestones?.cellsRecord ?? null;
  if (!milestones?.firstPaint && !record && !stamp && !line) return null;
  return (
    <View testID="resumo-momentos" style={{ gap: space[3] }}>
      {milestones?.firstPaint ? <FirstPaintMoment team={team} /> : null}
      {record ? (
        <View style={{ alignItems: 'center', gap: space[1] }}>
          <PRStamp testID="momento-recorde" label="Recorde" metric={`${record.value} trechos`} />
          <Text variant="caption" muted accessibilityLabel={`Seu recorde anterior era ${record.previous} trechos`}>
            {`Antes: ${record.previous}`}
          </Text>
        </View>
      ) : null}
      {stamp ? <DistrictStampMoment name={stamp.name} /> : null}
      {line ? <LeaderComment team={team} text={line} /> : null}
    </View>
  );
}

