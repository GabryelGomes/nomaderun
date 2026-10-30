/**
 * PROVA TÉCNICA F1 (E8) — fora do app, só para registro. Não é importada por nenhuma tela.
 *
 * Caminho escolhido: o card é um <Svg viewBox="0 0 1080 1920"> do react-native-svg (o mesmo componente
 * desenha a prévia pequena e a cópia de exportação) → `Svg.toDataURL` (PNG em base64, nativo) →
 * `File` do expo-file-system (SDK 57) no cache → `Sharing.shareAsync` → menu do sistema
 * (Instagram Stories/Feed, WhatsApp, Salvar imagem...).
 *
 * Por que uma cópia escondida em tamanho de exportação:
 *  - Android (`SvgView.toDataURL`): o bitmap tem o tamanho da view em PIXELS; com `{width,height}` o
 *    bitmap cresce, mas o desenho continua na escala da view (sobraria fundo transparente).
 *  - iOS (`getDataURLWithBounds`): `UIGraphicsImageRenderer` usa a escala da tela; `{width,height}`
 *    são PONTOS. Sem opções, sai (tamanho em pt × escala) px.
 *  → Montar a cópia com `1080 / PixelRatio.get()` × `1920 / PixelRatio.get()` dp dá 1080×1920 px nos
 *    dois; no Android passamos `{width:1080,height:1920}` para não perder 1 px no arredondamento
 *    (ex.: densidade 2,625 → 411,43 dp).
 *
 * Web: `toDataURL` existe (react-native-svg/src/elements.web.ts), mas o SVG vira <img> isolado e
 * perde as fontes da página (provado em `web-comparacao-fontes.png`). Na web usamos `rasterizeWeb`
 * abaixo, que embute a fonte em base64 antes de desenhar no canvas.
 */
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useRef, useState } from 'react';
import { PixelRatio, Platform, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

export type CardFormat = 'stories' | 'feed';
export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  stories: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
};

type ShareState = { kind: 'idle' } | { kind: 'gerando' } | { kind: 'pronto'; uri: string } | { kind: 'erro'; message: string };

/** Promessa em volta do callback de `toDataURL`, com prazo (no iOS o callback pode vir vazio). */
function svgToBase64(svg: Svg, fmt: CardFormat, timeoutMs = 6000): Promise<string> {
  const { w, h } = CARD_SIZE[fmt];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    const done = (base64?: string) => {
      clearTimeout(timer);
      if (base64 && base64.length > 100) resolve(base64);
      else reject(new Error('EMPTY'));
    };
    if (Platform.OS === 'android') svg.toDataURL(done, { width: w, height: h });
    else svg.toDataURL(done);
  });
}

/** Grava o PNG no cache (substitui o anterior do mesmo nome) e devolve o `file://`. */
function writePng(base64: string, name: string): string {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** Web: serializa o <svg> do DOM, embute as fontes e desenha num canvas do tamanho final. */
export async function rasterizeWeb(svgEl: SVGSVGElement, fmt: CardFormat, fontCss: string): Promise<Blob> {
  const { w, h } = CARD_SIZE[fmt];
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = fontCss; // @font-face { src: url(data:font/ttf;base64,...) } das fontes do card
  clone.insertBefore(style, clone.firstChild);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('EMPTY'))), 'image/png'));
}

/** Web: Web Share com arquivo quando existe (Chrome Android, Safari iOS); senão, download. */
export async function shareOrDownloadWeb(blob: Blob, name: string): Promise<'compartilhado' | 'baixado'> {
  const file = new globalThis.File([blob], name, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'NOMADE RUN' });
    return 'compartilhado';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'baixado';
}

/** Card mínimo (o real vem de `features/social/card/*`): fundo, rota neon e número herói. */
function MiniCard({ fmt }: { fmt: CardFormat }) {
  const { w, h } = CARD_SIZE[fmt];
  const route = 'M300 500 L520 760 L460 980 L700 1100';
  return (
    <>
      <Rect width={w} height={h} fill="#070708" />
      {[
        [44, 0.05],
        [26, 0.1],
        [14, 0.26],
        [8, 1],
      ].map(([sw, op]) => (
        <Path key={sw} d={route} stroke="#FF6A13" strokeWidth={sw} strokeOpacity={op} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <Path d={route} stroke="#FFD9BF" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <SvgText x={w / 2} y={h - 420} fill="#FF6A13" fontSize={230} fontFamily="InterTight_800ExtraBold" textAnchor="middle">
        2,02
      </SvgText>
    </>
  );
}

export function ShareCardProof({ fmt = 'stories', activityId }: { fmt?: CardFormat; activityId: string }) {
  const exportRef = useRef<Svg>(null);
  const [state, setState] = useState<ShareState>({ kind: 'idle' });
  const { w, h } = CARD_SIZE[fmt];
  const ratio = PixelRatio.get();

  async function share() {
    const svg = exportRef.current;
    if (!svg) return;
    setState({ kind: 'gerando' });
    try {
      const base64 = await svgToBase64(svg, fmt);
      const uri = writePng(base64, `nomade-${activityId}-${fmt}.png`);
      setState({ kind: 'pronto', uri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar corrida' });
      }
    } catch (e) {
      setState({ kind: 'erro', message: e instanceof Error ? e.message : 'ERRO' });
    }
  }

  return (
    <View>
      {/* Prévia: mesmo desenho, escalado pelo viewBox. */}
      <Svg width={270} height={(270 * h) / w} viewBox={`0 0 ${w} ${h}`} accessibilityLabel="Prévia do card">
        <MiniCard fmt={fmt} />
      </Svg>
      {/* Cópia de exportação: fora da tela, invisível para o leitor de tela, em tamanho de pixel exato. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <Svg ref={exportRef} width={w / ratio} height={h / ratio} viewBox={`0 0 ${w} ${h}`}>
          <MiniCard fmt={fmt} />
        </Svg>
      </View>
      {/* No app: <Button testID="compartilhar-enviar" accessibilityLabel="Compartilhar imagem" .../> */}
      <View testID="prova-compartilhar" accessibilityRole="button" accessibilityLabel={state.kind === 'gerando' ? 'Gerando imagem' : 'Compartilhar imagem'} onTouchEnd={share} />
    </View>
  );
}
