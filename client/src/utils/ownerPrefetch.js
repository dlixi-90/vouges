import { prefetchRoute } from "./prefetchRoute.js";

export const OWNER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const ownerOverviewPath = `/overview?timezone=${encodeURIComponent(OWNER_TIMEZONE)}`;
export const ownerDashboardKey = (userId, page = 1) => `${userId}:${OWNER_TIMEZONE}:${page}`;
export const ownerDashboardSummaryKey = userId => `${userId}:${OWNER_TIMEZONE}:sales`;
export const defaultInboxPath = "/api/support/inbox?search=&status=all&page=1";
export const BRAND_OPTIONS_PATH = "/terms?kind=brand&pageSize=2000&includeCounts=false";
export const GROUP_OPTIONS_PATH = "/terms?kind=group&pageSize=2000&includeCounts=false";
export const NOTE_OPTIONS_PATH = "/terms?kind=note&pageSize=2000&includeCounts=false";
export const ACCORD_OPTIONS_PATH = "/terms?kind=accord&pageSize=2000&includeCounts=false";

export const readOwnerDashboard = async ({ axios, getToken, page = 1, signal }) => {
  const token = await getToken();
  signal.throwIfAborted();
  const { data } = await axios.get("/api/orders/dashboard/orders", {
    params: { page, pageSize: 10 },
    headers: { Authorization: `Bearer ${token}` }, signal, timeout: 15000,
  });
  if (!data.success) throw new Error(data.message || "Không thể tải dữ liệu tổng quan");
  return data.dashboardData;
};

export const readOwnerDashboardSummary = async ({ axios, getToken, signal, force = false }) => {
  const token = await getToken();
  signal.throwIfAborted();
  const { data } = await axios.get("/api/orders/dashboard/summary", {
    params: { timezone: OWNER_TIMEZONE, ...(force ? { refresh: Date.now() } : {}) },
    headers: { Authorization: `Bearer ${token}` }, signal, timeout: 15000,
  });
  if (!data.success) throw new Error(data.message || "Không thể tải doanh thu");
  return data.summaryData;
};

// Sidebar calls this only on intent and after the owner profile is verified.
// Shared caches deduplicate hover, keyboard focus and the subsequent mount.
export const prefetchOwnerRoute = (path, context) => {
  if (context.isOwner !== true || !context.authenticatedUserId) return Promise.resolve([]);
  prefetchRoute(path);
  const [pathname, rawSearch = ""] = path.split("?", 2);
  const routeSearch = new URLSearchParams(rawSearch);
  const tasks = [];
  if (pathname === "/owner") tasks.push(context.storeResources.loadCatalog(ownerOverviewPath));
  if (pathname === "/owner/orders") {
    tasks.push(context.dashboardCache.load(ownerDashboardKey(context.authenticatedUserId),
      signal => readOwnerDashboard({ ...context, signal })));
    tasks.push(context.fetchPopularProducts());
  }
  if (pathname === "/owner/list-product") {
    const filters = { q: routeSearch.get("q") || "", brand: "", concentration: "", category: "",
      stock: routeSearch.get("stock") || "", quality: routeSearch.get("quality") === "issues" ? "issues" : "" };
    const query = new URLSearchParams({ page: "1", pageSize: "25", ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")) });
    tasks.push(context.storeResources.loadCatalog(`/products?${query}`));
  }
  if (pathname === "/owner/brands" || pathname === "/owner/library") {
    const kind = pathname === "/owner/brands" ? "brand" : routeSearch.get("kind") || "group";
    const query = new URLSearchParams({ kind, q: "", status: "", page: "1", pageSize: "25", includeCounts: "false" });
    tasks.push(context.storeResources.loadCatalog(`/terms?${query}`));
  }
  if (["/owner/add-product", "/owner/add-category"].includes(pathname)) tasks.push(context.fetchCategories());
  if (pathname === "/owner/add-product") {
    tasks.push(
      context.storeResources.loadCatalog(BRAND_OPTIONS_PATH),
      context.storeResources.loadCatalog(GROUP_OPTIONS_PATH),
      context.storeResources.loadCatalog(NOTE_OPTIONS_PATH),
      context.storeResources.loadCatalog(ACCORD_OPTIONS_PATH),
    );
  }
  if (pathname === "/owner/vouchers") tasks.push(context.storeResources.loadCatalog("/", "/api/vouchers"));
  if (pathname === "/owner/loyalty") tasks.push(context.storeResources.loadCatalog("/admin/summary", "/api/loyalty"));
  if (pathname === "/owner/messages") tasks.push(context.storeResources.loadSupportInbox(defaultInboxPath));
  if (["/owner/users", "/owner/customers"].includes(pathname)) tasks.push(context.storeResources.loadCatalog("/manage?q=&role=all&page=1&pageSize=25", "/api/users"));
  const productMatch = pathname.match(/^\/owner\/edit-product\/([a-f\d]{24})$/i);
  if (productMatch) {
    tasks.push(context.storeResources.loadCatalog(`/products/${productMatch[1]}`));
    tasks.push(import("../components/owner/ProductArticleEditor"));
  }
  if (pathname === "/owner/library") tasks.push(import("../components/owner/ProductArticleEditor"));
  if (["/owner", "/owner/orders"].includes(pathname)) tasks.push(import("../components/owner/RevenueChart"));
  return Promise.allSettled(tasks);
};
