# Contrato v2 do domain para a E9 (T7.1.5)

> Equipe E3 · Fase 7, onda 1 · 23/10/2026
> Código: `apps/mobile/src/domain/{paint,live-events,raid,league}.ts` + funções v2 em `territory.ts`, `scoring.ts`, `run-engine.ts`, `games.ts`, `grid.ts` e `season.ts`.
> Tudo já está exportado pela ponte `supabase/functions/_shared/domain.ts`: importe de `'../_shared/domain.ts'`.

## 0. Regra de ouro: a v1 não mudou

Nenhuma função que a gravação v1 do servidor usa mudou de comportamento. **Diff de comportamento: nenhum.**

| Função v1 | O que aconteceu | Substituta v2 |
|---|---|---|
| `finishRun` | refatorada por dentro (mesmas regras; `validPath` em O(n), E-11); resultado idêntico, coberto pelos testes antigos e por um teste de equivalência com a versão O(n²) | `finishRunV2` |
| `scoreZone`, `streakMultiplier` | iguais, `@deprecated` | `scoreZoneV2`, `scoreRunV2` |
| `resolveZone`, `applyRunPoints`, `isUnderAttack`, `seasonReset` | iguais, `@deprecated` | `resolveZoneV2`, `applyRunPointsV2`, `isUnderAttackAt`, `seasonResetV2` |
| `leagueOutcome` (games.ts) | igual, `@deprecated` | `leagueStandingsV2` (league.ts) |
| `addPoint` | igual | `appendPoint` (sem copiar o vetor, E-12) |

Os jobs SQL atuais (decaimento, fortificar, temporada) continuam espelhando as constantes v1, sem mudança.

## 1. O que a gravação v2 (`finish-activity`) chama, em ordem

Dentro do cálculo oficial (hoje `computeOfficialResult` em `_shared/scoring.ts`), **depois** do `finishRun` v1, que continua gravando a influência enquanto `territory_rule = 'v1'`:

```ts
import {
  applyPaint, applyRaidHit, basePace, leaguePlaceNewcomer, leagueWeek, paintCellsOfRun,
  raidDamage, scoreRunV2, type PaintWorld,
} from './domain.ts';

// 1. v1, sem mudança (influência, XP, Neblina, baús)
const result = finishRun(run, ctx);
const scored = status === 'valid' || status === 'partial';

// 2. Trechos da corrida (só passos válidos; rejeitada → [])
const cells = scored ? paintCellsOfRun(geo, result.validation) : [];

// 3. Pintura (modo sombra ou v2, pela flag territory_rule)
//    world.cells = TODOS os trechos de zone_cells das zonas tocadas (zone_id in zonas de `cells`)
//    world.zones = linhas das zonas tocadas, mapeadas para ZonePaint (seção 3.2)
//    paintedToday = trechos deste usuário hoje (tabela paint_marks, seção 3.1)
const paint = applyPaint(world, { cells, faction, now, paintedToday, blockedZones });
//    grava: upsert paint.updatedCells; update das zonas de paint.updatedZones (trava por version);
//           insert paint.paintedCells em paint_marks; notificações de paint.events (mesmos tipos da v1)
//    compatibilidade com o app antigo: zones.influence[f] = countsAfter[f] × 10, zones.owner = ownerAfter

// 4. Pontos v2 (ranking, Liga, Cidade × Cidade) — sem sequência e sem fantasma (D-63, E-15)
const points = scoreRunV2({
  zoneMeters: Object.fromEntries(result.zones.map((z) => [z.zoneId, z.meters])),
  paceSecPerKm: result.avgPace,
  basePaceSecPerKm: basePace(input.recentPaces),
  packZones, earnedTodayByZone, blockedZones,
});
//    Liga: league_entries.points += points.total; reached_at = now (desempate)

// 5. Raid (se houver chefão ativo na cidade)
const hit = raidDamage({
  validMeters: result.meters,
  weakPointMeters: result.zones.filter((z) => weakZones.has(z.zoneId)).reduce((s, z) => s + z.meters, 0),
  phase: raid.phase, inPack: pack !== null, seed: activityId,
  damageToday, kmToday,                 // soma de raid_hits do usuário no dia (Brasília)
});
//    gravação atômica e idempotente por activity_id: RPC raid_hit (seção 4.2), que espelha applyRaidHit
```

`finishRunV2(run, ctx)` também existe: devolve o mesmo `RunResult` com pontos v2, território por influência **com as correções** (E-03, E-06, E-07) e `paintCells`. Use-o só se decidirem que, antes da virada para a pintura, a influência também deve ganhar as correções (precisa de flag própria; recomendo não ligar, para não mexer em duas regras ao mesmo tempo).

## 2. Assinaturas exatas

### 2.1 Pintura (`paint.ts`, D-62)

```ts
// Constantes (espelhar no SQL — seção 6)
PAINT_CELL_RES = 11; PAINT_MAX_LAYERS = 3; PAINT_FADE_DAYS = 7; PAINT_FADE_MS = 604_800_000;
ZONE_MIN_CELLS = 3; PAINT_INTERP_MAX_M = 100; PAINT_SAMPLE_M = 10; PAINT_CELL_METERS = 40;
PAINT_INHERIT_CELLS = 3; PAINT_INHERIT_MS = PAINT_FADE_MS;
PAINT_ATTACK_RATIO = 0.5; PAINT_ATTACK_FLIPS = 3; PAINT_ATTACK_WINDOW_MS = 86_400_000; PAINT_DEFENSE_RETAKES = 3;
PAINT_DEFAULTS = { reinforceOnConquest: false }   // D-62: parâmetro desligado

type PaintCell = { cell: string; zoneId: string; faction: FactionId; layers: number; paintedAt: number };
type PaintCounts = Record<FactionId, number>;
type PaintInheritance = { faction: FactionId; cells: number; until: number };
type PaintAttack = { attacker: FactionId; since: number; lastAt: number; flips: number };
type ZonePaint = { zoneId: string; owner: FactionId | null; inherited: PaintInheritance | null; attack: PaintAttack | null; blocked?: boolean };
type PaintWorld = { cells: Readonly<Record<string, PaintCell>>; zones: Readonly<Record<string, ZonePaint>> };
type PaintRunInput = { cells: readonly string[]; faction: FactionId; now: number;
  paintedToday?: ReadonlySet<string>; blockedZones?: ReadonlySet<string>; options?: Partial<PaintOptions> };
type PaintRunResult = {
  changes: { cell; zoneId; kind: 'novo'|'reforco'|'virado'|'enfraquecido'; before: {faction, layers} | null; after: {faction, layers} }[];
  skipped: { cell: string; reason: 'bloqueada' | 'hoje' }[];
  zones: { zoneId; ownerBefore; ownerAfter; countsBefore: PaintCounts; countsAfter: PaintCounts;
           outcome: 'conquistada'|'defendida'|'reforcada'|'atacada'|'pintada'; touched: number; flipped: number }[];
  events: ZoneEvent[];            // mesmos tipos de territory.ts: captured | under_attack | defended | neutralized
  updatedCells: PaintCell[];      // upsert
  updatedZones: ZonePaint[];      // update
  paintedCells: string[];         // para paint_marks
};

paintCellOf(p: LatLng): string
paintZoneOf(cell: string): string                       // pai res 9
paintCellsOfRun(points: readonly GeoPoint[], validation: ActivityValidation): string[]
cellsOfSegment(a: LatLng, b: LatLng, meters: number): string[]
effectiveLayers(cell: PaintCell, now: number): number   // 0..3
fadeCell(cell: PaintCell, now: number): PaintCell | null
fadeCells(cells: readonly PaintCell[], now: number): { kept: PaintCell[]; removed: string[] }
seasonResetPaint(cells: readonly PaintCell[], now: number): { kept: PaintCell[]; removed: string[] }
paintTransition(prev: PaintCell | null | undefined, cell: string, faction: FactionId, now: number): { next: PaintCell; kind: PaintKind }
zoneOwnerByCells(counts: PaintCounts, currentOwner: FactionId | null): FactionId | null
zoneCounts(zone: ZonePaint, cells: Iterable<PaintCell>, now: number): PaintCounts
inheritedCells(zone: ZonePaint, now: number): number
conquestGap(counts: PaintCounts, faction: FactionId, currentOwner: FactionId | null): number
paintGapMeters(cells: number): number
paintAttackActive(zone: ZonePaint, now: number): boolean
isZoneUnderAttackV2(zone: ZonePaint, counts: PaintCounts, now: number): boolean
inheritZonesV1(zones: readonly { id; owner; blocked? }[], now: number): ZonePaint[]
newZonePaint(zoneId: string): ZonePaint
refreshZoneOwner(zone: ZonePaint, counts: PaintCounts, now: number): { zone: ZonePaint; events: ZoneEvent[] }
applyPaint(world: PaintWorld, input: PaintRunInput): PaintRunResult
```

**Pré-condição de `applyPaint`:** `world.cells` precisa ter **todos** os trechos das zonas tocadas (não só os da rota), senão o placar sai errado. `applyPaint` não muda `world`.

### 2.2 Eventos ao vivo (`live-events.ts`)

```ts
type CelebrationLevel = 'micro' | 'pequena' | 'media' | 'epica';
LIVE_EVENT_LEVEL: Record<LiveEventType, CelebrationLevel>;   LIVE_PROGRESS_MARKS = [25, 50, 75];
type LiveSnapshot = {
  cells: Record<string, { faction: FactionId; layers: number }>;                        // sem autor e sem hora
  zones: Record<string, { owner: FactionId | null; name?: string | null; inherited?: number; blocked?: boolean; underAttack?: boolean }>;
};
createLiveTracker(opts: { runId: string; faction: FactionId; snapshot: LiveSnapshot;
  paintedToday?: ReadonlySet<string>; firstConquestEver?: boolean }): {
  push(p: GeoPoint): LiveEvent[];
  summary(): { meters; cellsPainted; cellsFlipped; conquered: string[]; defended: string[]; current: LiveZoneState | null; stopped: boolean };
}
```

| Evento (`type`) | Dados além de `runId`, `t`, `atMeters`, `level` | Nível |
|---|---|---|
| `trecho_pintado` | `cell`, `zoneId`, `kind: 'novo'\|'reforco'`, `layers` | micro |
| `trecho_virado` | `cell`, `zoneId`, `from`, `layers: 1` | micro |
| `trecho_enfraquecido` | `cell`, `zoneId`, `owner`, `layersLeft` | micro |
| `zona_entrou` | `zoneId`, `name`, `owner`, `counts`, `gapCells`, `gapMeters`, `mine` | micro |
| `zona_rival_entrou` | os mesmos de `zona_entrou` (sem `mine`) | pequena |
| `zona_progresso` | `zoneId`, `pct: 25\|50\|75`, `gapCells`, `gapMeters` | pequena |
| `faltam_metros` | `zoneId`, `gapCells`, `gapMeters` ("faltam X m") | micro |
| `zona_conquistada` | `zoneId`, `name`, `from`, `counts`, `provisional: true`, `first` | média (épica na 1ª da vida) |
| `zona_defendida` | `zoneId`, `name`, `retaken`, `counts`, `provisional: true` | média |

- `gapCells` é honesto: conta só trechos novos (virar trecho rival pode adiantar, nunca atrasar).
- A previsão é igual à regra oficial (teste de propriedade "previsão = oficial") desde que o retrato tenha o dono coerente com o placar (o servidor monta com `refreshZoneOwner`).
- Desempenho: 15 km a 1 Hz (5.401 pontos) em menos de 200 ms (teste).

### 2.3 Raid (`raid.ts`, D-67)

```ts
RAID_BOSS_IDS = ['soneca', 'rei-buzina', 'fuligem', 'mormaco', 'paredao'];
RAID_DAMAGE_PER_KM = 10; RAID_CRIT_CHANCE = 0.1; RAID_CRIT_MULTIPLIER = 2; RAID_WEAK_POINT_MULTIPLIER = 2;
RAID_PACK_MULTIPLIER = 1.25; RAID_RUN_CAP_KM = 21; RAID_DAILY_CAP_KM = 30; RAID_DAILY_DAMAGE_CAP = 300;
RAID_MIN_HP = 500; RAID_HP_SHARE = 0.75; RAID_HISTORY_WEEKS = 4; RAID_FACTOR_MIN = 0.7; RAID_FACTOR_MAX = 1.5;
RAID_FACTOR_STEP = 0.1; RAID_PHASE2_AT = 0.67; RAID_PHASE3_AT = 0.33; RAID_WEAK_POINTS_PER_DAY = 3; RAID_MIN_REWARD_DAMAGE = 10;
RAID_ROTATION_EPOCH = Date.UTC(2026, 9, 19, 9)   // segunda 19/10/2026 06:00 BRT = semana do 'soneca'

type RaidPhase = 1 | 2 | 3;
type RaidState = { id; bossId: RaidBossId; startsAt; endsAt; hpMax; hp; phase: RaidPhase;
                   status: 'active'|'defeated'|'escaped'; defeatedAt: number | null; finalBlowBy: string | null };

raidWeekWindow(now): { startsAt; endsAt }             // seg 06:00 → dom 21:00 (Brasília)
raidBossForWeek(startsAt): RaidBossId
raidHpFor(cityWeeklyKm: readonly number[], factor = 1): number
raidNextFactor(factor, defeatedAt: number | null, startsAt): number
raidPhase(hp, hpMax): RaidPhase;   raidAdvancePhase(current, hp, hpMax): RaidPhase
newRaid(id, now, cityWeeklyKm, factor = 1): RaidState
raidStatusAt(raid, now): 'upcoming'|'active'|'defeated'|'escaped';   closeRaid(raid, now): RaidState
raidSeededUnit(seed: string): number;   raidCritRoll(seed: string, chance = 0.1): boolean   // usa `crit:${seed}`
raidDamage(input: { validMeters; weakPointMeters?; phase; inPack?; seed; damageToday?; kmToday? }):
  { damage; countedKm; weakKm; crit; pack; capped }
applyRaidHit(raid, damage, now, userId): { raid; applied; phaseChanged; finalBlow }
raidWeakPoints(zoneIds, seed, day: 'YYYY-MM-DD', preferred = new Set(), count = 3): string[]
raidRewardTier(defeatedAt | null, startsAt): { tier: 'lendario'|'raro'|'comum'; chances } | null
raidRewardEligible(raid, myDamage): boolean;   raidShare(my, total): number;   raidDamageSince(hpAtLastVisit, hpNow): number
```

### 2.4 Liga (`league.ts`, D-68)

```ts
LEAGUE_V2_GROUP_MAX = 30; LEAGUE_V2_MOVES_MAX = 5; LEAGUE_V2_MOVE_EVERY = 6; LEAGUE_V2_SMALL_GROUP = 6;
LEAGUE_V2_CLOSE_OFFSET_MS = 12_000_000   // segunda 03:20

leagueWeek(now): { startsAt; closesAt }                 // seg 00:00 → seg seguinte 03:20 (Brasília)
leagueWeekPoints(runPoints: readonly number[]): number
leagueGroupsV2(members: { userId; division; volume }[]): { division; index; members: string[] }[]
leaguePlaceNewcomer(groups, member): { groups; group }  // 1ª corrida da semana
leagueMovesFor(groupSize): number                        // 1 a cada 6, até 5; < 6 → 0
leagueStandingsV2(entries: { userId; points; reachedAt? }[], division): { …; rank; result: 'promoted'|'stays'|'relegated' }[]
leagueNextDivision(division, result): number
```

Grupo pequeno (< 6): só o 1º sobe (se fez ponto) e ninguém desce. Quem fez 0 nunca sobe. Desempate: quem chegou antes aos pontos (`reachedAt`), depois o id.

### 2.5 Outras funções v2

```ts
// scoring.ts (D-63, E-15)
scoreZoneV2({ meters, paceSecPerKm, basePaceSecPerKm, inPack?, defending?, earnedTodayInZone? }): { rp; multipliers: { effort; pack; defense }; capped }
scoreRunV2({ zoneMeters, paceSecPerKm, basePaceSecPerKm, packZones?, earnedTodayByZone?, blockedZones? }): { total; zones: { zoneId; rp; capped }[] }
// territory.ts (E-03, E-06, E-07, E-08)
attackExpired(zone, now); isUnderAttackAt(zone, now); clearExpiredAttack(zone, now): Zone
strongestRivalV2(influence, except): { faction: FactionId | null; value; tied: FactionId[] }
resolveZoneV2(zone, now, actor?): { zone; events };  applyRunPointsV2(zone, faction, rp, now): { zone; events }
seasonResetV2(zone, now): { zone; events }
// run-engine.ts (E-12)
appendPoint(run, p): LiveRun;  finishRunV2(run, ctx): RunResult & { paintCells: string[] }
// games.ts (Fuga e Atlas)
GHOST_LEVELS = ['seu-ritmo', 'desafio', 'recorde']; GHOST_NO_HISTORY_PACE = 450; GHOST_ALLOWED_DEVIATION = 0.2; GHOST_WIN_XP = 50
ghostPaceV2(level, recentPaces): number;  ghostPaceAllowedV2(ghostPace, recentPaces): boolean
districtExploration(revealed, district): { district; revealed; total; pct; milestone };  districtsExploration(revealed); atlasMilestonesCrossed(before, after)
// grid.ts / season.ts
fogCellsInDistrict(district): number;  weekStartBrt(now): number
```

## 3. Banco: o que a pintura precisa (aditivo)

### 3.1 Tabelas

| Tabela | Colunas | Observação |
|---|---|---|
| `zone_cells` | `cell text pk`, `zone_id text not null references zones`, `faction text not null`, `layers smallint check (layers between 1 and 3)`, `painted_at timestamptz not null`, `painted_by uuid`, `season text` | índice por `zone_id`. `painted_at` = `PaintCell.paintedAt` (relógio do desbotar, **não** "última passada de qualquer um"). RLS: cliente nunca lê `painted_by`/`painted_at` |
| `paint_marks` | `user_id uuid`, `day date` (Brasília), `cell text`, pk `(user_id, day, cell)` | "1 camada por corredor por trecho por dia" (`paintedToday`). Limpeza diária do que tem mais de 2 dias |
| `zones` (colunas novas) | `rule_version smallint default 1`, `inherit_faction text`, `inherit_cells smallint`, `inherit_until timestamptz`, `attack_last_at timestamptz`, `attack_flips smallint default 0` | `owner`, `attacker` e `attack_started_at` já existem e são reaproveitados (`PaintAttack.since` = `attack_started_at`) |

### 3.2 Mapeamento linha → domain

```ts
const toZonePaint = (z): ZonePaint => ({
  zoneId: z.id, owner: z.owner, blocked: z.blocked,
  inherited: z.inherit_faction ? { faction: z.inherit_faction, cells: z.inherit_cells, until: Date.parse(z.inherit_until) } : null,
  attack: z.attacker ? { attacker: z.attacker, since: Date.parse(z.attack_started_at), lastAt: Date.parse(z.attack_last_at), flips: z.attack_flips } : null,
});
const toPaintCell = (c): PaintCell => ({ cell: c.cell, zoneId: c.zone_id, faction: c.faction, layers: c.layers, paintedAt: Date.parse(c.painted_at) });
```

### 3.3 RPC `zone_paint_near(lat, lng, radius_m)` → `LiveSnapshot`

- `cells`: `cell`, `faction`, `layers` **efetivas** (`greatest(0, least(3, layers) - floor(extract(epoch from now() - painted_at) / 604800))`, só as > 0). **Sem** `painted_by`/`painted_at`. **Sem** trechos dentro de zonas de privacidade de qualquer pessoa (D-62, seção 7.6 do relatório F1).
- `zones`: `zone_id`, `owner`, `name`, `inherited` (= `inherit_cells` se `now() < inherit_until`, senão 0), `blocked`, `under_attack` (= `isZoneUnderAttackV2`).

## 4. Jobs e RPCs (referência)

### 4.1 Pintura
- **`job_fade_cells`** (diário, 03:00): `fadeCells(cells, now)` → `delete` dos `removed`, `update` dos `kept`; depois, por zona com trecho alterado, `refreshZoneOwner(zone, zoneCounts(zone, cells, now), now)` e notificações dos `events`. SQL equivalente: `layers := layers - floor(dias/7)`, `painted_at := painted_at + floor(dias/7) * 7 dias`, `delete where layers <= 0`. Na v2 ele substitui `job_decay_zones` + `job_fortify_zones` (que continuam para a v1).
- **Virada v1 → v2** (troca de temporada, flag `territory_rule`): `inheritZonesV1(zones, now)` grava `inherit_*` nas zonas com dono; `zone_cells` começa vazia.
- **Temporada na v2**: `seasonResetPaint(cells, now)` (todo trecho vivo volta a 1 camada, `painted_at = now`).

### 4.2 Raid
- **Abrir** (segunda 06:00): `newRaid(id, now, kmSemanaisDaCidade4Semanas, raidNextFactor(anterior.factor, anterior.defeatedAt, anterior.startsAt))`. Guardar `factor` na linha.
- **Pontos fracos** (diário 06:00, fase ≥ 2): `raidWeakPoints(zonasDaCidade, \`${city}:${raidId}\`, 'YYYY-MM-DD', parques)`.
- **Golpe** (no `finish-activity`), atômico e idempotente por `raid_hits.activity_id`:
  ```sql
  update raids set
    hp = greatest(0, hp - $dano),
    phase = greatest(phase, case when greatest(0, hp - $dano)::numeric / hp_max > 0.67 then 1
                                 when greatest(0, hp - $dano)::numeric / hp_max > 0.33 then 2 else 3 end),
    status = case when hp > 0 and hp - $dano <= 0 then 'defeated' else status end,
    defeated_at = case when hp > 0 and hp - $dano <= 0 then now() else defeated_at end,
    final_blow_user = case when hp > 0 and hp - $dano <= 0 then $user else final_blow_user end
  where id = $raid and status = 'active' and now() >= starts_at and now() < ends_at
  returning hp, phase, status;
  ```
  (é o `applyRaidHit`; `$dano` vem de `raidDamage`).
- **Fechar** (domingo 21:00): `closeRaid` → `'escaped'`. **Recompensas**: `raidRewardTier(defeatedAt, startsAt)` + `raidRewardEligible(raid, danoDoUsuario)`.

### 4.3 Liga
- **1ª corrida da semana**: `leaguePlaceNewcomer(gruposDaSemana, { userId, division, volume })`.
- **Fechamento** (segunda 03:20, idempotente pela semana): por grupo, `leagueStandingsV2(entradas, divisão)` → `leagueNextDivision`; depois `leagueGroupsV2` com o volume das 4 últimas semanas para a semana nova.

## 5. Resposta do `finish-activity` (campos novos, opcionais)

O app antigo ignora; o app novo sem esses campos cai no modo atual.

```jsonc
{
  // … campos atuais, sem mudança …
  "paint": {                       // null quando a pintura não rodou (flag desligada, corrida em revisão)
    "rule": "shadow" | "v2",
    "cells": 42, "new": 30, "reinforced": 8, "flipped": 3, "weakened": 1,   // contagens de changes[].kind
    "track": ["8ba8c0ce2c04fff", "…"],     // paintedCells: SÓ para o próprio corredor (resumo e card)
    "zones": [{ "zoneId": "89a8…", "name": "Setor Sul 4", "ownerBefore": "volt", "ownerAfter": "owls",
                "countsBefore": { "striders": 0, "coyotes": 0, "owls": 2, "volt": 4 },
                "countsAfter":  { "striders": 0, "coyotes": 0, "owls": 5, "volt": 3 },
                "outcome": "conquistada", "touched": 5, "flipped": 1 }]
  },
  "points": { "total": 123, "zones": [{ "zoneId": "89a8…", "rp": 80, "capped": false }] },
  "raid": {                        // null sem chefão ativo
    "raidId": "…", "bossId": "mormaco", "damage": 70, "crit": false, "critChance": 0.1,
    "countedKm": 5, "weakKm": 2, "pack": false, "capped": false,
    "hpAfter": 14230, "hpMax": 15000, "phaseAfter": 1, "phaseChanged": false, "finalBlow": false
  },
  "league": { "weekStart": "2026-10-19T03:00:00Z", "points": 340, "rank": 7, "groupSize": 28 }   // null fora da liga
}
```

## 6. Paridade de constantes (teste da T7.2.1)

| Domain | Valor | Onde o SQL usa |
|---|---|---|
| `PAINT_FADE_MS` | 604.800.000 (7 dias) | `job_fade_cells`, `zone_paint_near` |
| `PAINT_MAX_LAYERS` | 3 | `check` de `zone_cells.layers` |
| `ZONE_MIN_CELLS` | 3 | se o SQL recalcular dono (preferir chamar o domain no job) |
| `PAINT_INHERIT_CELLS` / `PAINT_INHERIT_MS` | 3 / 7 dias | virada v1 → v2 |
| `PAINT_ATTACK_WINDOW_MS` | 24 h | `under_attack` do retrato |
| `RAID_DAILY_DAMAGE_CAP` / `RAID_RUN_CAP_KM` / `RAID_DAILY_CAP_KM` | 300 / 21 / 30 | conferência em `raid_hit` |
| `RAID_PHASE2_AT` / `RAID_PHASE3_AT` | 0,67 / 0,33 | `raid_hit` |
| `LEAGUE_V2_GROUP_MAX` | 30 | `check` do tamanho do grupo |
| `LEAGUE_V2_CLOSE_OFFSET_MS` | 3 h 20 min | cron de fechamento |

## 7. Validação do fantasma (E-15, `_shared/validate.ts`)

Trocar o limite fixo 150–900 s/km por `ghostPaceAllowedV2(ghostPace, recentPaces)` **na gravação v2** (±20% do "Seu ritmo", ou o próprio recorde). Na v2, vencer o fantasma dá `GHOST_WIN_XP` (50) e não multiplica pontos (`scoreZoneV2` não tem `beatGhost`).
