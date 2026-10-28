const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const serif = "Lora,Georgia,'Times New Roman',serif";

// Table layout and inline styles keep the receipt usable without web fonts,
// scripts, CSS grid or flexbox, including email clients that strip <style>.
export const renderOrderConfirmation = (data, money) => {
  const { subject, storeUrl, overviewUrl, contactUrl, heading, introduction,
    recipient, orderId, date, items, quantity, subtotal, discount, voucherCode,
    shippingLabel, shippingMethod, total, totalLabel, paymentMethod,
    paymentStatus, paymentNote, isQrPending, addressLines, phone } = data;
  const collectionUrl = new URL("/collection", storeUrl).href;
  const productRows = items.map(item => `<tr>
    <td class="product-image" width="84" valign="top" style="width:84px;padding:18px 16px 18px 0;border-bottom:1px solid #e6e3df;">
      ${item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="68" height="80" style="display:block;width:68px;height:80px;object-fit:contain;border:0;border-radius:8px;background:#fafafa;">`
        : `<table role="presentation" width="68" height="80" style="width:68px;height:80px;background:#fafafa;border-radius:8px;"><tr><td align="center" style="font:28px Georgia,serif;">V</td></tr></table>`}
    </td>
    <td valign="top" style="padding:18px 0;border-bottom:1px solid #e6e3df;">
      <p style="margin:0 0 6px;font-family:${serif};font-size:17px;font-weight:500;line-height:25px;color:#161616;overflow-wrap:anywhere;">${escapeHtml(item.title)}</p>
      <p style="margin:0 0 9px;font-size:12px;line-height:19px;color:#686868;">Dung tích: ${escapeHtml(item.size)} &nbsp;·&nbsp; Số lượng: ${item.quantity}</p>
      <table role="presentation" width="100%"><tr>
        <td class="product-unit" style="font-size:12px;line-height:20px;color:#686868;">${escapeHtml(money(item.unitPrice))} × ${item.quantity}</td>
        <td class="product-total" align="right" style="font-size:14px;line-height:20px;font-weight:600;color:#161616;white-space:nowrap;">${escapeHtml(money(item.unitPrice * item.quantity))}</td>
      </tr></table>
    </td>
  </tr>`).join("");

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    table { border-collapse:collapse; }
    img { -ms-interpolation-mode:bicubic; }
    a:focus-visible { outline:2px solid #686868; outline-offset:4px; }
    @media only screen and (max-width:620px) {
      .outer-pad { padding:12px 8px !important; }
      .content-pad { padding-left:20px !important; padding-right:20px !important; }
      .headline { font-size:28px !important; line-height:38px !important; }
      .info-column { display:block !important; width:auto !important; padding:0 0 18px !important; }
      .meta-column { display:block !important; width:auto !important; padding:0 0 14px !important; }
      .email-button { display:block !important; text-align:center !important; }
      .product-image { width:64px !important; padding-right:12px !important; }
      .product-image img { width:52px !important; height:68px !important; }
    }
    @media only screen and (max-width:380px) {
      .product-unit,.product-total { display:block !important; width:auto !important; text-align:left !important; }
      .product-total { padding-top:4px !important; }
      .total-value { font-size:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#161616;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(heading)} · ${quantity} sản phẩm · ${escapeHtml(money(total))}.</div>
  <table role="presentation" width="100%" style="width:100%;background:#ffffff;">
    <tr><td align="center" class="outer-pad" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="640"><tr><td><![endif]-->
      <table role="presentation" width="100%" class="email-shell" style="width:100%;max-width:640px;border:1px solid #e6e3df;border-radius:12px;border-collapse:separate;border-spacing:0;background:#ffffff;">
        <tr><td class="content-pad" align="center" style="padding:28px 32px 22px;border-bottom:1px solid #e6e3df;">
          <a href="${escapeHtml(storeUrl)}" aria-label="Velours — Trang chủ" style="display:inline-block;color:#161616;text-decoration:none;white-space:nowrap;"><img src="cid:velours-mark@velours" alt="V" width="50" height="34" style="display:inline-block;width:50px;height:34px;vertical-align:bottom;border:0;"><span style="display:inline-block;margin-left:-6px;vertical-align:bottom;font-family:${serif};font-size:32px;font-weight:600;line-height:34px;">elours</span></a>
          <p style="margin:18px 0 0;font-size:10px;font-weight:500;line-height:18px;letter-spacing:1.4px;"><a href="${escapeHtml(collectionUrl)}" style="color:#686868;text-decoration:none;">BỘ SƯU TẬP</a><span style="padding:0 12px;color:#aaa;">/</span><a href="${escapeHtml(contactUrl)}" style="color:#686868;text-decoration:none;">LIÊN HỆ</a></p>
        </td></tr>
        <tr><td class="content-pad" style="padding:30px 32px 24px;">
          <p style="margin:0 0 14px;font-size:10px;line-height:18px;font-weight:600;letter-spacing:1.5px;color:#686868;">${escapeHtml(heading.toLocaleUpperCase("vi-VN"))}</p>
          <h1 class="headline" style="margin:0 0 18px;font-family:${serif};font-size:36px;font-weight:500;line-height:46px;letter-spacing:-.5px;color:#161616;">Cảm ơn bạn đã<br>chọn Velours.</h1>
          <p style="margin:0 0 8px;font-size:14px;line-height:24px;color:#161616;">Xin chào ${escapeHtml(recipient || "bạn")},</p>
          <p style="margin:0;font-size:14px;line-height:24px;color:#686868;">${escapeHtml(introduction)}</p>
        </td></tr>
        <tr><td class="content-pad" style="padding:0 32px 8px;">
          <table role="presentation" width="100%" style="border-top:1px solid #e6e3df;"><tr><td style="padding-top:18px;">
            <table role="presentation" width="100%"><tr>
              <td class="meta-column" width="52%" valign="top" style="width:52%;padding:0 16px 18px 0;">
                <p style="margin:0 0 6px;font-size:10px;line-height:18px;letter-spacing:1px;color:#686868;">MÃ ĐƠN HÀNG</p>
                <p style="margin:0;font-size:13px;font-weight:600;line-height:21px;overflow-wrap:anywhere;">#${escapeHtml(orderId.slice(-8).toUpperCase())}</p>
                <p style="margin:3px 0 0;font-size:10px;line-height:16px;color:#888;overflow-wrap:anywhere;">${escapeHtml(orderId)}</p>
              </td>
              <td class="meta-column" width="48%" valign="top" style="width:48%;padding:0 0 18px;">
                <p style="margin:0 0 6px;font-size:10px;line-height:18px;letter-spacing:1px;color:#686868;">NGÀY ĐẶT HÀNG</p>
                <p style="margin:0;font-size:13px;line-height:21px;">${escapeHtml(date || "—")}</p>
              </td>
            </tr></table>
          </td></tr></table>
        </td></tr>
        <tr><td class="content-pad" style="padding:0 32px 22px;">
          <table role="presentation" width="100%"><tr><td style="font-family:${serif};font-size:22px;font-weight:500;line-height:30px;">Đơn hàng của bạn</td><td align="right" style="font-size:11px;line-height:18px;color:#686868;">${quantity} sản phẩm</td></tr></table>
          <table role="presentation" width="100%">${productRows}</table>
          <table role="presentation" width="100%" style="margin-top:18px;">
            <tr><td style="padding-bottom:10px;font-size:13px;line-height:21px;color:#686868;">Tạm tính</td><td align="right" style="padding-bottom:10px;font-size:13px;line-height:21px;">${escapeHtml(money(subtotal))}</td></tr>
            ${discount > 0 ? `<tr><td style="padding-bottom:10px;font-size:13px;line-height:21px;color:#686868;">Giảm giá ${escapeHtml(voucherCode)}</td><td align="right" style="padding-bottom:10px;font-size:13px;line-height:21px;">−${escapeHtml(money(discount))}</td></tr>` : ""}
            <tr><td valign="top" style="padding:0 12px 16px 0;font-size:13px;line-height:21px;color:#686868;">Phí vận chuyển${shippingMethod === "urgent" ? " (Hỏa tốc)" : shippingMethod === "express" ? " (giao nhanh)" : ""}</td><td align="right" style="padding-bottom:16px;font-size:13px;line-height:21px;">${escapeHtml(shippingLabel)}</td></tr>
          </table>
          <table role="presentation" width="100%" style="border-top:1px solid #161616;"><tr>
            <td style="padding-top:16px;font-size:14px;font-weight:600;line-height:22px;">${escapeHtml(totalLabel)}</td>
            <td class="total-value" align="right" style="padding-top:16px;font-family:${serif};font-size:28px;font-weight:600;line-height:36px;white-space:nowrap;">${escapeHtml(money(total))}</td>
          </tr></table>
        </td></tr>
        <tr><td class="content-pad" style="padding:0 32px 8px;">
          <table role="presentation" width="100%" style="border-top:1px solid #e6e3df;"><tr><td style="padding-top:22px;">
            <table role="presentation" width="100%"><tr>
              <td class="info-column" width="52%" valign="top" style="width:52%;padding:0 24px 22px 0;">
                <h2 style="margin:0 0 12px;font-family:${serif};font-size:19px;font-weight:500;line-height:27px;">Thanh toán</h2>
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;line-height:21px;">${escapeHtml(paymentMethod)}</p>
                <p style="margin:0 0 10px;font-size:11px;line-height:19px;color:#161616;"><span style="display:inline-block;padding:3px 9px;border:1px solid #e6e3df;border-radius:6px;">${escapeHtml(paymentStatus)}</span></p>
                <p style="margin:0;font-size:12px;line-height:21px;color:#686868;">${escapeHtml(paymentNote)}</p>
              </td>
              <td class="info-column" width="48%" valign="top" style="width:48%;padding:0 0 22px;">
                <h2 style="margin:0 0 12px;font-family:${serif};font-size:19px;font-weight:500;line-height:27px;">Địa chỉ nhận hàng</h2>
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;line-height:21px;">${escapeHtml(recipient || "Người nhận")}</p>
                <p style="margin:0;font-size:12px;line-height:22px;color:#686868;overflow-wrap:anywhere;">${addressLines.map(escapeHtml).join("<br>") || "Xem địa chỉ trong chi tiết đơn hàng."}${phone ? `<br>Điện thoại: ${escapeHtml(phone)}` : ""}</p>
              </td>
            </tr></table>
          </td></tr></table>
        </td></tr>
        <tr><td class="content-pad" align="center" style="padding:0 32px 28px;">
          <table role="presentation" width="100%"><tr><td align="center" bgcolor="#161616" style="background:#161616;border-radius:8px;mso-padding-alt:15px 20px;">
            <a href="${escapeHtml(overviewUrl)}" class="email-button" style="display:block;padding:15px 20px;border:1px solid #161616;border-radius:8px;font-size:11px;font-weight:600;line-height:20px;letter-spacing:1.2px;color:#ffffff;text-decoration:none;text-transform:uppercase;">${isQrPending ? "Xem đơn và tiếp tục thanh toán" : "Xem chi tiết đơn hàng"} &nbsp; →</a>
          </td></tr></table>
          <p style="margin:12px 0 0;font-size:11px;line-height:19px;color:#888;">Đăng nhập bằng tài khoản đã dùng để đặt hàng.</p>
        </td></tr>
        <tr><td class="content-pad" align="center" bgcolor="#161616" style="padding:24px 32px;background:#161616;border-radius:0 0 11px 11px;">
          <p style="margin:0 0 10px;font-family:${serif};font-size:19px;font-weight:500;line-height:28px;color:#ffffff;">Một hương thơm, một dấu ấn riêng.</p>
          <p style="margin:0 0 12px;font-size:12px;line-height:21px;color:#d4d4d4;">Cần hỗ trợ? <a href="${escapeHtml(contactUrl)}" style="color:#ffffff;text-decoration:underline;text-underline-offset:3px;">Liên hệ Velours</a> và cung cấp mã đơn hàng.</p>
          <p style="margin:0;font-size:10px;line-height:18px;color:#a3a3a3;">VELOURS · THẾ GIỚI NƯỚC HOA<br>Vui lòng giữ lại email này để đối chiếu thông tin mua hàng.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
};
