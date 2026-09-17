import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateShopPrice, resolveShopSelection } from '../scripts/shop.js';
import { shopItems } from '../scripts/gamedata.js';

test('calculateShopPrice returns a number suitable for validated game state', () => {
  const price = calculateShopPrice(100, 65);

  assert.equal(price, 6500);
  assert.equal(typeof price, 'number');
});

// Regression coverage for the load-path defect where the shop caption was
// restored from the save but the selection sprites were not, so a colony saved
// with Hydroponics selected reopened showing "Hydroponics" with the bulldozer
// drawn as the selected item.
test('resolveShopSelection maps a saved display name back to its item id', () => {
  const selection = resolveShopSelection(
    { shopBtn: 'Hydroponics', shopPrice: 1000, credits: 1000000 },
    shopItems,
  );

  assert.equal(selection.id, 'hydroponics');
  assert.equal(selection.unaffordable, false);
});

test('resolveShopSelection resolves every item the shop can sell', () => {
  for (const [id, item] of Object.entries(shopItems)) {
    const selection = resolveShopSelection(
      { shopBtn: item.name, shopPrice: 0, credits: 0 },
      shopItems,
    );

    assert.equal(selection.id, id, `${item.name} should resolve to ${id}`);
  }
});

test('resolveShopSelection restores an empty selection as no selection', () => {
  // clearShop() writes '' rather than deleting the field, so this is the state
  // a save takes when the player has deselected everything.
  const selection = resolveShopSelection(
    { shopBtn: '', shopPrice: 0, credits: 1000 },
    shopItems,
  );

  assert.equal(selection.id, null);
  assert.equal(selection.unaffordable, false);
});

test('resolveShopSelection reports an unknown item as no selection', () => {
  const selection = resolveShopSelection(
    { shopBtn: 'Orbital Casino', shopPrice: 10, credits: 0 },
    shopItems,
  );

  assert.equal(selection.id, null);
  assert.equal(selection.unaffordable, false);
});

test('resolveShopSelection marks a selection the colony cannot afford', () => {
  const selection = resolveShopSelection(
    { shopBtn: 'Diridium Mine', shopPrice: 45500, credits: 1000 },
    shopItems,
  );

  assert.equal(selection.id, 'diridiumMine');
  assert.equal(selection.unaffordable, true);
});

test('resolveShopSelection treats an exactly affordable selection as affordable', () => {
  // The screen marks the caption only when the price is strictly greater than
  // the credits, matching shop(); spending everything is still a legal build.
  const selection = resolveShopSelection(
    { shopBtn: 'Bulldozer', shopPrice: 6500, credits: 6500 },
    shopItems,
  );

  assert.equal(selection.id, 'bulldozer');
  assert.equal(selection.unaffordable, false);
});
