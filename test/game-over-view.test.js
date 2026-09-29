import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGameOverScreen, describeEnding, showEnding } from '../scripts/game-over-view.js';
import { regular } from '../scripts/font-styles.js';
import { createGameAssets } from '../scripts/game-assets.js';
import { FakeBitmapText, createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

const completion = {
  creditsEarned: 1234,
  diridiumRemaining: 56,
  sellPrice: 7,
  totalCredits: 1626,
  futureUse: 'amusement-park',
};

test('a resignation reports the day and the credits it was given', () => {
  assert.deepEqual(describeEnding({ day: 40, credits: 812500 }).lines, [
    'Mission Status: RESIGNED on day 40',
    'Credits Remaining: 812500',
  ]);
});

test('a failure names its cause, for each way a colony can fail', () => {
  for (const cause of ['Death Rate Reached 100%', 'Worker Revolt', 'Insufficient Funds']) {
    assert.deepEqual(describeEnding({ failure: cause, day: 88, credits: 0 }).lines, [
      'Mission Status: FAILURE on day 88',
      `Cause: ${cause}`,
    ]);
  }
});

test('a completed mission lists its score and leaves the second line empty', () => {
  const { lines } = describeEnding({ completion, day: 730, credits: 1 });

  assert.equal(lines[0], [
    'Mission Status: COMPLETE',
    'Credits Earned: 1234',
    'Diridium Remaining: 56',
    'Current Selling Price: 7',
    'Total Credits: 1626',
  ].join('\n'));
  assert.equal(lines[1], '');
});

test('only a completed mission has something to say once game over is up', () => {
  assert.match(describeEnding({ completion, day: 730, credits: 1 }).followUp, /amusement park/);
  assert.equal(describeEnding({ failure: 'Worker Revolt', day: 9, credits: 1 }).followUp, null);
  assert.equal(describeEnding({ day: 9, credits: 1 }).followUp, null);
});

test('completion outranks failure, and failure outranks resignation', () => {
  assert.match(describeEnding({ completion, failure: 'Worker Revolt', day: 730, credits: 1 }).lines[0], /COMPLETE/);
  assert.match(describeEnding({ failure: 'Worker Revolt', day: 9, credits: 1 }).lines[0], /FAILURE/);
});

test('a completed mission is laid out from the corner, the others centred lower down', () => {
  assert.deepEqual(describeEnding({ completion, day: 730, credits: 1 }).layout, { anchor: [0, 0], position: [18, 20] });
  assert.deepEqual(describeEnding({ day: 9, credits: 1 }).layout, { anchor: [0.5, 0], position: [75, 37] });
  assert.deepEqual(describeEnding({ failure: 'x', day: 9, credits: 1 }).layout, { anchor: [0.5, 0], position: [75, 37] });
});

/** A stand-in for a Pixi BitmapText: records anchor, position and text. */
function line() {
  return {
    text: 'stale',
    anchor: { set(x, y) { this.value = [x, y]; } },
    position: { set(x, y) { this.value = [x, y]; } },
  };
}

test('showing an ending writes both lines and moves only the first', () => {
  const first = line();
  const second = line();

  showEnding({ first, second }, describeEnding({ completion, day: 730, credits: 1 }));

  assert.match(first.text, /^Mission Status: COMPLETE\n/);
  assert.deepEqual(first.anchor.value, [0, 0]);
  assert.deepEqual(first.position.value, [18, 20]);
  assert.equal(second.text, '', 'the stale text from an earlier ending is cleared');
  assert.equal(second.position.value, undefined, 'the second line keeps where it was built');
});

test('an ending shown after a completion puts the first line back where it belongs', () => {
  const first = line();
  const second = line();

  showEnding({ first, second }, describeEnding({ completion, day: 730, credits: 1 }));
  showEnding({ first, second }, describeEnding({ day: 3, credits: 5 }));

  assert.deepEqual(first.anchor.value, [0.5, 0]);
  assert.deepEqual(first.position.value, [75, 37]);
  assert.equal(second.text, 'Credits Remaining: 5');
});

// Building the screen. Geometry is written out as init() had it before phase 9.

function buildScreen() {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const on = { newMine: () => 'new mine', loadMine: () => 'load mine', quit: () => 'quit' };
  const built = buildGameOverScreen({ PIXI, sheet, assets, buildTextButton: buttons.buildTextButton, on });
  return { ...built, assets, buttons, on };
}

test('the game-over panel sits inset from the corner, with two empty status lines centred on it', () => {
  const { screen, status } = buildScreen();

  assert.equal(screen.texture.name, 'screen game over.png');
  assert.deepEqual([screen.x, screen.y], [4, 3]);
  for (const [line, y] of [[status.first, 37], [status.second, 52]]) {
    assert.ok(line instanceof FakeBitmapText);
    assert.equal(line.style, regular);
    assert.deepEqual([line.text, line.x, line.y, line.anchor.x, line.anchor.y], ['', 75, y, 0.5, 0]);
  }
});

test('New Mine and Load Mine stretch side by side, Quit sits beneath at its own size', () => {
  const { screen, status, assets, buttons, on } = buildScreen();
  const menu = assets.menuButton;
  const textures = [menu.normal, menu.hover, menu.down];

  assert.deepEqual(buttons.calls.map(({ args }) => args), [
    [screen, 48, 14, 17, 93, ...textures, on.newMine, 'New Mine', regular, menu.nineSlice],
    [screen, 49, 14, 86, 93, ...textures, on.loadMine, 'Load Mine', regular, menu.nineSlice],
    [screen, 42, 14, 55, 110, ...textures, on.quit, 'Quit'],
  ]);
  assert.deepEqual(screen.children, [status.first, status.second, ...buttons.calls]);
});

test('the built status lines are what showEnding writes to', () => {
  const { status } = buildScreen();

  showEnding(status, describeEnding({ failure: 'Out of air', day: 9, credits: 0 }));
  assert.equal(status.first.text, 'Mission Status: FAILURE on day 9');
  assert.equal(status.second.text, 'Cause: Out of air');
});
