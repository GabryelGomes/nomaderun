import Svg, { Circle, Defs, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';

import type { FactionId } from '@/domain/types';
import { factions, palette, type Pattern as PatternKind } from '@/theme/tokens';

/** Pointy-top hexagon points for a box of `size`. */
export function hexPoints(size: number, inset = 0) {
  const r = size / 2 - inset;
  const c = size / 2;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** The chalk hatch of each faction (Product Book §5.2): the redundant, color-blind safe cue. */
export function HatchPattern({ id, kind, color, scale = 1 }: { id: string; kind: PatternKind; color: string; scale?: number }) {
  const s = 8 * scale;
  return (
    <Pattern id={id} patternUnits="userSpaceOnUse" width={s} height={s}>
      {kind === 'listras' && <Line x1={0} y1={s} x2={s} y2={0} stroke={color} strokeWidth={1.6 * scale} strokeLinecap="round" />}
      {kind === 'pontos' && <Circle cx={s / 2} cy={s / 2} r={1.3 * scale} fill={color} />}
      {kind === 'ondas' && (
        <Path d={`M0 ${s * 0.6} Q ${s / 4} ${s * 0.25} ${s / 2} ${s * 0.6} T ${s} ${s * 0.6}`} stroke={color} strokeWidth={1.4 * scale} fill="none" />
      )}
      {kind === 'xadrez' && (
        <>
          <Rect x={0} y={0} width={s / 2} height={s / 2} fill={color} opacity={0.55} />
          <Rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} fill={color} opacity={0.55} />
        </>
      )}
    </Pattern>
  );
}

/** A faction's hexagon: soft fill, chalk hatch and a solid edge. `null` draws a neutral zone. */
export function HexMark({
  faction,
  size = 28,
  attack,
}: {
  faction: FactionId | null;
  size?: number;
  attack?: boolean;
}) {
  const f = faction ? factions[faction] : null;
  const pid = `hatch-${faction ?? 'none'}-${size}`;
  const pts = hexPoints(size, 1.5);
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no">
      {f ? (
        <Defs>
          <HatchPattern id={pid} kind={f.pattern} color={f.color} scale={size / 40} />
        </Defs>
      ) : null}
      <Polygon points={pts} fill={f ? f.soft : '#F3F5F7'} />
      {f ? <Polygon points={pts} fill={`url(#${pid})`} /> : null}
      <Polygon
        points={pts}
        fill="none"
        stroke={attack ? palette.asfalto : f ? f.color : '#B8C0CA'}
        strokeWidth={attack ? 2.5 : 1.6}
        strokeDasharray={attack ? '4 3' : f ? undefined : '3 3'}
      />
      {attack ? (
        <Polygon points={pts} fill="none" stroke={palette.sinalizacao} strokeWidth={2.5} strokeDasharray="4 3" strokeDashoffset={4} />
      ) : null}
    </Svg>
  );
}
