import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SKIN_CATALOGUE } from '../scripts/skin-catalogue.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// Moved out of the browser suite 2026-09-17. The Mission Log is static markup by
// design -- it depends on no game state, so it survives a failed module load and
// a crawler reads it -- which means the browser was rendering a page only to read
// back the HTML we wrote. Reading the file asserts the same things and asserts
// the *reason* the section is static, rather than the consequence.
//
// What genuinely needs a browser stays there: that opening a technical note
// actually reveals it, which is a CSS question.

async function missionLog() {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const section = html.match(
    /<section[^>]*id="mission-log"[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(section, 'the mission log section is present in the served HTML');
  return section;
}

function entries(section) {
  return [...section.matchAll(/<article class="log-entry">[\s\S]*?<\/article>/g)].map(([text]) => text);
}

test('the mission log is in the served HTML, not built by a script', async () => {
  // The whole point of the section being static: no JavaScript, no renderer, and
  // a crawler or a reader-mode pass still gets the content.
  const log = await missionLog();

  assert.notEqual(entries(log).length, 0);
  assert.match(log, /<h3>/);
});

test('transmissions are numbered newest first with no gaps', async () => {
  const log = await missionLog();
  const numbers = [...log.matchAll(/<span class="log-entry__number">Transmission (\d+)<\/span>/g)]
    .map(([, digits]) => Number(digits));

  assert.notEqual(numbers.length, 0);
  assert.deepEqual(numbers, [...numbers].sort((left, right) => right - left));

  // A deleted entry used to leave a hole in the sequence.
  const ascending = [...numbers].sort((left, right) => left - right);
  assert.deepEqual(ascending, ascending.map((_, index) => index + 1));
});

test('every entry is dated for machines as well as for readers, and labelled', async () => {
  const log = await missionLog();
  const count = entries(log).length;

  assert.equal([...log.matchAll(/<time datetime="\d{4}-\d{2}-\d{2}"/g)].length, count);
  assert.equal([...log.matchAll(/class="log-entry__label /g)].length, count);
});

test('every entry carries a technical note, closed by default', async () => {
  const log = await missionLog();

  for (const entry of entries(log)) {
    assert.match(entry, /<details class="log-entry__detail">/);
    // A plain <details> with no `open`, so the platform supplies the keyboard
    // and screen-reader behaviour and the note starts collapsed.
    assert.doesNotMatch(entry, /<details[^>]*\bopen\b/);
  }
});

test('the log points at the changelog rather than becoming one', async () => {
  const log = await missionLog();

  assert.match(log, /class="source-note"[\s\S]*?href="[^"]*CHANGELOG\.md"/);
});

test('an unshipped transmission may tease a reward but never name it', async () => {
  // The Mission Log is the one place the site promises work that does not exist
  // yet. The Field Kit's lede promises the game will not say how a frame is
  // earned, so a teaser must not name which frame a coming mini-game unlocks.
  const log = await missionLog();
  const teasers = entries(log).filter((entry) => entry.includes('log-entry__label--building'));

  assert.notEqual(teasers.length, 0, 'there is at least one Under construction entry');

  const text = teasers.join(' ');
  for (const { label } of SKIN_CATALOGUE.filter(({ unlock }) => unlock !== null)) {
    assert.ok(!text.includes(label), `no teaser names the ${label} frame`);
  }
});
