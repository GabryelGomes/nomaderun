import { glyph, neon, type ArtNode } from '@/components/art/neon/core';
import { ART, teamShape } from '@/components/art/neon/palette';
import { FACTION_IDS, type FactionId } from '@/domain/types';

/**
 * "A cidade está dividida" (D-72, etapa da E1): um mapa ilustrado com as 4 cores, por até 6 s, antes da escolha
 * do time. Os números vêm do ranking de times do servidor (zonas de cada time). Sem dado, usa uma divisão de
 * exemplo **marcada como demonstração**. Puro: a tela só desenha.
 */
export const CITY_STEP_MS = 6000;

export type CityShares = {
  /** Porcentagem inteira das zonas de cada time (soma 100). */
  shares: Record<FactionId, number>;
  source: 'servidor' | 'demonstracao';
};

/** Divisão de exemplo (rotulada "Demonstração" na tela). */
export const DEMO_CITY_SHARES: Record<FactionId, number> = { striders: 31, volt: 26, owls: 24, coyotes: 19 };

/** Porcentagens inteiras que somam 100 (maiores restos; empate fica com a ordem dos times). */
export function percentages(counts: Record<FactionId, number>): Record<FactionId, number> {
  const total = FACTION_IDS.reduce((n, f) => n + Math.max(0, counts[f] || 0), 0);
  const out = { striders: 0, volt: 0, owls: 0, coyotes: 0 } as Record<FactionId, number>;
  if (total <= 0) return out;
  const raw = FACTION_IDS.map((f) => ({ f, v: (Math.max(0, counts[f] || 0) * 100) / total }));
  for (const r of raw) out[r.f] = Math.floor(r.v);
  let left = 100 - FACTION_IDS.reduce((n, f) => n + out[f], 0);
  const byRest = [...raw].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)));
  for (const r of byRest) {
    if (left <= 0) break;
    out[r.f] += 1;
    left -= 1;
  }
  return out;
}

/** Zonas por time vindas do servidor → porcentagens; nada (ou zero zonas) → divisão de exemplo. */
export function cityShares(rows: readonly { faction: FactionId; zones: number }[] | null | undefined): CityShares {
  const counts = { striders: 0, volt: 0, owls: 0, coyotes: 0 } as Record<FactionId, number>;
  for (const r of rows ?? []) if (FACTION_IDS.includes(r.faction)) counts[r.faction] += Math.max(0, r.zones || 0);
  const total = FACTION_IDS.reduce((n, f) => n + counts[f], 0);
  if (total <= 0) return { shares: { ...DEMO_CITY_SHARES }, source: 'demonstracao' };
  return { shares: percentages(counts), source: 'servidor' };
}

// ---------------------------------------------------------------- arte (traço neon da E4)

export const CITY_BOX = { vbW: 240, vbH: 200 } as const;

/** Centro de cada região no "mapa" (um quadrante por time). */
const CENTERS: Record<FactionId, readonly [number, number]> = {
  striders: [72, 64],
  volt: [170, 60],
  owls: [70, 142],
  coyotes: [168, 140],
};

/** Ondulação fixa de cada região (determinística: o mapa é sempre igual). */
const WOBBLE: Record<FactionId, readonly number[]> = {
  striders: [1, 0.9, 1.08, 0.94, 1.04, 0.88, 1.06, 0.96],
  volt: [0.95, 1.07, 0.9, 1.04, 0.92, 1.08, 0.98, 1.02],
  owls: [1.05, 0.92, 1, 1.08, 0.9, 1.02, 0.94, 1.06],
  coyotes: [0.92, 1.04, 1.07, 0.9, 1.05, 0.96, 1.02, 0.98],
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Contorno suave (curvas quadráticas pelos pontos médios): região arredondada, nunca a grade de hexágonos. */
export function regionPath(cx: number, cy: number, r: number, wobble: readonly number[]): string {
  const n = wobble.length;
  const pts = wobble.map((w, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * w, cy + Math.sin(a) * r * w * 0.86] as const;
  });
  const mid = (i: number) => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [r1((a[0] + b[0]) / 2), r1((a[1] + b[1]) / 2)] as const;
  };
  const start = mid(n - 1);
  let d = `M${start[0]} ${start[1]}`;
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    d += ` Q ${r1(pts[i][0])} ${r1(pts[i][1])} ${m[0]} ${m[1]}`;
  }
  return `${d} Z`;
}

/** Raio de cada região: a área acompanha a porcentagem (25% = raio base). */
export function regionRadius(share: number, base = 44): number {
  const s = Math.max(4, Math.min(60, share));
  return r1(base * Math.sqrt(s / 25));
}

const STREETS = ['M0 30 L 240 44', 'M0 100 L 240 96', 'M0 170 L 240 158', 'M40 0 L 52 200', 'M120 0 L 116 200', 'M196 0 L 186 200'];

/** Nós da arte: ruas apagadas, as 4 regiões (preenchimento translúcido + traço neon) e a forma de cada time. */
export function cityDividedNodes(shares: Record<FactionId, number>): ArtNode[] {
  const nodes: ArtNode[] = [neon(STREETS, ART.ink2, 1.4, { glow: 0, hot: 0, opacity: 0.18 })];
  for (const f of FACTION_IDS) {
    const [cx, cy] = CENTERS[f];
    const d = regionPath(cx, cy, regionRadius(shares[f]), WOBBLE[f]);
    const color = ART.team[f];
    nodes.push(neon(d, color, 2, { fill: color, glow: 0, hot: 0, opacity: 0.16 }));
    nodes.push(neon(d, color, 2.2, { glow: 0.8, hot: 0.4 }));
    nodes.push(neon(glyph(teamShape(f), cx, cy, 9), color, 2.2, { glow: 0.6, hot: 0.4 }));
  }
  return nodes;
}
