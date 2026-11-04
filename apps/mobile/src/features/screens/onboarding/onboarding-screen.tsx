import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamEmblem, TutorialArt } from '@/components/art';
import { Button } from '@/components/button';
import { enterAnimation, ShimmerSkeleton } from '@/components/motion';
import { PermissionPrimer } from '@/components/permission-primer';
import { ScreenScroll } from '@/components/screen';
import { Text } from '@/components/text';
import { TEAM_BIO } from '@/domain/team-bio';
import type { FactionId } from '@/domain/types';
import { TextField } from '@/features/auth/form-ui';
import { useOnboardingFlow } from '@/features/auth/onboarding-flow';
import { clearPendingTeam, getPendingTeam } from '@/features/auth/pending-team';
import { chooseFaction, saveProfile } from '@/features/auth/session-controller';
import { validateUsername } from '@/features/auth/validation';
import type { Result } from '@/services/api/errors';
import type { Profile } from '@/services/api/types';
import { useSession } from '@/store/session-store';
import { cssEasings, distances, durations } from '@/theme/motion';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CityDividedStep } from './city-divided-step';
import { TeamChoiceScreen } from './team-choice';

/**
 * Passos depois do cadastro (D-72, D-91). O caminho normal é `pendente` → `localizacao`: o time já foi escolhido
 * antes da conta e fica guardado no aparelho; aqui ele é gravado no servidor (`choose_faction`). `cidade` e `times`
 * são a reserva para quem entrou sem time pendente (login social, conta antiga sem time, ou se gravar falhou).
 * "nome" só existe para quem entrou sem nome de usuário (login social sem nome); a permissão de notificação **não** é
 * pedida aqui (vem depois da 1ª conquista, E7).
 */
export type OnboardingStep = 'nome' | 'pendente' | 'cidade' | 'times' | 'localizacao';

/** Passos com barra de progresso (o caminho de reserva; "nome" e "pendente" ficam fora). */
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

/** Mensagem quando gravar o time falhou (a pessoa escolhe de novo ali mesmo). */
export function saveTeamError(message?: string): string {
  return message ? `Não deu para salvar seu time. ${message}` : 'Não deu para salvar seu time.';
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

/** Enquanto o time escolhido antes da conta é gravado (menos de 1 s, em geral): emblema + 1 linha + esqueleto. */
function SavingStep({ team }: { team: FactionId | null }) {
  return (
    <View testID="onboarding-salvando" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: space[6] }}>
      {team ? <TeamEmblem team={team} size={96} variant="grande" accessibilityLabel={`Emblema dos ${TEAM_BIO[team].name}`} /> : null}
      <Text variant="title" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
        {team ? `Guardando seu lugar nos ${TEAM_BIO[team].name}…` : 'Preparando seu mapa…'}
      </Text>
      <ShimmerSkeleton shape="line" lines={2} accessibilityLabel="Carregando" />
    </View>
  );
}

/**
 * Primeira abertura, parte com conta (D-91): `pendente` (grava o time escolhido antes da conta) → explicação do GPS →
 * Mapa com a missão de boas-vindas. Reserva (sem time pendente ou gravação falhou): "A cidade está dividida" →
 * escolha com as capas + cerimônia (`TeamChoiceScreen`) → GPS. Como o onboarding fica aberto (`onboarding-flow`), o
 * guarda de rotas só leva às abas no último passo.
 */
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const userId = useSession((s) => s.session?.userId ?? null);
  const username = useSession((s) => s.profile?.username ?? '');
  const hasFaction = useSession((s) => Boolean(s.profile?.faction));
  const begin = useOnboardingFlow((s) => s.begin);
  const finish = useOnboardingFlow((s) => s.finish);

  const [step, setStep] = useState<OnboardingStep>(() => (username.trim() ? 'pendente' : 'nome'));
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, setPending] = useState<FactionId | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<FactionId | null>(null);
  const [busy, setBusy] = useState(false);
  const save = useRef<Promise<Result<Profile>> | null>(null);

  // O onboarding fica "aberto" para esta pessoa até o último passo (o guarda de rotas não troca de grupo no meio).
  useEffect(() => {
    if (userId) begin(userId);
  }, [userId, begin]);

  // D-91: time escolhido antes da conta → grava agora. Falhou → escolha de novo, ali mesmo, com o erro.
  useEffect(() => {
    if (step !== 'pendente' || !userId) return;
    let alive = true;
    void (async () => {
      const team = await getPendingTeam();
      if (!alive) return;
      if (!team) {
        setStep(hasFaction ? 'localizacao' : 'cidade');
        return;
      }
      setPending(team);
      const res = await chooseFaction(team);
      if (!alive) return;
      if (res.ok) {
        await clearPendingTeam();
        if (!alive) return;
        setJoinedTeam(team);
        setStep('localizacao');
      } else {
        setFallbackError(saveTeamError(res.error.message));
        setStep('times');
      }
    })();
    return () => {
      alive = false;
    };
  }, [step, userId, hasFaction]);

  const toTeams = useCallback(() => setStep((s) => (s === 'cidade' ? 'times' : s)), []);

  const saveName = async () => {
    const err = validateUsername(name);
    setNameError(err);
    if (err) return;
    setBusy(true);
    const saved = await saveProfile({ username: name.trim() });
    setBusy(false);
    if (!saved.ok) setNameError(saved.error.message);
    else setStep('pendente');
  };

  const allowLocation = async () => {
    setBusy(true);
    await askLocation();
    setBusy(false);
    // Último passo: libera as abas e liga a missão de boas-vindas no Mapa.
    if (userId) finish(userId);
  };

  if (step === 'times') {
    return (
      <TeamChoiceScreen
        header={<StepProgress step={step} />}
        initial={pending}
        initialError={fallbackError}
        onJoin={(f) => {
          save.current = chooseFaction(f);
        }}
        onContinue={async (f) => {
          const res = (await save.current) ?? null;
          if (!res || !res.ok) return saveTeamError(res ? res.error.message : undefined);
          await clearPendingTeam();
          setJoinedTeam(f);
          setStep('localizacao');
          return null;
        }}
      />
    );
  }

  if (step === 'localizacao' || step === 'pendente') {
    return (
      <View testID="tela-onboarding" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ paddingHorizontal: space[6], paddingTop: space[6] }}>
          <StepProgress step={step} />
        </View>
        <StepPanel step={step}>
          <View style={{ minHeight: height - insets.top - insets.bottom - space[12] }}>
            {step === 'pendente' ? <SavingStep team={pending} /> : <LocationStep team={joinedTeam ?? pending ?? 'striders'} busy={busy} onAllow={allowLocation} />}
          </View>
        </StepPanel>
      </View>
    );
  }

  const footer =
    step === 'nome' ? (
      <Button testID="onboarding-nome-continuar" label={busy ? 'Salvando…' : 'Continuar'} size="lg" wide disabled={busy} busy={busy} onPress={saveName} />
    ) : (
      <Button testID="onboarding-cidade-continuar" label="Escolher meu time" size="lg" wide onPress={toTeams} />
    );

  return (
    <ScreenScroll testID="tela-onboarding" padded={false} footer={footer} gap={space[6]} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space[6] }}>
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
    </ScreenScroll>
  );
}
