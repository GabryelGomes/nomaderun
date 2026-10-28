import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CARD_FORMATS, STICKER_SIZE } from '../../card/card-sizes';
import {
  cleanBase64,
  doneMessage,
  failureOf,
  primaryLabel,
  SHARE_DEADLINE_MS,
  SHARE_TEXT,
  ShareError,
  shareFileName,
  shareReducer,
  shareSize,
  withDeadline,
  type ShareStatus,
} from '../share-flow';

afterEach(() => {
  jest.useRealTimers();
});

describe('estados do compartilhar', () => {
  const idle: ShareStatus = { kind: 'idle' };

  it('gerando → pronto ou erro; toque duplo enquanto gera não reinicia', () => {
    const gen = shareReducer(idle, { type: 'start' });
    expect(gen).toEqual({ kind: 'generating' });
    expect(shareReducer(gen, { type: 'start' })).toBe(gen);
    expect(shareReducer(gen, { type: 'finish', outcome: 'shared' })).toEqual({ kind: 'done', outcome: 'shared' });
    expect(shareReducer(gen, { type: 'fail', reason: 'timeout' })).toEqual({ kind: 'error', reason: 'timeout' });
  });

  it('resultado fora de hora é ignorado; "só o texto" sai do erro para o pronto', () => {
    expect(shareReducer(idle, { type: 'finish', outcome: 'shared' })).toBe(idle);
    expect(shareReducer(idle, { type: 'fail', reason: 'empty' })).toBe(idle);
    const err: ShareStatus = { kind: 'error', reason: 'empty' };
    expect(shareReducer(err, { type: 'textShared' })).toEqual({ kind: 'done', outcome: 'shared' });
    expect(shareReducer({ kind: 'generating' }, { type: 'textShared' })).toEqual({ kind: 'generating' });
    expect(shareReducer(err, { type: 'reset' })).toEqual(idle);
  });

  it('textos: "Gerando imagem…", "Baixar imagem" sem Web Share, "Pronto. Bora!"', () => {
    expect(primaryLabel({ kind: 'generating' }, true)).toBe('Gerando imagem…');
    expect(primaryLabel(idle, true)).toBe('Compartilhar');
    expect(primaryLabel(idle, false)).toBe('Baixar imagem');
    expect(doneMessage({ kind: 'done', outcome: 'shared' })).toBe(SHARE_TEXT.done);
    expect(doneMessage({ kind: 'done', outcome: 'downloaded' })).toBe(SHARE_TEXT.downloaded);
    expect(doneMessage({ kind: 'done', outcome: 'cancelled' })).toBeNull();
    expect(doneMessage(idle)).toBeNull();
  });

  it('tamanho final e nome fixo por formato (o cache guarda no máximo 1 por formato)', () => {
    expect(shareSize('stories')).toEqual({ width: 1080, height: CARD_FORMATS.stories.H });
    expect(shareSize('feed')).toEqual({ width: 1080, height: 1350 });
    expect(shareSize('sticker')).toEqual({ width: STICKER_SIZE, height: STICKER_SIZE });
    expect(shareFileName('sticker')).toBe('nomade-adesivo.png');
    expect(shareFileName('stories')).toBe('nomade-stories.png');
  });
});

describe('prazo e PNG', () => {
  it('prazo padrão de 6 s: depois disso, erro "timeout"', async () => {
    jest.useFakeTimers();
    expect(SHARE_DEADLINE_MS).toBe(6000);
    const never = new Promise<string>(() => undefined);
    const p = withDeadline(never);
    jest.advanceTimersByTime(5999);
    let settled = false;
    void p.catch(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(p).rejects.toEqual(new ShareError('timeout'));
  });

  it('resolve e rejeita antes do prazo como a tarefa', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 50)).resolves.toBe('ok');
    await expect(withDeadline(Promise.reject(new ShareError('empty')), 50)).rejects.toEqual(new ShareError('empty'));
  });

  it('base64 sem prefixo; resposta vazia do iOS vira "empty"', () => {
    const png = 'A'.repeat(200);
    expect(cleanBase64(`data:image/png;base64,${png}`)).toBe(png);
    expect(cleanBase64(png)).toBe(png);
    expect(() => cleanBase64('')).toThrow(ShareError);
    expect(() => cleanBase64(undefined)).toThrow(ShareError);
    expect(failureOf(new ShareError('unavailable'))).toBe('unavailable');
    expect(failureOf(new Error('x'))).toBe('unknown');
  });
});
