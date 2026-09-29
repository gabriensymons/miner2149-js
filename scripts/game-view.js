/**
 * The whole scene, built once: every screen, panel and dialog the game shows.
 *
 * A thin index over the screen factories. It builds nothing itself -- each
 * screen is its own module, split by screen so that everything one screen draws
 * is in one file -- and decides nothing about the game. What it owns is the
 * order, which two things depend on:
 *
 * - The start screen is the first thing on the stage. Everything else is shown
 *   over it, and game over and the launch screen rely on it being beneath them.
 * - On the mine screen, the map is built before its chrome and its shop. The
 *   map's hit zones reach a pixel into the top bar, so it has to stay beneath;
 *   the chrome and the shop never share a pixel, so their order between
 *   themselves decides nothing (see `mine-chrome-view.test.js`).
 *
 * `initial` is the colony the labels start from, read once, here. `slotNames`
 * are the save slots' captions. `on` carries every control's callback, grouped
 * by the screen it belongs to; the logic behind them stays with the caller.
 */

import { createGameAssets } from './game-assets.js';
import { buildGameOverScreen } from './game-over-view.js';
import { createMapSurface } from './map-view.js';
import { createDayPickerView } from './views/day-picker-view.js';
import { createMessageView } from './views/message-view.js';
import { createMineChrome, createMineScreen } from './views/mine-chrome-view.js';
import { createOptionsView } from './views/options-view.js';
import { createReportViews } from './views/report-views.js';
import { createSaveLoadViews } from './views/save-load-views.js';
import { createSellDialogView } from './views/sell-dialog-view.js';
import { createShopView } from './views/shop-view.js';
import { createStartView } from './views/start-view.js';

export function createGameView({ PIXI, sheet, stage, buttons, initial, slotNames, on }) {
  const { buildTextButton, buildSpriteButton, buildHoverHitzone } = buttons;
  const base = { PIXI, sheet };

  // The mine screen exists before anything is added to it, so it comes first.
  const mineScreen = createMineScreen(base);
  const assets = createGameAssets(base);

  const start = createStartView({
    ...base, assets, buildTextButton, buildSpriteButton, probes: initial.probes, on: on.start,
  });
  stage.addChild(start.startScreen);

  const reports = createReportViews({ ...base, assets, buildTextButton, wage: initial.wage, on: on.reports });
  const options = createOptionsView({ ...base, assets, buildTextButton, buildHoverHitzone, on: on.options });
  const saveLoad = createSaveLoadViews({ ...base, assets, buildTextButton, slotNames, on: on.saveLoad });
  const message = createMessageView(base);
  const dayPicker = createDayPickerView({ ...base, assets, buildTextButton, buildSpriteButton, on: on.dayPicker });
  const sell = createSellDialogView({ ...base, assets, buildSpriteButton, diridium: initial.diridium, on: on.sell });
  const gameOver = buildGameOverScreen({ ...base, assets, buildTextButton, on: on.gameOver });

  const map = createMapSurface({ ...base, parent: mineScreen });
  const chrome = createMineChrome({
    ...base,
    assets,
    buildSpriteButton,
    parent: mineScreen,
    initial: { day: initial.day, credits: initial.credits, sellPrice: initial.sellPrice, wage: initial.wage },
    on: on.chrome,
  });
  const shop = createShopView({
    ...base, buildHoverHitzone, parent: mineScreen, caption: initial.shopBtn, price: initial.shopPrice, on: on.shop,
  });

  return {
    assets,
    start,
    reports,
    options,
    saveLoad,
    message,
    dayPicker,
    sell,
    gameOver,
    mine: { screen: mineScreen, map, chrome, shop },
  };
}
