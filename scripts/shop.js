function calculateShopPrice(itemPrice, multiplier) {
  return itemPrice * multiplier;
}

/**
 * Resolves a saved shop selection back into the item id the screen draws with,
 * plus whether the colony can currently afford it.
 *
 * A save stores the selection by display name (`shopBtn`), because that is what
 * the caption prints. Rebuilding the screen needs the id instead, since that is
 * what the sprites are keyed by. Returning `null` for an unknown or cleared name
 * is a real case, not a defensive one: `clearShop()` sets `shopBtn` to the empty
 * string, so a save taken with nothing selected has to restore to nothing
 * selected rather than falling back to the first item.
 *
 * Affordability is derived from the pair rather than stored, because the saved
 * price and the saved credits are both authoritative and can only disagree if
 * one of them is restored and the other is not.
 */
function resolveShopSelection({ shopBtn, shopPrice, credits } = {}, shopItems = {}) {
  const id = Object.keys(shopItems).find(key => shopItems[key].name === shopBtn) ?? null;

  return {
    id,
    unaffordable: id !== null && shopPrice > credits,
  };
}

export { calculateShopPrice, resolveShopSelection };
