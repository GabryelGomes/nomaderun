/**
 * Contatos da Corrida Segura (RF-024): tabela `safety_contacts` (RLS: só os próprios; no máximo 5,
 * garantido pelo banco com `CONTACTS_LIMIT`).
 */
import { AppError, attempt, type Result } from '@/services/api/errors';
import { requireSupabase } from '@/services/api/supabase';

export const MAX_SAFETY_CONTACTS = 5;
export const PHONE_PATTERN = /^\+?[0-9 ()-]{8,20}$/;

export type SafetyContact = { id: string; name: string; phone: string };

/**
 * Telefone que recebe o SMS do SOS (DF05 dos testes externos: "00000000" sem DDD era aceito).
 * Brasil (com ou sem +55 ou 0 na frente): DDD de 11 a 99 + 8 dígitos (fixo) ou 9 dígitos começando com 9
 * (celular). Outro país: precisa do "+" e do código do país, com 8 a 15 dígitos. Todos os dígitos iguais não vale.
 */
export function isValidPhone(phone: string): boolean {
  const p = phone.trim();
  if (!PHONE_PATTERN.test(p)) return false;
  let digits = p.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) return false;
  const international = p.startsWith('+');
  if (international && !digits.startsWith('55')) return digits.length >= 8 && digits.length <= 15;
  if (digits.startsWith('55') && (international || digits.length > 11)) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[1-9][1-9]/.test(digits)) return false;
  const local = digits.slice(2);
  return (local.length === 8 && /^[2-5]/.test(local)) || (local.length === 9 && local.startsWith('9'));
}

export function validateContact(name: string, phone: string): string | null {
  const n = name.trim();
  if (n.length < 1 || n.length > 80) return 'Informe o nome do contato (até 80 caracteres).';
  if (!isValidPhone(phone)) return 'Telefone inválido. Use DDD e número, por exemplo (62) 99999-0000.';
  return null;
}

const toContact = (r: Record<string, unknown>): SafetyContact => ({ id: String(r.id), name: String(r.name ?? ''), phone: String(r.phone ?? '') });

export async function listContacts(): Promise<Result<SafetyContact[]>> {
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('safety_contacts').select('id,name,phone').order('created_at');
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(toContact);
  });
}

export async function addContact(name: string, phone: string): Promise<Result<SafetyContact>> {
  const invalid = validateContact(name, phone);
  if (invalid) return { ok: false, error: new AppError('VALIDATION', invalid) };
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('safety_contacts').insert({ name: name.trim(), phone: phone.trim() }).select('id,name,phone').single();
    if (error) throw error;
    return toContact(data as Record<string, unknown>);
  });
}

export async function updateContact(id: string, name: string, phone: string): Promise<Result<SafetyContact>> {
  const invalid = validateContact(name, phone);
  if (invalid) return { ok: false, error: new AppError('VALIDATION', invalid) };
  return attempt(async () => {
    const { data, error } = await requireSupabase().from('safety_contacts').update({ name: name.trim(), phone: phone.trim() }).eq('id', id).select('id,name,phone').single();
    if (error) throw error;
    return toContact(data as Record<string, unknown>);
  });
}

export async function removeContact(id: string): Promise<Result<void>> {
  return attempt(async () => {
    const { error } = await requireSupabase().from('safety_contacts').delete().eq('id', id);
    if (error) throw error;
  });
}

/** Mensagem do limite do banco (`CONTACTS_LIMIT: ...`) já vem em pt-BR pelo mapeador de erros. */
export const isLimitError = (e: AppError) => e.detail === 'CONTACTS_LIMIT';
