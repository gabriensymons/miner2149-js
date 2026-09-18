import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';

test('a session starts holding what it was given', () => {
  const initialState = { credits: 10 };
  const session = createGameSession({ initialState });

  assert.equal(session.getState(), initialState);
  assert.equal(createGameSession().getState().credits, undefined);
});

test('replacing swaps the state and returns it', () => {
  const session = createGameSession({ initialState: { credits: 10 } });
  const next = { credits: 20 };

  assert.equal(session.replace(next), next);
  assert.equal(session.getState(), next);
});

test('replacing tells every listener, once, with the new state', () => {
  const session = createGameSession({ initialState: { credits: 10 } });
  const seen = [];
  session.subscribe((state) => seen.push(['first', state.credits]));
  session.subscribe((state) => seen.push(['second', state.credits]));

  session.replace({ credits: 20 });

  assert.deepEqual(seen, [['first', 20], ['second', 20]]);
});

test('listeners fire in subscription order', () => {
  // app.js depends on this: the listener that syncs its own reference to the
  // state must run before the one that redraws the screen from it.
  const session = createGameSession();
  const order = [];
  for (const name of ['a', 'b', 'c', 'd']) session.subscribe(() => order.push(name));

  session.replace({});

  assert.deepEqual(order, ['a', 'b', 'c', 'd']);
});

test('every listener sees the new state, never the old one', () => {
  // The state has to be swapped before anyone is told, or a listener reads the
  // colony it is being notified about the replacement of.
  const session = createGameSession({ initialState: { credits: 10 } });
  const observed = [];
  session.subscribe(() => observed.push(session.getState().credits));

  session.replace({ credits: 20 });

  assert.deepEqual(observed, [20]);
});

test('unsubscribing stops the listener without disturbing the others', () => {
  const session = createGameSession();
  const seen = [];
  const stop = session.subscribe(() => seen.push('goes'));
  session.subscribe(() => seen.push('stays'));

  session.replace({});
  stop();
  session.replace({});

  assert.deepEqual(seen, ['goes', 'stays', 'stays']);
});

test('subscribing the same listener twice still notifies it once', () => {
  const session = createGameSession();
  let calls = 0;
  const listener = () => { calls += 1; };
  session.subscribe(listener);
  session.subscribe(listener);

  session.replace({});

  assert.equal(calls, 1);
});

test('subscribing during a notification does not change who is notified now', () => {
  // Iterating a copy is what makes this true, and it matters: a listener added
  // mid-notification has not seen the state it would be told about.
  const session = createGameSession();
  const seen = [];
  const inner = () => seen.push('inner');
  let added = false;
  session.subscribe(() => {
    seen.push('outer');
    if (!added) {
      session.subscribe(inner);
      added = true;
    }
  });

  session.replace({ round: 1 });
  assert.deepEqual(seen, ['outer']);

  // Round two notifies both, and outer runs again -- it did not stop being a
  // listener by adding one.
  session.replace({ round: 2 });
  assert.deepEqual(seen, ['outer', 'outer', 'inner']);
});

test('unsubscribing during a notification does not skip a pending listener', () => {
  const session = createGameSession();
  const seen = [];
  let stopSecond;
  session.subscribe(() => { seen.push('first'); stopSecond(); });
  stopSecond = session.subscribe(() => seen.push('second'));

  // The second listener was already scheduled for this replacement.
  session.replace({});
  assert.deepEqual(seen, ['first', 'second']);

  session.replace({});
  assert.deepEqual(seen, ['first', 'second', 'first']);
});

test('update applies a shallow patch and notifies like a replacement', () => {
  const session = createGameSession({ initialState: { credits: 10, day: 3 } });
  const seen = [];
  session.subscribe((state) => seen.push(state.credits));

  const next = session.update({ credits: 20 });

  assert.deepEqual(next, { credits: 20, day: 3 });
  assert.deepEqual(seen, [20]);
});

test('update replaces rather than mutating, so the previous state is intact', () => {
  const previous = { credits: 10, day: 3 };
  const session = createGameSession({ initialState: previous });

  session.update({ credits: 20 });

  assert.equal(previous.credits, 10);
  assert.notEqual(session.getState(), previous);
});
