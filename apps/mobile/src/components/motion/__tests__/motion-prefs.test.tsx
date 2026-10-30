/**
 * T7.2.9 — preferências "Vibração" e "Pular celebrações" (`store/motion-prefs-store.ts`), o `haptic()` que
 * as respeita e o `usePausedWhenHidden` (app no fundo / tela fora de foco).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type ReactElement } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('expo-haptics', () => require('./render-mocks').expoHaptics);
jest.mock('react-native-reanimated', () => require('./render-mocks').reanimated);
jest.mock('react-native-svg', () => require('./render-mocks').svg);
jest.mock('@/components/motion/prefs-storage', () => {
  const saved = new Map<string, string>();
  return {
    saved,
    readMotionPrefsRaw: async (k: string) => saved.get(k) ?? null,
    writeMotionPrefsRaw: async (k: string, v: string) => {
      saved.set(k, v);
    },
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { NavigationContext } from 'expo-router/react-navigation';

import { getMotionPrefs, MOTION_PREFS_DEFAULTS, MOTION_PREFS_KEY, parseMotionPrefs, serializeMotionPrefs, useMotionPrefs } from '@/store/motion-prefs-store';

import { haptic, resetHaptics } from '../haptics';
import { isHidden, usePausedWhenHidden } from '../use-paused-when-hidden';
import { mockHapticCalls } from './render-mocks';
/* eslint-enable import/first */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockSaved = (require('@/components/motion/prefs-storage') as { saved: Map<string, string> }).saved;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(el);
  });
  return r!;
}

beforeEach(() => {
  mockHapticCalls.length = 0;
  resetHaptics();
});
afterEach(() => {
  act(() => {
    useMotionPrefs.getState().reset();
  });
});

describe('preferências de motion', () => {
  it('padrão: vibração ligada e celebrações tocando', () => {
    expect(MOTION_PREFS_DEFAULTS).toEqual({ haptics: true, skipCelebrations: false });
    expect(getMotionPrefs()).toEqual({ haptics: true, skipCelebrations: false });
  });

  it('parseMotionPrefs aceita só booleanos conhecidos e nunca lança', () => {
    expect(parseMotionPrefs(null)).toEqual({});
    expect(parseMotionPrefs('')).toEqual({});
    expect(parseMotionPrefs('não é json')).toEqual({});
    expect(parseMotionPrefs('42')).toEqual({});
    expect(parseMotionPrefs('{"haptics":"sim","skipCelebrations":1,"x":true}')).toEqual({});
    expect(parseMotionPrefs('{"haptics":false}')).toEqual({ haptics: false });
    expect(parseMotionPrefs(serializeMotionPrefs({ haptics: false, skipCelebrations: true }))).toEqual({ haptics: false, skipCelebrations: true });
  });

  it('mudar grava no aparelho e a leitura devolve o que foi salvo', async () => {
    act(() => {
      useMotionPrefs.getState().setHaptics(false);
      useMotionPrefs.getState().setSkipCelebrations(true);
    });
    expect(getMotionPrefs()).toEqual({ haptics: false, skipCelebrations: true });
    await Promise.resolve();
    expect(parseMotionPrefs(mockSaved.get(MOTION_PREFS_KEY))).toEqual({ haptics: false, skipCelebrations: true });
  });

  it('ao abrir o app, lê o valor salvo sozinho', async () => {
    mockSaved.set(MOTION_PREFS_KEY, serializeMotionPrefs({ haptics: false, skipCelebrations: true }));
    let fresh: typeof import('@/store/motion-prefs-store') | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = require('@/store/motion-prefs-store');
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(fresh!.getMotionPrefs()).toEqual({ haptics: false, skipCelebrations: true });
    expect(fresh!.useMotionPrefs.getState().hydrated).toBe(true);
    mockSaved.delete(MOTION_PREFS_KEY);
  });

  it('a leitura do salvo não passa por cima de uma escolha feita antes dela terminar', async () => {
    mockSaved.set(MOTION_PREFS_KEY, serializeMotionPrefs({ haptics: false, skipCelebrations: true }));
    act(() => {
      useMotionPrefs.getState().setHaptics(true);
    });
    await act(async () => {
      await useMotionPrefs.getState().hydrate();
    });
    expect(useMotionPrefs.getState().haptics).toBe(true);
    expect(useMotionPrefs.getState().hydrated).toBe(true);
  });

  it('haptic() respeita a "Vibração" salva, exceto alerta de segurança (force)', () => {
    haptic('impact', { os: 'ios' });
    expect(mockHapticCalls).toEqual(['impact:medium']);
    act(() => {
      useMotionPrefs.getState().setHaptics(false);
    });
    resetHaptics();
    haptic('success', { os: 'ios' });
    haptic('heavy', { os: 'android' });
    expect(mockHapticCalls).toEqual(['impact:medium']);
    haptic('warning', { os: 'ios', force: true });
    expect(mockHapticCalls).toEqual(['impact:medium', 'notification:warning']);
    // a preferência ligada não liga uma chamada que pediu desligado
    act(() => {
      useMotionPrefs.getState().setHaptics(true);
    });
    resetHaptics();
    haptic('tap', { os: 'ios', enabled: false });
    expect(mockHapticCalls).toEqual(['impact:medium', 'notification:warning']);
  });
});

describe('usePausedWhenHidden', () => {
  it('isHidden: fundo/inativo, fora de foco ou pedido pela tela', () => {
    expect(isHidden('active', true)).toBe(false);
    expect(isHidden('unknown', true)).toBe(false);
    expect(isHidden('background', true)).toBe(true);
    expect(isHidden('inactive', true)).toBe(true);
    expect(isHidden('active', false)).toBe(true);
    expect(isHidden('active', true, true)).toBe(true);
    expect(isHidden(null, true)).toBe(false);
  });

  it('pausa com o app no fundo e com a tela fora de foco; sem navegação, conta como focada', () => {
    let appListener: ((s: AppStateStatus) => void) | null = null;
    let current: AppStateStatus = 'active';
    const spyAdd = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      appListener = fn as (s: AppStateStatus) => void;
      return { remove: () => (appListener = null) } as ReturnType<typeof AppState.addEventListener>;
    });
    const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => current });

    const seen: boolean[] = [];
    function Probe({ paused }: { paused?: boolean }) {
      seen.push(usePausedWhenHidden({ paused }));
      return null;
    }
    const r = render(<Probe />);
    expect(seen.at(-1)).toBe(false);
    act(() => {
      current = 'background';
      appListener?.('background');
    });
    expect(seen.at(-1)).toBe(true);
    act(() => {
      current = 'active';
      appListener?.('active');
    });
    expect(seen.at(-1)).toBe(false);
    act(() => {
      r.update(<Probe paused />);
    });
    expect(seen.at(-1)).toBe(true);

    // com navegação: blur pausa, focus volta
    const listeners: Record<string, (() => void)[]> = { focus: [], blur: [] };
    let focused = true;
    const nav = {
      isFocused: () => focused,
      addListener: (type: 'focus' | 'blur', fn: () => void) => {
        listeners[type].push(fn);
        return () => (listeners[type] = listeners[type].filter((f) => f !== fn));
      },
    };
    const withNav = (
      <NavigationContext.Provider value={nav as never}>
        <Probe />
      </NavigationContext.Provider>
    );
    const r2 = render(withNav);
    expect(seen.at(-1)).toBe(false);
    act(() => {
      focused = false;
      listeners.blur.forEach((f) => f());
    });
    expect(seen.at(-1)).toBe(true);
    act(() => {
      focused = true;
      listeners.focus.forEach((f) => f());
    });
    expect(seen.at(-1)).toBe(false);
    act(() => {
      r2.unmount();
      r.unmount();
    });
    expect(listeners.focus).toHaveLength(0);
    expect(appListener).toBeNull();
    spyAdd.mockRestore();
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });
});
