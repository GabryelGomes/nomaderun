/**
 * Contas puras das partículas e efeitos (T7.1.13): trajetórias determinísticas por semente (a mesma
 * semente dá as mesmas posições — capturas e testes estáveis), teto de 60 partículas, tremor que
 * amortece e marcos de progresso. Nada aqui importa React ou Reanimated.
 */
import { MAX_PARTICLES } from '@/theme/motion';

/** Gerador pseudoaleatório determinístico (mulberry32): mesma semente, mesma sequência, valores em [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quantidade segura de partículas: inteiro entre 0 e o teto (60). */
export function clampParticles(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(MAX_PARTICLES, Math.floor(count));
}

/** Um quadro-chave da partícula: deslocamento (pt), giro (graus), escala e opacidade. */
export type ParticleStop = { at: number; x: number; y: number; rotate: number; scale: number; opacity: number };

export type Particle = {
  id: number;
  color: string;
  width: number;
  height: number;
  /** Arredondada (faísca) ou retângulo (papel). */
  round: boolean;
  delay: number;
  duration: number;
  stops: ParticleStop[];
};

export type ConfettiOptions = {
  count: number;
  seed?: number;
  colors: readonly string[];
  /** `burst`: estoura da origem para cima e cai; `rain`: cai do topo. */
  mode?: 'burst' | 'rain';
  /** Largura da área (pt), usada pela chuva e pelo espalhamento. */
  width?: number;
  /** Altura da queda (pt). */
  height?: number;
};

const STOP_AT = [0, 0.15, 0.35, 0.6, 0.8, 1] as const;
/** Duas casas, sem "-0". */
const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

/**
 * Confete com física simples (velocidade inicial + gravidade + arrasto), amostrada em 6 quadros-chave.
 * Determinístico pela semente; no máximo 60 partículas.
 */
export function confettiParticles({ count, seed = 1, colors, mode = 'burst', width = 320, height = 520 }: ConfettiOptions): Particle[] {
  const n = clampParticles(count);
  const rnd = seededRandom(seed);
  const palette = colors.length > 0 ? colors : ['#FFFFFF'];
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const color = palette[i % palette.length];
    const w = 5 + rnd() * 5;
    const h = 8 + rnd() * 8;
    const spin = (rnd() < 0.5 ? -1 : 1) * (360 + rnd() * 540);
    const duration = Math.round(900 + rnd() * 400);
    const delay = Math.round(rnd() * 120);
    const stops: ParticleStop[] = [];
    if (mode === 'rain') {
      const x0 = (rnd() - 0.5) * width;
      const sway = 14 + rnd() * 26;
      const fall = height * (0.75 + rnd() * 0.35);
      for (const at of STOP_AT) {
        stops.push({ at, x: round2(x0 + Math.sin(at * Math.PI * 2 + i) * sway), y: round2(-40 + fall * at * at * 0.4 + fall * at * 0.6), rotate: round2(spin * at), scale: 1, opacity: at >= 0.8 ? round2(1 - (at - 0.8) / 0.2) : 1 });
      }
    } else {
      // para cima num leque de ±70° em torno da vertical
      const angle = (-90 + (rnd() - 0.5) * 140) * (Math.PI / 180);
      const speed = 260 + rnd() * 240;
      const vx = Math.cos(angle) * speed * Math.min(1, width / 320);
      const vy = Math.sin(angle) * speed;
      const g = 900;
      const tSec = duration / 1000;
      for (const at of STOP_AT) {
        const t = at * tSec;
        const drag = 1 - at * 0.35;
        stops.push({ at, x: round2(vx * t * drag), y: round2(vy * t * drag + 0.5 * g * t * t), rotate: round2(spin * at), scale: at === 0 ? 0.6 : 1, opacity: at >= 0.6 ? round2(Math.max(0, 1 - (at - 0.6) / 0.4)) : 1 });
      }
    }
    out.push({ id: i, color, width: round2(w), height: round2(h), round: false, delay, duration, stops });
  }
  return out;
}

export type Ray = { id: number; angle: number; distance: number; length: number; delay: number };

/** Faíscas radiais: ângulos espaçados por igual com um pouco de variação (determinística). */
export function burstRays(count: number, { seed = 7, distance = 56, length = 14 }: { seed?: number; distance?: number; length?: number } = {}): Ray[] {
  const n = clampParticles(count);
  const rnd = seededRandom(seed);
  const step = n > 0 ? 360 / n : 0;
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    angle: round2(i * step + (rnd() - 0.5) * step * 0.5),
    distance: round2(distance * (0.8 + rnd() * 0.4)),
    length: round2(length * (0.7 + rnd() * 0.6)),
    delay: Math.round(rnd() * 40),
  }));
}

/**
 * Tremor que amortece: alterna o lado e diminui até parar em 0 (ex.: 14 → 0, −14·0,8, …). Sempre
 * termina em repouso (o efeito volta ao normal).
 */
export function shakeOffsets(amplitude: number, cycles: number = 3): number[] {
  const a = Math.abs(Number.isFinite(amplitude) ? amplitude : 0);
  const n = Math.max(1, Math.floor(Number.isFinite(cycles) ? cycles : 1)) * 2;
  if (a === 0) return [0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(round2((i % 2 === 0 ? 1 : -1) * a * (1 - i / n)));
  out.push(0);
  return out;
}

/** Marcos cruzados ao ir de `from` para `to` (só subindo): `from < m ≤ to`, em ordem crescente. */
export function crossedMilestones(from: number, to: number, marks: readonly number[]): number[] {
  if (!(to > from)) return [];
  return [...marks].filter((m) => m > from && m <= to).sort((a, b) => a - b);
}

/** Progresso limitado a 0–1 (valor inválido vira 0). */
export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Giro das duas metades do `ProgressRing` (só transform): a direita gira de 0 a 180° na primeira metade
 * do progresso; a esquerda, de 0 a 180° na segunda.
 */
export function ringHalves(progress: number): { right: number; left: number } {
  const p = clamp01(progress);
  return { right: Math.min(p, 0.5) * 360, left: Math.max(0, p - 0.5) * 360 };
}

/** Números de dano empilhados: até 3 visíveis, 120 ms entre eles, deslocamento lateral alternado. */
export function floatingStack(index: number): { visible: boolean; delay: number; offsetX: number } {
  const i = Math.max(0, Math.floor(index));
  return { visible: i < 3, delay: i * 120, offsetX: i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * 18 };
}

/** Quadros-chave CSS (Reanimated 4) de uma partícula: só transform e opacidade. */
export function particleKeyframes(p: Pick<Particle, 'stops'>): Record<string, { opacity: number; transform: ({ translateX: number } | { translateY: number } | { rotate: string } | { scale: number })[] }> {
  const k: Record<string, { opacity: number; transform: ({ translateX: number } | { translateY: number } | { rotate: string } | { scale: number })[] }> = {};
  for (const s of p.stops) {
    k[`${Math.round(s.at * 100)}%`] = { opacity: s.opacity, transform: [{ translateX: s.x }, { translateY: s.y }, { rotate: `${s.rotate}deg` }, { scale: s.scale }] };
  }
  return k;
}
