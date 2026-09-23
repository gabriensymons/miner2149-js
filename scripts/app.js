import { deepClone } from './utilities.js';
import { pocketRandom, random, randomNum } from './random.js';
import { barText, bold, regular } from './font-styles.js';
import { getDifficulty, fillMap, generateMaps } from './maps.js';
import { showMessage, showConfirmation, showInput } from './message.js';
import {
  setMinerSavesFromStorage,
  minerSaves, saveGame, initAutosave, loadGame
} from './saveload.js';
import { prepareLoad } from './save-controller.js';
import { createGameSession } from './game-session.js';
import { setSite } from './map-grid.js';
import { resolvePlacement, resolveSiteTap } from './construction-rules.js';
import { createMapView } from './map-view.js';
import { createStageManager } from './stage-manager.js';
import { createDialogService } from './dialog-service.js';
import { calculateShopPrice, resolveShopSelection } from './shop.js';
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
import { getDiridiumStorageState } from './diridium-storage.js';
import {
  calculateOperationsReport,
  calculateProductionReport,
  countCompletedBuildingsByName,
} from './simulation-calculations.js';
import {
  advanceConstructionProgress,
  updateDailyCore,
} from './simulation-rules.js';
import { renderReport } from './report-renderer.js';
import { applyRandomEvent, selectRandomEvent } from './random-events.js';
import { runTurnCadence } from './turn-cadence.js';
import { evaluateEnding } from './ending-model.js';
import { buildCompletionPresentation } from './completion-presentation.js';
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
  DAY_PICKER_CANCEL,
  DAY_PICKER_ORIGIN,
  chooseDay,
  closeDayPicker,
  createDayPicker,
  dayPickerCells,
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
// init(); listeners fire in subscription order, so this runs first and the
// renderer always reads a current `gameData`.
session.subscribe((state) => { gameData = state; });
let sheet;
let startScreen, startButton, startButtonHover, startButtonInverted;
let launchScreen, asteroidButton, asteroidButtonHover, asteroidButtonInverted, launchButton, launchButtonHover, launchButtonInverted;
let startCover;
let loadMineScreen;
let instructionsScreen, buttonOk, buttonOkHover, buttonOkInverted;
let selectAsteroidTitle;
let mineScreen, buttonInfo, buttonInfoHover, buttonInfoInverted;
let topBarCover, topBarText;
let operationsReport, operationsOk;
let menuOkButton, menuOkButtonHover,menuOkButtonInverted;
let operationsReportExtension;
let reportWorkers, reportWorkForce, reportMorale, reportWage, reportLifeSupport;
let reportFoodSupply, reportHealth, reportOccupancy, reportDeath;
let reportWorkersHighlight, reportWorkForceHighlight, reportMoraleHighlight, reportLifeSupportHighlight;
let reportFoodSupplyHighlight, reportHealthHighlight, reportOccupancyHighlight, reportDeathHighlight;
let productionReport, productionOk, productionOkButton, productionOkButtonHover, productionOkButtonInverted;
let productionReportExtension;
let reportClass, reportMines, reportProcessors, reportStorage;
let reportPower, reportDiridium, report30Day;
let reportProcessorsHighlight, reportStorageHighlight;
let reportPowerHighlight, report30DayHighlight;
let optionsMenu, optionsOk;
let optionsMenuExtension;
let saveTitle;
let saveMineScreen;
let gameOver;
let disasterModeCheck;
let gridlinesCheck;
let advanceDaysMenu;
let dayPicker = createDayPicker();
let probeNum;
let saveAutosave, save1, save2, save3;
let loadAutosave, load1, load2, load3;
let dayText;
let creditText;
let storeText;
let storeTextHighlight;
let storePrice;
let sellPrice;
let wage;
let loadCancelStart, loadCancelMine, loadCancelGameover;
let instructionsCancelStart, instructionsCancelMine;
let progressWindow, loadingBar, progressTitle;
let missionStatus1, missionStatus2;
let messageTop, messageBottom;
let questionIcon, infoIcon;
let messageTitle, messageText;
// Built at the end of init(), once every part of a dialog exists.
let dialogs;
let textureButtonDown, textureButton, textureButtonHover;
let buttonText1, buttonText2;
let inputSubtitle, inputText;
let underline, cursor;
let mapSquare; // for grid?
let clearArea, clearAreaInverted;
let smoothArea, smoothAreaGrid, smoothAreaInverted;
let roughArea, roughAreaInverted;
let oreVein, oreVeinInverted;
let motherShip, motherShipInverted;
let construction, constructionInverted;
let bulldozer, bulldozerInverted;
let diridiumMine, diridiumMineInverted;
let hydroponics, hydroponicsInverted;
let tube, tubeInverted;
let lifeSupport, lifeSupportInverted;
let quarters, quartersInverted;
let spacePort, spacePortInverted;
let powerPlant, powerPlantInverted;
let processor, processorInverted;
let sickbay, sickbayInverted;
let storage, storageInverted;
let shopButtons = [];
let shopSprites = {};
let bulldozerOn;
let diridiumMineOn;
let hydroponicsOn;
let tubeOn;
let lifeSupportOn;
let quartersOn;
let spacePortOn;
let powerPlantOn;
let processorOn;
let sickbayOn;
let storageOn;
let asteroidSurface, tileHover;
// Built at the end of init(), once the surface and every tile texture exist.
let mapView;
let newMaps = {};
let level1On, level2On, level3On;
let drawZonesOnce = false;
let upArrow, upArrowHover, upArrowInverted, downArrow, downArrowHover, downArrowInverted;
let emptySpace;
let sellDiridiumDialog;
let storageIconContainer;
let diridiumStorageTextures;
let sellAmountText, sellAmount;
let pointerDownID = -1;

// Loader
// Preload spritesheet
const loader = new PIXI.Loader();
// loader.baseUrl = 'assets/images';
// loader.add('infoIcon', 'infoIcon.gif');
loader.add('assets/spritesheet.json');

loader.onComplete.add(doneLoading);
loader.onError.add(reportError);
loader.load(); // could call a function here: .load(myfunc);

function reportError(e) {
  console.error(`ERROR: ${e.message}`);
}

function doneLoading() {
  loadFonts();
}

function loadFonts() {
  // Load bitmap fonts, loader is a method of PIXI.Application()
  app.loader.baseUrl = 'assets/fonts';
  app.loader
    .add('Palm OS', 'palm-os-bitmap-white.fnt')
    .add('Palm OS Bold', 'palm-os-bold-bitmap-white.fnt')
    .load(onFontLoaded);

  function onFontLoaded() {
    if (!PIXI.BitmapFont.available['Palm OS', 'Palm OS Bold']) {
      console.error('Required fonts did not load.');
    } else {
      setMinerSavesFromStorage().then(() => {
        init();
      });
    }
  }
}

function init() {
  // console.log('init gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);

  resetGameData();

  // console.log('init gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);


  sheet = loader.resources['assets/spritesheet.json'].spritesheet;

  // Screens
  // Start screen
  startScreen = new PIXI.Sprite.from(sheet.textures['screen start.gif']);
  startScreen.x = 0;
  startScreen.y = 0;
  app.stage.addChild(startScreen);
  // Cover start screen for launch screen
  // (allows hi score to be seen below)
  startCover = new PIXI.Graphics();
  startCover.beginFill(0xFFFFFF);
  startCover.drawRect(5, 5, 150, 120);
  startCover.endFill();
  startButton = new PIXI.Texture.from('button start.gif');
  startButtonHover = new PIXI.Texture.from('button-start-hover.gif');
  startButtonInverted = new PIXI.Texture.from('button start inverted.gif');
  // Launch Screen
  launchScreen = new PIXI.Sprite.from(sheet.textures['screen launch control.png']);
  launchScreen.x = 0;
  launchScreen.y = 0;
  asteroidButton = new PIXI.Texture.from('button asteroid.gif');
  asteroidButtonHover = new PIXI.Texture.from('button-asteroid-hover.gif');
  asteroidButtonInverted = new PIXI.Texture.from('button asteroid inverted.gif');
  launchButton = new PIXI.Texture.from('button-launch.gif');
  launchButtonHover = new PIXI.Texture.from('button-launch-hover.gif');
  launchButtonInverted = new PIXI.Texture.from('button-launch-inverted.gif');
  // Load Mine Screen
  loadMineScreen = new PIXI.Sprite.from(sheet.textures['screen load mine.gif']);
  loadMineScreen.x = 0;
  loadMineScreen.y = 13;
  buttonInfo = new PIXI.Texture.from('button info.gif');
  buttonInfoHover = new PIXI.Texture.from('button-info-hover.gif');
  buttonInfoInverted = new PIXI.Texture.from('button info inverted.gif');
  // Instructions Screen
  instructionsScreen = new PIXI.Sprite.from(sheet.textures['screen instructions.png']);
  instructionsScreen.x = 0;
  instructionsScreen.y = 0;
  buttonOk = new PIXI.Texture.from('button OK.gif');
  buttonOkHover = new PIXI.Texture.from('button-OK-hover.gif');
  buttonOkInverted = new PIXI.Texture.from('button OK inverted.gif');
  // Select Asteroid Screen
  selectAsteroidTitle = new PIXI.Sprite.from(sheet.textures['select asteroid title.gif']);
  selectAsteroidTitle.x = 5;
  selectAsteroidTitle.y = 3;

  // Game screens
  mineScreen = new PIXI.Sprite.from(sheet.textures['screen game.png']);
  mineScreen.x = 0;
  mineScreen.y = 0;

  // Reusable menu button textures
  menuOkButton = new PIXI.Texture.from('button-for-menu.gif');
  menuOkButtonHover = new PIXI.Texture.from('button-for-menu-hover.gif');
  menuOkButtonInverted = new PIXI.Texture.from('button-for-menu-inverted.gif');
  const menuButtonNineSlice = {
    leftWidth: 6,
    topHeight: 6,
    rightWidth: 6,
    bottomHeight: 6,
  };

  // Operations Report
  operationsReport = new PIXI.Sprite.from(sheet.textures['report operations.gif']);
  operationsReport.x = 5;
  operationsReport.y = 17;

  // Operations Report extension
  operationsReportExtension = new PIXI.Sprite.from(sheet.textures['window extension operations.gif']);
  operationsReportExtension.x = 104;
  operationsReportExtension.y = 47;
  // Production Report
  productionReport = new PIXI.Sprite.from(sheet.textures['report production.gif']);
  productionReport.x = 5;
  productionReport.y = 17;
  // Production Report extension
  productionReportExtension = new PIXI.Sprite.from(sheet.textures['window extension production.gif']);
  productionReportExtension.x = 104;
  productionReportExtension.y = 47;
  // Options window
  optionsMenu = new PIXI.Sprite.from(sheet.textures['screen options menu.gif']);
  optionsMenu.x = 5;
  optionsMenu.y = 17;
  // Options window extension
  optionsMenuExtension = new PIXI.Sprite.from(sheet.textures['window extension options.gif']);
  optionsMenuExtension.x = 104;
  optionsMenuExtension.y = 47;
  // optionsMenuExtension.alpha = .5;
  // Save title
  saveTitle = new PIXI.Sprite.from(sheet.textures['save mine title.gif']);
  saveTitle.x = 20;
  saveTitle.y = 7;
  // saveTitle.alpha = 0.5;
  // Save Mine Screen
  saveMineScreen = new PIXI.Sprite.from(sheet.textures['screen load mine.gif']);
  saveMineScreen.x = 0;
  saveMineScreen.y = 13;
  saveMineScreen.addChild(saveTitle);
  // Progress window
  progressWindow = new PIXI.Sprite.from(sheet.textures['progress window.gif']);
  progressWindow.x = 17;
  progressWindow.y = 65;
  // Loading bar for Progress window
  loadingBar = new PIXI.Graphics();
  loadingBar.beginFill(0x000000);
  loadingBar.drawRect(0, 0, 1, 12); // up to 112 width // (24, 87, 1, 12);
  loadingBar.endFill();
  loadingBar.x = 24;
  loadingBar.y = 87;
  // Sell Diridium dialog
  // v3.2 "Select # of days:" picker. Like the sell dialog it is never added to
  // mineScreen -- show() puts it on the stage, so its children are positioned in
  // menu-local coordinates.
  advanceDaysMenu = new PIXI.Sprite.from(sheet.textures['advance-days-menu.gif']);
  advanceDaysMenu.position.set(DAY_PICKER_ORIGIN.x, DAY_PICKER_ORIGIN.y);
  sellDiridiumDialog = new PIXI.Sprite.from(sheet.textures['sell dialog.png']);
  sellDiridiumDialog.position.set(2, 86);
  // Message
  messageTop = new PIXI.Sprite.from(sheet.textures['message top.gif']);
  messageTop.x = 0;
  messageTop.y = 0; // make this dynamic to text's maxLineHeight?
  messageBottom = new PIXI.Sprite.from(sheet.textures['message bottom.gif']);
  messageBottom.x = 0;
  messageBottom.y = 160;
  messageBottom.anchor.set(0, 1);
  // Using Texture for Buttons
  // Usage:
  // const myButton = new PIXI.Sprite(textureButton);
  textureButton = PIXI.Texture.from('message button.gif');
  textureButtonHover = PIXI.Texture.from('message button hover.gif');
  textureButtonDown = PIXI.Texture.from('message button down.gif');
  // Message icons
  infoIcon = new PIXI.Sprite.from(sheet.textures['info icon.gif']);
  infoIcon.x = 10;
  infoIcon.y = 21;
  messageTop.addChild(infoIcon);
  questionIcon = new PIXI.Sprite.from(sheet.textures['question icon.gif']);
  questionIcon.x = 10;
  questionIcon.y = 21;
  messageTop.addChild(questionIcon);
  // Game Over Screen
  gameOver = new PIXI.Sprite.from(sheet.textures['screen game over.png']);
  gameOver.x = 4;
  gameOver.y = 3;


  // Map textures
  clearArea = new PIXI.Texture.from('Clear Area.gif');
  clearAreaInverted = new PIXI.Texture.from('Clear Area inverted.gif');
  smoothArea = new PIXI.Texture.from('Smooth Area.gif');
  smoothAreaGrid = new PIXI.Texture.from('smooth-area-grid.gif');
  smoothAreaInverted = new PIXI.Texture.from('Smooth Area inverted.gif');
  roughArea = new PIXI.Texture.from('Rough Area.gif');
  roughAreaInverted = new PIXI.Texture.from('Rough Area inverted.gif');
  oreVein = new PIXI.Texture.from('Ore Vein.gif');
  oreVeinInverted = new PIXI.Texture.from('Ore Vein inverted.gif');
  motherShip = new PIXI.Texture.from('Mother Ship.gif');
  motherShipInverted = new PIXI.Texture.from('Mother Ship inverted.gif');
  construction = new PIXI.Texture.from('Construction.gif');
  constructionInverted = new PIXI.Texture.from('Construction inverted.gif');
  bulldozer = new PIXI.Texture.from('Bulldozer.gif');
  bulldozerInverted = new PIXI.Texture.from('Bulldozer inverted.gif');
  diridiumMine = new PIXI.Texture.from('Diridium Mine.gif');
  diridiumMineInverted = new PIXI.Texture.from('Diridium Mine inverted.gif');
  hydroponics = new PIXI.Texture.from('Hydroponics.gif');
  hydroponicsInverted = new PIXI.Texture.from('Hydroponics inverted.gif');
  tube = new PIXI.Texture.from('Tube.gif');
  tubeInverted = new PIXI.Texture.from('Tube inverted.gif');
  lifeSupport = new PIXI.Texture.from('Life Support.gif');
  lifeSupportInverted = new PIXI.Texture.from('Life Support inverted.gif');
  quarters = new PIXI.Texture.from('Quarters.gif');
  quartersInverted = new PIXI.Texture.from('Quarters inverted.gif');
  spacePort = new PIXI.Texture.from('Space Port.gif');
  spacePortInverted = new PIXI.Texture.from('Space Port inverted.gif');
  powerPlant = new PIXI.Texture.from('Power Plant.gif');
  powerPlantInverted = new PIXI.Texture.from('Power Plant inverted.gif');
  processor = new PIXI.Texture.from('Processor.gif');
  processorInverted = new PIXI.Texture.from('Processor inverted.gif');
  sickbay = new PIXI.Texture.from('Sickbay.gif');
  sickbayInverted = new PIXI.Texture.from('Sickbay inverted.gif');
  storage = new PIXI.Texture.from('Storage.gif');
  storageInverted = new PIXI.Texture.from('Storage inverted.gif');

  // Asteroid surface rectangle to hold tile sprites
  asteroidSurface = new PIXI.Graphics();
  asteroidSurface.beginFill(0xFFFFFF);
  asteroidSurface.drawRect(2, 15, 100, 100);
  asteroidSurface.endFill();
  mineScreen.addChild(asteroidSurface);
  tileHover = new PIXI.Sprite.from(sheet.textures['tile-hover.gif']);
  tileHover.visible = false;
  mineScreen.addChild(tileHover);

  // Sprites
  // How to import these from another doc when they need access to sheet?
  // Generic mine map sprite, can swap texture from list above
  mapSquare = new PIXI.Sprite.from(smoothArea);
  // Level sprites selected
  level1On = new PIXI.Sprite.from(sheet.textures['button level1 selected.gif']);
  level1On.position.set(115, 28);
  level1On.visible = true;
  mineScreen.addChild(level1On);
  level2On = new PIXI.Sprite.from(sheet.textures['button level2 seleced.gif']);
  level2On.position.set(130, 28);
  level2On.visible = false;
  mineScreen.addChild(level2On);
  level3On = new PIXI.Sprite.from(sheet.textures['button level3 selected.gif']);
  level3On.position.set(146, 28);
  level3On.visible = false;
  mineScreen.addChild(level3On);
  // Shop sprites selected
  bulldozerOn = new PIXI.Sprite.from(sheet.textures['button bulldozer selected.gif']);
  bulldozerOn.position.set(6, 119);
  mineScreen.addChild(bulldozerOn);
  diridiumMineOn = new PIXI.Sprite.from(sheet.textures['button mine selected.gif']);
  diridiumMineOn.position.set(22, 119);
  diridiumMineOn.visible = false;
  mineScreen.addChild(diridiumMineOn);
  hydroponicsOn = new PIXI.Sprite.from(sheet.textures['button hydroponics selected.gif']);
  hydroponicsOn.position.set(37, 119);
  hydroponicsOn.visible = false;
  mineScreen.addChild(hydroponicsOn);
  tubeOn = new PIXI.Sprite.from(sheet.textures['button tube selected.gif']);
  tubeOn.position.set(52, 119);
  tubeOn.visible = false;
  mineScreen.addChild(tubeOn);
  lifeSupportOn = new PIXI.Sprite.from(sheet.textures['button lifesupport selected.gif']);
  lifeSupportOn.position.set(67, 119);
  lifeSupportOn.visible = false;
  mineScreen.addChild(lifeSupportOn);
  quartersOn = new PIXI.Sprite.from(sheet.textures['button quarters selected.gif']);
  quartersOn.position.set(82, 119);
  quartersOn.visible = false;
  mineScreen.addChild(quartersOn);
  spacePortOn = new PIXI.Sprite.from(sheet.textures['button spaceport selected.gif']);
  spacePortOn.position.set(6, 132);
  spacePortOn.visible = false;
  mineScreen.addChild(spacePortOn);
  powerPlantOn = new PIXI.Sprite.from(sheet.textures['button powerplant selected.gif']);
  powerPlantOn.position.set(22, 132);
  powerPlantOn.visible = false;
  mineScreen.addChild(powerPlantOn);
  processorOn = new PIXI.Sprite.from(sheet.textures['button processor selected.gif']);
  processorOn.position.set(37, 132);
  processorOn.visible = false;
  mineScreen.addChild(processorOn);
  sickbayOn = new PIXI.Sprite.from(sheet.textures['button sickbay seletced.gif']);
  sickbayOn.position.set(52, 132);
  sickbayOn.visible = false;
  mineScreen.addChild(sickbayOn);
  storageOn = new PIXI.Sprite.from(sheet.textures['button storage selected.gif']);
  storageOn.position.set(67, 132);
  storageOn.visible = false;
  mineScreen.addChild(storageOn);
  shopButtons = [
    bulldozerOn,
    diridiumMineOn,
    hydroponicsOn,
    tubeOn,
    lifeSupportOn,
    quartersOn,
    spacePortOn,
    powerPlantOn,
    processorOn,
    sickbayOn,
    storageOn
  ];
  const shopHover = new PIXI.Sprite.from(sheet.textures['shop-hover.gif']);
  shopHover.visible = false;
  mineScreen.addChild(shopHover);
  const shopHoverWide = new PIXI.Sprite.from(sheet.textures['shop-hover-wide.gif']);
  shopHoverWide.visible = false;
  mineScreen.addChild(shopHoverWide);
  // Shop text highlight
  storeTextHighlight = new PIXI.Graphics();
  storeTextHighlight.beginFill(0x000000);
  storeTextHighlight.drawRect(0, 0, 59, 12);
  storeTextHighlight.endFill();
  storeTextHighlight.x = 4;
  storeTextHighlight.y = 146;
  storeTextHighlight.visible = false;
  mineScreen.addChild(storeTextHighlight);
  // Disaster Mode checkbox X. Not added here: Disaster Mode is off by default,
  // and initCheck() adds it when a save says otherwise.
  disasterModeCheck = new PIXI.Sprite.from(sheet.textures['checked.gif']);
  disasterModeCheck.x = 16;
  disasterModeCheck.y = 24;
  // Gridlines checkbox X
  gridlinesCheck = new PIXI.Sprite.from(sheet.textures['checked.gif']);
  gridlinesCheck.x = 16;
  gridlinesCheck.y = 39;
  const optionsHover = new PIXI.Sprite.from(sheet.textures['options-hover.gif']);
  optionsHover.visible = false;
  optionsMenu.addChild(optionsHover);
  // "Disaster Mode" is a longer label than the other rows, so it gets its own
  // overlay rather than a stretched one -- the artwork is pixel-exact inverted
  // text and scaling a 68px texture to 80px blurs it. Same reason shopHover and
  // shopHoverWide are a pair.
  const optionsHoverWide = new PIXI.Sprite.from(sheet.textures['options-hover-wide.gif']);
  optionsHoverWide.visible = false;
  optionsMenu.addChild(optionsHoverWide);
  // Underline for text input
  underline = new PIXI.Sprite.from(sheet.textures['underline.gif']);
  underline.position.set(6, -25);
  underline.anchor.set(0, 1);
  underline.visible = false;
  // messageBottom.addChild(underline);
  // Cursor
  cursor = new PIXI.Sprite.from(sheet.textures['cursor.gif']);
  cursor.position.set(6, -25);
  cursor.anchor.set(0, 1);
  cursor.visible = false;
  // messageBottom.addChild(cursor);
  // Arrow button textures
  upArrow = new PIXI.Texture.from('up-arrow.gif');
  upArrowHover = new PIXI.Texture.from('up-arrow-hover.gif');
  upArrowInverted = new PIXI.Texture.from('up-arrow-inverted.gif');
  downArrow = new PIXI.Texture.from('down-arrow.gif');
  downArrowHover = new PIXI.Texture.from('down-arrow-hover.gif');
  downArrowInverted = new PIXI.Texture.from('down-arrow-inverted.gif');
  // Empty space used when the normal button artwork is baked into its parent screen
  emptySpace = new PIXI.Texture.from('empty space.gif');
  const levelButtonTextures = {
    level1: {
      hover: new PIXI.Texture.from('button-level1-hover.gif'),
      down: level1On.texture,
    },
    level2: {
      hover: new PIXI.Texture.from('button-level2-hover.gif'),
      down: level2On.texture,
    },
    level3: {
      hover: new PIXI.Texture.from('button-level3-hover.gif'),
      down: level3On.texture,
    },
  };
  const advanceButtonTextures = {
    clock: {
      hover: new PIXI.Texture.from('button-advance-clock-hover.gif'),
      down: emptySpace,
    },
    1: {
      hover: new PIXI.Texture.from('button-advance1-hover.gif'),
      down: new PIXI.Texture.from('button-advance1-inverted.gif'),
    },
    7: {
      hover: new PIXI.Texture.from('button-advance7-hover.gif'),
      down: new PIXI.Texture.from('button-advance7-inverted.gif'),
    },
  };
  const reportButtonTextures = {
    operations: new PIXI.Texture.from('button-chart-inverted.gif'),
    production: new PIXI.Texture.from('button-factory-inverted.gif'),
    options: new PIXI.Texture.from('button-x-inverted.gif'),
  };
  // Sell Diridium textures by storage fill band. Pressed/on is intentionally empty.
  diridiumStorageTextures = {
    empty: {
      normal: emptySpace,
      hover: new PIXI.Texture.from('sell-diridium-hover.gif'),
      down: new PIXI.Texture.from('sell diridium inverted.gif'),
    },
    third: {
      normal: new PIXI.Texture.from('sell diridium 33.gif'),
      hover: new PIXI.Texture.from('sell-diridium-33-hover.gif'),
      down: new PIXI.Texture.from('sell diridium 33 inverted.gif'),
    },
    twoThirds: {
      normal: new PIXI.Texture.from('sell diridium 66.gif'),
      hover: new PIXI.Texture.from('sell-diridium-66-hover.gif'),
      down: new PIXI.Texture.from('sell diridium 66 inverted.gif'),
    },
    full: {
      normal: new PIXI.Texture.from('sell diridium 99.gif'),
      hover: new PIXI.Texture.from('sell-diridium-99-hover.gif'),
      down: new PIXI.Texture.from('sell diridium 99 inverted.gif'),
    },
  };
  // Operations Report highlights
  // Workers highlight
  reportWorkersHighlight = new PIXI.Graphics();
  reportWorkersHighlight.beginFill(0x000000);
  reportWorkersHighlight.drawRect(0, 0, 23, 11);
  reportWorkersHighlight.endFill();
  reportWorkersHighlight.position.set(55, 15);
  reportWorkersHighlight.visible = false;
  operationsReport.addChild(reportWorkersHighlight);
  // Workforce highlight
  reportWorkForceHighlight = new PIXI.Graphics();
  reportWorkForceHighlight.beginFill(0x000000);
  reportWorkForceHighlight.drawRect(0, 0, 23, 11);
  reportWorkForceHighlight.endFill();
  reportWorkForceHighlight.position.set(55, 26);
  reportWorkForceHighlight.visible = false;
  operationsReport.addChild(reportWorkForceHighlight);
  // Morale highlight
  reportMoraleHighlight = new PIXI.Graphics();
  reportMoraleHighlight.beginFill(0x000000);
  reportMoraleHighlight.drawRect(0, 0, 23, 11);
  reportMoraleHighlight.endFill();
  reportMoraleHighlight.position.set(55, 37);
  reportMoraleHighlight.visible = false;
  operationsReport.addChild(reportMoraleHighlight);
  // Life support highlight
  reportLifeSupportHighlight = new PIXI.Graphics();
  reportLifeSupportHighlight.beginFill(0x000000);
  reportLifeSupportHighlight.drawRect(0, 0, 23, 11);
  reportLifeSupportHighlight.endFill();
  reportLifeSupportHighlight.position.set(55, 59);
  reportLifeSupportHighlight.visible = false;
  operationsReport.addChild(reportLifeSupportHighlight);
  // Food supply highlight
  reportFoodSupplyHighlight = new PIXI.Graphics();
  reportFoodSupplyHighlight.beginFill(0x000000);
  reportFoodSupplyHighlight.drawRect(0, 0, 23, 11);
  reportFoodSupplyHighlight.endFill();
  reportFoodSupplyHighlight.position.set(55, 70);
  reportFoodSupplyHighlight.visible = false;
  operationsReport.addChild(reportFoodSupplyHighlight);
  // Health highlight
  reportHealthHighlight = new PIXI.Graphics();
  reportHealthHighlight.beginFill(0x000000);
  reportHealthHighlight.drawRect(0, 0, 23, 11);
  reportHealthHighlight.endFill();
  reportHealthHighlight.position.set(55, 81);
  reportHealthHighlight.visible = false;
  operationsReport.addChild(reportHealthHighlight);
  // Occupancy highlight
  reportOccupancyHighlight = new PIXI.Graphics();
  reportOccupancyHighlight.beginFill(0x000000);
  reportOccupancyHighlight.drawRect(0, 0, 23, 11);
  reportOccupancyHighlight.endFill();
  reportOccupancyHighlight.position.set(55, 92);
  reportOccupancyHighlight.visible = false;
  operationsReport.addChild(reportOccupancyHighlight);
  // Death rate highlight
  reportDeathHighlight = new PIXI.Graphics();
  reportDeathHighlight.beginFill(0x000000);
  reportDeathHighlight.drawRect(0, 0, 23, 11);
  reportDeathHighlight.endFill();
  reportDeathHighlight.position.set(55, 103);
  reportDeathHighlight.visible = false;
  operationsReport.addChild(reportDeathHighlight);
  // Production Report Highlights
  // Processors
  reportProcessorsHighlight = new PIXI.Graphics();
  reportProcessorsHighlight.beginFill(0x000000);
  reportProcessorsHighlight.drawRect(0, 0, 23, 11);
  reportProcessorsHighlight.endFill();
  reportProcessorsHighlight.position.set(50, 41);
  reportProcessorsHighlight.visible = false;
  productionReport.addChild(reportProcessorsHighlight);
  // Storage
  reportStorageHighlight = new PIXI.Graphics();
  reportStorageHighlight.beginFill(0x000000);
  reportStorageHighlight.drawRect(0, 0, 23, 11);
  reportStorageHighlight.endFill();
  reportStorageHighlight.position.set(50, 53);
  reportStorageHighlight.visible = false;
  productionReport.addChild(reportStorageHighlight);
  // Power
  reportPowerHighlight = new PIXI.Graphics();
  reportPowerHighlight.beginFill(0x000000);
  reportPowerHighlight.drawRect(0, 0, 23, 11);
  reportPowerHighlight.endFill();
  reportPowerHighlight.position.set(50, 65);
  reportPowerHighlight.visible = false;
  productionReport.addChild(reportPowerHighlight);
  // 30Day
  report30DayHighlight = new PIXI.Graphics();
  report30DayHighlight.beginFill(0x000000);
  report30DayHighlight.drawRect(0, 0, 23, 11);
  report30DayHighlight.endFill();
  report30DayHighlight.position.set(50, 89);
  report30DayHighlight.visible = false;
  productionReport.addChild(report30DayHighlight);


  // Text
  // Launch Screen Probes
  probeNum = new PIXI.BitmapText(gameData.probes, regular);
  probeNum.x = 44;
  probeNum.y = 127;
  launchScreen.addChild(probeNum);
  // Game Screen Text
  // Day text
  dayText = new PIXI.BitmapText(gameData.day.toString(), barText);
  dayText.x = 24;
  dayText.y = 2;
  mineScreen.addChild(dayText);
  // Mapping... Updating... top bar text
  topBarText = new PIXI.BitmapText('Mapping...', barText);
  topBarText.position.set(3, 2);
  // Cover for top bar
  topBarCover = new PIXI.Graphics();
  topBarCover.beginFill(0x000000);
  topBarCover.drawRect(0, 0, 146, 15);
  topBarCover.endFill();
  topBarCover.addChild(topBarText);
  topBarCover.visible = false;
  mineScreen.addChild(topBarCover);
  // Operations Report text
  reportWorkers = new PIXI.BitmapText('20(0)', regular); // gameData.workers
  reportWorkers.position.set(55, 15);
  operationsReport.addChild(reportWorkers);
  reportWorkForce = new PIXI.BitmapText('100%', regular);
  reportWorkForce.position.set(55, 26);
  operationsReport.addChild(reportWorkForce);
  reportMorale = new PIXI.BitmapText('100%(0)', regular);
  reportMorale.position.set(55, 37);
  operationsReport.addChild(reportMorale);
  reportWage = new PIXI.BitmapText(gameData.wage.toString(), regular);
  reportWage.position.set(55, 48);
  operationsReport.addChild(reportWage);
  reportLifeSupport = new PIXI.BitmapText('100%', regular);
  reportLifeSupport.position.set(55, 59);
  operationsReport.addChild(reportLifeSupport);
  reportFoodSupply = new PIXI.BitmapText('---', regular);
  reportFoodSupply.position.set(55, 70);
  operationsReport.addChild(reportFoodSupply);
  reportHealth = new PIXI.BitmapText('---', regular);
  reportHealth.position.set(55, 81);
  operationsReport.addChild(reportHealth);
  reportOccupancy = new PIXI.BitmapText('---', regular);
  reportOccupancy.position.set(55, 92);
  operationsReport.addChild(reportOccupancy);
  reportDeath = new PIXI.BitmapText('0%', regular);
  reportDeath.position.set(55, 103);
  operationsReport.addChild(reportDeath);
  // Production Report text
  reportClass = new PIXI.BitmapText('', regular);
  reportClass.position.set(50, 17);
  productionReport.addChild(reportClass);
  reportMines = new PIXI.BitmapText('0', regular);
  reportMines.position.set(50, 29);
  productionReport.addChild(reportMines);
  reportProcessors = new PIXI.BitmapText('None', regular);
  reportProcessors.position.set(50, 41);
  productionReport.addChild(reportProcessors);
  reportStorage = new PIXI.BitmapText('0%', regular);
  reportStorage.position.set(50, 53);
  productionReport.addChild(reportStorage);
  reportPower = new PIXI.BitmapText('100%', regular);
  reportPower.position.set(50, 65);
  productionReport.addChild(reportPower);
  reportDiridium = new PIXI.BitmapText('0 tons', regular);
  reportDiridium.position.set(50, 77);
  productionReport.addChild(reportDiridium);
  report30Day = new PIXI.BitmapText('0', regular);
  report30Day.position.set(50, 89);
  productionReport.addChild(report30Day);
  // Progress Window text
  progressTitle = new PIXI.BitmapText('Preparing Mining Colony...', regular);
  progressTitle.x = 8;
  progressTitle.y = 8;
  progressWindow.addChild(progressTitle);
  // Credits text
  creditText = new PIXI.BitmapText(gameData.credits.toString(), barText);
  creditText.x = 91;
  creditText.y = 2;
  mineScreen.addChild(creditText);
  // Store text
  storeText = new PIXI.BitmapText(gameData.shopBtn.toString(), regular);
  storeText.position.set(34, 146);
  storeText.anchor.set(.5, 0);
  mineScreen.addChild(storeText);
  // Store price
  storePrice = new PIXI.BitmapText(gameData.shopPrice.toString(), regular);
  storePrice.position.set(82, 146);
  storePrice.anchor.set(.5, 0);
  mineScreen.addChild(storePrice);
  // Diridium text
  sellPrice = new PIXI.BitmapText(gameData.sellPrice.toString(), regular);
  sellPrice.position.set(128, 115);
  sellPrice.anchor.set(.5, 0);
  mineScreen.addChild(sellPrice);
  // Sell Diridium Dialog text
  sellAmountText = new PIXI.BitmapText(gameData.diridium.toString(), regular);
  sellAmountText.position.set(47, 26);
  sellAmountText.anchor.set(.5, 0);
  sellDiridiumDialog.addChild(sellAmountText);
  // Wage text
  wage = new PIXI.BitmapText(gameData.wage.toString(), regular);
  wage.position.set(128, 144);
  wage.anchor.set(.5, 0);
  mineScreen.addChild(wage);
  // Game Over
  missionStatus1 = new PIXI.BitmapText('', regular);
  missionStatus1.x = 75; //6; //app.stage.width / 2; //80;//8;
  missionStatus1.y = 37;
  // missionStatus1.align = 'center';
  missionStatus1.anchor.set(0.5, 0);
  gameOver.addChild(missionStatus1);
  missionStatus2 = new PIXI.BitmapText('', regular);
  missionStatus2.x = 75; //20;
  missionStatus2.y = 52;
  // missionStatus2.align = 'center';
  missionStatus2.anchor.set(0.5, 0);
  gameOver.addChild(missionStatus2);
  // Message Title text
  messageTitle = new PIXI.BitmapText('Message', barText);
  messageTitle.x = 80;
  messageTitle.y = 1;
  messageTitle.anchor.set(.5, 0);
  messageTop.addChild(messageTitle);
  // Message text
  messageText = new PIXI.BitmapText('(message here)', bold);
  messageText.x = 34;
  messageText.y = 21;
  // maxWidth is The max width of the text before line wrapping!!!
  messageText.maxWidth = 122;
  messageTop.addChild(messageText);
  // Input Subtitle
  inputSubtitle = new PIXI.BitmapText('Please enter a comment:', regular);
  inputSubtitle.position.set(6, 16);
  inputSubtitle.visible = false;
  messageTop.addChild(inputSubtitle);
  // Input text
  inputText = new PIXI.BitmapText('', regular);
  inputText.position.set(6, -25);
  inputText.anchor.set(0, 1);
  inputText.visible = false;
  // messageBottom.addChild(inputText);
  // Button text
  buttonText1 = new PIXI.BitmapText('', regular);
  buttonText2 = new PIXI.BitmapText('', regular);


  // Hitzones and Sprite Buttons
  // Start Screen
  // New Mine button
  buildTextButton(startScreen, 62, 14, 49, 74, startButton, startButtonHover, startButtonInverted, newMine, 'New Mine');
  // Launch Screen's Up arrow
  const moreProbesPointerDown = () => { if (addProbe(gameData.probes) !== null) return true; };
  const moreProbesPointerUp = () => {
    const probes = addProbe(gameData.probes);
    if (probes !== null) session.update({ probes });
  };
  const moreProbesButton = { width: 13, height: 6, x: 64, y: 126 };
  const moreProbesHitzone = { width: 18, height: 7, x: 63, y: 125 }
  buildSpriteButton(launchScreen, moreProbesButton, moreProbesHitzone, upArrow, upArrowHover, upArrowInverted, moreProbesPointerDown, moreProbesPointerUp);
  // Launch Screen's Down arrow
  const lessProbesPointerDown = () => { if (removeProbe(gameData.probes) !== null) return true; };
  const lessProbesPointerUp = () => {
    const probes = removeProbe(gameData.probes);
    if (probes !== null) session.update({ probes });
  };
  const lessProbesButton = { width: 13, height: 6, x: 64, y: 133 };
  const lessProbesHitzone = { width: 18, height: 7, x: 63, y: 133 }
  buildSpriteButton(launchScreen, lessProbesButton, lessProbesHitzone, downArrow, downArrowHover, downArrowInverted, lessProbesPointerDown, lessProbesPointerUp);
  // Launch Screen's Launch button
  // buildHitzone(launchScreen, 43, 15, 85, 125, launchProbes); // Commenting out hitzone to use text button instead
  buildTextButton(launchScreen, 43, 15, 85, 125, launchButton, launchButtonHover, launchButtonInverted, launchProbes, 'Launch');
  // Launch Screen's Cancel button
  // buildHitzone(launchScreen, 40, 15, 104, 125, () => remove(launchScreen, startScreen));
  // Load Mine button
  buildTextButton(startScreen, 62, 14, 49, 91, startButton, startButtonHover, startButtonInverted, () => show(loadMineScreen, startScreen), 'Load Mine');
  // Load slots
  // This can appear in 3 places: startScreen, mineScreen, gameOver
  // So we'll close them all in the correct order (what happens if you close something that's not on stage? It seems OK.)
  const loadClosingFunctions = [
    loadMineScreen,
    closeLoadOptions,
    closeOptions,
    closeGameOverLoad,
    () => gotoMineScreen(true)
  ];
  loadAutosave = buildTextButton(loadMineScreen, 86, 15, 11, 30, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => load('autoSave', ...loadClosingFunctions), minerSaves.autoSave.name, regular, menuButtonNineSlice).children[0];
  load1 = buildTextButton(loadMineScreen, 86, 15, 11, 50, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => load('save1', ...loadClosingFunctions), minerSaves.save1.name, regular, menuButtonNineSlice).children[0];
  load2 = buildTextButton(loadMineScreen, 86, 15, 11, 70, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => load('save2', ...loadClosingFunctions), minerSaves.save2.name, regular, menuButtonNineSlice).children[0];
  load3 = buildTextButton(loadMineScreen, 86, 15, 11, 90, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => load('save3', ...loadClosingFunctions), minerSaves.save3.name, regular, menuButtonNineSlice).children[0];
  // Load Mine Screen's Cancel button
  loadCancelStart = buildTextButton(loadMineScreen, 42, 13, 33, 123, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => remove(loadMineScreen, startScreen), 'Cancel');
  // Instructions button
  buildTextButton(startScreen, 62, 14, 49, 108, startButton, startButtonHover,startButtonInverted, () => show(instructionsScreen, startScreen), 'Instructions');
  // Instructions Screen's OK button
  instructionsCancelStart = buildTextButton(instructionsScreen, 48, 13, 56, 141, buttonOk, buttonOkHover, buttonOkInverted, () => remove(instructionsScreen, startScreen), 'OK');
  //
  // Mine Screen
  // Top bar info icon opens instructions screen
  buildSpriteButton(mineScreen, { width: 10, height: 11, x: 147, y: 2 }, { width: 16, height: 15, x: 145, y: 0 }, emptySpace, buttonInfoHover, buttonInfoInverted, () => true, showMineScreenInstructions);
  // Instructions Screen's Cancel button for mineScreen
  instructionsCancelMine = buildTextButton(instructionsScreen, 48, 13, 56, 141, buttonOk, buttonOkHover, buttonOkInverted, closeMineScreenInstructions, 'OK');
  // Hide this butotn except in the mineScreen
  instructionsCancelMine.visible = false;
  // Asteroid surface hitzones are added by mapView.buildHitZones()
  // Level buttons use transparent normal sprites because their normal artwork is baked into mineScreen.
  const levelButtons = [
    {
      level: 'level1',
      button: { width: 12, height: 11, x: 115, y: 28 },
      hitzone: { width: 14, height: 13, x: 114, y: 27 },
    },
    {
      level: 'level2',
      button: { width: 13, height: 11, x: 130, y: 28 },
      hitzone: { width: 15, height: 13, x: 129, y: 27 },
    },
    {
      level: 'level3',
      button: { width: 13, height: 11, x: 146, y: 28 },
      hitzone: { width: 15, height: 13, x: 145, y: 27 },
    },
  ];

  levelButtons.forEach(({ level, button, hitzone }) => {
    const { hover, down } = levelButtonTextures[level];
    buildSpriteButton(
      mineScreen,
      button,
      hitzone,
      emptySpace,
      hover,
      down,
      () => true,
      () => showLevel(level),
    );
  });

  // Report and Options buttons show hover artwork only while hovering.
  // Their normal and pressed artwork is baked into mineScreen, so those sprites are transparent.
  const reportButtons = [
    {
      id: 'operations',
      button: { width: 12, height: 11, x: 115, y: 57 },
      hitzone: { width: 14, height: 13, x: 114, y: 56 },
      action: showOperationsReport,
    },
    {
      id: 'production',
      button: { width: 13, height: 11, x: 130, y: 57 },
      hitzone: { width: 15, height: 13, x: 129, y: 56 },
      action: showProductionReport,
    },
    {
      id: 'options',
      button: { width: 12, height: 11, x: 146, y: 57 },
      hitzone: { width: 15, height: 13, x: 145, y: 56 },
      action: showOptions,
    },
  ];

  reportButtons.forEach(({ id, button, hitzone, action }) => {
    const hover = reportButtonTextures[id];
    buildSpriteButton(
      mineScreen,
      button,
      hitzone,
      emptySpace,
      hover,
      emptySpace,
      () => true,
      action,
    );
  });

  // Operations Report OK button
  // buildHitzone(operationsReport, 42, 13, 28, 119, closeOperationsReport);
  // Example of converting a buildHitzone to a buildTextButton. The buildHitzone above is commented out and replaced with the buildTextButton below. The parameters are the same except for the button textures and the text label.
  // The reusable button sprite variables are: menuOkButton, menuOkButtonHover, menuOkButtonInverted
  operationsOk = buildTextButton(operationsReport, 42, 13, 28, 119, menuOkButton, menuOkButtonHover, menuOkButtonInverted, closeOperationsReport, 'OK');
  // operationsOk.visible = true; // Do I need this? Doesn't look like it. The button is visible by default.

  // Production Report OK button
  // buildHitzone(productionReport, 42, 13, 28, 119, closeProductionReport);
  productionOk = buildTextButton(productionReport, 42, 13, 28, 119, menuOkButton, menuOkButtonHover, menuOkButtonInverted, closeProductionReport, 'OK');

  // Options Window controls
  // Disaster Mode
  buildHoverHitzone(optionsMenu, optionsHoverWide, { width: 80, height: 15, x: 11, y: 21 }, { width: 65, height: 11, x: 15, y: 23 }, () => {
    if (gameData.disasterMode) {
      toggleCheck('disasterMode');
      return;
    }
    // Confirmed on the way in only: enabling raises the disaster rate for the
    // rest of the run and makes it unranked, which the player should agree to.
    dialogs.confirm(optionsMenu, 'Disaster Mode raises the chance of disasters for the rest of this colony, and its score will not be recorded. Enable it?', () => {
      toggleCheck('disasterMode');
    }, doNothing);
  });
  // Gridlines
  buildHoverHitzone(optionsMenu, optionsHover, { width: 68, height: 15, x: 11, y: 36 }, { width: 65, height: 11, x: 15, y: 38 }, () => {
    toggleCheck('gridlinesEnabled');
    mapView.draw(gameData.maps[gameData.level]);
  });
  // Save mine
  buildHoverHitzone(optionsMenu, optionsHover, { width: 68, height: 15, x: 11, y: 51 }, { width: 65, height: 11, x: 15, y: 53 }, () => {
    show(saveMineScreen, optionsMenu);
    show(optionsMenuExtension);
  });
  // Save slots
  const saveClosingFunctions = [
    true,
    saveMineScreen,
    () => remove(saveMineScreen, optionsMenu),
    closeOptions
  ];
  saveAutosave = buildTextButton(saveMineScreen, 86, 15, 11, 30, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => save('autoSave', ...saveClosingFunctions), minerSaves.autoSave.name, regular, menuButtonNineSlice).children[0];
  save1 = buildTextButton(saveMineScreen, 86, 15, 11, 50, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => save('save1', ...saveClosingFunctions), minerSaves.save1.name, regular, menuButtonNineSlice).children[0];
  save2 = buildTextButton(saveMineScreen, 86, 15, 11, 70, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => save('save2', ...saveClosingFunctions), minerSaves.save2.name, regular, menuButtonNineSlice).children[0];
  save3 = buildTextButton(saveMineScreen, 86, 15, 11, 90, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => save('save3', ...saveClosingFunctions), minerSaves.save3.name, regular, menuButtonNineSlice).children[0];
  // Cancel button
  buildTextButton(saveTitle, 42, 13, 13, 116, menuOkButton, menuOkButtonHover, menuOkButtonInverted, () => remove(saveMineScreen, optionsMenu), 'Cancel');
  // Load mine
  buildHoverHitzone(optionsMenu, optionsHover, { width: 68, height: 15, x: 11, y: 66 }, { width: 65, height: 11, x: 15, y: 68 }, showLoadOptions);
  // Cancel button
  loadCancelMine = buildTextButton(loadMineScreen, 42, 13, 33, 123, menuOkButton, menuOkButtonHover, menuOkButtonInverted, closeLoadOptions, 'Cancel');
  // Disable this hitzone except in the mineScreen
  loadCancelMine.interactive = false;
  // Exit & Save
  buildHoverHitzone(optionsMenu, optionsHover, { width: 68, height: 15, x: 11, y: 81 }, { width: 65, height: 11, x: 15, y: 83 }, exitAndSave);
  // Resign
  buildHoverHitzone(optionsMenu, optionsHover, { width: 68, height: 15, x: 11, y: 96 }, { width: 65, height: 11, x: 15, y: 98 }, endGame);
  // OK button
  // buildHitzone(optionsMenu, 42, 13, 28, 119, closeOptions);
  optionsOk = buildTextButton(optionsMenu, 42, 13, 28, 119, menuOkButton, menuOkButtonHover, menuOkButtonInverted, closeOptions, 'OK');

  // Advance buttons also use transparent normal sprites over the baked-in artwork.
  const advanceButtons = [
    {
      days: 'clock',
      button: { width: 12, height: 11, x: 115, y: 86 },
      hitzone: { width: 14, height: 13, x: 114, y: 85 },
    },
    {
      days: 1,
      button: { width: 13, height: 11, x: 130, y: 86 },
      hitzone: { width: 15, height: 13, x: 129, y: 85 },
    },
    {
      days: 7,
      button: { width: 13, height: 11, x: 146, y: 86 },
      hitzone: { width: 15, height: 13, x: 145, y: 85 },
    },
  ];

  advanceButtons.forEach(({ days, button, hitzone }) => {
    const { hover, down } = advanceButtonTextures[days];
    buildSpriteButton(
      mineScreen,
      button,
      hitzone,
      emptySpace,
      hover,
      down,
      () => true,
      () => (days === 'clock' ? showAdvanceDaysMenu() : advance(days)),
    );
  });

  // The twenty day cells. Geometry comes from scripts/day-picker.js so there is
  // not a single coordinate literal here -- the layout is asserted in that
  // module's tests, which is the only way to cover generated UI given the
  // source-text matchers that guard the rest of this file.
  dayPickerCells().forEach(({ day, button, hitzone }) => {
    buildSpriteButton(
      advanceDaysMenu,
      button,
      hitzone,
      emptySpace,
      new PIXI.Texture.from(`advance-${day}-hover.gif`),
      new PIXI.Texture.from(`advance-${day}-inverted.gif`),
      () => true,
      () => {
        const { state, choice } = chooseDay(dayPicker, day);
        dayPicker = state;
        if (choice === null) return;
        hideAdvanceDaysMenu();
        advance(choice);
      },
    );
  });

  // Positioned over the grey button painted into the artwork, which comes out
  // of the sprite once the overlay is confirmed to line up.
  buildTextButton(
    advanceDaysMenu,
    DAY_PICKER_CANCEL.width,
    DAY_PICKER_CANCEL.height,
    DAY_PICKER_CANCEL.x,
    DAY_PICKER_CANCEL.y,
    menuOkButton,
    menuOkButtonHover,
    menuOkButtonInverted,
    hideAdvanceDaysMenu,
    'Cancel',
  );
  // Container for the Diridium Storage Button
  storageIconContainer = new PIXI.Container();
  mineScreen.addChild(storageIconContainer);
  storageIconContainer.position.set(146, 114);
  updateDiridiumStorageIcon();
  // Sell Diridium Dialog
  // Up Arrow
  const diridiumSpeed = 100;
  const diridiumUpButton = { width: 13, height: 6, x: 81, y: 25 };
  const diridiumUpHitzone = { width: 18, height: 7, x: 80, y: 24 };
  const diridiumIncreaseReleased = () => {
    if (pointerDownID !== -1) {
      clearInterval(pointerDownID);
      pointerDownID = -1;
    }
  };
  const whileDiridiumIncrease = () => {
    sellAmountText.text = sellAmount = increaseSellAmount(sellAmount, {
      diridium: gameData.diridium,
      hasSpacePort: countBuildingsByName('Space Port') > 0,
    });
  };

  const diridiumIncreasePressed = () => {
    if (pointerDownID === -1) pointerDownID = setInterval(whileDiridiumIncrease, diridiumSpeed);
    return true;
  };

  buildSpriteButton(sellDiridiumDialog, diridiumUpButton, diridiumUpHitzone, upArrow, upArrowHover, upArrowInverted, diridiumIncreasePressed, diridiumIncreaseReleased, diridiumIncreaseReleased);
  // Down Arrow
  const diridiumDownButton = { width: 13, height: 6, x: 81, y: 32 };
  const diridiumDownHitzone = { width: 18, height: 7, x: 80, y: 32 };
  const diridiumDecreaseReleased = () => {
    if (pointerDownID !== -1) {
      clearInterval(pointerDownID);
      pointerDownID = -1;
    }
  };
  const whileDiridiumDecrease = () => {
    sellAmountText.text = sellAmount = decreaseSellAmount(sellAmount);
  };
  const diridiumDecreasePressed = () => {
    if (pointerDownID === -1) pointerDownID = setInterval(whileDiridiumDecrease, diridiumSpeed);
    return true;
  };
  buildSpriteButton(sellDiridiumDialog, diridiumDownButton, diridiumDownHitzone, downArrow, downArrowHover, downArrowInverted, diridiumDecreasePressed, diridiumDecreaseReleased, diridiumDecreaseReleased);
  // Sell
  const sellDialogSellHover = new PIXI.Texture.from('sell-dialog-sell-hover.gif');
  const sellDialogSellInverted = new PIXI.Texture.from('sell dialog sell inverted.gif');
  const sellDialogSellButton = { width: 43, height: 15, x: 8, y: 40 };
  const sellDialogSellHitzone = { width: 43, height: 15, x: 8, y: 40 };
  const sellPointerDown = () => true;
  const sellPointerUp = () => {
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
  };
  buildSpriteButton(sellDiridiumDialog, sellDialogSellButton, sellDialogSellHitzone, emptySpace, sellDialogSellHover, sellDialogSellInverted, sellPointerDown, sellPointerUp);
  // Cancel
  const sellDialogCancelHover = new PIXI.Texture.from('sell-dialog-cancel-hover.gif');
  const sellDialogCancelInverted = new PIXI.Texture.from('sell dialog cancel inverted.gif');
  const cancelDialogSellButton = { width: 44, height: 15, x: 54, y: 40 };
  const cancelDialogSellHitzone = { width: 44, height: 15, x: 54, y: 40 };
  const cancelPointerDown = () => true;
  const cancelPointerUp = () => remove(sellDiridiumDialog, mineScreen);
  buildSpriteButton(sellDiridiumDialog, cancelDialogSellButton, cancelDialogSellHitzone, emptySpace, sellDialogCancelHover, sellDialogCancelInverted, cancelPointerDown, cancelPointerUp);
  // Change Wage
  // Increase wage
  const wageUpPointerDown = () => { if (canRaiseWage(gameData.wage, gameData.wageMax)) return true; };
  const wageUpPointerUp = () => {
    // Both labels are derived: renderMineScreenFromState() sets the control-row
    // wage, and updateReports() sets the one on the Operations report.
    const wage = raiseWage(gameData.wage, gameData.wageMax);
    if (wage !== null) session.update({ wage });
  };
  const wageUpButton = { width: 13, height: 6, x: 146, y: 143 };
  const wageUpHitzone = { width: 15, height: 7, x: 145, y: 142 };
  buildSpriteButton(mineScreen, wageUpButton, wageUpHitzone, upArrow, upArrowHover, upArrowInverted, wageUpPointerDown, wageUpPointerUp);
  // Decrease wage
  const wageDownPointerDown = () => { if (canLowerWage(gameData.wage)) return true; };
  const wageDownPointerUp = () => {
    const wage = lowerWage(gameData.wage);
    if (wage !== null) session.update({ wage });
  };
  const wageDownButton = { width: 13, height: 6, x: 146, y: 150 };
  const wageDownHitzone = { width: 15, height: 7, x: 145, y: 150 };
  buildSpriteButton(mineScreen, wageDownButton, wageDownHitzone, downArrow, downArrowHover, downArrowInverted, wageDownPointerDown, wageDownPointerUp);
  // Shop Buttons
  const shopItemButtons = [
    { sprite: bulldozerOn, id: 'bulldozer', width: 15, x: 6, y: 119 },
    { sprite: diridiumMineOn, id: 'diridiumMine', width: 14, x: 22, y: 119 },
    { sprite: hydroponicsOn, id: 'hydroponics', width: 14, x: 37, y: 119 },
    { sprite: tubeOn, id: 'tube', width: 14, x: 52, y: 119 },
    { sprite: lifeSupportOn, id: 'lifeSupport', width: 14, x: 67, y: 119 },
    { sprite: quartersOn, id: 'quarters', width: 14, x: 82, y: 119 },
    { sprite: spacePortOn, id: 'spacePort', width: 15, x: 6, y: 132 },
    { sprite: powerPlantOn, id: 'powerPlant', width: 14, x: 22, y: 132 },
    { sprite: processorOn, id: 'processor', width: 14, x: 37, y: 132 },
    { sprite: sickbayOn, id: 'sickbay', width: 14, x: 52, y: 132 },
    { sprite: storageOn, id: 'storage', width: 14, x: 67, y: 132 },
  ];
  shopSprites = Object.fromEntries(shopItemButtons.map(({ sprite, id }) => [id, sprite]));
  shopItemButtons.forEach(({ sprite, id, width, x, y }) => {
    const hoverSprite = width === 15 ? shopHoverWide : shopHover;
    buildHoverHitzone(mineScreen, hoverSprite, { width, height: 12, x, y }, { width, height: 12, x, y }, () => shop(id));
  });
  buildHoverHitzone(mineScreen, shopHover, { width: 14, height: 12, x: 82, y: 132 }, { width: 14, height: 12, x: 82, y: 132 }, undo);
  //
  // Game Over Screen
  // New Mine
  buildTextButton(gameOver, 48, 14, 17, 93, menuOkButton, menuOkButtonHover, menuOkButtonInverted, gameOverNewMine, 'New Mine', regular, menuButtonNineSlice);
  // Load Mine
  buildTextButton(gameOver, 49, 14, 86, 93, menuOkButton, menuOkButtonHover, menuOkButtonInverted, showGameOverLoad, 'Load Mine', regular, menuButtonNineSlice);
  // Cancel button
  loadCancelGameover = buildTextButton(loadMineScreen, 42, 13, 33, 123, menuOkButton, menuOkButtonHover, menuOkButtonInverted, closeGameOverLoad, 'Cancel');
  // Disable this hitzone except in the gameOver screen
  loadCancelGameover.interactive = false;

  // Quit
  buildTextButton(gameOver, 42, 14, 55, 110, menuOkButton, menuOkButtonHover, menuOkButtonInverted, quit, 'Quit');

  // Variables
  dialogs = createDialogService({
    showMessage,
    showConfirmation,
    showInput,
    // The sixteen positional arguments message.js draws a dialog from. Passed
    // once, here, rather than spread into every call.
    parts: [app, messageTop, questionIcon, infoIcon, messageTitle, messageBottom, messageText, inputSubtitle, inputText, textureButton, textureButtonHover, textureButtonDown, underline, cursor, buttonText1, buttonText2],
    screen: mineScreen,
  });

  mapView = createMapView({
    PIXI,
    surface: asteroidSurface,
    textures: {
      clearArea, clearAreaInverted,
      smoothArea, smoothAreaGrid, smoothAreaInverted,
      roughArea, roughAreaInverted,
      oreVein, oreVeinInverted,
      motherShip, motherShipInverted,
      construction, constructionInverted,
      bulldozer, bulldozerInverted,
      diridiumMine, diridiumMineInverted,
      hydroponics, hydroponicsInverted,
      tube, tubeInverted,
      lifeSupport, lifeSupportInverted,
      quarters, quartersInverted,
      spacePort, spacePortInverted,
      powerPlant, powerPlantInverted,
      processor, processorInverted,
      sickbay, sickbayInverted,
      storage, storageInverted,
    },
    // An accessor, not a value: the gridlines toggle redraws the live map and
    // the view is never rebuilt, so the flag has to be read at draw time.
    gridlinesEnabled: () => gameData.gridlinesEnabled,
  });

  // Only now that every sprite exists is it safe to redraw from state. init()
  // resets the colony at its very top, which is why this is not subscribed
  // alongside the reference-syncing listener at module load.
  session.subscribe(renderMineScreenFromState);

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
    show(launchScreen, startScreen);
  }
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

  asteroids.forEach(({ label, designation }, i) => {
    buildTextButton(selectAsteroidTitle, 59, 17, 4, 20 * i + 29, asteroidButton, asteroidButtonHover, asteroidButtonInverted, () => pickAsteroid(i), `Asteroid ${designation}`);
    addDifficultyText(label, i);
  });

  function addDifficultyText(label, i) {
    let txt = new PIXI.BitmapText(label, regular);
    txt.x = 67;
    txt.y = i * 20 + 32;
    selectAsteroidTitle.addChild(txt);
  }

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

  updateLevelButtons(newLevel);

  updateMineSurface('Mapping...', newLevel, gameData.maps)
  // console.log('showLevel gameData.maps: ', gameData.maps);
}

function updateLevelButtons(level) {
  // console.log('updateLevelButtons, level:', level);

  // Change which level button is active
  level1On.visible = level === 'level1' ? true : false;
  level2On.visible = level === 'level2' ? true : false;
  level3On.visible = level === 'level3' ? true : false;
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


/**
 * Rebuilds every part of the mine screen that is derived from `gameData`.
 *
 * This is the one seam between saved state and what is on screen. A new colony
 * and a loaded one both come through here, so a field added to `gameDataInit`
 * has exactly one place it has to be applied.
 *
 * That was not true before. Each path re-applied its own hand-picked subset, and
 * two fields fell through the gap on the same day: the shop selection came back
 * as a caption without the sprites that draw it, and the saved level was drawn
 * over with level 1. Neither path was wrong on its own terms -- each was wrong
 * about what the other had already done, which is the failure this removes.
 *
 * It deliberately does not own the asteroid surface. Drawing that is a
 * transition rather than a render: it animates, it takes a level and a
 * clear-first flag that only the caller knows, and it writes `gameData.level`
 * back when it lands. `gotoMineScreen()` owns it.
 */
function renderMineScreenFromState() {
  // Options
  initCheck(disasterModeCheck, 'disasterMode', optionsMenu);
  initCheck(gridlinesCheck, 'gridlinesEnabled', optionsMenu);

  // Status bar, shop caption, and the control rows
  probeNum.text = gameData.probes;
  dayText.text = gameData.day.toString();
  creditText.text = gameData.credits.toString();
  storeText.text = gameData.shopBtn;
  storePrice.text = gameData.shopPrice.toString();
  sellPrice.text = gameData.sellPrice.toString();
  wage.text = gameData.wage.toString();

  // Sprite state the text does not carry. Both of these used to be applied by
  // whichever entry path happened to run, which is how they came to disagree.
  restoreShopSelection();
  updateLevelButtons(gameData.level);

  // Reports read the maps, and carry the diridium storage icon with them.
  updateReports(0);

  function initCheck(sprite, data, parent) {
    if (gameData[data]) parent.addChild(sprite);
    else parent.removeChild(sprite);
  }
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

      switch (slot) {
        case 'autoSave':
          saveAutosave.text = minerSaves.autoSave.name;
          loadAutosave.text = minerSaves.autoSave.name;
          return;
        case 'save1':
          save1.text = minerSaves.save1.name;
          load1.text = minerSaves.save1.name;
          return;
        case 'save2':
          save2.text = minerSaves.save2.name;
          load2.text = minerSaves.save2.name;
          return;
        case 'save3':
          save3.text = minerSaves.save3.name;
          load3.text = minerSaves.save3.name;
          return;
      }
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
  updateReports(days);
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

function updateReports() {
  const buildingCounts = countCompletedBuildingsByName(gameData.maps, buildingMap);
  const operationsViewModel = calculateOperationsReport(gameData);
  const productionViewModel = calculateProductionReport(gameData, buildingCounts);

  renderReport(operationsViewModel, {
    workers: { label: reportWorkers, highlight: reportWorkersHighlight },
    jobs: { label: reportWorkForce, highlight: reportWorkForceHighlight },
    morale: { label: reportMorale, highlight: reportMoraleHighlight },
    wage: { label: reportWage },
    lifeSupport: { label: reportLifeSupport, highlight: reportLifeSupportHighlight },
    food: { label: reportFoodSupply, highlight: reportFoodSupplyHighlight },
    health: { label: reportHealth, highlight: reportHealthHighlight },
    occupancy: { label: reportOccupancy, highlight: reportOccupancyHighlight },
    deathRate: { label: reportDeath, highlight: reportDeathHighlight },
  });

  renderReport(productionViewModel, {
    asteroidClass: { label: reportClass },
    mines: { label: reportMines },
    processors: { label: reportProcessors, highlight: reportProcessorsHighlight },
    storage: { label: reportStorage, highlight: reportStorageHighlight },
    power: { label: reportPower, highlight: reportPowerHighlight },
    diridium: { label: reportDiridium },
    projectedCredits: { label: report30Day, highlight: report30DayHighlight },
  });

  updateDiridiumStorageIcon();
}

function updateDiridiumStorageIcon() {
  const diridiumStoragePointerDown = () => true;
  const diridiumStoragePointerUp = () => {
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
  };
  const diridiumStorageButton = { width: 14, height: 13, x: 0, y: 0 };
  const diridiumStorageHitzone = { width: 14, height: 13, x: 0, y: 0 };
  const { fill } = getDiridiumStorageState({
    diridium: gameData.diridium,
    processorCount: countBuildingsByName('Processor'),
    storageCount: countBuildingsByName('Storage'),
  });
  const { normal, hover, down } = diridiumStorageTextures[fill];

  // Clear container children in order to update sprite textures
  storageIconContainer.removeChildren();

  // Add button inside storage icon container. Pressed/on is intentionally transparent.
  buildSpriteButton(
    storageIconContainer,
    diridiumStorageButton,
    diridiumStorageHitzone,
    normal,
    hover,
    down,
    diridiumStoragePointerDown,
    diridiumStoragePointerUp,
  );
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

  updateReports();
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
  updateReports();
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
    updateReports();
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
// renderMineScreenFromState(), so this no longer needs the sprite passed to it.
function shop(id) {
  // Clicking the item already selected does nothing. Unselecting by re-clicking
  // was deliberately disabled and is kept that way.
  if (shopItems[id].name === gameData.shopBtn) return;

  session.update({ shopBtn: shopItems[id].name, shopPrice: getPrice(id) });
}

function getPrice(id) {
  return calculateShopPrice(shopItems[id].price, gameData.multiplier);
}

// Re-applies gameData.shopBtn to the sprites that draw the selection.
// renderMineScreenFromState() runs with gameData already replaced by a loaded
// save, but the selected-item highlight, the caption tint and the affordability
// marker all live on sprites that still belong to the previous colony. Restoring
// the caption text alone leaves the shop showing one item and selecting another.
function restoreShopSelection() {
  const { id, unaffordable } = resolveShopSelection(gameData, shopItems);

  shopButtons.forEach(button => button.visible = false);
  storeText.tint = unaffordable ? 0xFFFFFF : 0x000000;
  storeTextHighlight.visible = unaffordable;

  if (id === null) return;

  shopSprites[id].visible = true;
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

  remove(startScreen);
  show(mineScreen);
  mineScreen.interactiveChildren = true;

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
  renderMineScreenFromState();
  updateMineSurface('Mapping...', openingLevel, newMaps, true);
}

function showOperationsReport() {
  show(loadMineScreen, mineScreen);
  show(operationsReport, loadMineScreen);
  show(operationsReportExtension);
}

function closeOperationsReport() {
  remove(operationsReport, loadMineScreen);
  remove(loadMineScreen, mineScreen);
  remove(operationsReportExtension);
}

function showProductionReport() {
  show(loadMineScreen, mineScreen);
  show(productionReport, loadMineScreen);
  show(productionReportExtension);
}

function closeProductionReport() {
  remove(productionReport, loadMineScreen);
  remove(loadMineScreen, mineScreen);
  remove(productionReportExtension);
}

function showAdvanceDaysMenu() {
  dayPicker = openDayPicker(dayPicker);
  show(advanceDaysMenu, mineScreen);
}

function hideAdvanceDaysMenu() {
  dayPicker = closeDayPicker(dayPicker);
  remove(advanceDaysMenu, mineScreen);
}

function showOptions() {
  show(loadMineScreen, mineScreen);
  show(optionsMenu, loadMineScreen);
  show(optionsMenuExtension);
}

function closeOptions() {
  // console.log('inside closeOptions');
  remove(optionsMenu, loadMineScreen);
  remove(loadMineScreen, mineScreen);
  remove(optionsMenuExtension);
}

function showLoadOptions() {
  remove(optionsMenu, loadMineScreen)
  loadAutosave.text = minerSaves.autoSave.name;
  load1.text = minerSaves.save1.name;
  load2.text = minerSaves.save2.name;
  load3.text = minerSaves.save3.name;

  // Disable Load menu's start screen Cancel hitarea
  loadCancelStart.interactive = false;
  loadCancelMine.interactive = true;
}

function closeLoadOptions() {
  // console.log('inside closeLoadOptions');

  // Reenable Load menu's start screen Cancel hitarea
  loadCancelStart.interactive = true;
  loadCancelMine.interactive = false;
  show(optionsMenu, loadMineScreen)
}

function showGameOverLoad() {
  loadCancelStart.interactive = false;
  loadCancelGameover.interactive = true;
  show(loadMineScreen, gameOver);
}

function closeGameOverLoad() {
  // console.log('inside closeGameOverLoad');

  loadCancelStart.interactive = true;
  loadCancelGameover.interactive = false;
  remove(loadMineScreen, gameOver);
}

function showMineScreenInstructions() {
  instructionsCancelStart.visible = false;
  instructionsCancelMine.visible = true;
  show(instructionsScreen, mineScreen);
}

function closeMineScreenInstructions() {
  instructionsCancelStart.visible = true;
  instructionsCancelMine.visible = false;
  remove(instructionsScreen, mineScreen);
}


// End of game functions
function exitAndSave() {
  const closeFunctions = [
    closeOptions,
    () => remove(mineScreen, startScreen),
    resetGameData,
    () => show(startScreen)
  ];
  save('autoSave', true, optionsMenu, ...closeFunctions);
}

function endGame(hasConfirmation = true, failure = '', completion = null) {
  let hasEnded = false;
  let completionPresentation = null;

  if (completion) {
    completionPresentation = buildCompletionPresentation(completion);
    missionStatus1.anchor.set(0, 0);
    missionStatus1.position.set(18, 20);
    missionStatus1.text = completionPresentation.lines.join('\n');
    missionStatus2.text = '';
  } else if (failure) {
    missionStatus1.anchor.set(0.5, 0);
    missionStatus1.position.set(75, 37);
    missionStatus1.text = `Mission Status: FAILURE on day ${gameData.day}`;
    missionStatus2.text = `Cause: ${failure}`;
  } else {
    missionStatus1.anchor.set(0.5, 0);
    missionStatus1.position.set(75, 37);
    missionStatus1.text = `Mission Status: RESIGNED on day ${gameData.day}`;
    missionStatus2.text = `Credits Remaining: ${gameData.credits}`;
  }

  if (failure || completion) {
    endGameFunctions();
  } else if (hasConfirmation) {
    dialogs.confirm(optionsMenu, 'Are you sure you want to resign? (This will end your current colony.)', endGameFunctions, doNothing);
  } else endGameFunctions();

  function endGameFunctions() {
    if (hasEnded) return;
    hasEnded = true;
    closeOptions();
    remove(mineScreen);
    show(startScreen);
    resetGameData();
    resetAutosave();
    show(gameOver);
    if (completionPresentation) {
      dialogs.message(gameOver, completionPresentation.futureMessage, doNothing);
    }
  }
}

function gameOverNewMine() {
  // Check for Auto save
  if (!minerSaves.autoSave.empty) {
    dialogs.confirm(gameOver, 'Starting a new mining colony will overwrite an active mining colony. Do you wish to proceed?', continueGameOver, () => { return; });
  } else {
    continueGameOver();
  }

  function continueGameOver() {
    // Flag auto save to be erased
    minerSaves.autoSave.empty = true;
    remove(gameOver);
    newMine();
  }
}

function quit() {
  resetGameData();
  remove(gameOver, startScreen);
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

// The checkbox sprite is not touched here. renderMineScreenFromState() adds or
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
  loadAutosave.text = minerSaves.autoSave.name;
  saveAutosave.text = minerSaves.autoSave.name;
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
