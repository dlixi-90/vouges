const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const httpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

// Order prices are stored in thousands of VND. Use the purchase snapshots,
// including the saved total, so later catalog/shipping changes do not alter receipts.
const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) * 1000));

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
  const createdAt = new Date(order.createdAt);
  const date = Number.isNaN(createdAt.getTime())
    ? ""
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "long",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(createdAt);
  const items = (order.items || []).map((item) => ({
    title: item.title || item.product?.title || "Sản phẩm Velours",
    image: httpsUrl(item.image || item.product?.images?.[0]),
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
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const paymentMethod =
    order.paymentMethod === "COD"
      ? "Thanh toán khi nhận hàng (COD)"
      : "Chuyển khoản QR";
  const paymentStatus = order.isPaid ? "Đã thanh toán" : "Chưa thanh toán";
  const totalLabel = order.isPaid ? "Tổng đã thanh toán" : "Tổng thanh toán";
  const paymentNote = order.isPaid
    ? "Velours đã ghi nhận thanh toán của bạn. Bạn không cần thanh toán lại khi nhận hàng."
    : order.paymentMethod === "COD"
      ? `Vui lòng thanh toán ${money(total)} cho đơn vị vận chuyển khi nhận hàng.`
      : "Bạn có thể kiểm tra trạng thái thanh toán trong mục Đơn hàng của tôi.";
  const subject = `Velours · Xác nhận đơn hàng #${orderId.slice(-8).toUpperCase()}`;

  const productRows = items
    .map(
      (item) => `
    <tr>
      <td width="76" valign="top" style="width:76px;padding:20px 14px 20px 0;border-bottom:1px solid #e8ece7;">
        ${
          item.image
            ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="64" height="76" style="display:block;width:64px;height:76px;object-fit:cover;border:0;border-radius:8px;background:#f6f9f6;">`
            : `<table role="presentation" width="64" height="76" style="width:64px;height:76px;background:#f6f9f6;border-radius:8px;"><tr><td align="center" style="color:#6f9a79;font:italic 28px Georgia,serif;">V</td></tr></table>`
        }
      </td>
      <td valign="top" style="padding:20px 8px 20px 0;border-bottom:1px solid #e8ece7;">
        <p style="margin:0 0 7px;font-size:14px;line-height:21px;font-weight:600;color:#263b4a;overflow-wrap:anywhere;">${escapeHtml(item.title)}</p>
        <p style="margin:0 0 5px;font-size:12px;line-height:18px;color:#78847e;">Dung tích / Size: ${escapeHtml(item.size)}</p>
        <p style="margin:0;font-size:12px;line-height:18px;color:#78847e;">${escapeHtml(money(item.unitPrice))} × ${item.quantity}</p>
      </td>
      <td align="right" valign="top" style="padding:20px 0;border-bottom:1px solid #e8ece7;font-size:14px;line-height:21px;font-weight:600;color:#263b4a;white-space:nowrap;">${escapeHtml(money(item.unitPrice * item.quantity))}</td>
    </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    table { border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; }
    @media only screen and (max-width:620px) {
      .outer-pad { padding:12px 8px !important; }
      .content-pad { padding-left:20px !important; padding-right:20px !important; }
      .headline { font-size:28px !important; line-height:36px !important; }
      .info-column { display:block !important; width:100% !important; padding:0 0 20px !important; }
      .email-button { display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:#f1f4ef;font-family:Arial,Helvetica,sans-serif;color:#263b4a;">
  <div style="display:none;font-size:1px;color:#f1f4ef;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Velours đã nhận đơn hàng của bạn. ${quantity} sản phẩm · ${escapeHtml(money(total))}.</div>
  <table role="presentation" width="100%" style="width:100%;background:#f1f4ef;">
    <tr><td align="center" class="outer-pad" style="padding:36px 16px;">
      <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
      <table role="presentation" width="100%" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e7df;">
        <tr><td class="content-pad" style="padding:28px 36px;background:#41334e;">
          <table role="presentation" width="100%"><tr>
            <td><a href="${escapeHtml(storeUrl)}" style="color:#ffffff;text-decoration:none;font:32px Georgia,'Times New Roman',serif;letter-spacing:1px;">Velours<span style="color:#b9cfad;"></span></a></td>
          </tr></table>
        </td></tr>
        <tr><td class="content-pad" style="padding:34px 36px 28px;background:#f6f9f6;">
          <p style="margin:0 0 18px;font-size:11px;line-height:18px;letter-spacing:1.8px;font-weight:700;color:#557b5e;">✓ &nbsp; ĐẶT HÀNG THÀNH CÔNG</p>
          <h1 class="headline" style="margin:0 0 16px;font:34px/43px Georgia,'Times New Roman',serif;color:#41334e;">Cảm ơn bạn đã chọn Velours.</h1>
          <p style="margin:0;font-size:14px;line-height:24px;color:#66766d;">Xin chào ${escapeHtml(recipient || "bạn")}<br>Đơn hàng của bạn đã được ghi nhận. Bạn có thể xem lại thông tin và theo dõi đơn hàng bên dưới.</p>
        </td></tr>
        <tr><td class="content-pad" style="padding:24px 36px 0;">
          <table role="presentation" width="100%"><tr>
            <td class="info-column" width="64%" valign="top" style="padding:0 16px 20px 0;">
              <p style="margin:0 0 7px;font-size:10px;letter-spacing:1.4px;color:#839087;">MÃ ĐƠN HÀNG</p>
              <p style="margin:0;font-size:12px;line-height:19px;font-weight:600;overflow-wrap:anywhere;">${escapeHtml(orderId)}</p>
            </td>
            <td class="info-column" width="36%" valign="top" style="padding:0 0 20px;">
              <p style="margin:0 0 7px;font-size:10px;letter-spacing:1.4px;color:#839087;">NGÀY ĐẶT HÀNG</p>
              <p style="margin:0;font-size:12px;line-height:19px;">${escapeHtml(date || "—")}</p>
            </td>
          </tr></table>
          <table role="presentation" width="100%" style="border-top:1px solid #e8ece7;"><tr>
            <td style="padding-top:22px;font-size:16px;font-weight:600;">Sản phẩm của bạn</td>
            <td align="right" style="padding-top:22px;font-size:12px;color:#839087;">${quantity} sản phẩm</td>
          </tr></table>
          <table role="presentation" width="100%">${productRows}</table>
        </td></tr>
        <tr><td class="content-pad" style="padding:22px 36px 28px;">
          <table role="presentation" width="100%">
            <tr><td style="padding:0 0 12px;font-size:13px;color:#78847e;">Tạm tính</td><td align="right" style="padding:0 0 12px;font-size:13px;">${escapeHtml(money(subtotal))}</td></tr>
            ${discount > 0 ? `<tr><td style="padding:0 0 12px;font-size:13px;color:#78847e;">Voucher ${escapeHtml(order.voucherCode)}</td><td align="right" style="padding:0 0 12px;font-size:13px;">−${escapeHtml(money(discount))}</td></tr>` : ""}
            <tr><td style="padding:0 0 18px;font-size:13px;color:#78847e;">Phí vận chuyển${order.shippingMethod === "express" ? " (giao nhanh)" : ""}</td><td align="right" style="padding:0 0 18px;font-size:13px;${shipping === 0 ? "color:#557b5e;" : ""}">${shipping === 0 ? "Miễn phí" : escapeHtml(money(shipping))}</td></tr>
            <tr><td style="border-top:1px solid #e8ece7;padding-top:18px;font-size:14px;font-weight:600;">${totalLabel}</td><td align="right" style="border-top:1px solid #e8ece7;padding-top:18px;font-size:24px;font-weight:700;color:#41334e;white-space:nowrap;">${escapeHtml(money(total))}</td></tr>
          </table>
        </td></tr>
        <tr><td class="content-pad" style="padding:0 36px 28px;">
          <table role="presentation" width="100%" style="background:#f6f9f6;border:1px solid #e2e9df;"><tr><td style="padding:20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:600;">${paymentMethod}</p>
            <p style="margin:0 0 8px;font-size:12px;color:#557b5e;">${paymentStatus}</p>
            <p style="margin:0;font-size:13px;line-height:22px;color:#66766d;">${escapeHtml(paymentNote)}</p>
          </td></tr></table>
        </td></tr>
        <tr><td class="content-pad" style="padding:0 36px 28px;">
          <h2 style="margin:0 0 12px;font-size:15px;font-weight:600;">Địa chỉ nhận hàng</h2>
          <p style="margin:0 0 5px;font-size:14px;line-height:22px;font-weight:600;">${escapeHtml(recipient || "Người nhận")}</p>
          <p style="margin:0;font-size:13px;line-height:23px;color:#78847e;">${addressLines.map(escapeHtml).join("<br>") || "Xem địa chỉ trong chi tiết đơn hàng."}${address.phone ? `<br>Điện thoại: ${escapeHtml(address.phone)}` : ""}</p>
        </td></tr>
        <tr><td class="content-pad" align="center" style="padding:0 36px 32px;">
          <table role="presentation" width="100%"><tr><td align="center" style="background:#41334e;border-radius:8px;mso-padding-alt:16px 24px;">
            <a href="${escapeHtml(ordersUrl)}" class="email-button" style="display:block;padding:16px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border:1px solid #41334e;border-radius:8px;">Xem đơn hàng của tôi &nbsp; →</a>
          </td></tr></table>
          <p style="margin:14px 0 0;font-size:11px;line-height:18px;color:#929b95;">Đăng nhập bằng tài khoản đã dùng để đặt hàng.</p>
        </td></tr>
        <tr><td class="content-pad" align="center" style="padding:24px 36px;border-top:1px solid #e8ece7;">
          <p style="margin:0 0 7px;font:italic 18px/26px Georgia,serif;color:#557b5e;">Một chút chăm sóc, dành riêng cho bạn.</p>
          <p style="margin:0;font-size:11px;line-height:19px;color:#929b95;">Email xác nhận đơn hàng từ Velours.<br>Vui lòng giữ lại email này để đối chiếu khi cần.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:20px 0 0;font-size:11px;color:#929b95;">VELOURS · BEAUTY &amp; SELF-CARE</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "VELOURS — ĐẶT HÀNG THÀNH CÔNG",
    `Xin chào ${recipient || "bạn"}, cảm ơn bạn đã chọn Velours.`,
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
    ...(discount > 0 ? [`Voucher ${order.voucherCode}: -${money(discount)}`] : []),
    `Phí vận chuyển: ${shipping === 0 ? "Miễn phí" : money(shipping)}`,
    `${totalLabel}: ${money(total)}`,
    `${paymentMethod} — ${paymentStatus}`,
    paymentNote,
    "",
    "ĐỊA CHỈ NHẬN HÀNG",
    recipient,
    ...addressLines,
    ...(address.phone ? [`Điện thoại: ${address.phone}`] : []),
    "",
    `Xem đơn hàng của tôi: ${ordersUrl}`,
    "Đăng nhập bằng tài khoản đã dùng để đặt hàng.",
  ].join("\n");

  return { subject, html, text };
};
