/**
 * The game-over screen: building it, what it says, and where it says it.
 *
 * A colony ends one of three ways -- completed, failed, or resigned -- and each
 * fills the same two lines of text differently. `describeEnding` decides which,
 * and is pure; `showEnding` puts the result on the two lines it is given.
 *
 * The day and the credits are passed in as values rather than read from the
 * colony. The resignation line reports both, and the colony used to be reset in
 * the same function that wrote that line: it worked only because the text was
 * set first. Taking them as arguments makes reading them after a reset
 * impossible rather than merely avoided.
 */

import { buildCompletionPresentation } from './completion-presentation.js';
import { regular } from './font-styles.js';

/** The game-over panel, inset from the screen's corner. */
export const GAME_OVER_POSITION = { x: 4, y: 3 };

/** New Mine and Load Mine side by side, Quit centred beneath them. */
export const GAME_OVER_BUTTONS = {
  newMine: { width: 48, height: 14, x: 17, y: 93, text: 'New Mine' },
  loadMine: { width: 49, height: 14, x: 86, y: 93, text: 'Load Mine' },
  quit: { width: 42, height: 14, x: 55, y: 110, text: 'Quit' },
};

/**
 * A completed mission lists its score, left-aligned from the top corner; the
 * other two endings centre two short lines lower down. These are the port's
 * positions, unchanged.
 */
const COMPLETION_LAYOUT = { anchor: [0, 0], position: [18, 20] };
const STATUS_LAYOUT = { anchor: [0.5, 0], position: [75, 37] };

/**
 * Returns `{ lines: [first, second], layout, followUp }`.
 *
 * `followUp` is a message to show over the game-over screen once it is up, or
 * `null`. Only a completed mission has one: what the colony's future holds.
 *
 * Precedence is completion, then failure, then resignation, which is the order
 * the caller's own branches took.
 */
export function describeEnding({ completion = null, failure = '', day, credits }) {
  if (completion) {
    const presentation = buildCompletionPresentation(completion);
    return {
      lines: [presentation.lines.join('\n'), ''],
      layout: COMPLETION_LAYOUT,
      followUp: presentation.futureMessage,
    };
  }

  if (failure) {
    return {
      lines: [`Mission Status: FAILURE on day ${day}`, `Cause: ${failure}`],
      layout: STATUS_LAYOUT,
      followUp: null,
    };
  }

  return {
    lines: [`Mission Status: RESIGNED on day ${day}`, `Credits Remaining: ${credits}`],
    layout: STATUS_LAYOUT,
    followUp: null,
  };
}

/**
 * Writes a description onto the game-over screen's two text lines.
 *
 * Only the first line moves: the second keeps the position it was built with,
 * and a completed mission leaves it empty.
 */
export function showEnding({ first, second }, { lines, layout }) {
  first.anchor.set(...layout.anchor);
  first.position.set(...layout.position);
  first.text = lines[0];
  second.text = lines[1];
}

/**
 * Builds the game-over screen: the panel, its two status lines, and its three
 * buttons. Returns `{ screen, status }`, where `status` is the `{ first, second }`
 * pair `showEnding` writes to.
 *
 * Both lines start empty and centred on the resignation layout; `showEnding`
 * moves the first one when a completed mission needs it elsewhere. New Mine
 * and Load Mine stretch from the menu button's corners; Quit does not, which is
 * how the port has always drawn it.
 *
 * Pixi and the button builder arrive by injection, so this runs under Node.
 */
export function buildGameOverScreen({ PIXI, sheet, assets, buildTextButton, on }) {
  const screen = PIXI.Sprite.from(sheet.textures['screen game over.png']);
  screen.x = GAME_OVER_POSITION.x;
  screen.y = GAME_OVER_POSITION.y;

  const statusLine = (y) => {
    const line = new PIXI.BitmapText('', regular);
    line.x = STATUS_LAYOUT.position[0];
    line.y = y;
    line.anchor.set(...STATUS_LAYOUT.anchor);
    screen.addChild(line);
    return line;
  };
  const status = { first: statusLine(STATUS_LAYOUT.position[1]), second: statusLine(52) };

  const menu = assets.menuButton;
  const button = ({ width, height, x, y, text }, callback, ...style) =>
    buildTextButton(screen, width, height, x, y, menu.normal, menu.hover, menu.down, callback, text, ...style);
  button(GAME_OVER_BUTTONS.newMine, on.newMine, regular, menu.nineSlice);
  button(GAME_OVER_BUTTONS.loadMine, on.loadMine, regular, menu.nineSlice);
  button(GAME_OVER_BUTTONS.quit, on.quit);

  return { screen, status };
}
