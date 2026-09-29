import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { barText, bold, regular } from '../scripts/font-styles.js';
import { createMessageView } from '../scripts/views/message-view.js';
import { FakeBitmapText, FakeGraphics, FakeSprite, createFakePIXI, fakeSheet } from './fake-pixi.js';

// Geometry is written out as init() had it before phase 9.

function build() {
  const { PIXI } = createFakePIXI();
  return createMessageView({ PIXI, sheet: fakeSheet() });
}

const place = (part) => [part.x, part.y];
const anchor = (part) => [part.anchor.x, part.anchor.y];

// message.js cannot be imported under Node (it imports button.js, which reads
// a global PIXI), so its parameter list is read as text. That is the contract
// the positional parts have to meet, and it is what this pins them against.
test("the dialog parts are in showMessage's parameter order", async () => {
  const source = await readFile(new URL('../scripts/message.js', import.meta.url), 'utf8');
  const parameters = source.match(/function showMessage\(([^)]*?), parent,/)[1].split(',').map((name) => name.trim());
  assert.equal(parameters[0], 'app');

  const { message, dialogParts } = build();
  const byParameter = {
    messageTop: message.top,
    questionIcon: message.questionIcon,
    infoIcon: message.infoIcon,
    messageTitle: message.title,
    messageBottom: message.bottom,
    messageText: message.text,
    inputSubtitle: message.inputSubtitle,
    inputText: message.inputText,
    textureButton: message.buttonTexture.normal,
    textureButtonHover: message.buttonTexture.hover,
    textureButtonDown: message.buttonTexture.down,
    underline: message.underline,
    cursor: message.cursor,
    buttonText1: message.buttonText1,
    buttonText2: message.buttonText2,
  };

  assert.deepEqual(parameters.slice(1), Object.keys(byParameter), 'showMessage still takes these parts');
  parameters.slice(1).forEach((name, index) => {
    assert.equal(dialogParts[index], byParameter[name], `part ${index + 1} is ${name}`);
  });
  assert.equal(dialogParts.length, 15);
});

test('the dialog grows from the top edge and hangs its bottom from the bottom edge', () => {
  const { message } = build();

  assert.equal(message.top.texture.name, 'message top.gif');
  assert.deepEqual(place(message.top), [0, 0]);
  assert.equal(message.bottom.texture.name, 'message bottom.gif');
  assert.deepEqual([...place(message.bottom), ...anchor(message.bottom)], [0, 160, 0, 1]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(message.buttonTexture).map(([state, texture]) => [state, texture.name])),
    { normal: 'message button.gif', hover: 'message button hover.gif', down: 'message button down.gif' },
  );
});

test('the top piece carries both icons in one spot, then the title, the text and the input subtitle', () => {
  const { message } = build();
  const { top, infoIcon, questionIcon, title, text, inputSubtitle } = message;

  assert.deepEqual(top.children, [infoIcon, questionIcon, title, text, inputSubtitle]);
  assert.deepEqual([infoIcon.texture.name, ...place(infoIcon)], ['info icon.gif', 10, 21]);
  assert.deepEqual([questionIcon.texture.name, ...place(questionIcon)], ['question icon.gif', 10, 21]);
  assert.deepEqual([title.text, title.style, ...place(title), ...anchor(title)], ['Message', barText, 80, 1, 0.5, 0]);
  assert.deepEqual([text.text, text.style, ...place(text), text.maxWidth], ['(message here)', bold, 34, 21, 122]);
  assert.deepEqual([inputSubtitle.text, inputSubtitle.style, ...place(inputSubtitle), inputSubtitle.visible],
    ['Please enter a comment:', regular, 6, 16, false]);
});

test('the input line and the button captions start loose and hidden', () => {
  const { message } = build();

  for (const [part, frame] of [[message.underline, 'underline.gif'], [message.cursor, 'cursor.gif']]) {
    assert.ok(part instanceof FakeSprite);
    assert.equal(part.texture.name, frame);
  }
  assert.ok(message.inputText instanceof FakeBitmapText);
  assert.deepEqual([message.inputText.text, message.inputText.style], ['', regular]);
  for (const part of [message.underline, message.cursor, message.inputText]) {
    assert.deepEqual([...place(part), ...anchor(part), part.visible], [6, -25, 0, 1, false]);
  }
  for (const caption of [message.buttonText1, message.buttonText2]) {
    assert.deepEqual([caption.text, caption.style], ['', regular]);
  }
});

test('the progress window holds its title, and the loading bar starts one pixel wide beside it', () => {
  const { progress } = build();

  assert.deepEqual([progress.window.texture.name, ...place(progress.window)], ['progress window.gif', 17, 65]);
  assert.deepEqual(progress.window.children, [progress.title]);
  assert.deepEqual([progress.title.text, progress.title.style, ...place(progress.title)],
    ['Preparing Mining Colony...', regular, 8, 8]);
  assert.ok(progress.bar instanceof FakeGraphics);
  assert.deepEqual(progress.bar.drawn, [['beginFill', 0x000000], ['drawRect', 0, 0, 1, 12], ['endFill']]);
  assert.deepEqual(place(progress.bar), [24, 87]);
});
