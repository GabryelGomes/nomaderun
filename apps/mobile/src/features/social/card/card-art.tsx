/**
 * T7.1.9 — espaço para a arte da E4 (mascote do time e chefão) por props. Até a onda 2, o card usa
 * marcadores simples no mesmo traço: o selo do time no lugar do mascote e um emblema partido no lugar do
 * chefão. A arte precisa ser **vetor** (componentes SVG): `<Image>` dentro do SVG sai em branco no `toDataURL`.
 */
import type { ReactNode } from 'react';
import { Circle, ClipPath, Defs, G, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import type { FactionId } from '@/domain/types';

import { cardColors, LightPool, TeamBadge } from './card-parts';

/** Onde a arte deve caber: centro e tamanho (lado do quadrado) em unidades do card. */
export type ArtBox = { cx: number; cy: number; size: number };

/** Arte pronta (`ReactNode` de elementos SVG) ou função que desenha dentro da caixa. */
export type CardArtSlot = ReactNode | ((box: ArtBox) => ReactNode);

export type ShareCardArt = {
  /** Mascote do time (nível novo e versão sem rota). */
  mascot?: CardArtSlot;
  /** Ilustração do chefão derrotado. */
  boss?: CardArtSlot;
};

export function renderArt(slot: CardArtSlot | undefined, box: ArtBox, fallback: () => ReactNode): ReactNode {
  if (typeof slot === 'function') return slot(box);
  if (slot !== undefined && slot !== null && slot !== false) return slot;
  return fallback();
}

/** Marcador do mascote: o selo do time. */
export function MascotPlaceholder({ faction, box }: { faction: FactionId; box: ArtBox }) {
  return <TeamBadge faction={faction} cx={box.cx} cy={box.cy} r={box.size / 2} />;
}

const CRACK: readonly [number, number][] = [
  [0.18, -1.2],
  [-0.06, -0.62],
  [0.2, -0.3],
  [-0.16, 0.12],
  [0.08, 0.46],
  [-0.1, 1.2],
];

/** Marcador do chefão: emblema de "sol de mormaço" partido ao meio, com a rachadura acesa. */
export function BossPlaceholder({ id, box }: { id: string; box: ArtBox }) {
  const { cx, cy } = box;
  const R = box.size / 2;
  const crack = CRACK.map(([x, y]) => `${(cx + x * R).toFixed(1)} ${(cy + y * R).toFixed(1)}`).join(' L');
  const gap = R * 0.15;
  return (
    <G>
      <Defs>
        <RadialGradient id={`${id}f`} cx="0.4" cy="0.35" r="0.75">
          <Stop offset="0" stopColor="#FFC08F" />
          <Stop offset="0.4" stopColor={cardColors.orange} />
          <Stop offset="1" stopColor="#E5301F" />
        </RadialGradient>
        <ClipPath id={`${id}l`}>
          <Path d={`M${cx - R * 2} ${cy - R * 2} L${crack} L${cx - R * 2} ${cy + R * 2}Z`} />
        </ClipPath>
        <ClipPath id={`${id}r`}>
          <Path d={`M${cx + R * 2} ${cy - R * 2} L${crack} L${cx + R * 2} ${cy + R * 2}Z`} />
        </ClipPath>
      </Defs>
      {[1.55, 1.35, 1.17].map((k, i) => (
        <Circle key={k} cx={cx} cy={cy} r={R * k} fill="none" stroke={cardColors.orange} strokeOpacity={[0.12, 0.22, 0.5][i]} strokeWidth={i === 0 ? 3 : 4} strokeDasharray={i === 0 ? '6 18' : i === 1 ? '2 14' : undefined} />
      ))}
      <LightPool id={`${id}p`} cx={cx} cy={cy} rx={R * 2.2} ry={R * 2.2} color={cardColors.orange} opacity={0.35} />
      <G clipPath={`url(#${id}l)`}>
        <Circle cx={cx - gap} cy={cy + gap * 0.3} r={R} fill={`url(#${id}f)`} />
      </G>
      <G clipPath={`url(#${id}r)`}>
        <Circle cx={cx + gap} cy={cy - gap * 0.2} r={R} fill={`url(#${id}f)`} />
      </G>
      <Path d={`M${crack}`} fill="none" stroke={cardColors.orange} strokeOpacity={0.35} strokeWidth={R * 0.22} strokeLinejoin="round" strokeLinecap="round" />
      <Path d={`M${crack}`} fill="none" stroke="#FFE3CF" strokeWidth={R * 0.035} strokeLinejoin="round" strokeLinecap="round" />
      {(
        [
          [1.25, -0.55, 0.11],
          [1.05, 0.75, 0.08],
          [-1.2, 0.45, 0.1],
          [-0.95, -0.95, 0.07],
        ] as const
      ).map(([sx, sy, sz]) => {
        const x = cx + sx * R;
        const y = cy + sy * R;
        const k = sz * R;
        return <Polygon key={`${sx}`} points={`${x},${y - k} ${x + k * 0.8},${y + k * 0.6} ${x - k * 0.7},${y + k * 0.4}`} fill={cardColors.orange} opacity={0.85} />;
      })}
    </G>
  );
}
