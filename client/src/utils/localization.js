const orderStatusLabels = {
  "Awaiting Payment": "Chờ thanh toán",
  "Payment Expired": "Hết hạn thanh toán",
  "Payment Cancelled": "Đã hủy thanh toán",
  "Payment Review": "Chờ xác minh thanh toán",
  "Order Placed": "Đã đặt hàng",
  Packing: "Đang đóng gói",
  Shipping: "Đang giao hàng",
  Delivery: "Đã giao hàng",
  "Out for delivery": "Đang giao hàng",
  Delivered: "Đã giao hàng",
};

export const getOrderStatusLabel = (status) =>
  Object.hasOwn(orderStatusLabels, status) ? orderStatusLabels[status] : "Chưa xác định";

const paymentMethodLabels = {
  COD: "Thanh toán khi nhận hàng",
  QR: "Chuyển khoản ngân hàng (QR)",
  Online: "Thanh toán trực tuyến",
};

export const getPaymentMethodLabel = (method) =>
  Object.hasOwn(paymentMethodLabels, method) ? paymentMethodLabels[method] : "Chưa xác định";
