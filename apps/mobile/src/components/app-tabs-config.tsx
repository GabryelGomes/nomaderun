import type { Href } from 'expo-router';

import type { IconName } from './icon';

/**
 * Abas do app (D-89, substitui a D-73): **Mapa · Arena · Clube · Você**. A mesma lista serve à barra nativa
 * (`app-tabs.tsx`) e à da web (`app-tabs.web.tsx`).
 *  - Não há aba Correr: o CORRER de 72 pt do Mapa é o único "começar corrida" genérico. Os pontos de partida com
 *    contexto continuam (Defender, Fuga, Caça, "Ir" das missões, vazios). O endereço antigo `/correr` redireciona
 *    para a Nova corrida (`/corrida`).
 *  - **Você** é a antiga aba Perfil (rota `/perfil` mantida) e agrupa as Atividades (`/perfil/atividades`).
 *    O endereço antigo `/atividades` continua funcionando (redireciona).
 */
export type AppTabName = 'index' | 'arena' | 'clube' | 'perfil';

export type AppTab = {
  name: AppTabName;
  href: Href;
  label: string;
  icon: IconName;
  testID: string;
};

/** Nova corrida (modal de tela cheia da raiz). */
export const RUN_ROUTE = '/corrida' as const;
/** Atividades dentro de "Você". */
export const ACTIVITIES_ROUTE = '/perfil/atividades' as const;

export const APP_TABS: readonly AppTab[] = [
  { name: 'index', href: '/', label: 'Mapa', icon: 'map', testID: 'aba-mapa' },
  { name: 'arena', href: '/arena', label: 'Arena', icon: 'arena', testID: 'aba-arena' },
  { name: 'clube', href: '/clube', label: 'Clube', icon: 'club', testID: 'aba-clube' },
  { name: 'perfil', href: '/perfil', label: 'Você', icon: 'profile', testID: 'aba-voce' },
];

/** Altura da barra de abas da web (fixa, para os elementos flutuantes saberem onde ela começa). */
export const WEB_TAB_BAR_HEIGHT = 64;
/**
 * Altura estimada da barra nativa do Android (Material 3: 80 dp, mais a área segura de baixo). O conteúdo das abas
 * fica acima dela; no iOS a barra flutua sobre o conteúdo (ver `tabBarClearance`).
 */
export const ANDROID_TAB_BAR_HEIGHT = 80;
