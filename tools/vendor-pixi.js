import { copyFile, mkdir } from 'node:fs/promises';

const sourceDirectory = new URL('../node_modules/pixi.js/dist/browser/', import.meta.url);
const destinationDirectory = new URL('../scripts/vendor/', import.meta.url);

await mkdir(destinationDirectory, { recursive: true });
await Promise.all([
  copyFile(new URL('pixi.min.js', sourceDirectory), new URL('pixi.min.js', destinationDirectory)),
  copyFile(new URL('pixi.min.js.map', sourceDirectory), new URL('pixi.min.js.map', destinationDirectory)),
]);
