/**
 * T7.2.5 — web: o `toDataURL` do react-native-svg desenha o SVG como `<img>` isolado e perde as fontes da
 * página (prova da F1, `web-comparacao-fontes.png`). Aqui o `<svg>` é serializado com as fontes do card
 * embutidas em base64 (`@font-face` com `data:`), desenhado num canvas do tamanho final e entregue por
 * Web Share com arquivo (Chrome Android, Safari iOS) ou baixado (desktop, navegador sem Web Share).
 * O `Sharing.shareAsync` não serve aqui: na web ele compartilha uma URL, não a imagem.
 */
import type Svg from 'react-native-svg';

import { cardFonts } from '../card';
import { ShareError, type ShareOutcome } from './share-flow';

export type PreparedImage = { blob: Blob; fileName: string };

const PNG = 'image/png';

function probeFile(): globalThis.File | null {
  try {
    return new globalThis.File([new Uint8Array([0])], 'nomade.png', { type: PNG });
  } catch {
    return null;
  }
}

/** O navegador aceita compartilhar arquivo (senão, o botão vira "Baixar imagem"). */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  const f = probeFile();
  try {
    return !!f && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------------------------
// Fontes embutidas
// -----------------------------------------------------------------------------------------------

/** `@font-face` que o expo-font injeta na página: família → URL do arquivo. */
export function fontUrlsFromCss(css: string, families: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const re = /@font-face\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const body = m[1];
    const family = /font-family\s*:\s*["']?([^"';]+)["']?/.exec(body)?.[1]?.trim();
    const url = /src\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/.exec(body)?.[1];
    if (family && url && families.includes(family) && !out.has(family)) out.set(family, url);
  }
  return out;
}

function pageFontCss(): string {
  if (typeof document === 'undefined') return '';
  const parts: string[] = [];
  for (const el of Array.from(document.querySelectorAll('style'))) parts.push(el.textContent ?? '');
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) if (rule.cssText.startsWith('@font-face')) parts.push(rule.cssText);
    } catch {
      // Folha de outra origem: o navegador não deixa ler. As do app são da mesma origem.
    }
  }
  return parts.join('\n');
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

let fontCssPromise: Promise<string> | null = null;

/** CSS com as 4 fontes do card em base64 (carregado uma vez por sessão). */
export function embeddedFontCss(): Promise<string> {
  if (!fontCssPromise) {
    const families = Object.values(cardFonts);
    fontCssPromise = (async () => {
      const urls = fontUrlsFromCss(pageFontCss(), families);
      const rules = await Promise.all(
        [...urls].map(async ([family, url]) => {
          const res = await fetch(url);
          if (!res.ok) return '';
          const b64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()));
          return `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${b64}) format("truetype");}`;
        }),
      );
      return rules.join('');
    })().catch(() => {
      fontCssPromise = null; // tenta de novo na próxima geração
      return '';
    });
  }
  return fontCssPromise;
}

// -----------------------------------------------------------------------------------------------
// Rasterizar e entregar
// -----------------------------------------------------------------------------------------------

function svgElementOf(svg: Svg | null): SVGSVGElement | null {
  const el = (svg as unknown as { elementRef?: { current?: unknown } } | null)?.elementRef?.current;
  return el && typeof (el as SVGSVGElement).cloneNode === 'function' ? (el as SVGSVGElement) : null;
}

export async function prepareImage(svg: Svg | null, size: { width: number; height: number }, fileName: string): Promise<PreparedImage> {
  const el = svgElementOf(svg);
  if (!el) throw new ShareError('empty');
  const css = await embeddedFontCss();
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(size.width));
  clone.setAttribute('height', String(size.height));
  clone.removeAttribute('style');
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  }
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  try {
    await img.decode();
  } catch {
    throw new ShareError('empty');
  }
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ShareError('unknown');
  ctx.drawImage(img, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, PNG));
  if (!blob || blob.size < 100) throw new ShareError('empty');
  return { blob, fileName };
}

function download(blob: Blob, fileName: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function shareOrDownload(blob: Blob, fileName: string, title: string): Promise<ShareOutcome> {
  const file = new globalThis.File([blob], fileName, { type: blob.type });
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === 'AbortError') return 'cancelled';
      // NotAllowedError: o navegador perdeu o "gesto da pessoa" enquanto a imagem era gerada → baixa.
    }
  }
  download(blob, fileName);
  return 'downloaded';
}

export function deliverImage(image: PreparedImage, title: string): Promise<ShareOutcome> {
  return shareOrDownload(image.blob, image.fileName, title);
}

export function shareTextFile(opts: { content: string; fileName: string; mimeType: string; uti: string; title: string }): Promise<ShareOutcome> {
  return shareOrDownload(new Blob([opts.content], { type: opts.mimeType }), opts.fileName, opts.title);
}
