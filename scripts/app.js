import getDifficulty from './difficulty.js';
import { random, randomNum } from './random.js';
import { buildHitzone, buildButton } from './button.js';
import { gameDataInit, shopItems, undoData } from './gamedata.js';
import { showMessage, showConfirmation, showInput } from './message.js';
import {
  minerSaves, saveGame, initAutosave, loadGame
} from './saveload.js';


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
const gameData = {};
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
let roughArea, oreVein;
let motherShip, construction;
let bulldozer, bulldozerOn;
let diridiumMine, diridiumMineOn;
let hydroponics, hydroponicsOn;
let tube, tubeOn;
let lifeSupport, lifeSupportOn;
let quarters, quartersOn;
let spacePort, spacePortOn;
let powerPlant, powerPlantOn;
let processor, processorOn;
let sickbay, sickbayOn;
let storage, storageOn;
let shopButtons = [];
let asteroidSurface;
let newMaps = {};
// const testingInitMapLevel1 = gameDataInit.maps.level1;
// console.log('var declarations testingInitMapLevel1: ', testingInitMapLevel1);



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
  oreVein = new PIXI.Texture.from('Ore Vein.gif');
  motherShip = new PIXI.Texture.from('Mother Ship.gif');
  construction = new PIXI.Texture.from('Construction.gif');
  bulldozer = new PIXI.Texture.from('Bulldozer.gif');
  diridiumMine = new PIXI.Texture.from('Diridium Mine.gif');
  hydroponics = new PIXI.Texture.from('Hydroponics.gif');
  tube = new PIXI.Texture.from('Tube.gif');
  lifeSupport = new PIXI.Texture.from('Life Support.gif');
  quarters = new PIXI.Texture.from('Quarters.gif');
  spacePort = new PIXI.Texture.from('Space Port.gif');
  powerPlant = new PIXI.Texture.from('Power Plant.gif');
  processor = new PIXI.Texture.from('Processor.gif');
  sickbay = new PIXI.Texture.from('Sickbay.gif');
  storage = new PIXI.Texture.from('Storage.gif');

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
      gotoMineScreen
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
  // Levels
  // Reports
  // Options Window
  buildHitzone(mineScreen, 15, 13, 145, 56, showOptions);
    // Autosave
    buildHitzone(optionsMenu, 11, 11, 15, 23, () => {
      if (gameData.autosaveEnabled) {
        showMessage(...messageArgs, optionsMenu, 'WARNING: With autosave disabled, your game will be lost if you quit without first saving your game.', doNothing);
      }
      toggleCheck(autosaveCheck, `autosaveEnabled`, optionsMenu);
      gameData.autosaveEnabled != gameData.autosaveEnabled;
      console.log('autosave enabled? ', gameData.autosaveEnabled);
    });
    // Gridlines
    buildHitzone(optionsMenu, 11, 11, 15, 38, () => toggleCheck(gridlinesCheck, `gridlinesEnabled`, optionsMenu));
    // Save mine
    buildHitzone(optionsMenu, 11, 11, 15, 53, () => {
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
    buildHitzone(optionsMenu, 11, 11, 15, 68, showLoadOptions);
      // Cancel button
      loadCancelMine = buildHitzone(loadMineScreen, 42, 13, 33, 123, closeLoadOptions);
      // Disable this hitzone except in the mineScreen
      loadCancelMine.interactive = false;
    // Exit & Save
    buildHitzone(optionsMenu, 11, 11, 15, 83, exitAndSave);
    // Resign
    buildHitzone(optionsMenu, 11, 11, 15, 98, resign);
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
// Levels





function updateMineSurface(title, level, newMaps, clearMap = false) {
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
  const currentLevel = gameData.maps[gameData.level];
  // const currentMap = gameDataInit.maps[gameData.level];
  const newLevel = newMaps[level];
  // console.log(`updateMineSurface currentLevel: ${currentLevel}`);
  // console.log(`updateMineSurface gameData.maps[${gameData.level}]: ${gameData.maps[gameData.level]}`);
  // console.log(`updateMineSurface newMaps[${level}]: ${newMaps[level]}`);

  // console.log('gameData.maps.level1: ', gameData.maps.level1);
  // console.log('Assign currentMap: ', currentMap);
  // console.log('Assign testMap: ', testMap);

  animateMap(currentLevel, newLevel, clearMap, allDone);
}

function allDone(map) {
  topBarCover.visible = false;
  dayText.visible = true;
  creditText.visible = true;
  mineScreen.interactiveChildren = true;
  // will this work? looks like it does!
  gameData.maps[gameData.level] = map;
}

function animateMap(currentMap, newMap, clearMap, callback) {
  // testings
  // currentMap = gameDataInit.maps.level1;
  // console.log('animateMap currentMap: ', currentMap);
  // console.log('animateMap newMap: ', newMap);
  // console.log('animateMap clearMap: ', clearMap);


  let r = 1;
  let previousRow = [];
  let currentRow = [];
  let newRow = [];

  if (clearMap) {
    currentMap = {
      row1: [1,1,1,1,1,1,1,1,1,1],
      row2: [1,1,1,1,1,1,1,1,1,1],
      row3: [1,1,1,1,1,1,1,1,1,1],
      row4: [1,1,1,1,1,1,1,1,1,1],
      row5: [1,1,1,1,1,1,1,1,1,1],
      row6: [1,1,1,1,1,1,1,1,1,1],
      row7: [1,1,1,1,1,1,1,1,1,1],
      row8: [1,1,1,1,1,1,1,1,1,1],
      row9: [1,1,1,1,1,1,1,1,1,1],
      row10: [1,1,1,1,1,1,1,1,1,1]
    }
  }

  updateRow(r);

  function updateRow(r) {
    // console.log('Gabrien inside updateRow');
    // console.log('Gabrien updateRow r: ', r);
    // console.log('Gabrien currentMap: ', currentMap);
    // console.log('Gabrien newMap: ', newMap);

    previousRow = currentMap[`row${r-1}`];
    if (r < 11) currentRow = currentMap[`row${r}`];
    if (r < 11) newRow = newMap[`row${r}`];

    // console.log('Gabrien previousRow: ', previousRow);
    // console.log('Gabrien currentRow: ', currentRow);
    // console.log('Gabrien newRow: ', newRow);



    // Calculate how many tiles to invert
    let notInverted = 10 - randomNum(3,9);

    for (let t=0; t<10; t++) {
      // Remove inverted images from previous row
      if (r > 1) previousRow[t] = Math.abs(previousRow[t]);

      // console.log('Gabrien inside for loop');
      // console.log('Gabrien previousRow: ', previousRow);
      // console.log('Gabrien currentRow: ', currentRow);
      // console.log('Gabrien newRow: ', newRow);

      if (r < 11) currentRow[t] = t + 1 > notInverted ? -newRow[t] : newRow[t];
    }

    // Pause a little before continuing the loop
    // create a closure to preserve the value of "r"
    (function(r){
      window.setTimeout(function(){
        // Draw the whole map with the new row
        drawMap(currentMap);
        if (r < 11) {
          r += 1;
          updateRow(r);
        } else {
          callback(currentMap);
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
  const originY = 5;

  asteroidSurface.removeChildren();

  for(let r=1; r<11; r++) {
    let currentRow = map[`row${r}`];
    // console.log('currentRow: ', currentRow);

    for(let t=0; t<10; t++) {
      tex = getTile(currentRow[t]);
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
        // left off here to test the animation
        return '.gif';
      case -3:
        return ' inverted.gif';
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
}

// Save
function save(slot, showProgress, parent, ...closeFunctions) {
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
    if (showProgress) showProgressWindow(parent, updateData, ...closeFunctions, );

    function updateData() {
      Object.assign(gameData, saveGame(gameData, slot, customName));

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
  Object.assign(gameData, loadGame(slot));
  showProgressWindow(parent, update, ...closeFunctions);
}

function showProgressWindow(parent, callback, ...closeFunctions) {
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

      // Pass all the functions needed to close open screens
      closeFunctions.forEach(f => f.apply());
      // console.log('after closeFunctions');
      if (callback) callback();
    }
  }

  app.ticker.add(countListener);
}

// Advance Days
function advance(days) {
  dayText.text = gameData.day += days;
  if (gameData.autosaveEnabled) save('autoSave', false);

  // Update map progress on every level
  const udpdatedMapData = updateProgress();
  updateMineSurface('Updating...', gameData.level, udpdatedMapData);

  // Update report info
  console.log('>> Update report info...');
}

function updateProgress() {
  console.log('>> Updating map progress: generate new map for each level with updated progress');

  // Check for updates
  // Then return updated map
  return gameData.maps;

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

function undo() {
  console.log('>>> Reminder to undo last action');
  showMessage(...messageArgs, mineScreen, 'There is nothing to undo.', doNothing);
}


// Show / Close
function gotoMineScreen() {
  // console.log('inside gotoMineScreen');

  // Doesn't seem to do what I expect
  // asteroidSurface.removeChildren();

  // Testing out trying to generate "clear" map first
  // const clearMap = generateMaps(gameData.difficulty);
  // updateMineSurface('Mapping...', 'level1', clearMap, true);

  remove(startScreen);
  show(mineScreen);
  mineScreen.interactiveChildren = true;
  // TODO
  // Left off here: new mine doesn't start with clear tiles
  newMaps = generateMaps(gameData.difficulty);
  // console.log('gotoMineScreen newMaps: ', newMaps);
  // console.log('gotoMineScreen newMaps.level1: ', newMaps.level1);


  // testing this:
  // Object.assign(gameDataInit.maps, gameDataInit.maps);

  // Load Level1 for new games and loaded games
  // console.log('gotoMineScreen gameData.maps.level1.row1', gameData.maps.level1.row1);
  // console.log('gotoMineScreen gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);
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
    Object.assign(minerSaves.autoSave, initAutosave());
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

function generateMaps(difficulty) {
  // could this live in a separate file?
  // Take into account difficulty: class of asteroid
  console.log(`>> Generating map for difficulty ${difficulty}! (coming soon)`);

  newMaps = {
    level1: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    },
    level2: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    },
    level3: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    }
  }
  // console.log('generateMaps newMaps: ', newMaps);

  return newMaps;
}

function generateMaps2(difficulty) {
  // could this live in a separate file?
  // Take into account difficulty: class of asteroid
  console.log(`>> Generating map for difficulty ${difficulty}! (coming soon)`);

  newMaps = {
    level1: {
      row1: [1,1,1,1,1,1,1,1,1,1],
      row2: [1,1,1,1,1,1,1,1,1,1],
      row3: [1,1,1,1,1,1,1,1,1,1],
      row4: [1,1,1,1,1,1,1,1,1,1],
      row5: [1,1,1,1,1,1,1,1,1,1],
      row6: [1,1,1,1,1,1,1,1,1,1],
      row7: [1,1,1,1,1,1,1,1,1,1],
      row8: [1,1,1,1,1,1,1,1,1,1],
      row9: [1,1,1,1,1,1,1,1,1,1],
      row10: [1,1,1,1,1,1,1,1,1,1]
    },
    level2: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    },
    level3: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    }
  }
  return newMaps;
}

function resetGameData() {
  Object.assign(gameData, gameDataInit);

  // testing my own overwrite reset
  // gameDataInit.maps = generateMaps2(gameData.difficulty);
  console.log('resetGameData gameData.maps.level1.row1', gameData.maps.level1.row1);

  // I have NO idea why gameDataInit is being overwritten here
  console.log('resetGameData gameDataInit.maps.level1.row1', gameDataInit.maps.level1.row1);
  // Even this custom variable pointing to gameDataIni get's overwritten!
  // console.log('resetGameData testingInitMapLevel1: ', testingInitMapLevel1);



}

function doNothing() {
  return;
}







// Install EventSystem, if not already
// (PixiJS 6 doesn't add it by default)
// if (!('events' in app.renderer)) {
//     app.renderer.addSystem(PIXI.EventSystem, 'events');
// }
