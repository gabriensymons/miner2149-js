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

export {
  buildHitzone,
  buildButton
};
