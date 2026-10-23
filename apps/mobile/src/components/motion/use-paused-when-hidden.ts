import { useCallback, useContext, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { NavigationContext } from 'expo-router/react-navigation';

/**
 * Laços infinitos (fundo neon, raios, esqueleto) não devem gastar bateria fora da vista (T7.2.9, P9 da F1).
 * Escondido = app em segundo plano/inativo **ou** a tela perdeu o foco (outra aba ou outra tela por cima)
 * **ou** a própria tela pediu (`paused`, ex.: o roteiro de celebração está tocando). Puro.
 */
export function isHidden(appState: AppStateStatus | null | undefined, focused: boolean, paused = false): boolean {
  return paused || !focused || appState === 'background' || appState === 'inactive';
}

const subscribeApp = (onChange: () => void) => {
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
};
const appSnapshot = (): AppStateStatus => AppState.currentState;

/**
 * `true` quando o laço deve parar. Use no efeito que inicia o laço:
 *
 * ```tsx
 * const paused = usePausedWhenHidden();
 * useEffect(() => {
 *   if (paused || reduced) return;
 *   v.set(withRepeat(withTiming(1, { duration: 5200 }), -1, false));
 *   return () => cancelAnimation(v);
 * }, [paused, reduced, v]);
 * // ou, numa animação CSS: animationPlayState: paused ? 'paused' : 'running'
 * ```
 *
 * Fora de um navegador (galeria, testes) a tela conta como focada. Não lança erro sem navegação.
 */
export function usePausedWhenHidden(options: { paused?: boolean } = {}): boolean {
  const appState = useSyncExternalStore(subscribeApp, appSnapshot, appSnapshot);
  const navigation = useContext(NavigationContext);
  const subscribeFocus = useCallback(
    (onChange: () => void) => {
      if (!navigation) return () => {};
      const offFocus = navigation.addListener('focus', onChange);
      const offBlur = navigation.addListener('blur', onChange);
      return () => {
        offFocus();
        offBlur();
      };
    },
    [navigation],
  );
  const focusSnapshot = useCallback(() => (navigation ? navigation.isFocused() : true), [navigation]);
  const focused = useSyncExternalStore(subscribeFocus, focusSnapshot, focusSnapshot);
  return isHidden(appState, focused, options.paused ?? false);
}
