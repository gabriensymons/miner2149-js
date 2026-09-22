import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_PROBES,
  MIN_PROBES,
  NO_SPACE_PORT_SALE_LIMIT,
  PROBE_COST,
  WAGE_STEP,
  addProbe,
  canLowerWage,
  canRaiseWage,
  decreaseSellAmount,
  increaseSellAmount,
  lowerWage,
  probeLaunchCost,
  raiseWage,
  removeProbe,
  resolveSaleRequest,
  saleValue,
} from '../scripts/economy-rules.js';

test('a wage press moves by one step and stops at each end', () => {
  assert.equal(raiseWage(600, 90000), 600 + WAGE_STEP);
  assert.equal(lowerWage(600), 600 - WAGE_STEP);
  assert.equal(raiseWage(90000, 90000), null, 'at the maximum, raising is a no-op');
  assert.equal(lowerWage(0), null, 'at zero, lowering is a no-op');
});

test('a no-op press returns null rather than the unchanged wage', () => {
  // So a caller cannot write the same value back through the session and
  // repaint the screen for nothing.
  assert.equal(raiseWage(90001, 90000), null);
  assert.equal(lowerWage(-50), null);
});

// This pins the CURRENT behaviour, which is not the intended behaviour. The
// lower arrow arms on `wage <= wageMax`, so it lights up at a wage of zero and
// then declines to act. Moving the condition into this module is not the place
// to change it; if it is fixed, this test is the one that should fail and be
// rewritten.
test('the wage arrows arm asymmetrically, and the lower one arms when it should not', () => {
  assert.equal(canRaiseWage(600, 90000), true);
  assert.equal(canRaiseWage(90000, 90000), false, 'raising is armed only below the maximum');

  assert.equal(canLowerWage(600, 90000), true);
  assert.equal(canLowerWage(0, 90000), true, 'preserved defect: armed at a wage of zero');
  assert.equal(canLowerWage(90001, 90000), false);
});

test('probe count is held between one and five', () => {
  assert.equal(addProbe(4), MAX_PROBES);
  assert.equal(addProbe(MAX_PROBES), null);
  assert.equal(removeProbe(2), MIN_PROBES);
  assert.equal(removeProbe(MIN_PROBES), null);
});

test('launching charges for every probe at once', () => {
  assert.equal(probeLaunchCost(5), 5 * PROBE_COST);
  assert.equal(probeLaunchCost(1), PROBE_COST);
  assert.equal(probeLaunchCost(0), 0);
});

test('the sell ladder steps by hundreds, thousands, then ten thousands', () => {
  const plenty = { diridium: 10_000_000, hasSpacePort: true };

  assert.equal(increaseSellAmount(0, plenty), 100);
  assert.equal(increaseSellAmount(900, plenty), 1000);
  assert.equal(increaseSellAmount(1001, plenty), 2001);
  assert.equal(increaseSellAmount(9000, plenty), 10000);
  assert.equal(increaseSellAmount(50000, plenty), 60000);
});

// The bands are sequential ifs rather than a chain, so a band can re-enter the
// next test after it has already moved the amount. Increasing never cascades,
// because each band clears the next band's ceiling.
test('increasing never cascades through two bands', () => {
  const plenty = { diridium: 10_000_000, hasSpacePort: true };

  assert.equal(increaseSellAmount(1000, plenty), 1100, 'exactly 1000 takes the hundreds band only');
  assert.equal(increaseSellAmount(10000, plenty), 20000, 'exactly 10000 takes the ten-thousands band only');
});

// ...but decreasing does, across a 10,001-wide range. This is the original's
// behaviour, confirmed against `Sell()` in the v3.0 source, not an artefact of
// the port: the first band takes 10000, and the remainder still satisfies the
// second band, which takes another 1000. See docs/ORIGINAL_BEHAVIOR_NOTES.md.
test('decreasing drops eleven thousand per tick between 20000 and 30000', () => {
  assert.equal(decreaseSellAmount(20000), 9000);
  assert.equal(decreaseSellAmount(25000), 14000);
  assert.equal(decreaseSellAmount(30000), 19000);
});

test('the cascade has hard edges at both ends of that range', () => {
  assert.equal(decreaseSellAmount(19999), 18999, 'below it, only the thousands band applies');
  assert.equal(decreaseSellAmount(30001), 20001, 'above it, the remainder clears the second band');

  // The discontinuity that follows is worth seeing stated: one tick from 30001
  // lands on 20001, and the very next tick drops eleven thousand.
  assert.equal(decreaseSellAmount(20001), 9001);
});

test('the sell ladder stops at zero rather than going negative', () => {
  assert.equal(decreaseSellAmount(100), 0);
  assert.equal(decreaseSellAmount(50), 0, 'a part-band amount still lands on zero, not -50');
  assert.equal(decreaseSellAmount(0), 0);
});

test('the sell ladder cannot offer more diridium than the colony holds', () => {
  assert.equal(
    increaseSellAmount(900, { diridium: 950, hasSpacePort: true }),
    950,
    'the inventory clamp beats the band step',
  );
});

test('without a space port the ladder is capped, but only above the cap', () => {
  assert.equal(
    increaseSellAmount(700, { diridium: 5000, hasSpacePort: false }),
    NO_SPACE_PORT_SALE_LIMIT,
  );

  // The inventory clamp runs first, so a colony holding less than the limit is
  // capped by what it has rather than by the rule.
  assert.equal(
    increaseSellAmount(600, { diridium: 650, hasSpacePort: false }),
    650,
  );
});

test('an empty store cannot open the sell dialog', () => {
  assert.deepEqual(
    resolveSaleRequest({ diridium: 0, soldToday: false, hasSpacePort: true }),
    { outcome: 'empty', amount: 0 },
  );
});

test('a space port sells the whole inventory, whatever was sold today', () => {
  assert.deepEqual(
    resolveSaleRequest({ diridium: 48000, soldToday: true, hasSpacePort: true }),
    { outcome: 'open', amount: 48000 },
  );
});

test('without a space port, the day allows one capped sale', () => {
  assert.deepEqual(
    resolveSaleRequest({ diridium: 48000, soldToday: false, hasSpacePort: false }),
    { outcome: 'limited', amount: NO_SPACE_PORT_SALE_LIMIT },
  );

  assert.deepEqual(
    resolveSaleRequest({ diridium: 300, soldToday: false, hasSpacePort: false }),
    { outcome: 'limited', amount: 300 },
    'a small store is offered whole rather than padded to the limit',
  );
});

test('a second sale in one day is blocked without a space port', () => {
  assert.deepEqual(
    resolveSaleRequest({ diridium: 48000, soldToday: true, hasSpacePort: false }),
    { outcome: 'blocked', amount: 0 },
  );
});

test('the space port outranks the sold-today rule, not the empty store', () => {
  // Precedence: empty first, then the space port, then today's sale.
  assert.equal(
    resolveSaleRequest({ diridium: 0, soldToday: true, hasSpacePort: true }).outcome,
    'empty',
  );
});

test('a sale is worth its quantity times the day price', () => {
  assert.equal(saleValue(700, 19), 13300);
  assert.equal(saleValue(0, 19), 0);
});
