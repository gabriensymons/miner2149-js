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


function buildMessageButton(app, parent, messageTop, messageBottom, textureButton, textureButtonDown, buttonTextObj, text, isSecondButton = false, callback) {
  // console.log('inside button - isSecondButton: ', isSecondButton);
  const button = new PIXI.Sprite(textureButton);
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

  buttonTextObj.position.set(button.width / 2, -button.height / 2);
  buttonTextObj.anchor.set(.5,.5);
  messageBottom.addChild(button);

  button
  .on('pointerdown', () => onButtonDown(button))
  .on('pointerout', () => onPointerOut(button))
  .on('pointerup', () => onButtonUp(button));

  function onPointerOut(object) {
    object.texture = textureButton;
    buttonTextObj.tint = 0x000000;
  }

  function onButtonDown(object) {
    object.texture = textureButtonDown;
    buttonTextObj.tint = 0xFFFFFF;
  }

  function onButtonUp(object) {
    object.texture = textureButton;
    buttonTextObj.tint = 0x000000;
    messageBottom.removeChildren();
    app.stage.removeChild(messageTop);
    app.stage.removeChild(messageBottom);
    parent.interactiveChildren = true;
    callback();
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

export {
  buildHitzone,
  buildButton,
  buildMessageButton
};
