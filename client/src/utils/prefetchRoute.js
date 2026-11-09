// Warm only route code on user intent; private data still loads after auth.
export const prefetchRoute = path => {
  const url = path.split("?")[0];
  const loaders = {
    "/": () => import("../pages/Home"),
    "/collection": () => import("../pages/Collection"),
    "/about": () => import("../pages/About"),
    "/contact": () => import("../pages/Contact"),
    "/policies": () => import("../pages/Policies"),
    "/knowledge": () => import("../pages/Knowledge"),
    "/membership": () => import("../pages/Membership"),
    "/my-orders": () => import("../pages/MyOrders"),
    "/cart": () => import("../pages/Cart"),
    "/owner": () => import("../pages/owner/PerfumeOverview"),
    "/owner/orders": () => import("../pages/owner/Dashboard"),
    "/owner/vouchers": () => import("../pages/owner/Vouchers"),
    "/owner/loyalty": () => import("../pages/owner/Loyalty"),
    "/owner/messages": () => import("../pages/owner/Messages"),
    "/owner/users": () => import("../pages/owner/Users"),
    "/owner/customers": () => import("../pages/owner/Users"),
    "/owner/list-product": () => import("../pages/owner/PerfumeProducts"),
    "/owner/add-product": () => import("../pages/owner/AddProduct"),
    "/owner/add-category": () => import("../pages/owner/AddCategory"),
    "/owner/brands": () => import("../pages/owner/FragranceLibrary"),
    "/owner/library": () => import("../pages/owner/FragranceLibrary"),
  };
  const loader = loaders[url]
    || (url.startsWith("/knowledge/") ? () => import("../pages/Knowledge") : null)
    || (url.startsWith("/collection/") ? () => import("../pages/ProductDetail") : null)
    || (url.startsWith("/owner/edit-product/") ? () => import("../pages/owner/PerfumeEditor") : null);
  void loader?.().catch(() => {});
};
