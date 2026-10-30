import { Circle, Polygon, Rect } from 'react-native-svg';

import { TeamEmblem } from '@/components/art/team/emblem';
import type { FactionId } from '@/domain/types';
import type { TeamShape } from '@/theme/tokens';

/** The team's shape, centered in a `size` box: the color-blind safe cue that goes with the color. */
export function TeamShapeGlyph({ shape, size, color }: { shape: TeamShape; size: number; color: string }) {
  const c = size / 2;
  const r = size * 0.2;
  switch (shape) {
    case 'circulo':
      return <Circle cx={c} cy={c} r={r} fill={color} />;
    case 'triangulo':
      return <Polygon points={`${c},${c - r * 1.15} ${c + r * 1.1},${c + r * 0.8} ${c - r * 1.1},${c + r * 0.8}`} fill={color} />;
    case 'losango':
      return <Polygon points={`${c},${c - r * 1.25} ${c + r * 1.05},${c} ${c},${c + r * 1.25} ${c - r * 1.05},${c}`} fill={color} />;
    case 'quadrado':
      return <Rect x={c - r * 0.9} y={c - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.25} fill={color} />;
  }
}

/**
 * Selo do time (D-90): alias fino de `<TeamEmblem variant="auto" />` com a assinatura antiga (`faction`,
 * `size`, `attack`), para trocar o disco sólido de antes em todos os usos de uma vez. `null` é a zona neutra;
 * `attack` adiciona o anel tracejado do mapa. Telas novas usam `TeamEmblem` direto (com `variant`, `on`, `mono`).
 */
export function TeamBadge({ faction, size = 28, attack }: { faction: FactionId | null; size?: number; attack?: boolean }) {
  return <TeamEmblem team={faction} size={size} variant="auto" attack={attack} />;
}
