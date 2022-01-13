import getDifficulty from './difficulty.js';
import { gameDataInit } from './gamedata.js';
import { random, randomNum } from './random.js';
import { buildHitzone, buildButton } from './button.js';
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
  resetGameData();

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


  // Sprites
  // How to import these from another doc when they need access to sheet?
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
  messageBottom.addChild(underline);
  // Cursor
  cursor = new PIXI.Sprite.from(sheet.textures['cursor.gif']);
  cursor.position.set(6, -25);
  cursor.anchor.set(0,1);
  cursor.visible = false;
  messageBottom.addChild(cursor);



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
  // Maybe create mask to hide long names
  // const saveMask = new PIXI.Graphics();
  // saveMask.beginFill(0xFF3300);
  // saveMask.drawRect(10, 10, 10, 10);
  // saveMask.endFill();
  // loadMineScreen.addChild(saveMask);
  // auto.mask = saveMask;
  // maxWidth is The max width of the text before line wrapping!!!
  load1 = new PIXI.BitmapText(minerSaves.save1.name, regular);
  load1.x = 55; //29
  load1.y = 57; //52;
  load1.anchor = (0.5,0.5); // (0,0)
  // maybe scale mode will prevent blurry text? yes it does!
  // .scaleMode = PIXI.SCALE_MODES.NEAREST
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
  storeText.x = 15;
  storeText.y = 146;
  mineScreen.addChild(storeText);
  // Store price
  storePrice = new PIXI.BitmapText(gameData.shopPrice.toString(), regular);
  storePrice.x = 71;
  storePrice.y = 146;
  mineScreen.addChild(storePrice);
  // Diridium text
  sellPrice = new PIXI.BitmapText(gameData.sellPrice.toString(), regular);
  sellPrice.x = 124;
  sellPrice.y = 115;
  mineScreen.addChild(sellPrice);
  // Wage text
  wage = new PIXI.BitmapText(gameData.wage.toString(), regular);
  wage.x = 121;
  wage.y = 144;
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
  messageBottom.addChild(inputText);
  // Button text
  buttonText1 = new PIXI.BitmapText('', regular);
  buttonText2 = new PIXI.BitmapText('', regular);


  // Buttons
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
    buildHitzone(instructionsScreen, 48, 13, 56, 141, () => remove(instructionsScreen, startScreen));
  //
  // Options Window
  buildHitzone(mineScreen, 15, 13, 145, 56, showOptions);
    // Autosave
    buildHitzone(optionsMenu, 11, 11, 15, 23, () => {
      toggleCheck(autosaveCheck, `autosaveEnabled`, optionsMenu);
      gameData.autosaveEnabled != gameData.autosaveEnabled;
      console.log('autosave enabled? ', gameData.autosaveEnabled);
      console.log('>> Reminder to add message when user disabled autosave');
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



// TODO
// Left off construcitng the Message window
/*
How I want to use it:
showMessage();
showConfirmation(); // same as show message, but with 2 buttons, and a different icon
showInput(); // a message for input, no icon


*/



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
    generateMap();
    // Don't autosave until player advances days
    // autosave(gameData);
    gotoMineScreen();
  }
}

// Mine Screen Functions
function advance(days) {
  dayText.text = gameData.day += days;
  if (gameData.autosaveEnabled) save('autoSave', false);
  console.log('>> Updating...');

}

function updateMineSurface() {
  console.log('>> Mapping... (coming soon)');
  // Top bar shows Mapping...
  // Mine surface animation starts, then finishes
  // Mapping... is removed
}

function update() {
  console.log('>> Reminder to put update() functions here');
  updateMineSurface();

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

function saveMessage() {

  // console.log('Gabrien test: ', test);

  // No: save
  // Yes: showInput


}



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


// Show / Close
function gotoMineScreen() {
  // console.log('inside gotoMineScreen');

  remove(startScreen);
  show(mineScreen);
  mineScreen.interactiveChildren = true;
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
  console.log('>> Confirmation: resign message');
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

function gameOverNewMine() {
  remove(gameOver);
  resetGameData();
  update();
  show(launchScreen, startScreen)
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

function generateMap() {
  // could this live in a separate file?
  console.log('Map generated! (coming soon)');
}

function resetGameData() {
  Object.assign(gameData, gameDataInit);
}








// Install EventSystem, if not already
// (PixiJS 6 doesn't add it by default)
// if (!('events' in app.renderer)) {
//     app.renderer.addSystem(PIXI.EventSystem, 'events');
// }
