/**
 * The atlas, the fonts, and the textures more than one screen draws with.
 *
 * Phase 9 builds the scene one screen at a time (decisions log, 2026-09-21),
 * and a by-screen split has one failure mode: a texture several screens use
 * gets duplicated, or homed in whichever screen happened to be written first.
 * This is where those go. A texture only one screen uses belongs to that
 * screen's view -- this is not a catalogue of every frame in the atlas.
 *
 * Pixi arrives by injection, the way `map-view.js` takes it, so the load
 * sequence and the catalogue both run under Node against a fake.
 */

export const SPRITESHEET = 'assets/spritesheet.json';
export const FONT_BASE_URL = 'assets/fonts';

/** Bitmap fonts by the face name each `.fnt` declares, which is how `font-styles.js` asks for them. */
export const FONTS = [
  ['Palm OS', 'palm-os-bitmap-white.fnt'],
  ['Palm OS Bold', 'palm-os-bold-bitmap-white.fnt'],
];

/** The menu button stretches to any width from six-pixel corners. */
export const MENU_BUTTON_NINE_SLICE = {
  leftWidth: 6,
  topHeight: 6,
  rightWidth: 6,
  bottomHeight: 6,
};

/**
 * Loads the atlas, then the fonts, then hands the game the atlas.
 *
 * The fonts go through `fontLoader` -- the application's own loader -- rather
 * than the atlas's, which is how the port has always loaded them. An atlas
 * error is logged and loading carries on; fonts that did not load stop the game
 * starting, because every label is bitmap text.
 */
export function loadGameAssets({ PIXI, fontLoader, onLoaded, log = console }) {
  const loader = new PIXI.Loader();
  loader.add(SPRITESHEET);
  loader.onComplete.add(loadFonts);
  loader.onError.add((e) => log.error(`ERROR: ${e.message}`));
  loader.load();

  function loadFonts() {
    fontLoader.baseUrl = FONT_BASE_URL;
    FONTS.reduce((chain, [name, file]) => chain.add(name, file), fontLoader).load(onFontsLoaded);
  }

  function onFontsLoaded() {
    // Moved as found. The comma makes this read only 'Palm OS Bold'.
    if (!PIXI.BitmapFont.available['Palm OS', 'Palm OS Bold']) {
      log.error('Required fonts did not load.');
    } else {
      onLoaded(loader.resources[SPRITESHEET].spritesheet);
    }
  }
}

/**
 * The textures more than one screen draws with, each as the three states a
 * button needs: `normal`, `hover` and `down` (pressed).
 *
 * - `menuButton`: every menu, report, save, load and game-over button, and the
 *   day picker's Cancel. Carries its `nineSlice` for the ones that stretch.
 * - `upArrow` / `downArrow`: the probe count, the sale quantity and the wage.
 * - `emptySpace`: the normal state of a button whose artwork is baked into the
 *   screen behind it, which is most of the mine screen and both dialogs.
 */
export function createGameAssets({ PIXI, sheet }) {
  const texture = (name) => PIXI.Texture.from(name);
  const states = (normal, hover, down) => ({
    normal: texture(normal),
    hover: texture(hover),
    down: texture(down),
  });

  return {
    sheet,
    menuButton: {
      ...states('button-for-menu.gif', 'button-for-menu-hover.gif', 'button-for-menu-inverted.gif'),
      nineSlice: MENU_BUTTON_NINE_SLICE,
    },
    upArrow: states('up-arrow.gif', 'up-arrow-hover.gif', 'up-arrow-inverted.gif'),
    downArrow: states('down-arrow.gif', 'down-arrow-hover.gif', 'down-arrow-inverted.gif'),
    emptySpace: texture('empty space.gif'),
  };
}
