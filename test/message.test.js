import assert from 'node:assert/strict';
import test from 'node:test';

import { createMessageView } from '../scripts/views/message-view.js';
import { FakeContainer, FakeSprite, createFakePIXI, fakeSheet } from './fake-pixi.js';

// The text-input dialog is the one adapter that takes resources from outside
// the scene while it is open: a key listener on `window`, for typing, and an
// interval that flashes the cursor. Both have to go on either way out -- OK or
// Cancel -- or every comment the player types leaves a listener appending
// letters to a dialog that is gone, and a timer toggling a hidden cursor.
//
// `message.js` builds its buttons with `new PIXI.Sprite` from a global, as
// `button.js` does, so the global is supplied here (button.test.js does the
// same) and the module is imported after it.

class EmittingSprite extends FakeSprite {
  constructor(texture) {
    super(texture);
    this.handlers = {};
  }

  on(type, handler) {
    (this.handlers[type] ??= []).push(handler);
    return this;
  }

  emit(type) {
    for (const handler of this.handlers[type] ?? []) handler();
  }
}

globalThis.PIXI = { Sprite: EmittingSprite };
globalThis.window = new EventTarget();
const { showInput, showMessage } = await import('../scripts/message.js');

/** setInterval and clearInterval replaced for one test, recording what is still running. */
function trackIntervals(t) {
  const running = new Set();
  let next = 1;
  const { setInterval: realSet, clearInterval: realClear } = globalThis;
  globalThis.setInterval = () => { const id = next++; running.add(id); return id; };
  globalThis.clearInterval = (id) => { running.delete(id); };
  t.after(() => { globalThis.setInterval = realSet; globalThis.clearInterval = realClear; });
  return running;
}

function open(t, show) {
  const intervals = trackIntervals(t);
  const { PIXI } = createFakePIXI();
  const { message, dialogParts } = createMessageView({ PIXI, sheet: fakeSheet() });
  const stage = new FakeContainer();
  const app = { stage };
  const parent = new FakeContainer();
  const answers = [];
  show(app, ...dialogParts, parent, 'Deep', () => answers.push('ok'), () => answers.push('cancel'));
  const buttons = message.bottom.children.filter((child) => child instanceof EmittingSprite);
  return { message, stage, parent, answers, buttons, intervals };
}

function type(key) {
  const event = new Event('keydown');
  Object.assign(event, { key, keyCode: key.toUpperCase().charCodeAt(0), charCode: 0 });
  window.dispatchEvent(event);
}

function press(button) {
  button.emit('pointerdown');
  button.emit('pointerup');
}

for (const [exit, index] of [['OK', 0], ['Cancel', 1]]) {
  test(`the input dialog takes a key listener and a cursor timer while open, and ${exit} gives both back`, (t) => {
    const { message, stage, parent, answers, buttons, intervals } = open(t, showInput);
    assert.equal(buttons.length, 2);
    assert.equal(intervals.size, 1, 'the cursor flashes');
    assert.equal(parent.interactiveChildren, false, 'the screen beneath is locked');

    type('s');
    assert.equal(message.inputText.text, 'Deeps', 'typing reaches the dialog');

    press(buttons[index]);
    assert.deepEqual(answers, [exit === 'OK' ? 'ok' : 'cancel']);
    assert.equal(intervals.size, 0, 'the cursor timer is cleared');
    type('x');
    assert.equal(message.inputText.text, 'Deeps', 'and keys no longer reach it');
    assert.deepEqual([stage.children, message.bottom.children], [[], []], 'the dialog is off the stage');
    assert.equal(parent.interactiveChildren, true, 'and the screen beneath is unlocked');
  });
}

test('a plain message takes neither', (t) => {
  const { message, buttons, intervals } = open(t, showMessage);
  assert.equal(buttons.length, 1);
  assert.equal(intervals.size, 0);

  const before = message.inputText.text;
  type('s');
  assert.equal(message.inputText.text, before);
  press(buttons[0]);
});
