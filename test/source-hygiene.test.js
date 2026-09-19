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

test('the economy never writes colony state by hand', async () => {
  // Stage 3 of Plan 13. Credits, ore, probes and the sold-today flag all move
  // through the session now, so every change to them redraws the screen from
  // the state rather than relying on the caller to update the one sprite it
  // happened to be thinking about.
  //
  // The pattern this replaces was `creditText.text = gameData.credits += value`:
  // a single statement that changed the colony and repainted one label, which is
  // how a screen and its state drift apart.
  const source = await readFile(path.join(root, 'scripts/app.js'), 'utf8');
  const writes = [...source.matchAll(
    /gameData\.(?:credits|diridium|probes|soldToday)\s*(?:\+=|-=|=[^=])/g,
  )];

  assert.deepEqual(writes.map(([match]) => match), []);
});

test('the shop, the level and the chosen asteroid are never written by hand', async () => {
  // Stage 4 of Plan 13. Together with the economy assertion above, every scalar
  // field of the colony now moves through the session; only the map grids are
  // still written in place, which is stage 5.
  const source = await readFile(path.join(root, 'scripts/app.js'), 'utf8');
  const writes = [...source.matchAll(
    /gameData\.(?:shopBtn|shopPrice|level|asteroid|difficulty|miningEfficiency)\s*(?:\+=|-=|=[^=])/g,
  )];

  assert.deepEqual(writes.map(([match]) => match), []);
});

test('mining efficiency is stored, not a getter that claims to be derived', async () => {
  // It starts at `110 - difficulty * 10` and the engineer event then raises it
  // by 20, so it stops being a function of the asteroid class after one visitor.
  // The source agrees: `meff` is written to every save record.
  //
  // It was declared as a getter, which nothing ever saw -- `deepClone` is a JSON
  // round-trip, so every live colony and every save already held the number. A
  // getter reintroduced here would silently become a value again on the first
  // clone, and would be wrong about the engineer.
  const source = await readFile(path.join(root, 'scripts/gamedata.js'), 'utf8');

  assert.doesNotMatch(source, /get\s+miningEfficiency\s*\(/);
  assert.match(source, /miningEfficiency:\s*110,/);
});

test('the map grids are never written in place', async () => {
  // Stage 5 of Plan 13, and the last of the conversions. Every change to the
  // colony now goes through the session, scalars and grids alike.
  //
  // `session.update()` is a shallow patch, so a map mutated in place would be
  // the *same* object in the state before and after -- no listener would have
  // anything to compare, and the change would be invisible to anything watching
  // for one. setSite() returns new maps instead.
  const source = await readFile(path.join(root, 'scripts/app.js'), 'utf8');
  const writes = [...source.matchAll(/gameData\.maps(?:\[[^\]]*\])+\s*=[^=]/g)];

  assert.deepEqual(writes.map(([match]) => match), []);
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
