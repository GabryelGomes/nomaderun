import { MapScreen } from '@/features/screens/map-screen';

/**
 * Aba Mapa. Ponto de encaixe dos dados do dia: quando o hook de engajamento da E7 (sequência, baú do dia,
 * missão) e o da Raid existirem, eles entram aqui como `<MapScreen today={...} />`.
 */
export default function MapaRoute() {
  return <MapScreen />;
}
