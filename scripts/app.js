import { deepClone } from './utilities.js';
import { pocketRandom, random, randomNum } from './random.js';
import { bold, regular } from './font-styles.js';
import { getDifficulty, fillMap, generateMaps } from './maps.js';
import { showMessage, showConfirmation, showInput } from './message.js';
import {
  setMinerSavesFromStorage,
  minerSaves, saveGame, initAutosave, loadGame
} from './saveload.js';
import { SAVE_SLOTS, prepareLoad } from './save-controller.js';
import { createGameSession } from './game-session.js';
import { setSite } from './map-grid.js';
import { resolvePlacement, resolveSiteTap } from './construction-rules.js';
import { createMapView } from './map-view.js';
import { createStageManager } from './stage-manager.js';
import { createDialogService } from './dialog-service.js';
import { createGameFlow } from './game-flow.js';
import { loadGameAssets } from './game-assets.js';
import { createGameView } from './game-view.js';
import { createMineRenderer } from './mine-renderer.js';
import { calculateShopPrice } from './shop.js';
import {
  addProbe,
  canLowerWage,
  canRaiseWage,
  decreaseSellAmount,
  increaseSellAmount,
  lowerWage,
  probeLaunchCost,
  raiseWage,
  removeProbe,
  resolveSaleRequest,
  saleValue,
} from './economy-rules.js';
import { selectAsteroid, surveyAsteroids } from './asteroid-selection.js';
import { createRowRevealStates } from './map-animation.js';
import { countCompletedBuildingsByName } from './simulation-calculations.js';
import {
  advanceConstructionProgress,
  updateDailyCore,
} from './simulation-rules.js';
import { applyRandomEvent, selectRandomEvent } from './random-events.js';
import { runTurnCadence } from './turn-cadence.js';
import { evaluateEnding } from './ending-model.js';
import { describeEnding, showEnding } from './game-over-view.js';
import {
  isNormalSession,
  readLocalBestScore,
  scoreCategory,
  writeLocalBestScore,
} from './local-best-score.js';
import {
  applyMineCaveIn,
  applyPirateRaid,
  applyPlague,
  applyPowerPlantExplosion,
  applyRadiationStorm,
  applySpaceportCrash,
  createMeteorStormCommand,
  DISASTER_IDS,
  selectDisaster,
} from './disaster-rules.js';
import {
  activateMeteorStorm,
  clearMeteorLaserInput,
  createMeteorStorm,
  finishMeteorStorm,
  fireMeteorLaser,
  setMeteorLaserInput,
  stepMeteorStorm,
} from './meteor-storm.js';
import { createMeteorStormView } from './meteor-storm-view.js';
import {
  chooseDay,
  closeDayPicker,
  createDayPicker,
  openDayPicker,
} from './day-picker.js';
import { SKIN_UNLOCK_EVENT } from './skin-catalogue.js';
import {
  grantUnlockForTrigger,
  recordDiridiumSale,
  resetUnlockProgress,
} from './unlock-progress.js';
/* dev-only:start */
import { installMeteorTrigger } from './dev/meteor-trigger.js';
/* dev-only:end */
import {
  buildHitzone, buildButton, buildTextButton, buildHoverHitzone, buildSpriteButton
} from './button.js';
import {
  gameDataInit, shopItems, buildingMap, constructionTimeMap, undoData
} from './gamedata.js';

// Create app
const app = new PIXI.Application({
  antialias: false, //true,
  autoDensity: true,
  height: 160,
  width: 160,
  backgroundColor: 0x1099bb,
  resolution: 3.0 //devicePixelRatio
});
// Scale mode for pixelation
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
document.querySelector('#game-canvas').appendChild(app.view);

// Created at module load, not in init(), because init() mounts screens itself.
const screens = createStageManager({ stage: app.stage });

// Variables
// The session owns the colony; `gameData` is this module's reference to it,
// kept in sync by the first listener below. Stage 1 of Plan 13: replacement goes
// through the session, so nothing can swap the colony out without the screen
// being told. Field-level mutation still writes straight through this reference,
// which is stage 6's problem.
let gameData = {};
const session = createGameSession({ initialState: gameData });

// Registered at module load rather than in init(), because init() resets the
// state before any sprite exists. The renderer is subscribed at the end of
// init(); listeners fire in subscription order, so this runs first. The
// renderer reads the session itself, but the building counter it is handed
// still reads `gameData`, which is therefore current before it draws.
session.subscribe((state) => { gameData = state; });
let sheet;
let startScreen, launchScreen, startCover;
// Adds one surveyed asteroid to the select-asteroid list; see views/start-view.js.
let addAsteroidChoice;
let loadMineScreen;
let instructionsScreen;
let selectAsteroidTitle;
let mineScreen;
let topBarCover, topBarText;
let optionsMenu;
let optionsMenuExtension;
let saveMineScreen;
let gameOver;
let advanceDaysMenu;
let dayPicker = createDayPicker();
// Each slot's caption on the Save Mine and Load Mine screens, keyed by slot id.
let slotLabels;
let dayText;
let creditText;
let sellPrice;
let progressWindow, loadingBar, progressTitle;
// The game-over screen's two status lines, as showEnding() takes them.
let gameOverStatus;
// Built at the end of init(), once every part of a dialog exists.
let dialogs;
// Built at the end of init(), once every screen and its Cancel buttons exist.
let flow;
// The typed comment in a text-input dialog, which the save workflow reads back.
let inputText;
let asteroidSurface, tileHover;
// Built at the end of init(), once the surface and every tile texture exist.
let mapView;
// Draws the mine screen from the colony; built in init(), once the view exists.
let renderer;
let newMaps = {};
let drawZonesOnce = false;
let sellDiridiumDialog;
let sellAmountText, sellAmount;
let pointerDownID = -1;

// The atlas, then the fonts, then the saves; only then is there a game to build.
loadGameAssets({
  PIXI,
  fontLoader: app.loader,
  onLoaded: (atlas) => setMinerSavesFromStorage().then(() => init(atlas)),
});

function init(atlas) {
  // console.log('init gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);

  resetGameData();

  // console.log('init gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);


  sheet = atlas;

  // Every screen, panel and dialog; see game-view.js, which owns the order they
  // are built in. The callbacks are grouped by the screen that shows them.
  const view = createGameView({
    PIXI,
    sheet,
    stage: app.stage,
    buttons: { buildTextButton, buildSpriteButton, buildHoverHitzone },
    initial: gameData,
    slotNames: Object.fromEntries(SAVE_SLOTS.map((slot) => [slot, minerSaves[slot].name])),
    on: {
      start: {
        newMine,
        loadMine: () => flow.openLoadFromStart(),
        openInstructions: () => show(instructionsScreen, startScreen),
        closeInstructions: () => remove(instructionsScreen, startScreen),
        closeInstructionsToMine: closeMineScreenInstructions,
        launch: launchProbes,
        armMoreProbes,
        moreProbes,
        armFewerProbes,
        fewerProbes,
      },
      reports: { closeOperations: closeOperationsReport, closeProduction: closeProductionReport },
      options: {
        toggleDisasterMode,
        toggleGridlines,
        openSaveMine,
        openLoadMine: showLoadOptions,
        exitAndSave,
        resign: endGame,
        close: closeOptions,
      },
      saveLoad: {
        load: loadFromSlot,
        save: saveToSlot,
        cancelLoad: { start: () => flow.cancelLoadToStart(), mine: closeLoadOptions, gameOver: closeGameOverLoad },
        cancelSave: () => remove(saveMineScreen, optionsMenu),
      },
      dayPicker: { chooseDay: pickDay, cancel: hideAdvanceDaysMenu },
      sell: {
        pressUp: startRaisingSale,
        pressDown: startLoweringSale,
        release: stopSaleRepeat,
        sell: sellDiridium,
        cancel: cancelSale,
      },
      gameOver: { newMine: gameOverNewMine, loadMine: showGameOverLoad, quit },
      chrome: {
        showInstructions: showMineScreenInstructions,
        showLevel,
        showOperations: showOperationsReport,
        showProduction: showProductionReport,
        showOptions,
        showDayPicker: showAdvanceDaysMenu,
        advance,
        armWageUp,
        wageUp,
        armWageDown,
        wageDown,
      },
      shop: { shop, undo },
    },
  });

  // The handles the rest of this file reads. Phase 9b retires these as the
  // functions that read them move into controllers that take them injected.
  ({ startScreen, startCover, launchScreen, instructionsScreen, selectAsteroidTitle, addAsteroidChoice } = view.start);
  ({ menu: optionsMenu, extension: optionsMenuExtension } = view.options);
  loadMineScreen = view.saveLoad.load.screen;
  saveMineScreen = view.saveLoad.save.screen;
  slotLabels = { load: view.saveLoad.load.slotLabels, save: view.saveLoad.save.slotLabels };
  ({ window: progressWindow, bar: loadingBar, title: progressTitle } = view.message.progress);
  ({ inputText } = view.message.message);
  advanceDaysMenu = view.dayPicker.menu;
  ({ dialog: sellDiridiumDialog, amount: sellAmountText } = view.sell);
  ({ screen: gameOver, status: gameOverStatus } = view.gameOver);
  mineScreen = view.mine.screen;
  ({ surface: asteroidSurface, tileHover } = view.mine.map);
  const { chrome } = view.mine;
  ({ dayText, creditText, sellPrice } = chrome);
  ({ cover: topBarCover, text: topBarText } = chrome.topBar);

  renderer = createMineRenderer({
    session,
    view,
    shopItems,
    buildingNames: buildingMap,
    buildSpriteButton,
    countBuildingsByName,
    requestSale: requestDiridiumSale,
  });
  renderer.updateDiridiumStorageIcon();

  //
  // Variables
  dialogs = createDialogService({
    showMessage,
    showConfirmation,
    showInput,
    // The sixteen positional arguments message.js draws a dialog from. Passed
    // once, here, rather than spread into every call; the view keeps the order.
    parts: [app, ...view.message.dialogParts],
    screen: mineScreen,
  });

  flow = createGameFlow({
    screens,
    parts: {
      startScreen, mineScreen, launchScreen, gameOver,
      loadMineScreen, instructionsScreen,
      optionsMenu, optionsMenuExtension,
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

  mapView = createMapView({
    PIXI,
    surface: asteroidSurface,
    textures: view.mine.map.textures,
    // An accessor, not a value: the gridlines toggle redraws the live map and
    // the view is never rebuilt, so the flag has to be read at draw time.
    gridlinesEnabled: () => gameData.gridlinesEnabled,
  });

  // Only now that every sprite exists is it safe to redraw from state. init()
  // resets the colony at its very top, which is why this is not subscribed
  // alongside the reference-syncing listener at module load.
  session.subscribe(renderer.render);

}

function newMine() {
  // Check for Auto save
  if (!minerSaves.autoSave.empty) {
    dialogs.confirm(startScreen, 'Starting a new mining colony will overwrite an active mining colony. Do you wish to proceed?', continueNewMine, () => { return; });
  } else {
    continueNewMine();
  }

  function continueNewMine() {
    // Resetting the state renders it: resetGameData() replaces through the
    // session, and the renderer is one of its listeners.
    resetGameData();
    resetAutosave();
    flow.openLaunch();
  }
}

// The launch screen's probe arrows. Each arms -- shows as pressed -- only when
// releasing it would change the count, and acts on release.
function armMoreProbes() {
  if (addProbe(gameData.probes) !== null) return true;
}

function moreProbes() {
  const probes = addProbe(gameData.probes);
  if (probes !== null) session.update({ probes });
}

function armFewerProbes() {
  if (removeProbe(gameData.probes) !== null) return true;
}

function fewerProbes() {
  const probes = removeProbe(gameData.probes);
  if (probes !== null) session.update({ probes });
}

function launchProbes() {
  asteroidSurface.removeChildren();
  remove(launchScreen, startScreen);
  show(startCover, startScreen);
  show(selectAsteroidTitle);
  session.update({ credits: gameData.credits - probeLaunchCost(gameData.probes) });

  // Every draw happens here, before any button is built. The survey's two draws
  // per probe are interleaved in one loop and share the generator, so the order
  // is fixed in `surveyAsteroids`; building the buttons afterwards is safe only
  // because Pixi construction consumes no randomness.
  const asteroids = surveyAsteroids(gameData.probes, {
    rollDifficulty: getDifficulty,
    rollDesignation: () => random(36, 2, 4),
  });

  asteroids.forEach(({ label, designation }, index) => {
    addAsteroidChoice({ index, designation, label, onPick: () => pickAsteroid(index) });
  });

  function pickAsteroid(i) {
    selectAsteroidTitle.removeChildren();
    remove(selectAsteroidTitle);
    remove(startCover);
    session.update(selectAsteroid(asteroids, i));

    // Don't autosave until player advances days
    gotoMineScreen();
  }
}

// Mine Screen Functions
// Asteroid surface
// Asteroid grid top left is (0,0), bottom right is (9,9)
function tapSurface(x, y) {
  const { info, decision } = resolveSiteTap(gameData, x, y, buildingMap);

  // An occupied site reports itself first and decides afterwards, so the
  // decision is deferred behind the message rather than raced with it.
  if (info) {
    dialogs.message(mineScreen, info, () => applySiteDecision(decision, x, y));
    return;
  }

  applySiteDecision(decision, x, y);
}

function applySiteDecision(decision, x, y) {
  switch (decision.action) {
    case 'notice':
      showMSMessage(decision.text);
      return;
    case 'place':
      placeStructure(decision.num, x, y);
      return;
    case 'confirm':
      dialogs.confirm(mineScreen, decision.text, () => placeStructure(decision.num, x, y), doNothing);
      return;
  }
}

function placeStructure(num, x, y) {
  const result = resolvePlacement(gameData, num, x, y, constructionTimeMap);

  if (result.outcome === 'unaffordable') {
    showMSMessage(result.text);
    return;
  }

  if (result.unlock) grantSkinForTrigger(result.unlock);

  // The site and the payment are one transaction.
  session.update({ maps: result.maps, credits: result.credits });

  mapView.draw(gameData.maps[gameData.level]);

  Object.assign(undoData, result.undo);
}

function showLevel(newLevel) {
  // Short circuit if already on the same level
  if (newLevel === gameData.level) return;

  renderer.updateLevelButtons(newLevel);

  updateMineSurface('Mapping...', newLevel, gameData.maps)
  // console.log('showLevel gameData.maps: ', gameData.maps);
}

// The wage arrows. Each arms -- shows as pressed -- only when releasing it
// would change the wage. Both wage labels are derived from state:
// the renderer's render() sets the control row's, its updateReports() the
// Operations report's.
function armWageUp() {
  if (canRaiseWage(gameData.wage, gameData.wageMax)) return true;
}

function wageUp() {
  const wage = raiseWage(gameData.wage, gameData.wageMax);
  if (wage !== null) session.update({ wage });
}

function armWageDown() {
  if (canLowerWage(gameData.wage)) return true;
}

function wageDown() {
  const wage = lowerWage(gameData.wage);
  if (wage !== null) session.update({ wage });
}

function updateMineSurface(title, newLevel, newMaps, clearMap = false, doneAnimating, currentMaps = gameData.maps) {
  mineScreen.interactiveChildren = false;
  dayText.visible = false;
  creditText.visible = false;
  topBarText.text = title;
  topBarCover.visible = true;

  // For new game it starts with an all clear area
  // (For "load game" I think it should always start on Level 1)
  // Then it draws the map line by line
  // Generate all clear array
  // Generate all smooth array for each level
  // Random bar length for redraw on each line
  // Current map [...]
  // New map [...]
  // Animating map [...]


  // I might be on to something here:
  // const currentMap = {};
  // Object.assign(currentMap, gameData.maps[gameData.level]);
  // Defaults to the live maps, which is right for every caller whose state has
  // not moved yet. `advance()` passes the pre-advance maps explicitly.
  const currentMap = deepClone(currentMaps[gameData.level])

  // If I assign gameData.maps[gameData.newLevel] to currentMap, then make a change to currentMap, will it update gameData.maps[gameData.newLevel] also? Yes.
  // const currentMap = gameData.maps[gameData.newLevel];

  // console.log(`currentMap ${gameData.level} row0: `, currentMap.row0);

  // const currentMap = gameDataInit.maps[gameData.newLevel];
  // const newMap = {};
  // Object.assign(newMap, newMaps[newLevel]);
  const newMap = { ...newMaps[newLevel] };

  // const newMap = newMaps[newLevel];
  // console.log('newLevel: ', newLevel);
  // console.log(`newMap ${newLevel} row0: `, newMap.row0);


  // console.log(`updateMineSurface currentMap: ${currentMap}`);
  // console.log(`updateMineSurface gameData.maps[${gameData.newLevel}]: ${gameData.maps[gameData.newLevel]}`);
  // console.log(`updateMineSurface newMaps[${newLevel}]: ${newMaps[newLevel]}`);

  // console.log('gameData.maps.level1: ', gameData.maps.level1);
  // console.log('Assign currentMap: ', currentMap);
  // console.log('Assign testMap: ', testMap);

  mapView.revealLevel({ currentMap, newMap, clearMap }, () => allDone(newLevel, doneAnimating));
}

function allDone(newLevel, doneAnimating) {
  topBarCover.visible = false;
  dayText.visible = true;
  creditText.visible = true;
  mineScreen.interactiveChildren = true;

  // The animation is how the player's level change actually commits, so the
  // view owns this one write. Routing it through the session means it redraws
  // the level buttons like any other state change rather than relying on
  // showLevel() having set them before the animation started.
  session.update({ level: newLevel });

  // Optional callback when done animating
  typeof doneAnimating === 'function' && doneAnimating();


  // console.log(`allDone gameData.maps[${gameData.level}].row0: `, gameData.maps[gameData.level].row0);
  // console.log(`allDone gameData.maps.level1.row0: `, gameData.maps.level1.row0);
  // console.log(`allDone gameData.maps.level2.row0: `, gameData.maps.level2.row0);
  // console.log(`allDone gameData.maps.level3.row0: `, gameData.maps.level3.row0);
  // console.log('================================');

}


// A slot on the Load Mine screen. The screen is the load's parent, and leaving
// it goes through game-flow.js whichever screen opened it.
function loadFromSlot(slot) {
  load(slot, loadMineScreen, () => flow.leaveLoadScreen(), () => gotoMineScreen(true));
}

// A slot on the Save Mine screen, which saves behind a progress window and then
// closes itself and the options menu beneath it.
function saveToSlot(slot) {
  save(slot, true, saveMineScreen, () => remove(saveMineScreen, optionsMenu), closeOptions);
}

// Save
function save(slot, showProgress, parent, ...closeFunctions) {
  // console.log('save called for slot: ', slot);

  let customName = '';

  if (slot === 'autoSave') {
    commenceSaving();
  } else {
    // showConfirmation: personalized comment?
    dialogs.confirm(parent, 'Would you like to enter a personalized comment for this game?', nameSaveSlot, commenceSaving);

    // Yes: input name for save slot
    function nameSaveSlot() {
      let slotName = '';
      if (minerSaves[slot].hasCustomName) {
        slotName = minerSaves[slot].name;
      }

      dialogs.input(parent, slotName, getCustomName, commenceSaving);
    }

    function getCustomName() {
      customName = inputText.text;
      commenceSaving();
    }
  }

  function commenceSaving() {
    // console.log(`commenceSaving inside function, showProgress: ${showProgress}, slot: ${slot}`);

    // Do I need this check?
    // Yes because of the automated autosave
    if (!showProgress && slot === 'autoSave') updateData();

    // How to prevent ...closeFunctions from resetting data before running updateData?
    if (showProgress) showProgressWindow(parent, updateData, true, ...closeFunctions);


    function updateData() {
      // Object.assign(gameData, saveGame(gameData, slot, customName));
      session.replace(deepClone(saveGame(gameData, slot, customName)));
      // console.log('commenceSaving gameData:', gameData);

      // The slot's new name, on both screens that list it.
      slotLabels.save[slot].text = minerSaves[slot].name;
      slotLabels.load[slot].text = minerSaves[slot].name;
    }
  }
}

// Load
async function load(slot, parent, ...closeFunctions) {
  // console.log('==========');
  // console.log('inside load');
  // console.log('parent: ', parent);
  // console.log('...closeFunctions: ', ...closeFunctions);

  if (minerSaves[slot].empty) return;

  const loaded = prepareLoad({ raw: await loadGame(slot), template: gameDataInit });
  if (!loaded.ok) {
    // 'missing' and 'unreadable' get the same message deliberately. An empty
    // slot already returned above, so a slot that holds something unreadable and
    // a slot that holds nothing are both faults worth telling the player about.
    dialogs.message(parent, 'Unable to load that saved game. Your current game has not been changed.', doNothing);
    return;
  }
  session.replace(loaded.state);
  // No callback: gotoMineScreen() is the last of the close functions and renders
  // from state itself, so there is nothing left to apply afterwards.
  showProgressWindow(parent, null, false, ...closeFunctions);
}

function showProgressWindow(parent, callback, isCallbackFirst = false, ...closeFunctions) {
  // console.log('==========');
  // console.log('inside showProgressWindow');
  // console.log('parent: ', parent);
  // console.log('...closeFunctions: ', ...closeFunctions);

  progressTitle.text = parent === saveMineScreen
    || parent === optionsMenu
    ? 'Saving Mining Colony...'
    : 'Preparing Mining Colony...';
  show(progressWindow, parent);
  show(loadingBar);

  let count = 0;
  let rand = 0;

  const countListener = function() {
    // Randomly advance progress bar
    if (count < 60)
      // Slower at first...
      rand = Math.floor(randomNum(0, 500) * .005);
    else
      // Then faster toward end...
      rand = randomNum(1, 10);

    count += rand;

    loadingBar.width = count > 112 ? 112 : count;
    if (loadingBar.width === 112) {
      app.ticker.remove(countListener);
      remove(progressWindow, parent);
      remove(loadingBar);
      // what happens if I use loadingBar.destroy()? geometry is null
      // what happens if I use loadingBar.clear()? it removes it and doesn't reappear a second time
      // console.log('before closeFunctions');
      // console.log(...closeFunctions);

      if (isCallbackFirst && callback) callback();

      // Pass all the functions needed to close open screens
      closeFunctions.forEach(f => f.apply());
      // console.log('after closeFunctions');

      if (!isCallbackFirst && callback) callback();
    }
  }

  app.ticker.add(countListener);
}

// Advance Days
function advance(days) {
  // Captured before the state moves, because the reveal animates from the map as
  // it was to the map as it now is.
  //
  // This used to work by committing the new maps on the line *after* the
  // animation was started, so the animation silently depended on the state being
  // one step stale. Committing everything in one go would have animated the new
  // map into itself -- no visible change, no error. The dependency is a
  // parameter now rather than an ordering nobody could see.
  const previousMaps = gameData.maps;
  const updatedMaps = advanceConstructionProgress(gameData.maps, days);

  session.update({
    day: gameData.day + days,
    // Days played outside Disaster Mode decide the run's score category. Counted
    // here rather than from `day` because the EM time shift moves the day forward
    // without a turn being played, and those days belong to neither mode.
    daysOutsideDisasterMode: gameData.disasterMode
      ? gameData.daysOutsideDisasterMode
      : gameData.daysOutsideDisasterMode + days,
    soldToday: false,
    maps: deepClone(updatedMaps),
  });

  updateMineSurface(
    'Updating...',
    gameData.level,
    updatedMaps,
    false,
    () => updateStats(days),
    previousMaps,
  );
}

function updateStats(days) {
  runTurnCadence({
    days,
    state: gameData,
    noOreVeins: countBuildings(4) === 0,
    selectEvent: selectRandomEvent,
    applyEvent: applyRandomEvent,
    commitEvent: applyRandomEventResult,
    requestChoice(choice, accept, decline) {
      dialogs.confirm(mineScreen, choice.message, accept, decline);
    },
    coreUpdate: updateCoreStats,
  });
}

function updateCoreStats(days) {
  const buildingCounts = countCompletedBuildingsByName(gameData.maps, buildingMap);
  const result = updateDailyCore(gameData, buildingCounts, days, { random: pocketRandom });
  session.replace(result.state);
  creditText.text = gameData.credits.toString();
  sellPrice.text = gameData.sellPrice.toString();

  if (result.deathRateTerminal) {
    dialogs.discard();
    dialogs.message(mineScreen, 'NEWS FLASH: With the asteriod mine death rate rising to 100%, the Space Guard has intervened to rescue the remaining workers. A reward is offered for the capture of those responsible.', () => endGame(false, 'Death Rate Reached 100%'));
    return;
  }

  result.messages.forEach(message => queueMessage(message));
  finishCoreUpdate(days);
}

function finishCoreUpdate(days) {
  renderer.updateReports();
  save('autoSave', false);

  disaster(() => {
    checkEnding();
    showQueuedMessages();
  });
}

/**
 * Awards the PDA frame attached to a trigger and tells the site chrome.
 *
 * Gated on `!devSandbox` rather than on `isNormalSession()`. The two are
 * different boundaries: isNormalSession also demands a matching asteroid class
 * and rejects Disaster Mode, so gating cosmetics on it would mean the hardest
 * ways to play unlock nothing. Scores need that strictness; frames do not.
 * A storm forced from the dev panel is not earned, and does not unlock.
 */
function grantSkinForTrigger(trigger) {
  if (gameData.devSandbox) return;
  const { changed, skin } = grantUnlockForTrigger(localStorage, trigger);
  if (!changed || !skin) return;
  // Announced on the canvas as well as in the site chrome: the player is looking
  // at the game when it happens, and a toast behind the console is easy to miss.
  queueMessage(`NEWS FLASH: ${skin.label} handheld issued to your field kit.`);
  // site-controls.js listens for this. The two are separate entry points and do
  // not import each other, so the event is the whole contract between them.
  document.dispatchEvent(new CustomEvent(SKIN_UNLOCK_EVENT, { detail: { id: skin.id } }));
}

function applyRandomEventResult(result) {
  session.replace(result.state);
  dayText.text = gameData.day.toString();
  creditText.text = gameData.credits.toString();
  result.messages.forEach(message => queueMessage(message));

  // Matched on effects rather than event ids: the effects array is the committed
  // contract between random-events.js and this file, and `set-morale` is emitted
  // only by the alien artifact, `time-shift` only by the EM storm.
  const effectTypes = new Set((result.effects ?? []).map(({ type }) => type));
  if (effectTypes.has('set-morale')) grantSkinForTrigger('alien-artifact');
  if (effectTypes.has('time-shift')) grantSkinForTrigger('time-shift');

  if (result.mapUpdate?.redraw) {
    updateMineSurface('Updating...', gameData.level, gameData.maps, false, doNothing);
  }
}

// The Sell Diridium dialog. Holding an arrow repeats every tenth of a second
// until it is let go; the sale itself is paid when its receipt is dismissed.

const SELL_REPEAT_MS = 100;

function startRaisingSale() {
  if (pointerDownID === -1) pointerDownID = setInterval(raiseSaleOnce, SELL_REPEAT_MS);
  return true;
}

function startLoweringSale() {
  if (pointerDownID === -1) pointerDownID = setInterval(lowerSaleOnce, SELL_REPEAT_MS);
  return true;
}

function stopSaleRepeat() {
  if (pointerDownID !== -1) {
    clearInterval(pointerDownID);
    pointerDownID = -1;
  }
}

function raiseSaleOnce() {
  sellAmountText.text = sellAmount = increaseSellAmount(sellAmount, {
    diridium: gameData.diridium,
    hasSpacePort: countBuildingsByName('Space Port') > 0,
  });
}

function lowerSaleOnce() {
  sellAmountText.text = sellAmount = decreaseSellAmount(sellAmount);
}

function sellDiridium() {
  const sale = saleValue(sellAmount, gameData.sellPrice);
  remove(sellDiridiumDialog, mineScreen);
  session.update({ diridium: gameData.diridium - sellAmount, soldToday: true });
  dialogs.message(mineScreen, `Sold! for ${sale} credits.`, () => {
    // The payment lands on dismissal, not on the sale, which is what makes the
    // message read as a receipt rather than a notification.
    session.update({ credits: gameData.credits + sale });
    // Lifetime earnings, not the credit balance: the game starts the player
    // with a large balance, so a balance threshold would fire on day one.
    if (!gameData.devSandbox) {
      const { unlocked } = recordDiridiumSale(localStorage, sale);
      if (unlocked.length > 0) grantSkinForTrigger('lifetime-earnings');
    }
  });
}

function cancelSale() {
  remove(sellDiridiumDialog, mineScreen);
}

// Tapping the storage icon asks for a sale. The icon itself is drawn by the
// renderer, which calls this; phase 9b step 2 moves it into the economy.
function requestDiridiumSale() {
  const { outcome, amount } = resolveSaleRequest({
    diridium: gameData.diridium,
    soldToday: gameData.soldToday,
    hasSpacePort: countBuildingsByName('Space Port') > 0,
  });

  if (outcome === 'empty') {
    showMSMessage('You currently have no diridium to sell.');
    return;
  }

  if (outcome === 'blocked') {
    showMSMessage('Prior sale still being transfered. Build a space port or wait until tomorrow to sell more diridium.');
    return;
  }

  // The quantity is set before the dialog is shown in both remaining cases.
  // In the capped one that means setting it behind the explanatory message,
  // which is dismissed before the dialog appears.
  sellAmountText.text = sellAmount = amount;

  if (outcome === 'limited') {
    dialogs.message(optionsMenu, 'A space port allows the sale and transfer of diridium to ships. Without a space port, only one sale up to 700 tons can be sold per day.', () => show(sellDiridiumDialog, mineScreen));
    return;
  }

  show(sellDiridiumDialog, mineScreen);
}

function disaster(done = doNothing) {
  const selection = selectDisaster(gameData, { random: pocketRandom });
  if (!selection.selected) {
    done();
    return;
  }

  let result;
  switch (selection.disasterId) {
    case DISASTER_IDS.PIRATE_RAID:
      result = applyPirateRaid(gameData, { random: pocketRandom });
      break;
    case DISASTER_IDS.METEOR_STORM:
      result = createMeteorStormCommand(gameData, {
        buildingCounts: {
          bulldozer: countBuildingsByName('Bulldozer'),
          diridiumMine: countBuildingsByName('Diridium Mine'),
          hydroponics: countBuildingsByName('Hydroponics'),
          lifeSupport: countBuildingsByName('Life Support'),
          spacePort: countBuildingsByName('Space Port'),
          powerPlant: countBuildingsByName('Power Plant'),
          processor: countBuildingsByName('Processor'),
          sickbay: countBuildingsByName('Sickbay'),
          storage: countBuildingsByName('Storage'),
        },
        random: pocketRandom,
      });
      break;
    case DISASTER_IDS.SPACEPORT_CRASH:
      result = applySpaceportCrash(gameData, { random: pocketRandom });
      break;
    case DISASTER_IDS.POWER_PLANT_EXPLOSION:
      result = applyPowerPlantExplosion(gameData, { random: pocketRandom });
      break;
    case DISASTER_IDS.PLAGUE:
      result = applyPlague(gameData, {
        sickbayCount: countBuildingsByName('Sickbay'),
        random: pocketRandom,
      });
      break;
    case DISASTER_IDS.RADIATION_STORM:
      result = applyRadiationStorm(gameData);
      break;
    case DISASTER_IDS.MINE_CAVE_IN:
      result = applyMineCaveIn(gameData, { random: pocketRandom });
      break;
    default:
      throw new Error(`Unknown disaster: ${selection.disasterId}`);
  }

  applyDisasterResult(result, done);
}

function applyDisasterResult(result, done) {
  if (!result.outcome.applied) {
    done();
    return;
  }

  session.replace(result.state);
  dayText.text = gameData.day.toString();
  creditText.text = gameData.credits.toString();

  const meteorEffect = result.effects.find(effect => effect.type === 'run-meteor-storm');
  if (meteorEffect) {
    queueTask(() => {
      startMeteorStorm(meteorEffect.command, meteorResult => {
        applyMeteorStormResult(meteorResult, done);
      });
    });
    showQueuedMessages();
    return;
  }

  const damagedLevels = new Set(
    (result.outcome.damagedSites ?? []).map(({ level }) => level),
  );
  const messageEffects = result.effects.filter(effect => effect.type === 'message');
  messageEffects.forEach(effect => queueMessage(effect.text));
  if (damagedLevels.has(gameData.level)) {
    queueTask(resumeQueue => {
      updateMineSurface(
        'Updating...',
        gameData.level,
        gameData.maps,
        false,
        resumeQueue,
      );
    });
  }

  renderer.updateReports();
  done();
}

function startMeteorStorm(command, onComplete) {
  const initialState = createMeteorStorm(command);
  const view = createMeteorStormView({
    PIXI,
    app,
    fonts: { title: bold, status: regular },
    textures: sheet.textures,
    model: {
      activate: activateMeteorStorm,
      step: state => stepMeteorStorm(state, { random: pocketRandom }),
      fire: fireMeteorLaser,
      setInput: setMeteorLaserInput,
      clearInput: clearMeteorLaserInput,
    },
    underlyingParent: mineScreen,
    onComplete(completedState) {
      onComplete(finishMeteorStorm(completedState, {
        maps: gameData.maps,
        random: pocketRandom,
      }));
    },
  });
  view.open(initialState);
}

function applyMeteorStormResult(result, done) {
  const surfaceChanged = Object.keys(gameData.maps.level1).some(row => (
    gameData.maps.level1[row].some((site, column) => (
      site !== result.nextMaps.level1[row][column]
    ))
  ));
  // Amended parity, 2026-08-20: a storm the player never touches still yields
  // exactly the original outcome, because moraleDelta's bonus branch needs zero
  // misses and diridiumBonus needs a cracked core -- neither is reachable
  // without firing. See the caps in scripts/meteor-storm.js.
  session.update({
    efficiency: result.nextEfficiency,
    maps: result.nextMaps,
    morale: Math.max(0, Math.min(100, gameData.morale + (result.moraleDelta ?? 0))),
    diridium: gameData.diridium + (result.diridiumBonus ?? 0),
  });
  dayText.text = gameData.day.toString();
  creditText.text = gameData.credits.toString();
  renderer.updateReports();
  grantSkinForTrigger('meteor-storm');
  for (const message of result.messages ?? [result.message]) queueMessage(message);
  if (surfaceChanged && gameData.level === 'level1') {
    queueTask(resumeQueue => {
      updateMineSurface(
        'Updating...',
        gameData.level,
        gameData.maps,
        false,
        resumeQueue,
      );
    });
  }
  done();
}

// Check ending
// see line 2600
function checkEnding() {
  // Disaster Mode runs are ranked in their own category rather than excluded:
  // the result was earned harder, not unearned. Only sandbox sessions are
  // rejected outright.
  const category = scoreCategory(gameData);
  const localBest = readLocalBestScore(localStorage, category);
  const recordEligible = isNormalSession(gameData);
  const revoltRoll = gameData.morale < 30 ? pocketRandom(11) : 11;
  const endingInputs = {
    day: gameData.day,
    morale: gameData.morale,
    credits: gameData.credits,
    diridium: gameData.diridium,
    sellPrice: gameData.sellPrice,
    difficulty: gameData.difficulty,
    creditFlag: gameData.creditFlag,
    revoltRoll,
    completionFlavorRoll: 0,
    localHighScore: localBest.score,
    recordEligible,
  };
  let ending = evaluateEnding(endingInputs);

  // The source only consumes random(3) once all higher-priority endings pass.
  if (ending.outcome === 'complete') {
    ending = evaluateEnding({
      ...endingInputs,
      completionFlavorRoll: pocketRandom(3),
    });
  }

  // Found by the development freeze on the first play-through after it landed.
  // This was an Object.assign onto the colony, which is why the stage 1-5 scans
  // -- all looking for `gameData.field =` -- never saw it.
  session.update(ending.state);
  creditText.text = gameData.credits.toString();

  if (ending.outcome === 'credit-extended') {
    queueMessage('You do not have enough processed diridium to cover your debts.');
    queueMessage(`Your credit has been extended to cover ${ending.creditExtension.debtCovered} credits in debt. A lien is placed on future processed ore. Cut costs immediately!`);
    if (ending.creditExtension.limitReached) {
      queueMessage('WARNING: Your creditors refuse any future extension of your credit. Watch your expenses carefully.');
    }
    renderer.updateReports();
    save('autoSave', false);
  }

  if (ending.outcome === 'revolt') {
    setEndingMessage(() => {
      dialogs.message(mineScreen, 'DISASTER: You have been forced out of an airlock by angry workers! At least the workers let you put your suit and helmet on first. A nearby ship rescues you.', () => endGame(false, 'Worker Revolt'));
    });
  } else if (ending.outcome === 'insolvency') {
    queueMessage('You do not have enough processed diridium to cover your debts.');
    setEndingMessage(() => {
      dialogs.message(mineScreen, 'Your creditors will not extend you further credit. You have been terminated and creditors have taken over your mining operation. Don\'t ask for any recommendation letters.', () => endGame(false, 'Insufficient Funds'));
    });
  } else if (ending.outcome === 'complete') {
    // Two full years without ever leaving Disaster Mode. The hardest thing in
    // the game, and the only frame that cannot be earned any other way.
    if (category === 'disaster') grantSkinForTrigger('disaster-mode-completion');
    if (ending.localRecord.isNewRecord) {
      try {
        writeLocalBestScore(localStorage, category, { score: ending.score, difficulty: gameData.difficulty });
      } catch {
        // Completion remains playable when browser storage is unavailable.
      }
    }
    setEndingMessage(() => endGame(false, '', ending.completion));
  }

  function setEndingMessage(callback) {
    dialogs.whenDrained(callback);
  }
}

function countBuildings(buildingNum) {
  let count = 0;
  for (let level in gameData.maps) {
    for (let row in gameData.maps[level]) {
      count += gameData.maps[level][row]
        .filter(site => site === buildingNum)
        .length;
    }
  }
  return count;
}

// Usage: countBuildingsByName('Space Port')
// See the buildingMap for building names in gamedata.js
function countBuildingsByName(name) {
  let num = Number(Object.keys(buildingMap).find(key => buildingMap[key] === name));
  // console.log(`count of ${name} ${num}: ${countBuildings(num)}`);
  return countBuildings(num);
}

// Shop
// Selecting an item is now only a state change. Which sprite is lit, what the
// caption reads, its tint and the affordability marker are all derived by
// the renderer (mine-renderer.js), so this no longer needs the sprite passed to it.
function shop(id) {
  // Clicking the item already selected does nothing. Unselecting by re-clicking
  // was deliberately disabled and is kept that way.
  if (shopItems[id].name === gameData.shopBtn) return;

  session.update({ shopBtn: shopItems[id].name, shopPrice: getPrice(id) });
}

function getPrice(id) {
  return calculateShopPrice(shopItems[id].price, gameData.multiplier);
}

function undo() {
  if (undoData.hasUndo) {
    undoData.hasUndo = false;

    session.update({
      credits: gameData.credits + undoData.undoPrice,
      maps: setSite(
        gameData.maps,
        undoData.undoLevel,
        undoData.undoY,
        undoData.undoX,
        undoData.undoNum,
      ),
    });

    mapView.draw(gameData.maps[gameData.level]);
  } else {
    dialogs.message(mineScreen, 'There is nothing that can be undone.', doNothing);
  }
}


// Show / Close
function gotoMineScreen(isLoadedGame = false) {
  // console.log('inside gotoMineScreen');

  flow.enterMine();

  // A new colony always opens on level 1. A loaded one opens on the level it was
  // saved on, which is what the original's Load() restores -- it reads `level`
  // back from the record and the main loop redraws there. allDone() writes the
  // same value back when the animation lands, so the buttons, the drawn surface
  // and gameData.level cannot disagree.
  const openingLevel = isLoadedGame ? gameData.level : 'level1';

  // Only generate map if it's not loading a game
  if (!isLoadedGame) {
    newMaps = generateMaps(gameData.difficulty);
    session.update({ maps: newMaps });
  } else {
    newMaps = deepClone(gameData.maps);
  }
  // newMaps is correct here and we want to keep it
  // console.log('Gabrien generating newMaps: ', newMaps);
  // Store it in gameData.maps?
  // gameData.maps = newMaps;
  // console.log('Gabrien gameData.maps: ', gameData.maps);

  // Load Level1 for new games and loaded games
  // console.log('gotoMineScreen gameData.maps.level1.row1', gameData.maps.level1.row1);
  // console.log('gotoMineScreen gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);
  if (!drawZonesOnce) {
    mapView.buildHitZones({
      parent: mineScreen,
      hoverSprite: tileHover,
      buildHoverHitzone,
      onTapSite: tapSurface,
    });
    drawZonesOnce = true;
  }

  // Render from state first, then run the transition over it. On the load path
  // this is the only render: showProgressWindow runs its close functions (which
  // call this) before its callback, so there is no second pass to rely on.
  renderer.render();
  updateMineSurface('Mapping...', openingLevel, newMaps, true);
}

// Screen transitions live in game-flow.js. These keep their names because
// buttons and close lists across init() call them, and two are pinned by the
// source-text suites.
function showOperationsReport() {
  flow.openOperations();
}

function closeOperationsReport() {
  flow.closeOperations();
}

function showProductionReport() {
  flow.openProduction();
}

function closeProductionReport() {
  flow.closeProduction();
}

function showAdvanceDaysMenu() {
  dayPicker = openDayPicker(dayPicker);
  show(advanceDaysMenu, mineScreen);
}

// A tap on a day cell: the first selects, a second on the same day confirms.
function pickDay(day) {
  const { state, choice } = chooseDay(dayPicker, day);
  dayPicker = state;
  if (choice === null) return;
  hideAdvanceDaysMenu();
  advance(choice);
}

function hideAdvanceDaysMenu() {
  dayPicker = closeDayPicker(dayPicker);
  remove(advanceDaysMenu, mineScreen);
}

function showOptions() {
  flow.openOptions();
}

// The options menu's rows that do more than open something.

function toggleDisasterMode() {
  if (gameData.disasterMode) {
    toggleCheck('disasterMode');
    return;
  }
  // Confirmed on the way in only: enabling raises the disaster rate for the
  // rest of the run and makes it unranked, which the player should agree to.
  dialogs.confirm(optionsMenu, 'Disaster Mode raises the chance of disasters for the rest of this colony, and its score will not be recorded. Enable it?', () => {
    toggleCheck('disasterMode');
  }, doNothing);
}

function toggleGridlines() {
  toggleCheck('gridlinesEnabled');
  mapView.draw(gameData.maps[gameData.level]);
}

// Save Mine opens over the options menu, with the menu's extension tab beside it.
function openSaveMine() {
  show(saveMineScreen, optionsMenu);
  show(optionsMenuExtension);
}

function closeOptions() {
  flow.closeOptions();
}

function showLoadOptions() {
  flow.openLoadFromOptions();
  for (const slot of SAVE_SLOTS) slotLabels.load[slot].text = minerSaves[slot].name;
}

function closeLoadOptions() {
  flow.cancelLoadToOptions();
}

function showGameOverLoad() {
  flow.openLoadFromGameOver();
}

function closeGameOverLoad() {
  flow.cancelLoadToGameOver();
}

function showMineScreenInstructions() {
  flow.openInstructionsFromMine();
}

function closeMineScreenInstructions() {
  flow.closeInstructionsToMine();
}


// End of game functions
function exitAndSave() {
  // No reset on the way out. The start screen leads only to New Mine, which
  // resets the colony, and Load Mine, which replaces it, and nothing on it reads
  // gameData first -- so a reset here only ran a second one before the next
  // colony. Game over's Quit leaves the colony in place the same way.
  const closeFunctions = [
    closeOptions,
    () => flow.leaveMineForStart(),
    () => flow.showStart()
  ];
  save('autoSave', true, optionsMenu, ...closeFunctions);
}

function endGame(hasConfirmation = true, failure = '', completion = null) {
  let hasEnded = false;

  // The day and credits are read here, before anything below can reset the
  // colony, and handed over as values. See game-over-view.js.
  const ending = describeEnding({ completion, failure, day: gameData.day, credits: gameData.credits });
  showEnding(gameOverStatus, ending);

  if (failure || completion) {
    endGameFunctions();
  } else if (hasConfirmation) {
    dialogs.confirm(optionsMenu, 'Are you sure you want to resign? (This will end your current colony.)', endGameFunctions, doNothing);
  } else endGameFunctions();

  function endGameFunctions() {
    if (hasEnded) return;
    hasEnded = true;
    flow.leaveMineForGameOver();
    // The autosave is cleared so a colony that has ended cannot be loaded back.
    // The colony itself is not reset here: that happens once, when the next one
    // begins (newMine) or is loaded, whichever way the player leaves game over.
    resetAutosave();
    flow.showGameOver();
    if (ending.followUp) {
      dialogs.message(gameOver, ending.followUp, doNothing);
    }
  }
}

// Game over is only ever shown straight after the autosave is cleared, and
// nothing reachable from it writes one, so there is never an active colony to
// warn about overwriting here. newMine() asks that question itself in any case.
function gameOverNewMine() {
  flow.leaveGameOver();
  newMine();
}

// No reset: the start screen leads only to New Mine, which resets, or to Load
// Mine, which replaces the colony outright.
function quit() {
  flow.leaveGameOverForStart();
}


// Shortcuts
// Show mineScreen message
// Dialogs and the message queue live in dialog-service.js. These keep their
// names because forty call sites and three source-text suites use them; each is
// now one line, and the behaviour they stand for is tested there.
function showMSMessage(text) {
  dialogs.notice(text);
}

function queueMessage(text, callBack, isConfirmation, callBack1, callBack2) {
  dialogs.enqueue(text, callBack, isConfirmation, callBack1, callBack2);
}

function queueTask(run) {
  dialogs.enqueueTask(run);
}

function showQueuedMessages() {
  dialogs.drain();
}

// Which screens are mounted lives in stage-manager.js. `show` and `remove` keep
// their names for the same reason: sixty call sites, several pinned by the
// source-text suites.
function show(sprite, parent) {
  screens.show(sprite, parent);
}

function remove(sprite, parent) {
  screens.hide(sprite, parent);
}

// The checkbox sprite is not touched here. The renderer's render() adds or
// removes it from the flag, like every other piece of derived screen state, so
// this is only the flag.
function toggleCheck(field) {
  session.update({ [field]: !gameData[field] });
}

function resetGameData() {
  session.replace(deepClone(gameDataInit));
}

function resetAutosave() {
  minerSaves.autoSave = deepClone(initAutosave());
  slotLabels.load.autoSave.text = minerSaves.autoSave.name;
  slotLabels.save.autoSave.text = minerSaves.autoSave.name;
}

function doNothing() {
  return;
}







// Install EventSystem, if not already
// (PixiJS 6 doesn't add it by default)
// if (!('events' in app.renderer)) {
//     app.renderer.addSystem(PIXI.EventSystem, 'events');
// }

/* dev-only:start */
// Stripped from `dist/` by tools/build-static.js; see scripts/dev/meteor-trigger.js.
installMeteorTrigger({
  getGameData: () => gameData,
  markSandbox: (patch) => { session.update(patch); },
  // `mineScreen.visible` is true before a game exists, so it cannot gate this.
  // `asteroid` is empty until one is picked, which is the same signal
  // isNormalSession() keys on.
  isPlayable: () => Boolean(gameData.asteroid),
  startMeteorStorm,
  // A real storm runs inside a turn, and the turn flushes the message queue for
  // it: finishCoreUpdate -> disaster(done) -> applyDisasterResult -> the storm ->
  // done() -> checkEnding(); showQueuedMessages(). A dev-triggered storm has no
  // turn around it, so it has to flush its own news flashes -- otherwise they
  // sit in the queue until the player's next advance and appear a day late.
  // checkEnding() is deliberately not mirrored: dev storms are unranked sandbox
  // runs and must never decide a game.
  applyMeteorStormResult: (result, done) => applyMeteorStormResult(result, () => {
    done();
    showQueuedMessages();
  }),
  resetUnlocks: () => {
    resetUnlockProgress(localStorage);
    document.dispatchEvent(new CustomEvent(SKIN_UNLOCK_EVENT, { detail: { id: null } }));
  },
  getBuildingCounts: () => ({
    bulldozer: countBuildingsByName('Bulldozer'),
    diridiumMine: countBuildingsByName('Diridium Mine'),
    hydroponics: countBuildingsByName('Hydroponics'),
    lifeSupport: countBuildingsByName('Life Support'),
    spacePort: countBuildingsByName('Space Port'),
    powerPlant: countBuildingsByName('Power Plant'),
    processor: countBuildingsByName('Processor'),
    sickbay: countBuildingsByName('Sickbay'),
    storage: countBuildingsByName('Storage'),
  }),
});
/* dev-only:end */
