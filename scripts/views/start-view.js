/**
 * Everything before a colony exists: the start screen, the launch screen where
 * probes are bought, the list of asteroids they found, and the instructions.
 *
 * Hands back the screens, for the game flow and the start sequence in
 * `app.js`, the probe count label, the hi-score line's label, and the
 * instructions screen's two OK buttons.
 * The asteroid list is built later, once the probes have been launched, so it
 * comes back as `addAsteroidChoice` rather than as buttons. This decides
 * nothing: what the probes find and which asteroid is picked stay in `app.js`
 * and `asteroid-selection.js`.
 *
 * Pixi and the button builders arrive by injection, so this runs under Node.
 */

import { regular } from '../font-styles.js';
import { formatHighScore } from '../high-score-line.js';
import { PLACEHOLDER_RECORD } from '../local-best-score.js';

/** The start screen's three buttons, one above the next. */
export const START_BUTTONS = {
  newMine: { width: 62, height: 14, x: 49, y: 74, text: 'New Mine' },
  loadMine: { width: 62, height: 14, x: 49, y: 91, text: 'Load Mine' },
  instructions: { width: 62, height: 14, x: 49, y: 108, text: 'Instructions' },
};

/**
 * White over the start screen's artwork while the asteroid list is up, leaving
 * the hi-score strip along the bottom showing beneath it.
 */
export const START_COVER = { x: 5, y: 5, width: 150, height: 120 };

/**
 * The hi-score line along the start screen's bottom, measured from the art: the
 * source's `text(80,146,...)`, centred in whole pixels. The cover is what lies
 * inside the frame over those rows: the double border is at x 0, 2, 157 and
 * 159 with its bottom line at y 157, and its rounded corners reach in to x 4
 * and 155 on rows 155-156. It masks the line too, which a large score with a
 * long name of wide letters can stretch to 159 px, past the 150 it has.
 */
export const HIGH_SCORE_LINE = {
  text: { x: 80, y: 146 },
  cover: { x: 5, y: 146, width: 150, height: 11 },
};

/**
 * The Palm OS bitmap font is drawn at 80 px and shown at 16, five font pixels
 * to a Palm pixel, and its glyph frames start a little before the ink -- one
 * font pixel to the left, two above. At the game's 3x rendering that rounds to
 * a whole device pixel right and down. Every label carries it; this one has to
 * land on painted art, so it is drawn that much up and to the left. Measured
 * 2026-10-02 against 'screen start.gif' at the game's own resolution.
 */
const FONT_PADDING = { x: 0.2, y: 0.4 };

/** The probe count, its arrows, and Launch, along the launch screen's bottom row. */
export const PROBE_COUNT_POSITION = { x: 44, y: 127 };
export const PROBE_ARROWS = {
  more: { button: { width: 13, height: 6, x: 64, y: 126 }, hitzone: { width: 18, height: 7, x: 63, y: 125 } },
  fewer: { button: { width: 13, height: 6, x: 64, y: 133 }, hitzone: { width: 18, height: 7, x: 63, y: 133 } },
};
export const LAUNCH_BUTTON = { width: 43, height: 15, x: 85, y: 125, text: 'Launch' };

/** The instructions screen's OK, drawn twice in one spot: from the start screen, and from the mine. */
export const INSTRUCTIONS_OK = { width: 48, height: 13, x: 56, y: 141, text: 'OK' };

/** The asteroid list: a button and a class label per asteroid, twenty pixels a row. */
export const SELECT_ASTEROID_POSITION = { x: 5, y: 3 };
export const ASTEROID_CHOICE = {
  button: { width: 59, height: 17, x: 4, firstY: 29 },
  label: { x: 67, firstY: 32 },
  spacing: 20,
};

/**
 * `probes` is the count the launch screen starts with.
 *
 * `on` carries every control: `newMine`, `loadMine`, `openInstructions`,
 * `closeInstructions` (from the start screen), `closeInstructionsToMine`,
 * `launch`, and the probe arrows as `armMoreProbes`/`moreProbes` and
 * `armFewerProbes`/`fewerProbes` -- the arming function decides whether a press
 * shows as pressed, the other acts on release.
 */
export function createStartView({ PIXI, sheet, assets, buildTextButton, buildSpriteButton, probes, on }) {
  const texture = (name) => PIXI.Texture.from(name);
  const states = (normal, hover, down) => [texture(normal), texture(hover), texture(down)];
  const textButton = (parent, { width, height, x, y, text }, textures, callback) =>
    buildTextButton(parent, width, height, x, y, ...textures, callback, text);

  const startScreen = screen('screen start.gif');
  // The line is painted into the art with the placeholder record. It is drawn
  // again here, in the same font and place -- pixel for pixel the painting while
  // the record is the placeholder -- over white, so it can say something else.
  const { cover, text } = HIGH_SCORE_LINE;
  const highScoreCover = new PIXI.Graphics();
  highScoreCover.beginFill(0xFFFFFF);
  highScoreCover.drawRect(cover.x, cover.y, cover.width, cover.height);
  highScoreCover.endFill();
  startScreen.addChild(highScoreCover);
  const highScoreMask = new PIXI.Graphics();
  highScoreMask.beginFill(0xFFFFFF);
  highScoreMask.drawRect(cover.x, cover.y, cover.width, cover.height);
  highScoreMask.endFill();
  startScreen.addChild(highScoreMask);
  const highScoreText = new PIXI.BitmapText('', regular);
  highScoreText.y = text.y - FONT_PADDING.y;
  highScoreText.mask = highScoreMask;
  startScreen.addChild(highScoreText);
  // Centred as Palm OS centres, in whole pixels: a 133-pixel line starts at
  // 80 - 66 = 14, where the painting does. An anchor of 0.5 would put it at
  // 13.5, which the game's 3x rendering does not round back onto the art.
  const highScore = {
    label: highScoreText,
    setText(line) {
      highScoreText.text = line;
      highScoreText.x = text.x - Math.floor(highScoreText.textWidth / 2) - FONT_PADDING.x;
    },
  };
  highScore.setText(formatHighScore(PLACEHOLDER_RECORD));

  const startCover = new PIXI.Graphics();
  startCover.beginFill(0xFFFFFF);
  startCover.drawRect(START_COVER.x, START_COVER.y, START_COVER.width, START_COVER.height);
  startCover.endFill();

  const launchScreen = screen('screen launch control.png');
  const instructionsScreen = screen('screen instructions.png');
  const selectAsteroidTitle = PIXI.Sprite.from(sheet.textures['select asteroid title.gif']);
  selectAsteroidTitle.x = SELECT_ASTEROID_POSITION.x;
  selectAsteroidTitle.y = SELECT_ASTEROID_POSITION.y;

  // The launch screen's count goes on before its controls.
  const probeCount = new PIXI.BitmapText(probes, regular);
  probeCount.x = PROBE_COUNT_POSITION.x;
  probeCount.y = PROBE_COUNT_POSITION.y;
  launchScreen.addChild(probeCount);

  const startButton = states('button start.gif', 'button-start-hover.gif', 'button start inverted.gif');
  const up = assets.upArrow;
  const down = assets.downArrow;
  textButton(startScreen, START_BUTTONS.newMine, startButton, on.newMine);
  buildSpriteButton(launchScreen, PROBE_ARROWS.more.button, PROBE_ARROWS.more.hitzone,
    up.normal, up.hover, up.down, on.armMoreProbes, on.moreProbes);
  buildSpriteButton(launchScreen, PROBE_ARROWS.fewer.button, PROBE_ARROWS.fewer.hitzone,
    down.normal, down.hover, down.down, on.armFewerProbes, on.fewerProbes);
  textButton(launchScreen, LAUNCH_BUTTON,
    states('button-launch.gif', 'button-launch-hover.gif', 'button-launch-inverted.gif'), on.launch);
  textButton(startScreen, START_BUTTONS.loadMine, startButton, on.loadMine);
  textButton(startScreen, START_BUTTONS.instructions, startButton, on.openInstructions);

  // Two OKs in one spot; only the start screen's shows until the mine's is needed.
  const okButton = states('button OK.gif', 'button-OK-hover.gif', 'button OK inverted.gif');
  const instructionsOk = {
    start: textButton(instructionsScreen, INSTRUCTIONS_OK, okButton, on.closeInstructions),
    mine: textButton(instructionsScreen, INSTRUCTIONS_OK, okButton, on.closeInstructionsToMine),
  };
  instructionsOk.mine.visible = false;

  const asteroidButton = states('button asteroid.gif', 'button-asteroid-hover.gif', 'button asteroid inverted.gif');

  /**
   * Adds one surveyed asteroid to the list: a button named for it, and its class
   * beside it. Row `index` counts from the top.
   */
  function addAsteroidChoice({ index, designation, label, onPick }) {
    const { button, label: labelPlace, spacing } = ASTEROID_CHOICE;
    buildTextButton(selectAsteroidTitle, button.width, button.height, button.x, spacing * index + button.firstY,
      ...asteroidButton, onPick, `Asteroid ${designation}`);
    const classLabel = new PIXI.BitmapText(label, regular);
    classLabel.x = labelPlace.x;
    classLabel.y = index * spacing + labelPlace.firstY;
    selectAsteroidTitle.addChild(classLabel);
  }

  return {
    startScreen,
    startCover,
    highScore,
    launchScreen,
    instructionsScreen,
    selectAsteroidTitle,
    probeCount,
    instructionsOk,
    addAsteroidChoice,
  };

  function screen(frame) {
    const sprite = PIXI.Sprite.from(sheet.textures[frame]);
    sprite.x = 0;
    sprite.y = 0;
    return sprite;
  }
}
