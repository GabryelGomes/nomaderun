/**
 * Auth de demonstração: a mesma superfície do `supabase.auth` que o app usa (sessão, eventos, entrar,
 * cadastrar, sair, recuperar senha). Qualquer e-mail e senha entram como o corredor de demonstração;
 * nenhum e-mail é enviado. Link mágico e login social ficam indisponíveis, com mensagem clara.
 */
import { DEMO_EMAIL, DEMO_USER_ID } from '@/demo/world';

import { AppError } from '../errors';
import type { DemoDb, Row } from './db';

export const DEMO_UNAVAILABLE = 'Indisponível na demonstração.';

type Listener = (event: string, session: DemoSession | null) => void;

export type DemoSession = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  user: { id: string; email: string; aud: 'authenticated'; role: 'authenticated'; app_metadata: Row; user_metadata: Row; identities: Row[]; created_at: string };
};

export class DemoAuth {
  private session: DemoSession | null;
  private listeners = new Set<Listener>();

  constructor(
    private readonly db: DemoDb,
    signedIn: boolean,
  ) {
    this.session = signedIn ? this.build(db.world.me.id) : null;
  }

  currentUserId(): string | null {
    return this.session?.user.id ?? null;
  }

  private build(userId: string): DemoSession {
    const nowS = Math.floor(this.db.now() / 1000);
    return {
      access_token: 'demonstracao',
      refresh_token: 'demonstracao',
      token_type: 'bearer',
      expires_in: 86_400,
      expires_at: nowS + 86_400,
      user: { id: userId, email: DEMO_EMAIL, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'demonstracao' }, user_metadata: {}, identities: [{ provider: 'email' }], created_at: new Date(this.db.now()).toISOString() },
    };
  }

  private emit(event: string) {
    const s = this.session;
    // Assíncrono, como no supabase-js (o ouvinte nunca roda dentro da chamada que o registrou).
    void Promise.resolve().then(() => {
      for (const l of [...this.listeners]) l(event, s);
    });
  }

  private signInAs(userId: string, event = 'SIGNED_IN') {
    this.session = this.build(userId);
    this.emit(event);
    return { data: { session: this.session, user: this.session.user }, error: null };
  }

  getSession = async () => ({ data: { session: this.session }, error: null });

  getUser = async () => ({ data: { user: this.session?.user ?? null }, error: null });

  onAuthStateChange = (callback: Listener) => {
    this.listeners.add(callback);
    const s = this.session;
    void Promise.resolve().then(() => {
      if (this.listeners.has(callback)) callback('INITIAL_SESSION', s);
    });
    return { data: { subscription: { id: 'demonstracao', callback, unsubscribe: () => void this.listeners.delete(callback) } } };
  };

  signInWithPassword = async (_creds: { email: string; password: string }) => this.signInAs(DEMO_USER_ID);

  signUp = async (args: { email: string; password: string; options?: { data?: Row } }) => {
    const me = this.db.profile(DEMO_USER_ID);
    const meta = args.options?.data ?? {};
    if (me) {
      if (typeof meta.username === 'string' && meta.username.trim()) me.username = meta.username.trim();
      if (typeof meta.city === 'string' && meta.city.trim()) me.city = meta.city.trim();
      if (typeof meta.birthdate === 'string') me.birthdate = meta.birthdate;
    }
    return this.signInAs(DEMO_USER_ID);
  };

  signOut = async (_opts?: { scope?: 'global' | 'local' | 'others' }) => {
    this.session = null;
    this.emit('SIGNED_OUT');
    return { error: null };
  };

  resetPasswordForEmail = async (_email: string, _opts?: Row) => ({ data: {}, error: null });

  updateUser = async (_attrs: Row) => ({ data: { user: this.session?.user ?? null }, error: this.session ? null : new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre de novo.') });

  exchangeCodeForSession = async (_code: string) => ({ data: { session: null, user: null }, error: new AppError('VALIDATION', DEMO_UNAVAILABLE, { detail: 'DEMO_UNAVAILABLE' }) });

  signInWithOAuth = async (_args: Row) => ({ data: { provider: null, url: null }, error: new AppError('VALIDATION', DEMO_UNAVAILABLE, { detail: 'DEMO_UNAVAILABLE' }) });

  refreshSession = async () => {
    if (!this.session) return { data: { session: null, user: null }, error: new AppError('UNAUTHORIZED', 'Sua sessão expirou. Entre de novo.') };
    this.session = this.build(this.session.user.id);
    this.emit('TOKEN_REFRESHED');
    return { data: { session: this.session, user: this.session.user }, error: null };
  };

  startAutoRefresh = async () => undefined;

  stopAutoRefresh = async () => undefined;
}
