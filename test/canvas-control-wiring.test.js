import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../scripts/app.js', import.meta.url));

function compact(source) {
  return source.replace(/\s+/g, '');
}

test('shop, map, and options controls use shared hover-only overlays', async () => {
  const source = await readFile(appPath, 'utf8');
  const code = compact(source);

  for (const [variable, sprite] of [
    ['shopHover', 'shop-hover.gif'],
    ['shopHoverWide', 'shop-hover-wide.gif'],
    ['tileHover', 'tile-hover.gif'],
    ['optionsHover', 'options-hover.gif'],
    ['optionsHoverWide', 'options-hover-wide.gif'],
  ]) {
    assert.match(
      code,
      new RegExp(`${variable}=newPIXI\\.Sprite\\.from\\(sheet\\.textures\\['${sprite}'\\]\\)`),
    );
  }

  // Phase 7 moved the grid itself into map-view.js, which builds the hundred
  // zones and is where their geometry is now pinned ("one hit zone covers each
  // cell, a pixel proud of the tile on every side"). What stays this file's
  // business is that app.js hands the view the one shared overlay sprite and
  // routes taps back to the placement rules, rather than minting an overlay per
  // tile the way the other control groups above must not either.
  assert.match(
    code,
    /mapView\.buildHitZones\(\{parent:mineScreen,hoverSprite:tileHover,buildHoverHitzone,onTapSite:tapSurface,?\}\)/,
  );
  assert.match(
    code,
    // Stage 4 of Plan 13 dropped the sprite argument: selecting an item is only
    // a state change now, and the render decides which sprite is lit. What this
    // pins -- every shop row sharing one hover overlay -- is unchanged.
    /buildHoverHitzone\(mineScreen,hoverSprite,\{width,height:12,x,y\},\{width,height:12,x,y\},\(\)=>shop\(id\)\)/,
  );
  assert.match(code, /hoverSprite=width===15\?shopHoverWide:shopHover/);
  assert.match(
    code,
    /buildHoverHitzone\(mineScreen,shopHover,\{width:14,height:12,x:82,y:132\},\{width:14,height:12,x:82,y:132\},undo\)/,
  );
  assert.match(
    code,
    /storageIconContainer=newPIXI\.Container\(\);mineScreen\.addChild\(storageIconContainer\)/,
  );
  assert.doesNotMatch(code, /storageIconContainer=buildHitzone/);

  // Row 0 is Disaster Mode, whose label is longer than the rest. It uses the
  // wider overlay artwork rather than a stretched copy of the 68px one, the same
  // way shopHoverWide pairs with shopHover.
  assert.match(
    code,
    /buildHoverHitzone\(optionsMenu,optionsHoverWide,\{width:80,height:15,x:11,y:21\},\{width:65,height:11,x:15,y:23\},/,
  );
  // 80 + 11 keeps the overlay inside the 98px-wide menu artwork.
  assert.ok(80 + 11 <= 98, 'the wide overlay fits the options menu');

  const optionRows = [
    ['36', '38'],
    ['51', '53'],
    ['66', '68'],
    ['81', '83'],
    ['96', '98'],
  ];
  for (const [overlayY, hitzoneY] of optionRows) {
    assert.match(
      code,
      new RegExp(
        `buildHoverHitzone\\(optionsMenu,optionsHover,\\{width:68,height:15,x:11,y:${overlayY}\\},\\{width:65,height:11,x:15,y:${hitzoneY}\\},`,
      ),
    );
  }

  // Autosave is unconditional now that its toggle is gone from the menu.
  assert.doesNotMatch(code, /autosaveEnabled/);
  assert.match(code, /save\('autoSave',false\);/);
});

test('Grid Lines switches smooth map tiles and redraws the current level', async () => {
  const source = await readFile(appPath, 'utf8');
  const code = compact(source);

  assert.match(
    code,
    /smoothAreaGrid=newPIXI\.Texture\.from\('smooth-area-grid\.gif'\)/,
  );
  // The tile swap itself moved into map-view.js in phase 7 and is pinned there
  // ("gridlines change the smooth tile, and only that one, and only upright").
  // app.js's remaining half is handing the view a live accessor rather than a
  // captured value, without which the toggle would redraw the same tiles.
  assert.match(code, /gridlinesEnabled:\(\)=>gameData\.gridlinesEnabled/);
  assert.match(
    code,
    // Stage 6 of Plan 13 reduced toggleCheck to the flag: the checkbox sprite is
    // derived by the renderer now. The pairing this pins -- toggling gridlines
    // also redraws the current level -- is unchanged, and still needed, because
    // the renderer deliberately does not draw the map.
    /toggleCheck\('gridlinesEnabled'\);mapView\.draw\(gameData\.maps\[gameData\.level\]\)/,
  );
});

test('save, load, and game-over controls are text buttons', async () => {
  const source = await readFile(appPath, 'utf8');
  const code = compact(source);
  assert.match(
    code,
    /menuButtonNineSlice=\{leftWidth:6,topHeight:6,rightWidth:6,bottomHeight:6,?\}/,
  );
  const slots = [
    ['loadAutosave', 'autoSave', 30],
    ['load1', 'save1', 50],
    ['load2', 'save2', 70],
    ['load3', 'save3', 90],
  ];

  for (const [variable, slot, y] of slots) {
    const loadButton = `${variable}=buildTextButton(loadMineScreen,86,15,11,${y},menuOkButton,menuOkButtonHover,menuOkButtonInverted,()=>load('${slot}',...loadClosingFunctions),minerSaves.${slot}.name,regular,menuButtonNineSlice).children[0]`;
    const saveVariable = variable.replace('load', 'save');
    const saveButton = `${saveVariable}=buildTextButton(saveMineScreen,86,15,11,${y},menuOkButton,menuOkButtonHover,menuOkButtonInverted,()=>save('${slot}',...saveClosingFunctions),minerSaves.${slot}.name,regular,menuButtonNineSlice).children[0]`;
    assert.ok(code.includes(loadButton), `missing Load Mine text button for ${slot}`);
    assert.ok(code.includes(saveButton), `missing Save Mine text button for ${slot}`);
  }

  for (const expected of [
    // Phase 8 named the transition; the button's geometry and artwork are unchanged.
    "loadCancelStart=buildTextButton(loadMineScreen,42,13,33,123,menuOkButton,menuOkButtonHover,menuOkButtonInverted,()=>flow.cancelLoadToStart(),'Cancel')",
    "buildTextButton(saveTitle,42,13,13,116,menuOkButton,menuOkButtonHover,menuOkButtonInverted,()=>remove(saveMineScreen,optionsMenu),'Cancel')",
    "loadCancelMine=buildTextButton(loadMineScreen,42,13,33,123,menuOkButton,menuOkButtonHover,menuOkButtonInverted,closeLoadOptions,'Cancel')",
    "loadCancelGameover=buildTextButton(loadMineScreen,42,13,33,123,menuOkButton,menuOkButtonHover,menuOkButtonInverted,closeGameOverLoad,'Cancel')",
    "buildTextButton(gameOver,48,14,17,93,menuOkButton,menuOkButtonHover,menuOkButtonInverted,gameOverNewMine,'NewMine',regular,menuButtonNineSlice)",
    "buildTextButton(gameOver,49,14,86,93,menuOkButton,menuOkButtonHover,menuOkButtonInverted,showGameOverLoad,'LoadMine',regular,menuButtonNineSlice)",
    "buildTextButton(gameOver,42,14,55,110,menuOkButton,menuOkButtonHover,menuOkButtonInverted,quit,'Quit')",
  ]) {
    assert.ok(code.includes(expected), `missing text button: ${expected}`);
  }

  assert.doesNotMatch(source, /(?:load|save)(?:Autosave|[123]) = new PIXI\.BitmapText/);
});
