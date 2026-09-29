/**
 * What the game-over screen says, and where it says it.
 *
 * A colony ends one of three ways -- completed, failed, or resigned -- and each
 * fills the same two lines of text differently. `describeEnding` decides which,
 * and is pure; `showEnding` puts the result on the two lines it is given.
 *
 * The day and the credits are passed in as values rather than read from the
 * colony. The resignation line reports both, and the colony used to be reset in
 * the same function that wrote that line: it worked only because the text was
 * set first. Taking them as arguments makes reading them after a reset
 * impossible rather than merely avoided.
 */

import { buildCompletionPresentation } from './completion-presentation.js';

/**
 * A completed mission lists its score, left-aligned from the top corner; the
 * other two endings centre two short lines lower down. These are the port's
 * positions, unchanged.
 */
const COMPLETION_LAYOUT = { anchor: [0, 0], position: [18, 20] };
const STATUS_LAYOUT = { anchor: [0.5, 0], position: [75, 37] };

/**
 * Returns `{ lines: [first, second], layout, followUp }`.
 *
 * `followUp` is a message to show over the game-over screen once it is up, or
 * `null`. Only a completed mission has one: what the colony's future holds.
 *
 * Precedence is completion, then failure, then resignation, which is the order
 * the caller's own branches took.
 */
export function describeEnding({ completion = null, failure = '', day, credits }) {
  if (completion) {
    const presentation = buildCompletionPresentation(completion);
    return {
      lines: [presentation.lines.join('\n'), ''],
      layout: COMPLETION_LAYOUT,
      followUp: presentation.futureMessage,
    };
  }

  if (failure) {
    return {
      lines: [`Mission Status: FAILURE on day ${day}`, `Cause: ${failure}`],
      layout: STATUS_LAYOUT,
      followUp: null,
    };
  }

  return {
    lines: [`Mission Status: RESIGNED on day ${day}`, `Credits Remaining: ${credits}`],
    layout: STATUS_LAYOUT,
    followUp: null,
  };
}

/**
 * Writes a description onto the game-over screen's two text lines.
 *
 * Only the first line moves: the second keeps the position it was built with,
 * and a completed mission leaves it empty.
 */
export function showEnding({ first, second }, { lines, layout }) {
  first.anchor.set(...layout.anchor);
  first.position.set(...layout.position);
  first.text = lines[0];
  second.text = lines[1];
}
