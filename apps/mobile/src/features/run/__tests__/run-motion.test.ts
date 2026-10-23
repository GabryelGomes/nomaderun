/**
 * T6.4 (D-54, ERS §6.2, RNF-015): contas puras do motion do fluxo da corrida.
 */
import { describe, expect, it } from '@jest/globals';

import { CHALK_INTERVAL_MS, CHALK_STROKE_MS, CHALK_STROKES, CHALK_TOTAL_MS, chalkStrokeProgress, expoOut } from '@/components/capture-celebration.math';
import { tickerChars, timeFontSize } from '@/features/run/run-motion';

describe('celebração: seis traços com 60 ms de intervalo (ERS §6.2)', () => {
  it('tem 6 traços, 60 ms entre o início de cada um, e termina em menos de 1 s', () => {
    expect(CHALK_STROKES).toBe(6);
    expect(CHALK_INTERVAL_MS).toBe(60);
    expect(CHALK_TOTAL_MS).toBe(5 * 60 + CHALK_STROKE_MS);
    expect(CHALK_TOTAL_MS).toBeLessThan(1000);
  });

  it('cada traço começa 60 ms depois do anterior e termina cheio', () => {
    for (let i = 0; i < CHALK_STROKES; i++) {
      expect(chalkStrokeProgress(i, i * CHALK_INTERVAL_MS)).toBe(0);
      expect(chalkStrokeProgress(i, i * CHALK_INTERVAL_MS + 1)).toBeGreaterThan(0);
      expect(chalkStrokeProgress(i, i * CHALK_INTERVAL_MS + CHALK_STROKE_MS)).toBe(1);
    }
    expect(chalkStrokeProgress(1, 30)).toBe(0);
    expect(chalkStrokeProgress(5, CHALK_TOTAL_MS)).toBe(1);
  });

  it('expo.out sobe rápido e é monotônica', () => {
    expect(expoOut(0)).toBe(0);
    expect(expoOut(1)).toBe(1);
    expect(expoOut(0.3)).toBeGreaterThan(0.8);
    let last = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      expect(expoOut(t)).toBeGreaterThanOrEqual(last);
      last = expoOut(t);
    }
  });
});

describe('métricas da corrida (RNF-015)', () => {
  it('tempo sempre com pelo menos 72 pt e menor quando tem horas', () => {
    expect(timeFontSize('0:00')).toBe(88);
    expect(timeFontSize('59:59')).toBe(88);
    expect(timeFontSize('1:02:03')).toBe(72);
    for (const t of ['0:01', '12:34', '1:00:00', '10:00:00']) expect(timeFontSize(t)).toBeGreaterThanOrEqual(72);
  });

  it('só o caractere que mudou ganha chave nova (o resto não anima nem pula)', () => {
    const a = tickerChars('5:31');
    const b = tickerChars('5:32');
    expect(a.map((c) => c.char).join('')).toBe('5:31');
    expect(a.slice(0, 3).map((c) => c.key)).toEqual(b.slice(0, 3).map((c) => c.key));
    expect(a[3].key).not.toBe(b[3].key);
    // posição contada da direita: a casa dos segundos mantém a posição quando o número cresce
    expect(tickerChars('9:59')[3].key.split('-')[0]).toBe(tickerChars('10:00')[4].key.split('-')[0]);
  });
});
