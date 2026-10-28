import Order from "../models/Order.js";
import { placedOrderFilter } from "../utils/orderReporting.js";

export const getDashboardData = async ({ page = 1, pageSize = 10, timezone = "UTC", includeOrders = true }) => {
  const filter = placedOrderFilter();
  const [orders, summaries] = await Promise.all([
    includeOrders ? Order.find(filter)
      .select("items amount address status paymentMethod isPaid paidAt createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: "items.product", select: "title images price" })
      .populate({ path: "address", select: "firstName lastName street state city country zipcode zipCode phone" })
      .lean() : Promise.resolve([]),
    Order.aggregate([
      { $match: filter },
      { $facet: {
        totals: [{ $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $cond: ["$isPaid", "$amount", 0] } },
        } }],
        months: [
          { $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone } },
            total: { $sum: "$amount" },
            successful: { $sum: { $cond: ["$isPaid", "$amount", 0] } },
          } },
          { $sort: { _id: -1 } },
          { $limit: 12 },
        ],
      } },
    ]),
  ]);
  const { totals = [], months = [] } = summaries[0] || {};
  const { totalOrders = 0, totalRevenue = 0 } = totals[0] || {};
  const anchor = months[0]?._id
    ? new Date(`${months[0]._id}-01T00:00:00Z`)
    : new Date();
  const byMonth = new Map(months.map((month) => [month._id, month]));
  const monthlyData = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 11 + index, 1));
    const key = date.toISOString().slice(0, 7);
    const month = byMonth.get(key);
    return {
      key,
      month: date.toLocaleDateString("vi-VN", { month: "short", timeZone: "UTC" }),
      total: month?.total || 0,
      successful: month?.successful || 0,
    };
  });
  return { orders, totalOrders, totalRevenue, monthlyData, page, pageSize, totalPages: Math.max(1, Math.ceil(totalOrders / pageSize)) };
};
