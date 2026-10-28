import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * O sistema diz se há leitor de tela ligado? No celular, sim (TalkBack e VoiceOver respondem e avisam a troca).
 * Na web, não: o navegador não expõe isso, e o `isScreenReaderEnabled` do react-native-web responde **sempre**
 * `true` (versão 0.21), o que pularia todo roteiro de celebração. Puro.
 */
export function canDetectScreenReader(os: string = Platform.OS): boolean {
  return os !== 'web';
}

/**
 * Leitor de tela ligado no sistema, acompanhando a troca (`screenReaderChanged`). Onde não dá para saber (web),
 * fica `false`: o roteiro toca, com "Pular" focável, e quem usa leitor recebe o anúncio por uma região viva
 * (`aria-live`). `forced` (testes e galeria) vence e dispensa a consulta.
 */
export function useScreenReaderEnabled(forced?: boolean): boolean {
  const [system, setSystem] = useState(false);
  const ask = forced === undefined && canDetectScreenReader();
  useEffect(() => {
    if (!ask) return;
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (alive) setSystem(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setSystem);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [ask]);
  return forced ?? (ask ? system : false);
}
