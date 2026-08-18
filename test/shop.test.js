import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateShopPrice } from '../scripts/shop.js';

test('calculateShopPrice returns a number suitable for validated game state', () => {
  const price = calculateShopPrice(100, 65);

  assert.equal(price, 6500);
  assert.equal(typeof price, 'number');
});
