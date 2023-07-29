import { deepClone } from './utilities.js';
import { random, randomNum } from './random.js';
import { barText, bold, regular } from './font-styles.js';
import { getDifficulty, fillMap, generateMaps } from './maps.js';
import { showMessage, showConfirmation, showInput } from './message.js';
import {
  setMinerSavesFromStorage,
  minerSaves, saveGame, initAutosave, loadGame
} from './saveload.js';
import {
  buildHitzone, buildButton, buildTextButton, buildSpriteButton
} from './button.js';
import {
  gameDataInit, shopItems, buildingMap, constructionTimeMap, undoData
} from './gamedata.js';

import {
  initUser
} from './connection.js'

initUser();
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
document.body.appendChild(app.view);

// Variables
let gameData = {};
let sheet;
let startScreen, startButton, startButtonInverted;
let launchScreen,asteroidButton, asteroidButtonInverted, launchButton, launchButtonInverted;
let startCover;
let loadMineScreen;
let instructionsScreen, buttonOk, buttonOkInverted;
let selectAsteroidTitle;
let mineScreen, buttonInfo, buttonInfoInverted;
let topBarCover, topBarText;
let operationsReport;
let operationsReportExtension;
let reportWorkers, reportWorkForce, reportMorale, reportWage, reportLifeSupport;
let reportFoodSupply, reportHealth, reportOccupancy, reportDeath;
let reportWorkersHighlight, reportWorkForceHighlight, reportMoraleHighlight, reportLifeSupportHighlight;
let reportFoodSupplyHighlight, reportHealthHighlight, reportOccupancyHighlight, reportDeathHighlight;
let productionReport;
let productionReportExtension;
let reportClass, reportMines, reportProcessors, reportStorage;
let reportPower, reportDiridium, report30Day;
let reportProcessorsHighlight, reportStorageHighlight;
let reportPowerHighlight, report30DayHighlight;
let optionsMenu;
let optionsMenuExtension;
let saveTitle;
let saveMineScreen;
let gameOver;
let autosaveCheck;
let gridlinesCheck;
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
let messageArgs;
let textureButtonDown, textureButton;
let buttonText1, buttonText2;
let inputSubtitle, inputText;
let underline, cursor;
let mapSquare; // for grid?
let clearArea, clearAreaInverted;
let smoothArea, smoothAreaInverted;
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
let asteroidSurface;
let newMaps = {};
let level1On, level2On, level3On;
let drawZonesOnce = false;
let queuedMessages = [];
let eventMessages = {
  hasEndingMessage: false,
  hasRandomEventMessage: false,
  hasDisasterMessage: false,
};
let upArrow, upArrowInverted, downArrow, downArrowInverted;
let emptySpace;
let sellDiridiumDialog;
let storageIconContainer;
let storageIcon, storageIconInverted;
let storage00, storage00Inverted;
let storage33, storage33Inverted;
let storage66, storage66Inverted;
let storage99, storage99Inverted;
let sellDialogCancelInverted, sellDialogSellInverted;
let sellAmountText, sellAmount;
let pointerDownID = -1;

// Loader
// Preload spritesheet
const loader = new PIXI.Loader();
// loader.baseUrl = 'assets/images';
// loader.add('infoIcon', 'infoIcon.gif');
loader.add('assets/spritesheet.json');

loader.onProgress.add(logProgress);
loader.onComplete.add(doneLoading);
loader.onError.add(reportError);
loader.load(); // could call a function here: .load(myfunc);
function logProgress(e) {

  console.log(`Loading - ${e.progress}`);
}

function reportError(e) {
  console.error(`ERROR: ${e.message}`);
}

function doneLoading(e) {
  console.log('IMAGES LOADED!');
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
    if (!PIXI.BitmapFont.available['Palm OS', 'Palm OS Bold'])
      console.log("Font not loaded");
    else {
      console.log("FONTS LOADED!");
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
  startButtonInverted = new PIXI.Texture.from('button start inverted.gif');
  // Launch Screen
  launchScreen = new PIXI.Sprite.from(sheet.textures['screen launch control.png']);
  launchScreen.x = 0;
  launchScreen.y = 0;
  asteroidButton = new PIXI.Texture.from('button asteroid.gif');
  asteroidButtonInverted = new PIXI.Texture.from('button asteroid inverted.gif');
  launchButton = new PIXI.Texture.from('button-launch.gif');
  launchButtonInverted = new PIXI.Texture.from('button-launch-inverted.gif');
  // Load Mine Screen
  loadMineScreen = new PIXI.Sprite.from(sheet.textures['screen load mine.gif']);
  loadMineScreen.x = 0;
  loadMineScreen.y = 13;
  buttonInfo = new PIXI.Texture.from('button info.gif');
  buttonInfoInverted = new PIXI.Texture.from('button info inverted.gif');
  // Instructions Screen
  instructionsScreen = new PIXI.Sprite.from(sheet.textures['screen instructions.png']);
  instructionsScreen.x = 0;
  instructionsScreen.y = 0;
  buttonOk = new PIXI.Texture.from('button OK.gif');
  buttonOkInverted = new PIXI.Texture.from('button OK inverted.gif');
  // Select Asteroid Screen
  selectAsteroidTitle = new PIXI.Sprite.from(sheet.textures['select asteroid title.gif']);
  selectAsteroidTitle.x = 5;
  selectAsteroidTitle.y = 3;
  //
  // Game screens
  mineScreen = new PIXI.Sprite.from(sheet.textures['screen game.png']);
  mineScreen.x = 0;
  mineScreen.y = 0;
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
  optionsMenu = new PIXI.Sprite.from(sheet.textures['options menu.gif']);
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
  // Shop text highlight
  storeTextHighlight = new PIXI.Graphics();
  storeTextHighlight.beginFill(0x000000);
  storeTextHighlight.drawRect(0, 0, 59, 12);
  storeTextHighlight.endFill();
  storeTextHighlight.x = 4;
  storeTextHighlight.y = 146;
  storeTextHighlight.visible = false;
  mineScreen.addChild(storeTextHighlight);
  // Autosave checkbox X
  autosaveCheck = new PIXI.Sprite.from(sheet.textures['checked.gif']);
  autosaveCheck.x = 16;
  autosaveCheck.y = 24;
  optionsMenu.addChild(autosaveCheck); // on by default
  // Gridlines checkbox X
  gridlinesCheck = new PIXI.Sprite.from(sheet.textures['checked.gif']);
  gridlinesCheck.x = 16;
  gridlinesCheck.y = 39;
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
  upArrowInverted = new PIXI.Texture.from('up-arrow-inverted.gif');
  downArrow = new PIXI.Texture.from('down-arrow.gif');
  downArrowInverted = new PIXI.Texture.from('down-arrow-inverted.gif');
  // Empty space
  emptySpace = new PIXI.Texture.from('empty space.gif');
  // Storage Textures for Sell Diridium button
  storage00 = emptySpace;
  storage00Inverted = new PIXI.Texture.from('sell diridium inverted.gif');
  storage33 = new PIXI.Texture.from('sell diridium 33.gif');
  storage33Inverted = new PIXI.Texture.from('sell diridium 33 inverted.gif');
  storage66 = new PIXI.Texture.from('sell diridium 66.gif');
  storage66Inverted = new PIXI.Texture.from('sell diridium 66 inverted.gif');
  storage99 = new PIXI.Texture.from('sell diridium 99.gif');
  storage99Inverted = new PIXI.Texture.from('sell diridium 99 inverted.gif');
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
  // Load Mine Screen Text
  loadAutosave = new PIXI.BitmapText(minerSaves.autoSave.name, regular);
  loadAutosave.x = 55;
  loadAutosave.y = 37;
  loadAutosave.anchor = (0.5, 0.5);
  loadMineScreen.addChild(loadAutosave);
  load1 = new PIXI.BitmapText(minerSaves.save1.name, regular);
  load1.x = 55; //29
  load1.y = 57; //52;
  load1.anchor = (0.5, 0.5); // (0,0)
  loadMineScreen.addChild(load1);
  load2 = new PIXI.BitmapText(minerSaves.save2.name, regular);
  load2.x = 55;
  load2.y = 77; // 72;
  load2.anchor = (0.5, 0.5);
  loadMineScreen.addChild(load2);
  load3 = new PIXI.BitmapText(minerSaves.save3.name, regular);
  load3.x = 55;
  load3.y = 97; // 92;
  load3.anchor = (0.5, 0.5);
  loadMineScreen.addChild(load3);
  //
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
  // Save Mine text
  saveAutosave = new PIXI.BitmapText(minerSaves.autoSave.name, regular);
  saveAutosave.x = 55;
  saveAutosave.y = 37;
  saveAutosave.anchor = (0.5, 0.5);
  saveMineScreen.addChild(saveAutosave);
  save1 = new PIXI.BitmapText(minerSaves.save1.name, regular);
  save1.x = 55; //29;
  save1.y = 57; //52;
  save1.anchor = (0.5, 0.5); //(0,0);
  saveMineScreen.addChild(save1);
  save2 = new PIXI.BitmapText(minerSaves.save2.name, regular);
  save2.x = 55; // 29;
  save2.y = 77; // 72;
  save2.anchor = (0.5, 0.5); //(0,0);
  saveMineScreen.addChild(save2);
  save3 = new PIXI.BitmapText(minerSaves.save3.name, regular);
  save3.x = 55; // 29;
  save3.y = 97; // 92;
  save3.anchor = (0.5, 0.5); //(0,0);
  saveMineScreen.addChild(save3);
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
  buildTextButton(startScreen, 62, 14, 49, 74, startButton, startButtonInverted, newMine, 'New Mine');
  // Launch Screen's Up arrow
  const moreProbesPointerDown = () => { if (gameData.probes <= 4) return true; };
  const moreProbesPointerUp = () => {
    if (gameData.probes <= 4) probeNum.text = gameData.probes += 1;
  };
  const moreProbesButton = { width: 13, height: 6, x: 64, y: 126 };
  const moreProbesHitzone = { width: 18, height: 7, x: 63, y: 125 }
  buildSpriteButton(launchScreen, moreProbesButton, moreProbesHitzone, upArrow, upArrowInverted, moreProbesPointerDown, moreProbesPointerUp);
  // Launch Screen's Down arrow
  const lessProbesPointerDown = () => { if (gameData.probes >= 2) return true; };
  const lessProbesPointerUp = () => {
    if (gameData.probes >= 2) probeNum.text = gameData.probes -= 1;
  };
  const lessProbesButton = { width: 13, height: 6, x: 64, y: 133 };
  const lessProbesHitzone = { width: 18, height: 7, x: 63, y: 133 }
  buildSpriteButton(launchScreen, lessProbesButton, lessProbesHitzone, downArrow, downArrowInverted, lessProbesPointerDown, lessProbesPointerUp);
  // Launch Screen's Launch button
  // buildHitzone(launchScreen, 43, 15, 85, 125, launchProbes); // Commenting out hitzone to use text button instead
  buildTextButton(launchScreen, 43, 15, 85, 125, launchButton, launchButtonInverted, launchProbes, 'Launch');
  // Launch Screen's Cancel button
  // buildHitzone(launchScreen, 40, 15, 104, 125, () => remove(launchScreen, startScreen));
  // Load Mine button
  buildTextButton(startScreen, 62, 14, 49, 91, startButton, startButtonInverted, () => show(loadMineScreen, startScreen), 'Load Mine');
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
  // autoSave
  buildHitzone(loadMineScreen, 86, 15, 11, 30, () => load('autoSave', ...loadClosingFunctions));
  // save1
  buildHitzone(loadMineScreen, 86, 15, 11, 50, () => load('save1', ...loadClosingFunctions));
  // save2
  buildHitzone(loadMineScreen, 86, 15, 11, 70, () => load('save2', ...loadClosingFunctions));
  // save3
  buildHitzone(loadMineScreen, 86, 15, 11, 90, () => load('save3', ...loadClosingFunctions));
  // Load Mine Screen's Cancel button
  loadCancelStart = buildHitzone(loadMineScreen, 42, 13, 33, 123, () => remove(loadMineScreen, startScreen));
  // Instructions button
  buildTextButton(startScreen, 62, 14, 49, 108, startButton, startButtonInverted, () => show(instructionsScreen, startScreen), 'Instructions');
  // Instructions Screen's OK button
  instructionsCancelStart = buildTextButton(instructionsScreen, 48, 13, 56, 141, buttonOk, buttonOkInverted, () => remove(instructionsScreen, startScreen), 'OK');
  //
  // Mine Screen
  // Top bar info icon opens instructions screen
  buildSpriteButton(mineScreen, { width: 10, height: 11, x: 147, y: 2 }, { width: 16, height: 15, x: 145, y: 0 }, emptySpace, buttonInfoInverted, () => true, showMineScreenInstructions);
  // Instructions Screen's Cancel button for mineScreen
  instructionsCancelMine = buildTextButton(instructionsScreen, 48, 13, 56, 141, buttonOk, buttonOkInverted, closeMineScreenInstructions, 'OK');
  // Hide this butotn except in the mineScreen
  instructionsCancelMine.visible = false;
  // Asteroid surface hitzones are added in buildAsteroidHitZones()
  // Levels
  buildHitzone(mineScreen, 14, 13, 114, 27, () => showLevel('level1'));
  buildHitzone(mineScreen, 15, 13, 129, 27, () => showLevel('level2'));
  buildHitzone(mineScreen, 15, 13, 145, 27, () => showLevel('level3'));
  // Reports
  // Operations Report
  buildHitzone(mineScreen, 14, 13, 114, 56, showOperationsReport);
  // OK button
  buildHitzone(operationsReport, 42, 13, 28, 119, closeOperationsReport);
  // Production Report
  buildHitzone(mineScreen, 15, 13, 129, 56, showProductionReport);
  // OK button
  buildHitzone(productionReport, 42, 13, 28, 119, closeProductionReport);
  // Options Window
  buildHitzone(mineScreen, 15, 13, 145, 56, showOptions);
  // Autosave
  buildHitzone(optionsMenu, 65, 11, 15, 23, () => {
    if (gameData.autosaveEnabled) {
      showMessage(...messageArgs, optionsMenu, 'WARNING: With autosave disabled, your game will be lost if you quit without first saving your game.', doNothing);
    }
    toggleCheck(autosaveCheck, `autosaveEnabled`, optionsMenu);
    gameData.autosaveEnabled != gameData.autosaveEnabled;
    // console.log('autosave enabled? ', gameData.autosaveEnabled);
  });
  // Gridlines
  buildHitzone(optionsMenu, 65, 11, 15, 38, () => toggleCheck(gridlinesCheck, `gridlinesEnabled`, optionsMenu));
  // Save mine
  buildHitzone(optionsMenu, 65, 11, 15, 53, () => {
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
  buildHitzone(saveMineScreen, 86, 15, 11, 30, () => save('autoSave', ...saveClosingFunctions)); // autoSave
  buildHitzone(saveMineScreen, 86, 15, 11, 50, () => save('save1', ...saveClosingFunctions)); // save1
  buildHitzone(saveMineScreen, 86, 15, 11, 70, () => save('save2', ...saveClosingFunctions)); // save2
  buildHitzone(saveMineScreen, 86, 15, 11, 90, () => save('save3', ...saveClosingFunctions)); // save3
  // Cancel button
  buildHitzone(saveTitle, 42, 13, 13, 116, () => remove(saveMineScreen, optionsMenu));
  // Load mine
  buildHitzone(optionsMenu, 65, 11, 15, 68, showLoadOptions);
  // Cancel button
  loadCancelMine = buildHitzone(loadMineScreen, 42, 13, 33, 123, closeLoadOptions);
  // Disable this hitzone except in the mineScreen
  loadCancelMine.interactive = false;
  // Exit & Save
  buildHitzone(optionsMenu, 65, 11, 15, 83, exitAndSave);
  // Resign
  buildHitzone(optionsMenu, 65, 11, 15, 98, endGame);
  // OK button
  buildHitzone(optionsMenu, 42, 13, 28, 119, closeOptions);
  // Advance 1
  buildHitzone(mineScreen, 14, 13, 114, 85, () => advance(1));
  buildHitzone(mineScreen, 15, 13, 129, 85, () => advance(7));
  buildHitzone(mineScreen, 15, 13, 145, 85, () => advance(14));
  // Container for the Diridium Storage Button
  storageIconContainer = buildHitzone(mineScreen, 14, 13, 146, 114, doNothing);
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
    // While pressed increase diridium amount
    if (sellAmount >= 10000) sellAmountText.text = sellAmount += 10000;
    if (sellAmount <= 10000 && sellAmount > 1000)
      sellAmountText.text = sellAmount += 1000;
    if (sellAmount <= 1000) sellAmountText.text = sellAmount += 100;
    if (sellAmount > gameData.diridium)
      sellAmountText.text = sellAmount = gameData.diridium;
    if (countBuildingsByName('Space Port') === 0
      && gameData.diridium > 700
      && sellAmount > 700) {
      sellAmountText.text = sellAmount = 700;
    }
  };

  const diridiumIncreasePressed = () => {
    if (pointerDownID === -1) pointerDownID = setInterval(whileDiridiumIncrease, diridiumSpeed);
    return true;
  };

  buildSpriteButton(sellDiridiumDialog, diridiumUpButton, diridiumUpHitzone, upArrow, upArrowInverted, diridiumIncreasePressed, diridiumIncreaseReleased);
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
    // While pressed decrease diridium amount
    if (sellAmount >= 20000) sellAmountText.text = sellAmount -= 10000;
    if (sellAmount <= 20000 && sellAmount > 1000)
      sellAmountText.text = sellAmount -= 1000;
    if (sellAmount <= 1000) sellAmountText.text = sellAmount -= 100;
    if (sellAmount < 0) sellAmountText.text = sellAmount = 0;
  };
  const diridiumDecreasePressed = () => {
    if (pointerDownID === -1) pointerDownID = setInterval(whileDiridiumDecrease, diridiumSpeed);
    return true;
  };
  buildSpriteButton(sellDiridiumDialog, diridiumDownButton, diridiumDownHitzone, downArrow, downArrowInverted, diridiumDecreasePressed, diridiumDecreaseReleased);
  // Sell
  sellDialogSellInverted = new PIXI.Texture.from('sell dialog sell inverted.gif');
  const sellDialogSellButton = { width: 43, height: 15, x: 8, y: 40 };
  const sellDialogSellHitzone = { width: 43, height: 15, x: 8, y: 40 };
  const sellPointerDown = () => true;
  const sellPointerUp = () => {
    remove(sellDiridiumDialog, mineScreen);
    reportDiridium.text = gameData.diridium -= sellAmount;
    updateReports(0);
    showMessage(...messageArgs, mineScreen, `Sold! for ${sellAmount * gameData.sellPrice} credits.`, () => {
      creditText.text = gameData.credits += sellAmount * gameData.sellPrice;
      updateDiridiumStorageIcon();
    });
    gameData.soldToday = true;
  };
  buildSpriteButton(sellDiridiumDialog, sellDialogSellButton, sellDialogSellHitzone, emptySpace, sellDialogSellInverted, sellPointerDown, sellPointerUp);
  // Cancel
  sellDialogCancelInverted = new PIXI.Texture.from('sell dialog cancel inverted.gif');
  const cancelDialogSellButton = { width: 44, height: 15, x: 54, y: 40 };
  const cancelDialogSellHitzone = { width: 44, height: 15, x: 54, y: 40 };
  const cancelPointerDown = () => true;
  const cancelPointerUp = () => remove(sellDiridiumDialog, mineScreen);
  buildSpriteButton(sellDiridiumDialog, cancelDialogSellButton, cancelDialogSellHitzone, emptySpace, sellDialogCancelInverted, cancelPointerDown, cancelPointerUp);
  // Change Wage
  // Increase wage
  const wageUpPointerDown = () => { if (gameData.wage < gameData.wageMax) return true; };
  const wageUpPointerUp = () => {
    wage.text
      = reportWage.text
      = gameData.wage
      = gameData.wage < gameData.wageMax ? gameData.wage + 50 : gameData.wage;
    // console.log('gameData.wage: ', gameData.wage);
    // console.log(`typeof(gameData.wage): ${typeof(gameData.wage)}`);
  };
  const wageUpButton = { width: 13, height: 6, x: 146, y: 143 };
  const wageUpHitzone = { width: 15, height: 7, x: 145, y: 142 };
  buildSpriteButton(mineScreen, wageUpButton, wageUpHitzone, upArrow, upArrowInverted, wageUpPointerDown, wageUpPointerUp);
  // Decrease wage
  const wageDownPointerDown = () => { if (gameData.wage <= gameData.wageMax) return true; };
  const wageDownPointerUp = () => {
    wage.text
      = reportWage.text
      = gameData.wage
      -= gameData.wage > 0 ? 50 : 0;
    // console.log('gameData.wage: ', gameData.wage);
    // console.log(`typeof(gameData.wage): ${typeof(gameData.wage)}`);
  };
  const wageDownButton = { width: 13, height: 6, x: 146, y: 150 };
  const wageDownHitzone = { width: 15, height: 7, x: 145, y: 150 };
  buildSpriteButton(mineScreen, wageDownButton, wageDownHitzone, downArrow, downArrowInverted, wageDownPointerDown, wageDownPointerUp);
  // Shop Buttons
  buildHitzone(mineScreen, 15, 12, 6, 119, () => shop(bulldozerOn, 'bulldozer'));
  buildHitzone(mineScreen, 14, 12, 22, 119, () => shop(diridiumMineOn, 'diridiumMine'));
  buildHitzone(mineScreen, 14, 12, 37, 119, () => shop(hydroponicsOn, 'hydroponics'));
  buildHitzone(mineScreen, 14, 12, 52, 119, () => shop(tubeOn, 'tube'));
  buildHitzone(mineScreen, 14, 12, 67, 119, () => shop(lifeSupportOn, 'lifeSupport'));
  buildHitzone(mineScreen, 14, 12, 82, 119, () => shop(quartersOn, 'quarters'));
  buildHitzone(mineScreen, 15, 12, 6, 132, () => shop(spacePortOn, 'spacePort'));
  buildHitzone(mineScreen, 14, 12, 22, 132, () => shop(powerPlantOn, 'powerPlant'));
  buildHitzone(mineScreen, 14, 12, 37, 132, () => shop(processorOn, 'processor'));
  buildHitzone(mineScreen, 14, 12, 52, 132, () => shop(sickbayOn, 'sickbay'));
  buildHitzone(mineScreen, 14, 12, 67, 132, () => shop(storageOn, 'storage'));
  buildHitzone(mineScreen, 14, 12, 82, 132, undo);
  //
  // Game Over Screen
  // New Mine
  buildHitzone(gameOver, 48, 14, 17, 93, gameOverNewMine);
  // Load Mine
  buildHitzone(gameOver, 49, 14, 86, 93, showGameOverLoad);
  // Cancel button
  // loadCancelGameover = buildHitzone(loadMineScreen, 42, 13, 42, 106, gameOver); // 22, 116
  loadCancelGameover = buildHitzone(loadMineScreen, 42, 13, 33, 123, closeGameOverLoad); // 22, 116
  // Disable this hitzone except in the gameOver screen
  loadCancelGameover.interactive = false;

  // Quit
  buildHitzone(gameOver, 42, 14, 55, 110, quit);

  // Variables
  messageArgs = [app, messageTop, questionIcon, infoIcon, messageTitle, messageBottom, messageText, inputSubtitle, inputText, textureButton, textureButtonDown, underline, cursor, buttonText1, buttonText2,];

  // testThis();
}

function testThis() {
  // For testing stuff
}

function newMine() {
  // Check for Auto save
  if (!minerSaves.autoSave.empty) {
    showConfirmation(...messageArgs, startScreen, 'Starting a new mining colony will overwrite an active mining colony. Do you wish to proceed?', continueNewMine, () => { return; });
  } else {
    continueNewMine();
  }

  function continueNewMine() {
    resetGameData();
    resetAutosave();
    resetupdate();
    resetButtons();
    resetShop();
    show(launchScreen, startScreen);
  }
}

function launchProbes() {
  asteroidSurface.removeChildren();
  remove(launchScreen, startScreen);
  show(startCover, startScreen);
  show(selectAsteroidTitle);
  gameData.credits -= gameData.probes * 17000;
  creditText.text = gameData.credits;

  let asteroids = [];
  for (let i = 0; i < gameData.probes; i++) {
    asteroids.push(getDifficulty());
    const designation = getDesignation();
    // buildButton(selectAsteroidTitle, 57, 17, 4, 20 * i + 29, () => pickAsteroid(i), sheet.textures['button asteroid.gif'], `Asteroid ${designation}`, regular, 6, 3);
    buildTextButton(selectAsteroidTitle, 59, 17, 4, 20 * i + 29, asteroidButton, asteroidButtonInverted, () => pickAsteroid(i), `Asteroid ${designation}`);
    addDifficultyText(i);
  }
  // console.log('asteroids:', asteroids);
  // console.log('selectAsteroidTitle.children.length: ', selectAsteroidTitle.children.length);

  function addDifficultyText(i) {
    let txt = new PIXI.BitmapText(asteroids[i], regular);
    txt.x = 67;
    txt.y = i * 20 + 32;
    selectAsteroidTitle.addChild(txt);
  }

  function getDesignation() {
    return random(36, 2, 4);
  }

  function pickAsteroid(i) {
    selectAsteroidTitle.removeChildren();
    // console.log('removeChildren()');
    // console.log('selectAsteroidTitle.children.length: ', selectAsteroidTitle.children.length);
    remove(selectAsteroidTitle);
    remove(startCover);
    gameData.asteroid = `Class:${asteroids[i].substring(6, 7)}`;
    gameData.difficulty = Number(asteroids[i].charAt(6));
    // console.log('pickAsteroid gameData.difficulty: ', gameData.difficulty);
    gameData.miningEfficiency = 110 - gameData.difficulty * 10;

    // Don't autosave until player advances days
    // autosave(gameData);
    gotoMineScreen();
  }
}

// Mine Screen Functions
// Asteroid surface
// Asteroid grid top left is (0,0), bottom right is (9,9)
function buildAsteroidHitZones() {
  let x = 0;
  let y = 0;
  let originX = 2;
  let originY = 15;

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      x = col * 10 + originX;
      y = row * 10 + originY;
      buildHitzone(mineScreen, 10, 10, x, y, () => tapSurface(col, row));
    }
  }
}

function tapSurface(x, y) {
  const btn = gameData.shopBtn;
  // console.log(`(${x},${y}) btn: ${btn}`);
  const btnNum = Number(getBuildingNumber(btn));
  // console.log('btnNum: ', btnNum);
  let num = getNumberAt(x, y);
  // console.log('tapSurface num: ', num);

  // Show site status message
  if (num >= 5) {
    // console.log(`tapSurface ${num} >= 5: trying to show status message`);

    // Skip ahead as Bulldozer has different messages for bulldozing itself.
    if (num === 107 && btn === 'Bulldozer') {
      checkBulldozer();
      return;
    }

    showMessage(...messageArgs, mineScreen, `•Site Number: ${getSiteNumberAt(x, y)}\n•Building: ${getBuildingName(num)}\n•Status: ${getStatus(num)}`, checkMinePlacement);
  }
  // Check if site is next to completed structure
  else if (
    !isAdjacent(x, y)
    && ((gameData.level === 'level1' && num !== 5)
      || (gameData.level !== 'level1' && num % 100 !== 8))
  ) {
    showMSMessage('You can only build next to a completed structure.');
    return;
  }
  else checkMinePlacement();

  function checkMinePlacement() {
    // console.log('inside checkMinePlacement()');
    // Return if site is Mother Ship
    if (num === 5) return;

    else if (btn === 'Diridium Mine' && [1, 2].includes(num)) {
      // console.log('trying to show mine can not be placed here message');
      showMSMessage('A mine can only be placed on an ore vein.');
      // showMessage(...messageArgs, mineScreen, 'A mine can only be placed on an ore vein.', doNothing);
    }
    else if (btn === 'Diridium Mine' && num === 4) placeStructure(8, x, y);
    else if (btn !== 'Diridium Mine') checkOtherPlacements();
  }

  function checkOtherPlacements() {
    // Skip ahead as Bulldozer has different messages for 2 3 and 4
    if (btn === 'Bulldozer') {
      checkBulldozer();
      return;
    }

    // Do nothing if rocky area
    if (num === 3) return;

    // Check if site is smooth area or ore vein
    if ([2, 4].includes(num)) {
      showMSMessage(`•Site Number: ${getSiteNumberAt(x, y)}\n•Building: None\n•Note: You must bulldoze clear the area before building that.`);
      return;
    }

    // Check if site is any building
    if (num >= 5) return;

    // Check for level1-only structures
    if (gameData.level !== 'level1' && [13, 14, 15].includes(btnNum)) {
      const messageMap = {
        13: 'Now why would you want to build a landing pad INSIDE an asteroid?',
        14: 'Mining regulations state a power plant can only be built on the surface level 1 due to risk of explosion.',
        15: 'Building that here would contaminate life support with toxic fumes. The workers refuse to build that anywhere other than level 1.',
      };

      showMSMessage(messageMap[btnNum]);
      return;
    }

    // Finally place structure
    placeStructure(getBuildingNumber(btn), x, y);
  }

  function checkBulldozer() {
    console.log('inside checkBulldozer()');
    switch (num) {
      case 1:
        showMSMessage('That area is already prepared for a building.');
        return;
      case 2:
        placeStructure(7, x, y);
        num = 7;
        console.log('switch num: ', num);
        console.log(`map data for row${y}[${x}]: `, gameData.maps[`${gameData.level}`][`row${y}`][x]);
        return;
      case 3:
        showMSMessage('That terrain is too rocky to bulldoze.');
        return;
      case 4:
        showConfirmation(...messageArgs, mineScreen, 'Bulldozing that area will destroy the ore vein. Do you really want to place a bulldozer there?', () => placeStructure(7, x, y), doNothing);
        return;
      case 7:
      case 107:
        showMSMessage('Now why would you want to bulldoze a bulldozer while its bulldozing?');
        return;
      case 5:
        // Don't do anything if Mother Ship, just show info
        return;
      case 6:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
      case 15:
      case 16:
      case 17:
        // showConfirmation(...messageArgs, mineScreen, `Do you want to bulldoze the ${getNameAt(x,y)} on this area?`, () => placeStructure(7, x, y), doNothing);
        confirmBulldoze(x, y);
        return;
    }

    switch (true) {
      case num > 100:
        confirmBulldoze(x, y);
        return;
    }
  }
}

function getNumberAt(x, y) {
  return gameData.maps[`${gameData.level}`][`row${y}`][x];
}

function getSiteNumberAt(x, y) {
  return y * 10 + x + 1;
}

function getStatus(num) {
  if (num > 100) {
    const numDays = Math.floor(num / 100);
    return `${numDays} day${numDays === 1 ? '' : 's'} until construction complete`;
  } else if (num === 5 && gameData.day > 21) {
    return 'Non-functional';
  } else {
    return 'Operational';
  }
  // Site Number: \nBuilding:"+oname[b];
  // if (c>0)
  //  phrase=phrase+"\nStatus: "+c+" days until construction complete";
  // else
  //  phrase=phrase+"\nStatus: Operational";
}

function confirmBulldoze(x, y) {
  showConfirmation(...messageArgs, mineScreen, `Do you want to bulldoze the ${getBuildingAt(x, y)} on this area?`, () => placeStructure(7, x, y), doNothing);
}

function isAdjacent(x, y) {
  // Top
  if (y - 1 >= 0) {
    const n = getNumberAt(x, y - 1);
    if (isCompleted(n)) return true;
  }

  // Right
  if (x + 1 < 10) {
    const n = getNumberAt(x + 1, y);
    if (isCompleted(n)) return true;
  }

  // Bottom
  if (y + 1 < 10) {
    const n = getNumberAt(x, y + 1);
    if (isCompleted(n)) return true;
  }

  // Left
  if (x - 1 >= 0) {
    const n = getNumberAt(x - 1, y);
    if (isCompleted(n)) return true;
  }
  return false;

  function isCompleted(n) {
    if (n === 5 || (n > 7 && n < 100)) return true;
    return false;
  }
}

function getBuildingAt(x, y) {
  const num = getNumberAt(x, y);
  return getBuildingName(num);
}

function getBuildingName(num) {
  num %= 100;
  return buildingMap[num];
}

function getBuildingNumber(name) {
  console.log('Gabrien name: ', name);

  for (let index in buildingMap) {
    // console.log('Gabrien index: ', index);
    // console.log('Gabrien buildingMap[index]: ', buildingMap[index]);
    if (buildingMap[index] === name) return index;
  }
};

function placeStructure(num, x, y) {
  // console.log(`placeStructure called - num: ${num}, x:${x}, y:${y}`);

  // Check cost
  if (gameData.credits < gameData.shopPrice) {
    showMSMessage(`You do not have enough credits to build that. That module costs ${gameData.shopPrice} credits to build.`);
    return;
  }

  const undoNum = getNumberAt(x, y);
  const newNum = constructionTimeMap[num];
  // console.log('newNum from constructionTimeMap: ', newNum);

  gameData.maps[`${gameData.level}`][`row${y}`][x] = newNum;

  // Check if building Diridium Mine
  if (num === 8 && gameData.level !== 'level3') {
    const levelMap = {
      level1: 'level2',
      level2: 'level3',
    };

    // Add a lower level mine
    gameData.maps[`${levelMap[gameData.level]}`][`row${y}`][x] = 1208;
  }

  drawMap(gameData.maps[gameData.level]);

  creditText.text = gameData.credits -= gameData.shopPrice;

  // Check to update shop text highlight
  if (gameData.shopPrice > gameData.credits) {
    storeText.tint = 0xFFFFFF;
    storeTextHighlight.visible = true;
  }

  // Store undo info
  undoData.hasUndo = true;
  undoData.undoLevel = gameData.level;
  undoData.undoNum = undoNum;
  undoData.undoX = x;
  undoData.undoY = y;
  undoData.undoPrice = Number(gameData.shopPrice);
  console.log('Gabrien undoData: ', undoData);
}

// Levels
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

function updateMineSurface(title, newLevel, newMaps, clearMap = false, doneAnimating) {
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
  const currentMap = deepClone(gameData.maps[gameData.level])

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

  animateMap(currentMap, newMap, newLevel, clearMap, allDone, doneAnimating);
}

function allDone(newLevel, doneAnimating) {
  topBarCover.visible = false;
  dayText.visible = true;
  creditText.visible = true;
  mineScreen.interactiveChildren = true;

  gameData.level = newLevel;
  // console.log(`allDone gameData.level: ${gameData.level}, newLevel: ${newLevel}`);

  // Optional callback when done animating
  typeof doneAnimating === 'function' && doneAnimating();


  // console.log(`allDone gameData.maps[${gameData.level}].row0: `, gameData.maps[gameData.level].row0);
  // console.log(`allDone gameData.maps.level1.row0: `, gameData.maps.level1.row0);
  // console.log(`allDone gameData.maps.level2.row0: `, gameData.maps.level2.row0);
  // console.log(`allDone gameData.maps.level3.row0: `, gameData.maps.level3.row0);
  // console.log('================================');

}

function animateMap(currentMap, newMap, newLevel, clearMap, callback, doneAnimating) {
  // testings
  // currentMap = gameDataInit.maps.level1;
  // console.log('animateMap currentMap: ', currentMap);
  // console.log('animateMap newMap: ', newMap);
  // console.log('animateMap clearMap: ', clearMap);


  let r = 0;
  let previousRow = [];
  let currentRow = [];
  let newRow = [];
  let tempMap = {};

  if (clearMap) {
    // if (true) {
    // currentMap = fillMap(1);
    // Object.assign(currentMap, fillMap(1));
    // console.log('currentMap clearmap:', currentMap);
    Object.assign(tempMap, fillMap(1));
    // console.log('tempMap clearmap row0:', tempMap.row0);
  } else {
    // Need to deep clone because Object.assign creates only
    // a same level copy, not the nested ones.
    tempMap = deepClone(currentMap);
    // console.log('tempMap !clearmap row0:', tempMap.row0);
  }

  updateRow(r);

  function updateRow(r) {
    // console.log('Gabrien inside updateRow');
    // console.log('Gabrien updateRow r: ', r);
    // console.log('Gabrien currentMap: ', currentMap);
    // console.log('Gabrien newMap: ', newMap);

    // previousRow = currentMap[`row${r-1}`];
    previousRow = tempMap[`row${r - 1}`];
    if (r < 10) currentRow = tempMap[`row${r}`];
    if (r < 10) newRow = [...newMap[`row${r}`]];
    // if (r < 10) newRow = newMap[`row${r}`];

    if (r === 0) {
      // console.log('previousRow: ', previousRow);
      // console.log('currentRow: ', currentRow);
      // console.log('newRow: ', newRow);
      // console.log('--------------------------------');
    }

    // Calculate how many tiles to invert
    let notInverted = 9 - randomNum(2, 8);

    for (let t = 0; t < 10; t++) {
      // Remove inverted images from previous row
      if (r > 0) previousRow[t] = Math.abs(previousRow[t]);

      // console.log('Gabrien inside for loop');
      // console.log('Gabrien previousRow: ', previousRow);
      // console.log('Gabrien currentRow: ', currentRow);
      // console.log('Gabrien newRow: ', newRow);

      if (r < 10) currentRow[t] = t > notInverted ? -newRow[t] : newRow[t];
    }

    // Pause a little before continuing the loop
    // And use a closure to preserve the value of "r"
    (function(r) {
      window.setTimeout(function() {
        // Draw the whole map with the new row
        // how does tempMap get updated here? line 920
        drawMap(tempMap);
        if (r < 10) {
          r += 1;
          updateRow(r);
        } else {
          // gameData.level = level;
          callback(newLevel, doneAnimating);
        }
      }, 75); // This is the speed of the redraw

    }(r));
  }
}

function drawMap(map) {
  // console.log('inside drawMap');
  let tile;
  let tex;
  const originX = 2;
  const originY = 15;

  asteroidSurface.removeChildren();

  for (let r = 0; r < 10; r++) {
    let currRow = map[`row${r}`];
    // console.log('currRow: ', currRow);

    for (let t = 0; t < 10; t++) {
      tex = getTile(currRow[t]);
      // tile = new PIXI.Sprite.from(sheet.textures[tex]);
      tile = new PIXI.Sprite.from(tex);
      tile.position.set(originX + t * 10, originY + r * 10);
      asteroidSurface.addChild(tile);
    }
  }

  function getTile(num) {
    switch (num) {
      case 1:
        return clearArea;
      case -1:
        return clearAreaInverted;
      case 2:
        return smoothArea;
      case -2:
        return smoothAreaInverted;
      case 3:
        return roughArea;
      case -3:
        return roughAreaInverted;
      case 4:
        return oreVein;
      case -4:
        return oreVeinInverted;
      case 5:
        return motherShip;
      case -5:
        return motherShipInverted;
      case 6:
        return construction;
      case -6:
        return constructionInverted;
      case 7:
      case 107:
        return bulldozer;
      case -7:
      case -107:
        return bulldozerInverted;
      case 8:
        return diridiumMine;
      case -8:
        return diridiumMineInverted;
      case 9:
        return hydroponics;
      case -9:
        return hydroponicsInverted;
      case 10:
        return tube;
      case -10:
        return tubeInverted;
      case 11:
        return lifeSupport;
      case -11:
        return lifeSupportInverted;
      case 12:
        return quarters;
      case -12:
        return quartersInverted;
      case 13:
        return spacePort;
      case -13:
        return spacePortInverted;
      case 14:
        return powerPlant;
      case -14:
        return powerPlantInverted;
      case 15:
        return processor;
      case -15:
        return processorInverted;
      case 16:
        return sickbay;
      case -16:
        return sickbayInverted;
      case 17:
        return storage;
      case -17:
        return storageInverted;
    }

    // Construction site icons
    switch (true) {
      case num > 107:
        return construction;
      case num < -107:
        return constructionInverted;
    }
  }
}


function resetupdate() {
  console.log('>> Reminder to put resetupdate() functions here');

  // Settings updates
  initCheck(autosaveCheck, `autosaveEnabled`, optionsMenu);
  initCheck(gridlinesCheck, `gridlinesEnabled`, optionsMenu);

  function initCheck(sprite, data, parent) {
    if (gameData[data]) parent.addChild(sprite);
    else parent.removeChild(sprite);
  }

  // Text updates
  probeNum.text = gameData.probes;
  dayText.text = gameData.day.toString();
  creditText.text = gameData.credits.toString();
  storeText.text = gameData.shopBtn;
  storePrice.text = gameData.shopPrice.toString();
  sellPrice.text = gameData.sellPrice.toString();
  wage.text = gameData.wage.toString();

  // Button updates
  // Updating the level button here introduces a bug
  // when loading a saved game where the button could show 2 or 3
  // when it should be 1.
  // updateLevelButtons(gameData.level);
}

// Save
function save(slot, showProgress, parent, ...closeFunctions) {
  // console.log('save called for slot: ', slot);

  let customName = '';

  if (slot === 'autoSave') {
    commenceSaving();
  } else {
    // showConfirmation: personalized comment?
    showConfirmation(...messageArgs, parent, 'Would you like to enter a personalized comment for this game?', nameSaveSlot, commenceSaving);

    // Yes: input name for save slot
    function nameSaveSlot() {
      let slotName = '';
      if (minerSaves[slot].hasCustomName) {
        slotName = minerSaves[slot].name;
      }

      showInput(...messageArgs, parent, slotName, getCustomName, commenceSaving);
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
      gameData = deepClone(saveGame(gameData, slot, customName));
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
  // Object.assign(gameData, loadGame(slot));
  gameData = {};
  gameData = await loadGame(slot);
  showProgressWindow(parent, resetupdate, false, ...closeFunctions);
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
  // Debug mode
  if (gameData.day > 1) {
    sellPrice.text = gameData.sellPrice = window.gameData.sellPrice;

    console.log('Debug window.gameData.sellPrice: ', window.gameData.sellPrice);
    console.log('Debug gameData.sellPrice: ', gameData.sellPrice);
  }

  // Update day text
  dayText.text = gameData.day += days;

  // Update sold diridium today boolean
  gameData.soldToday = false;

  // Update map progress on every level
  // After animation finishes callback to update reports
  const updatedMaps = updateMapProgress(days);
  updateMineSurface('Updating...', gameData.level, updatedMaps, false, () => updateStats(days));
  gameData.maps = deepClone(updatedMaps);

  // Change price of Diridium
  console.log('>> Update Diridium price...');
}

function updateStats(days) {
  // Deduct worker wages
  creditText.text = gameData.credits -= days * gameData.wage * gameData.workers;

  // Short circuit if mother ship is active
  // Note: To match experience of original game, use 21 not 22
  if (gameData.day < 21) {
    let mTemp = gameData.morale;
    mTemp = Math.floor(mTemp + (days * (gameData.wage - (gameData.sellPrice * (21 + gameData.difficulty))) / 200));
    gameData.morale = Math.floor(((gameData.morale * 2) + mTemp) / 3);
    console.log('Mothership debug - gameData.morale: ', gameData.morale);
    if (gameData.morale > 100) gameData.morale = 100;
    updateReports(days);
    return;

    /*
    a,b int
    c,d float
    c=morale;
    d=a; (days)
    c=c+(d*(wage-(sellprice*(21+diff)))/200);
    morale=((morale*2)+c)/3;
    if (morale>100) morale=100;
    return;
    */
  }

  // Update game stats
  console.log('>> Update game stats...');

  // Assign previous values
  gameData.workersPrev = gameData.workers;
  gameData.moralePrev = gameData.morale;
  gameData.jobsPrev = gameData.jobs;

  // Temp variables
  let b = 0; // reusable temporary variable, use Math.floor()
  let mTemp = gameData.morale; // temporary variable for morale calculation
  let warnings = ''; // empty string to build up warnings

  // Order matters for these calculations
  // Morale
  if (gameData.food < 90) mTemp -= days / 3;
  if (gameData.food > 99) mTemp += days / 6;
  if (gameData.food < 70) mTemp -= days / 3;
  if (gameData.occupancy > 150) mTemp -= days / 6;
  if (gameData.occupancy > 200) mTemp -= days / 3;
  if (gameData.occupancy < 60) mTemp += days / 6;
  mTemp += days * (gameData.wage - (gameData.sellPrice * (22 + gameData.difficulty))) / 100;
  mTemp += 2 * days * (100 - gameData.jobs) / 100;
  if (gameData.deathRate > 5) mTemp -= days / 4;
  if (gameData.deathRate > 15) mTemp -= days / 3;
  if (gameData.deathRate < 1) mTemp += days / 6;
  if (gameData.health > 99) mTemp += days / 6;
  if (gameData.health < 90) mTemp -= days / 3;
  if (gameData.health < 70) mTemp -= days / 3;
  if (gameData.lifeSupport < 90) mTemp -= days / 3;
  gameData.morale = Math.floor((gameData.morale + mTemp) / 2);
  if (gameData.morale > 100) gameData.morale = 100;
  if (gameData.morale < 0) gameData.morale = 0;
  if (
    gameData.morale < 60
    && gameData.morale > 29
    && randomNum(0, 10) === 1
  )
    queueMessage('NEWS FLASH: Riots are breaking out all over! Workers are revolting against poor working conditions.');
  if (gameData.morale < 30)
    queueMessage('NEWS FLASH: Workers threatening to remove you from the station unless working conditions are improved quickly.');

  // Workers
  // TODO: why is workers amount reducing too fast? Ex: -1 in 7 days - This might be fixed?
  if (gameData.day > 20) {
    b = 0;
    let calc1 = days * (gameData.wage - (700 * gameData.sellPrice / (17 - (2 * gameData.difficulty)))) / 700;
    console.log('Debug workers - days: ', days);
    console.log('Debug workers - calc1: ', calc1);

    b = b + Math.floor(days * (gameData.wage - (700 * gameData.sellPrice / (17 - (2 * gameData.difficulty)))) / 700);
    console.log('Debug workers - b1: ', b);

    if (gameData.morale > 89) b += 2 * days;
    if (gameData.morale < 80) b -= 2 * days;
    if (gameData.jobs < 80) b += 3 * days;
    if (gameData.jobs > 99) b -= 3 * days;
    console.log('Debug workers - b2: ', b);

    gameData.workers = gameData.workers - Math.floor(gameData.workers * gameData.deathRate / 100 * days / 365);
    let calc2 = gameData.workers * gameData.deathRate / 100 * days / 365;
    console.log('Debug workers - calc2: ', calc2);
    console.log('Debug workers - gameData.workers 1: ', gameData.workers);

    gameData.workers = gameData.workers + Math.ceil(b * (gameData.workers + 1) / 100);
    let calc3 = b * (gameData.workers + 1) / 100;
    console.log('Debug workers - calc3: ', calc3); // here, reduce by 1 instead of 2
    console.log('Debug workers - gameData.workers 2: ', gameData.workers);

    if (gameData.workers < 1) gameData.workers = 1;
    console.log('Debug workers - gameData.workers 3: ', gameData.workers);
    /*
  ``b=0;
    b=b+(a*(wage-(700*sellprice/(17-(2*diff))))/700);
    if (morale>89) b=b+(2*a);
    if (morale<80) b=b-(2*a);
    if (jobs<80) b=b+(3*a);
    if (jobs>99) b=b-(3*a);
      lworker=worker;
      worker=worker-(worker*drate/100*a/365);
      worker=worker+(b*(worker+1)/100);
      if (worker<1) worker=1;
    */
  }

  // Jobs (Work Force)
  // The percent of jobs occupied by workers
  b = (countBuildingsByName('Construction Site') * 5)
    + countBuildingsByName('Bulldozer')
    + (countBuildingsByName('Diridium Mine') * 30)
    + (countBuildingsByName('Hydroponics') * 12)
    + (countBuildingsByName('Life Support') * 15)
    + countBuildingsByName('Quarters')
    + (countBuildingsByName('Space Port') * 20)
    + (countBuildingsByName('Power Plant') * 30)
    + (countBuildingsByName('Processor') * 20)
    + (countBuildingsByName('Sickbay') * 12)
    + (countBuildingsByName('Storage') * 12);

  if (b) Math.floor(gameData.jobs = gameData.workers * 100 / b);
  else gameData.jobs = gameData.workers * 100;

  // Efficiency
  let tempEfficiency = 0;
  b = countBuildingsByName('Bulldozer')
    + (countBuildingsByName('Diridium Mine') * 5)
    + (countBuildingsByName('Hydroponics') * 5)
    + (countBuildingsByName('Life Support') * 7)
    + (countBuildingsByName('Space Port') * 1)
    + (countBuildingsByName('Processor') * 10)
    + (countBuildingsByName('Sickbay') * 3)
    + (countBuildingsByName('Storage') * 1);

  if (b) tempEfficiency = Math.floor(100 * (countBuildingsByName('Power Plant') * 100) / b);

  if (tempEfficiency < 80) warnings += ', Brownouts';

  if (countBuildingsByName('Power Plant') === 0 && gameData.day > 21) {
    warnings += ' (now on emergency batteries)';
  }

  if (tempEfficiency > 100) tempEfficiency = 100;
  gameData.efficiency = Math.floor(((tempEfficiency * gameData.jobs / 100) + gameData.efficiency) / 2);
  if (gameData.efficiency > 100) gameData.efficiency = 100;
  if (gameData.efficiency < 0) gameData.efficiency = 0;
  console.log('Gabrien updateStats gameData.efficiency: ', gameData.efficiency);
  console.log('Gabrien tempEfficiency: ', tempEfficiency);
  console.log('Gabrien gameData.jobs: ', gameData.jobs);

  // Diridium
  let p = countBuildingsByName('Processor');
  let s = countBuildingsByName('Storage');
  b = Math.floor((countBuildingsByName('Diridium Mine') * gameData.efficiency * days * 15) * gameData.miningEfficiency / 100);
  if (b > (p * gameData.efficiency * days * 60))
    b = p * gameData.efficiency * days * 60;
  gameData.diridium += b;
  if (gameData.diridium > ((s * 50000) + (p * 500)))
    gameData.diridium = (s * 50000) + (p * 500);

  // Sell price
  let r = randomNum(0, 50);
  if (r === 0) {
    gameData.sellPrice += Math.floor(gameData.sellPrice * ((randomNum(0, 3) + 5) * days) / 100);
    queueMessage('NEWS FLASH: Pirates are stealing cargos of diridium, prices have risen.');
  }
  if (r === 1) {
    gameData.sellPrice -= Math.floor(gameData.sellPrice * ((randomNum(0, 3) + 5) * days) / 100);
    queueMessage('NEWS FLASH: Large vein of diridium discovered, prices falling.');
  }
  if (r > 1) {
    if (gameData.sellPrice > 10) gameData.sellPrice += Math.floor(gameData.sellPrice * ((randomNum(0, 4) - 2) * days) / 100);
    if (gameData.sellPrice <= 10) gameData.sellPrice += (randomNum(0, 3) - 1) * days;
  }
  if (gameData.sellPrice > 50) gameData.sellPrice -= 5;
  if (gameData.sellPrice < 5) gameData.sellPrice = 5;
  if (
    gameData.sellPrice < 10
    && randomNum(0, 3) === 1
  ) gameData.sellPrice += Math.floor(days / 10);

  // Occupancy
  let q = countBuildingsByName('Quarters');
  if (q) gameData.occupancy = Math.floor(100 * gameData.workers / (q * 150));
  else gameData.occupancy = -1;

  // Food
  let h = countBuildingsByName('Hydroponics');
  if (h) gameData.food = Math.floor((gameData.food + 100 * h * 200 / gameData.workers) / 2);
  else gameData.food = -1;
  if (gameData.food > 100) gameData.food = 100;

  // Health
  let sb = countBuildingsByName('Sickbay');
  if (sb) {
    b = 100 * sb * 300 / gameData.workers;
    gameData.health = Math.floor((b + gameData.health) / 2);
  }
  else gameData.health = -1;
  if (gameData.health > 100) gameData.health = 100;

  // Life support
  let l = countBuildingsByName('Life Support');
  if (l) gameData.lifeSupport = Math.floor((gameData.lifeSupport + (100 * (l * 400) / gameData.workers)) / 2);
  else gameData.lifeSupport = -1;
  if (gameData.lifeSupport > 100) gameData.lifeSupport = 100;
  if (
    gameData.lifeSupport > 0
    && countBuildingsByName('Power Plant') === 0
  )
    gameData.lifeSupport = Math.floor(gameData.lifeSupport * 2 / 3);
  b = 0;
  if (gameData.lifeSupport > 90) b -= days;
  if (gameData.lifeSupport < 70) b += Math.floor(days / 2);
  if (gameData.lifeSupport < 50) {
    b += days;
    warnings += ', Low Life Support';
    if (gameData.lifeSupport === -1) b += days;
  }
  if (gameData.lifeSupport === -1) b += days;
  if (gameData.food > 90) b -= days;
  if (gameData.food < 50) b += days;
  if (gameData.food < 80) {
    b += Math.floor(days / 2);
    warnings += ', Low Food Supply';
  }
  if (gameData.health > 90) b -= days;
  if (gameData.health < 80) {
    b += Math.floor(days / 2);
    warnings += ', Poor Health';
  }
  if (gameData.health < 30) b += days;


  /*
    if (ocount[10]>0)
    life=(life+(100*(ocount[10]*400)/worker))/2;
    else
      life=-1;
    if (life>100) life=100;
    if ((life>0)&&(ocount[13]==0)) life=life*2/3;
    b=0;
    if (life>90) b=b-a;
    if (life<70) b=b+(a/2);
    if (life<50) {
      b=b+a;
      warn=warn+", Low Life Support";
    if (life==-1) b=b+a;
    }
    if (life==-1) b=b+a;
    if (food>90) b=b-a;
    if (food<50) b=b+a;
    if (food<80){
      b=b+(a/2);
      warn=warn+", Low Food Supply";
    }
    if (health>90) b=b-a;
    if (health<80){
      b=b+(a/2);
      warn=warn+", Poor Health";
    }
    if (health<30) b=b+a;
  */



  // Death rate
  // IMPORTANT: Preserve value of 'b' from Life Support
  gameData.deathRate = Math.floor(((gameData.deathRate * 2) + b) / 2);

  if (gameData.deathRate >= 100) {
    gameData.deathRate = 100;
    queuedMessages = '';
    showMessage(...messageArgs, mineScreen, 'NEWS FLASH: With the asteriod mine death rate rising to 100%, the Space Guard has intervened to rescue the remaining workers. A reward is offered for the capture of those responsible.', () => endGame(false));
    return;
  }
  if (gameData.deathRate < 0) gameData.deathRate = 0;

  // Warning message
  if (warnings) {
    queueMessage(`WARNING: ${warnings.slice(2)} threatening the mining operation.`);
  }

  // Auto save gameData
  if (gameData.autosaveEnabled) save('autoSave', false);

  // Order matters for 1-4 here:
  // 1. Check random event
  checkRandomEvent(days);
  // showRandomEventMessageQueue();

  // 2. Update reports
  updateReports(days);

  // 3. Check disaster
  disaster();
  // showDisasterMessageQueue();

  // 4. Check ending
  // Note: Check ending calls showQueuedMessages()
  checkEnding();

  // Debug mode
  console.log('gameData: ', gameData);
  window.gameData = deepClone(gameData);
}

// Check random event
// see line 2498
function checkRandomEvent(days) {
  const randNum = randomNum(0, 700); // (0,700)
  // console.log(`>> Check random event: ${randNum}`);

  if (randNum === 0) {
    const shift = randomNum(0, 90) + 5;
    queueMessage(`NEWS FLASH: Strange electromagnetic storm causes time shift. Time suddenly advances ${shift} days.`, () => {
      dayText.text = gameData.day += shift;
    });
  }

  if ((randNum === 1) || ((countBuildings(4) === 0) && (randomNum(0, (17 - days)) === 1))) {
    let randLevel = randomNum(1, 3);
    let foundOre = false;
    const updatedMaps = deepClone(gameData.maps);
    for (let i = 1; i < 3; i++) {
      let randRow = randomNum(0, 9);
      let randCol = randomNum(0, 9);
      if (updatedMaps[`level${randLevel}`][`row${randRow}`][randCol] < 4) {
        updatedMaps[`level${randLevel}`][`row${randRow}`][randCol] = 4;
        foundOre = true;
      }
    }
    if (foundOre) {
      queueMessage(`NEWS FLASH: Geologic survey discovers new diridium veins on level ${randLevel}.`, () => {
        if (`level${randLevel}` === gameData.level) updateMineSurface('Updating...', gameData.level, updatedMaps, false, doNothing);
        gameData.maps = deepClone(updatedMaps);
      });
    }
  }

  if (randNum === 2 && gameData.efficiency < 100) {
    queueMessage('NEWS FLASH: New processor technology temporarily boosts mining efficiency to 100%');
    gameData.efficiency = 100;
    // Question: should it last longer than one turn?
    // No, it decays on its own.
  }

  if (randNum === 3) {
    queueMessage("NEWS FLASH: Alien artifact discovered! News of discovery boosts morale to 100%");
    gameData.morale = 100;
  }

  if (randNum === 4) {
    const amt = randomNum(0, 100) * 50;
    queueMessage(`NEWS FLASH: Rich diridium vein discovered. Stored diridium increased by ${amt} tons.`);
    gameData.diridium += amt;
  }

  if (randNum === 5
    && gameData.credits > 30000
    && gameData.miningEfficiency < 100) {
    const cost = (randomNum(0, 15) + 15) * 1000;

    const payForService = () => {
      creditText.text = gameData.credits -= cost;
      if (randomNum(0, 3) > 1) {
        queueMessage('Modifications complete. Mining efficiency improved by up to 20%.', () => {
          gameData.miningEfficiency += 20;
          if (gameData.miningEfficiency > 100) gameData.miningEfficiency = 100;
        });
      }
      else queueMessage("You've been swindled! The visitor took your money and fled. Too bad you can't trust everyone.");
    };

    queueMessage(`A visitor claiming to be an engineer has offered to increase the daily output of your mines for ${cost} credits. Will you pay for this service?`, doNothing, true, payForService, doNothing);
  }

  if (randNum === 6) {
    const percent = (randomNum(0, gameData.difficulty) * 10) + 10;
    queueMessage(`NEWS FLASH: Workers are leaving for a better work offer at a rival mining company. ${percent}% of workers have left your mining colony.`);
    reportWorkers.text = gameData.workers -= Math.floor(gameData.workers * percent / 100);
  }
}

function updateReports(days) {
  console.log('>> Update report info...');

  // =================
  // Operations Report
  // =================

  // Workers (highlight if negative)
  let workersDiff = gameData.workers - gameData.workersPrev;
  // console.log('workersDiff: ', workersDiff);
  reportWorkers.tint = workersDiff < 0 ? 0xFFFFFF : 0x000000;
  reportWorkersHighlight.visible = workersDiff < 0 ? true : false;
  reportWorkers.text = `${gameData.workers}(${workersDiff})`;
  // console.log('updateReports reportWorkers.width: ', Math.ceil(reportWorkers.width));
  reportWorkersHighlight.width = Math.ceil(reportWorkers.width);

  // Workforce (highlight if low)
  reportWorkForce.tint = gameData.jobs < 50 ? 0xFFFFFF : 0x000000;
  reportWorkForceHighlight.visible = gameData.jobs < 50 ? true : false;
  reportWorkForce.text = `${Math.floor(gameData.jobs)}%`;
  reportWorkForceHighlight.width = Math.ceil(reportWorkForce.width);

  // Morale (highlight if low)
  reportMorale.tint = gameData.morale < 70 ? 0xFFFFFF : 0x000000;
  reportMoraleHighlight.visible = gameData.morale < 70 ? true : false;
  reportMorale.text = `${gameData.morale}%(${gameData.morale - gameData.moralePrev})`;
  reportMoraleHighlight.width = Math.ceil(reportMorale.width);

  // Life support (highlight if low)
  if (gameData.lifeSupport < 80) {
    reportLifeSupport.tint = 0xFFFFFF;
    reportLifeSupportHighlight.visible = true;
    reportLifeSupportHighlight.width = Math.ceil(reportLifeSupport.width);
  }
  if (gameData.lifeSupport > 0) {
    if (gameData.lifeSupport < 80) {
      reportLifeSupport.tint = 0xFFFFFF;
      reportLifeSupportHighlight.visible = true;
      reportLifeSupportHighlight.width = Math.ceil(reportLifeSupport.width);
    }
    reportLifeSupport.text = `${gameData.lifeSupport}%`;
    reportLifeSupport.tint = 0x000000;
    reportLifeSupportHighlight.visible = false;
  } else {
    reportLifeSupport.text = '---';
    reportLifeSupportHighlight.width = Math.ceil(reportLifeSupport.width);
  }

  // Food supply (highlight if low)
  if (gameData.food > 0) {
    reportFoodSupply.tint = gameData.food < 80 ? 0xFFFFFF : 0x000000;
    reportFoodSupplyHighlight.visible = gameData.food < 80 ? true : false;
    reportFoodSupply.text = `${gameData.food}%`;
    reportFoodSupplyHighlight.width = Math.ceil(reportFoodSupply.width);
  } else reportFoodSupply.text = '---';

  // Health (highlight if low)
  if (gameData.health > 0) {
    reportHealth.tint = gameData.health < 80 ? 0xFFFFFF : 0x000000;
    reportHealthHighlight.visible = gameData.health < 80 ? true : false;
    reportHealth.text = `${gameData.health}%`;
    reportHealthHighlight.width = Math.ceil(reportHealth.width);
  } else reportHealth.text = '---';

  // Occupancy (highlight if high)
  if (gameData.occupancy > 0) {
    reportOccupancy.tint = gameData.occupancy > 120 ? 0xFFFFFF : 0x000000;
    reportOccupancyHighlight.visible = gameData.occupancy > 120 ? true : false;
    reportOccupancy.text = `${gameData.occupancy}%`;
    reportOccupancyHighlight.width = Math.ceil(reportOccupancy.width);
  } else reportOccupancy.text = '---';

  // Death rate (highlight if high)
  reportDeath.tint = gameData.deathRate > 20 ? 0xFFFFFF : 0x000000;
  reportDeathHighlight.visible = gameData.deathRate > 20 ? true : false;
  reportDeath.text = `${gameData.deathRate}%`;
  reportDeathHighlight.width = Math.ceil(reportDeath.width);

  // =================
  // Production Report
  // =================

  // Temp variables
  let b = 0; // Building count
  let p = 0; // Projected credits
  let pr = 0; // Processor rate
  let sr = 0; // Storage rate
  let ppr = 0; // Power rate
  let dc = countBuildingsByName('Diridium Mine');
  let pc = countBuildingsByName('Processor');
  let sc = countBuildingsByName('Storage');
  let ppc = countBuildingsByName('Power Plant');

  b = countBuildingsByName('Bulldozer')           // ocount[6]
    + (countBuildingsByName('Diridium Mine') * 5) // (ocount[7]*5)
    + (countBuildingsByName('Hydroponics') * 5)   // (ocount[8]*5)
    + (countBuildingsByName('Life Support') * 7)  // (ocount[10]*7)
    + (countBuildingsByName('Space Port') * 1)    // (ocount[12]*1)
    + (countBuildingsByName('Processor') * 10)    // (ocount[14]*10)
    + (countBuildingsByName('Sickbay') * 3)       // (ocount[15]*3)
    + (countBuildingsByName('Storage') * 1);      // (ocount[16]*1);

  // Asteroid class, ex: 'Class 2'
  reportClass.text = `Class ${gameData.difficulty.toString()}`;

  // # of Mines
  reportMines.text = `${dc}`;

  // Processors, ex: None or %
  pr = Math.floor((((dc * gameData.efficiency * 15) * gameData.miningEfficiency) / (pc * gameData.efficiency * 60)));
  if (pc) {
    reportProcessors.tint = pr > 100 ? 0xFFFFFF : 0x000000;
    reportProcessorsHighlight.visible = pr > 100 ? true : false;
    reportProcessors.text = `${pr}%`;
    reportProcessorsHighlight.width = Math.ceil(reportProcessors.width);
  } else reportProcessors.text = 'None';

  // Storage, ex: %
  if (sc) sr = Math.floor(100 * gameData.diridium / ((sc * 50000) + (pc * 500)));
  reportStorage.tint = sr === 100 ? 0xFFFFFF : 0x000000;
  reportStorageHighlight.visible = sr === 100 ? true : false;
  reportStorage.text = `${sr}%`;
  reportStorageHighlight.width = Math.ceil(reportStorage.width);

  // Power, ex: %
  // IMPORTANT: Preserve b from above
  if (ppc) ppr = Math.floor(100 * (ppc * 100) / b);
  if ((ppr > 100) || (gameData.day < 21))
    ppr = 100;
  reportPower.tint = ppr < 90 ? 0xFFFFFF : 0x000000;
  reportPowerHighlight.visible = ppr < 90 ? true : false;
  reportPower.text = `${ppr}%`;
  reportPowerHighlight.width = Math.ceil(reportPower.width);

  // Diridium
  reportDiridium.text = `${gameData.diridium} ${gameData.diridium < 100000 ? 'tons' : 'tns'}`;
  updateDiridiumStorageIcon();

  // 30-Day projected credits
  p = Math.floor((dc * gameData.efficiency * 30 * 15) * gameData.miningEfficiency / 100);
  console.log('p: ', p);
  console.log('dc: ', dc);
  console.log('gameData.efficiency: ', gameData.efficiency);
  console.log('gameData.miningEfficiency: ', gameData.miningEfficiency);

  if (p > (pc * gameData.efficiency * 30 * 60))
    p = pc * gameData.efficiency * 30 * 60;
  p = (p * gameData.sellPrice)
    + (gameData.diridium * gameData.sellPrice)
    + gameData.credits
    - (gameData.wage * gameData.workers * 30);
  report30Day.tint = p < 0 ? 0xFFFFFF : 0x000000;
  report30DayHighlight.visible = p < 0 ? true : false;
  report30Day.text = `${p}`;
  report30DayHighlight.width = Math.ceil(report30Day.width);
}

function updateDiridiumStorageIcon() {
  const diridiumStoragePointerDown = () => true;
  const diridiumStoragePointerUp = () => {
    if (gameData.diridium <= 0) {
      showMSMessage('You currently have no diridium to sell.');
      return;
    }

    if (countBuildingsByName('Space Port') === 0) {
      if (!gameData.soldToday) {
        showMessage(...messageArgs, optionsMenu, 'A space port allows the sale and transfer of diridium to ships. Without a space port, only one sale up to 700 tons can be sold per day.', () => show(sellDiridiumDialog, mineScreen));

        if (gameData.diridium > 700) sellAmountText.text = sellAmount = 700;
        else sellAmountText.text = sellAmount = gameData.diridium;
      } else {
        showMSMessage('Prior sale still being transfered. Build a space port or wait until tomorrow to sell more diridium.');
      }
    } else {
      sellAmountText.text = sellAmount = gameData.diridium;
      show(sellDiridiumDialog, mineScreen);
    }
  };
  const diridiumStorageButton = { width: 14, height: 13, x: 0, y: 0 };
  const diridiumStorageHitzone = { width: 14, height: 13, x: 0, y: 0 };
  const storage = Math.floor(
    100 * gameData.diridium / (
      (countBuildingsByName('Storage') * 50000)
      + (countBuildingsByName('Processor') * 500)
    )
  );

  if (storage < 33) {
    storageIcon = storage00;
    storageIconInverted = storage00Inverted;
  }
  if (storage < 66 && storage >= 33) {
    storageIcon = storage33;
    storageIconInverted = storage33Inverted;
  }
  if (storage < 99 && storage >= 66) {
    storageIcon = storage66;
    storageIconInverted = storage66Inverted;
  }
  if (storage >= 99) {
    storageIcon = storage99;
    storageIconInverted = storage99Inverted;
  }

  // Clear container children in order to update sprite textures
  storageIconContainer.removeChildren();

  // Add button inside storage icon container
  buildSpriteButton(storageIconContainer, diridiumStorageButton, diridiumStorageHitzone, storageIcon, storageIconInverted, diridiumStoragePointerDown, diridiumStoragePointerUp);
}

// Check disaster
// see line 2325
// random(20*(6-diff))
function disaster() {
  const num = randomNum(0, (20 * (6 - gameData.difficulty)));
  console.log(`>> Check disaster: ${num}`);
}

// Check ending
// see line 2600
function checkEnding() {
  console.log('>> Inside checkEnding()');

  // Worker Revolt
  if (gameData.morale < 30 && randomNum(0, 11) < gameData.difficulty) {
    // console.log(`>> Ending: Worker Revolt`);
    eventMessages.hasEndingMessage = true;
    eventMessages.endingMessage = function() {
      showMessage(...messageArgs, mineScreen, 'DISASTER: You have been forced out of an airlock by angry workers! At least the workers let you put your suit and helmet on first. A nearby ship rescues you.', () => endGame(false, 'Worker Revolt'));
      delete this.hasEndingMessage;
      this.hasEndingMessage = false;
      delete this.endingMessage;
    }
  }

  // Insufficient Funds
  // see line 2608
  if (((gameData.credits + (gameData.diridium * gameData.sellPrice)) < 0) && (gameData.credits < 0)) {
    // console.log(`>> Ending: Insufficient Funds`);
    // Auto save gameData
    if (gameData.autosaveEnabled) save('autoSave', false);

    queueMessage('You do not have enough processed diridium to cover your debts.');

    if (gameData.creditFlag < (6 - gameData.difficulty)) {
      queueMessage(`Your credit has been extended to cover ${0 - gameData.credits} credits in debt. A lein is place on future processed ore. Cut costs immediately!`, () => {
        creditText.text = gameData.credits = 0;
        reportDiridium.text = `${gameData.diridium} ${gameData.diridium < 100000 ? 'tons' : 'tns'}`;
      });
      gameData.diridium += Math.floor(gameData.credits / gameData.sellPrice);
      updateDiridiumStorageIcon();
      gameData.creditFlag += 1;

      // Reminder
      console.log('>> Reminder: Update diridium storage icon fill level');

      if (gameData.creditFlag >= (6 - gameData.difficulty)) {
        // Auto save gameData
        if (gameData.autosaveEnabled) save('autoSave', false);
        queueMessage('WARNING: Your creditors refuse any future extension of your credit. Watch your expenses carefully.');
      }
    } else {
      eventMessages.hasEndingMessage = true;
      eventMessages.endingMessage = function() {
        showMessage(...messageArgs, mineScreen, 'Your creditors will not exend you further credit. You have been terminated and creditors have taken over your mining operation. Don\'t ask for any recommendation letters.', () => endGame(false, 'Insufficient Funds'));
        delete this.hasEndingMessage;
        this.hasEndingMessage = false;
        delete this.endingMessage;
      }
    }
  }

  showQueuedMessages();

  // End of 2 years
  // see line 2015
  // hiscore is credits, see line 2036
  if (gameData.day > 730) {
    console.log(`>> Ending: SUCCESS`);
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

function updateMapProgress(days) {
  // console.log('>> Updating map progress: generate new map for each level with updated progress');
  const updatedMaps = deepClone(gameData.maps);
  // Traverse each level
  for (const level in updatedMaps) {
    // Traverse each row object
    for (let row in updatedMaps[level]) {
      // console.log('Gabrien row: ', row);
      updatedMaps[level][row] = updatedMaps[level][row].map(num => {
        // Bulldozer doesn't behave like other
        // construction sites. It becomes a Clear Area.
        if (num === 107) return num = 1;

        // Reduce construction sites
        if (num > 100) {
          if (days * 100 > num) return num %= 100;
          else return num -= days * 100;
        }

        // Everyting else stays the same
        return num;
      });
    }
  }
  return updatedMaps;
}

// Shop
function shop(sprite, id) {
  if (shopItems[id].name === gameData.shopBtn) {
    // Click active shop button to unselect it
    // Disabling this for now (may re-enable later)
    // clearShop();
  } else {
    clearShop();
    sprite.visible = true;
    storeText.text = gameData.shopBtn = shopItems[id].name;
    // storeText.dirty = true;
    storePrice.text = gameData.shopPrice = getPrice(id);
    // storePrice.dirty = true;

    if (getPrice(id) > gameData.credits) {
      storeText.tint = 0xFFFFFF;
      storeTextHighlight.visible = true;
    }
  }
}

function clearShop() {
  shopButtons.map(b => b.visible = false);
  storeText.text = gameData.shopBtn = '';
  storeText.tint = 0x000000;
  storePrice.text = gameData.shopPrice = '';
  storeTextHighlight.visible = false;
}

function getPrice(id) {
  return (shopItems[id].price * gameData.multiplier).toString();
}

function resetShop() {
  clearShop();
  shop(bulldozerOn, 'bulldozer')
}

function resetButtons() {
  updateLevelButtons('level1');
}

function undo() {
  if (undoData.hasUndo) {
    undoData.hasUndo = false;

    console.log('Before gameData.credits: ', gameData.credits);

    gameData.credits += undoData.undoPrice;
    console.log('After gameData.credits: ', gameData.credits);

    creditText.text = gameData.credits.toString();

    gameData.maps[undoData.undoLevel][`row${undoData.undoY}`][undoData.undoX] = undoData.undoNum;

    drawMap(gameData.maps[gameData.level]);
  } else {
    showMessage(...messageArgs, mineScreen, 'There is nothing that can be undone.', doNothing);
  }
}


// Show / Close
function gotoMineScreen(isLoadedGame = false) {
  // console.log('inside gotoMineScreen');

  remove(startScreen);
  show(mineScreen);
  mineScreen.interactiveChildren = true;

  // Only generate map if it's not loading a game
  if (!isLoadedGame) {
    gameData.maps = newMaps = generateMaps(gameData.difficulty);
  } else {
    newMaps = deepClone(gameData.maps);

    // console.log('gotoMineScreen gameData.level: ', gameData.level);
    updateLevelButtons('level1');
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
    buildAsteroidHitZones();
    drawZonesOnce = true;
  }

  updateReports(0);
  updateMineSurface('Mapping...', 'level1', newMaps, true);
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

function endGame(hasConfirmation = true, failure = '') {
  if (failure) {
    missionStatus1.text = `Mission Status: FAILURE on day ${gameData.day}`;
    missionStatus2.text = `Cause: ${failure}`;
    endGameFunctions();
  } else {
    missionStatus1.text = `Mission Status: RESIGNED on day ${gameData.day}`;
    missionStatus2.text = `Credits Remaining: ${gameData.credits}`;
  }

  if (hasConfirmation) {
    showConfirmation(...messageArgs, optionsMenu, 'Are you sure you want to resign? (This will end your current colony.)', endGameFunctions, doNothing);
  } else endGameFunctions();

  function endGameFunctions() {
    closeOptions();
    remove(mineScreen);
    show(startScreen);
    resetGameData();
    resetAutosave();
    resetupdate();
    show(gameOver);
  }
}

function gameOverNewMine() {
  // Check for Auto save
  if (!minerSaves.autoSave.empty) {
    showConfirmation(...messageArgs, gameOver, 'Starting a new mining colony will overwrite an active mining colony. Do you wish to proceed?', continueGameOver, () => { return; });
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
  resetupdate();
  remove(gameOver, startScreen);
}


// Shortcuts
// Show mineScreen message
function showMSMessage(text) {
  showMessage(...messageArgs, mineScreen, text, doNothing);
}

// Create a queue of mineScreen messages
function queueMessage(
  text,
  callBack = doNothing,  // optional callback for message
  isConfirmation = false,
  callBack1 = doNothing, // optional 'Yes' callback for confirmation
  callBack2 = doNothing  // optional 'No' callback for confirmation
) {
  console.log('Gabrien queueMessage before: ', queuedMessages);
  queuedMessages.push({
    text,
    callBack,
    isConfirmation,
    callBack1,
    callBack2
  });
  console.log('Gabrien queueMessage after: ', queuedMessages);
}

// Show queued mineScreen messages one at a time
let queueCounter = 0;
function showQueuedMessages() {
  queueCounter += 1;
  console.log('Gabrien queueCounter: ', queueCounter);

  if (queuedMessages.length) {
    let msg = queuedMessages.shift();
    if (msg.isConfirmation) {
      showConfirmation(...messageArgs, mineScreen, msg.text, () => {
        msg.callBack1.apply();
        showQueuedMessages();
      }, () => {
        msg.callBack2.apply();
        showQueuedMessages();
      }
      );
    } else showMessage(...messageArgs, mineScreen, msg.text, () => {
      msg.callBack.apply();
      showQueuedMessages();
    });
  } else if (eventMessages.hasEndingMessage) {
    eventMessages.endingMessage();
    return;
  } else if (eventMessages.hasRandomEventMessage) {

  } else if (eventMessages.hasDisasterMessage) {

  }
}


// Utilities
// Button actions to show / remove screens
// How to export these from another doc, when they need access to app?
function show(sprite, parent) {
  if (parent) parent.interactiveChildren = false;
  app.stage.addChild(sprite);
}

function remove(sprite, parent) {
  if (parent) parent.interactiveChildren = true;
  app.stage.removeChild(sprite);
}

function toggleCheck(sprite, data, parent) {
  if (gameData[data]) {
    gameData[data] = false;
    parent.removeChild(sprite);
  }
  else {
    gameData[data] = true;
    parent.addChild(sprite);
  }
}

function resetGameData() {
  console.log('resetGameData called');
  gameData = {};
  gameData = deepClone(gameDataInit);
  // console.log('resetGameData - gameData: ', gameData);

  // Debug mode
  window.gameData = {};
  window.gameData = deepClone(gameDataInit);
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
