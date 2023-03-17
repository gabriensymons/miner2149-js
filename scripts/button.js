import { barText, bold, regular } from './font-styles.js';

// Example usage:
// buildHitzone(loadMineScreen, 42, 13, 33, 123, removeLoadMine);
// or
// const cancelBtn = buildHitzone(loadMineScreen, 42, 13, 33, 123, removeLoadMine);

const buildHitzone = (parent, width, height, x, y, func) => {
  const zone = new PIXI.Container();
  zone.interactive = true;
  zone.buttonMode = true; // buttonMode means cursor changes to pointer on hover
  zone.width = width;
  zone.height = height;
  zone.x = x;
  zone.y = y;
  const zoneFill = new PIXI.Graphics()
    .beginFill(0x0066ff, .5)
    .drawRect(0, 0, width, height)
    .endFill();
  zone.addChild(zoneFill);
  zone.on('pointerdown', func);
  parent.addChild(zone);
  return zone;
}

// Template
/*
const cancelBtn = new PIXI.Container();
cancelBtn.interactive = true;
cancelBtn.buttonMode = true;
cancelBtn.width = 42;
cancelBtn.height = 13;
cancelBtn.x = 33;
cancelBtn.y = 123;
const cancelBtnFill = new PIXI.Graphics()
  .beginFill(0x0066ff, .5)
  .drawRect(0, 0, 42, 13)
  .endFill();
cancelBtn.addChild(cancelBtnFill);
cancelBtn.on('pointerdown', removeLoadMine);
loadMineScreen.addChild(cancelBtn);
*/

// should extend buildHitzone and add a image
const buildButton = (parent, width, height, x, y, func, sprite, text, style, textx, texty) => {
  const zone = buildHitzone.call(this, parent, width, height, x, y, func);

  const bg = new PIXI.Sprite.from(sprite);
  bg.x = x;
  bg.y = y;
  parent.addChild(bg);

  let txt = new PIXI.BitmapText(text, style);
  txt.x = textx + x;
  txt.y = texty + y;
  // for center text:
  // txt.x = x + width / 2;
  // txt.y = y + height / 2;
  // txt.anchor = (0.5,0.5);
  parent.addChild(txt);

  return zone;
}
/*
  Generates a button with text and image texture

  Example usage:
  buildTextButton(startScreen, 62, 14, 49, 74, startButton, startButtonInverted, newMine, 'New Mine');
*/
function buildTextButton(parent, width, height, x, y, textureButton, textureButtonDown, callback, text, style = regular) {
  // Build button
  const sprite = new PIXI.Sprite(textureButton);
  sprite.width = width;
  sprite.height = height;
  sprite.position.set(x, y);
  sprite.buttonMode = true;
  sprite.interactive = true;
  //sprite.alpha = .5; // for testing position
  let isOverButton = undefined;

  // Build text
  let txt = new PIXI.BitmapText(text, style);
  // center text:
  txt.x = width / 2;
  txt.y = height / 2 - .5;
  txt.anchor = (0.5,0.5);
  sprite.addChild(txt);

  // Button functions
  const onPointerOut = btn => {
    btn.texture = textureButton;
    txt.tint = 0x000000;
    isOverButton = false;
  }
  const onButtonDown = btn => {
    btn.texture = textureButtonDown;
    txt.tint = 0xFFFFFF;
    isOverButton = true;
  };
  const onButtonUp = btn => {
    btn.texture = textureButton;
    txt.tint = 0x000000;

    if (isOverButton) callback();
  };
  const onPointerUpOutside = () => {
    isOverButton = false;
  }

  sprite
  .on('pointerout', () => onPointerOut(sprite))
  .on('pointerdown', () => onButtonDown(sprite))
  .on('pointerup', () => onButtonUp(sprite))
  .on('pointerupoutside', () => onPointerUpOutside());
  parent.addChild(sprite);
  return sprite;
}


function buildMessageButton(app, parent, messageTop, messageBottom, textureButton, textureButtonDown, buttonTextObj, text, isSecondButton = false, callback) {
  // console.log('inside button - isSecondButton: ', isSecondButton);
  const button = new PIXI.Sprite(textureButton);
  let isOverButton = undefined;

  if (isSecondButton)
    button.position.set(48, -6);
  else
    button.position.set(6, -6);
  button.addChild(buttonTextObj);
  button.anchor.set(0,1);
  button.buttonMode = true;
  button.interactive = true;
  buttonTextObj.text = text;
  buttonTextObj.dirty = true;

  buttonTextObj.position.set(button.width / 2, -button.height / 2 - .5);
  buttonTextObj.anchor.set(.5,.5);
  messageBottom.addChild(button);

  button
  .on('pointerdown', () => onButtonDown(button))
  .on('pointerout', () => onPointerOut(button))
  .on('pointerup', () => onButtonUp(button))
  .on('pointerupoutside', () => onPointerUpOutside());

  function onPointerOut(object) {
    object.texture = textureButton;
    buttonTextObj.tint = 0x000000;
    isOverButton = false;
  }

  function onButtonDown(object) {
    object.texture = textureButtonDown;
    buttonTextObj.tint = 0xFFFFFF;
    isOverButton = true;
  }

  function onButtonUp(object) {
    if (isOverButton)  {
      object.texture = textureButton;
      buttonTextObj.tint = 0x000000;
      messageBottom.removeChildren();
      app.stage.removeChild(messageTop);
      app.stage.removeChild(messageBottom);
      parent.interactiveChildren = true;
      callback();
    }
  }

  function onPointerUpOutside() {
    isOverButton = false;
  }
}

  // Message Button Template
  /*
  const yesButton = new PIXI.Sprite(textureButton);
  yesButton.position.set(6, -6); // 2nd button (48, -6)
  yesButton.anchor.set(0,1);
  yesButton.buttonMode = true;
  yesButton.interactive = true;
  yesButton
    .on('pointerdown', () => onButtonDown(yesButton))
    .on('pointerout', () => onPointerOut(yesButton))
    .on('pointerup', () => onButtonUp(yesButton));
  messageBottom.addChild(yesButton);
  yesButton.addChild(buttonText1);
  buttonText1.text = b1text;
  buttonText1.position.set(yesButton.width / 2, -yesButton.height / 2);
  buttonText1.anchor.set(.5,.5);
  */


// Builds a button with sprite images for up and down states
// and a hitzone that can be a different size than the button
//
// Example usage:
// const moreProbesButton = { width: 13, height: 6, x: 64, y: 126 };
// const moreProbesHitzone = { width: 18, height: 7, x: 63, y: 125 }
// buildSpriteButton(launchScreen, moreProbesButton, moreProbesHitzone, upArrow, upArrowInverted, moreProbesPointerDown, moreProbesPointerUp);
function buildSpriteButton(
  parent,
  button = { width, height, x, y },
  hitzone = { width, height, x, y },
  textureButton, textureButtonDown, downCallback, upCallback
) {
  // console.log('Gabrien hitzone.hitzoneHeight: ', hitzone.hitzoneHeight);
  // Build button
  const sprite = new PIXI.Sprite(textureButton);
  sprite.width = button.width;
  sprite.height = button.height;
  sprite.position.set(button.x, button.y);
  // sprite.buttonMode = true;
  // sprite.interactive = true;
  parent.addChild(sprite);

  // Build hitzone
  // Hitzone can be different size than button
  const zone = new PIXI.Container();
  zone.interactive = true;
  zone.buttonMode = true; // buttonMode means cursor changes to pointer on hover
  zone.width = hitzone.width;
  zone.height = hitzone.height;
  zone.position.set(hitzone.x, hitzone.y);
  const zoneFill = new PIXI.Graphics()
    .beginFill(0x0066ff, .5)
    .drawRect(0, 0, hitzone.width, hitzone.height)
    .endFill();
  zone.addChild(zoneFill);

  // Button functions
  const onPointerOut = btn => btn.texture = textureButton;
  const onButtonDown = btn => {
    if (downCallback && downCallback()) btn.texture = textureButtonDown;
  };
  const onButtonUp = btn => {
    btn.texture = textureButton;
    if (upCallback) upCallback();
  };

  zone
  .on('pointerout', () => onPointerOut(sprite))
  .on('pointerdown', () => onButtonDown(sprite))
  .on('pointerup', () => onButtonUp(sprite));
  parent.addChild(zone);
  return zone;
}

export {
  buildHitzone,
  buildButton,
  buildTextButton,
  buildMessageButton,
  buildSpriteButton,
};
