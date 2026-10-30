import { MapScreen } from '@/features/screens/map-screen';
import { useMapToday } from '@/features/screens/map-screen.use-today';

/**
 * Aba Mapa (T7.3.2): a faixa de hoje vem do engajamento (E7: sequência, baú do dia, missão) e do Raid (E3:
 * chefão com vida). Sem dado verdadeiro, o chip não existe.
 */
export default function MapaRoute() {
  const today = useMapToday();
  return <MapScreen today={today} />;
}
