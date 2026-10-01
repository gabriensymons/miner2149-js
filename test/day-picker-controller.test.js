import assert from 'node:assert/strict';
import test from 'node:test';

import { createDayPickerController } from '../scripts/day-picker-controller.js';

// The controller with the stage manager and the turn as recording fakes. The
// view needs only the two handles it shows the menu with.

function build() {
  const view = { dayPicker: { menu: { name: 'menu' } }, mine: { screen: { name: 'mine' } } };
  const log = [];
  const picker = createDayPickerController({
    view,
    screens: {
      show: (sprite, parent) => log.push(['show', sprite.name, parent.name]),
      hide: (sprite, parent) => log.push(['hide', sprite.name, parent.name]),
    },
    advance: (days) => log.push(['advance', days]),
  });
  return { log, picker };
}

const advances = (log) => log.filter(([kind]) => kind === 'advance');

test('opening shows the menu over the mine screen', () => {
  const { log, picker } = build();
  picker.open();

  assert.deepEqual(log, [['show', 'menu', 'mine']]);
});

test('a tap on a day closes the menu, then advances that many days', () => {
  const { log, picker } = build();
  picker.open();
  picker.pickDay(12);

  assert.deepEqual(log.slice(1), [['hide', 'menu', 'mine'], ['advance', 12]]);
});

test('a tap while the picker is closed does nothing -- the cells outlive the menu', () => {
  const { log, picker } = build();
  picker.pickDay(4);
  assert.deepEqual(log, [], 'never opened');

  picker.open();
  picker.pickDay(4);
  picker.pickDay(9);
  assert.deepEqual(advances(log), [['advance', 4]], 'the second tap lands on a closed picker');
});

test('Cancel closes the menu, and a tap after it does nothing', () => {
  const { log, picker } = build();
  picker.open();
  picker.close();
  assert.deepEqual(log.at(-1), ['hide', 'menu', 'mine']);

  picker.pickDay(7);
  assert.deepEqual(advances(log), []);
});

test('the picker can be opened again after a choice', () => {
  const { log, picker } = build();
  picker.open();
  picker.pickDay(1);
  picker.open();
  picker.pickDay(20);

  assert.deepEqual(advances(log), [['advance', 1], ['advance', 20]]);
});

test('a tap the picker rejects still closes it, so a later tap is ignored too', () => {
  const { log, picker } = build();
  picker.open();
  picker.pickDay(0);
  picker.pickDay(5);

  assert.deepEqual(advances(log), []);
});
