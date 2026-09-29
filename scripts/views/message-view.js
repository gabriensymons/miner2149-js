/**
 * The parts every message, confirmation and text-input dialog is drawn from,
 * and the progress window that saving and loading show.
 *
 * `message.js` draws a dialog from fifteen positional parts after the Pixi
 * application. This builds them once and hands them back both ways: by name,
 * for the one caller that reads a part directly (the save workflow reads the
 * typed comment from `inputText`), and as `dialogParts`, in `message.js`'s order,
 * for `dialog-service.js` to spread. The order lives here, next to the parts,
 * so nothing else has to know it.
 *
 * Pixi arrives by injection, so this runs under Node.
 */

import { barText, bold, regular } from '../font-styles.js';

/** The dialog's top grows downward from the screen's top edge; its bottom hangs from the bottom edge. */
export const MESSAGE_TOP_POSITION = { x: 0, y: 0 };
export const MESSAGE_BOTTOM_POSITION = { x: 0, y: 160 };

/** Both icons sit in one spot; `message.js` shows whichever the dialog needs. */
export const ICON_POSITION = { x: 10, y: 21 };

/** Text wider than this wraps. */
export const MESSAGE_TEXT_MAX_WIDTH = 122;

/** The typed comment, its underline and its cursor share a baseline, measured up from the bottom piece. */
export const INPUT_BASELINE = { x: 6, y: -25 };

export const PROGRESS_WINDOW_POSITION = { x: 17, y: 65 };
/** The bar grows from one pixel wide; `app.js` sets its width as loading advances, up to 112. */
export const LOADING_BAR = { x: 24, y: 87, width: 1, height: 12 };

export function createMessageView({ PIXI, sheet }) {
  const sprite = (frame, { x, y }) => {
    const part = PIXI.Sprite.from(sheet.textures[frame]);
    part.x = x;
    part.y = y;
    return part;
  };

  const top = sprite('message top.gif', MESSAGE_TOP_POSITION);
  const bottom = sprite('message bottom.gif', MESSAGE_BOTTOM_POSITION);
  bottom.anchor.set(0, 1);

  const buttonTexture = {
    normal: PIXI.Texture.from('message button.gif'),
    hover: PIXI.Texture.from('message button hover.gif'),
    down: PIXI.Texture.from('message button down.gif'),
  };

  const infoIcon = top.addChild(sprite('info icon.gif', ICON_POSITION));
  const questionIcon = top.addChild(sprite('question icon.gif', ICON_POSITION));

  const title = new PIXI.BitmapText('Message', barText);
  title.x = 80;
  title.y = 1;
  title.anchor.set(0.5, 0);
  top.addChild(title);

  const text = new PIXI.BitmapText('(message here)', bold);
  text.x = 34;
  text.y = 21;
  text.maxWidth = MESSAGE_TEXT_MAX_WIDTH;
  top.addChild(text);

  const inputSubtitle = new PIXI.BitmapText('Please enter a comment:', regular);
  inputSubtitle.position.set(6, 16);
  inputSubtitle.visible = false;
  top.addChild(inputSubtitle);

  // The input line's pieces are loose: `message.js` mounts them when an input
  // dialog opens.
  const underline = inputLinePart(PIXI.Sprite.from(sheet.textures['underline.gif']));
  const cursor = inputLinePart(PIXI.Sprite.from(sheet.textures['cursor.gif']));
  const inputText = inputLinePart(new PIXI.BitmapText('', regular));

  const buttonText1 = new PIXI.BitmapText('', regular);
  const buttonText2 = new PIXI.BitmapText('', regular);

  const progressWindow = sprite('progress window.gif', PROGRESS_WINDOW_POSITION);
  const loadingBar = new PIXI.Graphics();
  loadingBar.beginFill(0x000000);
  loadingBar.drawRect(0, 0, LOADING_BAR.width, LOADING_BAR.height);
  loadingBar.endFill();
  loadingBar.x = LOADING_BAR.x;
  loadingBar.y = LOADING_BAR.y;
  const progressTitle = new PIXI.BitmapText('Preparing Mining Colony...', regular);
  progressTitle.x = 8;
  progressTitle.y = 8;
  progressWindow.addChild(progressTitle);

  return {
    message: {
      top, bottom, infoIcon, questionIcon, title, text, inputSubtitle, inputText,
      buttonTexture, underline, cursor, buttonText1, buttonText2,
    },
    // message.js's positional order, after the Pixi application.
    dialogParts: [
      top, questionIcon, infoIcon, title, bottom, text, inputSubtitle, inputText,
      buttonTexture.normal, buttonTexture.hover, buttonTexture.down, underline, cursor, buttonText1, buttonText2,
    ],
    progress: { window: progressWindow, bar: loadingBar, title: progressTitle },
  };

  function inputLinePart(part) {
    part.position.set(INPUT_BASELINE.x, INPUT_BASELINE.y);
    part.anchor.set(0, 1);
    part.visible = false;
    return part;
  }
}
