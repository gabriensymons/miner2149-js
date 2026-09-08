#!/usr/bin/env node
/**
 * Generate the Field Kit thumbnails from the full-size PDA frames.
 *
 * The frames are 1.2-2.2 MB each and there are eleven of them, so listing them
 * at full size would pull roughly 18 MB to render a page of hardware notes.
 * These are ~40-65 KB and keep their alpha, so the screen cutout still reads as
 * a hole rather than a white block.
 *
 * Reads `scripts/skin-catalogue.js`, so adding a frame stays a one-entry job:
 *
 *   node tools/build-skin-thumbnails.js
 *
 * Uses macOS `sips`, as the rest of this project's tooling assumes a Mac. Not
 * part of the build; run it when a frame is added or its art changes, and
 * commit the output alongside the frame.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SKIN_CATALOGUE } from '../scripts/skin-catalogue.js';

/** Longest edge, in CSS pixels, at roughly 2x the size the list renders them. */
const THUMBNAIL_EDGE = 240;

const skinsDirectory = fileURLToPath(new URL('../assets/skins/', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../assets/skins/thumbs/', import.meta.url));

mkdirSync(outputDirectory, { recursive: true });

let total = 0;
for (const { file, label } of SKIN_CATALOGUE) {
  const source = `${skinsDirectory}${file}`;
  const output = `${outputDirectory}${file}`;
  execFileSync('sips', ['-Z', String(THUMBNAIL_EDGE), source, '--out', output], {
    stdio: 'pipe',
  });
  const { size } = statSync(output);
  total += size;
  console.log(`${label.padEnd(12)} ${(size / 1024).toFixed(1).padStart(6)} KB  ${file}`);
}

console.log(`\n${SKIN_CATALOGUE.length} thumbnails, ${(total / 1024).toFixed(0)} KB total.`);
