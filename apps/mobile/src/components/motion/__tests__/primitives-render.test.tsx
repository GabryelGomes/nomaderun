/**
 * T7.1.13 — as primitivas renderizam sem erro (normal e com "Reduzir movimento"), só animam transform e
 * opacidade, e expõem acessibilidade (valor final no CountUp, progresso nas barras).
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('./render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('./render-mocks').worklets);
jest.mock('react-native-svg', () => require('./render-mocks').svg);
jest.mock('expo-haptics', () => require('./render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('./render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { Burst } from '../burst';
import { Confetti } from '../confetti';
import { CountUp, CountUpWeb } from '../count-up';
import { Flash } from '../flash';
import { FloatingNumber } from '../floating-number';
import { PressableScale } from '../pressable';
import { ProgressBar } from '../progress-bar';
import { ProgressRing } from '../progress-ring';
import { ReducedMotionOverride } from '../reduced-motion';
import { Shake } from '../shake';
import { ShimmerSkeleton } from '../shimmer-skeleton';
import { SpinRays } from '../spin-rays';
import { mockHapticCalls, mockState } from './render-mocks';
/* eslint-enable import/first */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(el: React.ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}

/** O elemento nativo (host) com o testID, ou o que tem o handler pedido. */
function byId(r: ReactTestRenderer, testID: string, withProp?: string): ReactTestInstance {
  const found = r.root.findAll((n: ReactTestInstance) => n.props.testID === testID && (withProp ? typeof n.props[withProp] === 'function' : typeof n.type === 'string'));
  if (found.length === 0) throw new Error(`sem ${testID}`);
  return found[0];
}

/** Junta todos os estilos (achatados) da árvore renderizada. */
function styles(r: ReactTestRenderer): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const flat = (s: unknown) => {
    if (Array.isArray(s)) s.forEach(flat);
    else if (s && typeof s === 'object') out.push(s as Record<string, unknown>);
  };
  r.root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && n.props.style !== undefined).forEach((n: ReactTestInstance) => flat(n.props.style));
  return out;
}

const LAYOUT = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding'];
/** Nenhuma animação/transição CSS mexe em layout: só transform e opacidade. */
function onlyTransformAndOpacity(r: ReactTestRenderer) {
  for (const s of styles(r)) {
    const kf = s.animationName as Record<string, Record<string, unknown>> | undefined;
    if (kf) for (const frame of Object.values(kf)) for (const k of Object.keys(frame)) expect(['opacity', 'transform']).toContain(k);
    const tp = s.transitionProperty;
    if (tp) for (const k of Array.isArray(tp) ? tp : [tp]) expect(LAYOUT).not.toContain(k);
  }
}

afterEach(() => {
  mockState.reduced = false;
  mockHapticCalls.length = 0;
});

describe('partículas e efeitos', () => {
  it('Confetti: 60 no máximo; nada com movimento reduzido; onEnd é chamado', () => {
    jest.useFakeTimers();
    const onEnd = jest.fn();
    const r = render(<Confetti count={200} colors={['#f00', '#0f0']} seed={4} onEnd={onEnd} testID="confete" />);
    const particles = styles(r).filter((s) => s.animationName && s.backgroundColor);
    expect(particles).toHaveLength(60);
    onlyTransformAndOpacity(r);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
    const reduced = render(
      <ReducedMotionOverride reduced>
        <Confetti count={24} colors={['#f00']} />
      </ReducedMotionOverride>,
    );
    expect(reduced.toJSON()).toBeNull();
    jest.useRealTimers();
  });

  it('Burst, Flash, FloatingNumber, SpinRays, Shake: renderizam e só animam transform/opacidade', () => {
    const r = render(
      <>
        <Burst color="#fff" count={10} />
        <Burst color="#fff" count={0} />
        <Flash kind="radial" />
        <Flash kind="screen" />
        <Flash kind="edge" color="#f00" />
        <FloatingNumber text="−8,4 km" />
        <SpinRays color="#fa0" size={200} paused />
        <Shake trigger={1} axis="rotate" origin="bottom">
          <></>
        </Shake>
        <Shake trigger={0}>
          <></>
        </Shake>
      </>,
    );
    expect(r.toJSON()).not.toBeNull();
    onlyTransformAndOpacity(r);
    const spin = styles(r).find((s) => s.animationIterationCount === 'infinite');
    expect(spin?.animationPlayState).toBe('paused');
  });

  it('movimento reduzido: sem faíscas, sem clarão (a borda vira fade), número só com opacidade, raios parados', () => {
    mockState.reduced = true;
    const r = render(
      <>
        <Burst color="#fff" />
        <Flash kind="radial" />
        <Flash kind="edge" />
        <FloatingNumber text="+40" />
        <SpinRays color="#fa0" size={100} />
        <Shake trigger={3}>
          <></>
        </Shake>
      </>,
    );
    const anim = styles(r).filter((s) => s.animationName);
    for (const s of anim) for (const frame of Object.values(s.animationName as Record<string, object>)) expect(Object.keys(frame)).toEqual(['opacity']);
    expect(styles(r).some((s) => s.animationIterationCount === 'infinite')).toBe(false);
  });
});

describe('CountUp — mesma API, valor final para o leitor de tela', () => {
  it('lê o valor final com a unidade; o número animado fica escondido do leitor', () => {
    const r = render(<CountUp value={1250} unit="pontos" testID="pontos" />);
    const shell = byId(r, 'pontos');
    expect(shell.props.accessibilityLabel).toBe('1.250 pontos');
    const input = byId(r, 'pontos-valor');
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityElementsHidden).toBe(true);
    // o mock leva a contagem ao fim: o texto da UI já é o valor final
    expect(input.props.animatedProps.text).toBe('1.250');
  });

  it('formatação própria, casas decimais, rótulo próprio e movimento reduzido', () => {
    const r = render(<CountUp value={5.24} decimals={2} format={(n) => `${n.toFixed(2)} km`} accessibilityLabel="5,24 quilômetros" testID="km" />);
    expect(byId(r, 'km').props.accessibilityLabel).toBe('5,24 quilômetros');
    mockState.reduced = true;
    const still = render(<CountUp value={42} testID="sem" />);
    expect(byId(still, 'sem-valor').props.animatedProps.text).toBe('42');
    act(() => {
      still.update(<CountUp value={43} testID="sem" />);
    });
    expect(byId(still, 'sem-valor').props.animatedProps.text).toBe('43');
  });

  it('valor novo conta a partir do que está na tela', () => {
    const r = render(<CountUp value={10} testID="c" duration={160} />);
    act(() => {
      r.update(<CountUp value={20} testID="c" duration={160} />);
    });
    const props = byId(r, 'c-valor').props;
    expect(props.defaultValue).toBe('20');
  });

  it('na web usa a versão com requestAnimationFrame (mesma API)', () => {
    jest.useFakeTimers();
    try {
      const r = render(<CountUpWeb value={300} unit="m" testID="web" />);
      expect(byId(r, 'web').props.accessibilityLabel).toBe('300 m');
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      act(() => {
        r.update(<CountUpWeb value={300} unit="m" testID="web" />);
      });
      mockState.reduced = true;
      act(() => {
        r.update(<CountUpWeb value={301} unit="m" testID="web" />);
      });
      expect(byId(r, 'web').props.accessibilityLabel).toBe('301 m');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('barras e anéis — só transform', () => {
  it('ProgressBar: scaleX a partir da esquerda, fantasma, segmentos, marcos e progresso acessível', () => {
    const onMilestone = jest.fn();
    const r = render(<ProgressBar value={0.8} color="#f60" segments={10} milestones={[0.25, 0.5, 0.75]} onMilestone={onMilestone} glow accessibilityLabel="Zona 80%" testID="barra" />);
    const bar = byId(r, 'barra');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 80 });
    const fills = styles(r).filter((s) => Array.isArray(s.transform) && (s.transform as object[]).some((t) => 'scaleX' in t));
    expect(fills).toHaveLength(2);
    expect(onMilestone.mock.calls.map((c) => c[0])).toEqual([0.25, 0.5, 0.75]);
    // descendo: sem marcos
    act(() => {
      r.update(<ProgressBar value={0.3} from={0.8} color="#f60" ghost={false} milestones={[0.5]} onMilestone={onMilestone} accessibilityLabel="Zona 30%" testID="barra" />);
    });
    expect(onMilestone).toHaveBeenCalledTimes(3);
    // movimento reduzido: vai direto ao valor; ao subir, os marcos avisam na hora
    mockState.reduced = true;
    const still = render(<ProgressBar value={0.2} color="#f60" milestones={[0.5]} onMilestone={onMilestone} accessibilityLabel="x" />);
    expect(onMilestone).toHaveBeenCalledTimes(3);
    act(() => {
      still.update(<ProgressBar value={0.6} color="#f60" milestones={[0.5]} onMilestone={onMilestone} accessibilityLabel="x" />);
    });
    expect(onMilestone).toHaveBeenCalledTimes(4);
  });

  it('ProgressRing: duas metades giram (rotate), pulso nos marcos, cortes de giz e conteúdo no centro', () => {
    const onMilestone = jest.fn();
    const r = render(
      <ProgressRing value={0.75} size={120} color="#0af" segments={6} pulseAt={[0.25, 0.5]} onMilestone={onMilestone} accessibilityLabel="Zona 75%" testID="anel">
        <></>
      </ProgressRing>,
    );
    // os estilos animados são lidos na renderização: re-renderiza depois do efeito
    act(() => {
      r.update(
        <ProgressRing value={0.75} size={120} color="#0af" segments={6} pulseAt={[0.25, 0.5]} onMilestone={onMilestone} accessibilityLabel="Zona 75%" testID="anel">
          <></>
        </ProgressRing>,
      );
    });
    const rotations = styles(r)
      .flatMap((s) => (Array.isArray(s.transform) ? (s.transform as Record<string, unknown>[]) : []))
      .filter((t) => 'rotate' in t)
      .map((t) => t.rotate);
    expect(rotations).toEqual(expect.arrayContaining(['180deg', '90deg']));
    expect(onMilestone.mock.calls.map((c) => c[0])).toEqual([0.25, 0.5]);
    expect(byId(r, 'anel').props.accessibilityValue.now).toBe(75);
    mockState.reduced = true;
    const still = render(<ProgressRing value={0.5} size={60} color="#0af" pulseAt={[1]} onMilestone={onMilestone} accessibilityLabel="x" />);
    expect(onMilestone).toHaveBeenCalledTimes(2);
    act(() => {
      still.update(<ProgressRing value={1} size={60} color="#0af" pulseAt={[1]} onMilestone={onMilestone} accessibilityLabel="x" />);
    });
    expect(onMilestone).toHaveBeenLastCalledWith(1);
  });
});

describe('ShimmerSkeleton e PressableScale', () => {
  it('esqueleto nas 4 formas, com "Carregando" para o leitor de tela; reduzido pulsa só a opacidade', () => {
    for (const shape of ['line', 'card', 'circle', 'row'] as const) {
      const r = render(<ShimmerSkeleton shape={shape} lines={3} testID={`esq-${shape}`} />);
      const root = byId(r, `esq-${shape}`);
      expect(root.props.accessibilityLabel).toBe('Carregando');
      expect(root.props.accessibilityState).toEqual({ busy: true });
      // mede a largura: a faixa de brilho aparece
      act(() => {
        r.root.findAll((n: ReactTestInstance) => typeof n.props.onLayout === 'function').forEach((n: ReactTestInstance) => n.props.onLayout({ nativeEvent: { layout: { width: 200, height: 14 } } }));
      });
      onlyTransformAndOpacity(r);
    }
    mockState.reduced = true;
    const r = render(<ShimmerSkeleton shape="line" />);
    const pulse = styles(r).find((s) => s.animationDirection === 'alternate');
    expect(pulse?.animationName).toEqual({ from: { opacity: 0.5 }, to: { opacity: 0.8 } });
  });

  it('PressableScale: vibra com o padrão pedido (respeitando a preferência), brilho e escala própria', () => {
    const prev = process.env.EXPO_OS;
    process.env.EXPO_OS = 'ios';
    try {
      const onPress = jest.fn();
      const r = render(
        <PressableScale testID="cta" accessibilityLabel="Começar" haptic="success" glow scale={0.94} onPress={onPress} style={{ borderRadius: 12 }}>
          <></>
        </PressableScale>,
      );
      const target = byId(r, 'cta', 'onPressIn');
      act(() => {
        target.props.onPressIn({});
      });
      expect(styles(r).some((s) => JSON.stringify(s.transform) === JSON.stringify([{ scale: 0.94 }]))).toBe(true);
      act(() => {
        target.props.onPress({});
        target.props.onPressOut({});
      });
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(mockHapticCalls).toEqual(['notification:success']);
      const glow = styles(r).find((s) => typeof s.boxShadow === 'string' && s.transitionProperty === 'opacity');
      expect(glow).toBeDefined();
      mockHapticCalls.length = 0;
      const off = render(
        <PressableScale testID="b" accessibilityLabel="b" haptic hapticsEnabled={false} glowColor="#0af" glow>
          <></>
        </PressableScale>,
      );
      act(() => {
        byId(off, 'b', 'onPress').props.onPress({});
      });
      expect(mockHapticCalls).toEqual([]);
    } finally {
      process.env.EXPO_OS = prev;
    }
  });
});
