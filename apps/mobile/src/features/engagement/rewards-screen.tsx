import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Chest, EmptyArt, Medal } from '@/components/art';
import { Button } from '@/components/button';
import { ChestOpening, RARITY_COLORS } from '@/components/celebration';
import { DemoBadge } from '@/components/demo-badge';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { PressableScale, ProgressBar, ShimmerSkeleton } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import type { ChestRarity } from '@/domain/games';
import { brtCalendar } from '@/domain/progression';
import type { DailyChestOpening, DailyChestState, EngagementStatus, SeasonTrack, TrackStep } from '@/services/api/engagement-repo';
import type { Slot } from '@/store/engagement-store';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { claimSeasonStep, openStoredChests } from './controller';
import { COSMETICS, howToEarn, SHOWN_SLOTS, SLOT_LABELS } from './cosmetics';
import { HealthPauseSheet } from './health-pause-sheet';
import { useEngagementData } from './hooks';
import { chestRefusal, fmtInt, oddsRows, pauseActive, pityLabel, RARITY_LABEL, shortDate, storedLabel, trackItemLabel, trackWindow } from './model';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthOf = (seasonId: string) => MONTHS[Number(seasonId.slice(5, 7)) - 1] ?? 'mês';
const MEDAL_TIER = { bronze: 1, prata: 2, ouro: 3 } as const;
/** E10 (onda 4): item bloqueado continua legível (WCAG AA 4,5:1 com o texto secundário e o laranja sobre o fundo). */
const LOCKED_OPACITY = 0.8;
const RANK: Record<ChestRarity, number> = { comum: 0, raro: 1, lendario: 2 };

function LevelCard({ s, now, onPause }: { s: EngagementStatus; now: number; onPause: () => void }) {
  const { colors } = useTheme();
  const paused = pauseActive(s.streak.pause, now);
  return (
    <Surface>
      <View testID="recompensas-nivel" accessible accessibilityLabel={`Nível ${s.level}, ${s.title.name}. ${s.isMax ? 'Nível máximo' : `${s.intoLevel} de ${s.needed} XP para o próximo`}`} style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
          <Text variant="metric" color={colors.accentText} tabular>
            {String(s.level)}
          </Text>
          <View style={{ flex: 1 }}>
            <Text variant="label" muted style={{ textTransform: 'uppercase' }}>
              Nível
            </Text>
            <Text variant="title" numberOfLines={1}>
              {s.title.name}
            </Text>
          </View>
        </View>
        <ProgressBar value={s.isMax ? 1 : s.intoLevel / Math.max(1, s.needed)} color={colors.action} trackColor={colors.surfaceSunken} height={10} glow accessibilityLabel={`Progresso do nível: ${fmtInt(s.intoLevel)} de ${fmtInt(s.needed)} XP`} />
        <Text variant="caption" muted>
          {s.isMax ? 'Nível máximo. Cada XP vira estrela na trilha.' : `${fmtInt(s.needed - s.intoLevel)} XP para o nível ${s.level + 1}`}
        </Text>
      </View>
      {s.band ? (
        <View testID="recompensas-faixa" accessible accessibilityLabel={`Faixa ${s.band.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="route" size={18} color={colors.textSecondary} />
          <Text variant="small" style={{ flex: 1 }}>
            {s.band.nextName ? `Faixa ${s.band.name} · ${fmtInt(s.band.metersToNext / 1000)} km para ${s.band.nextName}` : `Faixa ${s.band.name}`}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon name="fire" size={18} color={colors.accentText} />
        <Text testID="recompensas-sequencia" variant="small" style={{ flex: 1 }}>
          {paused
            ? `Pausa de saúde até ${shortDate(s.streak.pause!.until)}`
            : `${s.streak.weeks} ${s.streak.weeks === 1 ? 'semana' : 'semanas'} seguidas · ${s.streak.activitiesThisWeek >= 2 ? 'semana garantida' : `${s.streak.activitiesThisWeek} de 2 nesta`}`}
        </Text>
        <Button testID="recompensas-pausa" label={paused ? 'Ver pausa' : 'Pausar'} kind="ghost" icon="heart" onPress={onPause} />
      </View>
    </Surface>
  );
}

function ChestSection({ slot, ranToday, onOpened }: { slot: Slot<DailyChestState>; ranToday: boolean; onOpened: (o: DailyChestOpening) => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState<DailyChestOpening | null>(null);
  const c = slot.data;
  if (slot.status === 'unavailable') {
    return <EmptyState compact testID="recompensas-bau-indisponivel" tag="Em breve" title="Baú do dia em breve" art={<Chest rarity="comum" size={72} />} />;
  }
  if (!c) return <ShimmerSkeleton shape="card" height={160} accessibilityLabel="Carregando o baú do dia" />;
  const total = c.stored + c.bonus.length;
  const art: ChestRarity[] = [...c.bonus, ...Array.from({ length: c.stored }, () => 'comum' as const)].slice(0, 4);
  const best = opening?.prizes.reduce<ChestRarity>((r, p) => (RANK[p.rarity] > RANK[r] ? p.rarity : r), 'comum');

  const open = async () => {
    setBusy(true);
    setMessage(null);
    const res = await openStoredChests();
    setBusy(false);
    if (res.ok) {
      setOpening(res.data);
      onOpened(res.data);
    } else setMessage(chestRefusal(res.error.detail));
  };

  return (
    <Surface>
      <View testID="recompensas-bau" style={{ gap: space[3] }}>
        {opening && best ? (
          <View style={{ gap: space[2] }}>
            <ChestOpening
              testID="recompensas-bau-abrindo"
              compact
              rarity={best}
              xp={opening.prizes.reduce((s, p) => s + p.xp, 0)}
              odds={opening.odds}
              chest={<Chest rarity={best} state="aberto" size={110} decorative />}
              lid={<View />}
            />
            {opening.prizes.map((p) => (
              <Text key={`${p.bonus ? 'b' : 'd'}${p.n}`} variant="small" color={RARITY_COLORS[p.rarity]}>
                {`Baú ${RARITY_LABEL[p.rarity].toLowerCase()}${p.bonus ? ' bônus' : ''}: +${p.xp} XP${p.guaranteed ? ' (garantido)' : ''}`}
              </Text>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row' }}>
              {(art.length ? art : (['comum'] as ChestRarity[])).map((r, i) => (
                <View key={`${r}-${i}`} style={{ marginLeft: i === 0 ? 0 : -18, opacity: art.length ? 1 : 0.4 }}>
                  <Chest rarity={r} size={64} />
                </View>
              ))}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text testID="recompensas-bau-guardados" variant="bodyBold">
                {storedLabel(c)}
              </Text>
              <Text variant="caption" muted>
                {c.openedToday ? 'Amanhã tem mais 1.' : `Guarda até ${c.maxStored}. Abre com 1 km.`}
              </Text>
            </View>
          </View>
        )}
        {/* Só com atividade hoje: sem ela o servidor recusaria (a corrida de 1 km já abre sozinha). */}
        {!opening && total > 0 && !c.openedToday && ranToday ? (
          <Button testID="recompensas-bau-abrir" label={total === 1 ? 'Abrir baú' : 'Abrir baús'} icon="chest" wide disabled={busy} busy={busy} onPress={() => void open()} />
        ) : null}
        {message ? (
          <Text testID="recompensas-bau-mensagem" variant="small" accessibilityLiveRegion="polite" color={colors.textSecondary}>
            {message}
          </Text>
        ) : null}
        <View testID="recompensas-chances" accessible accessibilityLabel={`Chances do baú: ${oddsRows(c).map((o) => `${o.label} ${o.chance}, ${o.xp}${o.cosmetic ? `, ${o.cosmetic}` : ''}`).join('; ')}`} style={{ gap: space[1], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>
          <Text variant="label" muted style={{ textTransform: 'uppercase' }}>
            Chances
          </Text>
          {oddsRows(c).map((o) => (
            <View key={o.rarity} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: RARITY_COLORS[o.rarity] }} />
              <Text variant="small" style={{ flex: 1 }}>
                {o.label}
              </Text>
              <Text variant="bodyBold" tabular style={{ minWidth: 48, textAlign: 'right' }}>
                {o.chance}
              </Text>
              <Text variant="small" muted tabular style={{ minWidth: 56, textAlign: 'right' }}>
                {o.xp}
              </Text>
              <Text variant="caption" muted style={{ minWidth: 64, textAlign: 'right' }}>
                {o.cosmetic ? o.cosmetic.replace(' de item', ' item') : '—'}
              </Text>
            </View>
          ))}
          <Text variant="caption" muted>
            {pityLabel(c.pityLeft)}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

function StepCard({ step, current, onClaim, busy }: { step: TrackStep; current: boolean; onClaim: (n: number) => void; busy: boolean }) {
  const { colors } = useTheme();
  const medal = step.items.find((i) => i.kind === 'medal');
  const label = step.items.map(trackItemLabel).join(' + ');
  const state = step.claimed ? 'Resgatado' : step.unlocked ? 'Pronto para resgatar' : 'Bloqueado';
  const body = (
    <>
      <Text variant="caption" muted tabular>{`Degrau ${step.step}`}</Text>
      <View aria-hidden style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
        {medal ? (
          <Medal kind="temporada" tier={MEDAL_TIER[medal.medalTier ?? 'bronze']} locked={!step.unlocked} size={44} />
        ) : step.items[0]?.kind === 'chest' ? (
          <Chest rarity={step.items[0].rarity ?? 'comum'} size={44} />
        ) : (
          <Icon name={step.claimed ? 'check' : step.unlocked ? 'diamond' : 'lock'} size={24} color={step.unlocked ? colors.accentText : colors.textSecondary} />
        )}
      </View>
      <Text variant="small" numberOfLines={2} style={{ textAlign: 'center' }}>
        {label}
      </Text>
      <Text variant="caption" color={step.unlocked && !step.claimed ? colors.accentText : colors.textSecondary}>
        {step.claimed ? 'Resgatado' : step.unlocked ? 'Resgatar' : ' '}
      </Text>
    </>
  );
  const style = {
    width: 112,
    minHeight: 150,
    alignItems: 'center' as const,
    gap: space[1],
    padding: space[2],
    borderRadius: radius.md,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: current || (step.unlocked && !step.claimed) ? colors.action : colors.line,
    backgroundColor: step.unlocked && !step.claimed ? neon.activeFill : colors.surface,
    opacity: step.unlocked ? 1 : LOCKED_OPACITY,
  };
  return step.unlocked && !step.claimed ? (
    <PressableScale testID={`trilha-resgatar-${step.step}`} accessibilityLabel={`Resgatar degrau ${step.step}: ${label}`} disabled={busy} onPress={() => onClaim(step.step)} style={style}>
      {body}
    </PressableScale>
  ) : (
    <View testID={`trilha-degrau-${step.step}`} accessible accessibilityLabel={`Degrau ${step.step}: ${label}. ${state}`} style={style}>
      {body}
    </View>
  );
}

function TrackSection({ slot }: { slot: Slot<SeasonTrack> }) {
  const { colors } = useTheme();
  const scroller = useRef<ScrollView>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const t = slot.data;
  if (slot.status === 'unavailable') return <EmptyState compact testID="recompensas-trilha-indisponivel" tag="Em breve" title="Trilha da temporada em breve" art={<Medal kind="temporada" size={72} />} />;
  if (!t) return <ShimmerSkeleton shape="card" height={200} accessibilityLabel="Carregando a trilha" />;
  const claim = async (n: number) => {
    setBusy(true);
    setMessage(null);
    const res = await claimSeasonStep(n);
    setBusy(false);
    setMessage(res.ok ? `Resgatado: ${res.data.items.map(trackItemLabel).join(' + ') || 'já era seu'}` : res.error.message);
  };
  const pending = t.rewards.filter((r) => r.unlocked && !r.claimed).length;
  return (
    <View testID="recompensas-trilha" style={{ gap: space[2] }}>
      <SectionHeader title={`Trilha de ${monthOf(t.seasonId)}`} testID="recompensas-trilha-titulo" />
      <ProgressBar
        value={Math.min(1, (t.step + (t.step < t.steps ? t.intoStep / t.stepXp : 0)) / t.steps)}
        color={colors.action}
        trackColor={colors.surfaceSunken}
        height={10}
        milestones={[8 / 24, 16 / 24]}
        accessibilityLabel={`Trilha: degrau ${t.step} de ${t.steps}`}
      />
      <Text variant="caption" muted>
        {t.step >= t.steps
          ? `Trilha completa! ${t.prestigeStars} ${t.prestigeStars === 1 ? 'estrela' : 'estrelas'} extra.`
          : `Degrau ${t.step} de ${t.steps} · faltam ${t.stepXp - t.intoStep} XP`}
        {pending > 0 ? ` · ${pending} para resgatar` : ''}
      </Text>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Abre perto do degrau atual (o próximo a alcançar fica à vista).
        onLayout={() => all && scroller.current?.scrollTo({ x: Math.max(0, (t.step - 1) * 120), animated: false })}
        contentContainerStyle={{ gap: space[2], paddingVertical: space[1] }}>
        {(all ? t.rewards : trackWindow(t.rewards, t.step)).map((r) => (
          <StepCard key={r.step} step={r} current={r.step === t.step + 1} onClaim={claim} busy={busy} />
        ))}
      </ScrollView>
      <Button testID="recompensas-trilha-ver-toda" label={all ? 'Mostrar menos' : `Ver os ${t.steps} degraus`} kind="ghost" onPress={() => setAll((v) => !v)} />
      {message ? (
        <Text testID="recompensas-trilha-mensagem" variant="small" accessibilityLiveRegion="polite" color={colors.textSecondary}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function CosmeticsSection({ owned }: { owned: Set<string> | null }) {
  const [open, setOpen] = useState(false);
  const shown = COSMETICS.filter((c) => SHOWN_SLOTS.includes(c.slot));
  const mine = owned ? shown.filter((c) => owned.has(c.id)).length : null;
  return (
    <View testID="recompensas-cosmeticos" style={{ gap: space[3] }}>
      <SectionHeader title="Cosméticos" testID="recompensas-cosmeticos-titulo" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text testID="recompensas-cosmeticos-resumo" variant="small" style={{ flex: 1 }}>
          {mine === null ? 'Seus itens aparecem quando o servidor liberar.' : `${mine} de ${shown.length} são seus`}
        </Text>
        <Button testID="recompensas-cosmeticos-ver-todos" label={open ? 'Mostrar menos' : 'Ver todos'} kind="secondary" onPress={() => setOpen((v) => !v)} />
      </View>
      {open ? <CosmeticsCatalog owned={owned} /> : null}
    </View>
  );
}

/** Catálogo completo, atrás de "Ver todos" (cada item com "como ganhar"). */
function CosmeticsCatalog({ owned }: { owned: Set<string> | null }) {
  const { colors } = useTheme();
  return (
    <View testID="recompensas-cosmeticos-catalogo" style={{ gap: space[3] }}>
      {SHOWN_SLOTS.map((slot) => {
        const items = COSMETICS.filter((c) => c.slot === slot);
        const mine = owned ? items.filter((c) => owned.has(c.id)).length : 0;
        return (
          <View key={slot} style={{ gap: space[2] }}>
            <Text variant="bodyBold">{owned ? `${SLOT_LABELS[slot]} · ${mine} de ${items.length}` : SLOT_LABELS[slot]}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {items.map((c) => {
                const has = owned?.has(c.id) ?? false;
                return (
                  <View
                    key={c.id}
                    testID={`cosmetico-${c.id}`}
                    accessible
                    accessibilityLabel={`${c.name}, ${RARITY_LABEL[c.rarity].toLowerCase()}. ${has ? 'É seu' : `Como ganhar: ${howToEarn(c)}`}`}
                    style={{
                      minWidth: 140,
                      flexGrow: 1,
                      flexBasis: '45%',
                      gap: 2,
                      padding: space[2],
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: has ? RARITY_COLORS[c.rarity] : colors.line,
                      backgroundColor: has ? colors.surface : 'transparent',
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon name={has ? 'check' : 'lock'} size={14} color={has ? RARITY_COLORS[c.rarity] : colors.textSecondary} />
                      <Text variant="small" numberOfLines={1} style={{ flex: 1 }} color={has ? colors.text : colors.textSecondary}>
                        {c.name}
                      </Text>
                    </View>
                    <Text variant="caption" muted numberOfLines={1}>
                      {has ? RARITY_LABEL[c.rarity] : howToEarn(c)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** `/recompensas` (E7, T7.2.4): nível, sequência e pausa, baú do dia com chances visíveis, trilha e cosméticos. */
export function RewardsScreen() {
  const { status, chest, track, now, refresh, demo } = useEngagementData();
  const [refreshing, setRefreshing] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };
  const owned = status.data?.cosmetics ? new Set(status.data.cosmetics.map((c) => c.id)) : null;
  const allUnavailable = chest.status === 'unavailable' && track.status === 'unavailable' && !status.data;

  return (
    <ScreenScroll testID="tela-recompensas" edges={['bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}>
      <Stack.Screen options={{ title: 'Recompensas' }} />
      {demo ? <DemoBadge testID="recompensas-demonstracao" /> : null}

      {allUnavailable ? (
        <EmptyState testID="recompensas-indisponivel" tag="Em breve" title="Recompensas em breve" body="O servidor ainda não liberou baús e trilha." art={<EmptyArt kind="sem-medalhas" size={160} />} />
      ) : null}

      {status.status === 'error' && !status.data ? (
        <EmptyState testID="recompensas-erro" compact title="Não deu para carregar" body={status.error?.message} action={<Button testID="recompensas-tentar" label="Tentar de novo" onPress={() => void refresh()} />} />
      ) : null}

      {status.data ? <LevelCard s={status.data} now={now} onPause={() => setPauseOpen(true)} /> : status.status === 'loading' || status.status === 'idle' ? <ShimmerSkeleton shape="card" height={150} accessibilityLabel="Carregando o nível" /> : null}

      <SectionHeader title="Baú do dia" testID="recompensas-bau-titulo" />
      <ChestSection slot={chest} ranToday={status.data?.lastActivityAt != null && brtCalendar.clock(status.data.lastActivityAt).dayId === brtCalendar.clock(now).dayId} onOpened={() => undefined} />

      <TrackSection slot={track} />

      <CosmeticsSection owned={owned} />

      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        Tudo se ganha correndo. Nada aqui é vendido.
      </Text>

      <HealthPauseSheet visible={pauseOpen} onClose={() => setPauseOpen(false)} />
    </ScreenScroll>
  );
}
