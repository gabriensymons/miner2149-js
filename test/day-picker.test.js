import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DAY_PICKER_CANCEL,
  DAY_PICKER_COLUMNS,
  DAY_PICKER_MAX,
  DAY_PICKER_MENU,
  DAY_PICKER_MIN,
  chooseDay,
  closeDayPicker,
  createDayPicker,
  dayPickerCells,
  openDayPicker,
} from '../scripts/day-picker.js';

test('the picker opens, closes, and starts closed', () => {
  const created = createDayPicker();

  assert.equal(created.open, false);
  assert.equal(openDayPicker(created).open, true);
  assert.equal(closeDayPicker(openDayPicker(created)).open, false);
});

test('choosing a day returns it and closes the picker', () => {
  const open = openDayPicker(createDayPicker());

  for (const day of [DAY_PICKER_MIN, 7, 13, DAY_PICKER_MAX]) {
    const result = chooseDay(open, day);
    assert.equal(result.choice, day);
    assert.equal(result.state.open, false, 'picking dismisses the menu');
  }
});

test('a pick outside the grid, or while closed, yields nothing', () => {
  const open = openDayPicker(createDayPicker());
  const closed = createDayPicker();

  for (const day of [0, -1, 21, 1.5, '7', Number.NaN, null, undefined]) {
    assert.equal(chooseDay(open, day).choice, null, String(day));
  }
  // The cells are real buttons that outlive any one opening of the menu, so a
  // stray press while it is dismissed must not advance time.
  assert.equal(chooseDay(closed, 7).choice, null);
});

test('there are twenty cells, in reading order, one per day', () => {
  const cells = dayPickerCells();

  assert.equal(cells.length, DAY_PICKER_MAX);
  assert.deepEqual(
    cells.map(({ day }) => day),
    Array.from({ length: DAY_PICKER_MAX }, (unused, index) => index + 1),
  );
  assert.deepEqual(cells[0], {
    day: 1,
    row: 0,
    column: 0,
    button: { x: 17, y: 26, width: 12, height: 12 },
    hitzone: { x: 16, y: 25, width: 14, height: 14 },
  });
  // 5, 10, 15 and 20 sit in the rightmost column, whose artwork is a pixel
  // wider than the rest (13x12 against 12x12).
  for (const day of [5, 10, 15, 20]) {
    assert.equal(cells[day - 1].column, DAY_PICKER_COLUMNS - 1, `${day} is last in its row`);
    assert.equal(cells[day - 1].button.width, 13, `${day} uses the wider artwork`);
  }
  for (const day of [1, 2, 3, 4, 6, 11, 19]) {
    assert.equal(cells[day - 1].button.width, 12);
  }
});

test('cells sit on the 15px grid the artwork rules are drawn on', () => {
  const cells = dayPickerCells();

  // Rules run at x = 15,30,45,60,75 and y = 24,39,54,69; the number art sits
  // two pixels inside each. Reading these off the sprite is what the whole
  // module exists to avoid doing again by hand.
  assert.deepEqual([...new Set(cells.map(({ button }) => button.x))], [17, 32, 47, 62, 77]);
  assert.deepEqual([...new Set(cells.map(({ button }) => button.y))], [26, 41, 56, 71]);
});

test('no two cells overlap', () => {
  const cells = dayPickerCells();

  for (const [index, cell] of cells.entries()) {
    for (const other of cells.slice(index + 1)) {
      const separate = cell.hitzone.x + cell.hitzone.width <= other.hitzone.x
        || other.hitzone.x + other.hitzone.width <= cell.hitzone.x
        || cell.hitzone.y + cell.hitzone.height <= other.hitzone.y
        || other.hitzone.y + other.hitzone.height <= cell.hitzone.y;
      assert.ok(separate, `day ${cell.day} overlaps day ${other.day}`);
    }
  }
});

test('every cell and the Cancel button fit inside the menu artwork', () => {
  for (const { day, button, hitzone } of dayPickerCells()) {
    for (const [name, box] of [['button', button], ['hitzone', hitzone]]) {
      assert.ok(box.x >= 0 && box.y >= 0, `day ${day} ${name} starts inside the menu`);
      assert.ok(
        box.x + box.width <= DAY_PICKER_MENU.width
        && box.y + box.height <= DAY_PICKER_MENU.height,
        `day ${day} ${name} overflows the menu`,
      );
    }
  }

  assert.ok(
    DAY_PICKER_CANCEL.x + DAY_PICKER_CANCEL.width <= DAY_PICKER_MENU.width
    && DAY_PICKER_CANCEL.y + DAY_PICKER_CANCEL.height <= DAY_PICKER_MENU.height,
  );
});

test('the Cancel overlay covers the grey button painted into the artwork', () => {
  // Measured from the sprite: the placeholder button is 42x13 at (31,91). It is
  // to be removed from the art once the real button lines up over it.
  assert.deepEqual(DAY_PICKER_CANCEL, { x: 31, y: 91, width: 42, height: 13 });
  // It sits below the last row of cells rather than over them.
  const lastRowBottom = Math.max(...dayPickerCells().map(({ hitzone }) => hitzone.y + hitzone.height));
  assert.ok(DAY_PICKER_CANCEL.y >= lastRowBottom, 'Cancel clears the grid');
});
