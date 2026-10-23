import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BossDefeated,
  BossHit,
  CelebrationSequence,
  ChestOpening,
  LevelUp,
  PRStamp,
  RankShift,
  renderCelebrationMoment,
  RewardToast,
  StreakFlame,
  TeamConfirm,
  ZoneCaptured,
  type CelebrationEvent,
  type ChestRarity,
} from '@/components/celebration';
import { Burst } from '@/components/motion/burst';
import { Confetti } from '@/components/motion/confetti';
import { CountUp } from '@/components/motion/count-up';
import { Flash } from '@/components/motion/flash';
import { FloatingNumber } from '@/components/motion/floating-number';
import { haptic } from '@/components/motion/haptics';
import { PressableScale } from '@/components/motion/pressable';
import { ProgressBar } from '@/components/motion/progress-bar';
import { ProgressRing } from '@/components/motion/progress-ring';
import { ReducedMotionOverride } from '@/components/motion/reduced-motion';
import { Shake } from '@/components/motion/shake';
import { ShimmerSkeleton } from '@/components/motion/shimmer-skeleton';
import { SpinRays } from '@/components/motion/spin-rays';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { HAPTIC_PATTERNS, type HapticPattern } from '@/theme/motion';
import { neon, neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Galeria de motion (T7.1.15): cada momento e cada primitiva disparável por botão, com "Reduzir movimento"
 * forçado, troca de time e de raridade. Só em desenvolvimento (`__DEV__`) ou na web. Dados de demonstração.
 */
export default function DevMotionRoute() {
  if (!__DEV__ && process.env.EXPO_OS !== 'web') return <Unavailable />;
  return <MotionGallery />;
}

function Unavailable() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: space[6] }}>
      <Text variant="body" muted style={{ textAlign: 'center' }}>
        Esta galeria existe só na versão de desenvolvimento.
      </Text>
    </View>
  );
}

type MomentKey =
  | 'toast-pequeno'
  | 'toast-medio'
  | 'toast-epico'
  | 'zona-corrida'
  | 'zona-resumo'
  | 'bau'
  | 'chefao-golpe'
  | 'chefao-derrota'
  | 'nivel'
  | 'sequencia'
  | 'congelamento'
  | 'liga'
  | 'recorde'
  | 'time'
  | 'time-troca'
  | 'resumo'
  | 'resumo-leitor';

const MOMENTS: { key: MomentKey; label: string }[] = [
  { key: 'toast-pequeno', label: 'Toast pequeno' },
  { key: 'toast-medio', label: 'Toast médio' },
  { key: 'toast-epico', label: 'Toast épico' },
  { key: 'zona-corrida', label: 'Zona (corrida)' },
  { key: 'zona-resumo', label: 'Zona (resumo)' },
  { key: 'bau', label: 'Baú' },
  { key: 'chefao-golpe', label: 'Golpe no chefão' },
  { key: 'chefao-derrota', label: 'Chefão derrotado' },
  { key: 'nivel', label: 'Nível novo' },
  { key: 'sequencia', label: 'Sequência' },
  { key: 'congelamento', label: 'Congelamento' },
  { key: 'liga', label: 'Liga' },
  { key: 'recorde', label: 'Recorde' },
  { key: 'time', label: 'Escolha de time' },
  { key: 'time-troca', label: 'Troca de time' },
  { key: 'resumo', label: 'Resumo (fila)' },
  { key: 'resumo-leitor', label: 'Resumo (leitor de tela)' },
];

const FACTIONS: FactionId[] = ['striders', 'volt', 'owls', 'coyotes'];
const RARITIES: ChestRarity[] = ['comum', 'raro', 'lendario'];
/** Chances só de demonstração (as reais vêm do servidor, D-66). */
const DEMO_ODDS = { comum: 0.7, raro: 0.25, lendario: 0.05 };
/** Nome de cada padrão de vibração na interface. */
const HAPTIC_NAMES: Record<HapticPattern, string> = { selection: 'Seleção', tap: 'Toque', impact: 'Impacto', heavy: 'Forte', success: 'Sucesso', warning: 'Aviso', error: 'Erro', crescendo: 'Crescendo' };
/** Líderes da D-70 (nomes trocáveis); a frase é texto provisório. */
const LEADERS: Record<FactionId, string> = { striders: 'Íris Valente', volt: 'Téo Faria', owls: 'Nara Lis', coyotes: 'Bento Rocha' };

function demoEvents(faction: FactionId, rarity: ChestRarity): CelebrationEvent[] {
  return [
    { id: 'golpe', kind: 'boss-hit', level: 'small', label: 'causou 8,4 km de dano no chefão', payload: { boss: 'Chefão de demonstração', damageKm: 8.4, hpBefore: 1200, hpAfter: 1104, hpMax: 3600 } },
    { id: 'zona', kind: 'zone-captured', level: 'medium', label: 'conquistou Setor Bueno', payload: { zone: 'Setor Bueno', faction, points: 120 } },
    { id: 'bau', kind: 'chest', level: rarity === 'lendario' ? 'epic' : rarity === 'raro' ? 'medium' : 'small', label: `abriu um baú ${rarity}`, payload: { rarity, xp: 40, odds: DEMO_ODDS } },
    { id: 'nivel', kind: 'level-up', level: 'epic', label: 'chegou ao nível 7', payload: { level: 7, title: 'Desbravador' } },
  ];
}

/** Chip da galeria: o texto visível é a própria descrição para o leitor de tela. */
function Chip({ testID, accessibilityLabel, active, onPress }: { testID: string; accessibilityLabel: string; active?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: space[3],
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? neon.orange : colors.line,
        backgroundColor: active ? neon.activeFill : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="small">{accessibilityLabel}</Text>
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[3] }}>
      <Text variant="label" muted>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function MotionGallery() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [faction, setFaction] = useState<FactionId>('owls');
  const [rarity, setRarity] = useState<ChestRarity>('raro');
  const [vibration, setVibration] = useState(true);
  const [active, setActive] = useState<{ key: MomentKey; nonce: number } | null>(null);
  const [stage, setStage] = useState({ width: 360, height: 460 });
  const [bar, setBar] = useState(0.6);
  const [fx, setFx] = useState(0);
  const play = (key: MomentKey) => setActive((a) => ({ key, nonce: (a?.nonce ?? 0) + 1 }));
  const common = { hapticsEnabled: vibration, testID: 'galeria-motion-momento' };
  const team = neonTeam[faction];

  const moment = (() => {
    if (!active) return null;
    switch (active.key) {
      case 'toast-pequeno':
        return <RewardToast {...common} size="small" color={neon.orange} icon={<TeamBadge faction={faction} size={32} />} title="Missão concluída" subtitle="Correr 3 km" value="+30 XP" />;
      case 'toast-medio':
        return <RewardToast {...common} size="medium" color={team} icon={<TeamBadge faction={faction} size={32} />} title="Zona defendida" subtitle="Setor Bueno" />;
      case 'toast-epico':
        return <RewardToast {...common} size="epic" color={team} icon={<TeamBadge faction={faction} size={56} />} title="Promoção!" subtitle="Divisão Neon" />;
      case 'zona-corrida':
        return <ZoneCaptured {...common} context="run" faction={faction} zone="Setor Bueno" points={120} />;
      case 'zona-resumo':
        return <ZoneCaptured {...common} context="summary" faction={faction} zone="Setor Bueno" points={120} />;
      case 'bau':
        return <ChestOpening {...common} rarity={rarity} xp={rarity === 'lendario' ? 120 : 40} odds={DEMO_ODDS} />;
      case 'chefao-golpe':
        return <BossHit {...common} bossName="Chefão de demonstração" hpFrom={1200} hpTo={1104} hpMax={3600} damageLabel="−96 km" mineLabel="Sua parte: 8,4 km" />;
      case 'chefao-derrota':
        return <BossDefeated {...common} bossName="Chefão de demonstração" city="Goiânia" myKm={42.3} />;
      case 'nivel':
        return <LevelUp {...common} level={7} title="Desbravador" reward={{ label: 'Rastro neon' }} />;
      case 'sequencia':
        return <StreakFlame {...common} weeks={4} status="kept" />;
      case 'congelamento':
        return <StreakFlame {...common} weeks={4} status="frozen" />;
      case 'liga':
        return (
          <RankShift
            testID="galeria-motion-liga"
            hapticsEnabled={vibration}
            previousOrder={['b', 'c', 'd', 'voce']}
            rows={[
              { id: 'b', label: 'Corredor B', value: '42 km' },
              { id: 'voce', label: 'Você', value: '41 km', you: true },
              { id: 'c', label: 'Corredor C', value: '38 km' },
              { id: 'd', label: 'Corredor D', value: '30 km' },
            ]}
          />
        );
      case 'recorde':
        return <PRStamp {...common} metric="5 km em 24:10" />;
      case 'time':
      case 'time-troca':
        return (
          <TeamConfirm
            {...common}
            faction={faction}
            variant={active.key === 'time' ? 'ftue' : 'switch'}
            leader={{ name: LEADERS[faction], quote: 'Texto provisório da frase do líder.' }}
            origin={{ x: stage.width / 2, y: stage.height - 40 }}
            onContinue={() => setActive(null)}
          />
        );
      case 'resumo':
      case 'resumo-leitor':
        return (
          <CelebrationSequence
            testID="galeria-motion-resumo"
            events={demoEvents(faction, rarity)}
            intro="Corrida de demonstração concluída: 8,42 km."
            hapticsEnabled={vibration}
            layout="single"
            screenReader={active.key === 'resumo-leitor'}
            renderMoment={renderCelebrationMoment()}
          />
        );
    }
  })();

  return (
    <ReducedMotionOverride reduced={reduced}>
      <ScrollView
        testID="galeria-motion"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[12], paddingHorizontal: space[4], gap: space[6] }}>
        <View style={{ gap: 4 }}>
          <Text variant="headline">Galeria de motion</Text>
          <Text variant="small" muted>
            Dados de demonstração. Arte provisória até a E4 entregar a dela.
          </Text>
        </View>

        <Section title="Ajustes">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            <Chip testID="galeria-motion-reduzido-sistema" accessibilityLabel="Movimento: sistema" active={reduced === null} onPress={() => setReduced(null)} />
            <Chip testID="galeria-motion-reduzido-sim" accessibilityLabel="Reduzido" active={reduced === true} onPress={() => setReduced(true)} />
            <Chip testID="galeria-motion-reduzido-nao" accessibilityLabel="Completo" active={reduced === false} onPress={() => setReduced(false)} />
            <Chip testID="galeria-motion-vibracao" accessibilityLabel={vibration ? 'Vibração ligada' : 'Vibração desligada'} active={vibration} onPress={() => setVibration((v) => !v)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {FACTIONS.map((f) => (
              <Chip key={f} testID={`galeria-motion-time-${f}`} accessibilityLabel={factions[f].name} active={faction === f} onPress={() => setFaction(f)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {RARITIES.map((r) => (
              <Chip key={r} testID={`galeria-motion-raridade-${r}`} accessibilityLabel={`Baú ${r}`} active={rarity === r} onPress={() => setRarity(r)} />
            ))}
          </View>
        </Section>

        <Section title="Momentos">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {MOMENTS.map((m) => (
              <Chip key={m.key} testID={`galeria-motion-${m.key}`} accessibilityLabel={m.label} active={active?.key === m.key} onPress={() => play(m.key)} />
            ))}
          </View>
          <View
            testID="galeria-motion-palco"
            onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
            style={{ height: 460, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: neon.bgDeep, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: space[4] }}>
            {moment ? <View key={active?.nonce} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space[4] }}>{moment}</View> : (
              <Text variant="small" muted>
                Toque num momento para tocar.
              </Text>
            )}
          </View>
        </Section>

        <Section title="Primitivas">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            <Chip testID="galeria-motion-barra-sobe" accessibilityLabel="Barra +25%" onPress={() => setBar((b) => Math.min(1, b + 0.25))} />
            <Chip testID="galeria-motion-barra-desce" accessibilityLabel="Barra −30%" onPress={() => setBar((b) => Math.max(0, b - 0.3))} />
            <Chip testID="galeria-motion-efeitos" accessibilityLabel="Efeitos" onPress={() => setFx((n) => n + 1)} />
          </View>
          <ProgressBar value={bar} color={team} segments={10} milestones={[0.25, 0.5, 0.75]} accessibilityLabel={`Barra de demonstração: ${Math.round(bar * 100)}%`} testID="galeria-motion-barra" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <ProgressRing value={bar} size={96} color={factions[faction].color} segments={6} pulseAt={[0.25, 0.5, 0.75]} accessibilityLabel={`Anel de demonstração: ${Math.round(bar * 100)}%`} testID="galeria-motion-anel">
              <CountUp value={Math.round(bar * 100)} variant="title" unit="%" testID="galeria-motion-contador" />
            </ProgressRing>
            <View style={{ flex: 1, gap: space[2] }}>
              <ShimmerSkeleton shape="row" testID="galeria-motion-esqueleto" />
              <ShimmerSkeleton shape="line" lines={2} />
            </View>
          </View>
          <View style={{ height: 200, borderRadius: radius.lg, backgroundColor: neon.bgDeep, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {fx > 0 ? (
              <View key={fx} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <SpinRays color={neon.orange} size={220} />
                <Flash kind="radial" size={120} />
                <Burst color={team} count={12} />
                <Confetti count={24} colors={[team, '#FFFFFF', neon.orange]} width={320} height={200} origin={{ x: 160, y: 100 }} seed={fx} />
                <FloatingNumber text="+40 XP" color={neon.orangeText} size={32} rise={60} />
              </View>
            ) : null}
            <Shake trigger={fx} amplitude={10}>
              <TeamBadge faction={faction} size={56} />
            </Shake>
          </View>
        </Section>

        <Section title="Vibração (celular)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {HAPTIC_PATTERNS.map((p) => (
              <Chip key={p} testID={`galeria-motion-vibrar-${p}`} accessibilityLabel={`Vibrar: ${HAPTIC_NAMES[p]}`} onPress={() => haptic(p, { enabled: vibration })} />
            ))}
          </View>
        </Section>
      </ScrollView>
    </ReducedMotionOverride>
  );
}
