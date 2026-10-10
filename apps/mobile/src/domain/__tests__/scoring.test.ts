import { basePace, DAILY_ZONE_CAP, effortMultiplier, scoreZone, streakMultiplier } from '../scoring';

describe('RN-001 v2 — esforço relativo', () => {
  it('vale 1,0 no ritmo habitual do corredor', () => {
    expect(effortMultiplier(330, 330)).toBe(1);
  });

  it('premia correr mais rápido que o habitual, até 1,3', () => {
    expect(effortMultiplier(360, 300)).toBeCloseTo(1.2);
    expect(effortMultiplier(360, 180)).toBe(1.3);
  });

  it('nunca fica abaixo de 0,8 para quem corre mais devagar que o habitual', () => {
    expect(effortMultiplier(300, 600)).toBe(0.8);
  });

  it('um iniciante no limite pontua como um atleta no limite', () => {
    const beginner = effortMultiplier(450, 420); // habitual 7:30, hoje 7:00
    const athlete = effortMultiplier(240, 224); // habitual 4:00, hoje 3:44
    expect(beginner).toBeCloseTo(athlete, 2);
  });

  it('usa 6:00 min/km como ritmo-base quando não há histórico', () => {
    expect(basePace([])).toBe(360);
    expect(basePace([300, 330, 360])).toBe(330);
    expect(basePace([300, 340])).toBe(320);
  });
});

describe('RN-001 — sequência e limite diário', () => {
  it('aplica +5% por dia seguido, até 10 dias', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(4)).toBeCloseTo(1.2);
    expect(streakMultiplier(30)).toBeCloseTo(1.5);
  });

  it('reproduz o exemplo do ERS: 800 m a 5:00, 4 dias seguidos = 115 RP', () => {
    const { rp } = scoreZone({ meters: 800, paceSecPerKm: 300, basePaceSecPerKm: 360, streakDays: 4 });
    expect(rp).toBe(115);
  });

  it('dobra os pontos na defesa e soma o bônus do fantasma', () => {
    const base = scoreZone({ meters: 100, paceSecPerKm: 360, basePaceSecPerKm: 360, streakDays: 0 }).rp;
    expect(scoreZone({ meters: 100, paceSecPerKm: 360, basePaceSecPerKm: 360, streakDays: 0, defending: true }).rp).toBe(base * 2);
    expect(scoreZone({ meters: 100, paceSecPerKm: 360, basePaceSecPerKm: 360, streakDays: 0, beatGhost: true }).rp).toBe(15);
  });

  it('CT-08: limita a 300 RP por zona por dia', () => {
    const r = scoreZone({ meters: 4000, paceSecPerKm: 300, basePaceSecPerKm: 360, streakDays: 0 });
    expect(r.rp).toBe(DAILY_ZONE_CAP);
    expect(r.capped).toBe(true);
    expect(scoreZone({ meters: 4000, paceSecPerKm: 300, basePaceSecPerKm: 360, streakDays: 0, earnedTodayInZone: 250 }).rp).toBe(50);
  });
});
