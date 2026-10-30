/**
 * Orquestrador de celebrações — parte pura (T7.1.14). Sem React e sem Reanimated: testável em Jest.
 *
 * Recebe os eventos do jogo (cada um já com o nível de celebração decidido pela regra, não pela tela) e
 * monta o roteiro: ordem pico-fim, no máximo 1 épica e 3 médias (o resto vira um momento agrupado), tempo
 * de cada momento e de cada vibração (≥ 150 ms entre elas), dentro do teto do resumo. Com "Reduzir
 * movimento", fades curtos em cascata e 1 vibração; com leitor de tela, nada roteirizado e 1 anúncio.
 */
import type { BossId } from '@/components/art/boss/boss-art';
import type { MedalKind, MedalTier } from '@/components/art/medal/medal-art';
import type { FactionId } from '@/domain/types';
import { celebration, celebrationLevels, durations, HAPTIC_MIN_GAP_MS, type CelebrationLevel, type HapticPattern } from '@/theme/motion';

export type { CelebrationLevel };

export type ChestRarity = 'comum' | 'raro' | 'lendario';

/**
 * Dados de cada tipo de evento. É a interface de entrada da E5: o adaptador da onda 2 traduz os eventos da
 * corrida (`live-events.ts`, E3) e do resumo (E7/E9) para estes formatos.
 */
export interface CelebrationPayloads {
  /** `points` só existe no resultado oficial (resumo); a previsão ao vivo não traz. */
  'zone-captured': { zone: string; faction: FactionId; points?: number };
  'zone-defended': { zone: string; faction: FactionId };
  /** `gapMeters`: quanto falta para conquistar ("faltam ≈ 80 m"), quando a corrida sabe. */
  'zone-milestone': { zone: string; fraction: number; gapMeters?: number };
  /** `odds`: chances reais de cada raridade (servidor, D-66); sem elas a linha de chances não aparece. */
  chest: { rarity: ChestRarity; xp: number; odds?: Record<ChestRarity, number> };
  /** `bossId`: qual arte da E4 desenhar; sem ele, o nome é usado para achar (`resolveBossId`). */
  'boss-hit': { boss: string; bossId?: BossId; damageKm: number; hpBefore: number; hpAfter: number; hpMax: number };
  'boss-defeated': { boss: string; bossId?: BossId; city: string; myKm: number };
  xp: { gained: number; from: number; to: number };
  'level-up': { level: number; title?: string };
  streak: { weeks: number; state: 'kept' | 'frozen' };
  'personal-record': { metric: string; value: string };
  mission: { title: string; xp: number };
  /** `medal`/`tier`: qual medalha da E4 desenhar no toast (opcional). */
  medal: { name: string; medal?: MedalKind; tier?: MedalTier };
  'league-up': { position: number; previous: number };
  'team-confirm': { faction: FactionId };
}

export type CelebrationEventKind = keyof CelebrationPayloads;
/** `group` é criado pelo orquestrador para juntar o excedente ("+3 conquistas"). */
export type CelebrationKind = CelebrationEventKind | 'group';

/** Um evento a celebrar. */
export type CelebrationEvent = {
  [K in CelebrationEventKind]: {
    id: string;
    kind: K;
    /** Nível decidido pela regra do jogo (E3/E7), não pela tela. Sugestão: `defaultLevel`. */
    level: CelebrationLevel;
    /** Frase curta para o leitor de tela, no passado e sem sujeito: "conquistou Setor Bueno". */
    label: string;
    payload: CelebrationPayloads[K];
  };
}[CelebrationEventKind];

export type MomentHaptic = { atMs: number; pattern: HapticPattern };

export type ScheduledMoment = {
  id: string;
  kind: CelebrationKind;
  /** Nível efetivo (depois dos limites: uma épica a mais vira média). */
  level: CelebrationLevel;
  /** Eventos deste momento (1; vários no `group`). */
  events: CelebrationEvent[];
  startMs: number;
  durationMs: number;
  endMs: number;
  /** Versão curta (resumo cheio ou nível abaixo da duração completa). */
  compact: boolean;
  /** Vibrações deste momento, em ms absolutos do roteiro (já com o intervalo mínimo). */
  haptics: MomentHaptic[];
};

/** `skipped`: preferência "Pular celebrações" ligada (tudo no estado final, como um "Pular" no começo). */
export type CelebrationMode = 'full' | 'reduced' | 'screen-reader' | 'skipped';

export type CelebrationPlan = {
  mode: CelebrationMode;
  moments: ScheduledMoment[];
  /** Todas as vibrações, em ordem, com ≥ 150 ms entre elas. */
  haptics: MomentHaptic[];
  /** Fim do último momento (ms absolutos). */
  totalMs: number;
  /** Texto do anúncio único ao leitor de tela. */
  announcement: string;
};

export type PlanOptions = {
  reduced: boolean;
  screenReader: boolean;
  /** Início do primeiro momento (ex.: 2700 no resumo, depois da rota e dos números). */
  startAtMs?: number;
  /** Respiro entre momentos (padrão 200). */
  gapMs?: number;
  /** Teto do roteiro inteiro (padrão 8500). */
  budgetMs?: number;
  /** Frase antes das conquistas no anúncio: "Corrida concluída: 8,42 km em 47 minutos." */
  intro?: string;
  /** Preferência "Pular celebrações" (T7.2.9): nada roteirizado, no máximo 1 vibração de sucesso. */
  skip?: boolean;
};

type Beat = { offsetMs: number; pattern: HapticPattern };
type Spec = { full: number; compact: number; haptics: Beat[] };

/** Duração (completa e curta) e vibrações de cada momento (catálogo da F1, §3 e §4). */
export const MOMENT_SPECS: Record<CelebrationKind, Spec> = {
  'zone-captured': { full: 1600, compact: 1100, haptics: [{ offsetMs: 0, pattern: 'tap' }, { offsetMs: 720, pattern: 'success' }] },
  'zone-defended': { full: 600, compact: 400, haptics: [{ offsetMs: 0, pattern: 'impact' }] },
  'zone-milestone': { full: 400, compact: 300, haptics: [{ offsetMs: 0, pattern: 'selection' }] },
  chest: { full: 1700, compact: 1000, haptics: [{ offsetMs: 0, pattern: 'crescendo' }, { offsetMs: 750, pattern: 'success' }] },
  'boss-hit': { full: 800, compact: 800, haptics: [{ offsetMs: 0, pattern: 'impact' }] },
  'boss-defeated': { full: 2500, compact: 1800, haptics: [{ offsetMs: 0, pattern: 'heavy' }, { offsetMs: 700, pattern: 'success' }, { offsetMs: 1800, pattern: 'tap' }] },
  xp: { full: 600, compact: 600, haptics: [] },
  'level-up': { full: 2000, compact: 1500, haptics: [{ offsetMs: 120, pattern: 'success' }] },
  streak: { full: 600, compact: 500, haptics: [{ offsetMs: 0, pattern: 'selection' }] },
  'personal-record': { full: 900, compact: 800, haptics: [{ offsetMs: 0, pattern: 'impact' }] },
  mission: { full: 600, compact: 500, haptics: [{ offsetMs: 0, pattern: 'success' }] },
  medal: { full: 900, compact: 800, haptics: [{ offsetMs: 0, pattern: 'success' }] },
  'league-up': { full: 1800, compact: 1200, haptics: [{ offsetMs: 0, pattern: 'heavy' }, { offsetMs: 500, pattern: 'success' }] },
  'team-confirm': { full: 2000, compact: 1200, haptics: [{ offsetMs: 150, pattern: 'heavy' }, { offsetMs: 710, pattern: 'success' }] },
  group: { full: 800, compact: 600, haptics: [{ offsetMs: 0, pattern: 'tap' }] },
};

/** Peso de cada tipo para decidir quem fica com o pico (maior = mais perto do fim). */
export const MOMENT_RANK: Record<CelebrationKind, number> = {
  'team-confirm': 10,
  'boss-defeated': 9,
  'level-up': 8,
  'league-up': 7,
  chest: 6,
  'personal-record': 5,
  medal: 5,
  'zone-captured': 4,
  mission: 3,
  'boss-hit': 2,
  'zone-defended': 2,
  streak: 2,
  xp: 1,
  'zone-milestone': 1,
  group: 0,
};

const LEVEL_ORDER: Record<CelebrationLevel, number> = { micro: 0, small: 1, medium: 2, epic: 3 };
const HAPTIC_RANK: Record<HapticPattern, number> = { selection: 0, tap: 1, impact: 2, crescendo: 2, heavy: 3, success: 4, warning: 5, error: 6 };

/** Nível sugerido para cada tipo (o adaptador pode usar quando a regra não disser). */
export function defaultLevel(event: Pick<CelebrationEvent, 'kind' | 'payload'>): CelebrationLevel {
  switch (event.kind) {
    case 'chest': {
      const r = (event.payload as CelebrationPayloads['chest']).rarity;
      return r === 'lendario' ? 'epic' : r === 'raro' ? 'medium' : 'small';
    }
    case 'boss-defeated':
    case 'level-up':
    case 'team-confirm':
      return 'epic';
    case 'zone-captured':
    case 'personal-record':
    case 'medal':
    case 'league-up':
      return 'medium';
    default:
      return 'small';
  }
}

/** "a", "a e b", "a, b e c". */
export function joinPt(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Máximo de conquistas citadas uma a uma no anúncio; o resto vira "mais N conquistas". */
export const A11Y_MAX_ITEMS = 6;

/**
 * O anúncio único ao leitor de tela: "Corrida concluída: 8,42 km. Você conquistou Setor Bueno, abriu um baú
 * raro e chegou ao nível 7."
 */
export function a11ySummary(events: readonly Pick<CelebrationEvent, 'label'>[], intro?: string): string {
  const labels = events.map((e) => e.label.trim()).filter(Boolean);
  const head = intro?.trim() ?? '';
  if (labels.length === 0) return head;
  const shown = labels.length > A11Y_MAX_ITEMS ? [...labels.slice(0, A11Y_MAX_ITEMS - 1), `mais ${labels.length - (A11Y_MAX_ITEMS - 1)} conquistas`] : labels;
  const body = `Você ${joinPt(shown)}.`;
  return head ? `${head} ${body}` : body;
}

type Draft = { kind: CelebrationKind; level: CelebrationLevel; events: CelebrationEvent[]; compact: boolean; index: number };

function groupDraft(events: CelebrationEvent[], index: number): Draft {
  return { kind: 'group', level: 'small', events, compact: false, index };
}

function duration(d: Draft): number {
  const spec = MOMENT_SPECS[d.kind];
  const base = d.compact ? spec.compact : spec.full;
  // nunca passa do teto do nível (ex.: baú comum = pequena → versão curta)
  return Math.min(base, celebrationLevels[d.level].maxMs);
}

function isCompact(d: Draft): boolean {
  return d.compact || MOMENT_SPECS[d.kind].full > celebrationLevels[d.level].maxMs;
}

/** Aplica os limites: 1 épica (a de maior peso), 3 médias; o excedente vira um grupo. Ordem pico-fim. */
function arrange(events: readonly CelebrationEvent[]): Draft[] {
  const drafts: Draft[] = events.map((e, index) => ({ kind: e.kind, level: e.level, events: [e], compact: false, index }));
  const byRankDesc = (a: Draft, b: Draft) => MOMENT_RANK[b.kind] - MOMENT_RANK[a.kind] || a.index - b.index;

  const epics = drafts.filter((d) => d.level === 'epic').sort(byRankDesc);
  for (const d of epics.slice(celebration.maxEpic)) d.level = 'medium';

  const mediums = drafts.filter((d) => d.level === 'medium').sort(byRankDesc);
  const extra = new Set(mediums.slice(celebration.maxMedium));

  const keep = drafts.filter((d) => !extra.has(d));
  const byIndex = (a: Draft, b: Draft) => a.index - b.index;
  const byRankAsc = (a: Draft, b: Draft) => MOMENT_RANK[a.kind] - MOMENT_RANK[b.kind] || a.index - b.index;
  const lows = keep.filter((d) => LEVEL_ORDER[d.level] <= LEVEL_ORDER.small).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || byIndex(a, b));
  const mids = keep.filter((d) => d.level === 'medium').sort(byRankAsc);
  const peak = keep.filter((d) => d.level === 'epic');
  const group = extra.size > 0 ? [groupDraft([...extra].sort(byIndex).flatMap((d) => d.events), events.length)] : [];
  return [...lows, ...group, ...mids, ...peak];
}

function totalOf(drafts: Draft[], gap: number): number {
  return drafts.reduce((t, d, i) => t + duration(d) + (i > 0 ? gap : 0), 0);
}

/** Cabe no teto: primeiro encurta o que não é épico; depois junta as pequenas num grupo; por fim encurta a épica. */
function fitBudget(drafts: Draft[], gap: number, budget: number): Draft[] {
  let list = drafts.map((d) => ({ ...d }));
  if (totalOf(list, gap) <= budget) return list;
  for (const d of list) if (d.level !== 'epic') d.compact = true;
  if (totalOf(list, gap) <= budget) return list;
  // junta as pequenas (do começo) no grupo, uma a uma, até caber
  while (totalOf(list, gap) > budget) {
    const smallIdx = list.findIndex((d) => d.kind !== 'group' && LEVEL_ORDER[d.level] <= LEVEL_ORDER.small);
    if (smallIdx < 0) break;
    const [small] = list.splice(smallIdx, 1);
    const gi = list.findIndex((d) => d.kind === 'group');
    // as pequenas vêm antes do grupo no roteiro: entram no começo dele (ordem de chegada mantida)
    if (gi >= 0) list[gi] = { ...list[gi], events: [...small.events, ...list[gi].events] };
    else {
      const firstMid = list.findIndex((d) => LEVEL_ORDER[d.level] >= LEVEL_ORDER.medium);
      const g = { ...groupDraft(small.events, small.index), compact: true };
      list = firstMid < 0 ? [...list, g] : [...list.slice(0, firstMid), g, ...list.slice(firstMid)];
    }
  }
  if (totalOf(list, gap) > budget) for (const d of list) d.compact = true;
  return list;
}

/** Junta vibrações próximas: entre duas a menos de 150 ms, fica a mais forte. Entrada em ordem de tempo. */
export function spaceHaptics(list: readonly MomentHaptic[], minGapMs: number = HAPTIC_MIN_GAP_MS): MomentHaptic[] {
  const out: MomentHaptic[] = [];
  for (const h of [...list].sort((a, b) => a.atMs - b.atMs)) {
    const last = out[out.length - 1];
    if (!last || h.atMs - last.atMs >= minGapMs) out.push(h);
    // a mais forte vence, no horário dela (mais tarde que a substituída: continua longe da anterior)
    else if (HAPTIC_RANK[h.pattern] > HAPTIC_RANK[last.pattern]) out[out.length - 1] = h;
  }
  return out;
}

/** Expande o `crescendo` (leve → médio → forte, 200 ms entre eles) para o plano ter os toques reais. */
function expandBeats(beats: readonly Beat[]): Beat[] {
  return beats.flatMap((b) =>
    b.pattern === 'crescendo'
      ? [
          { offsetMs: b.offsetMs, pattern: 'tap' as const },
          { offsetMs: b.offsetMs + 200, pattern: 'impact' as const },
          { offsetMs: b.offsetMs + 400, pattern: 'heavy' as const },
        ]
      : [b],
  );
}

function momentId(d: Draft): string {
  return d.kind === 'group' ? `grupo:${d.events.map((e) => e.id).join('+')}` : d.events[0].id;
}

/** Monta o roteiro das celebrações. Função pura. */
export function planCelebrations(events: readonly CelebrationEvent[], opts: PlanOptions): CelebrationPlan {
  const start = Math.max(0, opts.startAtMs ?? 0);
  const gap = Math.max(0, opts.gapMs ?? celebration.gapMs);
  const budget = Math.max(0, opts.budgetMs ?? celebration.summaryBudgetMs);
  const announcement = a11ySummary(events, opts.intro);
  const arranged = arrange(events);

  if (opts.screenReader || opts.skip) {
    // nada roteirizado: tudo no estado final, de uma vez; o anúncio único conta o que aconteceu
    const moments: ScheduledMoment[] = arranged.map((d) => ({ id: momentId(d), kind: d.kind, level: d.level, events: d.events, startMs: start, durationMs: 0, endMs: start, compact: true, haptics: [] }));
    if (opts.screenReader) return { mode: 'screen-reader', moments, haptics: [], totalMs: start, announcement };
    // "Pular celebrações" = o "Pular" tocado no começo: 1 sucesso se havia algo médio ou épico
    const haptics: MomentHaptic[] = arranged.some((d) => LEVEL_ORDER[d.level] >= LEVEL_ORDER.medium) ? [{ atMs: start, pattern: 'success' }] : [];
    if (moments.length > 0) moments[0].haptics = haptics;
    return { mode: 'skipped', moments, haptics, totalMs: start, announcement };
  }

  if (opts.reduced) {
    // fades curtos em cascata (60 ms) e uma vibração só: a do maior nível
    const step = celebration.reducedStepMs;
    const moments: ScheduledMoment[] = arranged.map((d, i) => ({
      id: momentId(d),
      kind: d.kind,
      level: d.level,
      events: d.events,
      startMs: start + i * step,
      durationMs: durations.reducedFade,
      endMs: start + i * step + durations.reducedFade,
      compact: true,
      haptics: [],
    }));
    const top = arranged.reduce<CelebrationLevel | null>((m, d) => (m === null || LEVEL_ORDER[d.level] > LEVEL_ORDER[m] ? d.level : m), null);
    const haptics = top ? [{ atMs: start, pattern: celebrationLevels[top].haptic }] : [];
    if (top) moments[0].haptics = haptics;
    return { mode: 'reduced', moments, haptics, totalMs: moments.length > 0 ? moments[moments.length - 1].endMs : start, announcement };
  }

  const fitted = fitBudget(arranged, gap, budget);
  let cursor = start;
  const raw: ScheduledMoment[] = fitted.map((d, i) => {
    if (i > 0) cursor += gap;
    const dur = duration(d);
    const compact = isCompact(d);
    const scale = compact ? dur / MOMENT_SPECS[d.kind].full : 1;
    const haptics = expandBeats(MOMENT_SPECS[d.kind].haptics)
      .map((b) => ({ atMs: cursor + Math.round(b.offsetMs * scale), pattern: b.pattern }))
      .filter((h) => h.atMs <= cursor + dur);
    const m: ScheduledMoment = { id: momentId(d), kind: d.kind, level: d.level, events: d.events, startMs: cursor, durationMs: dur, endMs: cursor + dur, compact, haptics };
    cursor += dur;
    return m;
  });
  const haptics = spaceHaptics(raw.flatMap((m) => m.haptics));
  const kept = new Set(haptics);
  const moments = raw.map((m) => ({ ...m, haptics: m.haptics.filter((h) => kept.has(h)) }));
  return { mode: 'full', moments, haptics, totalMs: moments.length > 0 ? moments[moments.length - 1].endMs : start, announcement };
}

export type MomentState = 'waiting' | 'playing' | 'done';

/** Estado de um momento no instante `atMs`. */
export function momentState(m: Pick<ScheduledMoment, 'startMs' | 'endMs'>, atMs: number): MomentState {
  if (atMs >= m.endMs) return 'done';
  if (atMs >= m.startMs) return 'playing';
  return 'waiting';
}

/** Quais momentos já terminaram, qual toca e quais esperam no instante `atMs` (ex.: o toque em "Pular"). */
export function skipTo(plan: Pick<CelebrationPlan, 'moments'>, atMs: number): { finishedIds: string[]; currentId: string | null; pendingIds: string[] } {
  const finishedIds: string[] = [];
  const pendingIds: string[] = [];
  let currentId: string | null = null;
  for (const m of plan.moments) {
    const s = momentState(m, atMs);
    if (s === 'done') finishedIds.push(m.id);
    else if (s === 'playing' && currentId === null) currentId = m.id;
    else pendingIds.push(m.id);
  }
  return { finishedIds, currentId, pendingIds };
}

/** Quantos momentos já começaram em `atMs` (o índice do passo atual + 1). */
export function startedCount(starts: readonly number[], atMs: number): number {
  let n = 0;
  for (const s of starts) if (s <= atMs) n++;
  return n;
}

/** Instante do próximo passo depois de `atMs` (toque para adiantar). Sem próximo: o fim do roteiro. */
export function nextStepAt(plan: Pick<CelebrationPlan, 'moments' | 'totalMs'>, atMs: number): number {
  for (const m of plan.moments) if (m.startMs > atMs) return m.startMs;
  return plan.totalMs;
}

/**
 * A vibração única do "Pular": `success` se ainda havia algo médio ou épico por mostrar; senão nenhuma.
 * As vibrações pendentes do roteiro são descartadas.
 */
export function skipHaptic(plan: Pick<CelebrationPlan, 'moments' | 'mode'>, atMs: number): HapticPattern | null {
  if (plan.mode === 'screen-reader' || plan.mode === 'skipped') return null;
  const unseen = plan.moments.some((m) => m.endMs > atMs && LEVEL_ORDER[m.level] >= LEVEL_ORDER.medium);
  return unseen ? 'success' : null;
}
