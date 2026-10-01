import { deepClone } from './utilities.js';
import { pocketRandom, random, randomNum } from './random.js';
import { bold, regular } from './font-styles.js';
import { getDifficulty, fillMap, generateMaps } from './maps.js';
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
import { addProbe, probeLaunchCost, removeProbe } from './economy-rules.js';
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
// init(); listeners fire in subscription order, so this runs first. Nothing
// the renderer calls reads `gameData` any more -- it and the building counter it
// is handed both read the session -- but this still has to be current before
// any code here that reads `gameData` runs after an update.
session.subscribe((state) => { gameData = state; });
let sheet;
let startScreen, launchScreen, startCover;
// Adds one surveyed asteroid to the select-asteroid list; see views/start-view.js.
let addAsteroidChoice;
let instructionsScreen;
let selectAsteroidTitle;
let mineScreen;
let optionsMenu;
let optionsMenuExtension;
let saveMineScreen;
let gameOver;
let advanceDaysMenu;
let dayPicker = createDayPicker();
let dayText;
let creditText;
let sellPrice;
// The game-over screen's two status lines, as showEnding() takes them.
let gameOverStatus;
// Built at the end of init(), once every part of a dialog exists.
let dialogs;
// Built at the end of init(), once every screen and its Cancel buttons exist.
let flow;
let asteroidSurface, tileHover;
// Built at the end of init(), once the surface and every tile texture exist.
let mapView;
// The surface: sites, building, undo, levels and the reveal; built in init().
let map;
// Wages, the shop and selling diridium; built in init(), once the dialogs exist.
let economy;
// Draws the mine screen from the colony; built in init(), once the view exists.
let renderer;
// Saving, loading and the progress window; built in init(), after the flow.
let saveWorkflow;
let newMaps = {};
let drawZonesOnce = false;

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
        exitAndSave: () => saveWorkflow.exitAndSave(),
        resign: endGame,
        close: closeOptions,
      },
      saveLoad: {
        // The save workflow is built after the screen flow it closes screens
        // through, so these reach it at call time.
        load: (slot) => saveWorkflow.loadFromSlot(slot),
        save: (slot) => saveWorkflow.saveToSlot(slot),
        cancelLoad: { start: () => flow.cancelLoadToStart(), mine: closeLoadOptions, gameOver: closeGameOverLoad },
        cancelSave: () => remove(saveMineScreen, optionsMenu),
      },
      dayPicker: { chooseDay: pickDay, cancel: hideAdvanceDaysMenu },
      // The economy controller is built once the view and the dialogs exist, so
      // its controls reach it through these rather than by reference.
      sell: {
        pressUp: () => economy.startRaisingSale(),
        pressDown: () => economy.startLoweringSale(),
        release: () => economy.stopSaleRepeat(),
        sell: () => economy.sellDiridium(),
        cancel: () => economy.cancelSale(),
      },
      gameOver: { newMine: gameOverNewMine, loadMine: showGameOverLoad, quit },
      chrome: {
        showInstructions: showMineScreenInstructions,
        showLevel: (level) => map.showLevel(level),
        showOperations: showOperationsReport,
        showProduction: showProductionReport,
        showOptions,
        showDayPicker: showAdvanceDaysMenu,
        advance,
        armWageUp: () => economy.armWageUp(),
        wageUp: () => economy.wageUp(),
        armWageDown: () => economy.armWageDown(),
        wageDown: () => economy.wageDown(),
      },
      shop: { shop: (id) => economy.shop(id), undo: () => map.undo() },
    },
  });

  // The handles the rest of this file reads. Phase 9b retires these as the
  // functions that read them move into controllers that take them injected.
  ({ startScreen, startCover, launchScreen, instructionsScreen, selectAsteroidTitle, addAsteroidChoice } = view.start);
  ({ menu: optionsMenu, extension: optionsMenuExtension } = view.options);
  saveMineScreen = view.saveLoad.save.screen;
  advanceDaysMenu = view.dayPicker.menu;
  ({ screen: gameOver, status: gameOverStatus } = view.gameOver);
  mineScreen = view.mine.screen;
  ({ surface: asteroidSurface, tileHover } = view.mine.map);
  const { chrome } = view.mine;
  ({ dayText, creditText, sellPrice } = chrome);

  dialogs = createDialogService({
    showMessage,
    showConfirmation,
    showInput,
    // The sixteen positional arguments message.js draws a dialog from. Passed
    // once, here, rather than spread into every call; the view keeps the order.
    parts: [app, ...view.message.dialogParts],
    screen: mineScreen,
  });

  mapView = createMapView({
    PIXI,
    surface: asteroidSurface,
    textures: view.mine.map.textures,
    // An accessor, not a value: the gridlines toggle redraws the live map and
    // the view is never rebuilt, so the flag has to be read at draw time.
    gridlinesEnabled: () => gameData.gridlinesEnabled,
  });

  map = createMapController({
    session,
    view,
    mapView,
    buildingNames: buildingMap,
    constructionTimes: constructionTimeMap,
    undoData,
    dialogs,
    // The renderer is built after this, because it takes this controller's
    // building counter; the level buttons are reached through it at call time.
    updateLevelButtons: (level) => renderer.updateLevelButtons(level),
    grantSkinForTrigger,
  });

  economy = createEconomyController({
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

  renderer = createMineRenderer({
    session,
    view,
    shopItems,
    buildingNames: buildingMap,
    buildSpriteButton,
    countBuildingsByName: map.countBuildingsByName,
    requestSale: economy.requestSale,
  });
  renderer.updateDiridiumStorageIcon();

  flow = createGameFlow({
    screens,
    parts: {
      startScreen, mineScreen, launchScreen, gameOver,
      loadMineScreen: view.saveLoad.load.screen, instructionsScreen,
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

  saveWorkflow = createSaveWorkflow({
    session,
    view,
    dialogs,
    screens,
    ticker: app.ticker,
    randomNum,
    saves: { minerSaves, saveGame, loadGame, initAutosave },
    template: gameDataInit,
    flow,
    openLoadedColony: () => gotoMineScreen(true),
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
    saveWorkflow.resetAutosave();
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

  map.updateMineSurface(
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
    noOreVeins: map.countBuildings(4) === 0,
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
  saveWorkflow.save('autoSave', false);

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
    map.updateMineSurface('Updating...', gameData.level, gameData.maps, false, doNothing);
  }
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
          bulldozer: map.countBuildingsByName('Bulldozer'),
          diridiumMine: map.countBuildingsByName('Diridium Mine'),
          hydroponics: map.countBuildingsByName('Hydroponics'),
          lifeSupport: map.countBuildingsByName('Life Support'),
          spacePort: map.countBuildingsByName('Space Port'),
          powerPlant: map.countBuildingsByName('Power Plant'),
          processor: map.countBuildingsByName('Processor'),
          sickbay: map.countBuildingsByName('Sickbay'),
          storage: map.countBuildingsByName('Storage'),
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
        sickbayCount: map.countBuildingsByName('Sickbay'),
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
      map.updateMineSurface(
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
      map.updateMineSurface(
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
    saveWorkflow.save('autoSave', false);
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

// Show / Close
function gotoMineScreen(isLoadedGame = false) {
  // console.log('inside gotoMineScreen');

  flow.enterMine();

  // A new colony always opens on level 1. A loaded one opens on the level it was
  // saved on, which is what the original's Load() restores -- it reads `level`
  // back from the record and the main loop redraws there. The reveal writes the
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
      onTapSite: map.tapSurface,
    });
    drawZonesOnce = true;
  }

  // Render from state first, then run the transition over it. On the load path
  // this is the only render: showProgressWindow runs its close functions (which
  // call this) before its callback, so there is no second pass to rely on.
  renderer.render();
  map.updateMineSurface('Mapping...', openingLevel, newMaps, true);
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
  saveWorkflow.refreshLoadCaptions();
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
    saveWorkflow.resetAutosave();
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
    bulldozer: map.countBuildingsByName('Bulldozer'),
    diridiumMine: map.countBuildingsByName('Diridium Mine'),
    hydroponics: map.countBuildingsByName('Hydroponics'),
    lifeSupport: map.countBuildingsByName('Life Support'),
    spacePort: map.countBuildingsByName('Space Port'),
    powerPlant: map.countBuildingsByName('Power Plant'),
    processor: map.countBuildingsByName('Processor'),
    sickbay: map.countBuildingsByName('Sickbay'),
    storage: map.countBuildingsByName('Storage'),
  }),
});
/* dev-only:end */
