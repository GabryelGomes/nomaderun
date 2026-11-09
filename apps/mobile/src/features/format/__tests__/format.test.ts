import { describe, expect, it } from '@jest/globals';

import { formatAgo, formatClock, formatCountdown, formatInt, formatLevel, formatPoints, formatTimeLeft, formatUntil, formatXp, NO_DATA, orDash } from '../format';

const H = 3_600_000;
const M = 60_000;

describe('formatos únicos (regra 2 da Fase 8)', () => {
  it('milhar com ponto, sem depender de Intl', () => {
    expect(formatInt(0)).toBe('0');
    expect(formatInt(999)).toBe('999');
    expect(formatInt(1130)).toBe('1.130');
    expect(formatInt(1234567.4)).toBe('1.234.567');
    expect(formatInt(-2500)).toBe('−2.500');
    expect(formatInt(Number.NaN)).toBe(NO_DATA);
  });

  it('XP: "+1.130 XP" no ganho e "1.130 XP" no total', () => {
    expect(formatXp(1130)).toBe('+1.130 XP');
    expect(formatXp(293)).toBe('+293 XP');
    expect(formatXp(0)).toBe('0 XP');
    expect(formatXp(1130, { signed: false })).toBe('1.130 XP');
  });

  it('pontos por extenso, singular e milhar ("pts" nunca)', () => {
    expect(formatPoints(81)).toBe('+81 pontos');
    expect(formatPoints(1)).toBe('+1 ponto');
    expect(formatPoints(1130)).toBe('+1.130 pontos');
    expect(formatPoints(1130, { signed: false })).toBe('1.130 pontos');
    expect(formatPoints(0)).toBe('0 pontos');
  });

  it('nível: "Nível 5"', () => {
    expect(formatLevel(5)).toBe('Nível 5');
    expect(formatLevel(0)).toBe('Nível 1');
  });
});

describe('prazo de defesa: contagem na tela, horário só nos avisos', () => {
  it('contagem: "Faltam 17 h 30 min", nunca "17:30"', () => {
    expect(formatCountdown(17 * H + 30 * M, 0)).toBe('Faltam 17 h 30 min');
    expect(formatCountdown(17 * H + 30 * M + 59_000, 0)).toBe('Faltam 17 h 30 min');
    expect(formatCountdown(2 * H, 0)).toBe('Faltam 2 h');
    expect(formatCountdown(45 * M, 0)).toBe('Faltam 45 min');
    expect(formatCountdown(M, 0)).toBe('Falta 1 min');
    expect(formatCountdown(H, 0)).toBe('Falta 1 h');
    expect(formatCountdown(20_000, 0)).toBe('Falta menos de 1 min');
    expect(formatCountdown(0, 0)).toBe('Prazo encerrado');
    expect(formatCountdown(10, 20)).toBe('Prazo encerrado');
    expect(formatCountdown(17 * H + 30 * M, 0)).not.toMatch(/\d:\d/);
  });

  it('tempo que falta arredonda para baixo (nunca promete tempo a mais)', () => {
    expect(formatTimeLeft(H - 1)).toBe('59 min');
    expect(formatTimeLeft(-5)).toBe('0 min');
  });

  it('horário em Brasília: "02h30" e "até 02h30"', () => {
    // 2026-10-23 05:30 UTC = 02h30 em Brasília (UTC−3)
    const at = Date.UTC(2026, 9, 23, 5, 30);
    expect(formatClock(at)).toBe('02h30');
    expect(formatUntil(at)).toBe('até 02h30');
    expect(formatClock(Date.UTC(2026, 9, 23, 2, 5))).toBe('23h05');
  });
});

describe('dado salvo e sem dado (D-95)', () => {
  const now = Date.UTC(2026, 9, 23, 12);
  it('"há 2 h", "ontem", "há 3 dias"; sem data = null', () => {
    expect(formatAgo(now - 10_000, now)).toBe('agora');
    expect(formatAgo(now - 5 * M, now)).toBe('há 5 min');
    expect(formatAgo(now - 2 * H - 10 * M, now)).toBe('há 2 h');
    expect(formatAgo(now - 30 * H, now)).toBe('ontem');
    expect(formatAgo(now - 3 * 24 * H, now)).toBe('há 3 dias');
    expect(formatAgo(now + 5 * M, now)).toBe('agora');
    expect(formatAgo(null, now)).toBeNull();
    expect(formatAgo(undefined, now)).toBeNull();
  });

  it('sem dado vira traço, nunca zero', () => {
    expect(orDash(false, '0')).toBe(NO_DATA);
    expect(orDash(true, '0')).toBe('0');
  });
});
