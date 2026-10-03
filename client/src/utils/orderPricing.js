export const FREE_SHIPPING_THRESHOLD = 500;

export const getShippingCharge = (subtotal, deliveryCharge) => {
  const normalizedSubtotal = Number(subtotal);

  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal <= 0) {
    return 0;
  }

  return normalizedSubtotal >= FREE_SHIPPING_THRESHOLD
    ? 0
    : deliveryCharge;
};
