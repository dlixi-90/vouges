import { getDashboardData, getDashboardOrders } from "../services/dashboardService.js";
import Order from "../models/Order.js";

const salesSummaryCache = new Map();
const readSalesSummary = (timezone, force = false) => {
  const cached = salesSummaryCache.get(timezone);
  if (cached?.pending) return cached.pending;
  if (!force && cached?.data && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
  const entry = { data: null, expiresAt: 0, pending: null };
  entry.pending = Promise.resolve().then(() => getDashboardData({ includeOrders: false, timezone }))
    .then(({ totalOrders, totalRevenue, monthlyData }) => {
      entry.data = { totalOrders, totalRevenue, monthlyData };
      entry.expiresAt = Date.now() + 15000;
      return entry.data;
    })
    .finally(() => { entry.pending = null; });
  salesSummaryCache.set(timezone, entry);
  while (salesSummaryCache.size > 16) salesSummaryCache.delete(salesSummaryCache.keys().next().value);
  return entry.pending;
};

const validTimezone = timezone => {
  if (typeof timezone !== "string" || timezone.length > 100) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); return true; }
  catch { return false; }
};

export const customerOrdersPage = async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const page = Number(req.query.page ?? 1), pageSize = Number(req.query.pageSize ?? 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || ![10,20].includes(pageSize)) return res.status(400).json({ success:false, message:"Phân trang đơn hàng không hợp lệ" });
  try {
    const { userId } = req.auth();
    // Preserve customer history, including placed orders later cancelled by staff.
    const filter = { userId, $or: [{paymentMethod:"COD"},{isPaid:true}] };
    const [orders,total] = await Promise.all([
      Order.find(filter).select("items amount address status paymentMethod isPaid paidAt createdAt subtotal shipping shippingMethod discount voucherCode note")
        .sort({ createdAt:-1,_id:-1 }).skip((page-1)*pageSize).limit(pageSize)
        .populate({path:"items.product",select:{title:1,images:{$slice:1},sizeImages:1,price:1,isDeleted:1}})
        .populate({path:"address",select:"firstName lastName street state city country zipcode zipCode phone email"}).lean(),
      Order.countDocuments(filter),
    ]);
    return res.json({ success:true,orders,total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize)) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success:false,message:"Không thể tải danh sách đơn hàng" });
  }
};

export const dashboard = async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const timezone = req.query.timezone ?? "UTC";
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 20 ||
      typeof timezone !== "string") {
    return res.status(400).json({ success: false, message: "Yêu cầu truy vấn dữ liệu tổng quan không hợp lệ" });
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return res.status(400).json({ success: false, message: "Múi giờ không hợp lệ" });
  }
  try {
    const dashboardData = await getDashboardData({ page, pageSize, timezone });
    res.set("Cache-Control", "private, no-store");
    return res.json({ success: true, dashboardData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Không thể tải trang tổng quan" });
  }
};

export const dashboardOrders = async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 20) {
    return res.status(400).json({ success: false, message: "Phân trang đơn hàng không hợp lệ" });
  }
  try {
    const dashboardData = await getDashboardOrders({ page, pageSize });
    res.set("Cache-Control", "private, no-store");
    return res.json({ success: true, dashboardData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Không thể tải danh sách đơn hàng" });
  }
};

export const dashboardSalesSummary = async (req, res) => {
  const timezone = req.query.timezone ?? "UTC";
  if (!validTimezone(timezone)) {
    return res.status(400).json({ success: false, message: "Múi giờ không hợp lệ" });
  }
  try {
    const summaryData = await readSalesSummary(timezone, req.query.refresh !== undefined);
    res.set("Cache-Control", "private, no-store");
    return res.json({ success: true, summaryData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Không thể tải doanh thu" });
  }
};
