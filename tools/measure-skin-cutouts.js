#!/usr/bin/env node
/**
 * Measure the screen cutout in each PDA frame in `assets/skins/`.
 *
 * A frame is an RGBA PNG of a handheld device with the screen punched out as
 * transparency. The CSS needs to know where that hole is so the 160x160 canvas
 * can be positioned inside it. Measuring by eye in an image editor is slow and
 * silently wrong by a pixel or two, which shows as bezel bleed once the frame is
 * scaled up 3x or more.
 *
 * Reads only; prints `scripts/skin-catalogue.js` entries to stdout.
 *
 *   node tools/measure-skin-cutouts.js
 *   node tools/measure-skin-cutouts.js assets/skins/AstroDyne.png
 *
 * Not part of the production build and not imported by anything the game loads.
 */

import { inflateSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const SKINS_DIRECTORY = new URL('../assets/skins/', import.meta.url);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// A pixel this transparent is treated as part of the hole. Anti-aliased cutout
// edges sit between 0 and 255, so a hard `=== 0` test would report a cutout one
// or two pixels smaller than the one the eye sees.
const TRANSPARENT_BELOW = 8;
// Ignore stray transparent specks: dust, and the gaps between buttons.
const MINIMUM_REGION_AREA = 400;

function readChunks(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

// Reverses the per-scanline filter PNG applies before compression. Only the
// alpha byte of each pixel is kept -- that is all the cutout search needs, and
// holding a full RGBA copy of a 1024x1536 image is pointless.
function decodeAlpha(buffer) {
  const chunks = readChunks(buffer);
  const header = chunks.find(({ type }) => type === 'IHDR').data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`expected 8-bit RGBA, got bit depth ${bitDepth} color type ${colorType}`);
  }

  const raw = inflateSync(Buffer.concat(
    chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data),
  ));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const alpha = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
  let cursor = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    const line = Buffer.from(raw.subarray(cursor + 1, cursor + 1 + stride));
    cursor += 1 + stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? line[index - bytesPerPixel] : 0;
      const up = previous[index];
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      switch (filter) {
        case 0: break;
        case 1: line[index] = (line[index] + left) & 0xff; break;
        case 2: line[index] = (line[index] + up) & 0xff; break;
        case 3: line[index] = (line[index] + ((left + up) >> 1)) & 0xff; break;
        case 4: {
          const estimate = left + up - upLeft;
          const dLeft = Math.abs(estimate - left);
          const dUp = Math.abs(estimate - up);
          const dUpLeft = Math.abs(estimate - upLeft);
          const nearest = dLeft <= dUp && dLeft <= dUpLeft ? left : (dUp <= dUpLeft ? up : upLeft);
          line[index] = (line[index] + nearest) & 0xff;
          break;
        }
        default: throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
    }
    for (let x = 0; x < width; x += 1) alpha[y * width + x] = line[x * bytesPerPixel + 3];
    previous = line;
  }
  return { width, height, alpha };
}

/**
 * The screen is the largest transparent region that does not touch the image
 * border. The border test is what makes this reliable: every one of these frames
 * has transparency around the outside of the device silhouette, and it is
 * always larger than the screen, so a plain "biggest transparent region" search
 * returns the background every time.
 */
function findCutout({ width, height, alpha }) {
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let best = null;

  for (let start = 0; start < alpha.length; start += 1) {
    if (seen[start] || alpha[start] >= TRANSPARENT_BELOW) continue;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    seen[start] = 1;
    let minX = width; let minY = height; let maxX = -1; let maxY = -1;
    let area = 0;
    let touchesBorder = false;

    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      const y = (index - x) / width;
      area += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

      // Neighbours are unrolled rather than iterated over an array of pairs:
      // this runs once per transparent pixel across ~1.5 million per image.
      if (x > 0) {
        const next = index - 1;
        if (!seen[next] && alpha[next] < TRANSPARENT_BELOW) { seen[next] = 1; queue[tail] = next; tail += 1; }
      }
      if (x < width - 1) {
        const next = index + 1;
        if (!seen[next] && alpha[next] < TRANSPARENT_BELOW) { seen[next] = 1; queue[tail] = next; tail += 1; }
      }
      if (y > 0) {
        const next = index - width;
        if (!seen[next] && alpha[next] < TRANSPARENT_BELOW) { seen[next] = 1; queue[tail] = next; tail += 1; }
      }
      if (y < height - 1) {
        const next = index + width;
        if (!seen[next] && alpha[next] < TRANSPARENT_BELOW) { seen[next] = 1; queue[tail] = next; tail += 1; }
      }
    }

    if (touchesBorder || area < MINIMUM_REGION_AREA) continue;
    if (!best || area > best.area) {
      best = {
        area,
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
    }
  }
  return best;
}

function report(file) {
  const { width, height, alpha } = decodeAlpha(readFileSync(file));
  const cutout = findCutout({ width, height, alpha });
  if (!cutout) return { file: basename(file), error: 'no interior transparent region found' };
  // A screen cutout should be a solid rectangle. Anything materially below 1
  // means the region found is some other shape and the numbers are not usable.
  const rectangleFill = cutout.area / (cutout.width * cutout.height);
  return {
    file: basename(file),
    imageWidth: width,
    imageHeight: height,
    screenX: cutout.x,
    screenY: cutout.y,
    screenWidth: cutout.width,
    screenHeight: cutout.height,
    rectangleFill: Number(rectangleFill.toFixed(4)),
  };
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(SKINS_DIRECTORY)
    .filter((name) => name.endsWith('.png'))
    .sort()
    .map((name) => join(SKINS_DIRECTORY.pathname, name));

const results = files.map(report);
for (const result of results) {
  if (result.error) {
    console.error(`${result.file}: ${result.error}`);
    continue;
  }
  const { file, imageWidth, imageHeight, screenX, screenY, screenWidth, screenHeight, rectangleFill } = result;
  const square = screenWidth === screenHeight ? '' : '   <-- NOT SQUARE';
  const solid = rectangleFill >= 0.999 ? '' : `   <-- fill ${rectangleFill}, not a clean rectangle`;
  console.log(
    `${file.padEnd(18)} image ${String(imageWidth).padStart(4)}x${String(imageHeight).padStart(4)}`
    + `  cutout ${String(screenWidth).padStart(3)}x${String(screenHeight).padStart(3)}`
    + ` @ (${String(screenX).padStart(3)},${String(screenY).padStart(3)})${square}${solid}`,
  );
}
