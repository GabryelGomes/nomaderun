/**
 * Catálogo de cosméticos para a tela (nomes e "como ganhar"), igual ao `cosmetic_defs` da E9
 * (`supabase/migrations/20261023120100_rewards_catalog.sql`). Tudo se ganha jogando: nada é vendido (D-66).
 */
import type { ChestRarity } from '@/domain/games';
import { RUNNER_BANDS, RUNNER_TITLES } from '@/domain/progression';

export type CosmeticSlot = 'trail' | 'frame' | 'effect' | 'title' | 'emblem';
export type CosmeticSource = 'bau' | 'trilha' | 'titulo' | 'faixa' | 'ftue' | 'raid';

export type CosmeticDef = { id: string; slot: CosmeticSlot; name: string; rarity: ChestRarity; source: CosmeticSource };

const c = (id: string, slot: CosmeticSlot, name: string, rarity: ChestRarity, source: CosmeticSource): CosmeticDef => ({ id, slot, name, rarity, source });

export const COSMETICS: readonly CosmeticDef[] = [
  c('rastro-faisca', 'trail', 'Faísca', 'comum', 'titulo'),
  c('rastro-cometa', 'trail', 'Cometa', 'raro', 'titulo'),
  c('rastro-temporada', 'trail', 'Rastro do mês', 'comum', 'trilha'),
  c('rastro-temporada-brilho', 'trail', 'Rastro do mês brilhante', 'raro', 'trilha'),
  c('rastro-temporada-animado', 'trail', 'Rastro do mês animado', 'lendario', 'trilha'),
  c('rastro-aurora', 'trail', 'Aurora', 'raro', 'bau'),
  c('rastro-lava', 'trail', 'Lava', 'raro', 'bau'),
  c('rastro-gelo', 'trail', 'Gelo', 'raro', 'bau'),
  c('rastro-oceano', 'trail', 'Oceano', 'lendario', 'bau'),
  c('rastro-neon', 'trail', 'Neon', 'lendario', 'bau'),
  c('moldura-asfalto', 'frame', 'Asfalto', 'comum', 'faixa'),
  c('moldura-bronze', 'frame', 'Bronze', 'comum', 'faixa'),
  c('moldura-prata', 'frame', 'Prata', 'comum', 'faixa'),
  c('moldura-ouro', 'frame', 'Ouro', 'raro', 'faixa'),
  c('moldura-neon', 'frame', 'Neon', 'raro', 'faixa'),
  c('moldura-holografica', 'frame', 'Holográfica', 'lendario', 'faixa'),
  c('moldura-lenda', 'frame', 'Lenda', 'lendario', 'faixa'),
  c('moldura-nomade', 'frame', 'Nômade', 'lendario', 'faixa'),
  c('moldura-primeira-semana', 'frame', 'Primeira Semana', 'raro', 'ftue'),
  c('moldura-bairro', 'frame', 'Bairro', 'comum', 'titulo'),
  c('moldura-holofote', 'frame', 'Holofote', 'raro', 'titulo'),
  c('moldura-temporada', 'frame', 'Moldura do mês', 'comum', 'trilha'),
  c('moldura-temporada-rara', 'frame', 'Moldura do mês rara', 'raro', 'trilha'),
  c('moldura-temporada-animada', 'frame', 'Moldura do mês animada', 'lendario', 'trilha'),
  c('moldura-golpe-final', 'frame', 'Golpe final', 'lendario', 'raid'),
  c('efeito-pulso', 'effect', 'Pulso', 'comum', 'titulo'),
  c('efeito-onda', 'effect', 'Onda', 'raro', 'titulo'),
  c('efeito-faisca-mes', 'effect', 'Faísca do mês', 'raro', 'trilha'),
  c('efeito-pulso-mes', 'effect', 'Pulso do mês', 'raro', 'trilha'),
  c('efeito-confete', 'effect', 'Confete', 'raro', 'bau'),
  c('efeito-relampago', 'effect', 'Relâmpago', 'lendario', 'bau'),
  c('emblema-temporada', 'emblem', 'Emblema do mês', 'comum', 'trilha'),
];

const BY_ID = new Map(COSMETICS.map((x) => [x.id, x]));

export const SLOT_LABELS: Record<CosmeticSlot, string> = { trail: 'Rastros', frame: 'Molduras', effect: 'Efeitos', title: 'Títulos', emblem: 'Emblemas' };

/** Ordem das abas de cosméticos na tela de recompensas. */
export const SHOWN_SLOTS: readonly CosmeticSlot[] = ['trail', 'frame', 'effect'];

export function cosmeticById(id: string): CosmeticDef | undefined {
  return BY_ID.get(id);
}

export function cosmeticName(id: string): string {
  return BY_ID.get(id)?.name ?? 'Item novo';
}

/** Como ganhar (texto curto, sempre verdadeiro): "Nível 5", "Baú do dia", "150 km no total"… */
export function howToEarn(def: CosmeticDef): string {
  switch (def.source) {
    case 'bau':
      return 'Baú do dia';
    case 'trilha':
      return 'Trilha do mês';
    case 'ftue':
      return 'Primeira semana';
    case 'raid':
      return 'Golpe final no chefão';
    case 'titulo': {
      const t = RUNNER_TITLES.find((x) => x.unlocks === def.id);
      return t ? `Nível ${t.minLevel}` : 'Por nível';
    }
    case 'faixa': {
      const band = RUNNER_BANDS.find((b) => `moldura-${b.id === 'holografico' ? 'holografica' : b.id}` === def.id);
      return band ? (band.minKm === 0 ? 'Desde o início' : `${String(band.minKm).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km no total`) : 'Por distância';
    }
  }
}
