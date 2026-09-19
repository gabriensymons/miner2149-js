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
// Production hands the state back as it is. Development hands back a frozen
// snapshot, so a write that bypasses the session fails loudly at the point it
// happens instead of silently diverging the screen from the state.
//
// The override lives in a dev-only region, which `tools/build-static.js` strips,
// so the shipped game pays nothing for it and behaves exactly as before. That is
// also the limit of the guarantee: Playwright serves `dist/`, so the browser
// suite runs unfrozen. What catches a straggler is the Node tests, the
// source-text assertions, and playing the game under `npm run dev`.
//
// `Object.freeze` is shallow, which is the other honest limit: it catches
// `state.credits = x` and not `state.maps.level1.row0[0] = x`. Immutable nested
// structures are out of scope for Plan 13; `map-grid.js` plus a source-text
// assertion cover the grids instead.
let prepareSnapshot = (state) => state;
/* dev-only:start */
prepareSnapshot = (state) => Object.freeze(state);
/* dev-only:end */

export function createGameSession({ initialState = {} } = {}) {
  let state = prepareSnapshot(initialState);
  const listeners = new Set();

  function getState() {
    return state;
  }

  /**
   * Swaps the colony for a new one and tells every listener.
   */
  function replace(next) {
    state = prepareSnapshot(next);

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
