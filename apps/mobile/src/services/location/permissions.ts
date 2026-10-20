/**
 * Permissão de localização e GPS do aparelho (RF-004, RNF-013, D-10). A explicação da finalidade
 * aparece antes do pedido do sistema (onboarding e tela de corrida). Nada aqui lança erro: tudo
 * vira um estado com mensagem em pt-BR.
 */
import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type LocationAccess =
  | { status: 'granted' }
  | { status: 'undetermined' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'services-off' }
  | { status: 'error'; message: string };

export const LOCATION_MESSAGES = {
  explain:
    'O NOMADE RUN usa sua localização só durante a corrida, para medir distância e ritmo e saber em quais zonas você correu. Nada é compartilhado sem a sua escolha.',
  denied: 'Sem permissão de localização. Permita o acesso para gravar a corrida pelo GPS, ou use a simulação.',
  blocked: 'A permissão de localização foi negada. Abra os Ajustes do aparelho e permita o acesso, ou use a simulação.',
  servicesOff: 'O GPS do aparelho está desligado. Ligue a localização nos Ajustes e tente de novo.',
  error: 'Não foi possível acessar o GPS agora. Tente de novo ou use a simulação.',
  lost: 'O sinal do GPS caiu. A corrida continua gravando assim que o sinal voltar.',
} as const;

export type LocationPermissionApi = Pick<typeof Location, 'hasServicesEnabledAsync' | 'getForegroundPermissionsAsync' | 'requestForegroundPermissionsAsync'>;

function fromPermission(p: { granted: boolean; status: string; canAskAgain: boolean }): LocationAccess {
  if (p.granted || p.status === 'granted') return { status: 'granted' };
  if (p.status === 'undetermined') return { status: 'undetermined' };
  return { status: 'denied', canAskAgain: p.canAskAgain };
}

/** Situação atual, sem abrir o pedido do sistema. */
export async function checkLocationAccess(api: LocationPermissionApi = Location): Promise<LocationAccess> {
  try {
    const perm = fromPermission(await api.getForegroundPermissionsAsync());
    if (perm.status !== 'granted') return perm;
    return (await api.hasServicesEnabledAsync()) ? perm : { status: 'services-off' };
  } catch {
    return { status: 'error', message: LOCATION_MESSAGES.error };
  }
}

/** Abre o pedido do sistema (só depois da explicação na tela). */
export async function requestLocationAccess(api: LocationPermissionApi = Location): Promise<LocationAccess> {
  try {
    const perm = fromPermission(await api.requestForegroundPermissionsAsync());
    if (perm.status !== 'granted') return perm;
    return (await api.hasServicesEnabledAsync()) ? perm : { status: 'services-off' };
  } catch {
    return { status: 'error', message: LOCATION_MESSAGES.error };
  }
}

export function accessMessage(a: LocationAccess): string | null {
  switch (a.status) {
    case 'granted':
      return null;
    case 'undetermined':
      return LOCATION_MESSAGES.explain;
    case 'denied':
      return a.canAskAgain ? LOCATION_MESSAGES.denied : LOCATION_MESSAGES.blocked;
    case 'services-off':
      return LOCATION_MESSAGES.servicesOff;
    case 'error':
      return a.message;
  }
}

/** Ajustes do app no sistema (permissão negada de vez, GPS desligado). */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Sem tela de ajustes (web): a mensagem na tela já explica o que fazer.
  }
}
