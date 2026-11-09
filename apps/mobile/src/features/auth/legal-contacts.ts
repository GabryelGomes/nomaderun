/**
 * Quem responde pelos dados (LGPD art. 9º, III e art. 41) — fonte única para a Política de Privacidade e para a
 * página pública de exclusão de conta (`/excluir-conta`, exigida pelo Google Play). F8 C3, D-99.
 *
 * Preenchido na F8-D (M3) com o padrão decidido pela coordenação — **o dono confirma** os nomes, o e-mail e a região
 * (Supabase → Settings → General) antes de abrir para pessoas reais. Ao mudar qualquer campo, suba a
 * `PRIVACY_VERSION` e a `PRIVACY_UPDATED_AT` (services/api/auth-repo.ts). Um marcador entre colchetes faz o
 * `src/__tests__/publicacao.test.ts` falhar e o `scripts/check-publicacao.js` recusar o `npm run publicar` e o
 * `npm run apk` (por padrão; só passa com `NOMADE_DEMO_OK=1`). Texto final: com revisão jurídica.
 */
export const LEGAL_CONTACTS = {
  /** Controladores: quem decide sobre o tratamento (pessoas físicas, autores do projeto). */
  controllerName: 'Gabryel Gomes Bahmad Camapum e Mateus Augusto de Faria Brito',
  controllerEmail: 'byelgomys@gmail.com',
  /** Encarregado (DPO): canal com as pessoas e com a ANPD. */
  dpoName: 'Gabryel Gomes Bahmad Camapum',
  dpoEmail: 'byelgomys@gmail.com',
  /** Região do projeto no Supabase (supabase/DEPLOY.md §1: "South America (São Paulo)"), para o art. 33. */
  serverRegion: 'América do Sul (São Paulo, Brasil)',
} as const;

export type LegalContactField = keyof typeof LEGAL_CONTACTS;

/** Marcador ainda não preenchido: texto todo entre colchetes, em maiúsculas. */
export const isLegalPlaceholder = (value: string) => /^\[[^\]]+\]$/.test(value.trim());

/** Campos que ainda estão com marcador (vazio = pronto para publicar). */
export function pendingLegalFields(contacts: Record<string, string> = LEGAL_CONTACTS): string[] {
  return Object.entries(contacts)
    .filter(([, v]) => isLegalPlaceholder(v) || v.trim() === '')
    .map(([k]) => k);
}

/** Caminho da página pública de exclusão de conta (rota estática do export web, fora dos guards de sessão). */
export const DELETE_ACCOUNT_PATH = '/excluir-conta';
