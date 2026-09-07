/**
 * The Konami code, as a pure state machine.
 *
 * Player-facing only. It must never import, trigger, alias, or share state with
 * anything under `scripts/dev/` -- that separation is a recorded project
 * decision, and it is why the listener that drives this lives in
 * `scripts/site-controls.js`, a module with no path to the development tooling,
 * rather than in `app.js`, which imports it inside a dev-only region.
 *
 * No DOM: the caller passes key names in and gets a new state back.
 */

const SEQUENCE = Object.freeze([
  'arrowup', 'arrowup',
  'arrowdown', 'arrowdown',
  'arrowleft', 'arrowright',
  'arrowleft', 'arrowright',
  'b', 'a',
]);

export const KONAMI_LENGTH = SEQUENCE.length;

export function createKonamiMatcher() {
  return Object.freeze({ buffer: Object.freeze([]) });
}

/**
 * Feeds one key press in.
 *
 * Matching is a trailing-window comparison rather than an index that resets to
 * zero on a mismatch. A naive index gets `up up up down down ...` wrong: the
 * third `up` fails the `down` it expected, resets, and throws away the two
 * valid `up`s the player has just entered -- so a sequence that does contain
 * the code never fires. Keeping the last ten keys and comparing the tail is
 * both simpler and correct for every prefix overlap.
 */
export function pressKey(state, key) {
  if (typeof key !== 'string' || key.length === 0) {
    return { state, triggered: false };
  }

  const buffer = [...state.buffer, key.toLowerCase()].slice(-SEQUENCE.length);
  const triggered = buffer.length === SEQUENCE.length
    && buffer.every((entry, index) => entry === SEQUENCE[index]);

  return {
    // Cleared on a match so the code has to be entered in full again; without
    // that, every subsequent key press would re-trigger off the same tail.
    state: Object.freeze({ buffer: Object.freeze(triggered ? [] : buffer) }),
    triggered,
  };
}

/**
 * Whether a key press should be ignored because the player is typing into a
 * control. The save-name flow binds its own window keydown listener, and the
 * display controls are form elements, so a bare listener would otherwise both
 * steal `b` and `a` and advance on arrow keys used for navigation.
 */
export function shouldIgnoreKeyEvent(event) {
  if (event?.isComposing || event?.ctrlKey || event?.metaKey || event?.altKey) return true;
  const target = event?.target;
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ['input', 'textarea', 'select', 'button'].includes(
    String(target.tagName ?? '').toLowerCase(),
  );
}
