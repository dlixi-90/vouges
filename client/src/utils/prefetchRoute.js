// Warm only route code on user intent; private data still loads after auth.
export const prefetchRoute = path => {
  const url = path.split("?")[0];
  const loaders = {
    "/collection": () => import("../pages/Collection"),
    "/about": () => import("../pages/About"),
    "/contact": () => import("../pages/Contact"),
    "/cart": () => import("../pages/Cart"),
    "/owner": () => import("../pages/owner/PerfumeOverview"),
    "/owner/orders": () => import("../pages/owner/Dashboard"),
    "/owner/vouchers": () => import("../pages/owner/Vouchers"),
    "/owner/messages": () => import("../pages/owner/Messages"),
    "/owner/list-product": () => import("../pages/owner/PerfumeProducts"),
    "/owner/brands": () => import("../pages/owner/FragranceLibrary"),
    "/owner/library": () => import("../pages/owner/FragranceLibrary"),
  };
  void loaders[url]?.().catch(() => {});
};
