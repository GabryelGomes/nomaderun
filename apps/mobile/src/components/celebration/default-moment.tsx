import { type ReactNode } from 'react';

import { neon, neonTeam } from '@/theme/neon';
import { factions } from '@/theme/tokens';

import { BossDefeated, BossHit } from './boss';
import { type MomentContext } from './celebration-sequence';
import { ChestOpening } from './chest-opening';
import { RARITY_COLORS } from './choreography';
import { LevelUp, PRStamp, StreakFlame } from './progress-moments';
import { type ScheduledMoment } from './queue';
import { RewardToast } from './reward-toast';
import { ZoneCaptured } from './zone-captured';

/** Arte da E4 por props (onda 2). Sem arte, os momentos usam marcadores geométricos provisórios. */
export type CelebrationArt = {
  chest?: ReactNode;
  lid?: ReactNode;
  item?: ReactNode;
  boss?: ReactNode;
  bossFlash?: ReactNode;
  flame?: ReactNode;
  ice?: ReactNode;
};

const km = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Desenho padrão de cada tipo de momento, para usar como `renderMoment` do `CelebrationSequence`. A tela
 * pode trocar qualquer tipo pelo seu próprio desenho.
 */
export function renderCelebrationMoment(art: CelebrationArt = {}) {
  return function render(moment: ScheduledMoment, ctx: MomentContext): ReactNode {
    const p = ctx.props;
    const e = moment.events[0];
    if (moment.kind === 'group' || !e) {
      return <RewardToast {...p} size="small" placement="center" autoHide={false} color={neon.orange} title={`+${moment.events.length} conquistas`} subtitle={moment.events.map((x) => x.label).join(' · ')} />;
    }
    switch (e.kind) {
      case 'zone-captured':
        return <ZoneCaptured {...p} context="summary" faction={e.payload.faction} zone={e.payload.zone} points={e.payload.points} />;
      case 'zone-defended':
        return <RewardToast {...p} size="small" placement="center" autoHide={false} color={neonTeam[e.payload.faction]} title="Zona defendida" subtitle={e.payload.zone} />;
      case 'zone-milestone':
        return <RewardToast {...p} size="small" placement="center" autoHide={false} color={neon.orange} title={`${Math.round(e.payload.fraction * 100)}% da zona`} subtitle={e.payload.zone} />;
      case 'chest':
        return <ChestOpening {...p} rarity={e.payload.rarity} xp={e.payload.xp} odds={e.payload.odds} chest={art.chest} lid={art.lid} item={art.item} />;
      case 'boss-hit':
        return (
          <BossHit
            {...p}
            bossName={e.payload.boss}
            boss={art.boss}
            bossFlash={art.bossFlash}
            hpFrom={e.payload.hpBefore}
            hpTo={e.payload.hpAfter}
            hpMax={e.payload.hpMax}
            damageLabel={`−${km(e.payload.damageKm)} km`}
            mineLabel={`Sua parte: ${km(e.payload.damageKm)} km`}
          />
        );
      case 'boss-defeated':
        return <BossDefeated {...p} bossName={e.payload.boss} boss={art.boss} bossFlash={art.bossFlash} city={e.payload.city} myKm={e.payload.myKm} />;
      case 'xp':
        return <RewardToast {...p} size="small" placement="center" autoHide={false} color={neon.orange} title="XP" value={`+${e.payload.gained} XP`} />;
      case 'level-up':
        return <LevelUp {...p} level={e.payload.level} title={e.payload.title} />;
      case 'streak':
        return <StreakFlame {...p} weeks={e.payload.weeks} status={e.payload.state} flame={art.flame} ice={art.ice} />;
      case 'personal-record':
        return <PRStamp {...p} metric={`${e.payload.metric}: ${e.payload.value}`} />;
      case 'mission':
        return <RewardToast {...p} size="small" placement="center" autoHide={false} color={neon.orange} title="Missão concluída" subtitle={e.payload.title} value={`+${e.payload.xp} XP`} />;
      case 'medal':
        return <RewardToast {...p} size="medium" placement="center" autoHide={false} color={RARITY_COLORS.lendario} title="Medalha nova" subtitle={e.payload.name} />;
      case 'league-up':
        return <RewardToast {...p} size="medium" placement="center" autoHide={false} color={neon.orange} title="Subiu na liga" value={`${e.payload.previous}º → ${e.payload.position}º`} />;
      case 'team-confirm':
        return <RewardToast {...p} size="epic" placement="center" autoHide={false} color={neonTeam[e.payload.faction]} title={factions[e.payload.faction].name} />;
    }
  };
}
