import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// Moved out of the browser suite 2026-09-17. Nothing here needs a rendering
// engine: the question is which icons the markup declares and whether the files
// it names are actually in the tree. A browser was only ever being used as an
// expensive way to read two files.

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function declaredIcons(html) {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => ({
      rel: tag.match(/\brel="([^"]*)"/)?.[1] ?? '',
      href: tag.match(/\bhref="([^"]*)"/)?.[1] ?? '',
    }))
    .filter(({ rel }) => rel.includes('icon') || rel === 'manifest');
}

test('the markup declares the full favicon set, in order', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');

  // An SVG for modern tabs, a PNG fallback, the .ico for legacy, a touch icon
  // for iOS, and the manifest.
  assert.deepEqual(declaredIcons(html).map(({ href }) => href), [
    '/favicon-96x96.png',
    '/favicon.svg',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/site.webmanifest',
  ]);
});

test('every declared icon is a file that exists', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');

  for (const { href } of declaredIcons(html)) {
    // Root-absolute in the markup; root-relative on disk.
    assert.equal(await exists(href.slice(1)), true, `${href} exists`);
  }

  // The bare request a crawler makes without reading the markup at all.
  assert.equal(await exists('favicon.ico'), true);
});

test('the manifest carries this site\'s identity rather than a placeholder', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'site.webmanifest'), 'utf8'));

  assert.equal(manifest.name, 'Miner 2149');
  assert.equal(manifest.theme_color, '#11151d');
});

test('every icon the manifest names is a file that exists', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'site.webmanifest'), 'utf8'));

  assert.notEqual(manifest.icons.length, 0);
  for (const icon of manifest.icons) {
    assert.equal(await exists(icon.src.replace(/^\//, '')), true, `${icon.src} exists`);
  }
});
