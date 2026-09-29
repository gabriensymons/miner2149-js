/**
 * The Operations and Production reports: the two panels the chart and factory
 * buttons open over the mine screen, each with its extension tab, its value
 * labels, the highlights behind the values that need attention, and its OK.
 *
 * Builds them and hands back what the rest of the game needs: the sprites, for
 * the game flow to open and close, and each report's `bindings` -- field name to
 * `{ label, highlight }` -- keyed by the view model's own field names, so
 * `renderReport` takes them as they are. This decides nothing about what a
 * report says; `simulation-calculations.js` does that.
 *
 * Pixi and the button builder arrive by injection, so this runs under Node
 * against a fake (`button.js` reads a global PIXI and cannot be imported there).
 */

import { regular } from '../font-styles.js';

/** Both reports open in the same spot, with the extension tab to their right. */
export const REPORT_POSITION = { x: 5, y: 17 };
export const EXTENSION_POSITION = { x: 104, y: 47 };

/** The black box behind a value that needs attention. The renderer sets its width to the value's. */
export const HIGHLIGHT_SIZE = { width: 23, height: 11 };

/** OK sits in the same spot on both reports. */
export const OK_BUTTON = { width: 42, height: 13, x: 28, y: 119 };

/**
 * Each report's values, one column each, top to bottom. `text` is what a label
 * shows before the first render; `highlighted` values can turn to white on
 * black. Neither report has a highlight on a value that cannot go wrong: the
 * wage, the class, the mine count, the tonnage.
 */
export const OPERATIONS = {
  frame: 'report operations.gif',
  extensionFrame: 'window extension operations.gif',
  x: 55,
  rows: [
    { field: 'workers', y: 15, text: '20(0)', highlighted: true },
    { field: 'jobs', y: 26, text: '100%', highlighted: true },
    { field: 'morale', y: 37, text: '100%(0)', highlighted: true },
    { field: 'wage', y: 48, text: null, highlighted: false },
    { field: 'lifeSupport', y: 59, text: '100%', highlighted: true },
    { field: 'food', y: 70, text: '---', highlighted: true },
    { field: 'health', y: 81, text: '---', highlighted: true },
    { field: 'occupancy', y: 92, text: '---', highlighted: true },
    { field: 'deathRate', y: 103, text: '0%', highlighted: true },
  ],
};

export const PRODUCTION = {
  frame: 'report production.gif',
  extensionFrame: 'window extension production.gif',
  x: 50,
  rows: [
    { field: 'asteroidClass', y: 17, text: '', highlighted: false },
    { field: 'mines', y: 29, text: '0', highlighted: false },
    { field: 'processors', y: 41, text: 'None', highlighted: true },
    { field: 'storage', y: 53, text: '0%', highlighted: true },
    { field: 'power', y: 65, text: '100%', highlighted: true },
    { field: 'diridium', y: 77, text: '0 tons', highlighted: false },
    { field: 'projectedCredits', y: 89, text: '0', highlighted: true },
  ],
};

/**
 * `wage` is the only value a report starts with from the colony rather than a
 * placeholder. `on.closeOperations` and `on.closeProduction` are the OK buttons.
 */
export function createReportViews({ PIXI, sheet, assets, buildTextButton, wage, on }) {
  const initialText = { wage: wage.toString() };

  return {
    operations: buildReport(OPERATIONS, on.closeOperations),
    production: buildReport(PRODUCTION, on.closeProduction),
  };

  function buildReport({ frame, extensionFrame, x, rows }, onClose) {
    const report = PIXI.Sprite.from(sheet.textures[frame]);
    report.x = REPORT_POSITION.x;
    report.y = REPORT_POSITION.y;
    const extension = PIXI.Sprite.from(sheet.textures[extensionFrame]);
    extension.x = EXTENSION_POSITION.x;
    extension.y = EXTENSION_POSITION.y;

    // In row order, so the renderer walks the fields the way the report reads.
    const bindings = Object.fromEntries(rows.map(({ field }) => [field, {}]));

    // Every highlight goes on before any label, so each sits beneath the value
    // it marks: an alert tints the value white over the black box.
    for (const { field, y, highlighted } of rows) {
      if (!highlighted) continue;
      const highlight = new PIXI.Graphics();
      highlight.beginFill(0x000000);
      highlight.drawRect(0, 0, HIGHLIGHT_SIZE.width, HIGHLIGHT_SIZE.height);
      highlight.endFill();
      highlight.position.set(x, y);
      highlight.visible = false;
      report.addChild(highlight);
      bindings[field].highlight = highlight;
    }

    for (const { field, y, text } of rows) {
      const label = new PIXI.BitmapText(text ?? initialText[field], regular);
      label.position.set(x, y);
      report.addChild(label);
      bindings[field].label = label;
    }

    const menu = assets.menuButton;
    const { width, height, x: okX, y: okY } = OK_BUTTON;
    const ok = buildTextButton(report, width, height, okX, okY, menu.normal, menu.hover, menu.down, onClose, 'OK');

    return { report, extension, ok, bindings };
  }
}
