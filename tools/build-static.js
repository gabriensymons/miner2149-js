import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { SKIN_CATALOGUE } from '../scripts/skin-catalogue.js';

// Concept art released with the Diridium frame. Named here rather than copied
// as a directory so nothing incidental can ride along.
const CONCEPT_ART_FILES = ['diridium-asteroid-mine.jpg', 'dark-matter-drive.jpg'];

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
  'assets/social/miner2149-og.png',
  // The Diridium strike. Only requested once that frame is unlocked, but it has
  // to be present in the artifact for that request to succeed.
  'assets/video/diridium-lightning.mp4',
  'assets/video/diridium-lightning.webm',
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
  mkdir(new URL('assets/skins/thumbs/', outputDirectory), { recursive: true }),
  mkdir(new URL('assets/concepts/', outputDirectory), { recursive: true }),
  mkdir(new URL('assets/social/', outputDirectory), { recursive: true }),
  mkdir(new URL('assets/video/', outputDirectory), { recursive: true }),
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
  // Frames are shipped from the catalogue rather than from a directory copy, so
  // the build carries exactly what the picker can offer -- no stray .DS_Store,
  // and no orphaned art left behind by a replaced frame.
  ...SKIN_CATALOGUE.map(({ file }) => copyFile(
    new URL(`assets/skins/${file}`, projectRoot),
    new URL(`assets/skins/${file}`, outputDirectory),
  )),
  // Field Kit thumbnails, from tools/build-skin-thumbnails.js.
  ...SKIN_CATALOGUE.map(({ file }) => copyFile(
    new URL(`assets/skins/thumbs/${file}`, projectRoot),
    new URL(`assets/skins/thumbs/${file}`, outputDirectory),
  )),
  ...CONCEPT_ART_FILES.map((file) => copyFile(
    new URL(`assets/concepts/${file}`, projectRoot),
    new URL(`assets/concepts/${file}`, outputDirectory),
  )),
]);

await stripDevelopmentRegions(new URL('scripts/', outputDirectory));

console.log('Built static site in dist/.');
