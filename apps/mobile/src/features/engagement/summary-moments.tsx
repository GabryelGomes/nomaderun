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

import { BOSS_IDS, BOSS_NAMES, LEADER_NAMES, LeaderBust } from '@/components/art';
import { BossHit, PRStamp } from '@/components/celebration';
import { DISTRICT_STAMP, FIRST_PAINT, LEADER_COMMENT, leaderCommentDelay, RECORD_COUNT, recordCountEndMs } from '@/components/celebration/f8-choreography';
import { FadeUp } from '@/components/motion';
import { StampIn } from '@/components/motion/stamp-in';
import { TrailGlow } from '@/components/motion/trail-glow';
import { Text } from '@/components/text';
import { formatKm } from '@/domain/geo';
import type { FactionId } from '@/domain/types';
import { raidPhaseHitOf, type RaidPhaseHit } from '@/features/run/summary-extras';
import type { RunSummary } from '@/features/run/summary-model';
import { listMyActivities, paintMilestonesOf } from '@/services/api/activities-repo';
import { neon, neonTeam } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { leaderLine } from './leader-lines';
import { HISTORY_PAGE, newDistrictStamp, summaryLeaderFeat, type StampRun } from './moments';

/** O brilho do 1º trecho corre depois de o cartão subir (FadeUp de 500 ms). */
const FIRST_PAINT_GLOW_AT = 450;

/** "Primeiro trecho pintado" — 1 vez na vida (E5, F8 · C1: o brilho corre pela linha do rastro, 400 ms). */
export function FirstPaintMoment({ team, testID = 'momento-primeiro-trecho' }: { team: FactionId; testID?: string }) {
  const { colors } = useTheme();
  return (
    <FadeUp testID={testID}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel="Primeiro trecho pintado. Uma vez na vida, e foi agora."
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 2, borderColor: neonTeam[team], backgroundColor: colors.surface, boxShadow: `0 0 16px ${neonTeam[team]}55` }}>
        <TrailGlow color={neonTeam[team]} width={56} delay={FIRST_PAINT_GLOW_AT} duration={FIRST_PAINT.glowMs} testID={`${testID}-brilho`} />
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

/** Carimbo de passaporte do bairro novo (E5, F8 · C1: mola `stamp` de 1,3 → 1 com rotação −6° → 0, 1 vibração). */
export function DistrictStampMoment({ name, delay = 0, testID = 'momento-bairro-novo' }: { name: string; delay?: number; testID?: string }) {
  return (
    <StampIn testID={testID} from={DISTRICT_STAMP.fromScale} rotate={DISTRICT_STAMP.fromRotate} delay={delay} haptics>
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
    </StampIn>
  );
}

/**
 * Balão do líder (máx. 1 por tela). O busto é decorativo; o leitor de tela recebe o nome e a frase. E5 (F8 · C1):
 * entra com fade + 8 pt de subida, 300 ms depois dos números (`leaderCommentDelay`), com o busto `falando` vivo.
 */
export function LeaderComment({ team, text, delay = leaderCommentDelay(null), testID = 'lider-comenta' }: { team: FactionId; text: string; delay?: number; testID?: string }) {
  const { colors } = useTheme();
  const name = LEADER_NAMES[team];
  return (
    <FadeUp testID={testID} delay={delay} distance={LEADER_COMMENT.rise} duration={LEADER_COMMENT.ms}>
      <View accessible accessibilityLabel={`${name}, líder do time: ${text}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 52, height: 57 }}>
          <LeaderBust team={team} pose="falando" size={52} quality="leve" animated />
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
  const phaseHit = raidPhaseHitOf(official);
  if (!milestones?.firstPaint && !record && !stamp && !line && !phaseHit) return null;
  return (
    <View testID="resumo-momentos" style={{ gap: space[3] }}>
      {phaseHit ? <BossPhaseMoment hit={phaseHit} /> : null}
      {milestones?.firstPaint ? <FirstPaintMoment team={team} /> : null}
      {record ? (
        <View style={{ alignItems: 'center', gap: space[1] }}>
          {/* E5 (F8 · C1): o número conta de 0 ao recorde e o selo pulsa 2× */}
          <PRStamp testID="momento-recorde" label="Recorde" metric={`${record.value} trechos`} count={{ value: record.value, unit: 'trechos' }} pulses={RECORD_COUNT.pulses} />
          <Text variant="caption" muted accessibilityLabel={`Seu recorde anterior era ${record.previous} trechos`}>
            {`Antes: ${record.previous}`}
          </Text>
        </View>
      ) : null}
      {stamp ? <DistrictStampMoment name={stamp.name} /> : null}
      {/* o balão entra 300 ms depois dos números (com recorde, depois da contagem) */}
      {line ? <LeaderComment team={team} text={line} delay={leaderCommentDelay(record ? recordCountEndMs() : null)} /> : null}
    </View>
  );
}

/**
 * "Golpe que abre fase" (E5, F8 · C1): só quando o servidor diz que esta corrida levou o chefão abaixo de 67% ou 33%
 * (`extras.raid.phaseChanged`). O cambaleio do `BossHit`, a tarja "Você abriu a fase N!" e os pontos fracos surgindo.
 */
export function BossPhaseMoment({ hit, testID = 'momento-fase-chefao' }: { hit: RaidPhaseHit; testID?: string }) {
  const id = BOSS_IDS.find((b) => b === hit.bossId);
  const name = id ? BOSS_NAMES[id] : 'Chefão';
  const km = formatKm(hit.countedKm * 1000, 1);
  return (
    <View style={{ alignItems: 'center' }}>
      <BossHit testID={testID} bossName={name} bossId={id} hpFrom={hit.hpBefore} hpTo={hit.hpAfter} hpMax={hit.hpMax} damageLabel={`−${km} km`} mineLabel={`Sua parte: ${km} km`} phaseOpened={hit.phaseAfter} />
    </View>
  );
}

