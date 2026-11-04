import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { BOOT_LOGO_SVG } from '@/features/web/boot-logo';

/**
 * HTML de cada página da web (export estático). UX-37: enquanto o JavaScript carrega, a página já nasce com o
 * fundo do app (`#070708`, nunca branco) e a marca no centro. O app desenha por cima (o fundo das telas é o mesmo
 * tom), então a marca some sozinha quando a primeira tela aparece. Só roda no export web (Node), nunca no aparelho.
 */
const BOOT_CSS = `
html,body{background-color:#070708;color:#F5F1EA;color-scheme:dark}
#nomade-boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
#root{position:relative;z-index:1}
@media (prefers-reduced-motion:no-preference){#nomade-boot svg{animation:nomade-pulse 1.6s ease-in-out infinite}}
@keyframes nomade-pulse{0%,100%{opacity:.75}50%{opacity:1}}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" style={{ backgroundColor: '#070708' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#070708" />
        <ScrollViewStyleReset />
        <style id="nomade-boot-css" dangerouslySetInnerHTML={{ __html: BOOT_CSS }} />
      </head>
      <body style={{ backgroundColor: '#070708' }}>
        <div id="nomade-boot" aria-hidden="true" dangerouslySetInnerHTML={{ __html: BOOT_LOGO_SVG }} />
        {children}
      </body>
    </html>
  );
}
