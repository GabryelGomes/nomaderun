/**
 * h3-js creates `new TextDecoder('utf-16le')` when it loads. Expo's runtime TextDecoder only
 * supports UTF-8 and throws, which crashes the app (and Jest) on import. This module must be
 * imported before h3-js: it wraps the global TextDecoder so UTF-16LE labels get a small
 * fallback decoder, and every other label keeps the original implementation.
 */
type Decoder = { decode(input?: ArrayBufferView | ArrayBuffer): string };
type DecoderCtor = new (label?: string, options?: object) => Decoder;

const g = globalThis as unknown as { TextDecoder?: DecoderCtor };
const Original = g.TextDecoder;

function supportsUtf16(Ctor: DecoderCtor) {
  try {
    new Ctor('utf-16le');
    return true;
  } catch {
    return false;
  }
}

if (Original && !supportsUtf16(Original)) {
  class Utf16Decoder implements Decoder {
    readonly encoding = 'utf-16le';
    decode(input?: ArrayBufferView | ArrayBuffer): string {
      if (!input) return '';
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let out = '';
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
      }
      return out;
    }
  }
  function PatchedTextDecoder(label?: string, options?: object): Decoder {
    if (label && /^utf-?16(le)?$/i.test(label.trim())) return new Utf16Decoder();
    return new (Original as DecoderCtor)(label, options);
  }
  g.TextDecoder = PatchedTextDecoder as unknown as DecoderCtor;
}

export {};
