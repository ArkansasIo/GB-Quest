// Skip a test when the files it inspects are not present. The Unreal port's source mirror
// (unreal/GBQuestUE5/SourceReference, see tools/sync_unreal_source_reference.py) carries source and text files
// only: no images, Java or .github workflows. In the full repository every path exists and the tests run normally.
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
export function needs(...paths) {
  const missing = paths.filter(p => !fs.existsSync(new URL(p, root)));
  return missing.length ? `not present here (source mirror without ${missing.join(', ')})` : false;
}
export const IMAGES = 'assets/font_6x9.png';
