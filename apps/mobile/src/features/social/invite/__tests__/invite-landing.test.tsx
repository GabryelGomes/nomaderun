/**
 * C2 (achado da C3): `/compartilhar/convite/%25zz` chegava como `%zz` e o `decodeURIComponent` derrubava a página
 * (URIError, tela em branco). Agora vira "Convite inválido".
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
jest.mock('expo-haptics', () => require('@/components/motion/__tests__/render-mocks').expoHaptics);
jest.mock('react-native-safe-area-context', () => require('@/components/motion/__tests__/render-mocks').safeArea);
/* eslint-enable @typescript-eslint/no-require-imports */
let mockCode = '%zz';
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({ codigo: mockCode }) }));

/* eslint-disable import/first */
import { render } from '@/components/__tests__/render-helpers';

import { InviteLanding } from '../invite-landing';
/* eslint-enable import/first */

describe('página do convite', () => {
  it('escape quebrado: "Convite inválido", sem quebrar', () => {
    mockCode = '%zz';
    const r = render(<InviteLanding />);
    expect(r.text()).toContain('Convite inválido');
    expect(r.has('convite-copiar')).toBe(false);
    expect(r.has('convite-abrir')).toBe(true);
  });

  it('código bom continua funcionando', () => {
    mockCode = 'demoflr1';
    const r = render(<InviteLanding />);
    expect(r.text()).toContain('DEMOFLR1');
    expect(r.has('convite-copiar')).toBe(true);
  });
});
