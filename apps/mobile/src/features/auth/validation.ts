/**
 * Validações do cadastro e do perfil (RF-001, RF-002). Puras e testadas.
 * O backend valida de novo (idade e aceites no trigger, nome único no índice).
 */
export const MIN_AGE = 16;
export const PASSWORD_MIN = 8;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[A-Za-z0-9_.]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Informe seu e-mail.';
  if (!EMAIL_RE.test(e)) return 'Confira o e-mail digitado.';
  return null;
}

export type PasswordStrength = { ok: boolean; level: 0 | 1 | 2 | 3; label: string; hint: string };

/** Mínimo de 8 caracteres; o nível dá feedback enquanto a pessoa digita. */
export function passwordStrength(pw: string): PasswordStrength {
  if (pw.length === 0) return { ok: false, level: 0, label: '', hint: `Use pelo menos ${PASSWORD_MIN} caracteres.` };
  if (pw.length < PASSWORD_MIN) {
    const left = PASSWORD_MIN - pw.length;
    return { ok: false, level: 0, label: 'Curta demais', hint: `Faltam ${left} ${left === 1 ? 'caractere' : 'caracteres'}.` };
  }
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  const long = pw.length >= 12;
  if (kinds >= 3 && long) return { ok: true, level: 3, label: 'Forte', hint: 'Boa senha.' };
  if (kinds >= 3 || (kinds >= 2 && long)) return { ok: true, level: 2, label: 'Média', hint: 'Aceita. Fica mais forte com 12 caracteres ou mais.' };
  return { ok: true, level: 1, label: 'Fraca', hint: 'Aceita, mas misture letras maiúsculas, números e símbolos.' };
}

export function validatePassword(pw: string): string | null {
  return pw.length >= PASSWORD_MIN ? null : `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
}

export function validateUsername(raw: string): string | null {
  const u = raw.trim();
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return `O nome de usuário precisa ter de ${USERNAME_MIN} a ${USERNAME_MAX} caracteres.`;
  if (!USERNAME_RE.test(u)) return 'Use só letras sem acento, números, ponto ou sublinhado.';
  return null;
}

/** Máscara DD/MM/AAAA enquanto digita. */
export function maskBirthdate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "DD/MM/AAAA" → "AAAA-MM-DD" (ou null se a data não existe). */
export function parseBirthdate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Idade completa em anos na data `today` (conta o aniversário no próprio dia). */
export function ageOn(isoBirth: string, today: Date): number {
  const [y, mo, d] = isoBirth.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateBirthdate(text: string, today: Date = new Date()): string | null {
  if (!text.trim()) return 'Informe sua data de nascimento.';
  const iso = parseBirthdate(text);
  if (!iso) return 'Data inválida. Use o formato DD/MM/AAAA.';
  const age = ageOn(iso, today);
  if (age < 0) return 'A data de nascimento não pode estar no futuro.';
  if (age < MIN_AGE) return `É preciso ter pelo menos ${MIN_AGE} anos para usar o NOMADE RUN.`;
  if (age > 120) return 'Confira o ano de nascimento.';
  return null;
}

export const CITY_MIN = 2;
export const CITY_MAX = 80;

/** Cidade natal: opcional (o placar entre cidades só conta quem informou); se vier, 2 a 80 letras como no banco. */
export function validateCity(raw: string | undefined): string | null {
  const c = (raw ?? '').trim();
  if (!c) return null;
  if (c.length < CITY_MIN) return 'A cidade precisa ter pelo menos 2 letras.';
  if (c.length > CITY_MAX) return `A cidade pode ter até ${CITY_MAX} caracteres.`;
  return null;
}

export type SignUpForm = {
  email: string;
  password: string;
  username: string;
  birthdate: string;
  /** Cidade natal (opcional). */
  city?: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
};

export type SignUpErrors = Partial<Record<keyof SignUpForm, string>>;

export function validateSignUp(f: SignUpForm, today: Date = new Date()): SignUpErrors {
  const errors: SignUpErrors = {};
  const set = (k: keyof SignUpForm, v: string | null) => {
    if (v) errors[k] = v;
  };
  set('email', validateEmail(f.email));
  set('password', validatePassword(f.password));
  set('username', validateUsername(f.username));
  set('birthdate', validateBirthdate(f.birthdate, today));
  set('city', validateCity(f.city));
  if (!f.acceptedTerms) errors.acceptedTerms = 'Aceite os Termos de Uso para continuar.';
  if (!f.acceptedPrivacy) errors.acceptedPrivacy = 'Aceite a Política de Privacidade para continuar.';
  return errors;
}

export const hasErrors = (e: object) => Object.values(e).some(Boolean);
