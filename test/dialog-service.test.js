import assert from 'node:assert/strict';
import test from 'node:test';

import { createDialogService } from '../scripts/dialog-service.js';

// The sixteen positional arguments message.js draws a dialog from. Opaque
// markers are enough: the service only has to hand them over first, in order.
const PARTS = Array.from({ length: 16 }, (_, i) => `part${i}`);
const MINE = { name: 'mineScreen' };

/**
 * Records every dialog instead of drawing it, and keeps the callbacks so a test
 * can play the player: `open` is what is on screen now, and `press` dismisses it
 * through one of its buttons.
 */
function setup() {
  const shown = [];
  const record = kind => (...args) => {
    const parts = args.slice(0, PARTS.length);
    const [parent, text, first, second] = args.slice(PARTS.length);
    shown.push({ kind, parts, parent, text, first, second });
  };

  const dialogs = createDialogService({
    showMessage: record('message'),
    showConfirmation: record('confirm'),
    showInput: record('input'),
    parts: PARTS,
    screen: MINE,
  });

  return {
    dialogs,
    shown,
    open: () => shown.at(-1),
    texts: () => shown.map(entry => entry.text),
    press: (button = 'first') => shown.at(-1)[button](),
  };
}

test('each kind of dialog is handed the sixteen parts first, then what to show', () => {
  const { dialogs, shown } = setup();
  const parent = { name: 'optionsMenu' };
  const yes = () => {};
  const no = () => {};

  dialogs.message(parent, 'Sold!', yes);
  dialogs.confirm(parent, 'Resign?', yes, no);
  dialogs.input(parent, 'Day:12', yes, no);

  for (const entry of shown) {
    assert.deepEqual(entry.parts, PARTS, `${entry.kind} gets every part, in order`);
    assert.equal(entry.parent, parent);
  }
  assert.deepEqual(shown.map(e => e.kind), ['message', 'confirm', 'input']);
  assert.equal(shown[1].first, yes);
  assert.equal(shown[1].second, no);
});

test('a notice is a message over the mine screen', () => {
  const { dialogs, open } = setup();

  dialogs.notice('You can only build next to a completed structure.');

  assert.equal(open().kind, 'message');
  assert.equal(open().parent, MINE);
});

test('queued messages appear one at a time, in the order they were queued', () => {
  const { dialogs, texts, press } = setup();

  dialogs.enqueue('first');
  dialogs.enqueue('second');
  dialogs.enqueue('third');
  dialogs.drain();

  assert.deepEqual(texts(), ['first'], 'only the first is up');
  press();
  assert.deepEqual(texts(), ['first', 'second']);
  press();
  press();
  assert.deepEqual(texts(), ['first', 'second', 'third']);
  assert.equal(dialogs.pending(), 0);
});

test('a message waits on its own callback before the next one appears', () => {
  const { dialogs, texts, press } = setup();
  const seen = [];

  dialogs.enqueue('news', () => seen.push(`callback saw ${texts().length} dialog(s)`));
  dialogs.enqueue('after');
  dialogs.drain();
  press();

  assert.deepEqual(seen, ['callback saw 1 dialog(s)'], 'the callback ran before the next was shown');
  assert.deepEqual(texts(), ['news', 'after']);
});

test('each answer to a queued confirmation runs its own callback, then the queue moves on', () => {
  const answered = [];

  for (const [button, expected] of [['first', 'yes'], ['second', 'no']]) {
    const { dialogs, open, texts, press } = setup();

    dialogs.enqueue('Accept the engineer?', undefined, true, () => answered.push('yes'), () => answered.push('no'));
    dialogs.enqueue('next');
    dialogs.drain();

    assert.equal(open().kind, 'confirm');
    press(button);
    assert.equal(answered.at(-1), expected);
    assert.deepEqual(texts(), ['Accept the engineer?', 'next']);
  }
});

// Replaces two source-text assertions that could only check the queue's
// implementation lived in app.js. This checks what it does: a task decides when
// the queue resumes, which is what lets the meteor storm hold the turn open.
test('a task is handed the drain, and the queue waits until the task calls it', () => {
  const { dialogs, texts, press } = setup();
  let resume = null;

  dialogs.enqueue('before the storm');
  dialogs.enqueueTask(done => { resume = done; });
  dialogs.enqueue('after the storm');
  dialogs.drain();
  press();

  assert.equal(typeof resume, 'function', 'the task received the drain');
  assert.deepEqual(texts(), ['before the storm'], 'and nothing after it has appeared yet');

  resume();
  assert.deepEqual(texts(), ['before the storm', 'after the storm']);
});

test('tasks run serially, never side by side', () => {
  const { dialogs } = setup();
  const running = [];
  const resumes = [];

  dialogs.enqueueTask(done => { running.push('a'); resumes.push(done); });
  dialogs.enqueueTask(done => { running.push('b'); resumes.push(done); });
  dialogs.drain();

  assert.deepEqual(running, ['a']);
  resumes[0]();
  assert.deepEqual(running, ['a', 'b']);
});

// This is how the turn's ending waits for its own news.
test('the drained callback runs once, only after everything queued has been seen', () => {
  const { dialogs, texts, press } = setup();
  let ended = 0;

  dialogs.whenDrained(() => { ended += 1; });
  dialogs.enqueue('flash');
  dialogs.drain();

  assert.equal(ended, 0, 'not while a message is still up');
  press();
  assert.equal(ended, 1);

  dialogs.drain();
  assert.equal(ended, 1, 'and never a second time');
  assert.deepEqual(texts(), ['flash']);
});

test('registering a second drained callback replaces the first', () => {
  const { dialogs } = setup();
  const ran = [];

  dialogs.whenDrained(() => ran.push('first'));
  dialogs.whenDrained(() => ran.push('second'));
  dialogs.drain();

  assert.deepEqual(ran, ['second']);
});

test('draining an empty queue with nothing registered shows nothing', () => {
  const { dialogs, shown } = setup();

  dialogs.drain();

  assert.deepEqual(shown, []);
});

test('messages queued by a callback land behind ones already waiting', () => {
  const { dialogs, texts, press } = setup();

  dialogs.enqueue('one', () => dialogs.enqueue('queued late'));
  dialogs.enqueue('two');
  dialogs.drain();
  press();
  press();
  press();

  assert.deepEqual(texts(), ['one', 'two', 'queued late']);
});

// The original invoked callbacks with `.apply()` and no receiver. Calling them
// as `entry.onDone()` would quietly hand them the queue's bookkeeping as `this`.
test('a callback is not handed the queue entry as its receiver', () => {
  const { dialogs, press } = setup();
  let receiver = 'unset';

  dialogs.enqueue('x', function () { receiver = this; });
  dialogs.drain();
  press();

  assert.equal(receiver, undefined);
});

// The death-rate ending uses this: the colony is over, so the news queued ahead
// of that is dropped rather than shown after the game-over message.
test('discarding drops everything waiting, and the queue shows nothing more', () => {
  const { dialogs, shown } = setup();

  dialogs.enqueue('a flash nobody will see');
  dialogs.enqueueTask(() => { throw new Error('a discarded task must not run'); });
  dialogs.discard();
  dialogs.drain();

  assert.equal(dialogs.pending(), 0);
  assert.deepEqual(shown, []);
});

// Only the queue was ever reset on this path. A registered ending is a separate
// piece of state and outlives the discard, as it did before.
test('discarding the queue leaves a drained callback registered', () => {
  const { dialogs } = setup();
  let ended = false;

  dialogs.whenDrained(() => { ended = true; });
  dialogs.enqueue('dropped');
  dialogs.discard();
  dialogs.drain();

  assert.equal(ended, true);
});
