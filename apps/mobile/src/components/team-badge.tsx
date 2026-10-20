import { View } from 'react-native';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';

import type { FactionId } from '@/domain/types';
import { factions, palette, type TeamShape } from '@/theme/tokens';

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
 * A team's badge: solid team color with its shape in white. `null` is a neutral zone.
 * `attack` adds a dashed ring, the same cue the map uses for a contested zone.
 */
export function TeamBadge({ faction, size = 28, attack }: { faction: FactionId | null; size?: number; attack?: boolean }) {
  const f = faction ? factions[faction] : null;
  const c = size / 2;
  const ring = attack ? Math.max(2, size * 0.06) : 0;
  const r = c - ring * 1.6;
  return (
    // Decorativo: escondido do leitor de tela pelo View (aria-hidden vale no celular e na web; as props
    // accessibility* no próprio Svg vazam para o DOM na web e geram erro no console).
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {attack ? <Circle cx={c} cy={c} r={c - ring / 2} fill="none" stroke={palette.danger} strokeWidth={ring} strokeDasharray={`${ring * 2} ${ring * 1.5}`} /> : null}
        <Circle cx={c} cy={c} r={r} fill={f ? f.color : palette.surface2} stroke={f ? palette.white : palette.ink3} strokeWidth={f ? 1.5 : 1.2} strokeDasharray={f ? undefined : '3 3'} />
        {f ? <TeamShapeGlyph shape={f.shape} size={size} color={palette.white} /> : null}
      </Svg>
    </View>
  );
}
