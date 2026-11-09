import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { FadeUp } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { space } from '@/theme/tokens';

import { CityDividedStep } from './city-divided-step';

/** "Pular" aparece a partir de 2 s (regra 1 de `F8/01` §1.3); a tela passa sozinha aos 6 s. */
export const SKIP_AFTER_MS = 2000;

/**
 * "A cidade está dividida" antes da conta (D-91): o mapa com as 4 cores por até 6 s, com o botão "Escolher meu time"
 * (o "Pular") a partir de 2 s. Vai para a escolha do time (`/times`); quem volta, cai nas boas-vindas.
 */
export function CityDividedScreen() {
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(t);
  }, []);
  const next = useCallback(() => router.replace('/times'), []);
  return (
    <ScreenScroll
      testID="tela-cidade"
      gap={space[6]}
      contentContainerStyle={{ flexGrow: 1 }}
      footer={
        skip ? (
          <FadeUp>
            <Button testID="onboarding-cidade-continuar" label="Escolher meu time" accessibilityLabel="Pular para a escolha do time" size="lg" wide onPress={next} />
          </FadeUp>
        ) : (
          <View style={{ height: 56 }} />
        )
      }>
      <CityDividedStep onNext={next} />
    </ScreenScroll>
  );
}
