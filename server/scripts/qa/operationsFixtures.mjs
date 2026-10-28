// Browser-only fixtures. No database models or external services are used here.
export function createOperationsFixtures(sample) {
  const now = new Date().toISOString();
  const requests = [];
  const size = sample.sizes[0];
  const orders = Array.from({ length: 31 }, (_, index) => ({
    _id: (0x100000 + index).toString(16).padStart(24, "0"), createdAt: now,
    amount: 1250000, isPaid: false, paymentMethod: "COD", status: "Packing", note: "Ghi chú kiểm thử giao diện",
    address: { firstName: "Khách", lastName: `kiểm thử ${index + 1}`, street: "Địa chỉ kiểm thử", city: "Hà Nội", country: "Việt Nam", phone: "0000000000" },
    items: [{ product: sample._id, title: sample.title, size, quantity: 1, unitPrice: 1250000, image: sample.images[0] }],
  }));
  let vouchers = [
    { _id: "100000000000000000000001", code: "VELOURS10", type: "percent", value: 10, minSubtotal: 500000, maxDiscount: 100000, maxUses: 100, usedCount: 2, active: true, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" },
    { _id: "100000000000000000000002", code: "WELCOME50", type: "fixed", value: 50000, minSubtotal: 500000, maxDiscount: null, maxUses: 20, usedCount: 0, active: false, startsAt: "2026-01-01T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" },
    { _id: "100000000000000000000003", code: "PASTOFFER", type: "percent", value: 15, minSubtotal: 0, maxDiscount: null, maxUses: 30, usedCount: 1, active: true, startsAt: "2020-01-01T00:00:00Z", expiresAt: "2020-02-01T00:00:00Z" },
  ];
  let conversation = { _id: "qa-conversation-1-0", customerName: "Khách kiểm thử", customerEmail: "qa@example.test", status: "active", sequence: 2, unreadStaff: 0, unreadCustomer: 0, updatedAt: now, context: [] };
  let messages = [
    { _id: "qa-msg-1", sequence: 1, role: "customer", authorName: "Khách kiểm thử", content: "Tôi cần tư vấn nước hoa.", createdAt: now },
    { _id: "qa-msg-2", sequence: 2, role: "staff", authorName: "Velours", content: "Velours sẵn sàng hỗ trợ bạn.", createdAt: now },
  ];
  const json = body => ({ statusCode: 200, body: { success: true, ...body } });
  const stream = snapshot => ({ statusCode: 200, mime: "text/event-stream", body: `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n` });
  return { requests, respond(request) {
    const url = new URL(request.url), pathname = url.pathname.replace(/\/$/, "");
    if (!/^\/api\/(orders|vouchers|support)(\/|$)/.test(pathname)) return null;
    const body = request.postData && request.method !== "GET" ? JSON.parse(request.postData) : {};
    const record = () => requests.push({ method: request.method, path: pathname, body });
    if (pathname === "/api/orders/dashboard" && request.method === "GET") {
      const page = Number(url.searchParams.get("page") || 1);
      const monthlyData = Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 11 + index); return { key: date.toISOString().slice(0, 7), month: date.toLocaleDateString("vi-VN", { month: "short", timeZone: "UTC" }), total: index === 11 ? orders.reduce((sum, item) => sum + item.amount, 0) : 0, successful: index === 11 ? orders.filter(item => item.isPaid).reduce((sum, item) => sum + item.amount, 0) : 0 }; });
      return json({ dashboardData: { orders: orders.slice((page - 1) * 10, page * 10), totalOrders: orders.length, totalRevenue: orders.filter(item => item.isPaid).reduce((sum, item) => sum + item.amount, 0), monthlyData, page, pageSize: 10, totalPages: 4 } });
    }
    if (pathname === "/api/orders/status" && request.method === "POST") { record(); const order = orders.find(item => item._id === body.orderId); order.status = body.status; if (body.status === "Delivery") { order.isPaid = true; order.paidAt = now; } return json({ order, message: "Đã cập nhật trạng thái" }); }
    if (pathname === "/api/vouchers") {
      if (request.method === "GET") return json({ vouchers });
      if (request.method === "POST") { record(); const voucher = { ...body, _id: "100000000000000000000004", usedCount: 0, active: true }; vouchers = [voucher, ...vouchers]; return json({ voucher }); }
    }
    if (pathname.startsWith("/api/vouchers/")) {
      const id = pathname.split("/").pop();
        if (request.method === "PATCH") { record(); vouchers = vouchers.map(voucher => voucher._id === id ? { ...voucher, active: body.active } : voucher); return json({ voucher: vouchers.find(voucher => voucher._id === id) }); }
      if (request.method === "DELETE") { record(); vouchers = vouchers.filter(voucher => voucher._id !== id); return json({}); }
    }
    if (pathname === "/api/support/inbox/events") return stream({ total: 1, unread: 0, conversations: [{ ...conversation, lastMessage: messages.at(-1)?.content, lastMessageAt: conversation.updatedAt }] });
    if (pathname === "/api/support/inbox") return json({ page: 1, total: 1, unread: 0, conversations: [{ ...conversation, lastMessage: messages.at(-1)?.content, lastMessageAt: conversation.updatedAt }] });
    if (pathname.startsWith(`/api/support/conversations/${conversation._id}`)) {
      if (pathname.endsWith("/events")) return stream({ conversation, messages });
      if (pathname.endsWith("/status") && request.method === "PATCH") { record(); conversation = { ...conversation, status: body.status, updatedAt: new Date().toISOString() }; return json({ conversation }); }
      if (pathname.endsWith("/read") && request.method === "POST") { record(); return json({}); }
      if (pathname.endsWith("/messages") && request.method === "POST") { record(); const message = { ...body, _id: `qa-msg-${messages.length + 1}`, sequence: messages.length + 1, role: "staff", authorName: "Velours", createdAt: new Date().toISOString() }; messages = [...messages, message]; conversation = { ...conversation, sequence: message.sequence, updatedAt: message.createdAt, status: "active" }; return json({ conversation, message }); }
    }
    return null;
  } };
}
