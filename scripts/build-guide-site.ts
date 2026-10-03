// Writes the public User Guide site into a folder (the codedungeon-guide repo's checkout), from the in-app chapters.
//
//   npm run guide:site -- H:\codedungeon-guide
//
// Replaces the pages it makes and the files in scripts/guide-site/; leaves everything else in the folder alone.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTERS } from '../client/src/ui/userGuideChapters.ts';
import { buildSite } from './guideSite.ts';

const out = process.argv[2];
if (!out) {
  console.error('Usage: npm run guide:site -- <folder>');
  process.exit(1);
}
const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guide-site');

await fs.mkdir(out, { recursive: true });
const pages = buildSite(CHAPTERS);
for (const [name, html] of Object.entries(pages)) await fs.writeFile(path.join(out, name), html);
for (const name of await fs.readdir(assets)) await fs.copyFile(path.join(assets, name), path.join(out, name));
console.log(`Wrote ${Object.keys(pages).length} pages and ${(await fs.readdir(assets)).length} files to ${path.resolve(out)}`);
