export const DELIVERY_CHARGE = 30;
export const FREE_SHIPPING_THRESHOLD = 500;
export const SHIPPING_METHODS = [
  { id: "standard", label: "Giao tiêu chuẩn", description: "Dự kiến 3–5 ngày", fee: 30, freeFrom: FREE_SHIPPING_THRESHOLD },
  { id: "express", label: "Giao nhanh", description: "Dự kiến 1–2 ngày", fee: 50, freeFrom: null },
];

export const getShippingCharge = (subtotal, shippingMethod = "standard") => {
  const method = SHIPPING_METHODS.find((item) => item.id === shippingMethod);
  if (!method) {
    const error = new Error("Phương thức giao hàng không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }
  const normalizedSubtotal = Number(subtotal);

  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal <= 0) {
    return 0;
  }

  return method.freeFrom != null && normalizedSubtotal >= method.freeFrom
    ? 0
    : method.fee;
};

export const getOrderTotal = (subtotal) => {
  return subtotal + getShippingCharge(subtotal);
};
