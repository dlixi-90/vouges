export const DELIVERY_CHARGE = 30;
export const FREE_SHIPPING_THRESHOLD = 1000;
export const SHIPPING_METHODS = [
  { id: "standard", label: "Giao tiêu chuẩn", description: "Dự kiến 3–5 ngày", fee: 30, freeFrom: FREE_SHIPPING_THRESHOLD },
  { id: "express", label: "Giao nhanh", description: "Dự kiến 1–2 ngày", fee: 50, freeFrom: null },
  { id: "urgent", label: "Hỏa tốc", description: "Dự kiến 1–2 tiếng", fee: null, freeFrom: null },
];

// A null fee is quoted by the third-party carrier and paid separately later.
export const getShippingCharge = (subtotal, shippingMethod = "standard") => {
  const method = SHIPPING_METHODS.find((item) => item.id === shippingMethod);
  if (!method) {
    const error = new Error("Phương thức giao hàng không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }
  const normalizedSubtotal = Number(subtotal);

  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal < 0) {
    return 0;
  }

  return method.freeFrom != null && normalizedSubtotal >= method.freeFrom
    ? 0
    : method.fee ?? 0;
};

export const getOrderTotal = (subtotal) => {
  return subtotal + getShippingCharge(subtotal);
};

export const getShippingPricing = (subtotal, discount, shippingMethod) => {
  const shipping = getShippingCharge(subtotal, shippingMethod);
  const discountedSubtotal = Math.round((subtotal - discount) * 1000) / 1000;
  return { shippingMethod, shipping, amount: Math.round((discountedSubtotal + shipping) * 1000) / 1000 };
};
