// Orders enter sales reporting once placed; QR payment attempts and payments
// awaiting manual review are not confirmed orders.
export const placedOrderFilter = () => ({
  status: { $in: ["Order Placed", "Packing", "Shipping", "Delivery"] },
  $or: [{ paymentMethod: "COD" }, { paymentMethod: "QR", isPaid: true }],
});
