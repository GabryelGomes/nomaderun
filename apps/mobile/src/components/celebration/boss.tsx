import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Burst } from '@/components/motion/burst';
import { Confetti } from '@/components/motion/confetti';
import { CountUp } from '@/components/motion/count-up';
import { Flash } from '@/components/motion/flash';
import { FloatingNumber } from '@/components/motion/floating-number';
import { ProgressBar } from '@/components/motion/progress-bar';
import { Shake } from '@/components/motion/shake';
import { useReducedMotionSetting } from '@/components/motion/reduced-motion';
import { Text } from '@/components/text';
import { cssEasings, springCss, springs } from '@/theme/motion';
import { neon, neonTeam } from '@/theme/neon';

import { BOSS_DEFEATED_TIMELINE as D, BOSS_HIT_TIMELINE as H, hpPercent } from './choreography';
import { type MomentBaseProps, kf, pop, rise, step, useMoment } from './moment';

/** Violeta reservado aos vilões (D-67). */
const VILLAIN = '#B15CFF';

/** Marcador provisório do chefão (até a arte da E4 chegar na onda 2). */
function PlaceholderBoss({ white }: { white?: boolean }) {
  return (
    <View style={{ width: 120, height: 120, borderRadius: 36, backgroundColor: white ? '#FFFFFF' : '#2A1740', borderWidth: white ? 0 : 3, borderColor: VILLAIN, alignItems: 'center', justifyContent: 'center' }}>
      {white ? null : <View style={{ width: 52, height: 10, borderRadius: 5, backgroundColor: VILLAIN }} />}
    </View>
  );
}

export type BossHitProps = MomentBaseProps & {
  /** Nome do chefão (lido pelo leitor de tela). */
  bossName: string;
  /** Arte do chefão (E4, camadas). */
  boss?: ReactNode;
  /** Silhueta branca da mesma arte, para o clarão do golpe. */
  bossFlash?: ReactNode;
  hpFrom: number;
  hpTo: number;
  hpMax: number;
  /** Texto do dano: "−8,4 km". */
  damageLabel: string;
  /** Selo "Sua parte: 8,4 km". */
  mineLabel?: string;
};

/**
 * Golpe no chefão (catálogo §4.3): silhueta branca pisca, o chefão treme e achata, o dano pula e sobe, a
 * barra cai e a fantasma espera 300 ms e escoa. "Reduzir movimento": número e barra com fade.
 */
export function BossHit(props: BossHitProps) {
  const { bossName, boss, bossFlash, hpFrom, hpTo, hpMax, damageLabel, mineLabel, testID } = props;
  const pct = hpPercent(hpTo, hpMax);
  const text = `Golpe no chefão ${bossName}: ${damageLabel}. Vida ${pct}%.`;
  const reduced = useReducedMotionSetting();
  const { still } = useMoment('boss-hit', 'small', props, text, reduced);
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 14, width: 280 }}>
      <View style={{ width: 200, height: 170, alignItems: 'center', justifyContent: 'center' }}>
        <Shake trigger={still ? 0 : 1} amplitude={14} cycles={3} duration={H.shakeMs}>
          <Animated.View
            style={
              still
                ? null
                : {
                    animationName: kf({
                      '0%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
                      '30%': { transform: [{ scaleX: 1.06 }, { scaleY: 0.92 }] },
                      '65%': { transform: [{ scaleX: 0.98 }, { scaleY: 1.03 }] },
                      '100%': { transform: [{ scaleX: 1 }, { scaleY: 1 }] },
                    }),
                    animationDuration: H.squashMs,
                    animationTimingFunction: cssEasings.standard,
                    animationFillMode: 'both',
                  }
            }>
            {boss ?? <PlaceholderBoss />}
            {!still ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  animationName: kf({ '0%': { opacity: 0 }, '35%': { opacity: 0.9 }, '100%': { opacity: 0 } }),
                  animationDuration: H.flashMs,
                  animationTimingFunction: 'linear',
                  animationFillMode: 'both',
                }}>
                {bossFlash ?? <PlaceholderBoss white />}
              </Animated.View>
            ) : null}
          </Animated.View>
        </Shake>
        {!still ? <Burst color="#FFFFFF" count={8} distance={60} /> : null}
        {props.state !== 'done' ? <FloatingNumber text={damageLabel} color="#FFFFFF" size={40} rise={70} /> : null}
      </View>
      <ProgressBar
        value={hpTo / (hpMax > 0 ? hpMax : 1)}
        from={hpFrom / (hpMax > 0 ? hpMax : 1)}
        color={VILLAIN}
        segments={10}
        height={12}
        delay={H.bar}
        accessibilityLabel={`Vida do chefão ${bossName}: ${pct}%`}
        style={{ alignSelf: 'stretch' }}
      />
      {mineLabel ? (
        <Animated.View style={step(still, rise(12), 400, H.mine)}>
          <Text variant="bodyBold" color={neon.orangeText}>
            {mineLabel}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export type BossDefeatedProps = MomentBaseProps & {
  bossName: string;
  boss?: ReactNode;
  bossFlash?: ReactNode;
  /** Cidade que venceu junta ("Goiânia"). */
  city: string;
  /** Quilômetros da pessoa no Raid ("Sua parte"). */
  myKm: number;
  /** Recompensa liberada (arte do baú do Raid). */
  reward?: ReactNode;
};

/**
 * Chefão derrotado (catálogo §4.4): tremor crescente e o chefão fica branco, explode (clarão, 36 faíscas),
 * "CHEFÃO DERROTADO" carimba, confete com as 4 cores dos times (a vitória é coletiva), "Sua parte" conta e a
 * recompensa entra. "Reduzir movimento": fades em cascata.
 */
export function BossDefeated(props: BossDefeatedProps) {
  const { bossName, boss, bossFlash, city, myKm, reward, testID } = props;
  const km = myKm.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const text = `Chefão ${bossName} derrotado. ${city} venceu junta. Sua parte: ${km} quilômetros.`;
  const reduced = useReducedMotionSetting();
  const { still, at } = useMoment('boss-defeated', 'epic', props, text, reduced);
  const teams = [neonTeam.striders, neonTeam.volt, neonTeam.owls, neonTeam.coyotes];
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ alignItems: 'center', gap: 10, width: 300 }}>
      <View style={{ width: 220, height: 180, alignItems: 'center', justifyContent: 'center' }}>
        {!still ? (
          <>
            <Shake trigger={1} amplitude={12} cycles={4} delay={at(D.tremble)} duration={at(D.trembleMs)}>
              <Animated.View
                style={{
                  animationName: kf({ from: { opacity: 1, transform: [{ scale: 1 }] }, to: { opacity: 0, transform: [{ scale: 1.25 }] } }),
                  animationDuration: 260,
                  animationDelay: at(D.explode),
                  animationTimingFunction: cssEasings.enter,
                  animationFillMode: 'both',
                }}>
                {boss ?? <PlaceholderBoss />}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    animationName: kf({ from: { opacity: 0 }, to: { opacity: 1 } }),
                    animationDuration: at(D.trembleMs),
                    animationDelay: at(D.tremble),
                    animationTimingFunction: 'ease-in',
                    animationFillMode: 'both',
                  }}>
                  {bossFlash ?? <PlaceholderBoss white />}
                </Animated.View>
              </Animated.View>
            </Shake>
            <Burst color="#FFFFFF" count={36} distance={120} length={18} delay={at(D.explode)} />
          </>
        ) : null}
        <Animated.View style={[{ position: 'absolute' }, step(still, { from: { opacity: 0, transform: [{ scale: 1.8 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } }, springs.stamp.duration, at(D.stamp), springCss('stamp'))]}>
          <Text variant="headline" color={neon.orangeText} style={{ textAlign: 'center', textShadowColor: neon.orange, textShadowRadius: 18 }}>
            {'CHEFÃO\nDERROTADO'}
          </Text>
        </Animated.View>
      </View>
      {!still ? <Flash kind="screen" color="#FFFFFF" peak={0.85} duration={360} delay={at(D.explode)} /> : null}
      <Animated.View style={step(still, rise(14), 500, at(D.city))}>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {city} venceu junta
        </Text>
      </Animated.View>
      <Animated.View style={[{ alignItems: 'center' }, step(still, rise(12), 450, at(D.mine))]}>
        <Text variant="label" muted>
          SUA PARTE
        </Text>
        <CountUp value={myKm} decimals={1} unit="km" duration={still ? 0 : 600} delay={still ? 0 : at(D.mineCount)} accessibilityLabel={`${km} quilômetros`} />
      </Animated.View>
      {reward ? <Animated.View style={step(still, pop(0.6), springs.bouncy.duration, at(D.reward), springCss('bouncy'))}>{reward}</Animated.View> : null}
      {!still ? <Confetti count={60} colors={teams} mode="rain" width={320} height={520} delay={at(D.city)} seed={21} /> : null}
    </View>
  );
}
