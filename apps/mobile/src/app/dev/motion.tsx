import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOSS_IDS, BOSS_NAMES, LeaderBust, Mascot, MascotRunner, type BossId } from '@/components/art';
import {
  BoraReaction,
  BossDefeated,
  BossHit,
  CelebrationSequence,
  ChestOpening,
  FirstPaintSeal,
  leaderCommentDelay,
  LevelUp,
  NeighborhoodFlip,
  TeamWeekCard,
  type NeighborhoodZone,
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
import { TeamCoverCarousel } from '@/components/team-cover-carousel';
import { Text } from '@/components/text';
import { DEMO_CENTER } from '@/demo/demo-data';
import { cellCenter, zoneOf } from '@/domain/grid';
import type { FactionId, LatLng } from '@/domain/types';
import { DistrictStampMoment, LeaderComment } from '@/features/engagement/summary-moments';
import { TrailReveal, trailRevealText } from '@/features/screens/onboarding/trail-reveal';
import { useMotionPrefs } from '@/store/motion-prefs-store';
import { HAPTIC_PATTERNS, type HapticPattern } from '@/theme/motion';
import { neon, neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Galeria de motion (T7.1.15, T7.2.9, T7.3.5): cada momento e cada primitiva disparável por botão, com a arte da
 * E4 (baú com o item que sobe, clarão com a silhueta do chefão), "Reduzir movimento" forçado, troca de time,
 * de raridade e de chefão, as preferências salvas "Vibração" e "Pular celebrações" e o confete de 60 para medir
 * o custo. Só em desenvolvimento (`__DEV__`) ou na web. Dados de demonstração.
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
  | 'bora'
  | 'resumo'
  | 'resumo-leitor'
  | 'confete-60'
  | 'onboarding-arte'
  // Fase 8 · onda C (C1)
  | 'capa'
  | 'cerimonia'
  | 'primeiro-trecho'
  | 'bairro'
  | 'chefao-fase'
  | 'semana-time'
  | 'carimbo-bairro'
  | 'recorde-trechos'
  | 'lider';

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
  { key: 'bora', label: '"Bora!" no feed' },
  { key: 'resumo', label: 'Resumo (fila)' },
  { key: 'resumo-leitor', label: 'Resumo (leitor de tela)' },
  { key: 'confete-60', label: 'Confete (60, medição)' },
  { key: 'onboarding-arte', label: 'Arte do onboarding (medição)' },
];

/** Cenas da Fase 8 · onda C (C1): a capa, a cerimônia e os momentos novos, para olhar e medir. */
const MOMENTS_F8: { key: MomentKey; label: string }[] = [
  { key: 'capa', label: 'Capa do time (toque)' },
  { key: 'cerimonia', label: 'Cerimônia "Seu rastro"' },
  { key: 'primeiro-trecho', label: 'Primeiro trecho (corrida)' },
  { key: 'bairro', label: 'Antes e depois do bairro' },
  { key: 'chefao-fase', label: 'Golpe que abre fase' },
  { key: 'semana-time', label: 'A semana do time' },
  { key: 'carimbo-bairro', label: 'Carimbo de bairro novo' },
  { key: 'recorde-trechos', label: 'Recorde de trechos' },
  { key: 'lider', label: 'Líder comenta' },
];

/** Rota de demonstração: uma volta em "8" perto do centro da demo (~2 km), e as zonas que ela toca. */
const DEMO_PATH: LatLng[] = Array.from({ length: 90 }, (_, i) => {
  const t = (i / 89) * Math.PI * 2;
  return { lat: DEMO_CENTER.lat + 0.0042 * Math.sin(t), lng: DEMO_CENTER.lng + 0.0068 * Math.sin(t) * Math.cos(t) + 0.0016 * Math.cos(t) };
});
function demoFlipZones(team: FactionId): NeighborhoodZone[] {
  const ids = [...new Set(DEMO_PATH.map(zoneOf))].slice(0, 9);
  const rivals = FACTIONS.filter((f) => f !== team);
  // 4 viradas para o time (uma era neutra), 2 já eram do time e o resto continua dos rivais
  return ids.map((id, i) => {
    const before: FactionId | null = i === 2 ? null : i < 6 && i % 3 === 1 ? team : rivals[i % rivals.length];
    const after: FactionId | null = i < 6 ? team : before;
    return { id, center: cellCenter(id), before, after };
  });
}

const FACTIONS: FactionId[] = ['striders', 'volt', 'owls', 'coyotes'];
const RARITIES: ChestRarity[] = ['comum', 'raro', 'lendario'];
/** Chances só de demonstração (as reais vêm do servidor, D-66). */
const DEMO_ODDS = { comum: 0.7, raro: 0.25, lendario: 0.05 };
/** Nome de cada padrão de vibração na interface. */
const HAPTIC_NAMES: Record<HapticPattern, string> = { selection: 'Seleção', tap: 'Toque', impact: 'Impacto', heavy: 'Forte', success: 'Sucesso', warning: 'Aviso', error: 'Erro', crescendo: 'Crescendo' };
/** Líderes da D-70 (nomes trocáveis); a frase é texto provisório. */
const LEADERS: Record<FactionId, string> = { striders: 'Íris Valente', volt: 'Téo Faria', owls: 'Nara Lis', coyotes: 'Bento Rocha' };

function demoEvents(faction: FactionId, rarity: ChestRarity, boss: BossId): CelebrationEvent[] {
  return [
    { id: 'golpe', kind: 'boss-hit', level: 'small', label: 'causou 8,4 km de dano no chefão', payload: { boss: BOSS_NAMES[boss], bossId: boss, damageKm: 8.4, hpBefore: 1500, hpAfter: 1404, hpMax: 3600 } },
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
  const [boss, setBoss] = useState<BossId>('mormaco');
  // preferências salvas de verdade (as mesmas que a tela de ajustes da E6 vai mexer)
  const vibration = useMotionPrefs((s) => s.haptics);
  const setVibration = useMotionPrefs((s) => s.setHaptics);
  const skipAll = useMotionPrefs((s) => s.skipCelebrations);
  const setSkipAll = useMotionPrefs((s) => s.setSkipCelebrations);
  const [bora, setBora] = useState({ active: false, count: 4 });
  const [active, setActive] = useState<{ key: MomentKey; nonce: number } | null>(null);
  const [stage, setStage] = useState({ width: 360, height: 460 });
  const [bar, setBar] = useState(0.6);
  const [fx, setFx] = useState(0);
  const [coverConfirm, setCoverConfirm] = useState(false);
  const play = (key: MomentKey) => setActive((a) => ({ key, nonce: (a?.nonce ?? 0) + 1 }));
  const common = { testID: 'galeria-motion-momento' };
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
        return <BossHit {...common} bossName={BOSS_NAMES[boss]} bossId={boss} hpFrom={1500} hpTo={1404} hpMax={3600} damageLabel="−96" mineLabel="Sua parte: 8,4 km" />;
      case 'chefao-derrota':
        return <BossDefeated {...common} bossName={BOSS_NAMES[boss]} bossId={boss} city="Goiânia" myKm={42.3} />;
      case 'nivel':
        return <LevelUp {...common} level={7} title="Desbravador" team={faction} reward={{ label: 'Rastro neon' }} />;
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
      case 'bora':
        return (
          <View style={{ alignSelf: 'stretch', gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
            <Text variant="bodyBold">Corredor de demonstração</Text>
            <Text variant="small" muted>
              Correu 6,2 km e pintou 14 trechos no Setor Bueno.
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <BoraReaction
                testID="galeria-motion-bora-reacao"
                active={bora.active}
                count={bora.count}
                onPress={() => setBora((b) => ({ active: !b.active, count: b.count + (b.active ? -1 : 1) }))}
              />
            </View>
          </View>
        );
      case 'resumo':
      case 'resumo-leitor':
        return (
          <CelebrationSequence
            testID="galeria-motion-resumo"
            events={demoEvents(faction, rarity, boss)}
            intro="Corrida de demonstração concluída: 8,42 km."
            layout="single"
            // "Resumo (fila)" segue o sistema (na web, sem como saber, o roteiro toca); o outro força o leitor
            screenReader={active.key === 'resumo-leitor' ? true : undefined}
            renderMoment={renderCelebrationMoment({ team: faction })}
          />
        );
      case 'confete-60':
        // teto de partículas (60) sozinho, para medir quadros por segundo (T7.3.5)
        return <Confetti count={60} colors={[neon.orange, '#FFFFFF', '#FFD60A', team]} width={stage.width} height={stage.height} origin={{ x: stage.width / 2, y: stage.height * 0.4 }} seed={8} testID="galeria-motion-confete" />;
      case 'onboarding-arte':
        // o que o onboarding (E6a) deixa vivo de uma vez: os 4 corredores do carrossel (leve) e o busto do líder
        return (
          <View testID="galeria-motion-onboarding" style={{ alignItems: 'center', gap: space[2] }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {FACTIONS.map((f) => (
                <MascotRunner key={f} team={f} size={150} quality="leve" animated />
              ))}
            </View>
            <LeaderBust team={faction} pose="falando" size={112} animated />
          </View>
        );
      case 'capa':
        // a capa em foco com o idle (1,6 s); tocar nela dá a mola, o flash do lema, o pulo e a vibração do time
        return (
          <View style={{ alignItems: 'center', gap: space[3] }}>
            {/* o carrossel da escolha de time (4 capas, só a do centro anima), como na tela real */}
            <View style={{ marginHorizontal: -space[4], alignSelf: 'stretch' }}>
              <TeamCoverCarousel testID="galeria-motion-capas" value={faction} onChange={setFaction} confirming={coverConfirm ? faction : null} />
            </View>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Chip testID="galeria-motion-capa-confirmar" accessibilityLabel={coverConfirm ? 'Voltar a capa' : 'Confirmar (a capa cresce)'} onPress={() => setCoverConfirm((c) => !c)} />
            </View>
          </View>
        );
      case 'cerimonia':
        return (
          <TeamConfirm
            {...common}
            faction={faction}
            variant="ftue"
            mascot={<Mascot team={faction} pose="vitoria" size={150} />}
            leader={{ name: LEADERS[faction], quote: 'Texto provisório da frase do líder.' }}
            origin={{ x: stage.width / 2, y: stage.height / 2 }}
            finale={({ still, delay }) => <TrailReveal team={faction} still={still} delay={delay} testID="galeria-motion-rastro" />}
            finaleText={trailRevealText(faction)}
            ctaLabel="Continuar"
            onContinue={() => setActive(null)}
          />
        );
      case 'primeiro-trecho':
        return <FirstPaintSeal {...common} color={team} />;
      case 'bairro':
        return (
          <View style={{ alignSelf: 'stretch' }}>
            <NeighborhoodFlip testID="galeria-motion-bairro" path={DEMO_PATH} zones={demoFlipZones(faction)} team={faction} routeColor={team} height={220} delay={300} />
          </View>
        );
      case 'chefao-fase':
        return <BossHit {...common} bossName={BOSS_NAMES[boss]} bossId={boss} hpFrom={2500} hpTo={2350} hpMax={3600} damageLabel="−6,0 km" mineLabel="Sua parte: 6,0 km" />;
      case 'semana-time':
        return (
          <View style={{ alignSelf: 'stretch', paddingTop: space[4] }}>
            <TeamWeekCard testID="galeria-motion-semana" team={faction} body="2º na temporada · 48 zonas · demonstração" first={false} onPress={() => setActive(null)} accessibilityLabel="Semana nova, demonstração. Toque para fechar." />
          </View>
        );
      case 'carimbo-bairro':
        return <DistrictStampMoment testID="galeria-motion-carimbo" name="Setor Bueno" />;
      case 'recorde-trechos':
        return <PRStamp {...common} label="Recorde" metric="47 trechos" count={{ value: 47, unit: 'trechos' }} pulses={2} />;
      case 'lider':
        // os números contam (900 ms) e o balão entra 300 ms depois
        return (
          <View style={{ alignSelf: 'stretch', gap: space[4] }}>
            <View style={{ alignItems: 'center' }}>
              <CountUp value={47} from={0} duration={900} variant="metric" unit="trechos" accessibilityLabel="47 trechos" />
            </View>
            <LeaderComment testID="galeria-motion-lider" team={faction} text="Texto de demonstração: 47 trechos numa corrida só." delay={leaderCommentDelay(900)} />
          </View>
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
            Dados de demonstração. Arte da E4 (baú com o prêmio, chefão com a silhueta, mascote e medalhas).
          </Text>
        </View>

        <Section title="Ajustes">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            <Chip testID="galeria-motion-reduzido-sistema" accessibilityLabel="Movimento: sistema" active={reduced === null} onPress={() => setReduced(null)} />
            <Chip testID="galeria-motion-reduzido-sim" accessibilityLabel="Reduzido" active={reduced === true} onPress={() => setReduced(true)} />
            <Chip testID="galeria-motion-reduzido-nao" accessibilityLabel="Completo" active={reduced === false} onPress={() => setReduced(false)} />
            <Chip testID="galeria-motion-vibracao" accessibilityLabel={vibration ? 'Vibração ligada' : 'Vibração desligada'} active={vibration} onPress={() => setVibration(!vibration)} />
            <Chip testID="galeria-motion-pular" accessibilityLabel={skipAll ? 'Pular celebrações: sim' : 'Pular celebrações: não'} active={skipAll} onPress={() => setSkipAll(!skipAll)} />
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {BOSS_IDS.map((b) => (
              <Chip key={b} testID={`galeria-motion-chefao-${b}`} accessibilityLabel={`Chefão ${BOSS_NAMES[b]}`} active={boss === b} onPress={() => setBoss(b)} />
            ))}
          </View>
        </Section>

        <Section title="Momentos">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {MOMENTS.map((m) => (
              <Chip key={m.key} testID={`galeria-motion-${m.key}`} accessibilityLabel={m.label} active={active?.key === m.key} onPress={() => play(m.key)} />
            ))}
          </View>
          <Text variant="label" muted>
            FASE 8 · ONDA C
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {MOMENTS_F8.map((m) => (
              <Chip
                key={m.key}
                testID={`galeria-motion-${m.key}`}
                accessibilityLabel={m.label}
                active={active?.key === m.key}
                onPress={() => {
                  setCoverConfirm(false);
                  play(m.key);
                }}
              />
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
