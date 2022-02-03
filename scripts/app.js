import { deepClone } from './utilities.js';
import { random, randomNum } from './random.js';
import { buildHitzone, buildButton } from './button.js';
import { getDifficulty, fillMap, generateMaps } from './maps.js';
import { showMessage, showConfirmation, showInput } from './message.js';
import {
  minerSaves, saveGame, initAutosave, loadGame
} from './saveload.js';
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
  resolution: 1.0 //devicePixelRatio
});
// Scale mode for pixelation
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
document.body.appendChild(app.view);


// Variables
let gameData = {};
let sheet;
let startScreen;
let launchScreen;
let startCover;
let loadMineScreen;
let instructionsScreen;
let selectAsteroidTitle;
let mineScreen;
let topBarCover, topBarText;
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
let mapSquare;
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




// Styles
const barText = {
  fontName: 'Palm OS Bold',
  fontSize: 16,
};

const bold = {
  fontName: 'Palm OS Bold',
  fontSize: 16,
  tint: 0x000000
};

const regular = {
  fontName: 'Palm OS',
  fontSize: 16,
  tint: 0x000000
};


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
      init();
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
  // Cover for start screen
  startCover = new PIXI.Graphics();
  startCover.beginFill(0xFFFFFF);
  startCover.drawRect(5, 5, 150, 120);
  startCover.endFill();
  // Launch Screen
  launchScreen = new PIXI.Sprite.from(sheet.textures['screen launch control2.gif']);
  launchScreen.x = 0;
  launchScreen.y = 0;
  // Load Mine Screen
  loadMineScreen = new PIXI.Sprite.from(sheet.textures['screen load mine.gif']);
  loadMineScreen.x = 0;
  loadMineScreen.y = 13;
  // Instructions Screen
  instructionsScreen = new PIXI.Sprite.from(sheet.textures['screen instructions.gif']);
  instructionsScreen.x = 0;
  instructionsScreen.y = 0;
  // Select Asteroid Screen
  selectAsteroidTitle = new PIXI.Sprite.from(sheet.textures['select asteroid title.gif']);
  selectAsteroidTitle.x = 5;
  selectAsteroidTitle.y = 3;
  //
  // Game screens
  mineScreen = new PIXI.Sprite.from(sheet.textures['screen game.gif']);
  mineScreen.x = 0;
  mineScreen.y = 0;
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
  // Message
  messageTop = new PIXI.Sprite.from(sheet.textures['message top.gif']);
  messageTop.x = 0;
  messageTop.y = 0; // make this dynamic to text's maxLineHeight?
  messageBottom = new PIXI.Sprite.from(sheet.textures['message bottom.gif']);
  messageBottom.x = 0;
  messageBottom.y = 160;
  messageBottom.anchor.set(0,1);
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
  level1On.position.set(115,28);
  level1On.visible = true;
  mineScreen.addChild(level1On);
  level2On = new PIXI.Sprite.from(sheet.textures['button level2 seleced.gif']);
  level2On.position.set(130,28);
  level2On.visible = false;
  mineScreen.addChild(level2On);
  level3On = new PIXI.Sprite.from(sheet.textures['button level3 selected.gif']);
  level3On.position.set(146,28);
  level3On.visible = false;
  mineScreen.addChild(level3On);

  // Shop sprites selected
  bulldozerOn = new PIXI.Sprite.from(sheet.textures['button bulldozer selected.gif']);
  bulldozerOn.position.set(6,119);
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
  underline.anchor.set(0,1);
  underline.visible = false;
  // messageBottom.addChild(underline);
  // Cursor
  cursor = new PIXI.Sprite.from(sheet.textures['cursor.gif']);
  cursor.position.set(6, -25);
  cursor.anchor.set(0,1);
  cursor.visible = false;
  // messageBottom.addChild(cursor);



  // Text
  // Launch Screen Probes
  probeNum = new PIXI.BitmapText(gameData.probes, regular);
  probeNum.x = 25;
  probeNum.y = 127;
  launchScreen.addChild(probeNum);
  // Load Mine Screen Text
  loadAutosave = new PIXI.BitmapText(minerSaves.autoSave.name, regular);
  loadAutosave.x = 55;
  loadAutosave.y = 37;
  loadAutosave.anchor = (0.5,0.5);
  loadMineScreen.addChild(loadAutosave);
  load1 = new PIXI.BitmapText(minerSaves.save1.name, regular);
  load1.x = 55; //29
  load1.y = 57; //52;
  load1.anchor = (0.5,0.5); // (0,0)
  loadMineScreen.addChild(load1);
  load2 = new PIXI.BitmapText(minerSaves.save2.name, regular);
  load2.x = 55;
  load2.y = 77; // 72;
  load2.anchor = (0.5,0.5);
  loadMineScreen.addChild(load2);
  load3 = new PIXI.BitmapText(minerSaves.save3.name, regular);
  load3.x = 55;
  load3.y = 97; // 92;
  load3.anchor = (0.5,0.5);
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
  // Save Mine text
  saveAutosave = new PIXI.BitmapText(minerSaves.autoSave.name, regular);
  saveAutosave.x = 55;
  saveAutosave.y = 37;
  saveAutosave.anchor = (0.5,0.5);
  saveMineScreen.addChild(saveAutosave);
  save1 = new PIXI.BitmapText(minerSaves.save1.name, regular);
  save1.x = 55; //29;
  save1.y = 57; //52;
  save1.anchor = (0.5,0.5); //(0,0);
  saveMineScreen.addChild(save1);
  save2 = new PIXI.BitmapText(minerSaves.save2.name, regular);
  save2.x = 55; // 29;
  save2.y = 77; // 72;
  save2.anchor = (0.5,0.5); //(0,0);
  saveMineScreen.addChild(save2);
  save3 = new PIXI.BitmapText(minerSaves.save3.name, regular);
  save3.x = 55; // 29;
  save3.y = 97; // 92;
  save3.anchor = (0.5,0.5); //(0,0);
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
  storeText.anchor.set(.5,0);
  mineScreen.addChild(storeText);
  // Store price
  storePrice = new PIXI.BitmapText(gameData.shopPrice.toString(), regular);
  storePrice.position.set(82, 146);
  storePrice.anchor.set(.5,0);
  mineScreen.addChild(storePrice);
  // Diridium text
  sellPrice = new PIXI.BitmapText(gameData.sellPrice.toString(), regular);
  sellPrice.position.set(128, 115);
  sellPrice.anchor.set(.5,0);
  mineScreen.addChild(sellPrice);
  // Wage text
  wage = new PIXI.BitmapText(gameData.wage.toString(), regular);
  wage.position.set(128, 144);
  wage.anchor.set(.5,0);
  mineScreen.addChild(wage);
  // Game Over
  missionStatus1 = new PIXI.BitmapText('', regular);
  missionStatus1.x = 75; //6; //app.stage.width / 2; //80;//8;
  missionStatus1.y = 37;
  // missionStatus1.align = 'center';
  missionStatus1.anchor.set(0.5,0);
  gameOver.addChild(missionStatus1);
  missionStatus2 = new PIXI.BitmapText('', regular);
  missionStatus2.x = 75; //20;
  missionStatus2.y = 52;
  // missionStatus2.align = 'center';
  missionStatus2.anchor.set(0.5,0);
  gameOver.addChild(missionStatus2);
  // Message Title text
  messageTitle = new PIXI.BitmapText('Message', barText);
  messageTitle.x = 80;
  messageTitle.y = 1;
  messageTitle.anchor.set(.5,0);
  messageTop.addChild(messageTitle);
  // Message text
  // messageText = new PIXI.BitmapText('Bulldozing that area will destroy the ore vein. Do you reall want to place a bulldozer there?', bold);
  // messageText = new PIXI.BitmapText('Do you want to bulldoze the Tube on this area?', bold);
  messageText = new PIXI.BitmapText('(message here)', bold);
  messageText.x = 34;
  messageText.y = 21;
  // maxWidth is The max width of the text before line wrapping!!!
  messageText.maxWidth = 121; // 122;
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


  // Hitzones for buttons on sprites
  // Start Screen
  // New Mine button
  buildHitzone(startScreen, 62, 14, 49, 74, newMine);
    // Launch Screen's Up arrow
    buildHitzone(launchScreen, 18, 7, 35, 125, moreProbes);
    // Launch Screen's Down arrow
    buildHitzone(launchScreen, 18, 7, 35, 133, lessProbes);
    // Launch Screen's Launch button
    buildHitzone(launchScreen, 43, 15, 57, 125, launchProbes);
    // Launch Screen's Cancel button
    buildHitzone(launchScreen, 40, 15, 104, 125, () => remove(launchScreen, startScreen));
  // Load Mine button
  buildHitzone(startScreen, 62, 14, 49, 91, () => show(loadMineScreen, startScreen));
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
  buildHitzone(startScreen, 62, 14, 49, 108, () => show(instructionsScreen, startScreen));
    // Instructions Screen's Cancel button
    instructionsCancelStart = buildHitzone(instructionsScreen, 48, 13, 56, 141, () => remove(instructionsScreen, startScreen));
  //
  // Mine Screen
  // Top bar info icon opens instructions screen
  buildHitzone(mineScreen, 16, 15, 145, 0, showMineScreenInstructions);
    // Instructions Screen's Cancel button for mineScreen
    instructionsCancelMine = buildHitzone(instructionsScreen, 48, 13, 56, 141, closeMineScreenInstructions);
    // Disable this hitzone except in the mineScreen
    instructionsCancelMine.interactive = false;
  // Asteroid surface hitzones are added in buildAsteroidHitZones()
  // Levels
  buildHitzone(mineScreen, 14, 13, 114, 27, () => showLevel('level1'));
  buildHitzone(mineScreen, 15, 13, 129, 27, () => showLevel('level2'));
  buildHitzone(mineScreen, 15, 13, 145, 27, () => showLevel('level3'));
  // Reports
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
    buildHitzone(optionsMenu, 65, 11, 15, 98, resign);
    // OK button
    buildHitzone(optionsMenu, 42, 13, 28, 119, closeOptions);
  // Advance 1
  buildHitzone(mineScreen, 14, 13, 114, 85, () => advance(1));
  buildHitzone(mineScreen, 15, 13, 129, 85, () => advance(7));
  buildHitzone(mineScreen, 15, 13, 145, 85, () => advance(14));
  // Sell Diridium
  buildHitzone(mineScreen, 14, 13, 146, 114, sellDiridium);
  // Change Wage
  buildHitzone(mineScreen, 15, 6, 145, 143, wageUp);
  buildHitzone(mineScreen, 15, 6, 145, 150, wageDown);
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

  // TODO
  // Left off trying to get info icon to hide
  // showMessage(...messageArgs, startScreen, 'Welcome to the Mining Colony. Enjoy your stay!');
  // showConfirmation(...messageArgs, startScreen, 'Do you want to bulldoze the Tube on this area?');
  showConfirmation(...messageArgs, startScreen, 'Would you like to enter a personalized comment for this game?');
  // showInput(...messageArgs, startScreen, 'Please enter a comment2:');

}


function newMine() {
  resetGameData();
  update();
  resetButtons();
  resetShop();
  show(launchScreen, startScreen);
}

function moreProbes() {
  if (gameData.probes <= 4) probeNum.text = gameData.probes += 1;
}

function lessProbes() {
  if (gameData.probes >= 2) probeNum.text = gameData.probes -= 1;
}

function launchProbes() {
  asteroidSurface.removeChildren();
  remove(launchScreen, startScreen);
  show(startCover, startScreen);
  show(selectAsteroidTitle);
  gameData.credits -= gameData.probes * 17000;
  creditText.text = gameData.credits;

  let asteroids = [];
  for (let i=0; i<gameData.probes; i++) {
    asteroids.push(getDifficulty());
    const designation = getDesignation();
    buildButton(selectAsteroidTitle, 57, 17, 4, 20 * i + 29, () => pickAsteroid(i), sheet.textures['asteroid button3.gif'], `Asteroid ${designation}`, regular, 6, 3);
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

  function pickAsteroid(i){
    selectAsteroidTitle.removeChildren();
    // console.log('removeChildren()');
    // console.log('selectAsteroidTitle.children.length: ', selectAsteroidTitle.children.length);
    remove(selectAsteroidTitle);
    remove(startCover);
    gameData.asteroid = `Class:${asteroids[i].substring(6,7)}`;
    gameData.difficulty = asteroids[i].charAt(6);
    // console.log('Gabrien gameData.difficulty: ', gameData.difficulty);

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

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      x = col * 10 + 3;
      y = row * 10 + 15;
      buildHitzone(mineScreen, 10, 10, x, y, () => tapSurface(col, row));
    }
  }
}

function tapSurface(x,y) {
  const btn = gameData.shopBtn;
  // console.log(`(${x},${y}) btn: ${btn}`);
  const btnNum = Number(getBuildingNumber(btn));
  // console.log('btnNum: ', btnNum);
  let num = getNumberAt(x,y);
  // console.log('tapSurface num: ', num);

  // Check if site is next to completed structure
  if ( (gameData.level === 'level1' && num !== 5 && !isAdjacent(x,y))
    || (gameData.level !== 'level1' && num % 100 !== 8 && !isAdjacent(x,y))
  ) {
    showMSMessage('You can only build next to a completed structure.');
    return;
  }

  // Show site status message
  if (num >= 5) {
    // console.log(`tapSurface ${num} >= 5: trying to show status message`);

    // Skip ahead as Bulldozer has different messages for bulldozing itself.
    if (num === 107 && btn === 'Bulldozer') {
      checkBulldozer();
      return;
    }

    showMessage(...messageArgs, mineScreen, `•Site Number: ${getSiteNumberAt(x,y)}\n•Building: ${getBuildingName(num)}\n•Status: ${getStatus(num)}`, checkMinePlacement);
  } else checkMinePlacement();

  function checkMinePlacement() {
    // console.log('inside checkMinePlacement()');
    // Return if site is Mother Ship
    if (num === 5) return;

    else if (btn === 'Diridium Mine' && [1,2].includes(num)) {
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
    if ([2,4].includes(num)) {
      showMSMessage(`•Site Number: ${getSiteNumberAt(x,y)}\n•Building: None\n•Note: You must bulldoze clear the area before building that.`);
      return;
    }

    // Check if site is any building
    if (num >= 5) return;

    // Check for level1-only structures
    if (gameData.level !== 'level1' && [13,14,15].includes(btnNum)) {
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
        confirmBulldoze(x,y);

        return;
    }

    switch (true) {
      case num > 100:
        confirmBulldoze(x,y);
        return;
    }
  }


}

function getNumberAt(x,y) {
  return gameData.maps[`${gameData.level}`][`row${y}`][x];
}

function getSiteNumberAt(x,y) {
  return y * 10 + x + 1;
}

function getStatus(num) {
  if (num > 100) {
    const numDays = Math.floor(num/100);
    return `${numDays} day${numDays === 1 ? '' : 's'} until construction complete`;
  } else if (num === 5 && day > 21) {
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

function confirmBulldoze(x,y) {
  showConfirmation(...messageArgs, mineScreen, `Do you want to bulldoze the ${getBuildingAt(x,y)} on this area?`, () => placeStructure(7, x, y), doNothing);
}

function isAdjacent(x,y) {
  // Top
  if (y-1 >= 0) {
    const n = getNumberAt(x, y-1);
    if (isCompleted(n)) return true;
  }

  // Right
  if (x+1 < 10) {
    const n = getNumberAt(x+1, y);
    if (isCompleted(n)) return true;
  }

  // Bottom
  if (y+1 < 10) {
    const n = getNumberAt(x, y+1);
    if (isCompleted(n)) return true;
  }

  // Left
  if (x-1 >= 0) {
    const n = getNumberAt(x-1, y);
    if (isCompleted(n)) return true;
  }
  return false;

  function isCompleted(n) {
    if (n === 5 || (n > 7 && n < 100)) return true;
    return false;
  }
}

function getBuildingAt(x,y) {
  const num = getNumberAt(x,y);
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

function updateMineSurface(title, newLevel, newMaps, clearMap = false) {
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


  // TODO: I might be on to something here:
  // const currentMap = {};
  // Object.assign(currentMap, gameData.maps[gameData.level]);
  const currentMap = deepClone(gameData.maps[gameData.level])

  // If I assign gameData.maps[gameData.newLevel] to currentMap, then make a change to currentMap, will it update gameData.maps[gameData.newLevel] also? Yes.
  // const currentMap = gameData.maps[gameData.newLevel];

  // console.log(`currentMap ${gameData.level} row0: `, currentMap.row0);

  // const currentMap = gameDataInit.maps[gameData.newLevel];
  // const newMap = {};
  // Object.assign(newMap, newMaps[newLevel]);
  const newMap = {...newMaps[newLevel]};

  // const newMap = newMaps[newLevel];
  // console.log('newLevel: ', newLevel);
  // console.log(`newMap ${newLevel} row0: `, newMap.row0);


  // console.log(`updateMineSurface currentMap: ${currentMap}`);
  // console.log(`updateMineSurface gameData.maps[${gameData.newLevel}]: ${gameData.maps[gameData.newLevel]}`);
  // console.log(`updateMineSurface newMaps[${newLevel}]: ${newMaps[newLevel]}`);

  // console.log('gameData.maps.level1: ', gameData.maps.level1);
  // console.log('Assign currentMap: ', currentMap);
  // console.log('Assign testMap: ', testMap);

  animateMap(currentMap, newMap, newLevel, clearMap, allDone);
}

function allDone(newLevel) {
  topBarCover.visible = false;
  dayText.visible = true;
  creditText.visible = true;
  mineScreen.interactiveChildren = true;

  gameData.level = newLevel;
  // console.log(`allDone gameData.level: ${gameData.level}, newLevel: ${newLevel}`);


  // console.log(`allDone gameData.maps[${gameData.level}].row0: `, gameData.maps[gameData.level].row0);
  // console.log(`allDone gameData.maps.level1.row0: `, gameData.maps.level1.row0);
  // console.log(`allDone gameData.maps.level2.row0: `, gameData.maps.level2.row0);
  // console.log(`allDone gameData.maps.level3.row0: `, gameData.maps.level3.row0);
  // console.log('================================');

}

function animateMap(currentMap, newMap, newLevel, clearMap, callback) {
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
    previousRow = tempMap[`row${r-1}`];
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
    let notInverted = 9 - randomNum(2,8);

    for (let t=0; t<10; t++) {
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
    (function(r){
      window.setTimeout(function(){
        // Draw the whole map with the new row
        // how does tempMap get updated here? line 920
        drawMap(tempMap);
        if (r < 10) {
          r += 1;
          updateRow(r);
        } else {
          // gameData.level = level;
          callback(newLevel);
        }
      }, 75); // This is the speed of the redraw

    }(r));
  }
}

function drawMap(map) {
  // console.log('inside drawMap');
  let tile;
  let tex;
  const originX = 3;
  const originY = 15;

  asteroidSurface.removeChildren();

  for (let r=0; r<10; r++) {
    let currRow = map[`row${r}`];
    // console.log('currRow: ', currRow);

    for (let t=0; t<10; t++) {
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


function update() {
  console.log('>> Reminder to put update() functions here');

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

    function getCustomName(){
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
function load(slot, parent, ...closeFunctions) {
  // console.log('==========');
  // console.log('inside load');
  // console.log('parent: ', parent);
  // console.log('...closeFunctions: ', ...closeFunctions);

  if (minerSaves[slot].empty) return;
  // Object.assign(gameData, loadGame(slot));
  gameData = {};
  gameData = deepClone(loadGame(slot));
  showProgressWindow(parent, update, false, ...closeFunctions);
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
    if (count < 60 )
      // Slower at first...
      rand = Math.floor(randomNum(0,500) * .005);
    else
      // Then faster toward end...
      rand = randomNum(1,10);

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
  dayText.text = gameData.day += days;
  console.log('advance gameData.autosaveEnabled: ', gameData.autosaveEnabled);

  if (gameData.autosaveEnabled) save('autoSave', false); //autosave(gameData)

  // Update map progress on every level
  const updatedMaps = updateMapProgress(days);
  updateMineSurface('Updating...', gameData.level, updatedMaps);
  gameData.maps = deepClone(updatedMaps);

  // Update report info
  console.log('>> Update report info...');
}

function updateMapProgress(days) {
  console.log('>> Updating map progress: generate new map for each level with updated progress');

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
          if (days * 100 > num ) return num %= 100;
          else return num -= days * 100;
        }

        // Everyting else stays the same
        return num;
      });
    }
  }
  return updatedMaps;
}

// Sell Diridium
function sellDiridium() {
  if (gameData.diridium === 0) {
    showMessage(...messageArgs, mineScreen, 'You currently have no diridium to sell.', doNothing);
  }
}

// Change Wage
function wageUp() {
  wage.text = gameData.wage = gameData.wage + 50;
}

function wageDown() {
  wage.text = gameData.wage = gameData.wage >= 50 ? gameData.wage - 50 : gameData.wage;
}

// Shop
function shop(sprite, id) {
  if (shopItems[id].name === gameData.shopBtn) {
    clearShop();
  } else {
    clearShop();
    sprite.visible = true;
    storeText.text = gameData.shopBtn = shopItems[id].name;
    storeText.dirty = true;
    storePrice.text = gameData.shopPrice = getPrice(id);
    storePrice.dirty = true;
  }
}

function clearShop() {
  shopButtons.map(b => b.visible = false);
  storeText.text = gameData.shopBtn = '';
  storePrice.text = gameData.shopPrice = '';
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
  console.log('>>> Reminder to undo last action');
  showMessage(...messageArgs, mineScreen, 'There is nothing to undo.', doNothing);
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

  // testing this:
  // Object.assign(gameDataInit.maps, gameDataInit.maps);

  // Load Level1 for new games and loaded games
  // console.log('gotoMineScreen gameData.maps.level1.row1', gameData.maps.level1.row1);
  // console.log('gotoMineScreen gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);
  if (!drawZonesOnce) {
    buildAsteroidHitZones();
    drawZonesOnce = true;
  }

  updateMineSurface('Mapping...', 'level1', newMaps, true);
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
  instructionsCancelStart.interactive = false;
  instructionsCancelMine.interactive = true;
  show(instructionsScreen, mineScreen);
}

function closeMineScreenInstructions() {
  instructionsCancelStart.interactive = true;
  instructionsCancelMine.interactive = false;
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

function resign() {
  showConfirmation(...messageArgs, optionsMenu, 'Are you sure you want to resign? (This will end your current colony.)', commenceResignation, doNothing);

  function commenceResignation() {
    closeOptions();
    remove(mineScreen);
    show(startScreen);
    missionStatus1.text = `Mission Status: RESIGNED on day ${gameData.day}`;
    missionStatus2.text = `Credits Remaining: ${gameData.credits}`;

    resetGameData();
    // Object.assign(minerSaves.autoSave, initAutosave());
    minerSaves.autoSave = deepClone(initAutosave());
    loadAutosave.text = minerSaves.autoSave.name;
    saveAutosave.text = minerSaves.autoSave.name;
    update();
    show(gameOver);
  }
}

function gameOverNewMine() {
  remove(gameOver);
  newMine();
}

function quit() {
  resetGameData();
  update();
  remove(gameOver, startScreen);
}


// Shortcuts
// Show mineScreen message
function showMSMessage(text) {
  showMessage(...messageArgs, mineScreen, text, doNothing);
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

  // Object.assign(gameData, gameDataInit);
  gameData = {};
  gameData = deepClone(gameDataInit);
}

function doNothing() {
  return;
}







// Install EventSystem, if not already
// (PixiJS 6 doesn't add it by default)
// if (!('events' in app.renderer)) {
//     app.renderer.addSystem(PIXI.EventSystem, 'events');
// }
