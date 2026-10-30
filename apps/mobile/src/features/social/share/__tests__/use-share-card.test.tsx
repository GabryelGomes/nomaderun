/**
 * `useShareCard` no nativo: `toDataURL` → `File(Paths.cache).write(base64, { encoding: 'base64' })` →
 * `Sharing.shareAsync`. Estados de erro com prazo, imagem vazia e aparelho sem menu.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Platform, Share } from 'react-native';
import type Svg from 'react-native-svg';

type AnyFn = (...args: any[]) => any;
const mockWrites: { name: string; content: string; opts: unknown }[] = [];
const mockShareAsync = jest.fn<AnyFn>(() => Promise.resolve());
const mockAvailable = jest.fn<AnyFn>(() => Promise.resolve(true));

jest.mock('expo-file-system', () => {
  class File {
    name: string;
    exists = false;
    constructor(_dir: unknown, name: string) {
      this.name = name;
    }
    get uri() {
      return `file:///cache/${this.name}`;
    }
    delete() {}
    create() {}
    write(content: string, opts?: unknown) {
      mockWrites.push({ name: this.name, content, opts });
    }
  }
  return { File, Paths: { cache: '/cache' } };
});
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockAvailable(), shareAsync: (...a: unknown[]) => mockShareAsync(...a) }));

/* eslint-disable import/first */
import { shareTextFile } from '../share-image';
import { useShareCard, type UseShareCard } from '../use-share-card';
/* eslint-enable import/first */

const PNG = 'iVBORw0KGgo'.padEnd(400, 'A');

function svgThat(reply: ((cb: (d: string) => void, opts?: object) => void) | null) {
  return { toDataURL: jest.fn((cb: (d: string) => void, opts?: object) => reply?.(cb, opts)) } as unknown as Svg & { toDataURL: jest.Mock };
}

function mount(onShared?: AnyFn, deadlineMs?: number) {
  const ref: { current: UseShareCard | null } = { current: null };
  function Probe() {
    ref.current = useShareCard({ onShared, deadlineMs });
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return ref;
}

beforeEach(() => {
  mockWrites.length = 0;
  jest.clearAllMocks();
  mockAvailable.mockImplementation(() => Promise.resolve(true));
});

describe('useShareCard (nativo)', () => {
  it('gera o PNG, grava no cache em base64 e abre o menu do sistema', async () => {
    const onShared = jest.fn();
    const hook = mount(onShared);
    const svg = svgThat((cb) => cb(PNG));
    await act(async () => {
      await hook.current!.shareImage(svg, 'stories');
    });
    // iOS (padrão do jest-expo): sem opções de tamanho (a cópia escondida já tem 1080 px).
    expect((svg as unknown as { toDataURL: jest.Mock }).toDataURL.mock.calls[0][1]).toBeUndefined();
    expect(mockWrites).toEqual([{ name: 'nomade-stories.png', content: PNG, opts: { encoding: 'base64' } }]);
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/nomade-stories.png', { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar corrida' });
    expect(hook.current!.state).toEqual({ kind: 'done', outcome: 'shared' });
    expect(onShared).toHaveBeenCalledWith('shared', 'stories');
  });

  it('no Android passa {width, height} do formato', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      const hook = mount();
      const svg = svgThat((cb) => cb(PNG));
      await act(async () => {
        await hook.current!.shareImage(svg, 'feed');
      });
      expect((svg as unknown as { toDataURL: jest.Mock }).toDataURL.mock.calls[0][1]).toEqual({ width: 1080, height: 1350 });
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('imagem vazia (iOS) → erro "empty"; nada é gravado nem compartilhado', async () => {
    const hook = mount();
    await act(async () => {
      await hook.current!.shareImage(svgThat((cb) => cb('')), 'stories');
    });
    expect(hook.current!.state).toEqual({ kind: 'error', reason: 'empty' });
    expect(mockWrites).toHaveLength(0);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('sem resposta dentro do prazo → erro "timeout"', async () => {
    const hook = mount(undefined, 30);
    await act(async () => {
      await hook.current!.shareImage(svgThat(null), 'stories');
    });
    expect(hook.current!.state).toEqual({ kind: 'error', reason: 'timeout' });
  });

  it('sem o `<Svg>` de exportação → erro; aparelho sem menu → "unavailable"', async () => {
    const hook = mount();
    await act(async () => {
      await hook.current!.shareImage(null, 'stories');
    });
    expect(hook.current!.state).toEqual({ kind: 'error', reason: 'empty' });
    mockAvailable.mockImplementation(() => Promise.resolve(false));
    await act(async () => {
      await hook.current!.shareImage(svgThat((cb) => cb(PNG)), 'sticker');
    });
    expect(hook.current!.state).toEqual({ kind: 'error', reason: 'unavailable' });
  });

  it('toque duplo enquanto gera: só uma imagem', async () => {
    const hook = mount();
    let reply: ((d: string) => void) | null = null;
    const svg = svgThat((cb) => (reply = cb));
    await act(async () => {
      const a = hook.current!.shareImage(svg, 'stories');
      const b = hook.current!.shareImage(svg, 'stories');
      reply!(PNG);
      await Promise.all([a, b]);
    });
    expect((svg as unknown as { toDataURL: jest.Mock }).toDataURL).toHaveBeenCalledTimes(1);
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
  });

  it('"Compartilhar só o texto" usa o Share do sistema', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const hook = mount();
    await act(async () => {
      await hook.current!.shareText('Corri 2,02 km no NOMADE RUN.');
    });
    expect(spy).toHaveBeenCalledWith({ message: 'Corri 2,02 km no NOMADE RUN.' });
    expect(hook.current!.state).toEqual({ kind: 'done', outcome: 'shared' });
    spy.mockRestore();
  });

  it('arquivo de texto (GPX) vai em utf8 com o tipo certo', async () => {
    await shareTextFile({ content: '<gpx/>', fileName: 'nomade-x.gpx', mimeType: 'application/gpx+xml', uti: 'com.topografix.gpx', title: 'Exportar GPX' });
    expect(mockWrites).toEqual([{ name: 'nomade-x.gpx', content: '<gpx/>', opts: undefined }]);
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/nomade-x.gpx', { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx', dialogTitle: 'Exportar GPX' });
  });
});
