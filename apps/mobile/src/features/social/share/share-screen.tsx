/**
 * T7.2.5 — tela `/compartilhar/[id]` (F1 §5): carrossel de modelos (o mais raro primeiro), formato Stories,
 * Feed ou Adesivo, chaves "Mostrar rota", "Mostrar meu @" e "Mostrar cidade", aviso de privacidade e o
 * botão que abre o menu do sistema. 3 toques do resumo até o Instagram: "Compartilhar" no resumo →
 * "Compartilhar" aqui → destino no menu.
 *
 * Privacidade: a rota passa pelo corte do domain com as zonas da pessoa (semente nova a cada abertura). Sem
 * as zonas, a rota não sai. A imagem é gerada de uma cópia escondida em tamanho exato (1080 px).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, ScrollView, Switch, useWindowDimensions, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type Svg from 'react-native-svg';

import { Button } from '@/components/button';
import { ChipRow } from '@/components/chip-row';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { haptic, PressableScale, ShimmerSkeleton } from '@/components/motion';
import { layout, ScreenScroll } from '@/components/screen';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import type { PrivacyCircle } from '@/domain/share-privacy';
import { trackTelemetry } from '@/features/engagement';
import { useRunRecord } from '@/features/run/use-run-record';
import { listMyActivities, type ActivitySummary } from '@/services/api/activities-repo';
import { isDemoMode } from '@/services/api/env';
import { listPrivacyZones } from '@/services/api/privacy-zones-repo';
import { recordShare } from '@/services/api/share-repo';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { buildCarousel, buildRunCard, CARD_FORMATS, CARD_KIND_LABEL, cardArtFor, DEFAULT_CARD_CHOICES, pickCardModels, ShareCard, ShareSticker, STICKER_SIZE, type CardChoices, type CardModel } from '../card';
import { copyText } from '../clipboard';
import { demoMoments, getShareExtras } from './share-extras';
import { doneMessage, primaryLabel, SHARE_FAILURE_TEXT, SHARE_FORMAT_KEY, SHARE_FORMAT_LABEL, SHARE_FORMATS, SHARE_TEXT, shareSize, type ShareFormat } from './share-flow';
import { buildShareRunInput, randomSeed, shareCaption } from './share-input';
import { useShareCard } from './use-share-card';

type Page = { key: string; label: string; model: CardModel };

/** Fundo xadrez discreto atrás do adesivo (mostra que ele é transparente). */
function StickerBackdrop({ size, children }: { size: number; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

export function ShareScreen() {
  const { colors } = useTheme();
  const { id: rawId, momentos } = useLocalSearchParams<{ id: string; momentos?: string }>();
  const id = rawId ? decodeURIComponent(rawId) : undefined;
  const record = useRunRecord(id);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const xp = useGame((s) => s.xp);
  const serverRuns = useGame((s) => s.serverRuns);
  const profile = useSession((s) => s.profile);
  const demo = isDemoMode();
  const { width: winW, height: winH } = useWindowDimensions();

  // Zonas de privacidade: undefined = carregando; null = não deu (a rota não sai).
  const [zones, setZones] = useState<PrivacyCircle[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void listPrivacyZones().then((r) => alive && setZones(r.ok ? r.data.map((z) => ({ lat: z.lat, lng: z.lng, radiusM: z.radiusM })) : null));
    return () => {
      alive = false;
    };
  }, []);

  // Semente nova a cada abertura da tela (o corte muda de um compartilhamento para outro).
  const [{ seed, openedAt }] = useState(() => ({ seed: randomSeed(), openedAt: Date.now() }));
  const [choices, setChoices] = useState<CardChoices>(DEFAULT_CARD_CHOICES);
  const [format, setFormat] = useState<ShareFormat>('stories');
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const share = useShareCard({
    onShared: () => {
      haptic('success');
      // Telemetria opt-in da E7 (D-82): só conta se a pessoa ligou; o evento não leva nada além do nome.
      trackTelemetry('share');
      if (id && record.state === 'official') void recordShare(id);
    },
  });

  // Só no modo demonstração com `?momentos=1`: o histórico da conta de demonstração soma os totais do card de nível.
  const demoMomentsOn = demo && momentos === '1';
  const [demoRuns, setDemoRuns] = useState<ActivitySummary[] | null>(null);
  useEffect(() => {
    if (!demoMomentsOn) return;
    let alive = true;
    void listMyActivities().then((r) => alive && r.ok && setDemoRuns(r.data));
    return () => {
      alive = false;
    };
  }, [demoMomentsOn]);

  const summary = record.summary;
  const extras = useMemo(() => {
    if (!id || !summary) return {};
    if (demoMomentsOn) {
      const runs = (demoRuns ?? serverRuns).filter((r) => r.status === 'valid' || r.status === 'partial');
      const meters = runs.reduce((n, r) => n + r.meters, 0) || summary.meters;
      const zonesWon = runs.reduce((n, r) => n + (r.result?.zones?.filter((z) => z.outcome === 'conquered').length ?? 0), 0);
      return demoMoments({ xp, meters: summary.meters, totals: { meters, zones: zonesWon, runs: Math.max(1, runs.length) } });
    }
    return getShareExtras(id);
  }, [id, summary, demoMomentsOn, demoRuns, serverRuns, xp]);

  const username = profile?.username ? `@${profile.username}` : null;
  const city = profile?.city ?? null;
  const official = record.state === 'official';
  const path = record.path;
  const at = record.endedAt ?? openedAt;
  const built = useMemo(() => {
    if (!summary || zones === undefined) return null;
    return buildShareRunInput({ summary, official, path, at, faction, username, city, privacyZones: zones, seed, isDemo: demo, level: extras.level, boss: extras.boss });
  }, [summary, zones, official, path, at, faction, username, city, seed, demo, extras]);

  const pick = built ? pickCardModels(built.input) : null;
  const locked = !!pick?.startWithoutRoute;
  const effective = useMemo(() => (locked ? { ...choices, withRoute: false } : choices), [locked, choices]);
  const pages: Page[] = useMemo(() => {
    if (!built) return [];
    if (format === 'sticker') return [{ key: 'sticker', label: 'Adesivo', model: buildRunCard(built.input, effective) }];
    return buildCarousel(built.input, effective).map((m) => ({ key: m.kind, label: CARD_KIND_LABEL[m.kind], model: m }));
  }, [built, format, effective]);
  const current = pages[Math.min(index, Math.max(0, pages.length - 1))];
  const art = useMemo(() => cardArtFor(faction, built?.input.boss?.name), [faction, built?.input.boss?.name]);
  const caption = built ? shareCaption(built.input, { showCity: effective.showCity }) : '';
  const notice = built ? (built.notice ?? pick?.privacyNotice ?? null) : null;

  // Prévia: cabe na largura e em ~52% da altura da janela.
  const [pageW, setPageW] = useState(winW - layout.gutter * 2);
  const size = shareSize(format);
  const previewW = Math.min(pageW - space[6], (winH * 0.52 * size.width) / size.height, 420);
  const scroller = useRef<ScrollView>(null);
  const exportRef = useRef<Svg>(null);

  // Trocar formato ou chave volta ao estado inicial (o "Pronto" e o erro valem para a imagem anterior).
  const changeFormat = (f: ShareFormat) => {
    setFormat(f);
    setIndex(0);
    scroller.current?.scrollTo({ x: 0, animated: false });
    share.reset();
    setCopied(false);
  };
  const changeChoice = (key: keyof CardChoices, value: boolean) => {
    setChoices((c) => ({ ...c, [key]: value }));
    share.reset();
    setCopied(false);
  };

  const onLayout = (e: LayoutChangeEvent) => setPageW(e.nativeEvent.layout.width);
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW));
    if (i !== index) setIndex(Math.max(0, Math.min(pages.length - 1, i)));
  };
  const goTo = (i: number) => {
    setIndex(i);
    scroller.current?.scrollTo({ x: i * pageW, animated: true });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Text variant="headline" style={{ flex: 1 }} accessibilityRole="header">
        Compartilhar
      </Text>
      <PressableScale testID="compartilhar-fechar" accessibilityLabel="Fechar" onPress={close} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" color={colors.text} />
      </PressableScale>
    </View>
  );

  if (record.state === 'loading' || (summary && zones === undefined)) {
    return (
      <ScreenScroll testID="tela-compartilhar">
        {header}
        <View style={{ alignItems: 'center' }}>
          <ShimmerSkeleton shape="card" width={Math.min(winW - 64, 260)} height={Math.min(winW - 64, 260) * (16 / 9)} accessibilityLabel="Montando os modelos" testID="compartilhar-carregando" />
        </View>
      </ScreenScroll>
    );
  }

  if (!summary || !built || pages.length === 0) {
    const rejected = summary?.status === 'rejected' && record.state === 'official';
    return (
      <ScreenScroll testID="tela-compartilhar">
        {header}
        <EmptyState
          testID="compartilhar-vazio"
          title={rejected ? 'Corrida rejeitada não tem card' : 'Corrida não encontrada'}
          body={rejected ? 'Só corridas válidas viram imagem para compartilhar.' : 'Suas corridas salvas ficam em Atividades.'}
          action={<Button testID="compartilhar-voltar" label="Voltar" kind="secondary" onPress={close} />}
        />
      </ScreenScroll>
    );
  }

  const generating = share.state.kind === 'generating';
  const done = doneMessage(share.state);
  const primary = primaryLabel(share.state, share.canShareFiles);
  const exportW = size.width / PixelRatio.get();

  const footer = (
    <View style={{ gap: space[2] }}>
      <Button
        testID={share.canShareFiles ? 'compartilhar-enviar' : 'compartilhar-baixar'}
        label={primary}
        icon={share.canShareFiles ? 'share' : undefined}
        size="lg"
        wide
        busy={generating}
        disabled={generating}
        onPress={() => void share.shareImage(exportRef.current, format)}
      />
      <Button
        testID="compartilhar-legenda"
        label={copied ? SHARE_TEXT.copied : SHARE_TEXT.copyCaption}
        icon={copied ? 'check' : undefined}
        kind="secondary"
        wide
        onPress={() => void copyText(caption).then(setCopied)}
      />
    </View>
  );

  return (
    <ScreenScroll testID="tela-compartilhar" footer={footer}>
      {header}

      {/* Carrossel: 1 modelo por página, o mais raro primeiro. */}
      <View onLayout={onLayout}>
        <ScrollView
          ref={scroller}
          testID="compartilhar-carrossel"
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={32}>
          {pages.map((p, i) => (
            <View key={`${format}-${p.key}`} style={{ width: pageW, alignItems: 'center' }} accessible accessibilityRole="image" accessibilityLabel={`${p.label}, ${i + 1} de ${pages.length}. ${p.model.a11yLabel}`}>
              {format === 'sticker' && p.model.kind === 'run' ? (
                <StickerBackdrop size={previewW}>
                  <ShareSticker model={p.model} width={previewW - space[4]} testID={`compartilhar-previa-${i}`} />
                </StickerBackdrop>
              ) : (
                <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
                  <ShareCard model={p.model} format={format === 'feed' ? 'feed' : 'stories'} width={previewW} art={art} testID={`compartilhar-previa-${i}`} />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {pages.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space[2] }}>
          {pages.map((p, i) => (
            <PressableScale
              key={p.key}
              testID={`compartilhar-modelo-${i}`}
              accessibilityLabel={`Modelo ${p.label}, ${i + 1} de ${pages.length}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => goTo(i)}
              hitSlop={4}
              style={{
                minHeight: 36,
                paddingHorizontal: space[3],
                borderRadius: radius.pill,
                justifyContent: 'center',
                backgroundColor: i === index ? colors.action : colors.surfaceSunken,
              }}>
              <Text variant="caption" color={i === index ? colors.onAction : colors.text}>
                {p.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <ChipRow
        testID="compartilhar-formato"
        accessibilityLabel="Formato"
        chipLabel={(l) => `Formato ${l}`}
        // Chaves em português: a ChipRow monta `compartilhar-formato-{stories|feed|adesivo}` (F1 §5.2).
        options={SHARE_FORMATS.map((f) => [SHARE_FORMAT_KEY[f], SHARE_FORMAT_LABEL[f]] as const)}
        value={SHARE_FORMAT_KEY[format]}
        onChange={(k) => changeFormat(SHARE_FORMATS.find((f) => SHARE_FORMAT_KEY[f] === k) ?? 'stories')}
      />

      <Surface>
        {(
          [
            { key: 'withRoute', title: 'Mostrar rota', testID: 'compartilhar-rota', a11y: 'Mostrar rota no card', locked },
            { key: 'showUsername', title: 'Mostrar meu @', testID: 'compartilhar-usuario', a11y: 'Mostrar meu nome de usuário', locked: !profile?.username },
            { key: 'showCity', title: 'Mostrar cidade', testID: 'compartilhar-cidade', a11y: 'Mostrar a cidade', locked: !profile?.city },
          ] as const
        ).map((row) => (
          <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 }}>
            <Text variant="bodyBold" style={{ flex: 1 }}>
              {row.title}
            </Text>
            <Switch
              testID={row.testID}
              accessibilityLabel={row.a11y}
              value={effective[row.key] && !row.locked}
              disabled={row.locked}
              onValueChange={(v) => changeChoice(row.key, v)}
              trackColor={{ true: colors.action, false: colors.lineControl }}
            />
          </View>
        ))}
        {notice ? (
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center', paddingTop: space[2] }} testID="compartilhar-aviso">
            <Icon name="shield" size={18} color={colors.textSecondary} />
            <Text variant="small" muted style={{ flex: 1 }}>
              {notice}
            </Text>
          </View>
        ) : null}
      </Surface>

      {share.state.kind === 'error' ? (
        <Surface>
          <View testID="compartilhar-erro" accessibilityLiveRegion="polite" style={{ gap: space[2] }}>
            <Text variant="bodyBold">{SHARE_TEXT.errorTitle}</Text>
            <Text variant="small" muted>
              {SHARE_FAILURE_TEXT[share.state.reason]}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              <Button testID="compartilhar-tentar" label={SHARE_TEXT.retry} kind="secondary" onPress={() => void share.shareImage(exportRef.current, format)} />
              <Button testID="compartilhar-texto" label={SHARE_TEXT.textOnly} kind="ghost" onPress={() => void share.shareText(caption)} />
            </View>
          </View>
        </Surface>
      ) : null}

      {done ? (
        <View testID="compartilhar-pronto" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
          <Icon name="check" size={18} color={colors.action} />
          <Text variant="bodyBold">{done}</Text>
        </View>
      ) : null}

      {/* Cópia de exportação: fora da tela e do leitor de tela, em pixels exatos (1080 de largura). */}
      {current ? (
        <View
          pointerEvents="none"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: -20000, top: 0, width: exportW, opacity: 1 }}>
          {format === 'sticker' && current.model.kind === 'run' ? (
            <ShareSticker model={current.model} width={STICKER_SIZE / PixelRatio.get()} svgRef={exportRef} testID="compartilhar-exportar" />
          ) : (
            <ShareCard model={current.model} format={format === 'feed' ? 'feed' : 'stories'} width={CARD_FORMATS[format === 'feed' ? 'feed' : 'stories'].W / PixelRatio.get()} art={art} svgRef={exportRef} testID="compartilhar-exportar" />
          )}
        </View>
      ) : null}
    </ScreenScroll>
  );
}
