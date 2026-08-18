import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';

import '../tools/build-static.js';

const output = new URL('../dist/', import.meta.url);

async function exists(path) {
  try {
    await access(new URL(path, output));
    return true;
  } catch {
    return false;
  }
}

test('the static build contains runtime files but excludes source-only assets', async () => {
  assert.equal(await exists('index.html'), true);
  assert.equal(await exists('scripts/app.js'), true);
  assert.equal(await exists('scripts/site-controls.js'), true);
  assert.equal(await exists('assets/spritesheet.json'), true);
  assert.equal(await exists('assets/miner2149-logo.svg'), true);
  assert.equal(await exists('assets/skins/palm-iiic.png'), true);
  assert.equal(await exists('assets/skins/palm-iiie.png'), true);
  assert.equal(await exists('assets/skins/palm-v.png'), true);
  assert.equal(await exists('assets/skins/palm-viix.png'), true);
  assert.equal(await exists('assets/skins/palm-m100.png'), true);
  assert.equal(await exists('assets/skins/palm-m505.png'), true);
  assert.equal(await exists('assets/social/miner2149-og.png'), true);
  assert.equal(await exists('assets/fonts/palm-os-bitmap-white.fnt'), true);
  assert.equal(await exists('robots.txt'), true);
  assert.equal(await exists('sitemap.xml'), true);
  assert.equal(await exists('assets/fonts/palm-os-bitmap-white-adding-bullet.psd'), false);
  assert.equal(await exists('test/'), false);
});
