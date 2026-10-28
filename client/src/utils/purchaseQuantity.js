import { getPurchaseLimit, isSizeAvailable } from "./productStock.js";

export const MAX_CART_ADD_QUANTITY = 100;

export function getRemainingPurchaseQuantity(product, size, cartQuantity = 0) {
  if (!isSizeAvailable(product, size)) return 0;
  const saved = Number(cartQuantity);
  const inCart = Number.isSafeInteger(saved) && saved > 0 ? saved : 0;
  return Math.min(MAX_CART_ADD_QUANTITY, Math.max(0, getPurchaseLimit(product, size) - inCart));
}
