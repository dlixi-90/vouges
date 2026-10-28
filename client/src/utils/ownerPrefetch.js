import { prefetchRoute } from "./prefetchRoute.js";

export const OWNER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const ownerOverviewPath = `/overview?timezone=${encodeURIComponent(OWNER_TIMEZONE)}`;
export const ownerDashboardKey = (userId, page = 1) => `${userId}:${OWNER_TIMEZONE}:${page}`;
export const defaultInboxPath = "/api/support/inbox?search=&status=all&page=1";

export const readOwnerDashboard = async ({ axios, getToken, page = 1, signal }) => {
  const token = await getToken();
  signal.throwIfAborted();
  const { data } = await axios.get("/api/orders/dashboard", {
    params: { page, pageSize: 10, timezone: OWNER_TIMEZONE },
    headers: { Authorization: `Bearer ${token}` }, signal, timeout: 15000,
  });
  if (!data.success) throw new Error(data.message || "Không thể tải dữ liệu tổng quan");
  return data.dashboardData;
};

// Sidebar calls this only on intent and after the owner profile is verified.
// Shared caches deduplicate hover, keyboard focus and the subsequent mount.
export const prefetchOwnerRoute = (path, context) => {
  if (context.isOwner !== true || !context.authenticatedUserId) return Promise.resolve([]);
  prefetchRoute(path);
  const tasks = [];
  if (path === "/owner") tasks.push(context.storeResources.loadCatalog(ownerOverviewPath));
  if (path === "/owner/orders") tasks.push(context.dashboardCache.load(ownerDashboardKey(context.authenticatedUserId),
    signal => readOwnerDashboard({ ...context, signal })));
  if (path === "/owner/vouchers") tasks.push(context.storeResources.loadCatalog("/", "/api/vouchers"));
  if (path === "/owner/messages") tasks.push(context.storeResources.loadSupportInbox(defaultInboxPath));
  if (["/owner", "/owner/orders"].includes(path)) tasks.push(import("../components/owner/RevenueChart"));
  return Promise.allSettled(tasks);
};
