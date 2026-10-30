import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { LeaderBust, Mascot } from '@/components/art';
import { Button } from '@/components/button';
import { TeamConfirm } from '@/components/celebration';
import { LeaderSheet } from '@/components/leader-sheet';
import { haptic } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { TeamCoverCarousel } from '@/components/team-cover-carousel';
import { TEAM_STORY } from '@/components/team-identity';
import { Text } from '@/components/text';
import { TEAM_BIO } from '@/domain/team-bio';
import type { FactionId } from '@/domain/types';
import { ErrorNotice } from '@/features/auth/form-ui';
import { unlockLocalCosmetic } from '@/features/engagement/cosmetics';
import { space } from '@/theme/tokens';

import { OnboardingSheet } from './onboarding-sheet';
import { TeamQuiz } from './team-quiz';
import { RECRUIT_FRAME, TrailReveal, trailRevealText } from './trail-reveal';

type Confirming = { faction: FactionId; origin: { x: number; y: number } };

/** A medida do botão nunca prende a cerimônia (na web e em testes o callback pode não vir). */
const MEASURE_TIMEOUT_MS = 250;

export type TeamChoiceScreenProps = {
  /** Time já marcado ao abrir (ex.: a escolha pendente no aparelho). */
  initial?: FactionId | null;
  /** Erro já na abertura (ex.: gravar o time escolhido antes da conta falhou). */
  initialError?: string | null;
  /** Toque em "Entrar para os …": a cerimônia começa em seguida. Pode gravar algo em paralelo. */
  onJoin?: (f: FactionId) => void;
  /**
   * "Continuar" da cerimônia. Devolve `null` para seguir, ou a mensagem de erro: a cerimônia fecha e o erro aparece
   * sobre o carrossel, com o time ainda marcado.
   */
  onContinue: (f: FactionId) => Promise<string | null>;
  /** Conteúdo acima do título (ex.: a barra de progresso do onboarding). */
  header?: ReactNode;
  /** Rótulo do botão da cerimônia (padrão "Continuar"). */
  continueLabel?: string;
  testID?: string;
};

/**
 * Escolha do time com as 4 capas (D-91, D-93): carrossel (só o card em foco anima), "Não sei escolher" (o quiz
 * sugere e marca; os 4 continuam à vista), folha do líder, a regra de troca em 1 linha antes de confirmar e a
 * cerimônia (`TeamConfirm`, ≤ 3 s, pulável) com o último quadro "Seu rastro agora é <cor>" + moldura Recruta.
 * Usada antes da conta (`(auth)/times`) e, como reserva, no onboarding de quem entrou sem time.
 */
export function TeamChoiceScreen({ initial = null, initialError = null, onJoin, onContinue, header, continueLabel = 'Continuar', testID = 'onboarding' }: TeamChoiceScreenProps) {
  const { height } = useWindowDimensions();
  const [choice, setChoice] = useState<FactionId | null>(initial);
  const [suggested, setSuggested] = useState<FactionId | null>(null);
  const [leader, setLeader] = useState<FactionId | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const cta = useRef<View>(null);

  /** Centro do botão que confirmou (a cor do time nasce dali). Sem medida (ou sem resposta em 250 ms), o pé da tela. */
  const measureOrigin = () =>
    new Promise<{ x: number; y: number }>((resolve) => {
      const fallback = { x: 0, y: height };
      const node = cta.current;
      if (!node?.measureInWindow) return resolve(fallback);
      const timer = setTimeout(() => resolve(fallback), MEASURE_TIMEOUT_MS);
      node.measureInWindow((x, y, w, h) => {
        clearTimeout(timer);
        resolve(Number.isFinite(x + y + w + h) && w > 0 ? { x: x + w / 2, y: y + h / 2 } : fallback);
      });
    });

  const join = async (f: FactionId) => {
    if (confirming || busy) return;
    setError(null);
    setLeader(null);
    setChoice(f);
    onJoin?.(f);
    // Regra 9 (F8/01): a 1ª recompensa tangível, a moldura "Recruta", é liberada na cerimônia.
    void unlockLocalCosmetic(RECRUIT_FRAME.id);
    const origin = await measureOrigin();
    setConfirming({ faction: f, origin });
  };

  const afterConfirm = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    const err = await onContinue(confirming.faction);
    setBusy(false);
    if (err) {
      setConfirming(null);
      setError(err);
    }
  };

  const team = choice ? TEAM_BIO[choice] : null;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll
        testID={`tela-${testID}-times`}
        padded={false}
        gap={space[6]}
        contentContainerStyle={{ flexGrow: 1 }}
        footer={
          <View style={{ gap: space[2] }}>
            <View ref={cta} collapsable={false}>
              <Button testID={`${testID}-entrar-time`} label={team ? `Entrar para os ${team.name}` : 'Toque no seu time'} size="lg" wide disabled={!choice || !!confirming} onPress={() => choice && void join(choice)} />
            </View>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              Dá para trocar 1 vez por temporada.
            </Text>
          </View>
        }>
        {header ? <View style={{ paddingHorizontal: space[6], paddingTop: space[6] }}>{header}</View> : null}
        <View style={{ paddingHorizontal: space[6], paddingTop: header ? 0 : space[6], gap: space[2] }}>
          <Text variant="headline" accessibilityRole="header" testID={`${testID}-times-titulo`}>
            Escolha seu time
          </Text>
        </View>
        <ErrorNotice message={error} testID={`${testID}-erro`} />
        {/* o carrossel fica no meio do espaço que sobra (em telas altas, não gruda no título) */}
        <View style={{ flex: 1, justifyContent: 'center', gap: space[6] }}>
          <TeamCoverCarousel
            testID={`${testID}-times`}
            value={choice}
            suggested={suggested}
            onChange={(f) => {
              setChoice(f);
              haptic('selection');
            }}
            onLeader={setLeader}
          />
          <View style={{ alignItems: 'center' }}>
            <Button testID={`${testID}-nao-sei`} label="Não sei escolher" kind="ghost" onPress={() => setQuiz(true)} />
          </View>
        </View>
      </ScreenScroll>

      <OnboardingSheet visible={leader !== null} onClose={() => setLeader(null)} testID={`${testID}-folha-lider`} label="a fala do líder">
        {leader ? (
          <ScrollView>
            <LeaderSheet
              testID={`${testID}-lider`}
              faction={leader}
              // E4: o busto do líder fala e acena (1 por tela); o nome e a fala ficam em texto.
              art={<LeaderBust team={leader} pose="falando" size={112} animated />}
              onJoin={() => void join(leader)}
              onBack={() => setLeader(null)}
            />
          </ScrollView>
        ) : null}
      </OnboardingSheet>

      <OnboardingSheet visible={quiz} onClose={() => setQuiz(false)} testID={`${testID}-folha-quiz`} label="o quiz">
        <ScrollView contentContainerStyle={{ padding: space[6] }}>
          <TeamQuiz
            onClose={() => setQuiz(false)}
            onPick={(f) => {
              // Regra 4 (F8/01): o quiz sugere e marca; a pessoa decide, com os 4 cards à vista.
              setQuiz(false);
              setSuggested(f);
              setChoice(f);
            }}
          />
        </ScrollView>
      </OnboardingSheet>

      {confirming ? (
        <TeamConfirm
          testID={`${testID}-confirmacao`}
          faction={confirming.faction}
          origin={confirming.origin}
          mascot={<Mascot team={confirming.faction} pose="vitoria" size={150} />}
          leader={{ name: TEAM_STORY[confirming.faction].leader, quote: TEAM_STORY[confirming.faction].cheer }}
          finale={({ still, delay }) => <TrailReveal team={confirming.faction} still={still} delay={delay} testID={`${testID}-rastro`} />}
          finaleText={trailRevealText(confirming.faction)}
          ctaLabel={busy ? 'Salvando seu time…' : continueLabel}
          onContinue={afterConfirm}
        />
      ) : null}
    </View>
  );
}
