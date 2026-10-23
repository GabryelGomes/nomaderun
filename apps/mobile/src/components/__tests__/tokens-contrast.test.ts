/**
 * @jest-environment node
 *
 * D-75 (T7.1.17) — contraste dos tokens usados pelos componentes base. O `docs/melhoria/F1/qa/contraste.cjs --strict`
 * mede a tabela inteira; este teste trava, no Jest, os pares que a E6 corrigiu (para nenhuma mudança de token voltar atrás).
 */
import { describe, expect, it } from '@jest/globals';

import { neon, neonTeam } from '@/theme/neon';
import { dark, factions } from '@/theme/tokens';

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('D-75 — contraste dos tokens', () => {
  it('texto escuro sobre o laranja e no botão de perigo (≥ 4,5:1)', () => {
    expect(dark.onAction).toBe('#070708');
    expect(ratio(dark.onAction, dark.action)).toBeGreaterThanOrEqual(7);
    expect(ratio(dark.onDanger, dark.danger)).toBeGreaterThanOrEqual(4.5);
  });

  it('bordas de controle ≥ 3:1 no fundo e nas superfícies', () => {
    for (const bg of [dark.background, dark.surface, dark.surfaceSunken]) expect(ratio(dark.lineControl, bg)).toBeGreaterThanOrEqual(3);
  });

  it('violeta dos vilões (D-67) legível como texto', () => {
    expect(neon.villain).toBe('#B15CFF');
    expect(ratio(neon.villain, dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(neon.villain, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto sobre a cor do time e texto na cor neon do time passam AA', () => {
    for (const f of Object.values(factions)) expect(ratio(f.onColor, f.color)).toBeGreaterThanOrEqual(4.5);
    for (const c of Object.values(neonTeam)) expect(ratio(c, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
