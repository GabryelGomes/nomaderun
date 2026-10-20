/**
 * Testes de propriedade sem dependência nova (T4.1): gerador pseudoaleatório com semente fixa
 * (mulberry32) e um `forAll` que roda N casos e, se um falhar, informa a semente e o caso para
 * reproduzir. Mesmo espírito do fast-check, sem "shrinking".
 */
export type Rng = {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  bool(pTrue?: number): boolean;
  pick<T>(items: readonly T[]): T;
};

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    bool: (p = 0.5) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/** Semente base; troque por `NOMADE_PROP_SEED=<n>` para explorar outros casos. */
export const BASE_SEED = Number(process.env.NOMADE_PROP_SEED ?? 20261020);
export const RUNS = Number(process.env.NOMADE_PROP_RUNS ?? 200);

export function forAll<T>(gen: (r: Rng) => T, check: (value: T) => void, runs = RUNS): void {
  for (let i = 0; i < runs; i++) {
    const seed = BASE_SEED + i;
    const value = gen(rng(seed));
    try {
      check(value);
    } catch (err) {
      const shown = JSON.stringify(value, (_k, v) => (v instanceof Set ? [...v] : v)).slice(0, 2000);
      throw new Error(`Propriedade falhou (semente ${seed}, caso ${i}): ${(err as Error).message}\nCaso: ${shown}`);
    }
  }
}

export async function forAllAsync<T>(gen: (r: Rng) => T, check: (value: T) => Promise<void>, runs = RUNS): Promise<void> {
  for (let i = 0; i < runs; i++) {
    const seed = BASE_SEED + i;
    const value = gen(rng(seed));
    try {
      await check(value);
    } catch (err) {
      throw new Error(`Propriedade falhou (semente ${seed}, caso ${i}): ${(err as Error).message}`);
    }
  }
}
