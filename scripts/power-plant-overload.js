/**
 * The power-plant overload as the source plays it: `Pexplode()`, source lines
 * 172-197, as a timeline the scene reads by elapsed time.
 *
 * The original is a blocking loop of bitmaps and `sleep()` calls. The port's
 * scenes are ticker-driven, so every `sleep()` here becomes a span of elapsed
 * milliseconds, and the scene asks what is on screen at a given moment rather
 * than being walked through it.
 *
 * In the source the damage is rolled before this plays -- `Blast(13,1)` runs,
 * then `Pexplode()`, then the alert -- so nothing here decides an outcome. It is
 * presentation in the original's own timings.
 *
 *   text(80,40,"\"Red line on four!\"");
 *   rect(1,100,55,101,130,0);
 *   for(a=1;a<10;a=a+1){
 *     bitmap(95,135,<pulse A>);
 *     if (a==5) text(80,40,"\"It's going to blow!\"");
 *     sleep(300);
 *     bitmap(95,135,<pulse B>);
 *     sleep(300);
 *   }
 *   bitmap(94,133,<blast 1>); sleep(400);
 *   bitmap(93,131,<blast 2>); sleep(400);
 *   bitmap(92,129,<blast 3>); sleep(400);
 *   bitmap(91,127,<blast 4>); sleep(600);
 */

import {
  GAME_KINDS,
  advanceBreakerGame,
  breakerGameCaption,
  createBreakerGame,
  tapBreakerGame,
} from './breaker-games.js';

export const CAPTIONS = Object.freeze({
  // SRCMSG at source line 179, and the one that replaces it at line 183. The
  // quotation marks are the source's own, escaped in its strings.
  redLine: '"Red line on four!"',
  goingToBlow: '"It\'s going to blow!"',
});

// Each pulse is two bitmaps, 300 ms apiece; the loop runs a = 1..9.
export const PULSE_FRAME_MS = 300;
export const PULSES = 9;
// `if (a==5)`: the caption changes as the fifth pulse's first bitmap is drawn.
const CAPTION_CHANGE_PULSE = 5;
const CAPTION_CHANGE_MS = (CAPTION_CHANGE_PULSE - 1) * 2 * PULSE_FRAME_MS;
const PULSES_MS = PULSES * 2 * PULSE_FRAME_MS;

// The four blast bitmaps and how long each is held before the next.
export const BLAST_FRAME_MS = Object.freeze([400, 400, 400, 600]);
export const DURATION_MS = PULSES_MS + BLAST_FRAME_MS.reduce((sum, ms) => sum + ms, 0);

/**
 * What the scene shows `elapsed` milliseconds in.
 *
 * `pulse` is which of the two pulse bitmaps was drawn last, 'a' or 'b'. It
 * stays set through the blast: the source never erases it, the blast is drawn
 * over it. `blastFrames` is how many blast bitmaps have been drawn, 0-4, and
 * they accumulate for the same reason -- each is drawn over the last without
 * clearing it. `complete` is true once the last one's 600 ms have passed.
 */
export function overloadFrameAt(elapsed) {
  const time = Math.max(0, elapsed);
  const frameIndex = Math.min(Math.floor(time / PULSE_FRAME_MS), PULSES * 2 - 1);
  const pulse = frameIndex % 2 === 0 ? 'a' : 'b';
  const caption = time >= CAPTION_CHANGE_MS ? CAPTIONS.goingToBlow : CAPTIONS.redLine;

  let blastFrames = 0;
  if (time >= PULSES_MS) {
    let start = PULSES_MS;
    for (const held of BLAST_FRAME_MS) {
      if (time < start) break;
      blastFrames += 1;
      start += held;
    }
  }

  return { pulse, caption, blastFrames, complete: time >= DURATION_MS };
}

// --- The player's response, 2026-10-13 ---------------------------------------
// The port's addition, under the mini-game parity rule (AGENTS.md). "Red line on
// four!" names a unit; the scene puts a row of numbered breaker units under the
// caption. Tapping the named one opens a repair (breaker-games.js) -- throw the
// switches, repeat the keypad, replace the fuse, work the breaker -- and starts
// a countdown that runs across every repair until the overload is contained or
// the plant blows. Finishing a repair fixes that fault and names the next.
//
// Inert on the untouched path: until a unit is tapped there is no countdown, no
// repair and no draw from `random`, and the scene is the source's own timeline
// with the same damage. Every number below only matters once a unit is tapped.
//
// Designed with the user, 2026-10-13: the savings are graded (each fault fixed
// spares part of the damage the blast already rolled, the neighbours first and
// the plant last); the faults to fix and the countdown both scale with the
// class; a mistake costs time rather than ending anything.

// One repair contains it on an easy asteroid, three on a class 5, so the
// interruption stays short where the asteroid is meant to be forgiving.
export function faultsToContainFor(difficulty) {
  return difficulty <= 2 ? 1 : difficulty <= 4 ? 2 : 3;
}
// The countdown, from the first tap. A starting point to be tuned by playing it
// (the dev panel overrides it): long enough at class 1 to read a repair you
// have never seen, short enough at class 5 that three of them are a scramble.
export const COUNTDOWN_MS_BY_CLASS = Object.freeze([30_000, 26_000, 22_000, 18_000, 15_000]);
export function countdownFor(difficulty) {
  return COUNTDOWN_MS_BY_CLASS[difficulty - 1];
}
// What a mistake costs: a wrong switch, key, part, control, or unit once the
// clock is running. A fifth of the shortest countdown, so slips hurt without
// one of them ending a class 1 run.
export const MISTAKE_PENALTY_MS = 3000;
// How long the countdown shows the penalty was taken.
export const PENALTY_FLASH_MS = 600;
// Before the clock starts, a wrong unit trips the panel for one pulse instead:
// there is no time to take yet.
export const WRONG_UNIT_LOCKOUT_MS = 2 * PULSE_FRAME_MS;
// A contained overload holds on its caption before handing back, as the blast's
// last frame does for 600 ms; twice that, because it is news worth reading.
export const CONTAINED_HOLD_MS = 1200;
// The class decides how many units there are to look through: 4 on a class 1
// asteroid, one more per class, 8 on a class 5. Four is the floor because the
// source's first fault is unit four.
export function unitCountForClass(difficulty) {
  return 3 + difficulty;
}

const FIRST_FAULT = 4;
const UNIT_NAMES = Object.freeze(['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']);
const BLAST_MS = BLAST_FRAME_MS.reduce((sum, ms) => sum + ms, 0);

// Draft copy, for the user to approve: the contained caption, and each fault
// after the first named in the source's own words.
export const CONTAINED_CAPTION = '"Overload contained!"';
export function faultCaption(unit) {
  return `"Red line on ${UNIT_NAMES[unit]}!"`;
}

/**
 * `countdownMs` and `kind` are the development panel's overrides: a countdown
 * other than the class's, and one repair every time rather than a draw.
 */
export function createOverload({ difficulty, countdownMs, kind = null }) {
  return {
    elapsed: 0,
    difficulty,
    unitCount: unitCountForClass(difficulty),
    faultsToContain: faultsToContainFor(difficulty),
    countdownMs: countdownMs ?? countdownFor(difficulty),
    kind,
    fault: FIRST_FAULT,
    faultsFixed: 0,
    // Captions the player's answers raised, with when; the source's own two are
    // the timeline's.
    raised: [],
    lockedUntil: 0,
    wrongUnit: null,
    // Set by the first right tap: the clock, and the repair open now.
    countdown: null,
    game: null,
    lastKind: null,
    penalisedAt: null,
    containedAt: null,
    blownAt: null,
  };
}

function engaged(state) {
  return state.countdown !== null;
}

function over(state) {
  return state.containedAt !== null || state.blownAt !== null;
}

export function advanceOverload(state, milliseconds) {
  const step = Math.max(0, milliseconds);
  const next = { ...state, elapsed: state.elapsed + step };
  if (!engaged(state) || over(state)) return next;
  next.countdown = Math.max(0, state.countdown - step);
  if (next.game) next.game = advanceBreakerGame(next.game, step);
  if (next.countdown === 0) return blow(next);
  return next;
}

function blow(state) {
  return { ...state, game: null, blownAt: state.elapsed };
}

function penalise(state) {
  const countdown = Math.max(0, state.countdown - MISTAKE_PENALTY_MS);
  const penalised = { ...state, countdown, penalisedAt: state.elapsed };
  return countdown === 0 ? blow(penalised) : penalised;
}

/**
 * The player taps a unit on the panel. The named one opens its repair, and the
 * first time starts the clock. Ignored while a repair is open, once it is over,
 * and -- before the clock starts -- once the source's blast has begun.
 */
export function tapUnit(state, unit, { random }) {
  if (over(state) || state.game) return state;
  if (!engaged(state) && state.elapsed >= PULSES_MS) return state;
  if (state.elapsed < state.lockedUntil) return state;
  if (unit !== state.fault) {
    if (engaged(state)) return penalise({ ...state, wrongUnit: unit });
    return { ...state, lockedUntil: state.elapsed + WRONG_UNIT_LOCKOUT_MS, wrongUnit: unit };
  }
  const game = state.kind
    ? createRepairOfKind(state, random)
    : createBreakerGame({ difficulty: state.difficulty, random, previousKind: state.lastKind });
  return {
    ...state,
    countdown: engaged(state) ? state.countdown : state.countdownMs,
    wrongUnit: null,
    game,
  };
}

// The dev panel's chosen repair: the kind fixed, laid out by the real draws.
function createRepairOfKind(state, random) {
  let chosen = false;
  const choose = (max) => {
    if (chosen) return random(max);
    chosen = true;
    return GAME_KINDS.indexOf(state.kind);
  };
  return createBreakerGame({ difficulty: state.difficulty, random: choose });
}

/** The player presses something inside the open repair. */
export function tapRepair(state, target, { random }) {
  if (over(state) || !state.game) return state;
  const { state: game, result } = tapBreakerGame(state.game, target);
  if (result === 'mistake') return penalise(state);
  if (result !== 'done') return { ...state, game };
  const faultsFixed = state.faultsFixed + 1;
  const closed = { ...state, game: null, lastKind: game.kind, faultsFixed };
  if (faultsFixed >= state.faultsToContain) {
    return {
      ...closed,
      fault: null,
      containedAt: state.elapsed,
      raised: [...state.raised, { at: state.elapsed, text: CONTAINED_CAPTION }],
    };
  }
  const draw = random(state.unitCount - 1);
  const next = draw + 1 >= state.fault ? draw + 2 : draw + 1;
  return {
    ...closed,
    fault: next,
    raised: [...state.raised, { at: state.elapsed, text: faultCaption(next) }],
  };
}

/**
 * What the scene shows now. Untouched, it is exactly `overloadFrameAt` plus the
 * panel: unit four flashing with the pulse. Once the clock is running the
 * source's timeline stands still and the countdown decides when it blows.
 */
export function overloadFrame(state) {
  if (!engaged(state)) {
    const timeline = overloadFrameAt(state.elapsed);
    const locked = state.elapsed < state.lockedUntil;
    return {
      ...timeline,
      unitCount: state.unitCount,
      flashing: timeline.pulse === 'a' ? state.fault : null,
      locked,
      wrongUnit: locked ? state.wrongUnit : null,
      countdown: null,
      penalised: false,
      game: null,
    };
  }

  // The plant keeps pulsing while the clock runs, at the source's rate.
  const pulse = Math.floor(state.elapsed / PULSE_FRAME_MS) % 2 === 0 ? 'a' : 'b';
  let blastFrames = 0;
  let complete = false;
  // Once the clock runs, the source's own caption change no longer applies: the
  // caption is the open repair's instruction, or the last fault named.
  let caption = state.game
    ? breakerGameCaption(state.game)
    : (state.raised.filter(({ at }) => at <= state.elapsed).at(-1)?.text ?? CAPTIONS.redLine);
  if (state.blownAt !== null) {
    const since = state.elapsed - state.blownAt;
    let start = 0;
    for (const held of BLAST_FRAME_MS) {
      if (since < start) break;
      blastFrames += 1;
      start += held;
    }
    complete = since >= BLAST_MS;
    caption = CAPTIONS.goingToBlow;
  }
  if (state.containedAt !== null) complete = state.elapsed >= state.containedAt + CONTAINED_HOLD_MS;
  const live = !over(state) && !state.game;
  return {
    pulse: state.containedAt !== null ? 'a' : pulse,
    caption,
    blastFrames,
    complete,
    unitCount: state.unitCount,
    flashing: live && pulse === 'a' ? state.fault : null,
    locked: false,
    wrongUnit: null,
    countdown: state.countdown,
    penalised: state.penalisedAt !== null && state.elapsed - state.penalisedAt < PENALTY_FLASH_MS,
    game: state.game,
  };
}

/**
 * The damaged sites the response saved, from the blast's own list: the plant
 * first, then its neighbours in the order they were rolled. The faults short of
 * containing it share out the neighbours; the last one saves the plant too.
 * None fixed saves nothing, which is the source outcome.
 */
export function sparedSites(damagedSites, faultsFixed, faultsToContain) {
  const [plant, ...neighbours] = damagedSites;
  if (faultsFixed <= 0 || !plant) return [];
  if (faultsFixed >= faultsToContain) return [plant, ...neighbours];
  const share = Math.ceil((neighbours.length * faultsFixed) / (faultsToContain - 1));
  return neighbours.slice(0, share);
}

// Draft copy, for the user to approve: the news when the response saved
// something. Nothing saved keeps the source's own line, word for word.
export const RESPONSE_NEWS = Object.freeze({
  someSaved: 'DISASTER: The power plant has overloaded and exploded. Quick work at the breakers saved some nearby buildings.',
  neighboursSaved: 'DISASTER: The power plant has overloaded and exploded. Quick work at the breakers saved the buildings nearby.',
  contained: 'NEWS FLASH: Power plant overload contained. No buildings were lost.',
});

/**
 * The news for an overload the player answered. `sourceMessage` is the rule's
 * own; it stands whenever the response saved nothing, so an untouched overload
 * reads exactly as the source's does.
 */
export function overloadNews(sourceMessage, damagedSites, faultsFixed, faultsToContain) {
  if (faultsFixed >= faultsToContain) return RESPONSE_NEWS.contained;
  const spared = sparedSites(damagedSites, faultsFixed, faultsToContain);
  if (spared.length === 0) return sourceMessage;
  return spared.length === damagedSites.length - 1 ? RESPONSE_NEWS.neighboursSaved : RESPONSE_NEWS.someSaved;
}
