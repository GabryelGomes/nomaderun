import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { distances, durations } from '@/theme/motion';

import { enterAnimation } from './motion-styles';

/**
 * Opções de transição nativa para `Stack.Screen`/`screenOptions` do Expo Router (react-native-screens).
 * - `push`: tela empilhada (detalhe, editar) — desliza da direita, a do sistema.
 * - `modal`: tela que sobe (nova corrida, resumo) — sobe com fade.
 * - `fade`: troca de contexto (entrar → app, onboarding).
 * `animationDuration` só vale no iOS; no Android a duração é a do sistema.
 * "Reduzir movimento": tudo vira `fade` curto (sem deslocamento).
 */
export type ScreenTransitionKind = 'push' | 'modal' | 'fade' | 'none';

export function screenTransition(kind: ScreenTransitionKind, reduced: boolean) {
  if (kind === 'none') return { animation: 'none' as const };
  if (reduced) return { animation: 'fade' as const, animationDuration: durations.reducedFade * 2 };
  if (kind === 'push') return { animation: 'slide_from_right' as const, animationDuration: durations.navigation };
  if (kind === 'modal') return { animation: 'fade_from_bottom' as const, animationDuration: durations.navigation };
  return { animation: 'fade' as const, animationDuration: durations.state };
}

/** Hook para usar em `screenOptions`: `const t = useScreenTransition('modal')` → `<Stack.Screen options={{ ...t }} />`. */
export function useScreenTransition(kind: ScreenTransitionKind) {
  const reduced = useReducedMotion();
  return screenTransition(kind, reduced);
}

export type ScreenEnterProps = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Entrada do conteúdo de uma tela: sobe 16 pt com fade, expo.out 600 ms (D-54). Envolva o corpo da tela
 * (não o cabeçalho nativo nem a barra fixa — o CTA deve estar tocável desde o primeiro frame).
 * "Reduzir movimento": só opacidade.
 */
export function ScreenEnter({ children, delay = 0, style, testID }: ScreenEnterProps) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      testID={testID}
      style={[{ flexGrow: 1 }, enterAnimation({ reduced, distance: distances.screen, duration: durations.screen, delay, curve: 'reveal' }), style]}>
      {children}
    </Animated.View>
  );
}
