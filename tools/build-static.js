import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const outputDirectory = new URL('../dist/', import.meta.url);
const staticDirectories = ['scripts', 'styles'];
const staticFiles = [
  'assets/fonts/palm-os-bitmap-white.fnt',
  'assets/fonts/palm-os-bitmap-white.png',
  'assets/fonts/palm-os-bold-bitmap-white.fnt',
  'assets/fonts/palm-os-bold-bitmap-white.png',
  'assets/spritesheet.json',
  'assets/spritesheet.png',
  'favicon.ico',
  'index.html',
];

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(new URL('assets/fonts/', outputDirectory), { recursive: true }),
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
