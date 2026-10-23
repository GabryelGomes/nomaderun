/**
 * Contas puras das coreografias dos momentos (T7.1.14): tempos de cada passo (catálogo da F1, §4 e §7),
 * escala da cor que inunda a tela e cores provisórias de raridade. Sem React.
 */
import { BOSS_IDS, BOSS_NAMES, type BossDamage, type BossId } from '@/components/art/boss/boss-art';
import { neon, neonTeam } from '@/theme/neon';

import type { ChestRarity } from './queue';

/** Zona conquistada no resumo (§4.1): anel fecha, selo, título, faíscas e confete, pontos. */
export const ZONE_TIMELINE = { ring: 0, ringMs: 720, badge: 540, title: 660, peak: 720, points: 820, chips: 1000 } as const;

/** Baú abrindo (§4.2). */
export const CHEST_TIMELINE = { shake: 0, shakeMs: 600, squash: 600, squashMs: 300, burst: 750, item: 800, rarity: 1050, xp: 1150, odds: 1400 } as const;

/** Golpe no chefão (§4.3). */
export const BOSS_HIT_TIMELINE = { flashMs: 160, shakeMs: 320, squashMs: 420, golpeMs: 300, bar: 80, mine: 280 } as const;

/** Chefão derrotado (§4.4). */
export const BOSS_DEFEATED_TIMELINE = { tremble: 300, trembleMs: 400, explode: 700, stamp: 900, city: 1100, mine: 1350, mineCount: 1400, reward: 1800 } as const;

/** Nível novo (§3, item 22). */
export const LEVEL_TIMELINE = { dim: 0, rays: 100, number: 300, title: 700, reward: 900 } as const;

/** Escolha de time (§7): versão da primeira abertura e versão curta da troca de time. */
export const TEAM_TIMELINE = {
  ftue: { flood: 150, floodMs: 560, content: 450, vignette: 600, waves: 710, name: 750, quote: 1150, cta: 1600 },
  switch: { flood: 100, floodMs: 400, content: 300, vignette: 400, waves: -1, name: 450, quote: 700, cta: 950 },
} as const;

/** Aceno de cabeça do mascote na confirmação do time (pivô `MASCOT_PIVOTS.cabeca`, no pescoço). */
export const MASCOT_NOD = {
  durationMs: 520,
  keyframes: {
    '0%': { transform: [{ rotate: '0deg' }] },
    '30%': { transform: [{ rotate: '-7deg' }] },
    '60%': { transform: [{ rotate: '5deg' }] },
    '100%': { transform: [{ rotate: '0deg' }] },
  },
} as const;

/** Atraso de um passo na versão curta: os tempos encolhem na mesma proporção da duração. */
export function scaleDelay(ms: number, compact: boolean, ratio: number): number {
  if (!compact) return ms;
  const r = Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : 1;
  return Math.round(ms * r);
}

/**
 * Escala de um círculo de diâmetro `base`, centrado em `origin`, para cobrir uma tela `width × height`
 * (até o canto mais distante). Pelo menos 1.
 */
export function floodScale(origin: { x: number; y: number }, width: number, height: number, base: number): number {
  const dx = Math.max(origin.x, width - origin.x);
  const dy = Math.max(origin.y, height - origin.y);
  const radius = Math.sqrt(dx * dx + dy * dy);
  if (!(base > 0)) return 1;
  return Math.max(1, Math.ceil(((2 * radius) / base) * 100) / 100);
}

/**
 * Cores de raridade da arte da E4 (`art/chest/chest-art.ts`, T7.2.9): comum em tinta (traço claro), raro no
 * laranja do Pit Lane Neon e lendário no "prisma" com as 4 cores dos times (o baú é da cidade). Nunca o
 * violeta: ele é só dos vilões (D-67). `RARITY_COLORS` é a cor de destaque única (halo, raios, faíscas);
 * `RARITY_TEXT` a do título (contraste AA no fundo escuro); `RARITY_PALETTES` as do confete.
 */
export const RARITY_COLORS: Record<ChestRarity, string> = { comum: neon.ink2, raro: neon.orange, lendario: neon.ink };

export const RARITY_TEXT: Record<ChestRarity, string> = { comum: neon.ink2, raro: neon.orangeText, lendario: neon.ink };

/** Lendário: as 4 cores dos times, na ordem do gradiente "prisma" da E4. */
export const RARITY_PALETTES: Record<ChestRarity, readonly string[]> = {
  comum: [neon.ink2, neon.ink],
  raro: [neon.orange, neon.ink, neon.orangeText],
  lendario: [neonTeam.striders, neonTeam.volt, neonTeam.coyotes, neonTeam.owls],
};

export const RARITY_NAMES: Record<ChestRarity, string> = { comum: 'Comum', raro: 'Raro', lendario: 'Lendário' };

/** Confete por raridade: comum nenhum, raro 24, lendário 60 (escala de celebração). */
export const RARITY_CONFETTI: Record<ChestRarity, number> = { comum: 0, raro: 24, lendario: 60 };

/** "Chances: comum 70% · raro 25% · lendário 5%" (ética §5.4: chances sempre visíveis). */
export function oddsLabel(odds: Record<ChestRarity, number>): string {
  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  return `Chances: comum ${pct(odds.comum)} · raro ${pct(odds.raro)} · lendário ${pct(odds.lendario)}`;
}

/** Vida em porcentagem inteira (0–100), à prova de máximo zero. */
export function hpPercent(hp: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(hp)) return 0;
  return Math.round(Math.max(0, Math.min(1, hp / max)) * 100);
}

/** Posição (pt) de cada linha do ranking: só `translateY`, nada de layout animado. */
export function rankOffsets(order: readonly string[], rowHeight: number): Record<string, number> {
  const out: Record<string, number> = {};
  order.forEach((id, i) => {
    out[id] = i * rowHeight;
  });
  return out;
}

/**
 * Camada de dano do chefão (0, 1 ou 2 rachaduras) pela vida que sobrou, nas fases da Raid (D-67):
 * acima de 2/3 inteiro, acima de 1/3 rachado, abaixo disso quebrado. Puro.
 */
export function bossDamageFor(hp: number, max: number): BossDamage {
  if (!(max > 0) || !Number.isFinite(hp)) return 0;
  const f = Math.max(0, Math.min(1, hp / max));
  if (f > 2 / 3) return 0;
  if (f > 1 / 3) return 1;
  return 2;
}

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Id da arte do chefão a partir do nome que o evento traz ("Mormaço", "Chefão Rei Buzina", "rei-buzina").
 * Nome desconhecido: `null` (a tela decide; o momento usa o primeiro da lista). Puro.
 */
export function resolveBossId(name: string | null | undefined): BossId | null {
  if (!name) return null;
  const n = ` ${plain(name)} `;
  for (const id of BOSS_IDS) {
    if (n.includes(` ${plain(BOSS_NAMES[id])} `) || n.includes(` ${plain(id)} `)) return id;
  }
  return null;
}

/**
 * Quadros-chave da tampa do baú (arte da E4, pivô na dobradiça): chacoalha 3× junto com o tremor (só uma
 * fresta) e, no estouro, abre de vez e some no clarão. Tempos em ms desde o começo do momento. Puro.
 */
export function chestLidKeyframes(t: { shakeMs: number; burst: number }) {
  const end = t.burst + 260;
  const pct = (ms: number) => `${Math.round((Math.max(0, Math.min(end, ms)) / end) * 1000) / 10}%`;
  const at = (rotate: number, ty = 0, opacity = 1) => ({ opacity, transform: [{ translateY: ty }, { rotate: `${rotate}deg` }] });
  const s = t.shakeMs;
  return {
    durationMs: end,
    keyframes: {
      '0%': at(0),
      [pct(s * 0.2)]: at(-4),
      [pct(s * 0.4)]: at(0),
      [pct(s * 0.6)]: at(-6),
      [pct(s * 0.8)]: at(0),
      [pct(t.burst)]: at(0),
      [pct(t.burst + 120)]: at(-34, -14),
      '100%': at(-52, -30, 0),
    },
  };
}

/** "Bora!" no feed (D-79): a reação pula com mola curta e solta 6 faíscas. */
export const BORA_TIMELINE = { pressMs: 90, popMs: 320, burstCount: 6, burstDistance: 26 } as const;

/**
 * O que a reação faz ao mudar de estado: só a ida para "ativo" comemora (pulo, faíscas e vibração leve);
 * desfazer é silencioso. Com "Reduzir movimento", só o fade da cor. Puro.
 */
export function boraFeedback(prevActive: boolean, nextActive: boolean, reduced: boolean): { pop: boolean; burst: boolean; haptic: 'selection' | null; fade: boolean } {
  const celebrate = !prevActive && nextActive;
  return { pop: celebrate && !reduced, burst: celebrate && !reduced, haptic: celebrate ? 'selection' : null, fade: prevActive !== nextActive };
}
