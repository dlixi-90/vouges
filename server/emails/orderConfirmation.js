import { fileURLToPath } from "node:url";
import { renderOrderConfirmation } from "./orderConfirmationLayout.js";
import { getSizeImage } from "../utils/productImages.js";
const httpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
};

// All prices are integer VND. Use the purchase snapshots,
// including the saved total, so later catalog/shipping changes do not alter receipts.
const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value)));

export const buildOrderConfirmationEmail = (
  order,
  {
    storefrontUrl = process.env.FRONTEND_URL ||
      "https://velours-jet.vercel.app",
  } = {},
) => {
  const storeUrl = httpsUrl(storefrontUrl) || "https://velours-jet.vercel.app/";
  const ordersUrl = new URL("/my-orders", storeUrl).href;
  const address = order.address || {};
  const recipient = [address.firstName, address.lastName]
    .filter(Boolean)
    .join(" ");
  const addressLines = [
    address.street,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.zipcode, address.country].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const orderId = String(order._id);
  const overviewUrl = new URL(`/order-overview/${encodeURIComponent(orderId)}`, storeUrl).href;
  const contactUrl = new URL("/contact", storeUrl).href;
  const isQrPending = order.paymentMethod === "QR" && !order.isPaid;
  const isPaymentReview = order.status === "Payment Review";
  const expiresAt = new Date(order.paymentExpiresAt);
  const expiration = Number.isNaN(expiresAt.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
  }).format(expiresAt);
  const heading = isPaymentReview ? "Đã nhận tiền, đang xác minh đơn hàng"
    : isQrPending ? "Đơn hàng đang chờ thanh toán"
      : order.isPaid ? "Thanh toán đã được xác nhận" : "Đặt hàng thành công";
  const introduction = isPaymentReview
    ? "Velours đã nhận được khoản chuyển khoản của bạn. Phiên giữ hàng đã hết hạn nên chúng tôi cần kiểm tra lại khả năng giao hàng. Bạn chưa cần chuyển thêm tiền; vui lòng liên hệ Velours để được hỗ trợ."
    : isQrPending
      ? "Velours đã ghi nhận lựa chọn nước hoa của bạn và đang giữ hàng trong phiên thanh toán. Đơn hàng sẽ được xác nhận sau khi hệ thống nhận được chuyển khoản hợp lệ."
      : order.isPaid
        ? "Velours đã ghi nhận thanh toán và xác nhận đơn hàng nước hoa của bạn. Bạn có thể xem chi tiết và theo dõi quá trình xử lý trên website."
        : "Cảm ơn bạn đã lựa chọn nước hoa tại Velours. Đơn hàng của bạn đã được ghi nhận. Dưới đây là thông tin sản phẩm, thanh toán và địa chỉ giao hàng để bạn kiểm tra lại.";
  const createdAt = new Date(order.createdAt);
  const date = Number.isNaN(createdAt.getTime())
    ? ""
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "long",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(createdAt);
  const items = (order.items || []).map((item) => ({
    title: item.title || item.product?.title || "Sản phẩm Velours",
    image: httpsUrl(item.image || getSizeImage(item.product, item.size)),
    size: item.size,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice ?? item.product?.price?.[item.size] ?? 0),
  }));
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const total = Number(order.amount);
  const discount = Number(order.discount || 0);
  const shipping = Number(order.shipping ?? Math.max(0, total - subtotal + discount));
  const isUrgentShipping = order.shippingMethod === "urgent";
  const shippingLabel = isUrgentShipping
    ? "Theo giá đơn vị vận chuyển bên thứ ba, thanh toán sau"
    : shipping === 0 ? "Miễn phí" : money(shipping);
  const urgentShippingNote = "Tổng thanh toán chưa gồm phí giao Hỏa tốc. Phí này theo giá của đơn vị giao hàng bên thứ ba và thanh toán sau.";
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const paymentMethod =
    order.paymentMethod === "COD"
      ? "Thanh toán khi nhận hàng (COD)"
      : "Chuyển khoản QR";
  const paymentStatus = isPaymentReview ? "Đã nhận tiền · Đang xác minh đơn hàng"
    : order.isPaid ? "Đã thanh toán" : isQrPending ? "Chờ thanh toán" : "Chưa thanh toán";
  const totalLabel = order.isPaid ? "Tổng đã thanh toán" : "Tổng thanh toán";
  const paymentNote = isPaymentReview
    ? `Khoản chuyển khoản đã được ghi nhận. Velours đang kiểm tra lại đơn hàng trước khi xác nhận giao hàng. Không chuyển khoản lại.${isUrgentShipping ? ` ${urgentShippingNote}` : ""}`
    : order.isPaid
    ? isUrgentShipping
      ? `Velours đã ghi nhận thanh toán tiền hàng của bạn. ${urgentShippingNote}`
      : "Velours đã ghi nhận thanh toán của bạn. Bạn không cần thanh toán lại khi nhận hàng."
    : order.paymentMethod === "COD"
      ? `Vui lòng thanh toán ${money(total)} cho đơn vị vận chuyển khi nhận hàng.${isUrgentShipping ? ` ${urgentShippingNote}` : ""}`
      : `Vui lòng quay lại website, mở chi tiết đơn hàng và chọn “Tiếp tục thanh toán” để chuyển khoản đúng số tiền ${money(total)} theo mã QR.${order.paymentCode ? ` Nội dung chuyển khoản: ${order.paymentCode}.` : ""}${expiration ? ` Phiên thanh toán có hiệu lực đến ${expiration} (giờ Việt Nam).` : ""} Nếu phiên đã hết hạn hoặc đã hủy, vui lòng không chuyển tiền theo mã cũ. Velours sẽ gửi email khi hệ thống ghi nhận thanh toán.${isUrgentShipping ? ` ${urgentShippingNote}` : ""}`;
  const subjectLabel = isPaymentReview ? "Đã nhận chuyển khoản · Cần xác minh đơn"
    : isQrPending ? "Đơn hàng chờ thanh toán QR" : order.isPaid ? "Xác nhận thanh toán" : "Xác nhận đơn hàng";
  const subject = `Velours · ${subjectLabel} #${orderId.slice(-8).toUpperCase()}`;

  const html = renderOrderConfirmation({
    subject, storeUrl, overviewUrl, contactUrl, heading, introduction, recipient,
    orderId, date, items, quantity, subtotal, discount, voucherCode: order.voucherCode,
    shippingLabel, shippingMethod: order.shippingMethod, total, totalLabel,
    paymentMethod, paymentStatus, paymentNote, isQrPending, addressLines, phone: address.phone,
  }, money);

  const text = [
    `VELOURS — ${heading.toLocaleUpperCase("vi-VN")}`,
    `Xin chào ${recipient || "bạn"}, cảm ơn bạn đã chọn Velours.`,
    introduction,
    `Mã đơn hàng: ${orderId}`,
    ...(date ? [`Ngày đặt hàng: ${date}`] : []),
    "",
    "SẢN PHẨM",
    ...items.map(
      (item) =>
        `${item.title} | ${item.size} | ${money(item.unitPrice)} × ${item.quantity} = ${money(item.unitPrice * item.quantity)}`,
    ),
    "",
    `Tạm tính: ${money(subtotal)}`,
    ...(discount > 0 ? [`Mã giảm giá ${order.voucherCode}: -${money(discount)}`] : []),
    `Phí vận chuyển: ${shippingLabel}`,
    `${totalLabel}: ${money(total)}`,
    `${paymentMethod} — ${paymentStatus}`,
    paymentNote,
    "",
    "ĐỊA CHỈ NHẬN HÀNG",
    recipient,
    ...addressLines,
    ...(address.phone ? [`Điện thoại: ${address.phone}`] : []),
    "",
    `Xem chi tiết đơn hàng${isQrPending ? " và tiếp tục thanh toán" : ""}: ${overviewUrl}`,
    `Xem đơn hàng của tôi: ${ordersUrl}`,
    "Đăng nhập bằng tài khoản đã dùng để đặt hàng.",
    `Cần hỗ trợ? Liên hệ Velours và cung cấp mã đơn hàng: ${contactUrl}`,
    "Velours · Một hương thơm, một dấu ấn riêng.",
  ].join("\n");

  return { subject, html, text, attachments: [{
    filename: "velours-mark.png",
    path: fileURLToPath(new URL("./assets/velours-mark.png", import.meta.url)),
    cid: "velours-mark@velours",
    contentType: "image/png",
    contentDisposition: "inline",
  }] };
};
