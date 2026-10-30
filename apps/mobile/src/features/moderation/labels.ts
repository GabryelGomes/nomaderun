import { FLAG_EXPLANATION, type CheatFlag } from '@/domain/anti-cheat';

/** Textos do painel para os códigos do servidor (API_CONTRATO: `review.reason` e `flags`). */
export const REVIEW_REASON_TEXT: Record<string, string> = {
  LOW_TRUST: 'Índice de confiança abaixo de 40.',
  TRUST_SUSPENDED: 'Índice de confiança abaixo de 10: corredor suspenso por 30 dias.',
  SUSPENDED: 'Conta já estava suspensa da competição.',
  NO_PEDOMETER_LONG_RUN: 'Aparelho sem pedômetro em corrida de mais de 10 km (RN-008).',
};

export const FLAG_TITLE: Record<string, string> = {
  MOCK_LOCATION: 'Localização simulada',
  TELEPORT: 'Salto de posição',
  POINT_SPEED: 'Velocidade acima de 40 km/h',
  VEHICLE_SUSPECTED: 'Suspeita de veículo',
  NO_STEPS: 'Movimento sem passos',
  NO_PEDOMETER: 'Sem pedômetro',
};

export function flagExplanation(code: string): string {
  return (FLAG_EXPLANATION as Record<string, string>)[code as CheatFlag] ?? 'Trecho marcado pela validação do servidor.';
}

export function formatKm(meters: number) {
  return `${(meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}

export function formatDateTime(ms: number) {
  try {
    return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}
