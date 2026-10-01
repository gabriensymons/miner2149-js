/**
 * The day picker on the mine screen: opening it, a tap on a day, and Cancel.
 *
 * What a tap means is `day-picker.js`, which is pure: a tap on a day while the
 * picker is open chooses it, and a tap while it is closed is ignored -- the
 * cells are real buttons that outlive any one opening of the menu. This holds
 * the picker's open state, shows and hides the menu, and hands a choice to the
 * turn. (`app.js` used to say a first tap selected and a second confirmed; it
 * never did.)
 *
 * Injected: the stage manager, and `advance`, the turn's.
 */

import { chooseDay, closeDayPicker, createDayPicker, openDayPicker } from './day-picker.js';

export function createDayPickerController({ view, screens, advance }) {
  const advanceDaysMenu = view.dayPicker.menu;
  const mineScreen = view.mine.screen;
  let dayPicker = createDayPicker();

  function open() {
    dayPicker = openDayPicker(dayPicker);
    screens.show(advanceDaysMenu, mineScreen);
  }

  function pickDay(day) {
    const { state, choice } = chooseDay(dayPicker, day);
    dayPicker = state;
    if (choice === null) return;
    close();
    advance(choice);
  }

  function close() {
    dayPicker = closeDayPicker(dayPicker);
    screens.hide(advanceDaysMenu, mineScreen);
  }

  return { open, pickDay, close };
}
