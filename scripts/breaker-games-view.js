/**
 * Draws the open repair (breaker-games.js) and says what a press landed on.
 *
 * Everything is drawn the Palm's way: black on white, one-pixel rules, a lit
 * control inverted, a dotted rule for one that is gone. The repairs share the
 * play field between the caption (y 24) and the skyline (y 128), and nothing
 * here is source art -- it is the port's, in the source's idiom.
 *
 * `layout(game)` is the geometry, pure, so a test can tap the middle of a
 * switch without a renderer. `createRepairLayer` draws it and redraws only when
 * what is shown has changed, so a sixty-frame second makes no new objects.
 */

import { keypadLit, keypadShowing, switchLabel } from './breaker-games.js';

const SWITCH_PITCH = 16;
const SWITCH_SIZE = 12;
const KEY = Object.freeze({ width: 18, height: 14, gap: 2, top: 50 });
const FUSE = Object.freeze({ width: 12, height: 22, pitch: 20, top: 40 });
const PART = Object.freeze({ width: 22, height: 12, pitch: 26, top: 80 });
const RESET = Object.freeze({ width: 40, height: 13, top: 104 });
const BREAKER = Object.freeze({ x: 10, y: 46, width: 24, height: 36 });
const PRIME = Object.freeze({ x: 122, y: 46, width: 30, height: 14 });
const ROUTE_LEFT = 34;
const ROUTE_RIGHT = 122;
// Generous: a route is a one-pixel line, and a finger is not.
const ROUTE_REACH = 7;

const centred = (width) => Math.round(80 - width / 2);
const inside = ({ x, y }, box) => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;

/** Every pressable part of a repair, as boxes with the target each one stands for. */
export function layout(game) {
  switch (game.kind) {
    case 'switches': {
      const left = centred(game.size * SWITCH_PITCH) + 4;
      const top = game.size === 3 ? 66 : 60;
      const cells = [];
      for (let row = 0; row < game.size; row += 1) {
        for (let column = 0; column < game.size; column += 1) {
          cells.push({
            x: left + column * SWITCH_PITCH,
            y: top + row * SWITCH_PITCH,
            width: SWITCH_PITCH,
            height: SWITCH_PITCH,
            target: { kind: 'switch', column, row },
          });
        }
      }
      return { left, top, cells };
    }
    case 'keypad': {
      const width = 3 * KEY.width + 2 * KEY.gap;
      const left = centred(width);
      const cells = Array.from({ length: 9 }, (_, index) => ({
        x: left + (index % 3) * (KEY.width + KEY.gap),
        y: KEY.top + Math.floor(index / 3) * (KEY.height + KEY.gap),
        width: KEY.width,
        height: KEY.height,
        target: { kind: 'key', key: index + 1 },
      }));
      return { left, cells };
    }
    case 'fuses': {
      const fuseLeft = centred((game.ratings.length - 1) * FUSE.pitch + FUSE.width);
      const partLeft = centred((game.tray.length - 1) * PART.pitch + PART.width);
      const cells = [
        ...game.ratings.map((_, index) => ({
          x: fuseLeft + index * FUSE.pitch - 3,
          y: FUSE.top,
          width: FUSE.width + 6,
          height: FUSE.height + 12,
          target: { kind: 'fuse', index },
        })),
        ...game.tray.map((_, index) => ({
          x: partLeft + index * PART.pitch,
          y: PART.top,
          width: PART.width,
          height: PART.height,
          target: { kind: 'part', index },
        })),
        { x: centred(RESET.width), y: RESET.top, width: RESET.width, height: RESET.height, target: { kind: 'reset' } },
      ];
      return { fuseLeft, partLeft, cells };
    }
    case 'breaker': {
      const routeYs = game.routes === 2 ? [56, 80] : [52, 70, 88];
      const cells = [
        { ...BREAKER, target: { kind: 'breaker' } },
        { ...PRIME, target: { kind: 'prime' } },
        ...routeYs.map((y, index) => ({
          x: ROUTE_LEFT + 2,
          y: y - ROUTE_REACH,
          width: ROUTE_RIGHT - ROUTE_LEFT - 4,
          height: 2 * ROUTE_REACH + 1,
          target: { kind: 'route', index },
        })),
      ];
      return { routeYs, cells };
    }
    default:
      return { cells: [] };
  }
}

/** What a press at a point on the 160x160 screen landed on, or null. */
export function targetAt(game, point) {
  return layout(game).cells.find((cell) => inside(point, cell))?.target ?? null;
}

// --- Drawing ------------------------------------------------------------------

function rule(graphics, x, y, width, height, { dotted = false } = {}) {
  const step = dotted ? 2 : 1;
  for (let along = 0; along < width; along += step) {
    graphics.drawRect(x + along, y, 1, 1);
    graphics.drawRect(x + along, y + height - 1, 1, 1);
  }
  for (let down = 0; down < height; down += step) {
    graphics.drawRect(x, y + down, 1, 1);
    graphics.drawRect(x + width - 1, y + down, 1, 1);
  }
}

/** A box, white with a black rule, or solid black when lit. */
function box(graphics, { x, y, width, height }, { lit = false, dotted = false } = {}) {
  if (lit) {
    graphics.drawRect(x, y, width, height);
    return;
  }
  rule(graphics, x, y, width, height, { dotted });
}

export function createRepairLayer({ PIXI, parent, font }) {
  const layer = new PIXI.Container();
  layer.name = 'repair';
  parent.addChild(layer);
  let signature = null;

  function label(text, x, y, { white = false, centre = false } = {}) {
    const part = new PIXI.BitmapText(text, { ...font });
    const width = Number.isFinite(part.width) ? part.width : 0;
    part.position.set(centre ? Math.round(x - width / 2) : x, y);
    part.tint = white ? 0xffffff : 0x000000;
    layer.addChild(part);
    return part;
  }

  function drawSwitches(graphics, game) {
    const { left, top, cells } = layout(game);
    // The list to throw, the next one inverted.
    const items = game.sequence.map(switchLabel);
    const itemWidth = 18;
    const start = centred(items.length * itemWidth);
    items.forEach((text, index) => {
      const x = start + index * itemWidth;
      const due = index === game.thrown;
      if (due) graphics.drawRect(x, 37, itemWidth - 2, 11);
      label(text, x + 1, 38, { white: due });
    });
    for (let index = 0; index < game.size; index += 1) {
      label('ABCD'[index], left + index * SWITCH_PITCH + 4, top - 11);
      label(String(index + 1), left - 8, top + index * SWITCH_PITCH + 2);
    }
    const thrown = game.sequence.slice(0, game.thrown);
    for (const { x, y, target } of cells) {
      const on = thrown.some(({ column, row }) => column === target.column && row === target.row);
      const switchBox = { x: x + 2, y: y + 2, width: SWITCH_SIZE, height: SWITCH_SIZE };
      box(graphics, switchBox);
      // The lever: down until it is thrown, then up.
      graphics.drawRect(switchBox.x + 4, switchBox.y + (on ? 2 : 6), 4, 4);
    }
  }

  function drawKeypad(graphics, game) {
    const lit = keypadLit(game);
    const showing = keypadShowing(game);
    // How much of the code is in: a filled square per key entered.
    const slots = game.sequence.length;
    const start = centred(slots * 8 - 2);
    for (let index = 0; index < slots; index += 1) {
      box(graphics, { x: start + index * 8, y: 40, width: 6, height: 6 }, { lit: index < game.entered });
    }
    for (const cell of layout(game).cells) {
      const on = cell.target.key === lit;
      box(graphics, cell, { lit: on, dotted: showing && !on });
      label(String(cell.target.key), cell.x + cell.width / 2, cell.y + 2, { white: on, centre: true });
    }
  }

  function drawFuse(graphics, x, y, { blown = false, empty = false }) {
    const body = { x, y, width: FUSE.width, height: FUSE.height };
    if (empty) {
      box(graphics, body, { dotted: true });
      return;
    }
    box(graphics, body);
    // End caps, then the wire between them; a blown fuse's wire is broken.
    graphics.drawRect(x, y, FUSE.width, 3);
    graphics.drawRect(x, y + FUSE.height - 3, FUSE.width, 3);
    const middle = x + Math.floor(FUSE.width / 2);
    if (blown) {
      graphics.drawRect(middle, y + 3, 1, 5);
      graphics.drawRect(middle, y + FUSE.height - 8, 1, 5);
      graphics.drawRect(middle - 2, y + 10, 1, 1);
      graphics.drawRect(middle + 2, y + 12, 1, 1);
    } else {
      graphics.drawRect(middle, y + 3, 1, FUSE.height - 6);
    }
  }

  function drawFuses(graphics, game) {
    const { fuseLeft, cells } = layout(game);
    game.ratings.forEach((rating, index) => {
      const x = fuseLeft + index * FUSE.pitch;
      const isBlown = index === game.blown;
      drawFuse(graphics, x, FUSE.top, {
        blown: isBlown && game.step === 'find',
        empty: isBlown && game.step === 'fit',
      });
      label(rating, x + FUSE.width / 2, FUSE.top + FUSE.height + 1, { centre: true });
    });
    for (const cell of cells.filter(({ target }) => target.kind === 'part')) {
      box(graphics, cell);
      label(game.tray[cell.target.index], cell.x + cell.width / 2, cell.y + 1, { centre: true });
    }
    const reset = cells.find(({ target }) => target.kind === 'reset');
    box(graphics, reset, { lit: game.step === 'done' });
    label('RESET', reset.x + reset.width / 2, reset.y + 1, { centre: true, white: game.step === 'done' });
  }

  function drawBreaker(graphics, game) {
    const { routeYs } = layout(game);
    box(graphics, BREAKER);
    // The handle: up while the breaker is on.
    graphics.drawRect(BREAKER.x + 8, BREAKER.y + (game.breakerOn ? 6 : 20), 8, 10);
    label(game.breakerOn ? 'ON' : 'OFF', BREAKER.x + BREAKER.width / 2, BREAKER.y + BREAKER.height + 2, { centre: true });
    const primed = game.step >= 3;
    box(graphics, PRIME, { lit: primed });
    label('PRIME', PRIME.x + PRIME.width / 2, PRIME.y + 1, { centre: true, white: primed });
    routeYs.forEach((y, index) => {
      const chosen = game.routed === index;
      graphics.drawRect(ROUTE_LEFT, y, ROUTE_RIGHT - ROUTE_LEFT, chosen ? 2 : 1);
      // The junction each route passes through; the burnt ones are crossed out.
      const junction = { x: 76, y: y - 3, width: 7, height: 7 };
      if (index === game.clearRoute) {
        box(graphics, junction, { lit: chosen });
      } else {
        for (let step = 0; step < 7; step += 1) {
          graphics.drawRect(junction.x + step, junction.y + step, 1, 1);
          graphics.drawRect(junction.x + 6 - step, junction.y + step, 1, 1);
        }
      }
    });
  }

  function render(game) {
    // The keypad's showing time moves every frame; only what it lights matters.
    const shown = !game ? null : JSON.stringify(game.kind === 'keypad'
      ? [{ ...game, shownFor: 0 }, keypadLit(game), keypadShowing(game)]
      : game);
    if (shown === signature) return;
    signature = shown;
    for (const child of layer.removeChildren()) child.destroy?.();
    if (!game) return;
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x000000);
    layer.addChild(graphics);
    if (game.kind === 'switches') drawSwitches(graphics, game);
    if (game.kind === 'keypad') drawKeypad(graphics, game);
    if (game.kind === 'fuses') drawFuses(graphics, game);
    if (game.kind === 'breaker') drawBreaker(graphics, game);
    graphics.endFill();
  }

  return { layer, render };
}
