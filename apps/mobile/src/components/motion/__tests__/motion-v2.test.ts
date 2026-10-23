/**
 * T7.1.12 / T7.1.13 — tokens de motion v2 (molas, `springCss`, escala de celebração) e a lógica pura das
 * primitivas (portão de vibração de 150 ms, trajetórias por semente, tremor, marcos, contagem).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  cubicBezier: (...p: number[]) => ({ css: p }),
  linear: (...p: number[]) => ({ linear: p }),
  Easing: { bezier: (...p: number[]) => ({ factory: p }), bezierFn: () => (t: number) => t, linear: (t: number) => t },
  useReducedMotion: () => false,
}));
const mockHaptics = {
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn((_s?: unknown) => Promise.resolve()),
  notificationAsync: jest.fn((_t?: unknown) => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn((_t?: unknown) => Promise.resolve()),
};
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: { Segment_Tick: 'segment-tick', Virtual_Key: 'virtual-key', Context_Click: 'context-click', Long_Press: 'long-press', Confirm: 'confirm', Reject: 'reject' },
  selectionAsync: () => mockHaptics.selectionAsync(),
  impactAsync: (s: unknown) => mockHaptics.impactAsync(s),
  notificationAsync: (t: unknown) => mockHaptics.notificationAsync(t),
  performAndroidHapticsAsync: (t: unknown) => mockHaptics.performAndroidHapticsAsync(t),
}));

/* eslint-disable import/first */
import { countSteps, countStepsFor, widestLabel } from '../count';
import { CRESCENDO_STEP_MS, expandHaptic, haptic, HAPTIC_ANDROID, HAPTIC_IOS, HAPTIC_PRIORITY, HapticGate, performHaptic, resetHaptics } from '../haptics';
import { burstRays, clamp01, clampParticles, confettiParticles, crossedMilestones, floatingStack, particleKeyframes, ringHalves, seededRandom, shakeOffsets } from '../particles';
import { rayPolygons } from '../spin-rays';
import {
  celebration,
  celebrationLevels,
  CELEBRATION_LEVELS,
  cssEasings,
  curves,
  durations,
  easings,
  HAPTIC_MIN_GAP_MS,
  HAPTIC_PATTERNS,
  MAX_PARTICLES,
  PARTICLE_COUNTS,
  springConfig,
  springCss,
  springPoints,
  springs,
  type SpringName,
} from '@/theme/motion';
/* eslint-enable import/first */

const maxOf = (a: number[]) => a.reduce((m, v) => Math.max(m, v), -Infinity);

describe('T7.1.12 — molas e springCss', () => {
  it('4 molas com os nomes e números do catálogo (F1 §2.3)', () => {
    expect(Object.keys(springs)).toEqual(['snappy', 'gentle', 'bouncy', 'stamp']);
    expect(springs.snappy).toEqual({ duration: 350, dampingRatio: 0.8 });
    expect(springs.gentle).toEqual({ duration: 500, dampingRatio: 1 });
    expect(springs.bouncy).toEqual({ duration: 650, dampingRatio: 0.5 });
    expect(springs.stamp).toEqual({ duration: 550, dampingRatio: 0.42 });
    expect(springConfig('bouncy')).toEqual(springs.bouncy);
  });

  it('springPoints começa em 0 e termina exatamente em 1, com 49 pontos', () => {
    for (const z of [0.2, 0.42, 0.5, 0.8, 0.99, 1, 1.5, 3]) {
      const p = springPoints(z);
      expect(p).toHaveLength(49);
      expect(p[0]).toBe(0);
      expect(p[p.length - 1]).toBe(1);
      for (const v of p) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('passa do alvo só com amortecimento < 1 (e mais quanto menor o amortecimento)', () => {
    expect(maxOf(springPoints(0.42))).toBeGreaterThan(1.15);
    expect(maxOf(springPoints(0.5))).toBeGreaterThan(1.1);
    expect(maxOf(springPoints(0.8))).toBeGreaterThan(1);
    expect(maxOf(springPoints(0.42))).toBeGreaterThan(maxOf(springPoints(0.5)));
    expect(maxOf(springPoints(0.5))).toBeGreaterThan(maxOf(springPoints(0.8)));
    for (const z of [1, 1.2, 2, 4]) {
      const p = springPoints(z);
      expect(maxOf(p)).toBeLessThanOrEqual(1);
      // sem passar e sem voltar: não decresce
      for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    }
  });

  it('assenta dentro da duração: no fim fica a menos de 0,5% do alvo', () => {
    for (const name of Object.keys(springs) as SpringName[]) {
      const p = springPoints(springs[name].dampingRatio);
      expect(Math.abs(p[p.length - 2] - 1)).toBeLessThan(0.005);
    }
  });

  it('amortecimento inválido vira mola crítica; amostras mínimas', () => {
    expect(springPoints(Number.NaN)).toEqual(springPoints(1));
    expect(springPoints(-1)).toEqual(springPoints(1));
    expect(springPoints(0.5, 0)).toHaveLength(3);
  });

  it('springCss usa linear(...) do Reanimated com os pontos da mola e reaproveita o objeto', () => {
    const a = springCss('bouncy') as unknown as { linear: number[] };
    expect(a.linear).toEqual(springPoints(0.5));
    expect(springCss('bouncy')).toBe(springCss('bouncy'));
    expect(springCss({ dampingRatio: 0.5 })).toBe(springCss('bouncy'));
    expect(springCss('stamp')).not.toBe(springCss('bouncy'));
  });

  it('curva de saída (power3.in) nas três formas; durações v2', () => {
    expect(curves.exit).toEqual([0.55, 0.055, 0.675, 0.19]);
    expect(easings.exit).toEqual({ factory: [...curves.exit] });
    expect(cssEasings.exit).toEqual({ css: [...curves.exit] });
    expect(durations.exit).toBeLessThan(durations.enter);
    expect(durations.ghostHold + durations.ghostDrain).toBe(720);
    expect(durations.skip).toBeLessThanOrEqual(200);
  });
});

describe('T7.1.12 — escala de celebração', () => {
  it('4 níveis em ordem, durações crescentes e sem sobreposição', () => {
    expect(CELEBRATION_LEVELS).toEqual(['micro', 'small', 'medium', 'epic']);
    let prevMax = 0;
    for (const l of CELEBRATION_LEVELS) {
      const b = celebrationLevels[l];
      expect(b.minMs).toBeGreaterThanOrEqual(prevMax === 0 ? 0 : prevMax - 1);
      expect(b.maxMs).toBeGreaterThan(b.minMs);
      prevMax = b.maxMs;
    }
    expect(celebration.epic.maxMs).toBeLessThanOrEqual(2500);
  });

  it('partículas: 0 no micro, teto de 60 na épica; vibração é um padrão válido', () => {
    expect(celebration.micro.particles).toBe(0);
    expect(celebration.epic.particles).toBe(MAX_PARTICLES);
    expect(MAX_PARTICLES).toBe(60);
    for (const l of CELEBRATION_LEVELS) expect(HAPTIC_PATTERNS).toContain(celebrationLevels[l].haptic);
    expect(PARTICLE_COUNTS.every((n) => n <= MAX_PARTICLES)).toBe(true);
  });

  it('regras de ritmo: 1 épica, 3 médias, respiro e teto do resumo', () => {
    expect(celebration.maxEpic).toBe(1);
    expect(celebration.maxMedium).toBe(3);
    expect(celebration.gapMs).toBe(200);
    expect(celebration.summaryBudgetMs).toBe(8500);
    expect(HAPTIC_MIN_GAP_MS).toBe(150);
  });
});

describe('T7.1.13 — portão de vibração (150 ms)', () => {
  it('vibra fora da janela e descarta dentro dela', () => {
    const g = new HapticGate();
    expect(g.request('tap', 0)).toEqual({ kind: 'fire', pattern: 'tap' });
    expect(g.request('tap', 100)).toEqual({ kind: 'drop' });
    expect(g.request('impact', 149)).toEqual({ kind: 'drop' });
    expect(g.request('impact', 150)).toEqual({ kind: 'fire', pattern: 'impact' });
  });

  it('nenhuma sequência de pedidos gera duas vibrações a menos de 150 ms', () => {
    const rnd = seededRandom(42);
    const pats = ['selection', 'tap', 'impact', 'heavy', 'success', 'warning', 'error'] as const;
    for (let run = 0; run < 50; run++) {
      const g = new HapticGate();
      const fired: number[] = [];
      const deferred: { p: (typeof pats)[number]; at: number }[] = [];
      let t = 0;
      for (let i = 0; i < 40; i++) {
        t += Math.floor(rnd() * 120);
        // o temporizador das adiadas toca na hora certa
        for (const d of deferred.splice(0)) {
          if (d.at <= t) {
            if (g.take(d.p, d.at)) fired.push(d.at);
          } else deferred.push(d);
        }
        const p = pats[Math.floor(rnd() * pats.length)];
        const r = g.request(p, t);
        if (r.kind === 'fire') fired.push(t);
        if (r.kind === 'defer') deferred.push({ p: r.pattern, at: r.atMs });
      }
      for (const d of deferred) if (g.take(d.p, d.at + 1000)) fired.push(d.at);
      fired.sort((a, b) => a - b);
      for (let i = 1; i < fired.length; i++) expect(fired[i] - fired[i - 1]).toBeGreaterThanOrEqual(HAPTIC_MIN_GAP_MS);
    }
  });

  it('sucesso/aviso/erro mais fortes esperam o fim da janela (só o mais forte fica pendente)', () => {
    const g = new HapticGate();
    g.request('impact', 0);
    expect(g.request('success', 50)).toEqual({ kind: 'defer', pattern: 'success', atMs: 150 });
    expect(g.request('warning', 60)).toEqual({ kind: 'defer', pattern: 'warning', atMs: 150 });
    // o mais fraco não substitui
    expect(g.request('success', 70)).toEqual({ kind: 'drop' });
    // o sucesso foi substituído: seu temporizador não toca
    expect(g.take('success', 150)).toBeNull();
    expect(g.take('warning', 150)).toBe('warning');
    expect(g.take('warning', 151)).toBeNull();
    expect(g.request('tap', 200)).toEqual({ kind: 'drop' });
    expect(g.request('tap', 300)).toEqual({ kind: 'fire', pattern: 'tap' });
  });

  it('sucesso igual ao último dentro da janela é descartado (não vibra 2× seguidas)', () => {
    const g = new HapticGate();
    g.request('success', 0);
    expect(g.request('success', 10)).toEqual({ kind: 'drop' });
  });

  it('a adiada devida conta na janela mesmo antes do temporizador tocar', () => {
    const g = new HapticGate();
    g.request('tap', 0);
    g.request('error', 10); // adiada para 150
    expect(g.request('tap', 200)).toEqual({ kind: 'drop' }); // 200 − 150 < 150
    expect(g.take('error', 200)).toBe('error'); // ainda toca
    g.reset();
    expect(g.request('tap', 201)).toEqual({ kind: 'fire', pattern: 'tap' });
  });

  it('crescendo = leve → médio → forte a cada 200 ms (acima do mínimo)', () => {
    expect(expandHaptic('crescendo')).toEqual([
      { pattern: 'tap', offsetMs: 0 },
      { pattern: 'impact', offsetMs: 200 },
      { pattern: 'heavy', offsetMs: 400 },
    ]);
    expect(CRESCENDO_STEP_MS).toBeGreaterThanOrEqual(HAPTIC_MIN_GAP_MS);
    expect(expandHaptic('success')).toEqual([{ pattern: 'success', offsetMs: 0 }]);
  });

  it('prioridade: erro > aviso > sucesso > forte > médio > leve > seleção', () => {
    const order = ['selection', 'tap', 'impact', 'heavy', 'success', 'warning', 'error'] as const;
    for (let i = 1; i < order.length; i++) expect(HAPTIC_PRIORITY[order[i]]).toBeGreaterThan(HAPTIC_PRIORITY[order[i - 1]]);
  });
});

describe('T7.1.13 — vibração por plataforma', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetHaptics();
    for (const f of Object.values(mockHaptics)) f.mockClear();
  });

  it('mapeamento completo dos 7 padrões simples', () => {
    expect(Object.keys(HAPTIC_IOS).sort()).toEqual(Object.keys(HAPTIC_ANDROID).sort());
    expect(Object.keys(HAPTIC_IOS)).toHaveLength(7);
    expect(HAPTIC_ANDROID.success).toBe('confirm');
    expect(HAPTIC_IOS.heavy).toEqual({ api: 'impact', style: 'heavy' });
  });

  it('Android usa performAndroidHapticsAsync; iOS usa impact/notification/selection; web nada', () => {
    performHaptic('success', 'android');
    expect(mockHaptics.performAndroidHapticsAsync).toHaveBeenCalledWith('confirm');
    expect(mockHaptics.notificationAsync).not.toHaveBeenCalled();
    performHaptic('success', 'ios');
    expect(mockHaptics.notificationAsync).toHaveBeenCalledWith('success');
    performHaptic('tap', 'ios');
    expect(mockHaptics.impactAsync).toHaveBeenCalledWith('light');
    performHaptic('selection', 'ios');
    expect(mockHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    for (const f of Object.values(mockHaptics)) f.mockClear();
    performHaptic('error', 'web');
    haptic('error', { os: 'web', force: true });
    for (const f of Object.values(mockHaptics)) expect(f).not.toHaveBeenCalled();
  });

  it('respeita a preferência "Vibração"; `force` (segurança) passa por cima', () => {
    haptic('success', { os: 'ios', enabled: false });
    expect(mockHaptics.notificationAsync).not.toHaveBeenCalled();
    haptic('error', { os: 'ios', enabled: false, force: true });
    expect(mockHaptics.notificationAsync).toHaveBeenCalledWith('error');
  });

  it('o portão global segura cascatas; adiada toca no fim da janela; crescendo em 3 toques', () => {
    haptic('tap', { os: 'android' });
    haptic('tap', { os: 'android' });
    expect(mockHaptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
    haptic('success', { os: 'android' });
    expect(mockHaptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(200);
    expect(mockHaptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(2);
    expect(mockHaptics.performAndroidHapticsAsync).toHaveBeenLastCalledWith('confirm');
    resetHaptics();
    mockHaptics.performAndroidHapticsAsync.mockClear();
    haptic('crescendo', { os: 'android' });
    jest.advanceTimersByTime(450);
    expect(mockHaptics.performAndroidHapticsAsync.mock.calls.map((c) => c[0])).toEqual(['virtual-key', 'context-click', 'long-press']);
  });
});

describe('T7.1.13 — partículas determinísticas', () => {
  it('mesma semente, mesma sequência; sementes diferentes, sequências diferentes', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    const c = seededRandom(6);
    const sa = Array.from({ length: 10 }, () => a());
    expect(Array.from({ length: 10 }, () => b())).toEqual(sa);
    expect(Array.from({ length: 10 }, () => c())).not.toEqual(sa);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
    expect(seededRandom(Number.NaN)()).toBe(seededRandom(0)());
  });

  it('teto de 60 partículas; contagem inválida vira 0', () => {
    expect(clampParticles(500)).toBe(60);
    expect(clampParticles(24.7)).toBe(24);
    expect(clampParticles(-3)).toBe(0);
    expect(clampParticles(Number.NaN)).toBe(0);
    expect(confettiParticles({ count: 999, colors: ['#fff'] })).toHaveLength(60);
    expect(burstRays(999)).toHaveLength(60);
    expect(burstRays(0)).toEqual([]);
  });

  it('confete: trajetórias iguais para a mesma semente, cores em rodízio, começa na origem e some no fim', () => {
    for (const mode of ['burst', 'rain'] as const) {
      const a = confettiParticles({ count: 24, seed: 3, colors: ['#a', '#b', '#c'], mode });
      expect(confettiParticles({ count: 24, seed: 3, colors: ['#a', '#b', '#c'], mode })).toEqual(a);
      expect(confettiParticles({ count: 24, seed: 4, colors: ['#a', '#b', '#c'], mode })).not.toEqual(a);
      expect(a.map((p) => p.color).slice(0, 4)).toEqual(['#a', '#b', '#c', '#a']);
      for (const p of a) {
        expect(p.stops[0].at).toBe(0);
        expect(p.stops[p.stops.length - 1].at).toBe(1);
        expect(p.stops[p.stops.length - 1].opacity).toBe(0);
        expect(p.duration).toBeGreaterThanOrEqual(900);
        expect(p.duration).toBeLessThanOrEqual(1300);
      }
    }
    const burst = confettiParticles({ count: 12, seed: 9, colors: [] });
    for (const p of burst) {
      expect(p.stops[0]).toMatchObject({ x: 0, y: 0 });
      expect(p.color).toBe('#FFFFFF');
      // sobe primeiro (y negativo) e cai depois (gravidade)
      expect(p.stops[1].y).toBeLessThan(0);
      expect(p.stops[5].y).toBeGreaterThan(p.stops[2].y);
    }
  });

  it('quadros-chave só com transform e opacidade', () => {
    const [p] = confettiParticles({ count: 8, seed: 1, colors: ['#f00'] });
    const k = particleKeyframes(p);
    expect(Object.keys(k)).toEqual(['0%', '15%', '35%', '60%', '80%', '100%']);
    for (const frame of Object.values(k)) expect(Object.keys(frame).sort()).toEqual(['opacity', 'transform']);
  });

  it('faíscas espaçadas pelo círculo, determinísticas', () => {
    const r = burstRays(8, { seed: 2, distance: 50 });
    expect(burstRays(8, { seed: 2, distance: 50 })).toEqual(r);
    for (let i = 0; i < r.length; i++) {
      expect(Math.abs(r[i].angle - i * 45)).toBeLessThanOrEqual(45 * 0.25 + 1e-9);
      expect(r[i].distance).toBeGreaterThanOrEqual(40);
      expect(r[i].distance).toBeLessThanOrEqual(60);
    }
    expect(rayPolygons(16, 100)).toHaveLength(16);
    expect(rayPolygons(1, 100)).toHaveLength(3);
  });

  it('tremor alterna, diminui e termina parado', () => {
    const s = shakeOffsets(14, 3);
    expect(s[0]).toBe(14);
    expect(s[s.length - 1]).toBe(0);
    for (let i = 1; i < s.length - 1; i++) {
      expect(Math.sign(s[i])).toBe(-Math.sign(s[i - 1]));
      expect(Math.abs(s[i])).toBeLessThan(Math.abs(s[i - 1]));
    }
    expect(shakeOffsets(0)).toEqual([0]);
    expect(shakeOffsets(-8, 1)).toEqual([8, -4, 0]);
    expect(shakeOffsets(Number.NaN)).toEqual([0]);
    expect(shakeOffsets(5, Number.NaN)).toEqual([5, -2.5, 0]);
  });

  it('marcos cruzados só subindo, em ordem', () => {
    expect(crossedMilestones(0.2, 0.8, [0.75, 0.25, 0.5])).toEqual([0.25, 0.5, 0.75]);
    expect(crossedMilestones(0.25, 0.5, [0.25, 0.5, 0.75])).toEqual([0.5]);
    expect(crossedMilestones(0.8, 0.2, [0.25, 0.5, 0.75])).toEqual([]);
    expect(crossedMilestones(0.5, 0.5, [0.5])).toEqual([]);
  });

  it('anel: metades giram 0–180° cada; progresso limitado a 0–1', () => {
    expect(ringHalves(0)).toEqual({ right: 0, left: 0 });
    expect(ringHalves(0.25)).toEqual({ right: 90, left: 0 });
    expect(ringHalves(0.5)).toEqual({ right: 180, left: 0 });
    expect(ringHalves(0.75)).toEqual({ right: 180, left: 90 });
    expect(ringHalves(2)).toEqual({ right: 180, left: 180 });
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(-1)).toBe(0);
  });

  it('números de dano: até 3 visíveis, 120 ms entre eles, lados alternados', () => {
    expect([0, 1, 2, 3].map(floatingStack)).toEqual([
      { visible: true, delay: 0, offsetX: 0 },
      { visible: true, delay: 120, offsetX: 18 },
      { visible: true, delay: 240, offsetX: -18 },
      { visible: false, delay: 360, offsetX: 18 },
    ]);
  });
});

describe('T7.1.13 — CountUp na thread de UI (quadros pré-calculados)', () => {
  it('começa no início, termina exatamente no valor final', () => {
    const s = countSteps(0, 1250, (t) => t, 10);
    expect(s).toHaveLength(11);
    expect(s[0]).toBe(0);
    expect(s[10]).toBe(1250);
    expect(countSteps(5, 5.24, (t) => t * t, 4, 2).at(-1)).toBe(5.24);
    expect(countSteps(10, 3, (t) => t, 7).at(-1)).toBe(3);
  });

  it('quadros: ~1 a cada 16 ms, com teto de 120', () => {
    expect(countStepsFor(1000)).toBe(63);
    expect(countStepsFor(60_000)).toBe(120);
    expect(countStepsFor(0)).toBe(1);
    expect(countSteps(0, 1, (t) => t, 5000)).toHaveLength(121);
    expect(countSteps(0, 1, (t) => t, Number.NaN)).toEqual([0, 1]);
  });

  it('reserva o texto mais largo', () => {
    expect(widestLabel(['9', '1.250'])).toBe('1.250');
    expect(widestLabel(['10º', '3º'])).toBe('10º');
  });
});
