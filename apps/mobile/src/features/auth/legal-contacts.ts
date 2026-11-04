/**
 * Quem responde pelos dados (LGPD art. 9º, III e art. 41) — fonte única para a Política de Privacidade e para a
 * página pública de exclusão de conta (`/excluir-conta`, exigida pelo Google Play). F8 C3, D-99.
 *
 * Os autores preenchem estes campos (nomes e e-mails de verdade) antes de abrir o app para pessoas reais, e sobem a
 * `PRIVACY_VERSION` (services/api/auth-repo.ts). Enquanto houver marcador entre colchetes, o teste
 * `src/__tests__/publicacao.test.ts` avisa no Jest e falha com `NOMADE_RELEASE=1` (o mesmo vale para o
 * `scripts/check-publicacao.js`, chamado pelo `npm run publicar` e pelo `npm run apk`). Texto final: com revisão jurídica.
 */
export const LEGAL_CONTACTS = {
  /** Controlador: quem decide sobre o tratamento (para o TCC, os autores ou a instituição). */
  controllerName: '[NOME DO CONTROLADOR]',
  controllerEmail: '[E-MAIL DO CONTROLADOR]',
  /** Encarregado (DPO): canal com as pessoas e com a ANPD. */
  dpoName: '[NOME DO ENCARREGADO]',
  dpoEmail: '[E-MAIL DO ENCARREGADO]',
  /** Região do projeto no Supabase (Settings → General), para a transferência internacional (art. 33). */
  serverRegion: '[REGIÃO DO SERVIDOR]',
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
