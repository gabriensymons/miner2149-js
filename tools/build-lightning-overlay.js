/**
 * Re-encodes the green-screen lightning clip into the additive overlay the site
 * plays when the Diridium unit is unlocked or selected.
 *
 * The source is a 4K green-screen plate (about 2.3 MB, #14FF09 background) that
 * lives outside this repository, at
 * `~/Documents/Gabrien/Projects/Video Games/Miner2149/Diridium Lightning/`.
 * Only the encoded output is committed.
 *
 * The key is NOT a chroma key. The bolt is additive light, so the clip is
 * composited with `mix-blend-mode: screen`, under which black is transparent
 * and bright pixels add. That means the job here is to turn the background
 * black rather than to cut an alpha channel:
 *
 *   g' = min(g, max(r, b))
 *
 * Background green (20, 255, 9) collapses to (20, 20, 9); the white-blue bolt,
 * where red or blue already exceeds green, is untouched. A chroma key would
 * have to guess a matte edge and would leave a green fringe that screen
 * blending then adds as green light. This has no edge to get wrong. The
 * `colorlevels` pass crushes the residual (20, 20, 9) to true black so the
 * overlay adds nothing at all where there is no bolt.
 *
 * The bolt stays its native cyan-white. `styles/style.css` tints it violet with
 * `hue-rotate`, which leaves the white core white and can be re-tuned without
 * re-encoding.
 *
 * Usage: node tools/build-lightning-overlay.js [path/to/source.mp4]
 * Requires ffmpeg on PATH.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE = '/Users/gabriensymons/Documents/Gabrien/Projects/Video Games/'
  + 'Miner2149/Diridium Lightning/Diridum Lightning strike.mp4';

const source = process.argv[2] ?? DEFAULT_SOURCE;
const outputDirectory = fileURLToPath(new URL('../assets/video/', import.meta.url));

// 720p: the clip is a full-viewport overlay of a soft glowing shape, so 4K buys
// nothing a viewer can see and costs about twelve times the bytes.
const FILTERS = [
  'scale=1280:720',
  'format=gbrp',
  "geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))':b='b(X,Y)'",
  'colorlevels=rimin=0.12:gimin=0.12:bimin=0.12',
  'format=yuv420p',
].join(',');

function run(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

run([
  '-i', source, '-an', '-vf', FILTERS,
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', '-g', '30',
  `${outputDirectory}diridium-lightning.mp4`,
]);

run([
  '-i', source, '-an', '-vf', FILTERS,
  '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2',
  `${outputDirectory}diridium-lightning.webm`,
]);

console.log('Built assets/video/diridium-lightning.{webm,mp4}.');
