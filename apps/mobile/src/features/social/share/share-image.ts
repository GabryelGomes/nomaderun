/**
 * T7.2.5 — nativo (Android/iOS, Expo Go SDK 57): `Svg.toDataURL` → arquivo no cache → menu do sistema.
 *
 *  - Android: o bitmap tem o tamanho da view em pixels; passamos `{width, height}` para não perder 1 px no
 *    arredondamento da cópia escondida (1080 / densidade dp).
 *  - iOS: `{width, height}` seriam pontos; sem opções, sai na escala da tela (a cópia já tem o tamanho certo).
 *  - Arquivo: `new File(Paths.cache, nome).write(base64, { encoding: 'base64' })` (expo-file-system 57).
 *
 * A versão web fica em `share-image.web.ts` (fonte embutida + Web Share ou download).
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type Svg from 'react-native-svg';

import { cleanBase64, ShareError, type ShareOutcome } from './share-flow';

export type PreparedImage = { uri: string; fileName: string };

/** No aparelho o menu do sistema sempre recebe arquivo (se o `expo-sharing` existir: conferido na entrega). */
export function canShareFiles(): boolean {
  return true;
}

function writeCacheFile(fileName: string, content: string, encoding: 'base64' | 'utf8'): string {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  if (encoding === 'base64') file.write(content, { encoding: 'base64' });
  else file.write(content);
  return file.uri;
}

/** Gera o PNG da cópia escondida e grava no cache. Sem prazo aqui: quem chama usa `withDeadline`. */
export async function prepareImage(svg: Svg | null, size: { width: number; height: number }, fileName: string): Promise<PreparedImage> {
  if (!svg) throw new ShareError('empty');
  const base64 = await new Promise<string>((resolve, reject) => {
    try {
      svg.toDataURL(
        (data) => {
          try {
            resolve(cleanBase64(data));
          } catch (e) {
            reject(e);
          }
        },
        Platform.OS === 'android' ? size : undefined,
      );
    } catch {
      reject(new ShareError('unknown'));
    }
  });
  return { uri: writeCacheFile(fileName, base64, 'base64'), fileName };
}

/** Abre o menu do sistema com a imagem. O `shareAsync` só termina quando o menu fecha. */
export async function deliverImage(image: PreparedImage, title: string): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) throw new ShareError('unavailable');
  await Sharing.shareAsync(image.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
  return 'shared';
}

/** Arquivo de texto (GPX) → cache → menu do sistema. */
export async function shareTextFile(opts: { content: string; fileName: string; mimeType: string; uti: string; title: string }): Promise<ShareOutcome> {
  const uri = writeCacheFile(opts.fileName, opts.content, 'utf8');
  if (!(await Sharing.isAvailableAsync())) throw new ShareError('unavailable');
  await Sharing.shareAsync(uri, { mimeType: opts.mimeType, UTI: opts.uti, dialogTitle: opts.title });
  return 'shared';
}
