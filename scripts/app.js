/**
 * The composition root: the Pixi application, the session, and every view,
 * service and controller the game is built from, wired together once the
 * assets and saves have loaded.
 *
 * Nothing here decides anything about the game. The rules are pure modules, the
 * scene is game-view.js, and what the player's taps do is the controllers'. What
 * this file owns is the order things are built in -- each comment below says why
 * a piece comes where it does -- and the callbacks that connect the view's
 * controls to them.
 */

import { deepClone } from './utilities.js';
import { pocketRandom, randomNum } from './random.js';
import { getDifficulty, generateMaps } from './maps.js';
import { rollDesignation } from './asteroid-selection.js';
import { showMessage, showConfirmation, showInput } from './message.js';
import {
  setMinerSavesFromStorage,
  minerSaves, saveGame, initAutosave, loadGame
} from './saveload.js';
import { SAVE_SLOTS } from './save-controller.js';
import { createGameSession } from './game-session.js';
import { createMapView } from './map-view.js';
import { createStageManager } from './stage-manager.js';
import { createDialogService } from './dialog-service.js';
import { createGameFlow } from './game-flow.js';
import { loadGameAssets } from './game-assets.js';
import { createGameView } from './game-view.js';
import { createMineRenderer } from './mine-renderer.js';
import { createEconomyController } from './economy-controller.js';
import { createMapController } from './map-controller.js';
import { createSaveWorkflow } from './save-workflow.js';
import { createColonyStart } from './colony-start.js';
import { createEndingsController } from './endings-controller.js';
import { createDisasterController } from './disaster-controller.js';
import { createSkinGrant } from './skin-grants.js';
import { createTurnController } from './turn-controller.js';
import { createOptionsController } from './options-controller.js';
import { createDayPickerController } from './day-picker-controller.js';
import { applyRandomEvent, selectRandomEvent } from './random-events.js';
import { createMeteorStormView } from './meteor-storm-view.js';
import { SKIN_UNLOCK_EVENT } from './skin-catalogue.js';
import { resetUnlockProgress } from './unlock-progress.js';
/* dev-only:start */
import { installColonySnapshot } from './dev/colony-snapshot.js';
import { installMeteorTrigger } from './dev/meteor-trigger.js';
/* dev-only:end */
import { buildTextButton, buildHoverHitzone, buildSpriteButton } from './button.js';
import {
  gameDataInit, shopItems, buildingMap, constructionTimeMap
} from './gamedata.js';

const app = new PIXI.Application({
  antialias: false,
  autoDensity: true,
  height: 160,
  width: 160,
  backgroundColor: 0x1099bb,
  resolution: 3.0,
});
// Scale mode for pixelation
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
document.querySelector('#game-canvas').appendChild(app.view);

// Created at module load, not in init(), because init() mounts screens itself.
const screens = createStageManager({ stage: app.stage });

// The session owns the colony. Every controller reads and writes it through
// getState() and update()/replace(); nothing keeps its own reference to it.
const session = createGameSession({ initialState: {} });

/* dev-only:start */
// The parts of the built game the development trigger at the bottom of this
// file needs. It is installed at module load, before init() has built anything,
// so it reaches them through this at call time. Nothing else reads it, and the
// production build has neither this nor the assignment in init().
let game = null;
/* dev-only:end */

// The atlas, then the fonts, then the saves; only then is there a game to build.
loadGameAssets({
  PIXI,
  fontLoader: app.loader,
  onLoaded: (atlas) => setMinerSavesFromStorage().then(() => init(atlas)),
});

function init(atlas) {
  // The view's labels start from the colony, so it is reset before the view is
  // built -- which is also why no controller can own this first reset.
  resetGameData();

  // Every screen, panel and dialog; see game-view.js, which owns the order they
  // are built in. The callbacks are grouped by the screen that shows them. The
  // services and controllers they call are built below, after the view they take
  // their handles from, so each callback reaches them when it runs -- never
  // during construction.
  const view = createGameView({
    PIXI,
    sheet: atlas,
    stage: app.stage,
    buttons: { buildTextButton, buildSpriteButton, buildHoverHitzone },
    initial: session.getState(),
    slotNames: Object.fromEntries(SAVE_SLOTS.map((slot) => [slot, minerSaves[slot].name])),
    on: {
      start: {
        newMine: () => colonyStart.newMine(),
        loadMine: () => flow.openLoadFromStart(),
        openInstructions: () => screens.show(view.start.instructionsScreen, view.start.startScreen),
        closeInstructions: () => screens.hide(view.start.instructionsScreen, view.start.startScreen),
        closeInstructionsToMine: () => flow.closeInstructionsToMine(),
        launch: () => colonyStart.launchProbes(),
        armMoreProbes: () => colonyStart.armMoreProbes(),
        moreProbes: () => colonyStart.moreProbes(),
        armFewerProbes: () => colonyStart.armFewerProbes(),
        fewerProbes: () => colonyStart.fewerProbes(),
      },
      reports: { closeOperations: () => flow.closeOperations(), closeProduction: () => flow.closeProduction() },
      options: {
        toggleDisasterMode: () => options.toggleDisasterMode(),
        toggleGridlines: () => options.toggleGridlines(),
        openSaveMine: () => options.openSaveMine(),
        openLoadMine: () => options.openLoadMine(),
        exitAndSave: () => saveWorkflow.exitAndSave(),
        // Pixi hands the row's callback the pointer event, which endGame used to
        // take as hasConfirmation; it was always truthy, as the default is.
        resign: () => endings.endGame(),
        close: () => flow.closeOptions(),
      },
      saveLoad: {
        load: (slot) => saveWorkflow.loadFromSlot(slot),
        save: (slot) => saveWorkflow.saveToSlot(slot),
        cancelLoad: {
          start: () => flow.cancelLoadToStart(),
          mine: () => flow.cancelLoadToOptions(),
          gameOver: () => flow.cancelLoadToGameOver(),
        },
        cancelSave: () => screens.hide(view.saveLoad.save.screen, view.options.menu),
      },
      dayPicker: { chooseDay: (day) => dayPicker.pickDay(day), cancel: () => dayPicker.close() },
      sell: {
        pressUp: () => economy.startRaisingSale(),
        pressDown: () => economy.startLoweringSale(),
        release: () => economy.stopSaleRepeat(),
        sell: () => economy.sellDiridium(),
        cancel: () => economy.cancelSale(),
      },
      gameOver: {
        newMine: () => colonyStart.gameOverNewMine(),
        loadMine: () => flow.openLoadFromGameOver(),
        quit: () => colonyStart.quit(),
      },
      chrome: {
        showInstructions: () => flow.openInstructionsFromMine(),
        showLevel: (level) => map.showLevel(level),
        showOperations: () => flow.openOperations(),
        showProduction: () => flow.openProduction(),
        showOptions: () => flow.openOptions(),
        showDayPicker: () => dayPicker.open(),
        advance: (days) => turn.advance(days),
        armWageUp: () => economy.armWageUp(),
        wageUp: () => economy.wageUp(),
        armWageDown: () => economy.armWageDown(),
        wageDown: () => economy.wageDown(),
      },
      shop: { shop: (id) => economy.shop(id), undo: () => map.undo() },
    },
  });

  const dialogs = createDialogService({
    showMessage,
    showConfirmation,
    showInput,
    // The sixteen positional arguments message.js draws a dialog from. Passed
    // once, here, rather than spread into every call; the view keeps the order.
    parts: [app, ...view.message.dialogParts],
    screen: view.mine.screen,
  });

  // One frame grant, handed to every controller that awards a frame.
  // site-controls.js listens for the event; the two entry points do not import
  // each other, so the event is the whole contract between them.
  const grantSkinForTrigger = createSkinGrant({
    session,
    storage: localStorage,
    enqueue: (text) => dialogs.enqueue(text),
    announce: (id) => document.dispatchEvent(new CustomEvent(SKIN_UNLOCK_EVENT, { detail: { id } })),
  });

  const mapView = createMapView({
    PIXI,
    surface: view.mine.map.surface,
    textures: view.mine.map.textures,
    // An accessor, not a value: the gridlines toggle redraws the live map and
    // the view is never rebuilt, so the flag has to be read at draw time.
    gridlinesEnabled: () => session.getState().gridlinesEnabled,
  });

  const map = createMapController({
    session,
    view,
    mapView,
    buildingNames: buildingMap,
    constructionTimes: constructionTimeMap,
    dialogs,
    // The renderer is built after this, because it takes this controller's
    // building counter; the level buttons are reached through it at call time.
    updateLevelButtons: (level) => renderer.updateLevelButtons(level),
    grantSkinForTrigger,
  });

  const economy = createEconomyController({
    session,
    view,
    shopItems,
    dialogs,
    screens,
    countBuildingsByName: map.countBuildingsByName,
    grantSkinForTrigger,
    storage: localStorage,
    // Wrapped, not passed: the browser's timers throw when called as a method
    // of any object but the window.
    timers: { setInterval: (run, ms) => setInterval(run, ms), clearInterval: (id) => clearInterval(id) },
  });

  const renderer = createMineRenderer({
    session,
    view,
    shopItems,
    buildingNames: buildingMap,
    buildSpriteButton,
    countBuildingsByName: map.countBuildingsByName,
    requestSale: economy.requestSale,
  });
  renderer.updateDiridiumStorageIcon();

  const flow = createGameFlow({
    screens,
    parts: {
      startScreen: view.start.startScreen,
      mineScreen: view.mine.screen,
      launchScreen: view.start.launchScreen,
      gameOver: view.gameOver.screen,
      loadMineScreen: view.saveLoad.load.screen,
      instructionsScreen: view.start.instructionsScreen,
      optionsMenu: view.options.menu,
      optionsMenuExtension: view.options.extension,
      operationsReport: view.reports.operations.report,
      operationsReportExtension: view.reports.operations.extension,
      productionReport: view.reports.production.report,
      productionReportExtension: view.reports.production.extension,
    },
    // The same button drawn in the same spot once per screen that can open this
    // one, with only the right one live. game-flow.js keeps them in step.
    cancels: {
      load: view.saveLoad.load.cancels,
      instructions: view.start.instructionsOk,
    },
  });

  const saveWorkflow = createSaveWorkflow({
    session,
    view,
    dialogs,
    screens,
    ticker: app.ticker,
    randomNum,
    saves: { minerSaves, saveGame, loadGame, initAutosave },
    template: gameDataInit,
    flow,
    // Colony start is built after this, because it clears the autosave through it.
    openLoadedColony: () => colonyStart.gotoMineScreen(true),
  });

  const endings = createEndingsController({
    session,
    view,
    dialogs,
    flow,
    renderer,
    saveWorkflow,
    grantSkinForTrigger,
    storage: localStorage,
    pocketRandom,
  });

  const disasters = createDisasterController({
    session,
    view,
    dialogs,
    map,
    renderer,
    grantSkinForTrigger,
    PIXI,
    app,
    textures: atlas.textures,
    createStormView: createMeteorStormView,
    pocketRandom,
  });

  const turn = createTurnController({
    session,
    view,
    dialogs,
    map,
    renderer,
    saveWorkflow,
    disasters,
    endings,
    grantSkinForTrigger,
    buildingNames: buildingMap,
    selectEvent: selectRandomEvent,
    applyEvent: applyRandomEvent,
    pocketRandom,
  });

  const colonyStart = createColonyStart({
    session,
    view,
    dialogs,
    screens,
    flow,
    mapView,
    map,
    renderer,
    saveWorkflow,
    minerSaves,
    buildHoverHitzone,
    resetColony: resetGameData,
    rollDifficulty: getDifficulty,
    rollDesignation,
    generateMaps,
  });

  const options = createOptionsController({ session, view, dialogs, screens, mapView, flow, saveWorkflow });
  const dayPicker = createDayPickerController({ view, screens, advance: (days) => turn.advance(days) });

  /* dev-only:start */
  game = { dialogs, map, disasters, colonyStart, mineScreen: view.mine.screen };
  /* dev-only:end */

  // Only now that every sprite exists is it safe to redraw from state. init()
  // resets the colony at its very top, before any of it exists, which is why
  // the renderer is subscribed last.
  session.subscribe(renderer.render);
}

function resetGameData() {
  session.replace(deepClone(gameDataInit));
}

/* dev-only:start */
// Stripped from `dist/` by tools/build-static.js; see scripts/dev/meteor-trigger.js.
installMeteorTrigger({
  getGameData: () => session.getState(),
  markSandbox: (patch) => { session.update(patch); },
  // `mineScreen.visible` is true before a game exists, so it cannot gate this.
  // `asteroid` is empty until one is picked, which is the same signal
  // isNormalSession() keys on.
  isPlayable: () => Boolean(session.getState().asteroid),
  startMeteorStorm: (command, onComplete) => game.disasters.startMeteorStorm(command, onComplete),
  // A real storm runs inside a turn, and the turn flushes the message queue for
  // it: the turn -> disasters.disaster(done) -> the storm -> done() ->
  // endings.checkEnding(); dialogs.drain(). A dev-triggered storm has no turn
  // around it, so it has to flush its own news flashes -- otherwise they sit in
  // the queue until the player's next advance and appear a day late.
  // endings.checkEnding() is deliberately not mirrored: dev storms are unranked
  // sandbox runs and must never decide a game.
  applyMeteorStormResult: (result, done) => game.disasters.applyMeteorStormResult(result, () => {
    done();
    game.dialogs.drain();
  }),
  resetUnlocks: () => {
    resetUnlockProgress(localStorage);
    document.dispatchEvent(new CustomEvent(SKIN_UNLOCK_EVENT, { detail: { id: null } }));
  },
  getBuildingCounts: () => ({
    bulldozer: game.map.countBuildingsByName('Bulldozer'),
    diridiumMine: game.map.countBuildingsByName('Diridium Mine'),
    hydroponics: game.map.countBuildingsByName('Hydroponics'),
    lifeSupport: game.map.countBuildingsByName('Life Support'),
    spacePort: game.map.countBuildingsByName('Space Port'),
    powerPlant: game.map.countBuildingsByName('Power Plant'),
    processor: game.map.countBuildingsByName('Processor'),
    sickbay: game.map.countBuildingsByName('Sickbay'),
    storage: game.map.countBuildingsByName('Storage'),
  }),
});

// Restores through the load's own seam: replace the colony, then enter the mine
// as a loaded colony. Idle means a mine is showing and taking input -- every
// dialog, menu, reveal and storm turns its input off while it is up.
installColonySnapshot({
  getColony: () => session.getState(),
  restoreColony: (colony) => {
    session.replace(colony);
    game.colonyStart.gotoMineScreen(true);
  },
  isIdle: () => Boolean(game && session.getState().asteroid
    && game.mineScreen.parent && game.mineScreen.interactiveChildren !== false),
});
/* dev-only:end */
