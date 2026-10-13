/**
 * The power-plant overload scene, as the source draws it in `Pexplode()`.
 *
 * What is on screen when is `power-plant-overload.js`; this draws it. The scene
 * is opened over the mine screen once the damage has been rolled, plays for the
 * original's 7.2 seconds, and hands back through `onComplete`. The player cannot
 * do anything during it, as in the original.
 *
 * Every bitmap in it is opaque, as the Palm's were: each is drawn over the one
 * before rather than replacing it, which is why the blast frames accumulate.
 *
 * Pixi, the ticker and the document are injected, so this runs under Node.
 */

import {
  SCENE_LIFT,
  addDisasterBackdrop,
  addDisasterHeader,
  addSprite,
} from './disaster-frame.js';
import { overloadFrameAt } from './power-plant-overload.js';

const LOGICAL_SIZE = 160;

// Source bitmaps from the loaded atlas, keyed by their role in Pexplode().
export const SPRITE_KEYS = Object.freeze({
  // Source lines 182 and 185: the plant's two pulse bitmaps, 10x10.
  pulseA: 'SRCBMP-004_pexplode_frame_line_182.png',
  pulseB: 'SRCBMP-005_pexplode_frame_line_185.png',
  // Source lines 190-196: the blast, growing and walking up and to the left.
  blast: Object.freeze([
    'SRCBMP-006_pexplode_frame_line_190.png',
    'SRCBMP-007_pexplode_frame_line_192.png',
    'SRCBMP-008_pexplode_frame_line_194.png',
    'SRCBMP-009_pexplode_frame_line_196.png',
  ]),
});

// Everything below the caption is drawn against the skyline, so it is lifted
// with it (disaster-frame.js) to stay where the source put it relative to the
// skyline art. bitmap(95,135) for the plant; bitmap(94,133) .. bitmap(91,127)
// for the blast.
const PLANT_POSITION = Object.freeze({ x: 95, y: 135 - SCENE_LIFT });
const BLAST_POSITIONS = Object.freeze([
  [94, 133], [93, 131], [92, 129], [91, 127],
].map(([x, y]) => Object.freeze({ x, y: y - SCENE_LIFT })));
// rect(1,100,55,101,130,0): one pixel wide, from y=55 down to the skyline. Read
// with the caption, it is the gauge that is redlining.
const GAUGE = Object.freeze({ x: 100, y: 55 - SCENE_LIFT, width: 1, height: 130 - 55 });

export function createPowerPlantView({
  PIXI,
  app,
  document: documentRef = globalThis.document,
  fonts = {},
  textures = {},
  underlyingParent,
  onComplete = () => {},
}) {
  let scene = null;
  let header = null;
  let pulseSprites = null;
  let blastSprites = [];
  let elapsed = 0;
  let tickerListener = null;
  let previousInteractiveChildren;

  function render() {
    const frame = overloadFrameAt(elapsed);
    header.setCaption(frame.caption);
    pulseSprites.a.visible = frame.pulse === 'a';
    pulseSprites.b.visible = frame.pulse === 'b';
    blastSprites.forEach((sprite, index) => { sprite.visible = index < frame.blastFrames; });
    return frame;
  }

  function open() {
    if (scene) close();
    previousInteractiveChildren = underlyingParent?.interactiveChildren;
    if (underlyingParent) underlyingParent.interactiveChildren = false;

    scene = new PIXI.Container();
    addDisasterBackdrop(PIXI, scene, textures);
    const gauge = new PIXI.Graphics();
    gauge.beginFill(0x000000).drawRect(GAUGE.x, GAUGE.y, GAUGE.width, GAUGE.height).endFill();
    gauge.name = 'gauge';
    scene.addChild(gauge);
    pulseSprites = {
      a: addSprite(PIXI, scene, textures, SPRITE_KEYS.pulseA),
      b: addSprite(PIXI, scene, textures, SPRITE_KEYS.pulseB),
    };
    pulseSprites.a.position.set(PLANT_POSITION.x, PLANT_POSITION.y);
    pulseSprites.b.position.set(PLANT_POSITION.x, PLANT_POSITION.y);
    blastSprites = SPRITE_KEYS.blast.map((key, index) => {
      const sprite = addSprite(PIXI, scene, textures, key);
      sprite.position.set(BLAST_POSITIONS[index].x, BLAST_POSITIONS[index].y);
      return sprite;
    });
    header = addDisasterHeader(PIXI, scene, fonts);
    // Taps land on the scene and stop there, so nothing underneath can be
    // reached while it plays.
    const inputShield = new PIXI.Container();
    inputShield.interactive = true;
    inputShield.hitArea = new PIXI.Rectangle(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    scene.addChild(inputShield);
    app.stage.addChild(scene);

    elapsed = 0;
    render();
    tickerListener = () => {
      // Paused while the page is hidden, so a player who switches away does
      // not come back to a plant that has already blown.
      if (!scene || documentRef?.hidden) return;
      elapsed += Math.max(0, app.ticker.deltaMS);
      if (render().complete) finish();
    };
    app.ticker.add(tickerListener);
  }

  function finish() {
    close();
    onComplete();
  }

  function close() {
    if (!scene) return;
    app.ticker.remove(tickerListener);
    tickerListener = null;
    app.stage.removeChild(scene);
    scene.destroy({ children: true });
    scene = null;
    header = null;
    pulseSprites = null;
    blastSprites = [];
    if (underlyingParent) underlyingParent.interactiveChildren = previousInteractiveChildren;
  }

  return { open, close };
}
