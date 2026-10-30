/**
 * T7.1.8 (D-78) — GPX 1.1 a partir da rota cortada: estrutura válida, sem horários quando cortado,
 * rota completa só com confirmação, escape de texto e propriedade "nenhum trkpt dentro de zona".
 * A validação contra o XSD oficial (xmllint) está no relatório da E8 (docs/melhoria/relatorios/E8-onda1.md).
 */
import { describe, expect, it } from '@jest/globals';

import { distanceMeters, offset } from '../geo';
import { buildGpx, escapeGpxText, GPX_CREATOR, GPX_MIME_TYPE, GPX_UTI, gpxFileName, type GpxPoint, type GpxSource } from '../gpx';
import { clipRouteForSharing, type PrivacyCircle, type SharedRoute } from '../share-privacy';
import type { LatLng } from '../types';
import { ORIGIN } from './helpers';
import { forAll } from './prop';

function line(meters: number, step = 20, start: LatLng = ORIGIN): LatLng[] {
  const pts: LatLng[] = [start];
  for (let d = step; d <= meters; d += step) pts.push(offset(start, d, 90));
  return pts;
}

/** Confere que o XML é bem formado (tags abrem e fecham na ordem) e devolve a sequência de tags abertas. */
function wellFormed(xml: string): string[] {
  const body = xml.replace(/^<\?xml[^?]*\?>\s*/, '');
  const stack: string[] = [];
  const opened: string[] = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m;
    if (closing) {
      expect(stack.pop()).toBe(name);
    } else {
      opened.push(name);
      if (!selfClosing) stack.push(name);
    }
  }
  expect(stack).toEqual([]);
  // nenhum "<" ou "&" solto fora de tags/entidades
  const text = body.replace(/<[^>]+>/g, '');
  expect(text).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  return opened;
}

const trkpts = (xml: string) => [...xml.matchAll(/<trkpt lat="(-?\d+\.\d{6})" lon="(-?\d+\.\d{6})"/g)].map((m) => ({ lat: Number(m[1]), lng: Number(m[2]) }));

describe('buildGpx — rota cortada (padrão)', () => {
  const route = line(3000);
  const zone: PrivacyCircle = { ...offset(ORIGIN, 1500, 90), radiusM: 200 };
  const shared = clipRouteForSharing(route, [zone], { seed: 4 });
  const xml = buildGpx({ kind: 'shared', route: shared }, { name: 'Corrida NOMADE — 23/10/2026' });

  it('é GPX 1.1 bem formado, com a ordem de elementos do XSD', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NOMADE RUN" xmlns="http://www.topografix.com/GPX/1/1"')).toBe(true);
    const tags = wellFormed(xml);
    expect(tags.slice(0, 6)).toEqual(['gpx', 'metadata', 'name', 'trk', 'name', 'type']);
    expect(xml).toContain('<name>Corrida NOMADE — 23/10/2026</name>');
    expect(xml).toContain('<type>running</type>');
    expect(GPX_CREATOR).toBe('NOMADE RUN');
  });

  it('um trkseg por pedaço visível, coordenadas com 6 casas, sem nenhum horário', () => {
    expect(shared.pieces).toHaveLength(2);
    expect(xml.match(/<trkseg>/g)).toHaveLength(2);
    expect(xml).not.toContain('<time>');
    const pts = trkpts(xml);
    expect(pts).toHaveLength(shared.pieces[0].length + shared.pieces[1].length);
    for (const p of pts) expect(distanceMeters(p, zone)).toBeGreaterThan(zone.radiusM);
    expect(distanceMeters(pts[0], route[0])).toBeGreaterThan(150);
  });

  it('"sem rota" gera um trk sem segmentos (ainda válido)', () => {
    const none = clipRouteForSharing([ORIGIN], [], { seed: 1 });
    const out = buildGpx({ kind: 'shared', route: none }, { name: 'Corrida', description: 'Rota protegida' });
    wellFormed(out);
    expect(out).not.toContain('<trkseg>');
    expect(out).toContain('<desc>Rota protegida</desc>');
  });

  it('recusa rota montada à mão', () => {
    const fake = { ...shared } as SharedRoute;
    expect(() => buildGpx({ kind: 'shared', route: fake }, { name: 'x' })).toThrow('clipRouteForSharing');
  });
});

describe('buildGpx — rota completa (só com confirmação)', () => {
  const points: GpxPoint[] = [
    { lat: -16.7097, lng: -49.2388, t: Date.UTC(2026, 9, 23, 9, 30, 0, 250), ele: 742.04 },
    { lat: -16.7098, lng: -49.2381, t: Date.UTC(2026, 9, 23, 9, 30, 5) },
    { lat: Number.NaN, lng: 0, t: 0 },
    { lat: 10, lng: 180 },
    { lat: -16.71, lng: -49.2375 },
  ];

  it('leva horário ISO 8601 (sem milissegundos) e elevação, e pula pontos inválidos', () => {
    const xml = buildGpx({ kind: 'full', points, confirmedFullRoute: true }, { name: 'Volta', activityType: 'walking' });
    wellFormed(xml);
    expect(xml).toContain('<trkpt lat="-16.709700" lon="-49.238800"><ele>742.0</ele><time>2026-10-23T09:30:00Z</time></trkpt>');
    expect(xml).toContain('<time>2026-10-23T09:30:05Z</time>');
    expect(xml).toContain('<trkpt lat="-16.710000" lon="-49.237500"/>');
    expect(trkpts(xml)).toHaveLength(3);
    expect(xml).toContain('<type>walking</type>');
  });

  it('sem pontos válidos: trk vazio', () => {
    const xml = buildGpx({ kind: 'full', points: [{ lat: 91, lng: 0 }], confirmedFullRoute: true }, { name: 'Vazia' });
    expect(xml).not.toContain('<trkseg>');
  });

  it('sem confirmação, recusa', () => {
    const source = { kind: 'full', points, confirmedFullRoute: false } as unknown as GpxSource;
    expect(() => buildGpx(source, { name: 'x' })).toThrow('confirmação');
  });
});

describe('escape e nome do arquivo', () => {
  it('escapa os 5 caracteres do XML e tira os proibidos', () => {
    expect(escapeGpxText(`A & B <c> "d" 'e'`)).toBe('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;');
    expect(escapeGpxText('ok\u0000\u0007\u000B￾￿\tfim\n')).toBe('ok\tfim\n');
    expect(escapeGpxText('meia \uD83C solta \uDF89 e par 🎉')).toBe('meia  solta  e par 🎉');
    const xml = buildGpx({ kind: 'shared', route: clipRouteForSharing([], [], { seed: 0 }) }, { name: '<script>&</script>' });
    wellFormed(xml);
    expect(xml).toContain('<name>&lt;script&gt;&amp;&lt;/script&gt;</name>');
  });

  it('nome do arquivo só com caracteres seguros', () => {
    expect(gpxFileName('2f6c-AB_9')).toBe('nomade-2f6c-AB_9.gpx');
    expect(gpxFileName('../../etc/passwd')).toBe('nomade-etcpasswd.gpx');
    expect(gpxFileName('')).toBe('nomade-corrida.gpx');
    expect(GPX_MIME_TYPE).toBe('application/gpx+xml');
    expect(GPX_UTI).toBe('com.topografix.gpx');
  });
});

describe('buildGpx — propriedade', () => {
  it('1.000 rotas: nenhum trkpt dentro de zona nem perto das pontas, e nenhum <time>', () => {
    forAll(
      (r) => {
        const start = offset(ORIGIN, r.float(0, 2000), r.float(0, 360));
        const route: LatLng[] = [start];
        let p = start;
        let bearing = r.float(0, 360);
        for (let i = 0, n = r.int(4, 30); i < n; i++) {
          bearing += r.float(-60, 60);
          p = offset(p, r.float(20, 250), bearing);
          route.push(p);
        }
        const zones: PrivacyCircle[] = Array.from({ length: r.int(0, 3) }, () => ({ ...offset(r.pick(route), r.float(0, 400), r.float(0, 360)), radiusM: r.float(50, 600) }));
        return { route, zones, seed: r.int(0, 2 ** 31) };
      },
      ({ route, zones, seed }) => {
        const xml = buildGpx({ kind: 'shared', route: clipRouteForSharing(route, zones, { seed }) }, { name: 'Corrida' });
        if (xml.includes('<time>')) throw new Error('GPX cortado com horário');
        for (const p of trkpts(xml)) {
          // 6 casas ≈ 0,11 m: a folga mínima (25 m) cobre o arredondamento
          for (const z of zones) if (distanceMeters(p, z) <= z.radiusM) throw new Error('trkpt dentro de zona');
          if (distanceMeters(p, route[0]) < 149 || distanceMeters(p, route[route.length - 1]) < 149) throw new Error('trkpt perto da ponta');
        }
      },
      1000,
    );
  });
});
