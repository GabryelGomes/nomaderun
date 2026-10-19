// Exporta território, rota e baús do protótipo (mesmo código do app) para o mockup.
import { writeFileSync } from 'node:fs';
import { DEMO_CENTER, demoRoute, seedChests, seedZones, zoneName } from '@/demo/demo-data';
import { territoryRegions } from '@/domain/regions';
import { chaikin, relax } from '@/domain/regions';
import { cellBoundary } from '@/domain/grid';
const zones = seedZones();
const list = Object.values(zones);
const regions = territoryRegions(list.filter((z) => !z.blocked));
const contested = list.filter((z) => z.attackStartedAt !== null).map((z) => ({ id: z.id, name: zoneName(z.id), owner: z.owner, attacker: z.attacker, ring: chaikin(relax(cellBoundary(z.id)), 2) }));
writeFileSync(process.argv[2], JSON.stringify({ center: DEMO_CENTER, regions, contested, route: demoRoute(), chests: seedChests(DEMO_CENTER, 7) }));
console.log('regions', regions.length, 'contested', contested.length, 'route', demoRoute().length);
