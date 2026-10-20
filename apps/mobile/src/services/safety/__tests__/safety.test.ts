import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { MAX_SAFETY_CONTACTS, validateContact } from '../contacts-repo';
import { cleanPhone, escortMessage, mapsLink, sendToContacts, smsUrl, sosMessage } from '../messages';
import { createStopAlert, STOP_ALERT_GRACE_MS, STOP_ALERT_MS, STOP_ALERT_TICK_MS } from '../stop-alert';

const here = { lat: -16.7097, lng: -49.2388 };

describe('alerta de parada (RF-024) com timers falsos', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 1_760_000_000_000 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function start() {
    const onAsk = jest.fn();
    const onAlert = jest.fn();
    const onClear = jest.fn();
    const alert = createStopAlert({ onAsk, onAlert, onClear });
    const timer = setInterval(() => alert.tick(), STOP_ALERT_TICK_MS);
    alert.feed(here);
    return { alert, onAsk, onAlert, onClear, stop: () => clearInterval(timer) };
  }

  it('parado > 10 min pergunta; sem resposta em 60 s dispara o envio', () => {
    const s = start();
    jest.advanceTimersByTime(STOP_ALERT_MS - 1000);
    expect(s.onAsk).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(s.onAsk).toHaveBeenCalledTimes(1);
    expect(s.alert.phase).toBe('asking');
    jest.advanceTimersByTime(STOP_ALERT_GRACE_MS - 1000);
    expect(s.onAlert).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(s.onAlert).toHaveBeenCalledTimes(1);
    expect(s.alert.phase).toBe('alerted');
    s.stop();
  });

  it('"Estou bem" cancela e recomeça a contagem', () => {
    const s = start();
    jest.advanceTimersByTime(STOP_ALERT_MS + 10_000);
    s.alert.confirmOk();
    expect(s.onClear).toHaveBeenCalled();
    jest.advanceTimersByTime(STOP_ALERT_GRACE_MS * 2);
    expect(s.onAlert).not.toHaveBeenCalled();
    jest.advanceTimersByTime(STOP_ALERT_MS);
    expect(s.onAsk).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it('voltar a se mover zera a contagem; ruído do GPS parado não', () => {
    const s = start();
    jest.advanceTimersByTime(STOP_ALERT_MS / 2);
    s.alert.feed({ lat: here.lat + 0.0001, lng: here.lng }); // ~11 m: ruído
    jest.advanceTimersByTime(STOP_ALERT_MS / 2);
    expect(s.onAsk).toHaveBeenCalledTimes(1);
    s.alert.feed({ lat: here.lat + 0.001, lng: here.lng }); // ~110 m: andou
    expect(s.onClear).toHaveBeenCalled();
    jest.advanceTimersByTime(STOP_ALERT_GRACE_MS);
    expect(s.onAlert).not.toHaveBeenCalled();
    s.stop();
  });
});

describe('mensagens da Corrida Segura', () => {
  it('link do Google Maps com a posição e textos de SOS/parada/escolta', () => {
    expect(mapsLink(here)).toBe('https://maps.google.com/?q=-16.709700,-49.238800');
    expect(sosMessage('Ana', here)).toMatch(/^SOS: Ana pediu ajuda.*maps\.google\.com/);
    expect(sosMessage('Ana', here, 'stop')).toMatch(/parado há mais de 10 minutos/);
    expect(sosMessage('Ana', null)).toMatch(/ainda não estava disponível/);
    expect(escortMessage('Ana', here)).toMatch(/compartilhou a localização/);
  });

  it('URL sms: com vários destinatários (iOS e Android)', () => {
    expect(cleanPhone('+55 (62) 99999-0000')).toBe('+5562999990000');
    expect(smsUrl(['+55 62 99999-0000', '62 98888-1111'], 'oi x', 'android')).toBe('sms:+5562999990000,62988881111?body=oi%20x');
    expect(smsUrl(['+55 62 99999-0000', '62 98888-1111'], 'oi', 'ios')).toBe('sms:/open?addresses=+5562999990000,62988881111&body=oi');
    expect(smsUrl(['62 98888-1111'], 'oi', 'ios')).toBe('sms:62988881111&body=oi');
  });

  it('abre o SMS para os contatos; sem SMS cai no compartilhamento', async () => {
    const api = { canOpenURL: jest.fn(async () => true), openURL: jest.fn(async () => true), share: jest.fn(async () => ({})) };
    const r = await sendToContacts([{ name: 'Mãe', phone: '+55 62 99999-0000' }], 'SOS', api);
    expect(r.method).toBe('sms');
    expect(api.openURL).toHaveBeenCalledWith(expect.stringMatching(/^sms:/));
    api.canOpenURL.mockResolvedValueOnce(false);
    expect((await sendToContacts([{ name: 'Mãe', phone: '+55 62 99999-0000' }], 'SOS', api)).method).toBe('share');
    expect((await sendToContacts([], 'SOS', api)).message).toMatch(/ainda não tem contatos/);
  });

  it('validação dos contatos (limite do banco: 5)', () => {
    expect(MAX_SAFETY_CONTACTS).toBe(5);
    expect(validateContact('Mãe', '+55 62 99999-0000')).toBeNull();
    expect(validateContact('', '+55 62 99999-0000')).toMatch(/nome/);
    expect(validateContact('Mãe', '123')).toMatch(/Telefone/);
    expect(validateContact('Mãe', 'abc defgh ijk')).toMatch(/Telefone/);
  });
});
