export const FREE_SHIPPING_THRESHOLD = 1000;
export const SHIPPING_METHODS = [
  { id: "standard", label: "Giao tiêu chuẩn", description: "Dự kiến 3–5 ngày", fee: 30, freeFrom: FREE_SHIPPING_THRESHOLD },
  { id: "express", label: "Giao nhanh", description: "Dự kiến 1–2 ngày", fee: 50, freeFrom: null },
  { id: "urgent", label: "Hỏa tốc", description: "Dự kiến 1–2 tiếng", fee: null, freeFrom: null },
];
export const URGENT_SHIPPING_NOTE = "Phí giao Hỏa tốc theo giá của đơn vị giao hàng bên thứ ba, thanh toán sau. Tổng thanh toán chưa gồm phí này.";

export const getShippingCharge = (subtotal, deliveryCharge) => {
  const normalizedSubtotal = Number(subtotal);

  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal < 0) {
    return 0;
  }

  return normalizedSubtotal >= FREE_SHIPPING_THRESHOLD
    ? 0
    : deliveryCharge;
};
