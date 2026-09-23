/**
 * Which screens are mounted, and which of them accept input.
 *
 * Every screen in the game -- the start screen, the mine screen, each report,
 * each dialog -- is a child of one Pixi stage, and a screen that opens over
 * another disables the one beneath it. That pairing was two three-line functions
 * in `app.js` called from sixty places. It lives here now, with a view of the
 * stack that nothing had before.
 *
 * The stack is Pixi's own child list, not a copy of it. `addChild` on a screen
 * that is already mounted moves it to the top rather than mounting it twice,
 * and removing one that is not mounted does nothing. Those are the semantics
 * the game has always relied on, so this keeps them rather than modelling them.
 *
 * `topmost()` is what an Escape key would close. Nothing binds a key to it yet;
 * that is keyboard navigation, section L. Phase 8 makes it possible, and stops
 * there (decisions log, 2026-09-22).
 */
export function createStageManager({ stage }) {
  /**
   * Mounts `screen` on top, and stops `beneath` taking input while it is up.
   *
   * `beneath` is the screen the player returns to, not necessarily the one drawn
   * directly under this one: the options menu, for instance, disables the load
   * screen it is drawn over, which is itself mounted over the mine screen.
   */
  function show(screen, beneath) {
    if (beneath) beneath.interactiveChildren = false;
    stage.addChild(screen);
  }

  /** Unmounts `screen`, and gives input back to `beneath`. */
  function hide(screen, beneath) {
    if (beneath) beneath.interactiveChildren = true;
    stage.removeChild(screen);
  }

  function isShowing(screen) {
    return stage.children.includes(screen);
  }

  /** The screen drawn last, and so the one a player is looking at. */
  function topmost() {
    return stage.children.at(-1) ?? null;
  }

  return { show, hide, isShowing, topmost };
}
