/**
 * The power-plant overload scene, as the source draws it in `Pexplode()`, with
 * the player's breaker panel over it.
 *
 * What is on screen when, and what a tap does, is `power-plant-overload.js`;
 * this draws it and passes the taps on. Once the player has tapped the lit
 * unit, the open repair is drawn by `breaker-games-view.js` in the panel's
 * place, and a countdown runs along the bottom row. The scene is opened over the mine
 * screen once the damage has been rolled, plays for the original's 7.2 seconds
 * -- less if the overload is contained -- and hands its final state back
 * through `onComplete`, for the controller to read how many faults were fixed.
 *
 * `interactive: false` draws the original alone: no panel, and taps do nothing.
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
import { createRepairLayer, targetAt } from './breaker-games-view.js';
import {
  advanceOverload,
  createOverload,
  overloadFrame,
  tapRepair,
  tapUnit,
} from './power-plant-overload.js';

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
// The countdown, port addition: centred on the bottom row, under the skyline,
// where the meteor storm keeps its counters. Inverted for a moment when a
// mistake takes time off it.
const COUNTDOWN_Y = 147 - SCENE_LIFT;

export function formatCountdown(milliseconds) {
  return (Math.ceil(milliseconds / 100) / 10).toFixed(1);
}

// The breaker panel: a row of numbered units between the caption and the top of
// the gauge. Port addition. Fourteen pixels a unit fits eight across the play
// field with room to spare; thirteen tall leaves two rows clear of the caption
// above and of the gauge below.
export const PANEL = Object.freeze({ y: 37, unitWidth: 14, unitHeight: 13, gap: 2 });

function panelLeft(unitCount) {
  const width = unitCount * PANEL.unitWidth + (unitCount - 1) * PANEL.gap;
  return Math.round(80 - width / 2);
}

/** Which unit, 1-based, a point on the 160x160 screen lands on; null for none. */
export function unitAt({ x, y }, unitCount) {
  // A pixel of slack above and below, and the gaps split between neighbours,
  // so a tap on the edge of a unit counts.
  if (y < PANEL.y - 1 || y > PANEL.y + PANEL.unitHeight) return null;
  const pitch = PANEL.unitWidth + PANEL.gap;
  const offset = x - panelLeft(unitCount) + PANEL.gap / 2;
  const unit = Math.floor(offset / pitch) + 1;
  return unit >= 1 && unit <= unitCount ? unit : null;
}

// One unit's box: white with a black rule, black when it is the one flashing,
// and its rule dotted while the panel is tripped -- Palm's look for a control
// that will not answer.
function drawUnit(box, { lit, tripped }) {
  const { unitWidth: width, unitHeight: height } = PANEL;
  box.clear();
  box.beginFill(lit ? 0x000000 : 0xffffff).drawRect(0, 0, width, height).endFill();
  if (lit) return;
  box.beginFill(0x000000);
  const step = tripped ? 2 : 1;
  for (let x = 0; x < width; x += step) {
    box.drawRect(x, 0, 1, 1);
    box.drawRect(x, height - 1, 1, 1);
  }
  for (let y = 0; y < height; y += step) {
    box.drawRect(0, y, 1, 1);
    box.drawRect(width - 1, y, 1, 1);
  }
  box.endFill();
}

export function createPowerPlantView({
  PIXI,
  app,
  document: documentRef = globalThis.document,
  fonts = {},
  textures = {},
  underlyingParent,
  difficulty = 3,
  random,
  interactive = true,
  // The development panel's overrides: a countdown other than the class's, and
  // one repair every time.
  countdownMs,
  kind,
  onComplete = () => {},
}) {
  let scene = null;
  let header = null;
  let pulseSprites = null;
  let blastSprites = [];
  let units = [];
  let gauge = null;
  let repair = null;
  let countdownBox = null;
  let countdownLabel = null;
  let state = null;
  let tickerListener = null;
  let previousInteractiveChildren;

  function render() {
    const frame = overloadFrame(state);
    header.setCaption(frame.caption);
    pulseSprites.a.visible = frame.pulse === 'a';
    pulseSprites.b.visible = frame.pulse === 'b';
    blastSprites.forEach((sprite, index) => { sprite.visible = index < frame.blastFrames; });
    // A repair takes the panel's place, and the gauge's: it is the clock now.
    const panelShown = !frame.game;
    gauge.visible = panelShown;
    units.forEach(({ box, label }, index) => {
      const lit = frame.flashing === index + 1;
      box.visible = panelShown;
      label.visible = panelShown;
      drawUnit(box, { lit, tripped: frame.locked });
      label.tint = lit ? 0xffffff : 0x000000;
    });
    repair?.render(frame.game);
    renderCountdown(frame);
    return frame;
  }

  function renderCountdown(frame) {
    const running = frame.countdown !== null;
    countdownLabel.visible = running;
    countdownBox.visible = running && frame.penalised;
    if (!running) return;
    countdownLabel.text = formatCountdown(frame.countdown);
    const width = Number.isFinite(countdownLabel.width) ? countdownLabel.width : 0;
    const x = Math.round(80 - width / 2);
    countdownLabel.position.set(x, COUNTDOWN_Y);
    countdownLabel.tint = frame.penalised ? 0xffffff : 0x000000;
    countdownBox.clear();
    countdownBox.beginFill(0x000000).drawRect(x - 2, COUNTDOWN_Y - 1, width + 4, 11).endFill();
  }

  function addPanel(unitCount) {
    const left = panelLeft(unitCount);
    const font = fonts.status ?? fonts.title;
    units = Array.from({ length: unitCount }, (_, index) => {
      const x = left + index * (PANEL.unitWidth + PANEL.gap);
      const box = new PIXI.Graphics();
      box.position.set(x, PANEL.y);
      box.name = `unit ${index + 1}`;
      scene.addChild(box);
      const label = new PIXI.BitmapText(String(index + 1), { ...font });
      const width = Number.isFinite(label.width) ? label.width : 0;
      label.position.set(x + Math.round((PANEL.unitWidth - width) / 2), PANEL.y + 1);
      scene.addChild(label);
      return { box, label };
    });
  }

  function tap(event) {
    event.stopPropagation?.();
    if (!scene || !interactive) return;
    const point = scene.toLocal(event.data.global);
    if (state.game) {
      const target = targetAt(state.game, point);
      if (target === null) return;
      state = tapRepair(state, target, { random });
    } else {
      const unit = unitAt(point, state.unitCount);
      if (unit === null) return;
      state = tapUnit(state, unit, { random });
    }
    render();
  }

  function open() {
    if (scene) close();
    previousInteractiveChildren = underlyingParent?.interactiveChildren;
    if (underlyingParent) underlyingParent.interactiveChildren = false;

    scene = new PIXI.Container();
    addDisasterBackdrop(PIXI, scene, textures);
    gauge = new PIXI.Graphics();
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
    state = createOverload({ difficulty, countdownMs, kind });
    units = [];
    repair = null;
    if (interactive) {
      addPanel(state.unitCount);
      repair = createRepairLayer({ PIXI, parent: scene, font: fonts.status ?? fonts.title });
    }
    countdownBox = new PIXI.Graphics();
    countdownBox.name = 'countdown box';
    scene.addChild(countdownBox);
    countdownLabel = new PIXI.BitmapText('', { ...(fonts.status ?? fonts.title) });
    countdownLabel.name = 'countdown';
    scene.addChild(countdownLabel);
    // Taps land on the scene and stop there, so nothing underneath can be
    // reached while it plays. The panel's own taps are read from here too.
    const inputShield = new PIXI.Container();
    inputShield.interactive = true;
    inputShield.hitArea = new PIXI.Rectangle(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    inputShield.on('pointerdown', tap);
    scene.addChild(inputShield);
    app.stage.addChild(scene);

    render();
    tickerListener = () => {
      // Paused while the page is hidden, so a player who switches away does
      // not come back to a plant that has already blown.
      if (!scene || documentRef?.hidden) return;
      state = advanceOverload(state, app.ticker.deltaMS);
      if (render().complete) finish();
    };
    app.ticker.add(tickerListener);
  }

  function finish() {
    const finalState = state;
    close();
    onComplete(finalState);
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
    units = [];
    gauge = null;
    repair = null;
    countdownBox = null;
    countdownLabel = null;
    state = null;
    if (underlyingParent) underlyingParent.interactiveChildren = previousInteractiveChildren;
  }

  // The overload as it stands, for the tests and the dev panel; read-only.
  return { open, close, state: () => state };
}
