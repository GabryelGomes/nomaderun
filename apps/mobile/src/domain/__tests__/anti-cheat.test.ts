import { describe, expect, it } from '@jest/globals';

import { validateActivity } from '../anti-cheat';
import { offset } from '../geo';
import { applyTrust, trustLevel } from '../trust';
import { chain, ORIGIN, track } from './helpers';

describe('RN-007 — validação do GPS', () => {
  it('CT-01: 24,9 km/h por 40 s é válido', () => {
    const v = validateActivity(track({ kmh: 24.9, seconds: 40, spm: 190 }));
    expect(v.status).toBe('valid');
    expect(v.invalidMeters).toBe(0);
  });

  it('CT-02: 25,1 km/h por 31 s invalida o trecho (suspeita de veículo)', () => {
    const v = validateActivity(track({ kmh: 25.1, seconds: 31, spm: 190 }));
    expect(v.flags).toContain('VEHICLE_SUSPECTED');
    expect(v.validMeters).toBe(0);
  });

  it('25,1 km/h por só 30 s ainda é válido', () => {
    expect(validateActivity(track({ kmh: 25.1, seconds: 30, spm: 190 })).flags).not.toContain('VEHICLE_SUSPECTED');
  });

  it('qualquer ponto acima de 40 km/h invalida o trecho', () => {
    const v = validateActivity(track({ kmh: 41, seconds: 3, spm: 190 }));
    expect(v.flags).toContain('POINT_SPEED');
  });

  it('CT-03: salto de 51 m em 1 s é teletransporte', () => {
    const a = { ...ORIGIN, t: 0, accuracy: 5, steps: 0 };
    const b = { ...offset(ORIGIN, 51, 90), t: 1000, accuracy: 5, steps: 3 };
    expect(validateActivity([a, b]).flags).toContain('TELEPORT');
  });

  it('CT-04: localização simulada rejeita a corrida inteira', () => {
    const pts = track({ kmh: 10, seconds: 60, spm: 170 });
    pts[10] = { ...pts[10], mocked: true };
    const v = validateActivity(pts);
    expect(v.status).toBe('rejected');
    expect(v.flags).toEqual(['MOCK_LOCATION']);
  });

  it('descarta pontos com precisão pior que 30 m', () => {
    const pts = track({ kmh: 10, seconds: 20, spm: 170 });
    pts[5] = { ...pts[5], accuracy: 31 };
    expect(validateActivity(pts).discardedPoints).toBe(1);
  });

  it('marca só o trecho ruim como inválido (corrida parcialmente válida)', () => {
    const pts = chain(
      (start, t0) => track({ kmh: 11, seconds: 120, start, t0, spm: 170 }),
      (start, t0) => track({ kmh: 35, seconds: 60, start, t0, spm: 170 }),
      (start, t0) => track({ kmh: 11, seconds: 120, start, t0, spm: 170 }),
    );
    const v = validateActivity(pts);
    expect(v.status).toBe('partially_valid');
    expect(v.validMeters).toBeGreaterThan(700);
    expect(v.invalidMeters).toBeGreaterThan(500);
  });
});

describe('RN-008 — passos × velocidade', () => {
  it('CT-05: 12 km/h com 40 passos/min por 61 s invalida o trecho', () => {
    const v = validateActivity(track({ kmh: 12, seconds: 61, spm: 40 }));
    expect(v.flags).toContain('NO_STEPS');
  });

  it('12 km/h com 40 passos/min por só 60 s ainda é válido', () => {
    expect(validateActivity(track({ kmh: 12, seconds: 60, spm: 40 })).flags).not.toContain('NO_STEPS');
  });

  it('cadência de corrida normal é válida', () => {
    expect(validateActivity(track({ kmh: 12, seconds: 300, spm: 172 })).status).toBe('valid');
  });

  it('aparelho sem pedômetro: corrida longa vai para revisão', () => {
    const v = validateActivity(track({ kmh: 12, seconds: 3100, stepSeconds: 5 }));
    expect(v.flags).toContain('NO_PEDOMETER');
    expect(v.status).toBe('under_review');
  });
});

describe('RN-009 — Índice de Confiança', () => {
  it('penaliza cada tipo de alerta uma vez e recupera 2 em corrida limpa', () => {
    expect(applyTrust(100, ['MOCK_LOCATION'], false)).toBe(70);
    expect(applyTrust(100, ['TELEPORT', 'TELEPORT', 'NO_STEPS'], false)).toBe(80);
    expect(applyTrust(50, [], true)).toBe(52);
    expect(applyTrust(99, [], true)).toBe(100);
  });

  it('abaixo de 40 vai para revisão; abaixo de 10 é suspenso', () => {
    expect(trustLevel(40)).toBe('ok');
    expect(trustLevel(39)).toBe('review');
    expect(trustLevel(9)).toBe('suspended');
  });
});
