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
// caption and lets the player answer it. Fixing the named unit raises the next
// fault, named the same way, until three are fixed and the overload is
// contained. A wrong unit trips the panel for one pulse.
//
// Inert on the untouched path: a player who taps nothing fixes nothing, draws
// no randomness, and sees the source's own timeline -- the same captions, the
// same pulses, the same blast -- with the same damage. Every number below only
// matters once a unit has been tapped.
//
// The savings are graded (user, 2026-10-13): each fault fixed spares part of the
// damage the blast already rolled, the neighbours first and the plant last, so a
// partial answer still helps and only a clean one saves everything.

// Three answers to contain it: the first is the source's own "four", and two
// more make the response a sequence rather than a single tap on a number the
// caption has just read out.
export const FAULTS_TO_CONTAIN = 3;
// A wrong unit trips the panel for one pulse (two 300 ms bitmaps). Long enough
// that guessing costs a third of a fault's time, short enough that one slip is
// not the end of the response.
export const WRONG_UNIT_LOCKOUT_MS = 2 * PULSE_FRAME_MS;
// A contained overload holds on its caption before handing back, as the blast's
// last frame does for 600 ms; twice that, because it is news worth reading.
export const CONTAINED_HOLD_MS = 1200;
// The class decides how many units there are to look through: 4 on a class 1
// asteroid, one more per class, 8 on a class 5. Four is the floor because the
// source's first fault is unit four. On the gradient the mini-game rule allows:
// the panel only matters to a player who taps it.
export function unitCountForClass(difficulty) {
  return 3 + difficulty;
}

const FIRST_FAULT = 4;
const UNIT_NAMES = Object.freeze(['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']);

// Draft copy, for the user to approve: the contained caption, and each fault
// after the first named in the source's own words.
export const CONTAINED_CAPTION = '"Overload contained!"';
export function faultCaption(unit) {
  return `"Red line on ${UNIT_NAMES[unit]}!"`;
}

export function createOverload({ difficulty }) {
  return {
    elapsed: 0,
    unitCount: unitCountForClass(difficulty),
    fault: FIRST_FAULT,
    faultsFixed: 0,
    // Captions the player's answers raised, with when; the source's own two are
    // the timeline's.
    raised: [],
    lockedUntil: 0,
    wrongUnit: null,
    containedAt: null,
  };
}

export function advanceOverload(state, milliseconds) {
  return { ...state, elapsed: state.elapsed + Math.max(0, milliseconds) };
}

/**
 * The player taps a unit. Ignored while the panel is tripped, once the blast
 * has started, and once the overload is contained. The next fault is drawn from
 * `random` -- PocketC-exclusive, like every draw in the port -- and is never
 * the unit just fixed.
 */
export function tapUnit(state, unit, { random }) {
  if (state.containedAt !== null || state.elapsed >= PULSES_MS) return state;
  if (state.elapsed < state.lockedUntil) return state;
  if (unit !== state.fault) {
    return { ...state, lockedUntil: state.elapsed + WRONG_UNIT_LOCKOUT_MS, wrongUnit: unit };
  }
  const faultsFixed = state.faultsFixed + 1;
  if (faultsFixed >= FAULTS_TO_CONTAIN) {
    return {
      ...state,
      faultsFixed,
      fault: null,
      wrongUnit: null,
      containedAt: state.elapsed,
      raised: [...state.raised, { at: state.elapsed, text: CONTAINED_CAPTION }],
    };
  }
  const draw = random(state.unitCount - 1);
  const next = draw + 1 >= unit ? draw + 2 : draw + 1;
  return {
    ...state,
    faultsFixed,
    fault: next,
    wrongUnit: null,
    raised: [...state.raised, { at: state.elapsed, text: faultCaption(next) }],
  };
}

/**
 * What the scene shows now: the timeline's frame, with the player's answers
 * laid over it. Untouched, it is exactly `overloadFrameAt(state.elapsed)` plus
 * the panel: unit four flashing with the pulse.
 */
export function overloadFrame(state) {
  const contained = state.containedAt !== null;
  // Time stops for the timeline once the overload is contained: nothing the
  // source would have shown after that moment is shown.
  const now = contained ? state.containedAt : state.elapsed;
  const timeline = overloadFrameAt(now);
  const sourceCaptions = [
    { at: 0, text: CAPTIONS.redLine },
    { at: CAPTION_CHANGE_MS, text: CAPTIONS.goingToBlow },
  ];
  // The latest caption raised wins, whoever raised it; on a tie the player's,
  // which the stable sort keeps after the source's.
  const caption = [...sourceCaptions, ...state.raised]
    .filter(({ at }) => at <= now)
    .sort((left, right) => left.at - right.at)
    .at(-1).text;
  const locked = state.elapsed < state.lockedUntil;
  return {
    // A contained plant stops pulsing, on its first bitmap. It never blows: the
    // timeline is read at the moment it was contained, and only a tap before
    // the blast can contain it.
    pulse: contained ? 'a' : timeline.pulse,
    caption,
    blastFrames: timeline.blastFrames,
    complete: contained
      ? state.elapsed >= state.containedAt + CONTAINED_HOLD_MS
      : timeline.complete,
    unitCount: state.unitCount,
    // The failing unit flashes with the plant, lit on the first pulse bitmap.
    // The last bitmap before the blast is the second, so it is dark from there,
    // and a contained overload has no fault left to light.
    flashing: timeline.pulse === 'a' ? state.fault : null,
    locked,
    wrongUnit: locked ? state.wrongUnit : null,
  };
}

/**
 * The damaged sites the response saved, from the blast's own list: the plant
 * first, then its neighbours in the order they were rolled. One fault fixed
 * saves half the neighbours, rounded up; two save them all; three save the
 * plant as well. None saves nothing, which is the source outcome.
 */
export function sparedSites(damagedSites, faultsFixed) {
  const [plant, ...neighbours] = damagedSites;
  if (faultsFixed <= 0 || !plant) return [];
  const neighboursSaved = faultsFixed >= 2 ? neighbours.length : Math.ceil(neighbours.length / 2);
  const saved = neighbours.slice(0, neighboursSaved);
  return faultsFixed >= FAULTS_TO_CONTAIN ? [plant, ...saved] : saved;
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
export function overloadNews(sourceMessage, damagedSites, faultsFixed) {
  const spared = sparedSites(damagedSites, faultsFixed);
  if (faultsFixed >= FAULTS_TO_CONTAIN) return RESPONSE_NEWS.contained;
  if (spared.length === 0) return sourceMessage;
  return spared.length === damagedSites.length - 1 ? RESPONSE_NEWS.neighboursSaved : RESPONSE_NEWS.someSaved;
}
