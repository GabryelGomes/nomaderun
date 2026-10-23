import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { enterAnimation, FadeUp, Pressable, RevealText, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { ErrorNotice } from '@/features/auth/form-ui';
import { HeroWordmark } from '@/features/auth/hero-wordmark';
import { NeonBackdrop } from '@/features/auth/neon-backdrop';
import { NeonBadges } from '@/features/auth/neon-badges';
import { chooseFaction, saveProfile } from '@/features/auth/session-controller';
import { validateUsername } from '@/features/auth/validation';
import { useSession } from '@/store/session-store';
import { cssEasings, distances, durations } from '@/theme/motion';
import { factions, fonts, palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Step = 'boas-vindas' | 'faccao' | 'localizacao' | 'notificacoes';

/** Etapas depois das boas-vindas, na ordem da barra de progresso. */
const PROGRESS_STEPS: Step[] = ['faccao', 'localizacao', 'notificacoes'];

/** Barra de progresso das etapas (3 segmentos); a cor do segmento muda com power2.inOut. */
function StepProgress({ step }: { step: Step }) {
  const { colors } = useTheme();
  const index = PROGRESS_STEPS.indexOf(step);
  if (index < 0) return null;
  return (
    <View
      testID="onboarding-progresso"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Etapa ${index + 1} de ${PROGRESS_STEPS.length}`}
      style={{ flexDirection: 'row', gap: space[2] }}>
      {PROGRESS_STEPS.map((s, i) => (
        <Animated.View
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: i <= index ? colors.action : colors.surfaceSunken,
            boxShadow: i <= index ? '0 0 10px rgba(255,106,19,0.6)' : undefined,
            transitionProperty: 'backgroundColor',
            transitionDuration: durations.state,
            transitionTimingFunction: cssEasings.swap,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Troca de etapa (D-54): o conteúdo novo entra com expo.inOut em 0,6 s, subindo 16 pt.
 * A `key` remonta o bloco a cada etapa. "Reduzir movimento": só opacidade.
 */
function StepPanel({ step, children, fill }: { step: Step; children: ReactNode; fill?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      key={step}
      style={[
        { gap: space[4] },
        fill ? { flexGrow: 1, justifyContent: 'space-between', gap: space[6] } : null,
        enterAnimation({ reduced, distance: distances.screen, duration: durations.screen, curve: 'screen' }),
      ]}>
      {children}
    </Animated.View>
  );
}

/** Pede a permissão de notificações; carregado sob demanda (push não existe no Expo Go Android). */
async function requestNotificationPermission() {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.requestPermissionsAsync();
  } catch {
    // Sem permissão o app continua: a central de notificações dentro do app funciona igual (D-13).
  }
}

/**
 * Onboarding (Product Book §4.2): value first, then team, then primed permission requests.
 * O nome vem do cadastro (nome de usuário) e a facção é gravada no servidor pelo RPC
 * `choose_faction`. Localização e notificações têm explicações e pedidos separados (RNF-013).
 */
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const username = useSession((s) => s.profile?.username ?? '');
  const [step, setStep] = useState<Step>('boas-vindas');
  const [name, setName] = useState(username);
  const [nameError, setNameError] = useState<string | null>(null);
  const [faction, setFaction] = useState<FactionId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toFaction = () => {
    const err = name.trim() === username ? null : validateUsername(name);
    setNameError(err);
    if (!err) setStep('faccao');
  };

  const askLocation = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // The run screen asks again and offers the simulation if permission is missing.
    }
    setStep('notificacoes');
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    await requestNotificationPermission();
    if (name.trim() && name.trim() !== username) {
      const saved = await saveProfile({ username: name.trim() });
      if (!saved.ok) {
        setBusy(false);
        setNameError(saved.error.message);
        setStep('boas-vindas');
        return;
      }
    }
    const res = await chooseFaction(faction ?? 'striders');
    setBusy(false);
    // Em sucesso o perfil passa a ter facção e o guarda de rotas abre as abas.
    if (!res.ok) setError(res.error.message);
  };

  const footer =
    step === 'faccao' ? (
      <Button testID="onboarding-faccao-continuar" label="Continuar" size="lg" wide disabled={!faction} onPress={() => setStep('localizacao')} />
    ) : step === 'localizacao' ? (
      // Apple guideline 5.1.1(iv): the primer always leads to the system prompt, never to "Not now".
      <Button testID="onboarding-localizacao-continuar" label="Continuar" size="lg" wide icon="location" onPress={askLocation} />
    ) : step === 'notificacoes' ? (
      <Button testID="onboarding-notificacoes-continuar" label={busy ? 'Salvando…' : 'Continuar'} size="lg" wide icon="bell" disabled={busy} onPress={finish} />
    ) : undefined;

  return (
    <ScreenScroll
      testID="tela-onboarding"
      // Boas-vindas com o fundo neon do login (D-58); as outras etapas ficam com a luz ambiente.
      background={step === 'boas-vindas' ? <NeonBackdrop /> : undefined}
      footer={footer}
      gap={space[6]}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space[6], paddingHorizontal: space[6] }}>
      <StepProgress step={step} />

      {step === 'boas-vindas' && (
        <StepPanel step={step} fill>
          <View style={{ gap: space[4] }}>
            <NeonBadges />
            <HeroWordmark testID="onboarding-titulo" delay={120} neon />
            <FadeUp delay={500} style={{ gap: space[4] }}>
              <Text variant="lead">Corra a sua cidade. Cada rua conta.</Text>
              <Text muted>
                Registre suas corridas como em qualquer app de corrida e, de bônus, pinte o bairro com a cor do seu time,
                revele ruas novas, fuja do seu fantasma e cace baús pela cidade.
              </Text>
            </FadeUp>
          </View>
          <View style={{ gap: space[3] }}>
            <Text variant="caption" muted>
              Como você quer ser chamado?
            </Text>
            <TextInput
              testID="onboarding-nome"
              accessibilityLabel="Como você quer ser chamado?"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={colors.textSecondary}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={20}
              returnKeyType="next"
              onSubmitEditing={toFaction}
              style={{
                height: 52,
                borderRadius: radius.md,
                paddingHorizontal: space[4],
                backgroundColor: colors.surface,
                color: colors.text,
                fontFamily: fonts.text,
                fontSize: 17,
              }}
            />
            {nameError ? (
              <Text variant="small" color={colors.danger} accessibilityLiveRegion="polite">
                {nameError}
              </Text>
            ) : null}
            <Button testID="onboarding-escolher-time" label="Escolher meu time" size="lg" wide onPress={toFaction} />
          </View>
        </StepPanel>
      )}

      {step === 'faccao' && (
        <StepPanel step={step}>
          <RevealText testID="onboarding-faccao-titulo" delay={150}>
            Escolha seu time
          </RevealText>
          <Text muted>Seus quilômetros pintam a cidade com a cor dele. Você pode trocar uma vez por temporada.</Text>
          <Stagger delay={250} gap={space[3]}>
            {FACTION_IDS.map((f) => {
              const on = faction === f;
              return (
                <Pressable
                  key={f}
                  testID={`onboarding-faccao-${f}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${factions[f].name}, ${factions[f].motto}`}
                  hitSlop={0}
                  onPress={() => {
                    setFaction(f);
                    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[4],
                    padding: space[4],
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    backgroundColor: on ? factions[f].tint : colors.surface,
                    borderWidth: 2,
                    borderColor: on ? factions[f].color : 'transparent',
                  }}>
                  <TeamBadge faction={f} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text variant="title" color={on ? palette.ink : undefined}>
                      {factions[f].name}
                    </Text>
                    <Text variant="small" color={on ? palette.ink2 : undefined} muted={!on}>
                      {factions[f].motto}
                    </Text>
                  </View>
                  {on ? <Icon name="check" size={22} color={factions[f].color} /> : null}
                </Pressable>
              );
            })}
          </Stagger>
        </StepPanel>
      )}

      {step === 'localizacao' && (
        <StepPanel step={step}>
          <Icon name="location" size={40} color={colors.text} />
          <RevealText testID="onboarding-localizacao-titulo" delay={150}>
            Para desenhar seu percurso
          </RevealText>
          <Text>
            O NOMADE RUN usa sua localização só enquanto você corre: para medir distância e ritmo e saber em que zona da
            cidade você está.
          </Text>
          <Text muted>
            Seu ponto de partida e chegada perto de casa ficam escondidos dos outros corredores. Ninguém vê sua posição
            ao vivo, só os contatos que você escolher na Corrida Segura.
          </Text>
        </StepPanel>
      )}

      {step === 'notificacoes' && (
        <StepPanel step={step}>
          <Icon name="bell" size={40} color={colors.text} />
          <RevealText testID="onboarding-notificacoes-titulo" delay={150}>
            Avisos do seu território
          </RevealText>
          <Text>
            Avisamos quando um rival invadir uma zona do seu time, quando você conquistar uma área nova, quando uma
            missão começar e quando a moderação revisar uma corrida sua.
          </Text>
          <Text muted>
            Nada de propaganda. Você escolhe quais avisos receber no perfil e pode desligar quando quiser. Sem
            permissão, os avisos continuam aparecendo dentro do app.
          </Text>
          <ErrorNotice message={error} testID="onboarding-erro" />
        </StepPanel>
      )}
    </ScreenScroll>
  );
}
