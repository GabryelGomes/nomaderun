import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { RevealText, Stagger } from '@/components/motion';
import { EmptyState, Stat, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import TerritoryMap from '@/components/territory-map';
import { SUSTAINED_KMH } from '@/domain/anti-cheat';
import { ErrorNotice, InfoNotice, TextField } from '@/features/auth/form-ui';
import { SectionTitle } from '@/features/screens/game-motion';
import { useResource } from '@/features/screens/use-resource';
import { getReviewDetail, JUSTIFICATION_MAX, moderateActivity, validateJustification, type ModerationDecision } from '@/services/api/moderation-repo';
import { palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { flagExplanation, FLAG_TITLE, formatDateTime, formatKm, formatPace, REVIEW_REASON_TEXT } from './labels';
import { LineChart } from './line-chart';
import { activitySeries, pathFrame } from './series';

/** Detalhe da corrida em revisão: percurso, gráficos, alertas e decisão com justificativa (RF-018). */
export function ModerationDetailScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useResource(() => getReviewDetail(String(id)), [id]);
  const series = useMemo(() => (data ? activitySeries(data.points) : null), [data]);
  const frame = useMemo(() => (series ? pathFrame(series.path) : null), [series]);
  const [justification, setJustification] = useState('');
  const [justError, setJustError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ModerationDecision | null>(null);
  const [done, setDone] = useState<{ decision: ModerationDecision; status: string; rp?: number } | null>(null);

  const decide = async (decision: ModerationDecision) => {
    const err = validateJustification(justification);
    setJustError(err);
    setSubmitError(null);
    if (err || !data) return;
    setBusy(decision);
    const res = await moderateActivity(data.id, decision, justification);
    setBusy(null);
    if (!res.ok) {
      setSubmitError(res.error.message);
      return;
    }
    setDone({ decision, status: res.data.status, rp: res.data.result?.rpTotal });
    void reload();
  };

  if (!data) {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.action} />
        </View>
      );
    }
    return (
      <EmptyState
        title="Corrida não encontrada"
        body={error?.message ?? 'Ela pode ter sido excluída.'}
        action={<Button testID="moderacao-detalhe-tentar" label="Tentar de novo" kind="secondary" onPress={reload} />}
      />
    );
  }

  const inReview = data.status === 'review' && !done;

  const mapBlock = (
    <Surface padded={false} style={{ overflow: 'hidden', height: wide ? 420 : 280 }}>
      {frame ? <TerritoryMap zones={[]} center={frame.center} span={frame.spanM} path={series?.path} /> : <EmptyState title="Sem percurso" body="Esta corrida não tem pontos gravados." />}
    </Surface>
  );

  const facts = (
    <Surface>
      <RevealText variant="headline">{data.username}</RevealText>
      <Text muted>
        {formatDateTime(data.startedAt)} · índice de confiança {data.trust ?? '—'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
        <Stat label="Distância" value={formatKm(data.meters).replace(' km', '')} unit="km" />
        <Stat label="Ritmo médio" value={formatPace(data.avgPace).replace(' /km', '')} unit="/km" />
        <Stat label="Pontos" value={String(data.points.length)} />
      </View>
    </Surface>
  );

  const alerts = (
    <View style={{ gap: space[3] }}>
      <SectionTitle title="Alertas de fraude" />
      <Surface>
        {data.reviewReason ? (
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <Icon name="shield" size={18} color={colors.danger} />
            <Text style={{ flex: 1 }} testID="moderacao-motivo">
              {REVIEW_REASON_TEXT[data.reviewReason] ?? data.reviewReason}
            </Text>
          </View>
        ) : null}
        {data.flags.map((f) => (
          <View key={f} style={{ flexDirection: 'row', gap: space[3] }}>
            <Icon name="warning" size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{FLAG_TITLE[f] ?? f}</Text>
              <Text variant="small" muted>
                {flagExplanation(f)}
              </Text>
            </View>
          </View>
        ))}
        {data.invalidSegments.length > 0 ? (
          <Text variant="small" muted>
            {data.invalidSegments.length === 1 ? '1 trecho inválido' : `${data.invalidSegments.length} trechos inválidos`}:{' '}
            {data.invalidSegments.map((s) => `pontos ${s.fromSeq}–${s.toSeq}`).join(', ')}.
          </Text>
        ) : null}
        {!data.reviewReason && data.flags.length === 0 ? <Text muted>Nenhum alerta registrado.</Text> : null}
      </Surface>
    </View>
  );

  const charts = series ? (
    <Surface>
      <LineChart
        testID="moderacao-grafico-velocidade"
        data={series.speed}
        label="Velocidade"
        unit="km/h"
        color={palette.orange}
        threshold={SUSTAINED_KMH}
        thresholdLabel={`${SUSTAINED_KMH} km/h, velocidade de veículo se mantida por 30 s`}
      />
      {series.cadence.length > 1 ? (
        <LineChart testID="moderacao-grafico-passos" data={series.cadence} label="Passos por minuto" unit="ppm" color={colors.text} />
      ) : (
        <Text variant="small" muted testID="moderacao-sem-passos">
          O aparelho não informou passos nesta corrida.
        </Text>
      )}
    </Surface>
  ) : null;

  const decision = (
    <View style={{ gap: space[3] }}>
      <SectionTitle title="Decisão" />
      {done ? (
        <InfoNotice
          testID="moderacao-decisao-ok"
          title={done.decision === 'approve' ? 'Corrida aprovada' : 'Corrida rejeitada'}
          body={
            done.decision === 'approve'
              ? `Status ${done.status === 'partial' ? 'parcial' : 'válida'}${typeof done.rp === 'number' ? `, ${done.rp} RP aplicados` : ''}. O corredor foi avisado.`
              : 'A corrida não pontua. O corredor foi avisado.'
          }
        />
      ) : null}
      {inReview ? (
        <View style={{ gap: space[3] }}>
          <TextField
            testID="moderacao-justificativa"
            label="Justificativa (obrigatória)"
            value={justification}
            onChangeText={(t) => {
              setJustification(t);
              if (justError) setJustError(null);
            }}
            multiline
            maxLength={JUSTIFICATION_MAX}
            error={justError}
            help="De 10 a 1000 caracteres. O corredor recebe a decisão; a justificativa fica no histórico da moderação."
          />
          <ErrorNotice message={submitError} testID="moderacao-erro" />
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[3] }}>
            <View style={{ flex: wide ? 1 : undefined }}>
              <Button testID="moderacao-aprovar" label={busy === 'approve' ? 'Aprovando…' : 'Aprovar e pontuar'} icon="check" wide disabled={busy !== null} onPress={() => decide('approve')} />
            </View>
            <View style={{ flex: wide ? 1 : undefined }}>
              <Button testID="moderacao-rejeitar" label={busy === 'reject' ? 'Rejeitando…' : 'Rejeitar'} kind="danger" icon="close" wide disabled={busy !== null} onPress={() => decide('reject')} />
            </View>
          </View>
        </View>
      ) : !done ? (
        <Text muted>Esta corrida já foi decidida (status: {data.status}).</Text>
      ) : null}
      {data.reviews.length > 0 ? (
        <Surface>
          <Text variant="caption" muted>
            Histórico
          </Text>
          {data.reviews.map((r, i) => (
            <View key={`${r.createdAt}-${i}`} style={{ gap: 2, padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>
              <Text variant="bodyBold">
                {r.decision === 'approve' ? 'Aprovada' : 'Rejeitada'} · {formatDateTime(r.createdAt)}
              </Text>
              <Text variant="small" muted>
                {r.justification}
              </Text>
            </View>
          ))}
        </Surface>
      ) : null}
      {done ? <Button testID="moderacao-voltar" label="Voltar para a fila" kind="secondary" onPress={() => router.back()} /> : null}
    </View>
  );

  return (
    <ScrollView
      testID="tela-moderacao-detalhe"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12], width: '100%', maxWidth: 1200, alignSelf: 'center' }}>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }}>
          <Stagger style={{ flex: 3 }} gap={space[6]}>
            {mapBlock}
            {charts}
          </Stagger>
          <Stagger style={{ flex: 2 }} gap={space[6]} delay={80}>
            {facts}
            {alerts}
            {decision}
          </Stagger>
        </View>
      ) : (
        <Stagger gap={space[6]}>
          {facts}
          {mapBlock}
          {charts}
          {alerts}
          {decision}
        </Stagger>
      )}
    </ScrollView>
  );
}
