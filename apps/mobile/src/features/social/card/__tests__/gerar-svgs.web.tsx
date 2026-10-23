/**
 * E8 · onda 1 — gera o SVG de cada card a partir dos componentes reais (`ShareCard`, `ShareSticker`), com o
 * react-native-svg da web, para a evidência em PNG do relatório, e uma amostra do GPX cortado. Dados de
 * demonstração (selo visível).
 * Não entra na suíte do app (o nome não termina em .test.tsx): roda só pela configuração
 * `docs/melhoria/relatorios/E8/jest.cards-web.config.js` (ver o cabeçalho de lá).
 */
import { expect, it } from '@jest/globals';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// versão "node" do renderizador: a padrão pede o MessageChannel, que o jsdom não tem
import { renderToStaticMarkup } from 'react-dom/server.node';

import { buildGpx } from '@/domain/gpx';
import { clipRouteForSharing } from '@/domain/share-privacy';
import type { FactionId } from '@/domain/types';
import { buildCarousel, buildRunCard, buildWeekCard, DEFAULT_CARD_CHOICES, ShareCard, ShareSticker, type CardModel, type CardRegion, type ShareCardFormat } from '@/features/social/card';

import { DEMO_HOME, DEMO_ROUTE, demoRunInput, demoWeekInput, metersToLatLng } from './fixtures';

const OUT = process.env.NOMADE_CARDS_OUT ?? '';
const MAPA = join(__dirname, '../../../../../../../docs/apresentacao/mockup/build/mapa.json');

/** Regiões dos times do mockup (já suavizadas, em metros) → anéis em lat/lng. */
function mockupRegions(): CardRegion[] {
  const mapa = JSON.parse(readFileSync(MAPA, 'utf8')) as { regions: { owner: FactionId; d: string }[] };
  return mapa.regions.map((r) => ({
    owner: r.owner,
    rings: r.d
      .split('M')
      .filter(Boolean)
      .map((ring) => [...ring.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => metersToLatLng([Number(m[1]), Number(m[2])]))),
  }));
}

it('gera os SVGs dos cards', () => {
  expect(OUT).not.toBe('');
  mkdirSync(OUT, { recursive: true });
  const input = demoRunInput();
  const regions = mockupRegions();
  const carousel = buildCarousel(input);
  const week = buildWeekCard(demoWeekInput());
  const noRouteRun = buildRunCard(input, { ...DEFAULT_CARD_CHOICES, withRoute: false });
  const home = clipRouteForSharing(DEMO_ROUTE, [DEMO_HOME], { seed: 7 });
  const homeRun = buildRunCard(demoRunInput({ route: home }));
  const jobs: [string, CardModel, ShareCardFormat][] = [];
  for (const m of [...carousel, week]) for (const f of ['stories', 'feed'] as const) jobs.push([`card-${m.kind}-${f}`, m, f]);
  jobs.push(['card-run-stories-sem-rota', noRouteRun, 'stories']);
  jobs.push([`card-run-stories-casa-${home.mode}`, homeRun, 'stories']);
  jobs.push(['card-week-stories-sem-rota', buildWeekCard(demoWeekInput(), { ...DEFAULT_CARD_CHOICES, withRoute: false }), 'stories']);
  for (const [name, model, format] of jobs) {
    writeFileSync(join(OUT, `${name}.svg`), renderToStaticMarkup(<ShareCard model={model} format={format} regions={regions} />));
  }
  writeFileSync(join(OUT, 'adesivo.svg'), renderToStaticMarkup(<ShareSticker model={buildRunCard(input)} />));
  // amostra do GPX cortado (conferida com xmllint no relatório)
  writeFileSync(join(OUT, 'corrida-cortada.gpx'), buildGpx({ kind: 'shared', route: home }, { name: 'Corrida NOMADE — 23/10/2026 (demonstração)' }));
  expect(jobs.length).toBeGreaterThan(10);
});
