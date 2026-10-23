import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot, TutorialArt } from '@/components/art';
import { Button } from '@/components/button';
import { TeamConfirm } from '@/components/celebration';
import { LeaderSheet } from '@/components/leader-sheet';
import { enterAnimation, haptic } from '@/components/motion';
import { PermissionPrimer } from '@/components/permission-primer';
import { ScreenScroll } from '@/components/screen';
import { TeamCarousel } from '@/components/team-picker';
import { TEAM_STORY } from '@/components/team-identity';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { ErrorNotice, TextField } from '@/features/auth/form-ui';
import { useOnboardingFlow } from '@/features/auth/onboarding-flow';
import { chooseFaction, saveProfile } from '@/features/auth/session-controller';
import { validateUsername } from '@/features/auth/validation';
import type { Result } from '@/services/api/errors';
import type { Profile } from '@/services/api/types';
import { useSession } from '@/store/session-store';
import { cssEasings, distances, durations } from '@/theme/motion';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CityDividedStep } from './city-divided-step';
import { OnboardingSheet } from './onboarding-sheet';
import { TeamQuiz } from './team-quiz';

/**
 * Passos da primeira abertura depois do cadastro (D-72). "nome" só existe para quem entrou sem nome de usuário
 * (login social sem nome); a permissão de notificação **não** é pedida aqui (vem depois da 1ª conquista, E7).
 */
export type OnboardingStep = 'nome' | 'cidade' | 'times' | 'localizacao';

/** Passos com barra de progresso (o "nome", quando existe, fica fora: é exceção). */
export const PROGRESS_STEPS: readonly OnboardingStep[] = ['cidade', 'times', 'localizacao'];

/** O pedido de GPS nunca prende o onboarding: depois de 10 s sem resposta, segue (a Nova corrida pede de novo). */
const LOCATION_TIMEOUT_MS = 10_000;

async function askLocation(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Location.requestForegroundPermissionsAsync(), new Promise<void>((resolve) => (timer = setTimeout(resolve, LOCATION_TIMEOUT_MS)))]);
  } catch {
    // Sem permissão o app continua: a Nova corrida pede de novo e oferece a simulação (demonstração).
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Barra de progresso dos 3 passos; a cor do segmento muda com transição de cor (sem movimento). */
function StepProgress({ step }: { step: OnboardingStep }) {
  const { colors } = useTheme();
  const index = PROGRESS_STEPS.indexOf(step);
  if (index < 0) return null;
  return (
    <View testID="onboarding-progresso" accessible accessibilityRole="progressbar" accessibilityLabel={`Etapa ${index + 1} de ${PROGRESS_STEPS.length}`} style={{ flexDirection: 'row', gap: space[2] }}>
      {PROGRESS_STEPS.map((s, i) => (
        <Animated.View
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: i <= index ? colors.action : colors.surfaceSunken,
            transitionProperty: 'backgroundColor',
            transitionDuration: durations.state,
            transitionTimingFunction: cssEasings.swap,
          }}
        />
      ))}
    </View>
  );
}

/** Troca de passo (D-54): o conteúdo novo sobe 16 pt com expo.inOut. "Reduzir movimento": só opacidade. */
function StepPanel({ step, children }: { step: OnboardingStep; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View key={step} style={[{ gap: space[4] }, enterAnimation({ reduced, distance: distances.screen, duration: durations.screen, curve: 'screen' })]}>
      {children}
    </Animated.View>
  );
}

/**
 * Explicação antes do pedido de GPS (wireframe `05`): ilustração da rua pintando o bairro, 1 motivo e 1 garantia.
 * O botão sempre leva ao pedido do sistema (Apple 5.1.1(iv)); sem permissão, a Nova corrida pede de novo.
 */
function LocationStep({ team, busy, onAllow }: { team: FactionId; busy: boolean; onAllow: () => void }) {
  return (
    <PermissionPrimer
      testID="onboarding-localizacao"
      title="Ligue o GPS e pinte a cidade"
      body="Usamos sua localização só enquanto você corre."
      footnote="Sua casa fica escondida dos outros."
      ctaLabel={busy ? 'Abrindo o mapa…' : 'Permitir localização'}
      busy={busy}
      onPress={onAllow}
      art={<TutorialArt step="pinte" team={team} size={240} />}
    />
  );
}

type Confirming = { faction: FactionId; origin: { x: number; y: number } };

/**
 * Primeira abertura (D-72, wireframes `02`–`05`): "A cidade está dividida" (≤ 6 s) → escolha do time (carrossel com
 * mascote, líder e quiz) → confirmação épica (`TeamConfirm` da E5: a cor inunda a tela, vibração e frase do líder)
 * → explicação do GPS → Mapa com a missão de boas-vindas.
 *
 * O time é gravado no servidor (`choose_faction`) no toque de "Entrar para os …"; a confirmação toca enquanto isso.
 * Como o onboarding fica aberto (`onboarding-flow`), o guarda de rotas só leva às abas no último passo.
 */
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const userId = useSession((s) => s.session?.userId ?? null);
  const username = useSession((s) => s.profile?.username ?? '');
  const begin = useOnboardingFlow((s) => s.begin);
  const finish = useOnboardingFlow((s) => s.finish);

  const [step, setStep] = useState<OnboardingStep>(() => (username.trim() ? 'cidade' : 'nome'));
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [choice, setChoice] = useState<FactionId | null>(null);
  const [leader, setLeader] = useState<FactionId | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<FactionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = useRef<Promise<Result<Profile>> | null>(null);
  const cta = useRef<View>(null);

  // O onboarding fica "aberto" para esta pessoa até o último passo (o guarda de rotas não troca de grupo no meio).
  useEffect(() => {
    if (userId) begin(userId);
  }, [userId, begin]);

  const toTeams = useCallback(() => setStep((s) => (s === 'cidade' ? 'times' : s)), []);

  const saveName = async () => {
    const err = validateUsername(name);
    setNameError(err);
    if (err) return;
    setBusy(true);
    const saved = await saveProfile({ username: name.trim() });
    setBusy(false);
    if (!saved.ok) setNameError(saved.error.message);
    else setStep('cidade');
  };

  /** Centro do botão que confirmou (a cor do time nasce dali). Sem medida, o pé da tela. */
  const measureOrigin = () =>
    new Promise<{ x: number; y: number }>((resolve) => {
      const fallback = { x: 0, y: height };
      const node = cta.current;
      if (!node?.measureInWindow) return resolve(fallback);
      node.measureInWindow((x, y, w, h) => resolve(Number.isFinite(x + y + w + h) && w > 0 ? { x: x + w / 2, y: y + h / 2 } : fallback));
    });

  const join = async (f: FactionId) => {
    if (confirming || busy) return;
    setError(null);
    setLeader(null);
    save.current = chooseFaction(f);
    const origin = await measureOrigin();
    setConfirming({ faction: f, origin });
  };

  /** "Bora correr": espera o time ficar salvo. Falhou → volta para a escolha, com o erro ali mesmo. */
  const afterConfirm = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    const res = (await save.current) ?? null;
    setBusy(false);
    if (!res || !res.ok) {
      setConfirming(null);
      setError(res ? `Não deu para salvar seu time. ${res.error.message}` : 'Não deu para salvar seu time.');
      setStep('times');
      return;
    }
    setJoinedTeam(confirming.faction);
    setConfirming(null);
    setStep('localizacao');
  };

  const allowLocation = async () => {
    setBusy(true);
    await askLocation();
    setBusy(false);
    // Último passo: libera as abas e liga a missão de boas-vindas no Mapa.
    if (userId) finish(userId);
  };

  const team = choice ? factions[choice] : null;
  const footer =
    step === 'nome' ? (
      <Button testID="onboarding-nome-continuar" label={busy ? 'Salvando…' : 'Continuar'} size="lg" wide disabled={busy} busy={busy} onPress={saveName} />
    ) : step === 'cidade' ? (
      <Button testID="onboarding-cidade-continuar" label="Escolher meu time" size="lg" wide onPress={toTeams} />
    ) : step === 'times' ? (
      <View style={{ gap: space[2] }}>
        <View ref={cta} collapsable={false}>
          <Button
            testID="onboarding-entrar-time"
            label={team ? `Entrar para os ${team.name}` : 'Toque no seu time'}
            size="lg"
            wide
            disabled={!choice || !!confirming}
            onPress={() => choice && void join(choice)}
          />
        </View>
        <Text variant="caption" muted style={{ textAlign: 'center' }}>
          Dá para trocar 1 vez por temporada.
        </Text>
      </View>
    ) : undefined;

  if (step === 'localizacao') {
    return (
      <View testID="tela-onboarding" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ paddingHorizontal: space[6], paddingTop: space[6] }}>
          <StepProgress step={step} />
        </View>
        <StepPanel step={step}>
          <View style={{ minHeight: height - insets.top - insets.bottom - space[12] }}>
            <LocationStep team={joinedTeam ?? choice ?? 'striders'} busy={busy} onAllow={allowLocation} />
          </View>
        </StepPanel>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll
        testID="tela-onboarding"
        padded={false}
        footer={footer}
        gap={space[6]}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space[6] }}>
        <View style={{ paddingHorizontal: space[6] }}>
          <StepProgress step={step} />
        </View>

        {step === 'nome' && (
          <StepPanel step={step}>
            <View style={{ paddingHorizontal: space[6], gap: space[4] }}>
              <Text variant="headline" accessibilityRole="header" testID="onboarding-nome-titulo">
                Como chamamos você?
              </Text>
              <TextField
                testID="onboarding-nome"
                label="Nome de usuário"
                value={name}
                onChangeText={setName}
                placeholder="ex.: maria_corre"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={saveName}
                error={nameError}
                help="Aparece nos rankings."
              />
            </View>
          </StepPanel>
        )}

        {step === 'cidade' && (
          <StepPanel step={step}>
            <View style={{ paddingHorizontal: space[6] }}>
              <CityDividedStep onNext={toTeams} />
            </View>
          </StepPanel>
        )}

        {step === 'times' && (
          <StepPanel step={step}>
            <View style={{ paddingHorizontal: space[6], gap: space[2] }}>
              <Text variant="headline" accessibilityRole="header" testID="onboarding-times-titulo">
                Escolha seu time
              </Text>
              <Text muted>Seu time pinta a cidade com a cor dele.</Text>
            </View>
            <ErrorNotice message={error} testID="onboarding-erro" />
            <TeamCarousel
              testID="onboarding-times"
              value={choice}
              onChange={(f) => {
                setChoice(f);
                haptic('selection');
              }}
              onLeader={setLeader}
              renderArt={(f) => <Mascot team={f} pose="parado" size={140} quality="leve" animated />}
            />
            <View style={{ alignItems: 'center' }}>
              <Button testID="onboarding-nao-sei" label="Não sei escolher" kind="ghost" onPress={() => setQuiz(true)} />
            </View>
          </StepPanel>
        )}
      </ScreenScroll>

      <OnboardingSheet visible={leader !== null} onClose={() => setLeader(null)} testID="onboarding-folha-lider" label="a fala do líder">
        {leader ? (
          <ScrollView>
            <LeaderSheet
              testID="onboarding-lider"
              faction={leader}
              art={<Mascot team={leader} pose="parado" size={84} />}
              onJoin={() => {
                setChoice(leader);
                void join(leader);
              }}
              onBack={() => setLeader(null)}
            />
          </ScrollView>
        ) : null}
      </OnboardingSheet>

      <OnboardingSheet visible={quiz} onClose={() => setQuiz(false)} testID="onboarding-folha-quiz" label="o quiz">
        <ScrollView contentContainerStyle={{ padding: space[6] }}>
          <TeamQuiz
            onClose={() => setQuiz(false)}
            onPick={(f) => {
              setQuiz(false);
              setChoice(f);
            }}
          />
        </ScrollView>
      </OnboardingSheet>

      {confirming ? (
        <TeamConfirm
          testID="onboarding-confirmacao"
          faction={confirming.faction}
          origin={confirming.origin}
          mascot={<Mascot team={confirming.faction} pose="vitoria" size={150} />}
          leader={{ name: TEAM_STORY[confirming.faction].leader, quote: TEAM_STORY[confirming.faction].cheer }}
          ctaLabel={busy ? 'Salvando seu time…' : 'Bora correr'}
          onContinue={afterConfirm}
        />
      ) : null}
    </View>
  );
}
