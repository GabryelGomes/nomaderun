import type { Href } from 'expo-router';

import type { IconName } from './icon';

/**
 * Abas do app (D-73): **Mapa · Arena · Correr · Clube · Você**. A mesma lista serve à barra nativa (`app-tabs.tsx`)
 * e à da web (`app-tabs.web.tsx`).
 *  - **Correr** é uma aba comum com ícone laranja: o toque abre a Nova corrida (`/corrida`), então correr fica a
 *    1 toque de qualquer aba. A tela da aba (`/correr`) é só o ponto de partida para quem volta da corrida.
 *  - **Você** é a antiga aba Perfil (rota `/perfil` mantida) e agrupa as Atividades (`/perfil/atividades`).
 *    O endereço antigo `/atividades` continua funcionando (redireciona).
 */
export type AppTabName = 'index' | 'arena' | 'correr' | 'clube' | 'perfil';

export type AppTab = {
  name: AppTabName;
  href: Href;
  label: string;
  icon: IconName;
  testID: string;
  /** Rota que o toque abre em vez de trocar de aba (só a Correr). */
  opens?: Href;
};

/** Nova corrida (modal de tela cheia da raiz). */
export const RUN_ROUTE = '/corrida' as const;
/** Atividades dentro de "Você". */
export const ACTIVITIES_ROUTE = '/perfil/atividades' as const;

export const APP_TABS: readonly AppTab[] = [
  { name: 'index', href: '/', label: 'Mapa', icon: 'map', testID: 'aba-mapa' },
  { name: 'arena', href: '/arena', label: 'Arena', icon: 'arena', testID: 'aba-arena' },
  { name: 'correr', href: '/correr', label: 'Correr', icon: 'play', testID: 'aba-correr', opens: RUN_ROUTE },
  { name: 'clube', href: '/clube', label: 'Clube', icon: 'club', testID: 'aba-clube' },
  { name: 'perfil', href: '/perfil', label: 'Você', icon: 'profile', testID: 'aba-voce' },
];

/** Altura da barra de abas da web (fixa, para os elementos flutuantes saberem onde ela começa). */
export const WEB_TAB_BAR_HEIGHT = 64;
/**
 * Diâmetro do Correr da web: o círculo passa uns 6 px da borda de cima da barra (efeito "elevado") sem invadir os
 * 16 px que o "Correr" do Mapa deixa livres acima dela (`tabBarClearance`).
 */
export const WEB_RUN_TAB_SIZE = 48;
/**
 * Altura estimada da barra nativa do Android (Material 3: 80 dp, mais a área segura de baixo). O conteúdo das abas
 * fica acima dela; no iOS a barra flutua sobre o conteúdo (ver `tabBarClearance`).
 */
export const ANDROID_TAB_BAR_HEIGHT = 80;
