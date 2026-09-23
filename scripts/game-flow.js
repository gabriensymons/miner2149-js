/**
 * Named screen transitions: what opens over what, and where each one goes back
 * to.
 *
 * Every transition here used to be a function in `app.js` that called `show` and
 * `remove` in a hand-written order, with each close mirroring its open by eye.
 * They are the same calls in the same order, named once and tested as pairs, so
 * a close that stops undoing its open fails a test instead of stranding a
 * screen on the stage.
 *
 * ## The load screen is a backdrop
 *
 * Both reports and the options menu open over the load screen, not over the
 * mine screen directly: the load screen is mounted first, as a backdrop, and
 * the panel on top of it. That is why "Load Mine" in the options menu works by
 * taking the menu away -- the load screen was underneath all along.
 *
 * ## The load screen goes back to whoever opened it
 *
 * It opens from three places -- the start screen, the options menu, and game
 * over -- and draws three Cancel buttons in the same spot, one live at a time.
 * `loadOpenedFrom` is which one, and the buttons' `interactive` flags are
 * derived from it rather than written in six places.
 *
 * Owns no game state. Decides nothing about the colony: resets and saves stay
 * with the caller, which runs them around these transitions.
 */

const LOAD_ORIGINS = ['start', 'mine', 'gameOver'];

export function createGameFlow({ screens, parts, cancels }) {
  const {
    startScreen, mineScreen, launchScreen, gameOver,
    loadMineScreen, instructionsScreen,
    optionsMenu, optionsMenuExtension,
    operationsReport, operationsReportExtension,
    productionReport, productionReportExtension,
  } = parts;

  const show = (screen, beneath) => screens.show(screen, beneath);
  const hide = (screen, beneath) => screens.hide(screen, beneath);

  let loadOpenedFrom = 'start';

  /** Exactly one Cancel is live: the one that returns where the screen opened from. */
  function setLoadOrigin(origin) {
    loadOpenedFrom = origin;
    for (const key of LOAD_ORIGINS) cancels.load[key].interactive = key === origin;
  }

  // --- panels over the mine screen, on the load screen as a backdrop -------

  function openPanel(panel, extension) {
    show(loadMineScreen, mineScreen);
    show(panel, loadMineScreen);
    show(extension);
  }

  function closePanel(panel, extension) {
    hide(panel, loadMineScreen);
    hide(loadMineScreen, mineScreen);
    hide(extension);
  }

  const openOperations = () => openPanel(operationsReport, operationsReportExtension);
  const closeOperations = () => closePanel(operationsReport, operationsReportExtension);
  const openProduction = () => openPanel(productionReport, productionReportExtension);
  const closeProduction = () => closePanel(productionReport, productionReportExtension);
  const openOptions = () => openPanel(optionsMenu, optionsMenuExtension);
  const closeOptions = () => closePanel(optionsMenu, optionsMenuExtension);

  // --- the load screen ------------------------------------------------------

  function openLoadFromStart() {
    setLoadOrigin('start');
    show(loadMineScreen, startScreen);
  }

  function cancelLoadToStart() {
    hide(loadMineScreen, startScreen);
  }

  /**
   * From the options menu the load screen is already mounted, as the menu's
   * backdrop, so opening it is taking the menu away. The menu's extension stays
   * up beside it, as it always has.
   */
  function openLoadFromOptions() {
    hide(optionsMenu, loadMineScreen);
    setLoadOrigin('mine');
  }

  function cancelLoadToOptions() {
    setLoadOrigin('start');
    show(optionsMenu, loadMineScreen);
  }

  function openLoadFromGameOver() {
    setLoadOrigin('gameOver');
    show(loadMineScreen, gameOver);
  }

  function cancelLoadToGameOver() {
    setLoadOrigin('start');
    hide(loadMineScreen, gameOver);
  }

  /**
   * Leaves the load screen after a save has been loaded, whichever screen it
   * was opened from. The caller enters the mine next.
   *
   * This replaces running every closer the load screen might need -- the
   * options one and the game-over one -- in sequence, whichever had opened it.
   * The state below is exactly what that sequence left, which matters beyond
   * the stage: it also set `interactiveChildren` on screens it had just
   * unmounted, and those flags persist. Leave game over non-interactive here
   * and its buttons are dead the next time a colony is resigned.
   *
   * It differs in one place, deliberately. None of those closers unmounted
   * game over, because game over's own is its Cancel, and Cancel goes back to
   * game over. So a colony loaded from game over left the game-over screen on
   * the stage beneath the mine screen, with its buttons live, and any gap in
   * the mine screen's own hit zones reached them: tapping the empty space
   * under "Diridium:" opened the Load Mine dialog. It is unmounted now.
   */
  function leaveLoadScreen() {
    const cameFromGameOver = loadOpenedFrom === 'gameOver';

    setLoadOrigin('start');
    hide(optionsMenu);
    hide(optionsMenuExtension);
    hide(loadMineScreen);

    // What the old sequence left on each, and why each is kept.
    loadMineScreen.interactiveChildren = true; // its slots answer next time it opens
    mineScreen.interactiveChildren = true;     // the mine screen is about to take input
    gameOver.interactiveChildren = true;       // game over's buttons work next time

    if (cameFromGameOver) hide(gameOver);
  }

  // --- instructions, opened over the mine screen ---------------------------

  /** The instructions screen has two OK buttons in one spot, like the load screen's Cancels. */
  function openInstructionsFromMine() {
    cancels.instructions.start.visible = false;
    cancels.instructions.mine.visible = true;
    show(instructionsScreen, mineScreen);
  }

  function closeInstructionsToMine() {
    cancels.instructions.start.visible = true;
    cancels.instructions.mine.visible = false;
    hide(instructionsScreen, mineScreen);
  }

  // --- moving between the start screen, the launch screen and the mine -----

  function openLaunch() {
    show(launchScreen, startScreen);
  }

  function enterMine() {
    hide(startScreen);
    show(mineScreen);
    mineScreen.interactiveChildren = true;
  }

  function leaveMineForStart() {
    hide(mineScreen, startScreen);
  }

  function showStart() {
    show(startScreen);
  }

  return {
    openOperations, closeOperations,
    openProduction, closeProduction,
    openOptions, closeOptions,
    openLoadFromStart, cancelLoadToStart,
    openLoadFromOptions, cancelLoadToOptions,
    openLoadFromGameOver, cancelLoadToGameOver,
    leaveLoadScreen,
    openInstructionsFromMine, closeInstructionsToMine,
    openLaunch, enterMine, leaveMineForStart, showStart,
    loadOrigin: () => loadOpenedFrom,
  };
}
