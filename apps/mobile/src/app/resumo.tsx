import { useLocalSearchParams } from 'expo-router';

import { useSummaryExtras } from '@/features/run/use-summary-extras';
import { SummaryScreen } from '@/features/screens/summary-screen';

/**
 * Resumo da corrida (T7.3.2): o bloco "Recompensas" da E7 (`rewards`) e o `<ShareButton>` da E8
 * (`renderShare`, que abre o card com imagem).
 */
export default function ResumoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rewards, renderShare } = useSummaryExtras(id);
  return <SummaryScreen rewards={rewards} renderShare={renderShare} />;
}
