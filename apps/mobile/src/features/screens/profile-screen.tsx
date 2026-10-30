import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { Medal, TeamEmblem } from '@/components/art';
import { FadeUp, ProgressRing, ShimmerSkeleton, Stagger } from '@/components/motion';
import { OfflineNotice } from '@/components/offline-notice';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SettingsRow } from '@/components/settings-row';
import { PlayerCard } from '@/components/player-card';
import { StatTile } from '@/components/stat-tile';
import { Text } from '@/components/text';
import { districtsExploration } from '@/domain/games';
import { formatKm } from '@/domain/geo';
import { levelProgress, titleForLevel } from '@/domain/progression';
import { useEngagementData } from '@/features/engagement';
import { formatInt, NO_DATA } from '@/features/format';
import { mergeHistory } from '@/features/run/history-model';
import { useNow } from '@/features/use-now';
import { listMyActivities } from '@/services/api/activities-repo';
import { useGame } from '@/store/game-store';
import { useSession } from '@/store/session-store';
import { neonTeam } from '@/theme/neon';
import { factions, fonts, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { conqueredZones, initialsOf, medalShelf, weekKm } from './profile-screen.model';
import { useResource } from './use-resource';

/** Rotas da aba "Você" (D-73). */
export const VOCE_ROUTES = { ajustes: '/perfil/ajustes', corridas: '/perfil/atividades', time: '/perfil/time' } as const;

const RING = 72;
const AVATAR = 56;

/**
 * "Você" (T7.3.1, wireframe 13): o cartão de jogador é o herói (anel de nível, título e mascote), depois 3 números
 * grandes, a estante de medalhas e os atalhos. Os ajustes moram atrás da engrenagem do cabeçalho.
 * Nenhum número é inventado: tudo sai das corridas, das zonas e do Atlas reais (D-76).
 */
export function ProfileScreen() {
  const { colors } = useTheme();
  const name = useGame((s) => s.name);
  const gameFaction = useGame((s) => s.faction);
  const xp = useGame((s) => s.xp);
  const fog = useGame((s) => s.fog);
  const streakWeeks = useGame((s) => s.streakWeeks);
  const serverRuns = useGame((s) => s.serverRuns);
  const localRuns = useGame((s) => s.localRuns);
  const profile = useSession((s) => s.profile);
  const profileError = useSession((s) => s.profileError);
  const profileSavedAt = useSession((s) => s.profileSavedAt);
  const historySync = useGame((s) => s.sync.history);
  const fogSync = useGame((s) => s.sync.fog);
  const userId = useSession((s) => s.session?.userId ?? null);
  const now = useNow(60_000);
  const { track } = useEngagementData();
  // Histórico inteiro só para os números desta tela (o store guarda o período escolhido nas Corridas).
  const all = useResource(() => listMyActivities({ limit: 200 }), [userId]);

  const faction = gameFaction ?? profile?.faction ?? 'striders';
  const team = factions[faction];
  const display = name || profile?.username || 'Corredor';
  const lvl = levelProgress(xp); // D-92: a mesma curva do servidor e das Recompensas
  const runsSource = all.data ?? serverRuns;
  const history = mergeHistory(runsSource, localRuns);
  const counted = history.filter((h) => h.counts);
  const zones = conqueredZones(runsSource);
  const totalKm = history.filter((h) => h.tag !== 'rejeitada' && h.tag !== 'erro').reduce((s, h) => s + h.meters, 0);
  const week = weekKm(history, now);
  const atlas = districtsExploration(fog)[0]?.pct ?? 0;
  const shelf = medalShelf({ runs: counted.length, zones, atlasCells: fog.length, streakWeeks });
  const season = track.data;
  // D-95: número só quando ele é conhecido (do servidor, agora ou antes); carregando = esqueleto; falhou = "—".
  const runsKnown = all.data !== null || historySync.at !== null;
  const runsFailed = !runsKnown && (all.error !== null || historySync.failed);
  const atlasKnown = fogSync.at !== null;
  const notice = all.error ?? (profile && profileError ? profileError : null);
  const noticeSavedAt = all.error ? (all.savedAt ?? historySync.at) : (profileSavedAt ?? null);
  const tiles: { testID: string; label: string; value: string; unit?: string; accent?: string; known: boolean; failed: boolean }[] = [
    { testID: 'perfil-km', label: 'Distância', value: formatKm(totalKm, totalKm >= 100_000 ? 0 : 1), unit: 'km', known: runsKnown, failed: runsFailed },
    { testID: 'perfil-zonas', label: 'Zonas', value: formatInt(zones), accent: neonTeam[faction], known: runsKnown, failed: runsFailed },
    { testID: 'perfil-atlas', label: 'Atlas', value: String(atlas), unit: '% do bairro', known: atlasKnown, failed: !atlasKnown && (fogSync.failed || notice !== null) },
  ];

  const avatar = profile?.avatarUrl ? (
    <Image testID="perfil-avatar-foto" source={{ uri: profile.avatarUrl }} style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 }} contentFit="cover" />
  ) : (
    <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: team.color }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 26 }} color={team.onColor} maxFontSizeMultiplier={1}>
        {initialsOf(display)}
      </Text>
    </View>
  );

  return (
    <ScreenScroll testID="tela-perfil" edges={[]} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      {notice ? (
        <OfflineNotice
          testID="perfil-sem-conexao"
          code={notice.code}
          hasData={all.error ? runsKnown : true}
          savedAt={noticeSavedAt}
          onRetry={() => void all.reload()}
          busy={all.loading}
        />
      ) : null}
      <FadeUp>
        <PlayerCard
          testID="perfil-cartao"
          name={display}
          faction={faction}
          level={lvl.level}
          xp={{ into: lvl.intoLevel, needed: lvl.needed }}
          title={titleForLevel(lvl.level).name}
          avatar={avatar}
          ring={
            <ProgressRing
              testID="perfil-anel-nivel"
              value={lvl.needed > 0 ? lvl.intoLevel / lvl.needed : 0}
              size={RING}
              stroke={5}
              color={neonTeam[faction]}
              trackColor={colors.surfaceSunken}
              delay={200}
              accessibilityLabel={`Nível ${lvl.level}: ${lvl.intoLevel} de ${lvl.needed} XP`}
            />
          }
          mascot={<TeamEmblem team={faction} size={72} variant="medio" />}
          onPress={() => router.push('/recompensas' as Href)}
        />
      </FadeUp>

      <Stagger delay={120} style={{ flexDirection: 'row', gap: space[2] }} itemStyle={{ flex: 1 }}>
        {tiles.map((t) =>
          t.known || t.failed ? (
            <StatTile key={t.testID} testID={t.testID} label={t.label} value={t.known ? t.value : NO_DATA} unit={t.known ? t.unit : undefined} accent={t.known ? t.accent : undefined} />
          ) : (
            <ShimmerSkeleton key={t.testID} testID={`${t.testID}-carregando`} shape="card" height={88} accessibilityLabel={`Carregando ${t.label.toLowerCase()}`} />
          ),
        )}
      </Stagger>

      <FadeUp delay={200} style={{ gap: space[2] }}>
        <SectionHeader
          testID="perfil-medalhas-titulo"
          title="Medalhas"
          action={
            // Carregando: nada (o esqueleto está logo abaixo); falhou: "—"; nunca "0 de 4".
            runsKnown || runsFailed ? (
              <Text testID="perfil-medalhas-contagem" variant="bodyBold" color={colors.accentText} tabular>
                {runsKnown ? `${shelf.earned} de ${shelf.total}` : NO_DATA}
              </Text>
            ) : undefined
          }
        />
        {runsKnown ? (
          <View testID="perfil-medalhas" style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[1] }}>
            {shelf.medals.map((m) => (
              <Medal key={m.kind} kind={m.kind} tier={m.tier} locked={m.locked} size={64} quality="leve" />
            ))}
          </View>
        ) : runsFailed ? null : (
          <ShimmerSkeleton testID="perfil-medalhas-carregando" shape="card" height={64} accessibilityLabel="Carregando as medalhas" />
        )}
      </FadeUp>

      <FadeUp delay={260}>
        <View style={{ borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
          <SettingsRow
            testID="voce-atividades"
            icon="activities"
            title="Corridas"
            value={week.total > 0 ? `${formatKm(week.total * 1000, 1)} km na semana` : undefined}
            accessibilityLabel={week.total > 0 ? `Corridas, ${formatKm(week.total * 1000, 1)} quilômetros nesta semana` : 'Corridas'}
            onPress={() => router.push(VOCE_ROUTES.corridas as Href)}
          />
          <SettingsRow testID="perfil-time" icon="flag" title="Meu time" value={team.name} onPress={() => router.push(VOCE_ROUTES.time as Href)} />
          <SettingsRow testID="perfil-missoes" icon="trophy" title="Missões" onPress={() => router.push('/missoes' as Href)} />
          <SettingsRow
            testID="perfil-recompensas"
            icon="chest"
            title="Recompensas"
            value={season ? `degrau ${season.step} de ${season.steps}` : undefined}
            onPress={() => router.push('/recompensas' as Href)}
          />
        </View>
      </FadeUp>
    </ScreenScroll>
  );
}
