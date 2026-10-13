import assert from 'node:assert/strict';
import test from 'node:test';

import { GAME_KINDS, createBreakerGame } from '../scripts/breaker-games.js';
import { createRepairLayer, layout, targetAt } from '../scripts/breaker-games-view.js';
import { createFakePIXI } from './fake-pixi.js';

/** Every repair at every class, laid out by a run of draws. */
function everyRepair() {
  const repairs = [];
  for (const kind of GAME_KINDS) {
    for (let difficulty = 1; difficulty <= 5; difficulty += 1) {
      let first = true;
      const random = (max) => {
        if (first) { first = false; return GAME_KINDS.indexOf(kind); }
        return max - 1;
      };
      repairs.push(createBreakerGame({ difficulty, random }));
    }
  }
  return repairs;
}

test('every control of every repair, at every class, sits between the caption and the skyline', () => {
  for (const game of everyRepair()) {
    for (const cell of layout(game).cells) {
      const name = `${game.kind} ${JSON.stringify(cell.target)}`;
      assert.ok(cell.x >= 5 && cell.x + cell.width <= 155, `${name} is inside the frame`);
      assert.ok(cell.y >= 36 && cell.y + cell.height <= 128, `${name} is under the caption and over the skyline`);
    }
  }
});

test('no two controls of a repair overlap, so a press can only mean one thing', () => {
  for (const game of everyRepair()) {
    const cells = layout(game).cells;
    for (const [index, a] of cells.entries()) {
      for (const b of cells.slice(index + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        assert.ok(apart, `${game.kind}: ${JSON.stringify(a.target)} and ${JSON.stringify(b.target)}`);
      }
    }
  }
});

test('a press lands on the control under it, and on nothing between them', () => {
  const game = createBreakerGame({ difficulty: 3, random: (max) => (max === 4 ? 1 : 0) });
  assert.equal(game.kind, 'keypad');
  const five = layout(game).cells[4];
  assert.deepEqual(targetAt(game, { x: five.x + 3, y: five.y + 3 }), { kind: 'key', key: 5 });
  assert.equal(targetAt(game, { x: five.x - 1, y: five.y + 3 }), null, 'the gap between keys');
  assert.equal(targetAt(game, { x: 80, y: 140 }), null);
});

test('the layer redraws only when what it shows changes, and clears when the repair closes', () => {
  const { PIXI } = createFakePIXI();
  const parent = new PIXI.Container();
  const repair = createRepairLayer({ PIXI, parent, font: { fontName: 'Palm OS' } });
  const game = createBreakerGame({ difficulty: 3, random: (max) => (max === 4 ? 1 : 0) });

  repair.render(game);
  const drawn = repair.layer.children[0];
  repair.render({ ...game, shownFor: 10 });
  assert.equal(repair.layer.children[0], drawn, 'the same key still lit: nothing redrawn');
  repair.render({ ...game, shownFor: 500 });
  assert.notEqual(repair.layer.children[0], drawn, 'the gap between keys is redrawn');
  repair.render(null);
  assert.equal(repair.layer.children.length, 0);
});
