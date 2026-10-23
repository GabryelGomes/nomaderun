import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { confettiParticles, particleKeyframes } from './particles';
import { useReducedMotionSetting } from './reduced-motion';

export type ConfettiProps = {
  /** Quantidade (8, 12, 24, 36 ou 60; teto de 60). Escala de celebração: pequena 8, média 24, épica 60. */
  count: number;
  colors: readonly string[];
  /** Ponto de partida (pt) dentro do pai. Padrão: centro horizontal, 40% da altura (chuva: topo). */
  origin?: { x: number; y: number };
  mode?: 'burst' | 'rain';
  delay?: number;
  /** Mesma semente, mesmas trajetórias (capturas estáveis). */
  seed?: number;
  /** Largura e altura da área (pt), para a chuva e o espalhamento. */
  width?: number;
  height?: number;
  onEnd?: () => void;
  testID?: string;
};

/**
 * Confete: cada papel é 1 `Animated.View` com quadros-chave CSS (thread de UI, sem shared value) e
 * trajetória física pré-calculada. Decorativo (fora do leitor de tela). "Reduzir movimento": não renderiza.
 */
export function Confetti({ count, colors, origin, mode = 'burst', delay = 0, seed = 1, width = 320, height = 520, onEnd, testID }: ConfettiProps) {
  const reduced = useReducedMotionSetting();
  // trajetórias e quadros-chave calculados uma vez por configuração (o mesmo objeto entre renders)
  // (as cores entram como texto: um vetor novo com as mesmas cores não recalcula nada)
  const palette = colors.join('|');
  const particles = useMemo(
    () => confettiParticles({ count, seed, colors: palette ? palette.split('|') : [], mode, width, height }).map((p) => ({ ...p, keyframes: particleKeyframes(p) })),
    [count, seed, palette, mode, width, height],
  );
  const endMs = reduced ? 0 : delay + particles.reduce((m, p) => Math.max(m, p.delay + p.duration), 0);
  useEffect(() => {
    if (!onEnd) return;
    const t = setTimeout(onEnd, endMs);
    return () => clearTimeout(t);
  }, [onEnd, endMs]);
  if (reduced || particles.length === 0) return null;
  const ox = origin?.x ?? width / 2;
  const oy = origin?.y ?? (mode === 'rain' ? 0 : height * 0.4);
  return (
    <View testID={testID} aria-hidden pointerEvents="none" style={{ position: 'absolute', left: ox, top: oy, width: 0, height: 0 }}>
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute',
            left: -p.width / 2,
            top: -p.height / 2,
            width: p.width,
            height: p.height,
            borderRadius: p.round ? p.width / 2 : 1.5,
            backgroundColor: p.color,
            animationName: p.keyframes,
            animationDuration: p.duration,
            animationDelay: delay + p.delay,
            animationTimingFunction: 'linear',
            animationFillMode: 'both',
          }}
        />
      ))}
    </View>
  );
}
