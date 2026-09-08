/**
 * The v3.2 "Select # of days:" picker, as geometry and state.
 *
 * Twenty cells cannot be expressed in the source-text tests that guard the rest
 * of the mine screen -- those match literal call shapes, and a loop has no
 * literal form. So the layout lives here, where it can be asserted directly,
 * and `app.js` builds the buttons from `dayPickerCells()` without a single
 * coordinate literal of its own.
 *
 * Pure: no DOM, no Pixi.
 */

export const DAY_PICKER_MIN = 1;
export const DAY_PICKER_MAX = 20;
export const DAY_PICKER_COLUMNS = 5;

/** `advance-days-menu.gif`. */
export const DAY_PICKER_MENU = Object.freeze({ width: 113, height: 113 });

/**
 * Where the menu is placed on the 160x160 canvas.
 *
 * x=2 matches the sell dialog and stops the menu short of the control column at
 * x=115. Lives here rather than in `app.js` so the browser test reads the same
 * number the game does -- it was hard-coded in both, and moving one silently
 * left the test clicking a different cell than it named.
 */
export const DAY_PICKER_ORIGIN = Object.freeze({ x: 2, y: 36 });

// Measured off the artwork: the grid rules run at x = 15, 30, 45, 60, 75, 91
// and y = 24, 39, 54, 69, 84, so the pitch is 15 with a 14px interior. The
// number sprites are 12px and sit one pixel inside each rule.
const GRID_ORIGIN = Object.freeze({ x: 15, y: 24 });
const CELL_PITCH = 15;
const CELL_INSET = 2;
const CELL_SIZE = 12;
// The rightmost column is a pixel wider in both the rules and the art
// (advance-5/10/15/20 are 13x12 where the rest are 12x12).
const WIDE_COLUMN = DAY_PICKER_COLUMNS - 1;

/**
 * The grey Cancel button baked into the menu artwork. `app.js` positions a real
 * text button over it; the painted one is a placeholder to be removed from the
 * sprite once the overlay lines up.
 */
export const DAY_PICKER_CANCEL = Object.freeze({ x: 31, y: 91, width: 42, height: 13 });

export function createDayPicker() {
  return Object.freeze({ open: false });
}

export function openDayPicker() {
  return Object.freeze({ open: true });
}

export function closeDayPicker() {
  return Object.freeze({ open: false });
}

/**
 * Resolves a tap on a cell.
 *
 * Returns the chosen day, or null when the pick is not valid -- the picker is
 * closed, or the value is outside 1..20. Rejecting while closed matters because
 * the cells are real buttons that outlive any one opening of the menu.
 */
export function chooseDay(state, day) {
  const valid = state.open
    && Number.isInteger(day)
    && day >= DAY_PICKER_MIN
    && day <= DAY_PICKER_MAX;
  return { state: closeDayPicker(), choice: valid ? day : null };
}

/**
 * Every cell, in reading order.
 *
 * `button` is where the number artwork is drawn; `hitzone` is the whole cell
 * interior, so the pointer target is the box the player sees rather than just
 * the glyph inside it.
 */
export function dayPickerCells() {
  return Array.from({ length: DAY_PICKER_MAX }, (unused, index) => {
    const column = index % DAY_PICKER_COLUMNS;
    const row = Math.floor(index / DAY_PICKER_COLUMNS);
    const width = column === WIDE_COLUMN ? CELL_SIZE + 1 : CELL_SIZE;
    const ruleX = GRID_ORIGIN.x + column * CELL_PITCH;
    const ruleY = GRID_ORIGIN.y + row * CELL_PITCH;
    return {
      day: index + 1,
      row,
      column,
      button: { x: ruleX + CELL_INSET, y: ruleY + CELL_INSET, width, height: CELL_SIZE },
      hitzone: { x: ruleX + 1, y: ruleY + 1, width: CELL_PITCH - 1, height: CELL_PITCH - 1 },
    };
  });
}
