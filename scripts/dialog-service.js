/**
 * Every message, confirmation and text prompt the game shows, and the queue
 * that keeps them in order.
 *
 * `message.js` draws a dialog from sixteen positional arguments -- the stage,
 * both halves of the frame, both icons, the title, the body, the input field,
 * three button textures, the underline, the cursor and both button labels --
 * and `app.js` used to spread all sixteen into every call. They are passed here
 * once, so a caller says what to show rather than how to build it.
 *
 * The queue used to live in `app.js` as well, which is why it could only be
 * tested by matching its source text. Its ordering is load-bearing -- the
 * turn's news flashes, its disaster and its ending must reach the player in
 * source order -- so it is tested here as behaviour instead.
 */

const noop = () => {};

export function createDialogService({ showMessage, showConfirmation, showInput, parts, screen }) {
  const queue = [];
  let afterDrain = null;

  /** An information dialog with a single OK. */
  function message(parent, text, onOk = noop) {
    showMessage(...parts, parent, text, onOk);
  }

  /** A Yes / No dialog. */
  function confirm(parent, text, onYes = noop, onNo = noop) {
    showConfirmation(...parts, parent, text, onYes, onNo);
  }

  /** A text prompt with OK / Cancel, opening on `initial`. */
  function input(parent, initial, onOk = noop, onCancel = noop) {
    showInput(...parts, parent, initial, onOk, onCancel);
  }

  /** A message over the mine screen, where almost every one of them appears. */
  function notice(text) {
    message(screen, text);
  }

  /**
   * Adds a message, or a confirmation, to the queue.
   *
   * Positional to match the `queueMessage` it replaces, so its ten call sites did
   * not have to change shape along with their home.
   */
  function enqueue(text, onDone = noop, isConfirmation = false, onYes = noop, onNo = noop) {
    queue.push({ text, onDone, isConfirmation, onYes, onNo });
  }

  /**
   * Adds a task: something that is not a dialog but must still wait its turn,
   * such as the meteor storm. It is handed the drain and decides when to call
   * it, so the queue resumes only once the task says it is finished.
   */
  function enqueueTask(run) {
    queue.push({ type: 'task', run });
  }

  /**
   * Shows the next queued entry, and the one after it once that is dismissed,
   * until none are left. Then runs whatever `whenDrained` registered, once.
   *
   * Each entry's own callback runs before the next entry appears, so a callback
   * that queues more lands them behind anything already waiting rather than in
   * front of it.
   */
  function drain() {
    if (queue.length) {
      const entry = queue.shift();

      if (entry.type === 'task') {
        entry.run(drain);
        return;
      }

      // Destructured rather than called as `entry.onDone()`, which would bind
      // `this` to the entry. The original invoked them with `.apply()` and no
      // receiver, so `this` was undefined, and that is kept.
      const { onDone, onYes, onNo } = entry;

      if (entry.isConfirmation) {
        confirm(screen, entry.text, () => { onYes(); drain(); }, () => { onNo(); drain(); });
      } else {
        message(screen, entry.text, () => { onDone(); drain(); });
      }
      return;
    }

    if (afterDrain) {
      const run = afterDrain;
      afterDrain = null;
      run();
    }
  }

  /**
   * Runs `run` the next time the queue empties, and only then.
   *
   * This is how a turn's ending waits for its own news. Registering again before
   * the queue empties replaces the earlier registration rather than adding to it,
   * as the flag-and-function pair this replaces did.
   */
  function whenDrained(run) {
    afterDrain = run;
  }

  /**
   * Throws away everything still waiting.
   *
   * For an ending that overrides the turn's own news: when the death rate
   * reaches 100% the colony is over, and the flashes queued ahead of that are
   * dropped rather than shown after it. Only the queue is cleared -- a
   * `whenDrained` registration survives, as the flag it replaces did, because
   * `queuedMessages = []` was all the original reset.
   */
  function discard() {
    queue.length = 0;
  }

  /** How many entries are waiting. For tests and diagnostics; the game never asks. */
  function pending() {
    return queue.length;
  }

  return { message, confirm, input, notice, enqueue, enqueueTask, drain, whenDrained, discard, pending };
}
