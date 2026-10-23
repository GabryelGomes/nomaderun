/**
 * Ajudantes de renderização dos testes de componente (T7.1.17). Usa o `react-test-renderer` que já vem com o
 * `jest-expo` (nenhuma biblioteca nova). Cada arquivo de teste ainda precisa dos `jest.mock` do Reanimated e do
 * Worklets no topo (o Jest só iça `jest.mock` do próprio arquivo); copie o bloco de `components-base.test.tsx`.
 */
import type { ReactElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type Rendered = {
  renderer: ReactTestRenderer;
  /** Nós (de componente ou nativos) com o testID. */
  all: (testID: string) => ReactTestInstance[];
  /** O nó nativo (`View`/`Text`) com o testID: é o que o Maestro e o leitor de tela enxergam. */
  host: (testID: string) => ReactTestInstance;
  has: (testID: string) => boolean;
  /** Dispara o `onPress` do elemento com o testID. */
  press: (testID: string) => void;
  /** Todo o texto visível, numa linha. */
  text: () => string;
};

function collectText(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  const n = node as { children?: unknown };
  return collectText(n.children ?? null);
}

export function render(element: ReactElement): Rendered {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  const all = (id: string) => renderer.root.findAll((n) => n.props.testID === id);
  const host = (id: string) => {
    const found = all(id).filter((n) => typeof n.type === 'string');
    if (found.length === 0) throw new Error(`sem nó nativo com testID "${id}"`);
    return found[0];
  };
  return {
    renderer,
    all,
    host,
    has: (id) => all(id).length > 0,
    press: (id) => {
      const target = all(id).find((n) => typeof n.props.onPress === 'function');
      if (!target) throw new Error(`nada tocável com testID "${id}"`);
      act(() => {
        target.props.onPress({});
      });
    },
    text: () => collectText(renderer.toJSON()).join(' ').replace(/\s+/g, ' ').trim(),
  };
}
