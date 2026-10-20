import { describe, expect, it } from '@jest/globals';

import { validateJustification } from '@/services/api/moderation-repo';

import { canManageUser, canModerate } from '../guard';
import { activitySeries, pathFrame } from '../series';

describe('guarda de papel do painel (RF-018)', () => {
  it('só moderador e admin entram; corredor e visitante nunca', () => {
    expect(canModerate('moderator')).toBe(true);
    expect(canModerate('admin')).toBe(true);
    expect(canModerate('runner')).toBe(false);
    expect(canModerate(null)).toBe(false);
    expect(canModerate(undefined)).toBe(false);
  });

  it('só admin altera contas, e nunca a própria', () => {
    expect(canManageUser('admin', 'a', 'b')).toBe(true);
    expect(canManageUser('admin', 'a', 'a')).toBe(false);
    expect(canManageUser('moderator', 'a', 'b')).toBe(false);
    expect(canManageUser('admin', null, 'b')).toBe(false);
  });
});

describe('justificativa obrigatória (10 a 1000 caracteres)', () => {
  it('recusa vazia, curta e longa; aceita no limite', () => {
    expect(validateJustification('')).toMatch(/Escreva/);
    expect(validateJustification('   curta   ')).toMatch(/pelo menos 10/);
    expect(validateJustification('x'.repeat(1001))).toMatch(/no máximo 1000/);
    expect(validateJustification('  ' + 'x'.repeat(10) + '  ')).toBeNull();
    expect(validateJustification('x'.repeat(1000))).toBeNull();
  });
});

describe('séries dos gráficos', () => {
  const base = { accuracy: 5, mocked: false };
  const pts = [
    { ...base, seq: 0, lat: -16.7, lng: -49.24, t: 0, speed: 3, steps: null },
    { ...base, seq: 1, lat: -16.7001, lng: -49.24, t: 5000, speed: 3, steps: 14 },
    { ...base, seq: 2, lat: -16.7002, lng: -49.24, t: 10_000, speed: null, steps: 14 },
    { ...base, seq: 3, lat: -16.71, lng: -49.24, t: 40_000, speed: 12, steps: 0 },
  ];

  it('usa a velocidade do GPS (m/s → km/h) e calcula quando falta', () => {
    const s = activitySeries(pts, 15);
    expect(s.speed[0].x).toBe(0);
    expect(s.speed[0].y).toBeCloseTo((3 * 3.6 + (11.1 / 5) * 3.6) / 2, 0);
    expect(s.maxSpeed).toBeCloseTo(43.2, 1);
    expect(s.durationS).toBe(40);
    expect(s.path).toHaveLength(4);
  });

  it('cadência em passos por minuto; vazia sem pedômetro', () => {
    const s = activitySeries(pts, 15);
    expect(s.cadence[0].y).toBeCloseTo((28 / 10) * 60, 5);
    expect(activitySeries(pts.map((p) => ({ ...p, steps: null })), 15).cadence).toEqual([]);
    expect(activitySeries([pts[0]]).speed).toEqual([]);
  });

  it('enquadra o percurso', () => {
    const f = pathFrame(pts.map((p) => ({ lat: p.lat, lng: p.lng })));
    expect(f?.center.lat).toBeCloseTo(-16.705, 3);
    expect(f!.spanM).toBeGreaterThanOrEqual(600);
    expect(pathFrame([])).toBeNull();
  });
});
