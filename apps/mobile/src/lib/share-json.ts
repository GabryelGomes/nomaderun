import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Salva um JSON no cache do app e abre a folha de compartilhamento do sistema
 * (exportação de dados da LGPD). Devolve o caminho do arquivo.
 */
export async function saveAndShareJson(fileName: string, data: unknown): Promise<string> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Meus dados do NOMADE RUN', UTI: 'public.json' });
  }
  return file.uri;
}
