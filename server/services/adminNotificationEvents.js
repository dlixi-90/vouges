import Notification from "../models/AdminNotification.js";

const statuses = {
  "Awaiting Payment": "Chờ thanh toán", "Payment Expired": "Hết hạn thanh toán",
  "Payment Cancelled": "Đã hủy thanh toán", "Payment Review": "Chờ xác minh thanh toán",
  "Order Placed": "Đã đặt hàng", Packing: "Đang đóng gói", Shipping: "Đang giao hàng", Delivery: "Đã giao hàng",
};

export const orderActivity = (order, created = false) => {
  if (!order?._id || !statuses[order.status]) return null;
  const id = String(order._id);
  return {
    _id: `order:${id}:${created ? "created" : order.status}`,
    type: created ? "order_created" : "order_status",
    title: created ? order.status === "Awaiting Payment" ? "Đơn hàng mới chờ thanh toán" : "Khách hàng đặt hàng thành công" : "Cập nhật trạng thái đơn hàng",
    body: `Đơn #${id.slice(-8).toUpperCase()} · ${statuses[order.status]}${order.items?.[0]?.title ? ` · ${order.items[0].title}` : ""}`,
    href: `/order-overview/${id}`,
  };
};
export const reviewActivity = review => {
  if (!review?._id || !review.productId) return null;
  const revision = new Date(review.updatedAt || review.createdAt).getTime();
  if (!Number.isFinite(revision)) return null;
  return {
    _id: `review:${review._id}:${revision}`, type: "review", title: `Đánh giá sản phẩm ${review.rating} sao`,
    body: `${review.authorName || "Khách hàng"}: ${review.comment || ""}`.slice(0, 220),
    href: `/collection/${review.productId}#reviews`,
  };
};

export const recordActivity = async (event, session) => {
  if (!event) return;
  // A retry keeps the original notification and its read state. Transactional
  // model writes record the activity in that same transaction, before commit.
  await Notification.updateOne({ _id: event._id }, { $setOnInsert: event }, { upsert: true, ...(session ? { session } : {}) });
};

export function attachOrderNotifications(schema) {
  schema.pre("save", function () {
    this.$locals.notificationCreated = this.isNew;
    this.$locals.notificationStatusChanged = this.isModified("status");
  });
  schema.post("save", async function (doc) {
    if (this.$locals.notificationCreated || this.$locals.notificationStatusChanged) {
      await recordActivity(orderActivity(doc, this.$locals.notificationCreated), doc.$session());
    }
  });
  schema.post("findOneAndUpdate", async function (doc) {
    const status = this.getUpdate()?.$set?.status;
    if (doc && status) await recordActivity(orderActivity({ _id: doc._id, items: doc.items, status }), this.getOptions().session);
  });
}

export function attachReviewNotifications(schema) {
  schema.post("save", async function (doc) { await recordActivity(reviewActivity(doc), doc.$session()); });
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc && (this.getUpdate()?.$set?.rating !== undefined || this.getUpdate()?.$set?.comment !== undefined)) {
      await recordActivity(reviewActivity(doc), this.getOptions().session);
    }
  });
}
