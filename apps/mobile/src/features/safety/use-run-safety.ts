/**
 * Corrida Segura durante a corrida (RF-024): SOS, Escolta e alerta de parada.
 * O envio usa os contatos do servidor (`safety_contacts`); sem contatos, abre o compartilhamento.
 */
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LatLng } from '@/domain/types';
import { escortMessage, sendToContacts, sosMessage, type SendResult } from '@/services/safety/messages';
import { createStopAlert, STOP_ALERT_TICK_MS, type StopAlert } from '@/services/safety/stop-alert';
import { useGame } from '@/store/game-store';

export type SafetyNotice = { kind: 'sos' | 'stop' | 'escort'; result: SendResult };

export function useRunSafety(opts: { position: LatLng | null; active: boolean }) {
  const contacts = useGame((s) => s.safetyContacts);
  const name = useGame((s) => s.name);
  const stopAlertOn = useGame((s) => s.stopAlertOn);
  const escortOn = useGame((s) => s.escortOn);
  const setEscort = useGame((s) => s.setEscort);
  const [notice, setNotice] = useState<SafetyNotice | null>(null);
  const [askingUntil, setAskingUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const positionRef = useRef<LatLng | null>(opts.position);
  const alertRef = useRef<StopAlert | null>(null);
  const escortShared = useRef(false);

  const send = useCallback(
    async (kind: SafetyNotice['kind']) => {
      const p = positionRef.current;
      const body = kind === 'escort' ? escortMessage(name, p) : sosMessage(name, p, kind === 'stop' ? 'stop' : 'sos');
      const result = await sendToContacts(contacts, body);
      setNotice({ kind, result });
      return result;
    },
    [contacts, name],
  );

  useEffect(() => {
    positionRef.current = opts.position;
    if (opts.position) alertRef.current?.feed(opts.position);
  }, [opts.position]);

  // Alerta de parada: pergunta após 10 min parado; sem resposta em 60 s, envia como o SOS.
  useEffect(() => {
    if (!opts.active || !stopAlertOn) return;
    const alert = createStopAlert({
      onAsk: (deadline) => {
        setAskingUntil(deadline);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Speech.speak('Está tudo bem? Toque em Estou bem.', { language: 'pt-BR' });
      },
      onAlert: () => {
        setAskingUntil(null);
        void send('stop');
        alert.reset();
      },
      onClear: () => setAskingUntil(null),
    });
    alertRef.current = alert;
    if (positionRef.current) alert.feed(positionRef.current);
    const id = setInterval(() => {
      alert.tick();
      setNow(Date.now());
    }, STOP_ALERT_TICK_MS);
    return () => {
      clearInterval(id);
      alertRef.current = null;
      setAskingUntil(null);
    };
  }, [opts.active, stopAlertOn, send]);

  // Escolta ligada antes da corrida: compartilha a localização assim que houver o primeiro fix.
  useEffect(() => {
    if (!opts.active || !escortOn || escortShared.current || !opts.position) return;
    escortShared.current = true;
    void send('escort');
  }, [opts.active, escortOn, opts.position, send]);

  return {
    contacts,
    notice,
    dismissNotice: () => setNotice(null),
    escortOn,
    toggleEscort: () => {
      const next = !escortOn;
      setEscort(next);
      if (next) {
        escortShared.current = true;
        void send('escort');
      }
    },
    sos: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return send('sos');
    },
    asking: askingUntil !== null ? { secondsLeft: Math.max(0, Math.ceil((askingUntil - now) / 1000)) } : null,
    confirmOk: () => alertRef.current?.confirmOk(),
  };
}
