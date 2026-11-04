import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { usePausedWhenHidden } from '@/components/motion/use-paused-when-hidden';
import { Text } from '@/components/text';
import { TEAM_BIO } from '@/domain/team-bio';
import type { FactionId } from '@/domain/types';
import { fonts } from '@/theme/tokens';

import { ART } from '../neon/palette';
import { COVER_BOX, COVER_GLOW, COVER_IDLE, COVER_TAP, COVER_TEXT, coverLabel, coverScene, runnerPlacement, STRIPE_STEP, type CoverVariant } from './cover-art';
import { MascotRunner } from './mascot-runner';

export type TeamCoverProps = {
  team: FactionId;
  /** Largura em pontos (a altura segue o viewBox: 220 ou 260 para 390). Padrão 390. */
  width?: number;
  /** `card` (escolha do time: nome, lema e 1ª linha da bio) ou `hero` ("Meu time": com a bio de 3 linhas). */
  variant?: CoverVariant;
  /** Idle (§3.3): trote do corredor, faixas da pista deslizando, janelas piscando e o brilho respirando. */
  animated?: boolean;
  /** Só o card em foco anima (no carrossel, os outros ficam no quadro 0). Padrão `true`. */
  focused?: boolean;
  /** Informativa (lida como imagem com `coverLabel`) ou, sem rótulo, decorativa (o card que a usa tem o rótulo). */
  accessibilityLabel?: string;
  /** Esconde o texto (quando a tela escreve nome e lema por fora). */
  textless?: boolean;
  /**
   * Contador de toques (F8 · C1): a cada aumento, o lema pisca na cor do time (opacidade 0,6 → 1) e o corredor dá
   * um pulo (−6 pt, 180 ms). Com "Reduzir movimento", só o lema, num fade de 150 ms. `0`/ausente: nada.
   */
  tap?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const NO_TOUCH: ViewStyle = { pointerEvents: 'none' };

/**
 * "Capa" do time (D-93, `F8/02` §3.1): brilho do time, skyline neon mínima, pista com faixas laranja, o
 * `MascotRunner` corpo inteiro e, por `Text`, o nome, o lema de 3 palavras e a bio. Custo com `animated`: 1
 * `MascotRunner` animado (2 `Svg`) + 3 valores compartilhados (faixas, janelas, brilho). Com "Reduzir movimento",
 * tudo parado e o brilho a 100 %.
 */
export function TeamCover({ team, width = 390, variant = 'card', animated = false, focused = true, accessibilityLabel, textless, tap = 0, testID, style }: TeamCoverProps) {
  // "Reduzir movimento" do sistema, ou o forçado pela galeria `/dev/motion` (F8 · C1)
  const reduced = useReducedMotionSetting();
  const paused = usePausedWhenHidden();
  const live = animated && focused && !reduced && !paused;
  const scene = useMemo(() => coverScene(team, variant), [team, variant]);
  const { vbW, vbH } = COVER_BOX[variant];
  const k = width / vbW;
  const height = vbH * k;
  const c = ART.team[team];
  const bio = TEAM_BIO[team];
  const uid = `${team}-${variant}`;

  const stripes = useSharedValue(0);
  const blink = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (!live) return;
    stripes.set(withRepeat(withTiming(1, { duration: COVER_IDLE.stripesMs, easing: Easing.linear }), -1, false));
    blink.set(withRepeat(withSequence(withDelay(COVER_IDLE.blinkMs, withTiming(1, { duration: 220 })), withTiming(0, { duration: 420 })), -1, false));
    breathe.set(withRepeat(withSequence(withTiming(1, { duration: COVER_IDLE.breatheMs, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: COVER_IDLE.breatheMs, easing: Easing.inOut(Easing.sin) })), -1, false));
    return () => {
      cancelAnimation(stripes);
      cancelAnimation(blink);
      cancelAnimation(breathe);
      stripes.set(0);
      blink.set(0);
      breathe.set(0);
    };
  }, [live, stripes, blink, breathe]);

  const stripesStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -STRIPE_STEP * k * stripes.get() }] }));
  const blinkStyle = useAnimatedStyle(() => ({ opacity: COVER_IDLE.blinkOpacity[0] + (COVER_IDLE.blinkOpacity[1] - COVER_IDLE.blinkOpacity[0]) * blink.get() }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (COVER_IDLE.breatheScale - 1) * breathe.get() }] }));

  const runner = runnerPlacement(scene);
  // Toque (F8 · C1): flash do lema (só o texto remonta) e pulo do corredor por valor compartilhado, sem remontar o
  // `MascotRunner` (remontar os 2 `Svg` custava um quadro longo a 4× de CPU).
  const tapped = tap > 0;
  const mottoFlash = useMemo(() => coverTapMotto(reduced), [reduced]);
  const hop = useSharedValue(0);
  useEffect(() => {
    if (tap <= 0 || reduced) return;
    const half = COVER_TAP.jumpMs / 2;
    const ease = Easing.inOut(Easing.sin);
    hop.set(withSequence(withTiming(1, { duration: half, easing: ease }), withTiming(0, { duration: half, easing: ease })));
  }, [tap, reduced, hop]);
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -COVER_TAP.jump * k * hop.get() }] }));
  const t = Math.min(1, Math.max(0.8, k));
  const nameSize = Math.round(COVER_TEXT.nameSize[variant] * t);
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  return (
    <View {...a11y} testID={testID} style={[{ width, height, backgroundColor: ART.bg, overflow: 'hidden' }, NO_TOUCH, style]}>
      {/* brilho do time (respira) */}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${COVER_GLOW.cx * 100}% ${COVER_GLOW.cy * 100}%` }, breatheStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`}>
          <Defs>
            <RadialGradient id={`g-${uid}`} cx={COVER_GLOW.cx} cy={COVER_GLOW.cy} r={COVER_GLOW.r}>
              {COVER_GLOW.stops.map(([o, op]) => (
                <Stop key={o} offset={o} stopColor={c} stopOpacity={op} />
              ))}
            </RadialGradient>
          </Defs>
          <Rect width={vbW} height={vbH} fill={`url(#g-${uid})`} />
        </Svg>
      </Animated.View>

      {/* cidade, pista e degradês (estáticos) */}
      <Svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`fade-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={ART.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={ART.bg} stopOpacity={COVER_TEXT.fadeOpacity} />
          </LinearGradient>
          <LinearGradient id={`fadeb-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ART.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={ART.bg} stopOpacity={COVER_TEXT.bottomFadeOpacity} />
          </LinearGradient>
        </Defs>
        {scene.stars.map((s, i) => (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={c} opacity={s.opacity} />
        ))}
        {scene.buildings.map((b, i) => (
          <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={ART.bg} stroke={c} strokeOpacity={0.45} strokeWidth={1.6} />
        ))}
        {scene.windows.map((w, i) => (
          <Rect key={i} x={w.x} y={w.y} width={3} height={4} fill={c} opacity={0.55} />
        ))}
        {scene.roadLines.map((l, i) => (
          <Line key={i} x1={0} y1={l.y} x2={vbW} y2={l.y} stroke={c} strokeOpacity={l.opacity} strokeWidth={l.w} />
        ))}
        <Rect x={scene.fade.x} y={0} width={scene.fade.w} height={scene.fade.h} fill={`url(#fade-${uid})`} />
        {scene.bottomFade ? <Rect x={0} y={scene.bottomFade.y} width={vbW} height={scene.bottomFade.h} fill={`url(#fadeb-${uid})`} /> : null}
      </Svg>

      {/* janelas que piscam */}
      <Animated.View style={[StyleSheet.absoluteFill, blinkStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`}>
          {scene.blinking.map((w, i) => (
            <Rect key={i} x={w.x} y={w.y} width={3} height={4} fill={c} />
          ))}
        </Svg>
      </Animated.View>

      {/* faixas laranja da pista (deslizam para a esquerda) */}
      <Animated.View style={[StyleSheet.absoluteFill, stripesStyle]}>
        <Svg width={width + STRIPE_STEP * k} height={height} viewBox={`0 0 ${vbW + STRIPE_STEP} ${vbH}`}>
          <Defs>
            <LinearGradient id={`road-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={ART.orange} stopOpacity="0" />
              <Stop offset="0.5" stopColor={ART.orange} stopOpacity="0.9" />
              <Stop offset="1" stopColor={ART.orange} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {scene.stripes.map((s, i) => (
            <Line key={i} x1={s.x1} y1={s.y} x2={s.x2} y2={s.y} stroke={`url(#road-${uid})`} strokeWidth={2.5} strokeLinecap="round" />
          ))}
        </Svg>
      </Animated.View>

      {/* o corredor (arte da E4; `leve` no card, `completo` na capa de "Meu time") */}
      <Animated.View testID={testID ? `${testID}-corredor` : undefined} style={[{ position: 'absolute', left: runner.left * k, top: runner.top * k }, hopStyle]}>
        <MascotRunner team={team} size={runner.width * k} quality={variant === 'hero' ? 'completo' : 'leve'} animated={live} />
      </Animated.View>

      {!textless ? (
        <View style={{ position: 'absolute', right: COVER_TEXT.inset.right * k, top: COVER_TEXT.inset.top * k, maxWidth: variant === 'hero' ? COVER_TEXT.columnWidth * k : undefined, alignItems: 'flex-end' }}>
          {variant === 'hero' ? (
            <Text variant="label" color={ART.ink2} style={{ letterSpacing: 2, textTransform: 'uppercase' }}>
              Seu time
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: nameSize,
              lineHeight: nameSize * 1.15,
              letterSpacing: 1,
              color: ART.ink,
              textAlign: 'right',
              textShadowColor: `${c}99`,
              textShadowRadius: 14,
              textShadowOffset: { width: 0, height: 0 },
            }}>
            {bio.name.toUpperCase()}
          </Text>
          <Animated.View key={`lema-${tap}`} testID={testID && tapped ? `${testID}-lema-flash` : undefined} style={tapped ? mottoFlash : null}>
            <Text style={{ fontFamily: fonts.textBold, fontSize: COVER_TEXT.mottoSize, lineHeight: 15, letterSpacing: COVER_TEXT.mottoTracking, color: c, textAlign: 'right', marginTop: 4 }}>
              {bio.motto.toUpperCase()}
            </Text>
          </Animated.View>
          {variant === 'hero' ? (
            <Text style={{ fontFamily: fonts.text, fontSize: COVER_TEXT.bioSize, lineHeight: COVER_TEXT.bioLineHeight, color: ART.ink, opacity: COVER_TEXT.bioOpacity, textAlign: 'right', marginTop: 12 }}>
              {bio.bio.join('\n')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {!textless && variant === 'card' ? (
        // F8 onda D: em 1 linha, a 1ª frase da bio saía cortada nas 3 larguras ("A onça que corre no comp…").
        <Text
          numberOfLines={2}
          style={{ position: 'absolute', right: COVER_TEXT.inset.right * k, bottom: COVER_TEXT.inset.bottom * k, left: 120 * k, fontFamily: fonts.text, fontSize: COVER_TEXT.bioSize, lineHeight: COVER_TEXT.bioLineHeight, color: ART.ink, opacity: COVER_TEXT.bioOpacity, textAlign: 'right' }}>
          {bio.mascot} · {bio.bio[0]}
        </Text>
      ) : null}
    </View>
  );
}

/** Flash do lema no toque: opacidade 0,6 → 1 (360 ms); reduzido, fade de 150 ms. Só opacidade. */
export function coverTapMotto(reduced: boolean) {
  return {
    animationName: { from: { opacity: COVER_TAP.mottoFrom }, to: { opacity: 1 } },
    animationDuration: reduced ? COVER_TAP.reducedMs : COVER_TAP.mottoMs,
    animationTimingFunction: 'ease-out' as const,
    animationFillMode: 'both' as const,
  };
}

export { coverLabel };
