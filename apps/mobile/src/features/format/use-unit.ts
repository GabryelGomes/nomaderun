import type { DistanceUnit } from '@/services/api/types';
import { useSession } from '@/store/session-store';

/** Unidade do perfil (km quando não há perfil, como na primeira abertura). */
export function useDistanceUnit(): DistanceUnit {
  return useSession((s) => (s.profile?.unit === 'mi' ? 'mi' : 'km'));
}
