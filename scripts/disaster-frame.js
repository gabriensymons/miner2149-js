/**
 * The frame every disaster scene opens on: the source's Splash(0).
 *
 * `Crash()`, `Pexplode()`, `Cavein()` and `Storm()` all call `Splash(0)` before
 * their own animation, and the recordings show the same backdrop under all four:
 * a white ground inside a double rule, the colony skyline along the bottom, and
 * "Disaster Alert:" over a caption slot. This module draws that part once, so
 * each scene adds only what is its own.
 *
 * It is drawn in two calls because the scene's own layers go between them. The
 * backdrop goes in first, under everything; the header goes in after the
 * scene's moving parts, so anything entering from the top of the screen passes
 * behind the title rather than across it.
 *
 * The source's `Splash()` also draws the hi-score line at (80,146). The port
 * omits it on disaster screens -- a recorded divergence (2026-08-19), since it
 * would collide with the meteor storm's recharge bar.
 *
 * Pixi is injected, so this runs under Node against a fake.
 */

const LOGICAL_SIZE = 160;
// Port adjustment: the browser frame is tighter than the Palm screen, so the
// ground band is lifted two pixels.
export const SCENE_LIFT = 2;
// The caption sits five pixels below the dotted rule under "Disaster Alert:",
// which frees the middle of the screen for whatever the scene animates there.
const TITLE_Y = 8;
const TITLE_UNDERLINE_OFFSET = 11;
export const CAPTION_Y = TITLE_Y + TITLE_UNDERLINE_OFFSET + 5;

export const SKYLINE_KEYS = Object.freeze({
  left: 'SRCBMP-023_splash_frame_line_327.png',
  middle: 'SRCBMP-024_splash_frame_line_328.png',
  right: 'SRCBMP-025_splash_frame_line_329.png',
});

// Source Splash() paints the colony skyline from three bitmaps before any
// disaster animation runs: bitmap(5,130), bitmap(50,130), bitmap(100,130).
const SKYLINE = Object.freeze([
  [SKYLINE_KEYS.left, 5, 130 - SCENE_LIFT],
  [SKYLINE_KEYS.middle, 50, 130 - SCENE_LIFT],
  [SKYLINE_KEYS.right, 100, 130 - SCENE_LIFT],
]);

export function addSprite(PIXI, scene, textures, key, visible = false) {
  const sprite = new PIXI.Sprite(textures[key]);
  sprite.visible = visible;
  scene.addChild(sprite);
  return sprite;
}

export function addLabel(PIXI, scene, text, style, x, y) {
  const label = new PIXI.BitmapText(text, style);
  label.position.set(x, y);
  scene.addChild(label);
  return label;
}

// Source scenes set textalign(01); titles and captions are centred on x = 80.
function centerLabel(label, y) {
  const width = label.width;
  label.position.set(Number.isFinite(width) ? Math.round(80 - width / 2) : label.x, y);
}

// Source Splash(): rect(0,0,0,160,160,0) clears to white, then
// frame(1,1,1,159,159,5) and frame(1,3,3,157,157,5) draw the double rule.
function drawFrame(PIXI) {
  const frame = new PIXI.Graphics();
  frame.beginFill(0xffffff).drawRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE).endFill();
  frame.lineStyle(1, 0x000000).drawRect(2, 2, 156, 156).drawRect(4, 4, 152, 152);
  return frame;
}

// Source scenes set textattr(2,1,1) for the title, which underlines it. Palm
// draws the rule as alternating pixels, so step two per dot.
function drawTitleUnderline(PIXI, scene, title) {
  const rule = new PIXI.Graphics();
  const width = Number.isFinite(title.width) ? Math.round(title.width) : 0;
  rule.position.set(title.x, title.y + TITLE_UNDERLINE_OFFSET);
  rule.beginFill(0x000000);
  for (let x = 0; x < width; x += 2) rule.drawRect(x, 0, 1, 1);
  rule.endFill();
  scene.addChild(rule);
  return rule;
}

/** The ground, the double rule and the skyline. Add it to the scene first. */
export function addDisasterBackdrop(PIXI, scene, textures) {
  scene.addChild(drawFrame(PIXI));
  for (const [key, x, y] of SKYLINE) {
    addSprite(PIXI, scene, textures, key, true).position.set(x, y);
  }
}

/**
 * "Disaster Alert:", its dotted rule, and the caption slot under it. Add it
 * after the scene's moving parts. `setCaption('')` hides the caption.
 */
export function addDisasterHeader(PIXI, scene, fonts = {}) {
  // SRCMSG-003: text(80, 15, "Disaster Alert:"), in every disaster scene.
  const title = addLabel(PIXI, scene, 'Disaster Alert:', fonts.title ?? fonts.status, 43, TITLE_Y);
  centerLabel(title, TITLE_Y);
  drawTitleUnderline(PIXI, scene, title);
  // Every scene writes its captions to the same centred slot. The original
  // prints their quotation marks literally, and the recordings show them.
  const caption = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 50, CAPTION_Y);

  function setCaption(text) {
    caption.text = text;
    caption.visible = text.length > 0;
    centerLabel(caption, CAPTION_Y);
  }

  return { title, caption, setCaption };
}
