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
 * part of the build; run it when a frame is added, and commit the output.
 *
 * The output is a STARTING POINT, not the source of truth. The committed
 * thumbnails are hand-finished afterwards -- the screen cutout is filled black
 * so each unit reads as a powered-down device rather than a hole punched
 * through the page -- and `sips` cannot reproduce that. Existing files are
 * therefore left alone unless `--force` is passed, which discards that work.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SKIN_CATALOGUE } from '../scripts/skin-catalogue.js';

/** Longest edge, in CSS pixels, at roughly 2x the size the list renders them. */
const THUMBNAIL_EDGE = 240;

const skinsDirectory = fileURLToPath(new URL('../assets/skins/', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../assets/skins/thumbs/', import.meta.url));

mkdirSync(outputDirectory, { recursive: true });

const force = process.argv.includes('--force');
let written = 0;
let skipped = 0;

for (const { file, label } of SKIN_CATALOGUE) {
  const output = `${outputDirectory}${file}`;
  if (existsSync(output) && !force) {
    skipped += 1;
    console.log(`${label.padEnd(12)} ${'kept'.padStart(6)}       ${file}`);
    continue;
  }
  execFileSync('sips', ['-Z', String(THUMBNAIL_EDGE), `${skinsDirectory}${file}`, '--out', output], {
    stdio: 'pipe',
  });
  written += 1;
  console.log(`${label.padEnd(12)} ${(statSync(output).size / 1024).toFixed(1).padStart(6)} KB  ${file}`);
}

console.log(`\n${written} generated, ${skipped} kept.`);
if (skipped > 0) {
  console.log('Existing thumbnails are hand-finished; pass --force to regenerate them.');
}
