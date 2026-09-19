import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function javaScriptFiles(directory) {
  const files = [];
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'vendor') {
      files.push(...await javaScriptFiles(relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(relativePath);
    }
  }

  return files;
}

test('production JavaScript contains no debug console output or game-state globals', async () => {
  const files = await javaScriptFiles('scripts');
  const violations = [];

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '');
    executableSource.split('\n').forEach((line, index) => {
      const code = line.trim();
      if (code.startsWith('//')) return;
      if (/console\.(?:log|debug|info)\s*\(/.test(code) || /window\.gameData/.test(code)) {
        violations.push(`${file}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test('public documentation contains no private-network addresses', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const privateAddress = /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/;

  assert.doesNotMatch(readme, privateAddress);
});

test('the site includes the original game guide without the cloud-save warning', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /href="#introduction"/);
  assert.match(html, /href="#playing-instructions"/);
  assert.match(html, /The year is 2149\./);
  assert.match(html, /Use the building selector/);
  assert.doesNotMatch(html, /Cloud saves are disabled pending security verification\./);
});

test('the home page exposes complete search and social metadata', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const structuredDataSource = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];

  assert.match(html, /<title>Miner 2149 — Palm OS Strategy Game \| Play Online<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/miner2149\.com\/">/);
  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/miner2149\.com\/assets\/social\/miner2149-og\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(structuredDataSource);

  const structuredData = JSON.parse(structuredDataSource);
  assert.equal(structuredData['@type'], 'VideoGame');
  assert.equal(structuredData.name, 'Miner 2149');
  assert.equal(structuredData.url, 'https://miner2149.com/');
  assert.deepEqual(structuredData.gamePlatform, ['Web browser', 'Palm OS']);
});

test('crawler files point search engines to the canonical site', async () => {
  const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
  const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/miner2149\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/miner2149\.com\/<\/loc>/);
});

test('the header uses the styleable SVG logo and an accessible controls drawer', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const logo = await readFile(path.join(root, 'assets/miner2149-logo.svg'), 'utf8');

  assert.match(html, /href="\/assets\/miner2149-logo\.svg#miner2149-logo"/);
  assert.match(html, /<button[^>]+>Controls<\/button>[\s\S]*?<a href="#game">Play<\/a>/);
  assert.match(html, /Build your colony\. Mine the future\./);
  assert.match(html, /<div class="game-console-shell">[\s\S]*?<section class="game-console"/);
  assert.match(html, /id="controls-toggle"/);
  assert.match(html, /aria-controls="display-controls-drawer"/);
  assert.match(html, /id="display-controls-drawer"/);
  assert.match(html, /id="game-size"[^>]*step="0\.5"/);
  assert.doesNotMatch(html, /id="game-title"/);
  assert.match(logo, /fill="currentColor"/);
  assert.doesNotMatch(logo, /#231f20/i);
});

test('nothing writes into the colony except the session', async () => {
  // The single invariant Plan 13 exists to produce. It replaces three narrower
  // assertions that each listed the fields their stage had converted -- and
  // between them missed `Object.assign(gameData, ending.state)`, because they
  // were looking for the shape `gameData.field =` and that is not it. The
  // development freeze caught it on the first play-through; this catches the
  // next one without anyone having to play.
  //
  // Matches a write through any property access on the colony: a field, a
  // computed key, a nested grid, or an Object.assign onto the whole thing.
  // Comments are stripped first: this assertion matched its own explanatory
  // prose the first time it ran, which is a small lesson about grepping source
  // for shapes.
  const source = (await readFile(path.join(root, 'scripts/app.js'), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const writes = [
    ...source.matchAll(/gameData(?:\.\w+|\[[^\]]*\])+\s*(?:\+\+|--|[+\-*/]?=(?!=))/g),
    ...source.matchAll(/Object\.assign\(\s*gameData\b/g),
  ].map(([match]) => match);

  assert.deepEqual(writes, []);
});

test('cloneMaps is defined once rather than in every rules module', async () => {
  // It was written out identically in disaster-rules, random-events and
  // meteor-storm. Three copies of a clone is three chances to fix a bug twice.
  const modules = ['disaster-rules', 'random-events', 'meteor-storm', 'app'];

  for (const name of modules) {
    const source = await readFile(path.join(root, `scripts/${name}.js`), 'utf8');
    assert.doesNotMatch(source, /function cloneMaps\(/, `${name}.js defines its own cloneMaps`);
  }
});
