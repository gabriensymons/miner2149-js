import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const outputDirectory = new URL('../dist/', import.meta.url);
const staticDirectories = ['scripts', 'styles'];
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
    { recursive: true },
  )),
  ...staticFiles.map((file) => copyFile(
    new URL(file, projectRoot),
    new URL(file, outputDirectory),
  )),
]);

console.log('Built static site in dist/.');
