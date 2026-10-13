/**
 * The four repairs a power-plant fault can open, as pure state machines.
 *
 * Port addition (user, 2026-10-13). Tapping the failing unit on the overload's
 * breaker panel opens one of these; finishing it fixes that fault. Each takes
 * the asteroid class, which sizes it, and a PocketC-exclusive `random`, which
 * lays it out. `tap(state, target)` answers one press and says what it was:
 *
 *   'progress'  a right move that did not finish the repair
 *   'mistake'   a wrong one; the overload takes time off its countdown
 *   'done'      the repair is finished
 *   'ignored'   nothing to do with this repair, or not the moment for it
 *
 * Targets are plain objects naming what was pressed -- `{ kind: 'switch',
 * column, row }`, `{ kind: 'key', key }` -- so the rules never see a pixel. The
 * view decides what is under the pointer.
 *
 * None of it is reachable on the untouched path: a repair only opens when the
 * player taps a unit, so none of it can change an overload nobody answers.
 */

export const GAME_KINDS = Object.freeze(['switches', 'keypad', 'fuses', 'breaker']);

const COLUMN_LETTERS = 'ABCD';

function draw(random, max) {
  const value = random(max);
  if (!Number.isInteger(value) || value < 0 || value >= max) {
    throw new RangeError(`random(${max}) must return an integer from 0 through ${max - 1}`);
  }
  return value;
}

/** `count` distinct draws from 0..max-1, in the order drawn. */
function distinct(random, max, count) {
  const pool = Array.from({ length: max }, (_, index) => index);
  const picked = [];
  for (let index = 0; index < count; index += 1) {
    picked.push(pool.splice(draw(random, pool.length), 1)[0]);
  }
  return picked;
}

// --- Throw the switches ------------------------------------------------------
// A grid of switches, columns A.. and rows 1..; a list like A-2 D-4 B-3 to throw
// in that order. Larger, and longer, on harder asteroids.

export function switchesFor(difficulty) {
  return {
    size: difficulty <= 2 ? 3 : 4,
    length: difficulty <= 2 ? 3 : difficulty <= 4 ? 4 : 5,
  };
}

export function switchLabel({ column, row }) {
  return `${COLUMN_LETTERS[column]}-${row + 1}`;
}

function createSwitches({ difficulty, random }) {
  const { size, length } = switchesFor(difficulty);
  const sequence = distinct(random, size * size, length)
    .map((cell) => ({ column: cell % size, row: Math.floor(cell / size) }));
  return { kind: 'switches', size, sequence, thrown: 0 };
}

function tapSwitches(state, target) {
  if (target.kind !== 'switch') return { state, result: 'ignored' };
  const due = state.sequence[state.thrown];
  if (target.column !== due.column || target.row !== due.row) {
    // Throwing one already thrown does nothing at all.
    const thrown = state.sequence.slice(0, state.thrown)
      .some(({ column, row }) => column === target.column && row === target.row);
    return { state, result: thrown ? 'ignored' : 'mistake' };
  }
  const next = { ...state, thrown: state.thrown + 1 };
  return { state: next, result: next.thrown === state.sequence.length ? 'done' : 'progress' };
}

// --- Repeat the keypad -------------------------------------------------------
// The keypad shows a sequence one key at a time, then takes it back. A wrong key
// costs time and is not counted; the player carries on from where they were.

export const KEY_SHOW_MS = 450;
export const KEY_GAP_MS = 150;

export function keypadLengthFor(difficulty) {
  return 3 + Math.floor((difficulty - 1) / 2);
}

function createKeypad({ difficulty, random }) {
  const sequence = Array.from({ length: keypadLengthFor(difficulty) }, () => draw(random, 9) + 1);
  return { kind: 'keypad', sequence, entered: 0, shownFor: 0 };
}

function showingMs(state) {
  return state.sequence.length * (KEY_SHOW_MS + KEY_GAP_MS);
}

/** The key lit while the sequence is shown, or null between keys and after. */
export function keypadLit(state) {
  if (state.shownFor >= showingMs(state)) return null;
  const slot = Math.floor(state.shownFor / (KEY_SHOW_MS + KEY_GAP_MS));
  const into = state.shownFor - slot * (KEY_SHOW_MS + KEY_GAP_MS);
  return into < KEY_SHOW_MS ? state.sequence[slot] : null;
}

export function keypadShowing(state) {
  return state.shownFor < showingMs(state);
}

function tapKeypad(state, target) {
  if (target.kind !== 'key' || keypadShowing(state)) return { state, result: 'ignored' };
  if (target.key !== state.sequence[state.entered]) return { state, result: 'mistake' };
  const next = { ...state, entered: state.entered + 1 };
  return { state: next, result: next.entered === state.sequence.length ? 'done' : 'progress' };
}

// --- Replace the fuse ----------------------------------------------------------
// A row of fuses, one blown. Find it, fit a part of the same rating from the
// tray, then reset the board -- in that order.

export const FUSE_RATINGS = Object.freeze(['10A', '15A', '20A', '30A']);

export function fusesFor(difficulty) {
  return { fuses: 3 + Math.floor(difficulty / 2), parts: difficulty <= 2 ? 3 : 4 };
}

function createFuses({ difficulty, random }) {
  const { fuses, parts } = fusesFor(difficulty);
  const ratings = Array.from({ length: fuses }, () => FUSE_RATINGS[draw(random, parts)]);
  const blown = draw(random, fuses);
  return { kind: 'fuses', ratings, blown, tray: FUSE_RATINGS.slice(0, parts), step: 'find' };
}

const FUSE_STEPS = Object.freeze({ find: 'fit', fit: 'reset' });

function tapFuses(state, target) {
  const right = (state.step === 'find' && target.kind === 'fuse' && target.index === state.blown)
    || (state.step === 'fit' && target.kind === 'part' && state.tray[target.index] === state.ratings[state.blown])
    || (state.step === 'reset' && target.kind === 'reset');
  if (right) {
    if (state.step === 'reset') return { state: { ...state, step: 'done' }, result: 'done' };
    return { state: { ...state, step: FUSE_STEPS[state.step] }, result: 'progress' };
  }
  const relevant = ['fuse', 'part', 'reset'].includes(target.kind);
  return { state, result: relevant ? 'mistake' : 'ignored' };
}

// --- Work the breaker -----------------------------------------------------------
// Turn off the breaker, re-route the cable around the burnt junction, prime the
// fuse, turn the breaker back on. Every control is on screen throughout; only
// the next one in that order is right.

export const BREAKER_STEPS = Object.freeze(['off', 'route', 'prime', 'on']);

export function routesFor(difficulty) {
  return difficulty <= 2 ? 2 : 3;
}

function createBreaker({ difficulty, random }) {
  const routes = routesFor(difficulty);
  return { kind: 'breaker', routes, clearRoute: draw(random, routes), step: 0, breakerOn: true, routed: null };
}

function tapBreaker(state, target) {
  const step = BREAKER_STEPS[state.step];
  let next = null;
  if (step === 'off' && target.kind === 'breaker') next = { breakerOn: false };
  if (step === 'route' && target.kind === 'route' && target.index === state.clearRoute) next = { routed: target.index };
  if (step === 'prime' && target.kind === 'prime') next = {};
  if (step === 'on' && target.kind === 'breaker') next = { breakerOn: true };
  if (next) {
    const advanced = { ...state, ...next, step: state.step + 1 };
    return { state: advanced, result: advanced.step === BREAKER_STEPS.length ? 'done' : 'progress' };
  }
  const relevant = ['breaker', 'route', 'prime'].includes(target.kind);
  return { state, result: relevant ? 'mistake' : 'ignored' };
}

// --- The four, behind one face -----------------------------------------------

const GAMES = Object.freeze({
  switches: { create: createSwitches, tap: tapSwitches },
  keypad: { create: createKeypad, tap: tapKeypad },
  fuses: { create: createFuses, tap: tapFuses },
  breaker: { create: createBreaker, tap: tapBreaker },
});

/**
 * A repair for one fault: a kind drawn from the four, never the one just
 * played, then laid out by its own draws.
 */
export function createBreakerGame({ difficulty, random, previousKind = null }) {
  const kinds = GAME_KINDS.filter((kind) => kind !== previousKind);
  const kind = kinds[draw(random, kinds.length)];
  return GAMES[kind].create({ difficulty, random });
}

export function tapBreakerGame(state, target) {
  return GAMES[state.kind].tap(state, target);
}

/** Time passing inside a repair. Only the keypad's showing phase uses it. */
export function advanceBreakerGame(state, milliseconds) {
  if (state.kind !== 'keypad') return state;
  return { ...state, shownFor: state.shownFor + Math.max(0, milliseconds) };
}

/**
 * The line the repair puts in the caption slot. Draft copy, for the user to
 * approve; quoted, as the source's captions are.
 */
export function breakerGameCaption(state) {
  switch (state.kind) {
    case 'switches': return '"Throw the switches!"';
    case 'keypad': return keypadShowing(state) ? '"Watch the keypad!"' : '"Repeat the code!"';
    case 'fuses': return {
      find: '"Find the blown fuse!"',
      fit: '"Fit the right fuse!"',
      reset: '"Reset the board!"',
      done: '"Reset the board!"',
    }[state.step];
    case 'breaker': return [
      '"Turn off the breaker!"',
      '"Re-route the cable!"',
      '"Prime the fuse!"',
      '"Turn on the breaker!"',
      '"Turn on the breaker!"',
    ][state.step];
    default: return '';
  }
}
