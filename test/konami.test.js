import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KONAMI_LENGTH,
  createKonamiMatcher,
  pressKey,
  shouldIgnoreKeyEvent,
} from '../scripts/konami.js';

const CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

function enter(keys, initial = createKonamiMatcher()) {
  return keys.reduce(
    (carry, key) => {
      const result = pressKey(carry.state, key);
      return { state: result.state, triggers: carry.triggers + (result.triggered ? 1 : 0) };
    },
    { state: initial, triggers: 0 },
  );
}

test('the full code fires exactly once, on the last key', () => {
  let state = createKonamiMatcher();
  const fired = [];

  for (const key of CODE) {
    const result = pressKey(state, key);
    state = result.state;
    fired.push(result.triggered);
  }

  assert.equal(KONAMI_LENGTH, CODE.length);
  assert.deepEqual(fired, [...Array(CODE.length - 1).fill(false), true]);
});

test('a partial prefix restart does not throw away the keys already entered', () => {
  // The case a reset-to-zero index gets wrong: the third ArrowUp fails the
  // ArrowDown that was expected, but it is itself a valid first key, and the
  // ArrowUp before it is a valid second.
  const { triggers } = enter(['ArrowUp', 'ArrowUp', 'ArrowUp', ...CODE.slice(2)]);

  assert.equal(triggers, 1, 'the code still completes');
});

test('a wrong key mid-sequence means the code must be re-entered', () => {
  const { triggers, state } = enter([...CODE.slice(0, 8), 'x', 'b', 'a']);

  assert.equal(triggers, 0);
  assert.equal(enter(CODE, state).triggers, 1, 'and a clean run afterwards still works');
});

test('b and a are case-insensitive, because shift is a plausible way to type them', () => {
  assert.equal(enter([...CODE.slice(0, 8), 'B', 'A']).triggers, 1);
});

test('the buffer is cleared on a match so one more key cannot re-fire it', () => {
  const after = enter(CODE);

  assert.deepEqual(after.state.buffer, []);
  assert.equal(pressKey(after.state, 'a').triggered, false);
});

test('the code can be entered again from scratch', () => {
  const first = enter(CODE);
  const second = enter(CODE, first.state);

  assert.equal(second.triggers, 1);
});

test('a long run of noise before the code does not prevent it firing', () => {
  const noise = Array.from({ length: 200 }, (_, index) => `key${index}`);

  assert.equal(enter([...noise, ...CODE]).triggers, 1);
});

test('non-keys are ignored without disturbing progress', () => {
  let { state } = enter(CODE.slice(0, 9));

  for (const junk of ['', null, undefined, 42, {}]) {
    const result = pressKey(state, junk);
    assert.equal(result.triggered, false);
    state = result.state;
  }

  assert.equal(pressKey(state, 'a').triggered, true, 'the ninth key is still in the buffer');
});

test('key presses aimed at a form control are ignored', () => {
  // The save-name flow binds its own window keydown listener, and the display
  // controls are form elements; a bare listener would steal b and a from them.
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']) {
    assert.equal(shouldIgnoreKeyEvent({ target: { tagName } }), true, tagName);
  }
  assert.equal(shouldIgnoreKeyEvent({ target: { isContentEditable: true } }), true);
  assert.equal(shouldIgnoreKeyEvent({ target: { tagName: 'BODY' } }), false);
});

test('modified and composing key presses are ignored', () => {
  assert.equal(shouldIgnoreKeyEvent({ isComposing: true, target: { tagName: 'BODY' } }), true);
  assert.equal(shouldIgnoreKeyEvent({ metaKey: true, target: { tagName: 'BODY' } }), true);
  assert.equal(shouldIgnoreKeyEvent({ ctrlKey: true, target: { tagName: 'BODY' } }), true);
  assert.equal(shouldIgnoreKeyEvent({ altKey: true, target: { tagName: 'BODY' } }), true);
  assert.equal(shouldIgnoreKeyEvent(undefined), false);
});

test('the matcher state is frozen, so a caller cannot mutate it mid-sequence', () => {
  const { state } = enter(CODE.slice(0, 3));

  assert.throws(() => state.buffer.push('a'));
});
