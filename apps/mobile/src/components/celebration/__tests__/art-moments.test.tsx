/**
 * T7.2.9 — os momentos com a arte real da E4 (baú com tampa na dobradiça, chefão por estado e dano, mascote
 * acenando, medalha da sequência), a preferência "Pular celebrações", o "Bora!" e as contas puras novas.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('../../motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('../../motion/__tests__/render-mocks').worklets);
jest.mock('react-native-svg', () => require('../../motion/__tests__/render-mocks').svg);
jest.mock('expo-haptics', () => require('../../motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('../../motion/__tests__/render-mocks').safeArea);
jest.mock('@/components/motion/prefs-storage', () => ({ readMotionPrefsRaw: async () => null, writeMotionPrefsRaw: async () => undefined }));
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Boss, Chest, Mascot, Medal, StreakArt } from '@/components/art';
import { useMotionPrefs } from '@/store/motion-prefs-store';

import { resetHaptics } from '../../motion/haptics';
import { mockHapticCalls, mockState } from '../../motion/__tests__/render-mocks';
import { ReducedMotionOverride } from '../../motion/reduced-motion';
import { BossDefeated, BossHit } from '../boss';
import { BoraReaction } from '../bora';
import { CelebrationSequence } from '../celebration-sequence';
import { ChestOpening } from '../chest-opening';
import { boraFeedback, bossDamageFor, chestLidKeyframes, CHEST_TIMELINE, MASCOT_NOD, RARITY_COLORS, RARITY_PALETTES, RARITY_TEXT, resolveBossId } from '../choreography';
import { renderCelebrationMoment } from '../default-moment';
import { LevelUp, StreakFlame } from '../progress-moments';
import { planCelebrations, skipHaptic, type CelebrationEvent } from '../queue';
import { TeamConfirm } from '../team-confirm';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Árvores montadas: desmontadas no fim de cada teste (a preferência é global e re-renderiza quem sobrou). */
const mounted: ReactTestRenderer[] = [];
function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  mounted.push(r!);
  return r!;
}

/** Instâncias de um componente da arte e as props com que foram desenhadas. */
function artOf<P>(r: ReactTestRenderer, type: (p: P) => unknown): P[] {
  return r.root.findAll((n: ReactTestInstance) => n.type === type).map((n: ReactTestInstance) => n.props as P);
}

function hostStyles(r: ReactTestRenderer): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const flat = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(flat);
    else if (s && typeof s === 'object') out.push(s as Record<string, unknown>);
  };
  r.root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.props.style !== undefined).forEach((n: ReactTestInstance) => flat(n.props.style));
  return out;
}

const VIOLET = '#B15CFF';
const json = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());

let announce: ReturnType<typeof jest.spyOn>;
const env = process.env.EXPO_OS;
beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  mockHapticCalls.length = 0;
  resetHaptics();
});
afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((r) => r.unmount());
  });
  jest.useRealTimers();
  announce.mockRestore();
  mockState.reduced = false;
  mockState.timingEnds = true;
  process.env.EXPO_OS = env;
  act(() => {
    useMotionPrefs.getState().reset();
  });
});

describe('contas puras novas', () => {
  it('cores de raridade da E4: comum em tinta, raro laranja, lendário com as 4 cores dos times; nunca violeta', () => {
    expect(RARITY_COLORS.raro).toBe('#FF6A13');
    for (const c of [...Object.values(RARITY_COLORS), ...Object.values(RARITY_TEXT), ...Object.values(RARITY_PALETTES).flat()]) expect(c.toUpperCase()).not.toBe(VIOLET);
    expect(RARITY_PALETTES.lendario).toHaveLength(4);
  });

  it('dano do chefão pelas fases da D-67 (0 acima de 2/3, 1 acima de 1/3, 2 abaixo)', () => {
    expect(bossDamageFor(3600, 3600)).toBe(0);
    expect(bossDamageFor(2401, 3600)).toBe(0);
    expect(bossDamageFor(2400, 3600)).toBe(1);
    expect(bossDamageFor(1201, 3600)).toBe(1);
    expect(bossDamageFor(1200, 3600)).toBe(2);
    expect(bossDamageFor(0, 3600)).toBe(2);
    expect(bossDamageFor(-5, 3600)).toBe(2);
    expect(bossDamageFor(100, 0)).toBe(0);
    expect(bossDamageFor(Number.NaN, 10)).toBe(0);
  });

  it('acha a arte do chefão pelo nome (com ou sem acento, com "Chefão" na frente) ou pelo id', () => {
    expect(resolveBossId('Mormaço')).toBe('mormaco');
    expect(resolveBossId('Chefão Rei Buzina')).toBe('rei-buzina');
    expect(resolveBossId('rei-buzina')).toBe('rei-buzina');
    expect(resolveBossId('PAREDAO da semana')).toBe('paredao');
    expect(resolveBossId('Chefão de demonstração')).toBeNull();
    expect(resolveBossId('')).toBeNull();
    expect(resolveBossId(undefined)).toBeNull();
  });

  it('tampa do baú: só transform/opacidade, quadros em ordem, abre depois do estouro e some', () => {
    const lid = chestLidKeyframes({ shakeMs: CHEST_TIMELINE.shakeMs, burst: CHEST_TIMELINE.burst });
    const keys = Object.keys(lid.keyframes).map((k) => parseFloat(k));
    expect(keys[0]).toBe(0);
    expect(keys[keys.length - 1]).toBe(100);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
    for (const f of Object.values(lid.keyframes)) expect(Object.keys(f).sort()).toEqual(['opacity', 'transform']);
    expect(lid.keyframes['100%'].opacity).toBe(0);
    expect(lid.durationMs).toBe(CHEST_TIMELINE.burst + 260);
    // versão curta: os tempos encolhem e os quadros continuam válidos
    const short = chestLidKeyframes({ shakeMs: 350, burst: 440 });
    expect(Object.keys(short.keyframes).length).toBeGreaterThanOrEqual(6);
  });

  it('"Bora!": só mandar comemora; desfazer é silencioso; reduzido sem pulo nem faíscas', () => {
    expect(boraFeedback(false, true, false)).toEqual({ pop: true, burst: true, haptic: 'selection', fade: true });
    expect(boraFeedback(true, false, false)).toEqual({ pop: false, burst: false, haptic: null, fade: true });
    expect(boraFeedback(false, true, true)).toEqual({ pop: false, burst: false, haptic: 'selection', fade: true });
    expect(boraFeedback(true, true, false).fade).toBe(false);
  });

  it('"Pular celebrações" no plano: tudo no fim, sem roteiro, 1 sucesso só se havia médio ou épico', () => {
    const evs: CelebrationEvent[] = [
      { id: 'x', kind: 'xp', level: 'small', label: 'ganhou XP', payload: { gained: 10, from: 0, to: 0.1 } },
      { id: 'n', kind: 'level-up', level: 'epic', label: 'chegou ao nível 7', payload: { level: 7 } },
    ];
    const plan = planCelebrations(evs, { reduced: false, screenReader: false, skip: true, startAtMs: 2700 });
    expect(plan.mode).toBe('skipped');
    expect(plan.totalMs).toBe(2700);
    expect(plan.moments.every((m) => m.durationMs === 0 && m.startMs === 2700)).toBe(true);
    expect(plan.haptics).toEqual([{ atMs: 2700, pattern: 'success' }]);
    expect(skipHaptic(plan, 0)).toBeNull();
    expect(planCelebrations([evs[0]], { reduced: false, screenReader: false, skip: true }).haptics).toEqual([]);
    // o leitor de tela vence: nenhuma vibração
    expect(planCelebrations(evs, { reduced: false, screenReader: true, skip: true }).mode).toBe('screen-reader');
  });
});

describe('arte da E4 nos momentos', () => {
  it('baú: o fechado chacoalha a tampa na dobradiça e o aberto entra no estouro; final e reduzido só o aberto', () => {
    const r = render(<ChestOpening testID="b" rarity="lendario" xp={120} />);
    const chests = artOf(r, Chest).filter((c) => !c.layer);
    expect(chests.map((c) => c.state)).toEqual(['fechado', 'aberto']);
    expect(chests.every((c) => c.rarity === 'lendario' && c.decorative)).toBe(true);
    const tampa = chests[0].parts?.tampa as Record<string, unknown>;
    expect(tampa.animationName).toBeTruthy();
    expect(json(r)).not.toContain(VIOLET);
    const done = render(<ChestOpening testID="b" rarity="raro" xp={40} state="done" announce={false} />);
    expect(artOf(done, Chest).map((c) => c.state ?? c.layer)).toEqual(['aberto', 'item']);
    const reduced = render(
      <ReducedMotionOverride reduced>
        <ChestOpening testID="b" rarity="comum" xp={10} />
      </ReducedMotionOverride>,
    );
    expect(artOf(reduced, Chest).map((c) => c.state ?? c.layer)).toEqual(['aberto', 'item']);
  });

  it('baú com arte de fora (chest/lid) continua funcionando (API da onda 1)', () => {
    const r = render(<ChestOpening testID="b" rarity="raro" xp={40} chest={<Medal kind="cacador" />} lid={<Medal kind="crew" />} />);
    expect(artOf(r, Chest)).toHaveLength(0);
    expect(artOf(r, Medal).map((m) => m.kind)).toEqual(['crew', 'cacador']);
  });

  it('golpe: chefão achado pelo nome, "golpe" por cima do "parado", rachaduras pela vida e clarão branco', () => {
    const r = render(<BossHit testID="g" bossName="Mormaço" hpFrom={1200} hpTo={1104} hpMax={3600} damageLabel="−96" />);
    const bosses = artOf(r, Boss);
    expect(bosses.map((b) => b.state)).toEqual(['parado', 'golpe', 'golpe']);
    expect(bosses.every((b) => b.id === 'mormaco' && b.dano === 2 && b.decorative)).toBe(true);
    // clarão: a silhueta da E4 (`Boss silhouette`), não mais o traço branco improvisado
    expect(bosses[2].silhouette).toBe(true);
    expect(bosses[2].color).toBeUndefined();
    const pinned = render(<BossHit testID="g" bossName="Chefão de demonstração" bossId="fuligem" dano={0} hpFrom={3600} hpTo={3500} hpMax={3600} damageLabel="−10" state="done" announce={false} />);
    expect(artOf(pinned, Boss).map((b) => [b.id, b.state, b.dano])).toEqual([['fuligem', 'parado', 0]]);
  });

  it('derrota: furioso e quebrado treme e fica branco; no fim, o "derrotado" apagado atrás do carimbo', () => {
    const r = render(<BossDefeated testID="d" bossName="Rei Buzina" city="Goiânia" myKm={12} />);
    expect(artOf(r, Boss).map((b) => [b.id, b.state, b.silhouette ? 'silhueta' : (b.color ?? 'violeta')])).toEqual([
      ['rei-buzina', 'derrotado', 'violeta'],
      ['rei-buzina', 'furioso', 'violeta'],
      ['rei-buzina', 'furioso', 'silhueta'],
    ]);
    const done = render(<BossDefeated testID="d" bossName="Rei Buzina" city="Goiânia" myKm={12} state="done" announce={false} />);
    expect(artOf(done, Boss).map((b) => b.state)).toEqual(['derrotado']);
  });

  it('time: mascote da E4 em "vitória" que acena com a cabeça; reduzido sem aceno', () => {
    const r = render(<TeamConfirm testID="t" faction="volt" leader={{ name: 'Téo Faria', quote: 'Texto provisório' }} origin={{ x: 100, y: 600 }} onContinue={() => {}} />);
    const [m] = artOf(r, Mascot);
    expect(m.team).toBe('volt');
    expect(m.pose).toBe('vitoria');
    expect((m.parts?.cabeca as Record<string, unknown>).animationName).toEqual(MASCOT_NOD.keyframes);
    const reduced = render(
      <ReducedMotionOverride reduced>
        <TeamConfirm testID="t" faction="volt" leader={{ name: 'Téo Faria', quote: 'Texto provisório' }} origin={{ x: 100, y: 600 }} onContinue={() => {}} />
      </ReducedMotionOverride>,
    );
    expect(artOf(reduced, Mascot)[0].parts).toBeUndefined();
  });

  it('sequência com a chama da E4 (StreakArt); nível novo com o mascote do time', () => {
    const s = render(<StreakFlame testID="s" weeks={3} status="kept" />);
    expect(artOf(s, StreakArt).map((a) => [a.state, a.layer])).toEqual([['acesa', 'chama']]);
    const l = render(<LevelUp testID="l" level={7} team="owls" />);
    expect(artOf(l, Mascot).map((m) => [m.team, m.pose])).toEqual([['owls', 'vitoria']]);
    const noTeam = render(<LevelUp testID="l" level={7} />);
    expect(artOf(noTeam, Mascot)).toHaveLength(0);
  });

  it('desenho padrão: chefão pelo bossId do evento, medalha da E4 no toast e "faltam ≈ 80 m"', () => {
    const evs: CelebrationEvent[] = [
      { id: 'h', kind: 'boss-hit', level: 'small', label: 'golpeou', payload: { boss: 'Chefão da semana', bossId: 'soneca', damageKm: 5, hpBefore: 3000, hpAfter: 2950, hpMax: 3600 } },
      { id: 'me', kind: 'medal', level: 'medium', label: 'ganhou uma medalha', payload: { name: 'Explorador', medal: 'explorador', tier: 2 } },
      { id: 'zm', kind: 'zone-milestone', level: 'small', label: 'chegou a 75%', payload: { zone: 'A', fraction: 0.75, gapMeters: 83 } },
    ];
    const r = render(<CelebrationSequence testID="seq" events={evs} renderMoment={renderCelebrationMoment({ team: 'volt' })} screenReader />);
    expect(artOf(r, Boss)[0].id).toBe('soneca');
    expect(artOf(r, Medal).map((m) => [m.kind, m.tier])).toEqual([['explorador', 2]]);
    expect(json(r)).toContain('faltam ≈ 80 m');
  });

  it('nenhuma opacidade fixa (< 1) é apagada pelo fade do estado final (o halo do baú ficava branco)', () => {
    const cases: ReactElement[] = [
      <ChestOpening key="b" testID="b" rarity="lendario" xp={120} state="done" announce={false} />,
      <BossDefeated key="d" testID="d" bossName="Mormaço" city="Goiânia" myKm={1} state="done" announce={false} />,
      <LevelUp key="l" testID="l" level={3} team="volt" state="done" announce={false} />,
      <TeamConfirm key="t" testID="t" faction="owls" leader={{ name: 'Nara Lis', quote: 'Texto provisório' }} origin={{ x: 1, y: 1 }} onContinue={() => {}} state="done" announce={false} />,
    ];
    for (const el of cases) {
      const r = render(<ReducedMotionOverride reduced>{el}</ReducedMotionOverride>);
      // estilo de cada elemento já juntado (o fixo e o animado costumam vir em objetos separados)
      const merged = r.root
        .findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.props.style !== undefined)
        .map((n: ReactTestInstance) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>);
      const bad = merged.filter((s) => typeof s.opacity === 'number' && s.opacity < 1 && s.animationName);
      expect(bad).toEqual([]);
    }
  });
});

describe('preferência "Pular celebrações"', () => {
  it('momento avulso já aparece no estado final, sem vibrar, e ainda anuncia', () => {
    process.env.EXPO_OS = 'ios';
    act(() => {
      useMotionPrefs.getState().setSkipCelebrations(true);
    });
    const r = render(<ChestOpening testID="b" rarity="lendario" xp={120} />);
    expect(artOf(r, Chest).map((c) => c.state ?? c.layer)).toEqual(['aberto', 'item']);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockHapticCalls).toEqual([]);
    expect(announce.mock.calls).toEqual([['Baú lendário aberto: mais 120 XP.']]);
  });

  it('orquestrador: tudo no fim, sem "Pular", fim avisado na hora e 1 sucesso', () => {
    process.env.EXPO_OS = 'ios';
    act(() => {
      useMotionPrefs.getState().setSkipCelebrations(true);
    });
    mockState.timingEnds = false;
    const states: string[] = [];
    const onDone = jest.fn();
    const evs: CelebrationEvent[] = [
      { id: 'z', kind: 'zone-captured', level: 'medium', label: 'conquistou A', payload: { zone: 'A', faction: 'owls', points: 10 } },
      { id: 'n', kind: 'level-up', level: 'epic', label: 'chegou ao nível 2', payload: { level: 2 } },
    ];
    const r = render(
      <CelebrationSequence
        testID="seq"
        events={evs}
        screenReader={false}
        onDone={onDone}
        renderMoment={(_m, ctx) => {
          states.push(ctx.state);
          return null;
        }}
      />,
    );
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['done', 'done']);
    expect(r.root.findAll((n: ReactTestInstance) => n.props.testID === 'seq-pular')).toHaveLength(0);
    expect(mockHapticCalls).toEqual(['notification:success']);
    // a tela pode forçar o roteiro mesmo com a preferência (ex.: galeria)
    const forced = render(<CelebrationSequence testID="f" events={evs} screenReader={false} skipCelebrations={false} renderMoment={() => null} />);
    expect(forced.root.findAll((n: ReactTestInstance) => n.props.testID === 'f-pular').length).toBeGreaterThan(0);
  });

  it('"Vibração" desligada: o orquestrador não vibra', () => {
    process.env.EXPO_OS = 'ios';
    act(() => {
      useMotionPrefs.getState().setHaptics(false);
    });
    render(
      <CelebrationSequence
        testID="seq"
        events={[{ id: 'n', kind: 'level-up', level: 'epic', label: 'chegou ao nível 2', payload: { level: 2 } }]}
        screenReader={false}
        renderMoment={() => null}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockHapticCalls).toEqual([]);
  });
});

describe('BoraReaction', () => {
  it('mandar: pula com mola, solta faíscas e vibra leve; tirar: silencioso; tem testID e descrição', () => {
    process.env.EXPO_OS = 'ios';
    const onPress = jest.fn();
    const make = (active: boolean) => <BoraReaction testID="feed-1-bora" active={active} count={3} onPress={onPress} />;
    const r = render(make(false));
    const btn = () => r.root.findAll((n: ReactTestInstance) => n.props.testID === 'feed-1-bora' && typeof n.props.onPress === 'function' && n.props.accessibilityLabel !== undefined)[0];
    expect(btn().props.accessibilityLabel).toBe('Mandar Bora!, 3 no total');
    expect(hostStyles(r).some((s) => s.animationName)).toBe(false);
    act(() => {
      btn().props.onPress({});
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHapticCalls).toEqual(['selection']);
    const anim = hostStyles(r).filter((s) => s.animationName);
    expect(anim.length).toBeGreaterThan(1); // pulo + faíscas
    for (const s of anim) for (const f of Object.values(s.animationName as Record<string, Record<string, unknown>>)) for (const k of Object.keys(f)) expect(['opacity', 'transform']).toContain(k);
    act(() => {
      r.update(make(true));
    });
    expect(btn().props.accessibilityLabel).toBe('Tirar Bora!, 3 no total');
    expect(btn().props.accessibilityState).toMatchObject({ selected: true });
    mockHapticCalls.length = 0;
    resetHaptics();
    act(() => {
      btn().props.onPress({});
    });
    expect(mockHapticCalls).toEqual([]);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('"Reduzir movimento": sem pulo nem faíscas, só o fade da cor', () => {
    const r = render(
      <ReducedMotionOverride reduced>
        <BoraReaction testID="b" active={false} onPress={() => {}} />
      </ReducedMotionOverride>,
    );
    act(() => {
      r.root.findAll((n: ReactTestInstance) => n.props.testID === 'b' && typeof n.props.onPress === 'function')[0].props.onPress({});
    });
    expect(hostStyles(r).some((s) => s.animationName)).toBe(false);
    expect(hostStyles(r).some((s) => s.transitionProperty === 'opacity')).toBe(true);
  });
});
