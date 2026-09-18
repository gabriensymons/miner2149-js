/**
 * Owns the colony's state.
 *
 * Stage 1 of Plan 13. `getState()` still hands back the live object, so this
 * does not yet stop a caller mutating state behind the session's back — that is
 * stage 6, where the snapshot is frozen in development. What it enforces now is
 * the half that broke twice on 2026-09-17: **replacing the state notifies**, so
 * the colony cannot be swapped out without the screen being told.
 *
 * Listeners fire in subscription order, which callers are allowed to depend on:
 * `app.js` registers a listener that keeps its own reference in sync before the
 * one that redraws from it.
 */
export function createGameSession({ initialState = {} } = {}) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  /**
   * Swaps the colony for a new one and tells every listener.
   */
  function replace(next) {
    state = next;

    // Iterate a copy: a listener that subscribes or unsubscribes while being
    // notified must not change who is notified for *this* replacement.
    for (const listener of [...listeners]) listener(state);

    return state;
  }

  /**
   * Replaces with a shallow patch applied. Nested values are shared with the
   * previous state, which is fine while the state is mutable anyway and is the
   * thing stage 6 has to revisit.
   */
  function update(change) {
    return replace({ ...state, ...change });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  return { getState, replace, update, subscribe };
}
