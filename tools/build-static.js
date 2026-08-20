import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
// Overridable so tests can build into a scratch directory instead of racing
// each other over dist/.
const outputDirectory = process.env.MINER_BUILD_OUT
  ? pathToFileURL(`${process.env.MINER_BUILD_OUT.replace(/\/?$/, '/')}`)
  : new URL('../dist/', import.meta.url);
const staticDirectories = ['scripts', 'styles'];

// Development-only tooling must not exist in a production artifact -- not
// merely be disabled in one. `scripts/dev/` is never copied, and the regions
// that reference it are removed from the files that are.
// `test/dev-tooling-excluded.test.js` proves both hold.
const developmentDirectory = 'scripts/dev';
const DEV_REGION = /^[ \t]*\/\* dev-only:start \*\/[\s\S]*?^[ \t]*\/\* dev-only:end \*\/[ \t]*\r?\n?/gm;

function isDevelopmentPath(path) {
  return path.replace(/\\/g, '/').includes(`/${developmentDirectory}`);
}

async function stripDevelopmentRegions(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      await stripDevelopmentRegions(new URL(`${entry.name}/`, directory));
    } else if (entry.name.endsWith('.js')) {
      const source = await readFile(url, 'utf8');
      const stripped = source.replace(DEV_REGION, '');
      if (stripped !== source) await writeFile(url, stripped);
    }
  }
}
const staticFiles = [
  'assets/fonts/palm-os-bitmap-white.fnt',
  'assets/fonts/palm-os-bitmap-white.png',
  'assets/fonts/palm-os-bold-bitmap-white.fnt',
  'assets/fonts/palm-os-bold-bitmap-white.png',
  'assets/miner2149-logo.svg',
  'assets/skins/palm-iiic.png',
  'assets/skins/palm-iiie.png',
  'assets/skins/palm-v.png',
  'assets/skins/palm-viix.png',
  'assets/skins/palm-m100.png',
  'assets/skins/palm-m505.png',
  'assets/social/miner2149-og.png',
  'assets/spritesheet.json',
  'assets/spritesheet.png',
  'favicon.ico',
  'index.html',
  'robots.txt',
  'sitemap.xml',
];

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(new URL('assets/fonts/', outputDirectory), { recursive: true }),
  mkdir(new URL('assets/skins/', outputDirectory), { recursive: true }),
  mkdir(new URL('assets/social/', outputDirectory), { recursive: true }),
]);

await Promise.all([
  ...staticDirectories.map((directory) => cp(
    new URL(`${directory}/`, projectRoot),
    new URL(`${directory}/`, outputDirectory),
    { recursive: true, filter: (source) => !isDevelopmentPath(source) },
  )),
  ...staticFiles.map((file) => copyFile(
    new URL(file, projectRoot),
    new URL(file, outputDirectory),
  )),
]);

await stripDevelopmentRegions(new URL('scripts/', outputDirectory));

console.log('Built static site in dist/.');
