/**
 * Mocks para renderizar as primitivas e os momentos no Jest (sem o nativo do Reanimated/Worklets/SVG).
 * Usado por `jest.mock(..., () => require('.../render-mocks').reanimated)` nos testes de renderização.
 * As animações vão direto ao valor final (os callbacks de fim rodam na hora).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const React = require('react');
const RN = require('react-native');

type Shared<T> = { get: () => T; set: (v: T | ((p: T) => T)) => void; value: T };

function shared<T>(init: T): Shared<T> {
  let v = init;
  return {
    get: () => v,
    set: (n) => {
      v = typeof n === 'function' ? (n as (p: T) => T)(v) : n;
    },
    get value() {
      return v;
    },
    set value(n: T) {
      v = n;
    },
  };
}

/** Estado do mock: `reduced` simula o "Reduzir movimento" do sistema. */
export const mockState = { reduced: false };

export const reanimated = {
  __esModule: true,
  default: { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: (C: unknown) => C },
  createAnimatedComponent: (C: unknown) => C,
  useSharedValue: (init: unknown) => React.useState(() => shared(init))[0],
  useAnimatedStyle: (fn: () => object) => fn(),
  useAnimatedProps: (fn: () => object) => fn(),
  useAnimatedReaction: () => {},
  withTiming: (v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
    cb?.(true);
    return v;
  },
  withDelay: (_d: number, v: unknown) => v,
  withSequence: (...a: unknown[]) => a[a.length - 1],
  withSpring: (v: unknown) => v,
  cancelAnimation: () => {},
  useReducedMotion: () => mockState.reduced,
  cubicBezier: (...p: number[]) => ({ css: p }),
  linear: (...p: number[]) => ({ linear: p }),
  Easing: { bezier: (...p: number[]) => ({ factory: p }), bezierFn: () => (t: number) => t, linear: (t: number) => t },
};

export const worklets = { scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args) };

function svgTag(name: string) {
  const Tag = (props: object) => React.createElement(name, props);
  Tag.displayName = name;
  return Tag;
}
export const svg = { __esModule: true, default: svgTag('Svg'), Svg: svgTag('Svg'), Circle: svgTag('Circle'), Path: svgTag('Path'), Polygon: svgTag('Polygon'), Rect: svgTag('Rect'), G: svgTag('G') };

export const mockHapticCalls: string[] = [];
export const expoHaptics = {
  __esModule: true,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: { Segment_Tick: 'segment-tick', Virtual_Key: 'virtual-key', Context_Click: 'context-click', Long_Press: 'long-press', Confirm: 'confirm', Reject: 'reject' },
  selectionAsync: () => {
    mockHapticCalls.push('selection');
    return Promise.resolve();
  },
  impactAsync: (s: string) => {
    mockHapticCalls.push(`impact:${s}`);
    return Promise.resolve();
  },
  notificationAsync: (t: string) => {
    mockHapticCalls.push(`notification:${t}`);
    return Promise.resolve();
  },
  performAndroidHapticsAsync: (t: string) => {
    mockHapticCalls.push(`android:${t}`);
    return Promise.resolve();
  },
};

export const safeArea = { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
