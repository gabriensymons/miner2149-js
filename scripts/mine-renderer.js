/**
 * Draws the mine screen from the colony: the labels, the shop selection, the
 * level buttons, the options checkboxes, both reports and the storage icon.
 *
 * `render()` is the one seam between saved state and what is on screen. A new
 * colony and a loaded one both come through it, so a field added to
 * `gameDataInit` has exactly one place it has to be applied.
 *
 * That was not true before. Each path re-applied its own hand-picked subset, and
 * two fields fell through the gap on the same day: the shop selection came back
 * as a caption without the sprites that draw it, and the saved level was drawn
 * over with level 1. Neither path was wrong on its own terms -- each was wrong
 * about what the other had already done, which is the failure this removes.
 *
 * It deliberately does not own the asteroid surface. Drawing that is a
 * transition rather than a render: it animates, it takes a level and a
 * clear-first flag that only the caller knows, and it writes the level back when
 * it lands. `gotoMineScreen()` owns it.
 *
 * The colony is read through the session and never written. The view's handles
 * arrive in the object `createGameView()` returns. Two things belong to other
 * parts of the game and are injected: counting a building by name, and what
 * tapping the storage icon does -- which is to ask for a sale.
 */

import { getDiridiumStorageState } from './diridium-storage.js';
import { renderReport } from './report-renderer.js';
import { resolveShopSelection } from './shop.js';
import { calculateOperationsReport, calculateProductionReport, countCompletedBuildingsByName } from './simulation-calculations.js';

// The storage icon's button and its hit zone are the same 14x13 box.
const STORAGE_BUTTON = { width: 14, height: 13, x: 0, y: 0 };
const STORAGE_HITZONE = { width: 14, height: 13, x: 0, y: 0 };

export function createMineRenderer({
  session, view, shopItems, buildingNames, buildSpriteButton, countBuildingsByName, requestSale,
}) {
  const { menu: optionsMenu, checks } = view.options;
  const { probeCount } = view.start;
  const { dayText, creditText, sellPrice, wage, levelSelected, storageIcon, storageTextures } = view.mine.chrome;
  const { selected: shopSprites, caption: storeText, price: storePrice, captionHighlight: storeTextHighlight } = view.mine.shop;
  const { operations, production } = view.reports;

  function render() {
    const state = session.getState();

    // Options
    initCheck(checks.disasterMode, 'disasterMode', optionsMenu);
    initCheck(checks.gridlines, 'gridlinesEnabled', optionsMenu);

    // Status bar, shop caption, and the control rows
    probeCount.text = state.probes;
    dayText.text = state.day.toString();
    creditText.text = state.credits.toString();
    storeText.text = state.shopBtn;
    storePrice.text = state.shopPrice.toString();
    sellPrice.text = state.sellPrice.toString();
    wage.text = state.wage.toString();

    // Sprite state the text does not carry. Both of these used to be applied by
    // whichever entry path happened to run, which is how they came to disagree.
    restoreShopSelection();
    updateLevelButtons(state.level);

    // Reports read the maps, and carry the diridium storage icon with them.
    updateReports();

    function initCheck(sprite, data, parent) {
      if (state[data]) parent.addChild(sprite);
      else parent.removeChild(sprite);
    }
  }

  // Re-applies the saved shop selection to the sprites that draw it. render()
  // runs with the colony already replaced by a loaded save, but the
  // selected-item highlight, the caption tint and the affordability marker all
  // live on sprites that still belong to the previous colony. Restoring the
  // caption text alone leaves the shop showing one item and selecting another.
  function restoreShopSelection() {
    const { id, unaffordable } = resolveShopSelection(session.getState(), shopItems);

    Object.values(shopSprites).forEach(sprite => { sprite.visible = false; });
    storeText.tint = unaffordable ? 0xFFFFFF : 0x000000;
    storeTextHighlight.visible = unaffordable;

    if (id === null) return;

    shopSprites[id].visible = true;
  }

  function updateLevelButtons(level) {
    // Change which level button is active
    levelSelected.level1.visible = level === 'level1';
    levelSelected.level2.visible = level === 'level2';
    levelSelected.level3.visible = level === 'level3';
  }

  function updateReports() {
    const state = session.getState();
    const buildingCounts = countCompletedBuildingsByName(state.maps, buildingNames);
    const operationsViewModel = calculateOperationsReport(state);
    const productionViewModel = calculateProductionReport(state, buildingCounts);

    renderReport(operationsViewModel, operations.bindings);
    renderReport(productionViewModel, production.bindings);

    updateDiridiumStorageIcon();
  }

  function updateDiridiumStorageIcon() {
    const { fill } = getDiridiumStorageState({
      diridium: session.getState().diridium,
      processorCount: countBuildingsByName('Processor'),
      storageCount: countBuildingsByName('Storage'),
    });
    const { normal, hover, down } = storageTextures[fill];

    // Clear container children in order to update sprite textures
    storageIcon.removeChildren();

    // Add button inside storage icon container. Pressed/on is intentionally transparent.
    buildSpriteButton(
      storageIcon,
      STORAGE_BUTTON,
      STORAGE_HITZONE,
      normal,
      hover,
      down,
      () => true,
      requestSale,
    );
  }

  return { render, updateReports, updateLevelButtons, updateDiridiumStorageIcon };
}
