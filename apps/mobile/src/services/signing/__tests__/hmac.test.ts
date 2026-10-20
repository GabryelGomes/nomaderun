import { describe, expect, it, jest } from '@jest/globals';

import { base64ToBytes, bytesToBase64 } from '../base64';
import { canonicalBatch, signBatch } from '../canonical';
import { bytesToHex, hmacSha256, hmacSha256Hex, sha256, utf8 } from '../hmac';

// Vetor de teste publicado no docs/API_CONTRATO.md (o mesmo de supabase/functions/tests/fixtures.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VECTOR } = require('../../../../../../supabase/functions/tests/fixtures.ts') as {
  VECTOR: { secret: string; body: Parameters<typeof canonicalBatch>[0]; canonical: string; signature: string };
};

// Arquivos de supabase/ ficam fora do app: o helper do Babel não é encontrado a partir de lá.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@babel/runtime/helpers/interopRequireDefault', () => require('@jest/globals').jest.requireActual('@babel/runtime/helpers/interopRequireDefault'), { virtual: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@babel/runtime/helpers/asyncToGenerator', () => require('@jest/globals').jest.requireActual('@babel/runtime/helpers/asyncToGenerator'), { virtual: true });

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));

describe('SHA-256 (FIPS 180-4)', () => {
  it('vetores conhecidos', () => {
    expect(bytesToHex(sha256(utf8('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(bytesToHex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(bytesToHex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(bytesToHex(sha256(new Uint8Array(1000).fill(0x61)))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('UTF-8 com acentos e emoji', () => {
    expect(Array.from(utf8('ã€😀'))).toEqual([0xc3, 0xa3, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80]);
  });
});

describe('HMAC-SHA256 (RFC 4231)', () => {
  it('caso 1: chave 0x0b × 20', () => {
    expect(bytesToHex(hmacSha256(new Uint8Array(20).fill(0x0b), utf8('Hi There')))).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });
  it('caso 2: chave "Jefe"', () => {
    expect(hmacSha256Hex(utf8('Jefe'), 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
  it('caso 6: chave maior que o bloco (131 bytes)', () => {
    expect(hmacSha256Hex(new Uint8Array(131).fill(0xaa), 'Test Using Larger Than Block-Size Key - Hash Key First')).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    );
  });
  it('caso 4: chave 0x01..0x19 e dados 0xcd × 50', () => {
    const key = Uint8Array.from({ length: 25 }, (_, i) => i + 1);
    expect(bytesToHex(hmacSha256(key, new Uint8Array(50).fill(0xcd)))).toBe('82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b');
  });
});

describe('vetor de teste do contrato (D-04)', () => {
  it('canonical idêntico ao publicado', () => {
    expect(canonicalBatch(VECTOR.body)).toBe(VECTOR.canonical);
  });

  it('assinatura idêntica à publicada', () => {
    expect(signBatch(VECTOR.secret, VECTOR.body)).toBe(VECTOR.signature);
    expect(signBatch(VECTOR.secret, VECTOR.body)).toBe('5457a0235e4794a5232a7c72cbbf84c7ef9d2a62aeac1a43996102fbd31dafcc');
  });

  it('mesmo texto que o canonical do servidor (supabase/functions/_shared/hmac.ts)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const server = require('../../../../../../supabase/functions/_shared/hmac.ts') as { canonicalBatch: typeof canonicalBatch };
    const body = {
      ...VECTOR.body,
      points: [...VECTOR.body.points, { seq: 2, lat: -16.7, lng: -49.2, t: 1760000002000, accuracy: null, speed: 0, altitude: -3.25, mocked: true, steps: 0 }],
      toSeq: 2,
    };
    expect(canonicalBatch(body)).toBe(server.canonicalBatch(body));
  });

  it('qualquer mudança no lote muda a assinatura', () => {
    const changed = { ...VECTOR.body, points: [{ ...VECTOR.body.points[0], steps: 4 }, VECTOR.body.points[1]] };
    expect(signBatch(VECTOR.secret, changed)).not.toBe(VECTOR.signature);
  });

  it('a chave do vetor são os bytes 0x00..0x1f', () => {
    expect(bytesToHex(base64ToBytes(VECTOR.secret))).toBe(bytesToHex(hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')));
  });
});

describe('base64', () => {
  it('ida e volta com e sem padding', () => {
    for (const n of [0, 1, 2, 3, 31, 32, 33]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 0xff);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    }
    expect(bytesToBase64(utf8('Man'))).toBe('TWFu');
    expect(bytesToBase64(utf8('Ma'))).toBe('TWE=');
    expect(bytesToBase64(utf8('M'))).toBe('TQ==');
  });
});
