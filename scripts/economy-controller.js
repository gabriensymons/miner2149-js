/**
 * The colony's money: the wage arrows, the shop, and selling diridium.
 *
 * The rules are elsewhere -- `economy-rules.js` decides what a wage or a sale
 * amount may become and what a sale request is allowed to do, `shop.js` what an
 * item costs -- and this is what the player's taps do with them. Everything it
 * changes goes through the session; what is on screen is redrawn from that by
 * the renderer, so nothing here touches a label the colony already describes.
 *
 * The one thing on screen that is not in the colony is the sale being set up:
 * the quantity in the Sell Diridium dialog, and the arrow being held. Those are
 * this controller's own state, and it writes the quantity's label itself.
 *
 * A sale is two moments, and the gap between them is deliberate. The diridium
 * leaves when Sell is pressed; the credits land when the receipt is dismissed,
 * which is what makes the message read as a receipt rather than a notification.
 *
 * Everything that belongs to another part of the game arrives by injection:
 * the dialogs, which screens are shown, counting a building (the map's), and
 * awarding a frame (the turn's). So do the timers behind press-and-hold and the
 * storage lifetime earnings are recorded in, which keeps this testable in Node.
 */

import {
  canLowerWage,
  canRaiseWage,
  decreaseSellAmount,
  increaseSellAmount,
  lowerWage,
  raiseWage,
  resolveSaleRequest,
  saleValue,
} from './economy-rules.js';
import { calculateShopPrice } from './shop.js';
import { recordDiridiumSale } from './unlock-progress.js';

// Holding an arrow in the Sell Diridium dialog repeats every tenth of a second
// until it is let go.
export const SELL_REPEAT_MS = 100;

export function createEconomyController({
  session, view, shopItems, dialogs, screens, countBuildingsByName, grantSkinForTrigger, storage, timers,
}) {
  const { dialog: sellDiridiumDialog, amount: sellAmountText } = view.sell;
  const mineScreen = view.mine.screen;
  const optionsMenu = view.options.menu;

  let sellAmount;
  let pointerDownID = -1;

  // The wage arrows. Each arms -- shows as pressed -- only when releasing it
  // would change the wage. Both wage labels are derived from state: the
  // renderer's render() sets the control row's, its updateReports() the
  // Operations report's.
  function armWageUp() {
    const { wage, wageMax } = session.getState();
    if (canRaiseWage(wage, wageMax)) return true;
  }

  function wageUp() {
    const { wage: current, wageMax } = session.getState();
    const wage = raiseWage(current, wageMax);
    if (wage !== null) session.update({ wage });
  }

  function armWageDown() {
    if (canLowerWage(session.getState().wage)) return true;
  }

  function wageDown() {
    const wage = lowerWage(session.getState().wage);
    if (wage !== null) session.update({ wage });
  }

  // Selecting an item is only a state change. Which sprite is lit, what the
  // caption reads, its tint and the affordability marker are all derived by the
  // renderer (mine-renderer.js).
  function shop(id) {
    // Clicking the item already selected does nothing. Unselecting by re-clicking
    // was deliberately disabled and is kept that way.
    if (shopItems[id].name === session.getState().shopBtn) return;

    session.update({ shopBtn: shopItems[id].name, shopPrice: getPrice(id) });
  }

  function getPrice(id) {
    return calculateShopPrice(shopItems[id].price, session.getState().multiplier);
  }

  // Tapping the storage icon asks for a sale. The renderer draws the icon and
  // calls this when it is released.
  function requestSale() {
    const { diridium, soldToday } = session.getState();
    const { outcome, amount } = resolveSaleRequest({
      diridium,
      soldToday,
      hasSpacePort: countBuildingsByName('Space Port') > 0,
    });

    if (outcome === 'empty') {
      dialogs.notice('You currently have no diridium to sell.');
      return;
    }

    if (outcome === 'blocked') {
      dialogs.notice('Prior sale still being transfered. Build a space port or wait until tomorrow to sell more diridium.');
      return;
    }

    // The quantity is set before the dialog is shown in both remaining cases.
    // In the capped one that means setting it behind the explanatory message,
    // which is dismissed before the dialog appears.
    sellAmountText.text = sellAmount = amount;

    if (outcome === 'limited') {
      dialogs.message(optionsMenu, 'A space port allows the sale and transfer of diridium to ships. Without a space port, only one sale up to 700 tons can be sold per day.', () => screens.show(sellDiridiumDialog, mineScreen));
      return;
    }

    screens.show(sellDiridiumDialog, mineScreen);
  }

  function startRaisingSale() {
    if (pointerDownID === -1) pointerDownID = timers.setInterval(raiseSaleOnce, SELL_REPEAT_MS);
    return true;
  }

  function startLoweringSale() {
    if (pointerDownID === -1) pointerDownID = timers.setInterval(lowerSaleOnce, SELL_REPEAT_MS);
    return true;
  }

  function stopSaleRepeat() {
    if (pointerDownID !== -1) {
      timers.clearInterval(pointerDownID);
      pointerDownID = -1;
    }
  }

  function raiseSaleOnce() {
    sellAmountText.text = sellAmount = increaseSellAmount(sellAmount, {
      diridium: session.getState().diridium,
      hasSpacePort: countBuildingsByName('Space Port') > 0,
    });
  }

  function lowerSaleOnce() {
    sellAmountText.text = sellAmount = decreaseSellAmount(sellAmount);
  }

  function sellDiridium() {
    const sale = saleValue(sellAmount, session.getState().sellPrice);
    screens.hide(sellDiridiumDialog, mineScreen);
    session.update({ diridium: session.getState().diridium - sellAmount, soldToday: true });
    dialogs.message(mineScreen, `Sold! for ${sale} credits.`, () => {
      // The payment lands on dismissal, not on the sale, which is what makes the
      // message read as a receipt rather than a notification.
      session.update({ credits: session.getState().credits + sale });
      // Lifetime earnings, not the credit balance: the game starts the player
      // with a large balance, so a balance threshold would fire on day one.
      if (!session.getState().devSandbox) {
        const { unlocked } = recordDiridiumSale(storage, sale);
        if (unlocked.length > 0) grantSkinForTrigger('lifetime-earnings');
      }
    });
  }

  function cancelSale() {
    screens.hide(sellDiridiumDialog, mineScreen);
  }

  return {
    armWageUp,
    wageUp,
    armWageDown,
    wageDown,
    shop,
    requestSale,
    startRaisingSale,
    startLoweringSale,
    stopSaleRepeat,
    sellDiridium,
    cancelSale,
  };
}
