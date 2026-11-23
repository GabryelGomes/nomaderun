import { describe, expect, it } from '@jest/globals';

import { DEFAULT_SCENARIO, rememberSignedIn, tabScenario } from '../scenario';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('roteiro da demonstração sobrevive a recarregar a aba (5ª bateria)', () => {
  it('a URL vale e fica guardada; recarregar sem ?cenario= mantém o roteiro', () => {
    const s = memory();
    expect(tabScenario('?cenario=primeira-abertura', s)).toBe('primeira-abertura');
    expect(tabScenario('', s)).toBe('primeira-abertura');
    expect(tabScenario('?origem=times', s)).toBe('primeira-abertura');
  });

  it('um ?cenario= novo troca o guardado', () => {
    const s = memory();
    tabScenario('?cenario=offline', s);
    expect(tabScenario('?cenario=cheio', s)).toBe('cheio');
    expect(tabScenario('', s)).toBe('cheio');
  });

  it('valor desconhecido ou sem armazenamento: padrão', () => {
    expect(tabScenario('?cenario=xyz', memory())).toBe(DEFAULT_SCENARIO);
    expect(tabScenario('', null)).toBe(DEFAULT_SCENARIO);
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(tabScenario('?cenario=vazio', broken)).toBe('vazio');
    expect(tabScenario('', broken)).toBe(DEFAULT_SCENARIO);
  });

  it('depois de entrar na primeira abertura, recarregar volta logado (roteiro padrão); os outros roteiros ficam', () => {
    const s = memory();
    tabScenario('?cenario=primeira-abertura', s);
    rememberSignedIn(s);
    expect(tabScenario('', s)).toBe(DEFAULT_SCENARIO);
    tabScenario('?cenario=moderador', s);
    rememberSignedIn(s);
    expect(tabScenario('', s)).toBe('moderador');
  });
});
