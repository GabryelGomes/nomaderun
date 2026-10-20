/**
 * Envio da localização aos contatos (RF-024): SOS, alerta de parada e Escolta.
 * MVP: abre o app de SMS com os números e a mensagem (o usuário toca em enviar); sem SMS
 * (web, tablet) cai no compartilhamento do sistema. A Escolta compartilha um link do Google
 * Maps com a posição atual (não é rastreamento ao vivo: ver PROGRESSO/D-xx).
 */
import { Linking, Platform, Share } from 'react-native';

import type { LatLng } from '@/domain/types';

export type ContactLike = { name: string; phone: string };

export const mapsLink = (p: LatLng) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

export function sosMessage(name: string, p: LatLng | null, reason: 'sos' | 'stop' = 'sos'): string {
  const who = name.trim() || 'Seu contato';
  const head =
    reason === 'stop'
      ? `${who} está parado há mais de 10 minutos durante a corrida e não respondeu ao alerta do NOMADE RUN.`
      : `SOS: ${who} pediu ajuda durante uma corrida no NOMADE RUN.`;
  return p ? `${head} Localização atual: ${mapsLink(p)}` : `${head} A localização ainda não estava disponível.`;
}

export function escortMessage(name: string, p: LatLng | null): string {
  const who = name.trim() || 'Seu contato';
  return p
    ? `${who} começou uma corrida no NOMADE RUN e compartilhou a localização com você: ${mapsLink(p)}`
    : `${who} começou uma corrida no NOMADE RUN e vai compartilhar a localização com você.`;
}

/** Só dígitos e "+" (o app de SMS aceita assim nas duas plataformas). */
export const cleanPhone = (phone: string) => phone.replace(/[^\d+]/g, '');

/** URL `sms:` com vários destinatários e corpo (iOS usa `&body`, Android `?body`). */
export function smsUrl(phones: string[], body: string, os: string = Platform.OS): string {
  const to = phones.map(cleanPhone).filter(Boolean).join(',');
  const enc = encodeURIComponent(body);
  if (os === 'ios') return phones.length > 1 ? `sms:/open?addresses=${to}&body=${enc}` : `sms:${to}&body=${enc}`;
  return `sms:${to}?body=${enc}`;
}

export type SendResult = { method: 'sms' | 'share' | 'none'; ok: boolean; message: string };

export type MessagingApi = {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
  share: (message: string) => Promise<unknown>;
};

const defaultApi: MessagingApi = {
  canOpenURL: (u) => Linking.canOpenURL(u),
  openURL: (u) => Linking.openURL(u),
  share: (message) => Share.share({ message }),
};

/** Abre o SMS para os contatos; se não houver SMS ou contatos, usa o compartilhamento do sistema. */
export async function sendToContacts(contacts: ContactLike[], body: string, api: MessagingApi = defaultApi): Promise<SendResult> {
  const phones = contacts.map((c) => c.phone).filter((p) => cleanPhone(p).length >= 8);
  if (phones.length && Platform.OS !== 'web') {
    const url = smsUrl(phones, body);
    try {
      if (await api.canOpenURL(url)) {
        await api.openURL(url);
        return { method: 'sms', ok: true, message: `Mensagem pronta para ${contacts.map((c) => c.name).join(', ')}. Toque em enviar no app de mensagens.` };
      }
    } catch {
      // cai no compartilhamento
    }
  }
  try {
    await api.share(body);
    return { method: 'share', ok: true, message: phones.length ? 'Escolha como enviar sua localização.' : 'Você ainda não tem contatos de segurança. Escolha como enviar sua localização.' };
  } catch {
    return { method: 'none', ok: false, message: 'Não foi possível abrir o envio. Ligue para alguém de confiança.' };
  }
}
