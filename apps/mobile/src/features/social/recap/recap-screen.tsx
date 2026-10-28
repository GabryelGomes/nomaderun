/**
 * T7.3.7 — tela `/compartilhar/semana?inicio=AAAA-MM-DD` (modelo 5, "Minha semana"). Abre pela notificação do
 * recap (segunda) e pela tela Atividades (`recapHref`). Mesmo fluxo do card da corrida: prévia, Stories ou
 * Feed, chaves "Mostrar rotas", "Mostrar meu @" e "Mostrar cidade", menu do sistema e "Copiar legenda".
 *
 * Privacidade: as mini-rotas chegam cortadas pelo servidor (`weekly-recap`) ou, no recap local, são cortadas
 * aqui com as zonas da pessoa e semente nova. A semana vai sem horário.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { PixelRatio, Switch, useWindowDimensions, View } from 'react-native';
import type Svg from 'react-native-svg';

import { Button } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { DemoBadge } from '@/components/demo-badge';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { haptic, PressableScale, ShimmerSkeleton } from '@/components/motion';
import { layout, ScreenScroll } from '@/components/screen';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { trackTelemetry } from '@/features/engagement';
import { isDemoMode } from '@/services/api/env';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { buildWeekCard, CARD_FORMATS, DEFAULT_CARD_CHOICES, ShareCard, type CardChoices, type ShareCardFormat } from '../card';
import { copyText } from '../clipboard';
import { doneMessage, primaryLabel, SHARE_FAILURE_TEXT, SHARE_FORMAT_LABEL, SHARE_TEXT, shareSize } from '../share/share-flow';
import { randomSeed } from '../share/share-input';
import { useShareCard } from '../share/use-share-card';
import { buildRecapWeekInput, recapCaption } from './recap-model';
import { useWeeklyRecap } from './use-weekly-recap';

const FORMATS: readonly ShareCardFormat[] = ['stories', 'feed'];

export function RecapScreen() {
  const { colors } = useTheme();
  const { inicio } = useLocalSearchParams<{ inicio?: string }>();
  const weekStart = inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? inicio : null;
  const faction = useGame((s) => s.faction) ?? 'striders';
  const streakWeeks = useGame((s) => s.streakWeeks);
  const profile = useSession((s) => s.profile);
  const demo = isDemoMode();
  const { width: winW, height: winH } = useWindowDimensions();
  const { state, retry } = useWeeklyRecap(weekStart, { streakWeeks, isDemo: demo });

  const [seed] = useState(() => randomSeed());
  const [choices, setChoices] = useState<CardChoices>(DEFAULT_CARD_CHOICES);
  const [format, setFormat] = useState<ShareCardFormat>('stories');
  const [copied, setCopied] = useState(false);
  const exportRef = useRef<Svg>(null);
  const share = useShareCard({
    onShared: () => {
      haptic('success');
      trackTelemetry('share');
    },
  });

  const username = profile?.username ? `@${profile.username}` : null;
  const city = profile?.city ?? null;
  const built = useMemo(() => {
    if (state.status !== 'ready') return null;
    return buildRecapWeekInput({ recap: state.recap, paths: state.paths, privacyZones: state.zones, seed, faction, username, city, isDemo: demo });
  }, [state, seed, faction, username, city, demo]);
  const model = useMemo(() => (built ? buildWeekCard(built.input, choices) : null), [built, choices]);
  const caption = built && model ? recapCaption(built.input, model.km, { showCity: choices.showCity }) : '';

  const size = shareSize(format);
  const previewW = Math.min(winW - layout.gutter * 2 - space[6], (winH * 0.52 * size.width) / size.height, 420);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const reset = () => {
    share.reset();
    setCopied(false);
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Text variant="headline" style={{ flex: 1 }} accessibilityRole="header">
        Minha semana
      </Text>
      {demo ? <DemoBadge testID="semana-demonstracao" /> : null}
      <PressableScale testID="semana-fechar" accessibilityLabel="Fechar" onPress={close} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" color={colors.text} />
      </PressableScale>
    </View>
  );

  if (state.status === 'loading') {
    const w = Math.min(winW - 64, 260);
    return (
      <ScreenScroll testID="tela-semana">
        {header}
        <View style={{ alignItems: 'center' }}>
          <ShimmerSkeleton shape="card" width={w} height={w * (16 / 9)} accessibilityLabel="Montando a sua semana" testID="semana-carregando" />
        </View>
      </ScreenScroll>
    );
  }

  if (state.status === 'error' || !built || !model || state.recap.runs === 0) {
    const failed = state.status === 'error';
    return (
      <ScreenScroll testID="tela-semana">
        {header}
        <EmptyState
          testID={failed ? 'semana-erro' : 'semana-vazia'}
          title={failed ? 'Não deu para montar a semana' : 'Nenhuma corrida nesta semana'}
          body={failed ? 'Confira a conexão e tente de novo.' : 'Quando você correr, a semana vira um card para compartilhar.'}
          action={
            failed ? (
              <Button testID="semana-tentar" label="Tentar de novo" kind="secondary" onPress={retry} />
            ) : (
              <Button testID="semana-voltar" label="Voltar" kind="secondary" onPress={close} />
            )
          }
        />
      </ScreenScroll>
    );
  }

  const generating = share.state.kind === 'generating';
  const done = doneMessage(share.state);
  const hasRoutes = built.input.routes.length > 0;
  const footer = (
    <View style={{ gap: space[2] }}>
      <Button
        testID={share.canShareFiles ? 'semana-enviar' : 'semana-baixar'}
        label={primaryLabel(share.state, share.canShareFiles)}
        icon={share.canShareFiles ? 'share' : undefined}
        size="lg"
        wide
        busy={generating}
        disabled={generating}
        onPress={() => void share.shareImage(exportRef.current, format)}
      />
      <Button testID="semana-legenda" label={copied ? SHARE_TEXT.copied : SHARE_TEXT.copyCaption} icon={copied ? 'check' : undefined} kind="secondary" wide onPress={() => void copyText(caption).then(setCopied)} />
    </View>
  );

  return (
    <ScreenScroll testID="tela-semana" footer={footer}>
      {header}
      <View style={{ alignItems: 'center' }} accessible accessibilityRole="image" accessibilityLabel={model.a11yLabel}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
          <ShareCard model={model} format={format} width={previewW} testID="semana-previa" />
        </View>
      </View>
      {state.status === 'ready' && !state.recap.final ? (
        <Text variant="small" muted style={{ textAlign: 'center' }} testID="semana-parcial">
          A semana ainda não acabou: o card mostra até hoje.
        </Text>
      ) : null}

      <ChipRow
        testID="semana-formato"
        accessibilityLabel="Formato"
        chipLabel={(l) => `Formato ${l}`}
        options={FORMATS.map((f) => [f, SHARE_FORMAT_LABEL[f]] as const)}
        value={format}
        onChange={(k) => {
          setFormat(k === 'feed' ? 'feed' : 'stories');
          reset();
        }}
      />

      <Surface>
        {(
          [
            { key: 'withRoute', title: 'Mostrar rotas', testID: 'semana-rota', a11y: 'Mostrar as rotas da semana no card', locked: !hasRoutes },
            { key: 'showUsername', title: 'Mostrar meu @', testID: 'semana-usuario', a11y: 'Mostrar meu nome de usuário', locked: !profile?.username },
            { key: 'showCity', title: 'Mostrar cidade', testID: 'semana-cidade', a11y: 'Mostrar a cidade', locked: !profile?.city },
          ] as const
        ).map((row) => (
          <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
            <Text variant="bodyBold" style={{ flex: 1 }}>
              {row.title}
            </Text>
            <Switch
              testID={row.testID}
              accessibilityLabel={row.a11y}
              value={choices[row.key] && !row.locked}
              disabled={row.locked}
              onValueChange={(v) => {
                setChoices((c) => ({ ...c, [row.key]: v }));
                reset();
              }}
              trackColor={{ true: colors.action, false: colors.lineControl }}
            />
          </View>
        ))}
        {built.notice ? (
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center', paddingTop: space[2] }} testID="semana-aviso">
            <Icon name="shield" size={18} color={colors.textSecondary} />
            <Text variant="small" muted style={{ flex: 1 }}>
              {built.notice}
            </Text>
          </View>
        ) : null}
      </Surface>

      {share.state.kind === 'error' ? (
        <Surface>
          <View testID="semana-erro-envio" accessibilityLiveRegion="polite" style={{ gap: space[2] }}>
            <Text variant="bodyBold">{SHARE_TEXT.errorTitle}</Text>
            <Text variant="small" muted>
              {SHARE_FAILURE_TEXT[share.state.reason]}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              <Button testID="semana-tentar-envio" label={SHARE_TEXT.retry} kind="secondary" onPress={() => void share.shareImage(exportRef.current, format)} />
              <Button testID="semana-texto" label={SHARE_TEXT.textOnly} kind="ghost" onPress={() => void share.shareText(caption)} />
            </View>
          </View>
        </Surface>
      ) : null}

      {done ? (
        <View testID="semana-pronto" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
          <Icon name="check" size={18} color={colors.action} />
          <Text variant="bodyBold">{done}</Text>
        </View>
      ) : null}

      {/* Cópia de exportação: fora da tela e do leitor de tela, em pixels exatos (1080 de largura). */}
      <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: -20000, top: 0, width: size.width / PixelRatio.get() }}>
        <ShareCard model={model} format={format} width={CARD_FORMATS[format].W / PixelRatio.get()} svgRef={exportRef} testID="semana-exportar" />
      </View>
    </ScreenScroll>
  );
}
