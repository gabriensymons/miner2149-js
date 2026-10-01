/**
 * Starting a colony: New Mine, the launch screen's probes, the asteroid survey
 * and the pick, and entering the mine screen -- for a new colony and a loaded
 * one alike. Also game over's two ways out, New Mine and Quit.
 *
 * The rules are elsewhere: `economy-rules.js` for the probe count and what the
 * launch costs, `asteroid-selection.js` for the survey and the pick. Everything
 * random arrives injected (`rollDifficulty`, `rollDesignation`, `generateMaps`),
 * because the order of the draws is part of the game: the survey's two draws per
 * probe are interleaved and share the generator.
 *
 * Resetting the colony is injected too. `init()` resets it before anything else
 * exists, including this, so the reset belongs to the composition root.
 *
 * The screen flow, the dialogs, the map view, the map controller, the renderer
 * and the save workflow's autosave belong to other parts and are injected.
 */

import { selectAsteroid, surveyAsteroids } from './asteroid-selection.js';
import { addProbe, probeLaunchCost, removeProbe } from './economy-rules.js';
import { deepClone } from './utilities.js';

export function createColonyStart({
  session, view, dialogs, screens, flow, mapView, map, renderer, saveWorkflow, minerSaves,
  buildHoverHitzone, resetColony, rollDifficulty, rollDesignation, generateMaps,
}) {
  const { startScreen, startCover, launchScreen, selectAsteroidTitle, addAsteroidChoice } = view.start;
  const mineScreen = view.mine.screen;
  const { surface: asteroidSurface, tileHover } = view.mine.map;

  // The map's hit zones are built the first time a colony is entered, and kept.
  let drawZonesOnce = false;

  function newMine() {
    // Check for Auto save
    if (!minerSaves.autoSave.empty) {
      dialogs.confirm(startScreen, 'Starting a new mining colony will overwrite an active mining colony. Do you wish to proceed?', continueNewMine, () => { return; });
    } else {
      continueNewMine();
    }

    function continueNewMine() {
      // Resetting the state renders it: the reset replaces through the session,
      // and the renderer is one of its listeners.
      resetColony();
      saveWorkflow.resetAutosave();
      flow.openLaunch();
    }
  }

  // The launch screen's probe arrows. Each arms -- shows as pressed -- only when
  // releasing it would change the count, and acts on release.
  function armMoreProbes() {
    if (addProbe(session.getState().probes) !== null) return true;
  }

  function moreProbes() {
    const probes = addProbe(session.getState().probes);
    if (probes !== null) session.update({ probes });
  }

  function armFewerProbes() {
    if (removeProbe(session.getState().probes) !== null) return true;
  }

  function fewerProbes() {
    const probes = removeProbe(session.getState().probes);
    if (probes !== null) session.update({ probes });
  }

  function launchProbes() {
    asteroidSurface.removeChildren();
    screens.hide(launchScreen, startScreen);
    screens.show(startCover, startScreen);
    screens.show(selectAsteroidTitle);
    const { credits, probes } = session.getState();
    session.update({ credits: credits - probeLaunchCost(probes) });

    // Every draw happens here, before any button is built. The survey's two draws
    // per probe are interleaved in one loop and share the generator, so the order
    // is fixed in `surveyAsteroids`; building the buttons afterwards is safe only
    // because Pixi construction consumes no randomness.
    const asteroids = surveyAsteroids(session.getState().probes, { rollDifficulty, rollDesignation });

    asteroids.forEach(({ label, designation }, index) => {
      addAsteroidChoice({ index, designation, label, onPick: () => pickAsteroid(index) });
    });

    function pickAsteroid(i) {
      selectAsteroidTitle.removeChildren();
      screens.hide(selectAsteroidTitle);
      screens.hide(startCover);
      session.update(selectAsteroid(asteroids, i));

      // Don't autosave until player advances days
      gotoMineScreen();
    }
  }

  function gotoMineScreen(isLoadedGame = false) {
    flow.enterMine();

    // A new colony always opens on level 1. A loaded one opens on the level it was
    // saved on, which is what the original's Load() restores -- it reads `level`
    // back from the record and the main loop redraws there. The reveal writes the
    // same value back when the animation lands, so the buttons, the drawn surface
    // and the saved level cannot disagree.
    const openingLevel = isLoadedGame ? session.getState().level : 'level1';

    // Only generate map if it's not loading a game
    let newMaps;
    if (!isLoadedGame) {
      newMaps = generateMaps(session.getState().difficulty);
      session.update({ maps: newMaps });
    } else {
      newMaps = deepClone(session.getState().maps);
    }

    if (!drawZonesOnce) {
      mapView.buildHitZones({
        parent: mineScreen,
        hoverSprite: tileHover,
        buildHoverHitzone,
        onTapSite: map.tapSurface,
      });
      drawZonesOnce = true;
    }

    // Render from state first, then run the transition over it. On the load path
    // this is the only render: the progress window runs its close functions (which
    // call this) before its callback, so there is no second pass to rely on.
    renderer.render();
    map.updateMineSurface('Mapping...', openingLevel, newMaps, true);
  }

  function gameOverNewMine() {
    flow.leaveGameOver();
    newMine();
  }

  // No reset: the start screen leads only to New Mine, which resets, or to Load
  // Mine, which replaces the colony outright.
  function quit() {
    flow.leaveGameOverForStart();
  }

  return {
    newMine, armMoreProbes, moreProbes, armFewerProbes, fewerProbes, launchProbes, gotoMineScreen, gameOverNewMine, quit,
  };
}
