/**
 * @jest-environment node
 *
 * Mundo de demonstração (T7.1.18): determinístico, tudo marcado como demonstração e `src/demo` puro
 * (sem React, Expo ou React Native), porque o `supabase/scripts/gen-seed.ts` (Deno) importa o `demo-data.ts`.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createWorld, DEMO_ID_PREFIX, isDemoUserId } from '../world';

const NOW = Date.parse('2026-10-23T12:00:00Z');

describe('mundo de demonstração', () => {
  it('é determinístico para o mesmo relógio', () => {
    const a = createWorld({ now: NOW });
    const b = createWorld({ now: NOW });
    expect(a.runners.map((r) => [r.username, r.faction, r.season.rp])).toEqual(b.runners.map((r) => [r.username, r.faction, r.season.rp]));
    expect(a.myRuns.map((r) => r.points.length)).toEqual(b.myRuns.map((r) => r.points.length));
  });

  it('tudo é identificado como demonstração', () => {
    const w = createWorld({ now: NOW, moderator: true });
    for (const r of [w.me, ...w.runners]) {
      expect(isDemoUserId(r.id)).toBe(true);
      expect(r.username.endsWith('.demo')).toBe(true);
    }
    for (const c of w.crews) expect(c.id.startsWith(DEMO_ID_PREFIX)).toBe(true);
    for (const n of w.notifications) expect(n.data.demonstracao).toBe(true);
    for (const c of w.contacts) expect(c.name).toMatch(/demonstração/);
    for (const p of w.privacyZones) expect(p.label).toMatch(/demonstração/);
    expect(w.reviewRuns).toHaveLength(3);
    expect(w.me.role).toBe('moderator');
  });

  it('perfis: cheio tem histórico; vazio e sem-time começam do zero', () => {
    const full = createWorld({ now: NOW });
    expect(full.myRuns).toHaveLength(6);
    expect(full.myRuns.every((r) => r.points.every((p, i) => p.seq === i && p.t === r.startedAt + i * 1000))).toBe(true);
    expect(full.memberships.some((m) => m.userId === full.me.id)).toBe(true);
    const empty = createWorld({ now: NOW, profile: 'vazio' });
    expect([empty.myRuns, empty.notifications, empty.contacts, empty.privacyZones]).toEqual([[], [], [], []]);
    expect(empty.me.faction).toBe('striders');
    expect(createWorld({ now: NOW, profile: 'sem-time' }).me.faction).toBeNull();
  });

  it('o ataque ao parque segue o relógio da demonstração, não o da máquina', () => {
    const w = createWorld({ now: NOW });
    const attacked = Object.values(w.zones).filter((z) => z.attackStartedAt !== null);
    expect(attacked).toHaveLength(1);
    expect(attacked[0].attackStartedAt).toBe(NOW - 6.5 * 3600_000);
  });

  it('src/demo continua sem React, Expo ou React Native', () => {
    const dir = join(__dirname, '..');
    for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n))) {
      const imports = [...readFileSync(join(dir, f), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const i of imports) expect(`${f} → ${i}`).toMatch(/→ (@\/domain\/|\.\/)/);
    }
  });
});
