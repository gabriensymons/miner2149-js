import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

async function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(new URL(`${entry.name}/`, directory)));
    } else if (entry.name.endsWith('.js') && !url.pathname.includes('/scripts/vendor/')) {
      files.push(url);
    }
  }
  return files;
}

const directories = [
  new URL('../scripts/', import.meta.url),
  new URL('../test/', import.meta.url),
  new URL('./', import.meta.url),
];
const files = (await Promise.all(directories.map(collectJavaScriptFiles))).flat();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

const installedPixi = await readFile(new URL('../node_modules/pixi.js/dist/browser/pixi.min.js', import.meta.url));
const vendoredPixi = await readFile(new URL('../scripts/vendor/pixi.min.js', import.meta.url));
assert.deepEqual(vendoredPixi, installedPixi, 'Vendored PixiJS is stale; run npm run vendor:pixi.');

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /scripts\/vendor\/pixi\.min\.js/);
assert.doesNotMatch(html, /supabase-js/, 'Do not load the Supabase client while cloud saves are disabled.');

console.log(`Checked ${files.length} JavaScript files and vendored dependencies.`);
