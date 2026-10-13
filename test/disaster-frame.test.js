import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPTION_Y,
  SKYLINE_KEYS,
  addDisasterBackdrop,
  addDisasterHeader,
} from '../scripts/disaster-frame.js';
import { createFakePIXI, fakeSheet, FakeBitmapText, FakeGraphics, FakeSprite } from './fake-pixi.js';

function setup() {
  const { PIXI } = createFakePIXI();
  const scene = new PIXI.Container();
  return { PIXI, scene, textures: fakeSheet().textures };
}

test('the backdrop is the source Splash(0): white ground, a double rule, and the skyline', () => {
  const { PIXI, scene, textures } = setup();

  addDisasterBackdrop(PIXI, scene, textures);

  const [frame, ...skyline] = scene.children;
  assert.ok(frame instanceof FakeGraphics, 'the frame is drawn first, under everything');
  assert.deepEqual(frame.drawn, [
    ['beginFill', 0xffffff], ['drawRect', 0, 0, 160, 160], ['endFill'],
    ['lineStyle', 1, 0x000000], ['drawRect', 2, 2, 156, 156], ['drawRect', 4, 4, 152, 152],
  ]);
  // Source bitmap(5,130), bitmap(50,130), bitmap(100,130), lifted two pixels.
  assert.deepEqual(
    skyline.map((sprite) => [sprite instanceof FakeSprite, sprite.texture.name, sprite.x, sprite.y, sprite.visible]),
    [
      [true, SKYLINE_KEYS.left, 5, 128, true],
      [true, SKYLINE_KEYS.middle, 50, 128, true],
      [true, SKYLINE_KEYS.right, 100, 128, true],
    ],
  );
});

test('the header centres "Disaster Alert:" on x=80 and rules it with alternate pixels', () => {
  const { PIXI, scene } = setup();
  // The bold face is wider than the fake's five pixels a character. Seven makes
  // the centred position differ from where the label is first placed, so a
  // header that forgot to centre the title would be caught.
  PIXI.BitmapText = class extends FakeBitmapText {
    get width() { return String(this.text).length * 7; }
  };
  const fonts = { title: { fontName: 'Bold' }, status: { fontName: 'Regular' } };

  const { title } = addDisasterHeader(PIXI, scene, fonts);

  assert.equal(title.text, 'Disaster Alert:');
  assert.equal(title.style, fonts.title);
  // Fifteen characters at seven pixels: 105 wide, so x = 80 - 52.5, rounded.
  assert.deepEqual([title.x, title.y], [28, 8]);
  const rule = scene.children[scene.children.indexOf(title) + 1];
  assert.ok(rule instanceof FakeGraphics, 'the rule is drawn straight after the title');
  assert.deepEqual([rule.x, rule.y], [28, 19], 'eleven pixels under the title');
  const dots = rule.drawn.filter(([name]) => name === 'drawRect');
  assert.equal(dots.length, 53, 'one dot every other pixel across 105');
  assert.deepEqual(dots.slice(0, 2), [['drawRect', 0, 0, 1, 1], ['drawRect', 2, 0, 1, 1]]);
});

test('the caption slot is empty until set, centred when set, and hidden again when cleared', () => {
  const { PIXI, scene } = setup();
  const fonts = { title: { fontName: 'Bold' }, status: { fontName: 'Regular' } };

  const { caption, setCaption } = addDisasterHeader(PIXI, scene, fonts);

  assert.ok(caption instanceof FakeBitmapText);
  assert.equal(caption.style, fonts.status, 'captions are plain, not the bold title face');
  assert.equal(caption.text, '');
  assert.equal(CAPTION_Y, 24, 'five pixels under the rule');

  setCaption('"Red line on four!"');
  assert.equal(caption.visible, true);
  // Nineteen characters at five pixels each: 95 wide, so x = 80 - 47.5, rounded.
  assert.deepEqual([caption.x, caption.y], [33, CAPTION_Y]);

  setCaption('');
  assert.equal(caption.visible, false);
});

test('the header goes over whatever the scene added before it', () => {
  const { PIXI, scene, textures } = setup();

  addDisasterBackdrop(PIXI, scene, textures);
  const sceneOwn = scene.addChild(new PIXI.Container());
  const { title, caption } = addDisasterHeader(PIXI, scene, {});

  assert.ok(scene.children.indexOf(sceneOwn) < scene.children.indexOf(title));
  assert.equal(scene.children.at(-1), caption, 'the caption is the header\'s last part');
});
