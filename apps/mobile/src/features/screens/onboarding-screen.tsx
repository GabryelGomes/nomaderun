import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { useGame } from '@/store/game-store';
import { factions, fonts, palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Step = 'boas-vindas' | 'faccao' | 'localizacao';

/** Onboarding (Product Book §4.2): value first, then team, then a primed location request. */
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const complete = useGame((s) => s.completeOnboarding);
  const [step, setStep] = useState<Step>('boas-vindas');
  const [name, setName] = useState('');
  const [faction, setFaction] = useState<FactionId | null>(null);

  const finish = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // The run screen asks again and offers the simulation if permission is missing.
    }
    complete(name, faction ?? 'striders');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[6], paddingHorizontal: space[6], gap: space[6] }}
      keyboardShouldPersistTaps="handled">
      {step === 'boas-vindas' && (
        <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1, gap: space[6], justifyContent: 'space-between' }}>
          <View style={{ gap: space[4] }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {FACTION_IDS.map((f) => (
                <TeamBadge key={f} faction={f} size={44} />
              ))}
            </View>
            <Text variant="hero" accessibilityRole="header" style={{ fontSize: 76, lineHeight: 76 }}>
              {'NOMADE\nRUN'}
            </Text>
            <Text variant="lead">Corra a sua cidade. Cada rua conta.</Text>
            <Text muted>
              Registre suas corridas como em qualquer app de corrida e, de bônus, pinte o bairro com a cor do seu time,
              revele ruas novas, fuja do seu fantasma e cace baús pela cidade.
            </Text>
          </View>
          <View style={{ gap: space[3] }}>
            <Text variant="caption" muted>
              Como você quer ser chamado?
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={colors.textSecondary}
              autoComplete="given-name"
              returnKeyType="next"
              onSubmitEditing={() => setStep('faccao')}
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
            <Button label="Escolher meu time" size="lg" wide onPress={() => setStep('faccao')} />
          </View>
        </Animated.View>
      )}

      {step === 'faccao' && (
        <Animated.View entering={FadeIn.duration(250)} style={{ gap: space[4] }}>
          <Text variant="headline" accessibilityRole="header">
            Escolha seu time
          </Text>
          <Text muted>Seus quilômetros pintam a cidade com a cor dele. Você pode trocar uma vez por temporada.</Text>
          <View style={{ gap: space[3] }}>
            {FACTION_IDS.map((f) => {
              const on = faction === f;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${factions[f].name}, ${factions[f].motto}`}
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
          </View>
          <Button label="Continuar" size="lg" wide disabled={!faction} onPress={() => setStep('localizacao')} />
        </Animated.View>
      )}

      {step === 'localizacao' && (
        <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1, gap: space[4], justifyContent: 'space-between' }}>
          <View style={{ gap: space[4] }}>
            <Icon name="location" size={40} color={colors.text} />
            <Text variant="headline" accessibilityRole="header">
              Para desenhar seu percurso
            </Text>
            <Text>
              O NOMADE RUN usa sua localização só enquanto você corre: para medir distância e ritmo e saber em que zona da
              cidade você está.
            </Text>
            <Text muted>
              Seu ponto de partida e chegada perto de casa ficam escondidos dos outros corredores. Ninguém vê sua posição
              ao vivo, só os contatos que você escolher na Corrida Segura.
            </Text>
          </View>
          <View style={{ gap: space[3] }}>
            {/* Apple guideline 5.1.1(iv): the primer always leads to the system prompt, never to "Not now". */}
            <Button label="Continuar" size="lg" wide icon="location" onPress={finish} />
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}
