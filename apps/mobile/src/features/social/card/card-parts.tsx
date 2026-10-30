/**
 * T7.1.9 — peças SVG do card (Pit Lane Neon). Só elementos que o react-native-svg 15 desenha no aparelho e
 * no `toDataURL`: path, circle, ellipse, rect, line, polygon, text, g, gradientes, clipPath e mask.
 * Sem `filter`: o brilho é feito com traços empilhados da mesma cor e "poças de luz" (degradê radial).
 */
import { useId, type ReactNode } from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Mask, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import type { FactionId } from '@/domain/types';
import { neon, neonTeam } from '@/theme/neon';
import { dark, factions, type TeamShape } from '@/theme/tokens';

import type { CardRoute } from './card-route';
import { cardFonts, measureText, type CardFont } from './font-metrics';
import { frameRoutes, type Box, type CardRegion } from './route-geometry';

/** Cores do card: os tokens do Pit Lane Neon, mais o núcleo claro da rota (mesmo do protótipo F1). */
export const cardColors = {
  bg: neon.bg,
  surface: neon.surface,
  surface2: dark.surfaceSunken,
  line: neon.line,
  ink: neon.ink,
  ink2: neon.ink2,
  orange: neon.orange,
  orangeText: neon.orangeText,
  /** Núcleo claro do traço neon (laranja quase branco). */
  orangeCore: '#FFD9BF',
  white: '#FFFFFF',
  shadow: '#000000',
} as const;

export const teamColor = (f: FactionId) => neonTeam[f];

/** Ids únicos por card (vários cards na mesma tela; na web os ids do SVG são globais). */
export function useCardIds(): (name: string) => string {
  const base = `nc${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  return (name) => `${base}${name}`;
}

type TextProps = {
  x: number;
  y: number;
  children: string;
  font?: CardFont;
  size?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  /** Espaçamento entre letras, em unidades do SVG. */
  ls?: number;
  opacity?: number;
};

export function CardText({ x, y, children, font = cardFonts.bold, size = 32, fill = cardColors.ink, anchor = 'start', ls, opacity }: TextProps) {
  return (
    <SvgText x={x} y={y} fontFamily={font} fontSize={size} fill={fill} textAnchor={anchor} letterSpacing={ls} opacity={opacity}>
      {children}
    </SvgText>
  );
}

/** Poça de luz: elipse com degradê radial (o SVG nativo não tem text-shadow). */
export function LightPool({ id, cx, cy, rx, ry, color, opacity = 0.3 }: { id: string; cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number }) {
  return (
    <G>
      <Defs>
        <RadialGradient id={id}>
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </G>
  );
}

/** Forma do time (acompanha sempre a cor: leitura para daltônicos). */
export function TeamGlyph({ shape, cx, cy, r, fill }: { shape: TeamShape; cx: number; cy: number; r: number; fill: string }) {
  switch (shape) {
    case 'circulo':
      return <Circle cx={cx} cy={cy} r={r} fill={fill} />;
    case 'triangulo':
      return <Polygon points={`${cx},${cy - r * 1.15} ${cx + r * 1.1},${cy + r * 0.8} ${cx - r * 1.1},${cy + r * 0.8}`} fill={fill} />;
    case 'losango':
      return <Polygon points={`${cx},${cy - r * 1.25} ${cx + r * 1.05},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.05},${cy}`} fill={fill} />;
    default:
      return <Rect x={cx - r * 0.9} y={cy - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.25} fill={fill} />;
  }
}

/** Selo do time: anel com a forma no meio. Também é o marcador provisório do mascote (a arte da E4 entra por props). */
export function TeamBadge({ faction, cx, cy, r }: { faction: FactionId; cx: number; cy: number; r: number }) {
  const color = teamColor(faction);
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r + 10} fill={color} opacity={0.12} />
      <Circle cx={cx} cy={cy} r={r} fill={cardColors.bg} stroke={color} strokeWidth={Math.max(3, r * 0.12)} />
      <TeamGlyph shape={factions[faction].shape} cx={cx} cy={cy} r={r * 0.46} fill={color} />
    </G>
  );
}

/** Pílula do time (forma + nome), alinhada à direita em `right`. */
export function TeamPill({ faction, right, cy, scale = 1 }: { faction: FactionId; right: number; cy: number; scale?: number }) {
  const color = teamColor(faction);
  const size = 28 * scale;
  const ls = 3 * scale;
  const label = factions[faction].name.toUpperCase();
  const h = 64 * scale;
  const w = measureText(label, cardFonts.bold, size, ls) + 96 * scale;
  const x = right - w;
  return (
    <G>
      <Rect x={x} y={cy - h / 2} width={w} height={h} rx={h / 2} fill={cardColors.bg} />
      <Rect x={x} y={cy - h / 2} width={w} height={h} rx={h / 2} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.7} strokeWidth={2} />
      <TeamGlyph shape={factions[faction].shape} cx={x + 34 * scale} cy={cy} r={11 * scale} fill={color} />
      <CardText x={x + 60 * scale} y={cy + size * 0.36} size={size} ls={ls}>
        {label}
      </CardText>
    </G>
  );
}

export const DEMO_STAMP = 'DADOS DE DEMONSTRAÇÃO';

export function DemoStamp({ x, y, anchor = 'middle', size = 22, fill = cardColors.ink2 }: { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; size?: number; fill?: string }) {
  return (
    <CardText x={x} y={y} size={size} fill={fill} ls={4} anchor={anchor}>
      {DEMO_STAMP}
    </CardText>
  );
}

/** Ficha arredondada com forma + texto, centrada em `cx` (ou começando em `cx` com `align="start"`). */
export function CardChip({ cx, cy, label, color, shape = 'circulo', size = 30, h = 72, align = 'middle' }: { cx: number; cy: number; label: string; color: string; shape?: TeamShape; size?: number; h?: number; align?: 'start' | 'middle' }) {
  const w = measureText(label, cardFonts.bold, size) + 110;
  const x = align === 'start' ? cx : cx - w / 2;
  return (
    <G>
      <Rect x={x} y={cy - h / 2} width={w} height={h} rx={h / 2} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={2.5} />
      <TeamGlyph shape={shape} cx={x + 44} cy={cy} r={11} fill={color} />
      <CardText x={x + 74} y={cy + size * 0.36} size={size}>
        {label}
      </CardText>
    </G>
  );
}

/** Selo pequeno de status ("PROVISÓRIO", "EM REVISÃO"), alinhado à direita. */
export function StatusTag({ right, cy, label }: { right: number; cy: number; label: string }) {
  const size = 22;
  const w = measureText(label, cardFonts.bold, size, 4) + 40;
  return (
    <G>
      <Rect x={right - w} y={cy - 22} width={w} height={44} rx={22} fill={cardColors.bg} stroke={cardColors.ink2} strokeWidth={2} />
      <CardText x={right - w / 2} y={cy + 8} size={size} ls={4} fill={cardColors.ink2} anchor="middle">
        {label}
      </CardText>
    </G>
  );
}

const NEON_LAYERS: readonly [number, number][] = [
  [46, 0.05],
  [26, 0.1],
  [14, 0.26],
  [8, 1],
];

/** Traço neon: 4 camadas da mesma cor (halo → traço) e um núcleo claro. */
export function NeonPath({ d, width = 1, color = cardColors.orange, core = cardColors.orangeCore }: { d: string; width?: number; color?: string; core?: string }) {
  if (!d) return null;
  return (
    <G>
      {NEON_LAYERS.map(([w, op]) => (
        <Path key={w} d={d} fill="none" stroke={color} strokeWidth={w * width} strokeOpacity={op} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <Path d={d} fill="none" stroke={core} strokeWidth={2.6 * width} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

/** Raios de luz saindo do centro (celebração). */
export function Rays({ id, cx, cy, r0, r1, n, color, opacity = 0.1 }: { id: string; cx: number; cy: number; r0: number; r1: number; n: number; color: string; opacity?: number }) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = a + (Math.PI * 2) / n / 2.4;
    d += `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)}L${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a2) * r1).toFixed(1)} ${(cy + Math.sin(a2) * r1).toFixed(1)}Z`;
  }
  return (
    <G>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r={r1} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={d} fill={`url(#${id})`} />
    </G>
  );
}

/** Fundo escuro com o brilho do time em cima e o laranja embaixo. */
export function Background({ id, W, H, faction, teamOpacity = 0.16, teamY = 0.32, teamR = 0.62, orangeOpacity = 0.22 }: { id: string; W: number; H: number; faction: FactionId; teamOpacity?: number; teamY?: number; teamR?: number; orangeOpacity?: number }) {
  const team = teamColor(faction);
  return (
    <G>
      <Defs>
        <RadialGradient id={`${id}a`} cx="0.5" cy={teamY} r={teamR}>
          <Stop offset="0" stopColor={team} stopOpacity={teamOpacity} />
          <Stop offset="1" stopColor={team} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}b`} cx="0.5" cy="1.02" r="0.6">
          <Stop offset="0" stopColor={cardColors.orange} stopOpacity={orangeOpacity} />
          <Stop offset="1" stopColor={cardColors.orange} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill={cardColors.bg} />
      <Rect width={W} height={H} fill={`url(#${id}a)`} />
      <Rect width={W} height={H} fill={`url(#${id}b)`} />
    </G>
  );
}

/** Rótulo pequeno + valor grande (+ unidade), centrado em `x`. */
export function Stat({ x, y, label, value, unit, size = 66, fill = cardColors.ink }: { x: number; y: number; label: string; value: string; unit?: string; size?: number; fill?: string }) {
  const vw = measureText(value, cardFonts.display, size);
  const uw = unit ? measureText(unit, cardFonts.bold, size * 0.42) + 10 : 0;
  const x0 = x - (vw + uw) / 2;
  return (
    <G>
      <CardText x={x} y={y} size={24} fill={cardColors.ink2} ls={5} anchor="middle">
        {label}
      </CardText>
      <CardText x={x0} y={y + size + 6} font={cardFonts.display} size={size} fill={fill}>
        {value}
      </CardText>
      {unit ? (
        <CardText x={x0 + vw + 10} y={y + size + 6} size={size * 0.42} fill={cardColors.ink2}>
          {unit}
        </CardText>
      ) : null}
    </G>
  );
}

/** Número herói com unidade ("2,02 km"), com poça de luz atrás. */
export function Hero({ id, x, y, value, unit, size, fill = cardColors.orange, align = 'middle' }: { id: string; x: number; y: number; value: string; unit?: string; size: number; fill?: string; align?: 'start' | 'middle' }) {
  const ls = -size * 0.02;
  const us = size * 0.3;
  const gap = size * 0.06;
  const vw = measureText(value, cardFonts.display, size, ls);
  const w = vw + (unit ? gap + measureText(unit, cardFonts.display, us) : 0);
  const x0 = align === 'start' ? x : x - w / 2;
  return (
    <G>
      <LightPool id={id} cx={x0 + w / 2} cy={y - size * 0.36} rx={w * 0.62} ry={size * 0.62} color={fill} opacity={0.26} />
      <CardText x={x0} y={y} font={cardFonts.display} size={size} fill={fill} ls={ls}>
        {value}
      </CardText>
      {unit ? (
        <CardText x={x0 + vw + gap} y={y} font={cardFonts.display} size={us}>
          {unit}
        </CardText>
      ) : null}
    </G>
  );
}

type MapPanelProps = {
  id: string;
  /** Área do mapa (pode sangrar além de `fitBox`). */
  box: Box & { rx?: number };
  /** Área onde a rota precisa caber. */
  fitBox?: Box;
  /** Só rotas já cortadas pelo domain. */
  routes: readonly CardRoute[];
  regions?: readonly CardRegion[];
  highlight?: FactionId | null;
  pad?: number;
  fade?: boolean;
  fadeStops?: readonly [number, number][];
  dots?: boolean;
  dotStep?: number;
  panelFill?: string;
  border?: boolean;
  routeWidth?: number;
};

/**
 * Mapa do card: fundo escuro sem tiles, grade de pontos quase invisível, regiões dos times (suavizadas,
 * nunca hexágonos) e a rota neon. Enquadra só a parte visível da rota.
 */
export function MapPanel({ id, box, fitBox, routes, regions = [], highlight, pad = 90, fade = true, fadeStops = [[0, 0.45], [0.16, 1], [0.74, 1], [1, 0]], dots = true, dotStep = 36, panelFill, border, routeWidth = 1 }: MapPanelProps) {
  const frame = frameRoutes(routes, fitBox ?? box, pad);
  let dotsD = '';
  if (dots) {
    for (let y = box.y + dotStep / 2; y < box.y + box.h; y += dotStep) for (let x = box.x + dotStep / 2; x < box.x + box.w; x += dotStep) dotsD += `M${x.toFixed(1)} ${y.toFixed(1)}h0.01`;
  }
  return (
    <G>
      <Defs>
        <ClipPath id={`${id}c`}>
          <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.rx ?? 0} />
        </ClipPath>
        {fade ? (
          <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            {fadeStops.map(([k, v]) => (
              <Stop key={k} offset={k} stopColor={cardColors.white} stopOpacity={v} />
            ))}
          </LinearGradient>
        ) : null}
        {fade ? (
          <Mask id={`${id}k`} maskUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
            <Rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${id}g)`} />
          </Mask>
        ) : null}
      </Defs>
      <G clipPath={`url(#${id}c)`} mask={fade ? `url(#${id}k)` : undefined}>
        {panelFill ? <Rect x={box.x} y={box.y} width={box.w} height={box.h} fill={panelFill} /> : null}
        {dotsD ? <Path d={dotsD} stroke={cardColors.ink} strokeOpacity={0.07} strokeWidth={3.2} strokeLinecap="round" /> : null}
        {frame
          ? regions.map((r, i) => {
              const d = frame.regionPath(r);
              const hl = highlight === r.owner;
              const color = teamColor(r.owner);
              return (
                <G key={`r${i}`}>
                  <Path d={d} fill={color} fillOpacity={hl ? 0.3 : 0.11} />
                  <Path d={d} fill="none" stroke={color} strokeOpacity={hl ? 1 : 0.55} strokeWidth={hl ? 4 : 2.5} strokeLinejoin="round" />
                </G>
              );
            })
          : null}
        {frame ? routes.map((r, i) => <NeonPath key={`p${i}`} d={frame.routePath(r)} width={routeWidth} />) : null}
      </G>
      {border ? <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.rx ?? 0} fill="none" stroke={cardColors.line} strokeWidth={2} /> : null}
    </G>
  );
}

/** Arte da versão "sem rota": pista oval genérica + raios do time + selo. Nada de geografia. */
export function NoRouteArt({ id, box, faction, mascot, labelDy = 92 }: { id: string; box: Box; faction: FactionId; mascot: ReactNode; labelDy?: number }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = box.h * 0.3;
  const oval = `M${cx - r * 1.55} ${cy}a${r * 1.55} ${r} 0 1 0 ${r * 3.1} 0a${r * 1.55} ${r} 0 1 0 ${-r * 3.1} 0`;
  return (
    <G>
      <Rays id={`${id}r`} cx={cx} cy={cy} r0={60} r1={box.h * 0.75} n={28} color={teamColor(faction)} opacity={0.16} />
      {[1.35, 1.18].map((k) => (
        <Ellipse key={k} cx={cx} cy={cy} rx={r * 1.55 * k} ry={r * k} fill="none" stroke={cardColors.line} strokeWidth={3} />
      ))}
      <NeonPath d={oval} />
      {mascot}
      <CardText x={cx} y={cy + labelDy} size={22} fill={cardColors.ink2} ls={6} anchor="middle">
        ROTA PROTEGIDA
      </CardText>
    </G>
  );
}

/** Divisória vertical fina entre estatísticas. */
export function Divider({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <Line x1={x} y1={y1} x2={x} y2={y2} stroke={cardColors.line} strokeWidth={2} />;
}
