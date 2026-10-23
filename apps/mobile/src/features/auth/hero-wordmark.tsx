import { useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { enterAnimation } from '@/components/motion';
import { Text } from '@/components/text';
import { distances, durations, staggers } from '@/theme/motion';
import { neon as neonTokens } from '@/theme/neon';

import { wordmarkSize } from './wordmark';

/**
 * "NOMADE RUN" — momento herói das telas Entrar e Boas-vindas (D-54): cada linha sobe de dentro de uma
 * máscara (expo.out, 1,5 s, 90 ms entre linhas), a revelação mais longa do app.
 * Componente local porque o `RevealText` compartilhado ainda não aceita tamanho de fonte próprio
 * (pedido registrado no PROGRESSO para o A7). O leitor de tela lê "NOMADE RUN" uma vez, como cabeçalho.
 * "Reduzir movimento": aparece só com opacidade.
 * `neon` (D-58): "NOMADE" claro e "RUN" em laranja neon com brilho, como na apresentação.
 */
export function HeroWordmark({ testID, delay = 0, neon = false }: { testID?: string; delay?: number; neon?: boolean }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const size = wordmarkSize(width);
  // Folga da máscara: com neon, precisa caber o brilho (senão ele aparece cortado num retângulo).
  const glow = neon ? neonTokens.textGlow.radius : 0;
  const pad = Math.max(Math.ceil(size * 0.12), glow);
  return (
    <View testID={testID} accessible accessibilityRole="header" accessibilityLabel="NOMADE RUN">
      <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {['NOMADE', 'RUN'].map((line, i) => (
          <View key={line} style={{ overflow: 'hidden', paddingVertical: pad, marginVertical: -pad, paddingHorizontal: glow, marginHorizontal: -glow, alignSelf: 'flex-start' }}>
            <Animated.View
              style={enterAnimation({
                reduced,
                kind: 'mask',
                distance: Math.round((size + pad) * distances.revealFraction),
                duration: durations.hero,
                delay: delay + i * staggers.line * 3,
                curve: 'reveal',
              })}>
              <Text
                variant="hero"
                color={neon ? (line === 'RUN' ? neonTokens.orange : neonTokens.ink) : undefined}
                style={[
                  { fontSize: size, lineHeight: size },
                  neon && line === 'RUN'
                    ? {
                        textShadowColor: neonTokens.textGlow.color,
                        textShadowRadius: neonTokens.textGlow.radius,
                        textShadowOffset: { width: 0, height: 0 },
                        // No iOS a sombra é recortada na caixa do próprio texto: a caixa cresce do tamanho do
                        // brilho (padding) e a margem negativa devolve o layout ao lugar.
                        padding: glow,
                        margin: -glow,
                      }
                    : null,
                ]}>
                {line}
              </Text>
            </Animated.View>
          </View>
        ))}
      </View>
    </View>
  );
}
