/**
 * T7.1.14 — os momentos e o orquestrador renderizam sem erro (tocando, no estado final e com "Reduzir
 * movimento"), só animam transform e opacidade, anunciam ao leitor de tela uma vez e o "Pular" leva tudo ao
 * estado final.
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
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { mockState } from '../../motion/__tests__/render-mocks';
import { ReducedMotionOverride } from '../../motion/reduced-motion';
import { BossDefeated, BossHit } from '../boss';
import { CelebrationSequence } from '../celebration-sequence';
import { ChestOpening } from '../chest-opening';
import { renderCelebrationMoment } from '../default-moment';
import { LevelUp, PRStamp, RankShift, StreakFlame } from '../progress-moments';
import type { CelebrationEvent, ScheduledMoment } from '../queue';
import { RewardToast } from '../reward-toast';
import { TeamConfirm } from '../team-confirm';
import { ZoneCaptured } from '../zone-captured';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}

function byId(r: ReactTestRenderer, testID: string, withProp?: string): ReactTestInstance {
  const found = r.root.findAll((n: ReactTestInstance) => n.props.testID === testID && (withProp ? typeof n.props[withProp] === 'function' : typeof n.type === 'string'));
  if (found.length === 0) throw new Error(`sem ${testID}`);
  return found[0];
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

function onlyTransformAndOpacity(r: ReactTestRenderer) {
  for (const s of hostStyles(r)) {
    const kf = s.animationName as Record<string, Record<string, unknown>> | undefined;
    if (kf) for (const frame of Object.values(kf)) for (const k of Object.keys(frame)) expect(['opacity', 'transform']).toContain(k);
    if (s.transitionProperty) expect(['transform', 'opacity']).toContain(s.transitionProperty);
  }
}

/** Com "Reduzir movimento" (ou no estado final), nada desloca, escala nem gira: só opacidade. */
function onlyOpacity(r: ReactTestRenderer) {
  for (const s of hostStyles(r)) {
    const kf = s.animationName as Record<string, Record<string, unknown>> | undefined;
    if (kf) for (const frame of Object.values(kf)) expect(Object.keys(frame).filter((k) => k !== 'opacity' && !(k === 'transform' && JSON.stringify(frame.transform).match(/"scale":\d+(\.\d+)?\}\]$/)))).toEqual([]);
    expect(s.animationIterationCount).not.toBe('infinite');
  }
}

let announce: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  announce.mockRestore();
  mockState.reduced = false;
  mockState.timingEnds = true;
});

const odds = { comum: 0.7, raro: 0.25, lendario: 0.05 };

const MOMENTS: [string, (extra: object) => ReactElement][] = [
  ['RewardToast pequeno', (x) => <RewardToast testID="t" size="small" color="#f60" title="XP" value="+40 XP" {...x} />],
  ['RewardToast médio (borda)', (x) => <RewardToast testID="t" size="medium" color="#f60" title="Zona defendida" subtitle="Setor Bueno" icon={<></>} edgeGlow {...x} />],
  ['RewardToast épico', (x) => <RewardToast testID="t" size="epic" color="#f60" title="Nível 7" icon={<></>} {...x} />],
  ['ZoneCaptured (resumo)', (x) => <ZoneCaptured testID="t" context="summary" faction="owls" zone="Setor Bueno" points={120} {...x} />],
  ['ZoneCaptured (corrida)', (x) => <ZoneCaptured testID="t" context="run" faction="volt" zone="Setor Bueno" points={120} {...x} />],
  ['ChestOpening raro', (x) => <ChestOpening testID="t" rarity="raro" xp={40} odds={odds} {...x} />],
  ['ChestOpening lendário sem chances', (x) => <ChestOpening testID="t" rarity="lendario" xp={120} {...x} />],
  ['BossHit', (x) => <BossHit testID="t" bossName="Mormaço" hpFrom={1200} hpTo={1104} hpMax={3600} damageLabel="−8,4 km" mineLabel="Sua parte: 8,4 km" {...x} />],
  ['BossDefeated', (x) => <BossDefeated testID="t" bossName="Mormaço" city="Goiânia" myKm={42.3} reward={<></>} {...x} />],
  ['LevelUp', (x) => <LevelUp testID="t" level={7} title="Desbravador" reward={{ label: 'Rastro neon' }} {...x} />],
  ['StreakFlame mantida', (x) => <StreakFlame testID="t" weeks={4} status="kept" {...x} />],
  ['StreakFlame congelada', (x) => <StreakFlame testID="t" weeks={1} status="frozen" {...x} />],
  ['PRStamp', (x) => <PRStamp testID="t" metric="5 km em 24:10" {...x} />],
  ['TeamConfirm (primeira vez)', (x) => <TeamConfirm testID="t" faction="owls" leader={{ name: 'Nara Lis', quote: 'Texto provisório' }} origin={{ x: 200, y: 700 }} onContinue={() => {}} {...x} />],
  ['TeamConfirm (troca)', (x) => <TeamConfirm testID="t" faction="coyotes" variant="switch" leader={{ name: 'Bento Rocha', quote: 'Texto provisório' }} origin={{ x: 200, y: 700 }} onContinue={() => {}} {...x} />],
];

describe('momentos — renderizam e só animam transform/opacidade', () => {
  it.each(MOMENTS)('%s: tocando, anuncia 1× e chama onDone', (_name, make) => {
    const onDone = jest.fn();
    const r = render(make({ onDone }));
    expect(r.toJSON()).not.toBeNull();
    onlyTransformAndOpacity(r);
    act(() => {
      r.update(make({ onDone }));
    });
    expect(announce).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each(MOMENTS)('%s: estado final ("Pular") sem deslocamento, sem anúncio quando o orquestrador anuncia', (_name, make) => {
    const r = render(make({ state: 'done', announce: false, haptics: false }));
    expect(r.toJSON()).not.toBeNull();
    onlyOpacity(r);
    expect(announce).not.toHaveBeenCalled();
  });

  it.each(MOMENTS)('%s: "Reduzir movimento" vira fade', (_name, make) => {
    const r = render(<ReducedMotionOverride reduced>{make({ hapticsEnabled: false })}</ReducedMotionOverride>);
    onlyOpacity(r);
  });
});

describe('TeamConfirm e RankShift', () => {
  it('"Bora correr" tem testID, descrição e chama onContinue', () => {
    const onContinue = jest.fn();
    const r = render(<TeamConfirm testID="time" faction="striders" leader={{ name: 'Íris Valente', quote: 'Texto provisório' }} origin={{ x: 100, y: 600 }} onContinue={onContinue} />);
    const cta = byId(r, 'time-continuar', 'onPress');
    expect(cta.props.accessibilityLabel).toBe('Bora correr');
    act(() => {
      cta.props.onPress({});
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('RankShift: as linhas saem da ordem anterior e vão para a nova só com translateY', () => {
    const rows = [
      { id: 'a', label: 'Ana', value: '42 km', you: true },
      { id: 'b', label: 'Beto', value: '40 km' },
      { id: 'c', label: 'Caio', value: '31 km' },
    ];
    const r = render(<RankShift testID="liga" rows={rows} previousOrder={['b', 'c', 'a']} />);
    const ys = () => hostStyles(r).flatMap((s) => (Array.isArray(s.transform) ? (s.transform as Record<string, number>[]) : [])).map((t) => t.translateY);
    expect(ys()).toEqual([96, 0, 48]);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(ys()).toEqual([0, 48, 96]);
    expect(byId(r, 'liga').props.accessibilityLabel).toBe('Você está em 1º lugar');
    onlyTransformAndOpacity(r);
    const plain = render(<RankShift testID="l2" rows={rows.map((x) => ({ ...x, you: false }))} haptics={false} />);
    expect(byId(plain, 'l2').props.accessibilityLabel).toBe('Ranking atualizado');
  });
});

const EVENTS: CelebrationEvent[] = [
  { id: 'h', kind: 'boss-hit', level: 'small', label: 'causou 8,4 km de dano no chefão', payload: { boss: 'Mormaço', damageKm: 8.4, hpBefore: 1200, hpAfter: 1191.6, hpMax: 3600 } },
  { id: 'z', kind: 'zone-captured', level: 'medium', label: 'conquistou Setor Bueno', payload: { zone: 'Setor Bueno', faction: 'owls', points: 120 } },
  { id: 'c', kind: 'chest', level: 'medium', label: 'abriu um baú raro', payload: { rarity: 'raro', xp: 40, odds } },
  { id: 'n', kind: 'level-up', level: 'epic', label: 'chegou ao nível 7', payload: { level: 7, title: 'Desbravador' } },
];

describe('CelebrationSequence', () => {
  it('"Pular" leva tudo ao estado final de uma vez e avisa o fim', () => {
    mockState.timingEnds = false; // o roteiro ainda está tocando
    const onDone = jest.fn();
    const seen: { id: string; state: string }[] = [];
    const renderMoment = (m: ScheduledMoment, ctx: { state: string }) => {
      seen.push({ id: m.id, state: ctx.state });
      return null;
    };
    const r = render(<CelebrationSequence testID="resumo" events={EVENTS} renderMoment={renderMoment} onDone={onDone} screenReader={false} />);
    const pular = byId(r, 'resumo-pular', 'onPress');
    expect(pular.props.accessibilityLabel).toBe('Pular celebrações');
    expect(onDone).not.toHaveBeenCalled();
    // tocar na área adianta (não termina: ainda há passos)
    act(() => {
      byId(r, 'resumo-avancar', 'onPress').props.onPress({});
    });
    expect(onDone).not.toHaveBeenCalled();
    seen.length = 0;
    act(() => {
      pular.props.onPress({});
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    const last = new Map(seen.map((s) => [s.id, s.state]));
    expect([...last.keys()].sort()).toEqual(['c', 'h', 'n', 'z']);
    expect([...last.values()].every((s) => s === 'done')).toBe(true);
    // o botão some depois de pular
    expect(r.root.findAll((n: ReactTestInstance) => n.props.testID === 'resumo-pular')).toHaveLength(0);
  });

  it('leitor de tela: tudo no estado final, sem "Pular" e um único anúncio', () => {
    const onDone = jest.fn();
    const r = render(
      <CelebrationSequence testID="resumo" events={EVENTS} intro="Corrida concluída." renderMoment={renderCelebrationMoment()} onDone={onDone} screenReader />,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Corrida concluída. Você causou 8,4 km de dano no chefão, conquistou Setor Bueno, abriu um baú raro e chegou ao nível 7.');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(r.root.findAll((n: ReactTestInstance) => n.props.testID === 'resumo-pular')).toHaveLength(0);
    act(() => {
      r.update(<CelebrationSequence testID="resumo" events={EVENTS} intro="Corrida concluída." renderMoment={renderCelebrationMoment()} onDone={onDone} screenReader />);
    });
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('o relógio chega ao fim e avisa onDone; tocar na área adianta; sem eventos termina na hora', () => {
    const onDone = jest.fn();
    const r = render(<CelebrationSequence testID="seq" events={EVENTS} renderMoment={renderCelebrationMoment()} onDone={onDone} screenReader={false} layout="single" />);
    // no mock, o withTiming termina na hora: o fim é avisado uma vez
    expect(onDone).toHaveBeenCalledTimes(1);
    const area = byId(r, 'seq-avancar', 'onPress');
    expect(area.props.accessibilityLabel).toBe('Avançar celebração');
    const empty = jest.fn();
    render(<CelebrationSequence testID="vazio" events={[]} renderMoment={() => null} onDone={empty} screenReader={false} />);
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it('galeria /dev/motion: cada momento e cada ajuste tocam sem erro', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Gallery = require('@/app/dev/motion').default as () => ReactElement;
    const r = render(<Gallery />);
    const chips = r.root.findAll((n: ReactTestInstance) => typeof n.props.testID === 'string' && n.props.testID.startsWith('galeria-motion-') && typeof n.props.onPress === 'function' && !n.props.testID.startsWith('galeria-motion-vibrar'));
    const ids = [...new Set(chips.map((c: ReactTestInstance) => c.props.testID as string))];
    expect(ids).toEqual(expect.arrayContaining(['galeria-motion-bau', 'galeria-motion-time', 'galeria-motion-resumo', 'galeria-motion-reduzido-sim']));
    for (const id of ids) {
      act(() => {
        byId(r, id, 'onPress').props.onPress({});
      });
      act(() => {
        jest.advanceTimersByTime(3000);
      });
    }
    expect(r.toJSON()).not.toBeNull();
  });

  it('desenho padrão cobre todos os tipos, inclusive o grupo', () => {
    const all: CelebrationEvent[] = [
      ...EVENTS,
      { id: 'd', kind: 'boss-defeated', level: 'epic', label: 'derrotou o chefão', payload: { boss: 'Mormaço', city: 'Goiânia', myKm: 42 } },
      { id: 'zd', kind: 'zone-defended', level: 'small', label: 'defendeu A', payload: { zone: 'A', faction: 'volt' } },
      { id: 'zm', kind: 'zone-milestone', level: 'small', label: 'pintou metade de A', payload: { zone: 'A', fraction: 0.5 } },
      { id: 'x', kind: 'xp', level: 'small', label: 'ganhou 215 XP', payload: { gained: 215, from: 0.7, to: 1 } },
      { id: 's', kind: 'streak', level: 'small', label: 'manteve a sequência', payload: { weeks: 3, state: 'kept' } },
      { id: 'p', kind: 'personal-record', level: 'medium', label: 'bateu um recorde', payload: { metric: '5 km', value: '24:10' } },
      { id: 'mi', kind: 'mission', level: 'small', label: 'concluiu uma missão', payload: { title: 'Correr 3 km', xp: 30 } },
      { id: 'me', kind: 'medal', level: 'medium', label: 'ganhou uma medalha', payload: { name: 'Madrugador' } },
      { id: 'l', kind: 'league-up', level: 'medium', label: 'subiu na liga', payload: { position: 3, previous: 7 } },
      { id: 't', kind: 'team-confirm', level: 'epic', label: 'entrou para os Night Owls', payload: { faction: 'owls' } },
    ];
    const r = render(<CelebrationSequence testID="tudo" events={all} renderMoment={renderCelebrationMoment()} screenReader />);
    expect(r.toJSON()).not.toBeNull();
    // o grupo também tem desenho
    expect(r.root.findAll((n: ReactTestInstance) => typeof n.props.testID === 'string' && n.props.testID.startsWith('tudo-group-')).length).toBeGreaterThan(0);
  });
});
