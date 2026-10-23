/**
 * @jest-environment node
 *
 * T4.3 (A5) — RNF-011 / "Retorno visual obrigatório": com "Reduzir movimento" ligado, nada de deslocamento,
 * traço ou escala; só opacidade e cor. Verificação estática: todo arquivo que anima transform/escala/traço
 * precisa consultar `useReducedMotion` (ou `AccessibilityInfo.isReduceMotionEnabled`).
 * Os que ainda não consultam estão em BASELINE (docs/QA.md, QA-12); arquivo novo fora da regra derruba o teste.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const BASELINE: string[] = []; // QA-12 corrigido (A3): Button, IconButton e HoldButton consultam useReducedMotion

const ANIMATES = [
  /transitionProperty:[^\n]*transform/,
  /transitionProperty:\s*\[[^\]]*'transform'/,
  /animationName/,
  /withTiming\(|withSpring\(|withRepeat\(/,
  /entering=\{(?!FadeIn\b)/,
  /enterAnimation\(|useAnimatedStyle\(|pressFeedback\(/, // primitivas de motion da Fase 6 (T6.1)
];
const CHECKS_REDUCED = /useReducedMotion|isReduceMotionEnabled|ReduceMotion\./;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p, out);
    } else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('RNF-011 — reduzir movimento', () => {
  const animated = walk(SRC)
    .map((f) => ({ rel: relative(SRC, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
    .filter((f) => ANIMATES.some((re) => re.test(f.text)));

  it('encontra as telas animadas (contagem, faixa de território, conquista, resumo)', () => {
    const names = animated.map((f) => f.rel);
    expect(names).toEqual(
      expect.arrayContaining([
        'features/screens/run-screen.tsx',
        'components/capture-celebration.tsx',
        'components/motion/reveal-text.tsx',
        'components/motion/fade-up.tsx',
        'components/motion/screen-enter.tsx',
        'components/motion/pressable.tsx',
        'components/motion/parallax-header.tsx',
      ]),
    );
  });

  it('todo arquivo que anima posição/escala/traço respeita "Reduzir movimento" (fora a BASELINE)', () => {
    const offenders = animated.filter((f) => !CHECKS_REDUCED.test(f.text)).map((f) => f.rel);
    expect(offenders.filter((f) => !BASELINE.includes(f))).toEqual([]);
  });
});
