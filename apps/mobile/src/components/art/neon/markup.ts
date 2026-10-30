/**
 * Serializa a arte em texto SVG com os mesmos elementos que o componente desenha. Uso: evidência em PNG
 * (`scripts`/Playwright) e conferência com a arte aprovada da F1. Não é usado nas telas.
 */
import type { Prim } from './core';
import { PRISM_STOPS } from './palette';

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export function primsToMarkup(prims: Prim[]): string {
  return prims
    .map((p) => {
      const attrs = Object.entries(p.a)
        .map(([k, v]) => ` ${kebab(k)}="${v}"`)
        .join('');
      return p.c ? `<${p.tag}${attrs}>${primsToMarkup(p.c)}</${p.tag}>` : `<${p.tag}${attrs}/>`;
    })
    .join('');
}

export function prismDefsMarkup(id: string): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${PRISM_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
}

export function svgMarkup(vbW: number, vbH: number, body: string, width = vbW, opacity = 1): string {
  const h = Math.round((width * vbH) / vbW);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${width}" height="${h}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${body}</svg>`;
}
