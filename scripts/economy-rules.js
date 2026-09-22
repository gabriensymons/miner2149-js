/**
 * Pure economy rules: wages, the diridium sale gate, and the sell-dialog
 * quantity ladder.
 *
 * DOM-free and Pixi-free. Every function takes plain values and returns either a
 * value or an outcome object; `app.js` decides what to draw and commits state
 * through the session.
 *
 * Shop pricing and selection live in `shop.js`, which already had them.
 */

/** One press of a wage arrow. */
export const WAGE_STEP = 50;

/** What one probe costs to launch. `launchProbes()` charges for all of them at once. */
export const PROBE_COST = 17000;

/** Probes are chosen on the launch screen, before an asteroid exists. */
export const MIN_PROBES = 1;
export const MAX_PROBES = 5;

/**
 * Without a space port, a colony may make one sale per day of at most this many
 * tons. The rule is stated in the game's own message text.
 */
export const NO_SPACE_PORT_SALE_LIMIT = 700;

/**
 * Whether a wage arrow is armed — that is, whether pressing it does anything.
 *
 * "Armed" is `buildSpriteButton`'s two-stage model: the pointer-down callback's
 * return value decides both whether the control swaps to its pressed sprite and
 * whether the release runs the action at all. So each arrow needs its gate here
 * to agree with the bound it actually enforces — `raiseWage` and `lowerWage`.
 *
 * The original has **no arming condition at all**, and no press state to hold
 * one: `Pentime()` polls the pen, and a hit inside the arrow's rectangle flashes
 * and acts in a single step, clamping afterwards. This affordance is therefore
 * the port's own, with no original to be faithful to, which is why the bound
 * below is chosen to match `lowerWage` rather than inherited.
 *
 * Fixed 2026-09-21: the lower arrow previously armed on `wage <= wageMax`,
 * which is almost always true, so it showed its pressed sprite at a wage of 0
 * and then declined to act. See `docs/ORIGINAL_BEHAVIOR_NOTES.md`.
 */
export function canRaiseWage(wage, wageMax) {
  return wage < wageMax;
}

export function canLowerWage(wage) {
  return wage > 0;
}

/**
 * The wage after a press, or `null` when the press must do nothing.
 *
 * `null` rather than the unchanged wage, so a caller cannot write a no-op
 * through the session and repaint the screen for nothing.
 *
 * The original clamps at the ends where this rejects. The two agree for every
 * reachable wage: the colony starts at 400 and moves in steps of 50, so the
 * 90,000 maximum is an exact stop on that walk rather than something a press
 * can overshoot.
 */
export function raiseWage(wage, wageMax) {
  if (wage >= wageMax) return null;
  return wage + WAGE_STEP;
}

export function lowerWage(wage) {
  if (wage <= 0) return null;
  return wage - WAGE_STEP;
}

/** Probe count after a press on the launch screen, or `null` for a no-op. */
export function addProbe(probes) {
  if (probes > MAX_PROBES - 1) return null;
  return probes + 1;
}

export function removeProbe(probes) {
  if (probes < MIN_PROBES + 1) return null;
  return probes - 1;
}

/** What launching costs. Charged once, for every probe. */
export function probeLaunchCost(probes) {
  return probes * PROBE_COST;
}

/**
 * The sell quantity after one tick of the held up arrow.
 *
 * The three size bands are applied as **sequential ifs, not a chain**.
 * Confirmed against `Sell()` in the v3.0 source, which writes them exactly this
 * way, so the shape is parity rather than an accident of the port. The
 * difference is observable: a band can re-enter the next test after it has
 * already moved the amount. Increasing never cascades, because each band raises
 * the amount past the next band's ceiling. Decreasing does — see
 * `decreaseSellAmount`. Both are pinned by tests, and written up in
 * `docs/ORIGINAL_BEHAVIOR_NOTES.md`.
 *
 * The two clamps at the end are ordered: the inventory clamp first, then the
 * no-space-port limit, so a colony holding fewer than 700 tons is capped by what
 * it has rather than by the rule.
 */
export function increaseSellAmount(amount, { diridium, hasSpacePort }) {
  let next = amount;

  if (next >= 10000) next += 10000;
  if (next <= 10000 && next > 1000) next += 1000;
  if (next <= 1000) next += 100;

  if (next > diridium) next = diridium;
  if (!hasSpacePort && diridium > NO_SPACE_PORT_SALE_LIMIT && next > NO_SPACE_PORT_SALE_LIMIT) {
    next = NO_SPACE_PORT_SALE_LIMIT;
  }

  return next;
}

/**
 * The sell quantity after one tick of the held down arrow.
 *
 * **This one cascades, and the cascade is the original's.** Between 20,000 and
 * 30,000 inclusive the first band subtracts 10,000 and the result still
 * satisfies the second band, which takes another 1,000 — so a tick anywhere in
 * that range drops 11,000 rather than 10,000. Above 30,000 it does not, because
 * the remainder clears the second band's ceiling, which makes 30,001 step to
 * 20,001 and the next press drop to 9,001. Confirmed against `Sell()` in the
 * v3.0 source. Rewriting these as `else if` would quietly restore a uniform
 * step across a 10,001-wide range, which is the kind of "fix" this project's
 * parity rules exist to prevent.
 */
export function decreaseSellAmount(amount) {
  let next = amount;

  if (next >= 20000) next -= 10000;
  if (next <= 20000 && next > 1000) next -= 1000;
  if (next <= 1000) next -= 100;

  if (next < 0) next = 0;

  return next;
}

/**
 * Whether the storage icon opens the sell dialog, and with what starting amount.
 *
 * Returns one of four outcomes:
 *
 * - `empty`   — nothing to sell.
 * - `blocked` — no space port and today's one sale is already in transit.
 * - `limited` — no space port, sale allowed, capped at 700 tons. Carries the
 *               explanatory message the original shows before the dialog.
 * - `open`    — a space port exists; the whole inventory is offered.
 *
 * `amount` is the quantity the dialog opens on, which is the largest legal sale
 * rather than zero: the original starts the player at the maximum and expects
 * them to arrow down.
 */
export function resolveSaleRequest({ diridium, soldToday, hasSpacePort }) {
  if (diridium <= 0) return { outcome: 'empty', amount: 0 };

  if (hasSpacePort) return { outcome: 'open', amount: diridium };

  if (soldToday) return { outcome: 'blocked', amount: 0 };

  return {
    outcome: 'limited',
    amount: diridium > NO_SPACE_PORT_SALE_LIMIT ? NO_SPACE_PORT_SALE_LIMIT : diridium,
  };
}

/** What a sale is worth. Credits land when the receipt is dismissed, not here. */
export function saleValue(amount, sellPrice) {
  return amount * sellPrice;
}
