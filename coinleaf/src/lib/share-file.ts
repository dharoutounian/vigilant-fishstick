import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes a text file to the cache and opens the share sheet for it. */
export async function shareTextFile(name: string, contents: string, mimeType: string, uti?: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(contents);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
}
