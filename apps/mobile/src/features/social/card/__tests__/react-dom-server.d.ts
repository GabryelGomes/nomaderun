// O app não tem @types/react-dom: só o que o gerador de evidência (`gerar-svgs.web.tsx`) usa.
declare module 'react-dom/server.node' {
  import type { ReactElement } from 'react';

  export function renderToStaticMarkup(element: ReactElement): string;
}
