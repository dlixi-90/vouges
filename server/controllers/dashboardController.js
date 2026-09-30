import { getDashboardData } from "../services/dashboardService.js";

export const dashboard = async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const timezone = req.query.timezone ?? "UTC";
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 20 ||
      typeof timezone !== "string") {
    return res.status(400).json({ success: false, message: "Invalid dashboard query" });
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return res.status(400).json({ success: false, message: "Invalid timezone" });
  }
  try {
    const dashboardData = await getDashboardData({ page, pageSize, timezone });
    res.set("Cache-Control", "private, no-store");
    return res.json({ success: true, dashboardData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Unable to load dashboard" });
  }
};
