import axios from "axios";
import { createPublicCatalog } from "./publicCatalog.js";
import { prefetchCollection } from "./prefetchCollection.js";

let storage;
try { storage = window.sessionStorage; } catch { /* Private browsing may disable storage. */ }
export const storefrontCatalog = createPublicCatalog({ axios, storage });

// Start public data alongside route/auth code, without waiting for a section to
// scroll into view. The mounted components consume the same pending requests.
export const warmStorefront = (pathname, search = "") => {
  if (pathname === "/") {
    void storefrontCatalog.popular().then(data => {
      if (!data.products.length) return storefrontCatalog.browse({ limit: 10, availability: "available" });
    }).catch(() => {});
    void storefrontCatalog.browse({ limit: 12, availability: "all" }).catch(() => {});
  } else if (pathname === "/collection") {
    const params = new URLSearchParams(search);
    prefetchCollection(storefrontCatalog, pathname + search, params.get("q") || "");
  } else if (/^\/collection\/[a-f0-9]{24}$/iu.test(pathname)) {
    const productId = pathname.split("/")[2];
    void storefrontCatalog.detail(productId).catch(() => {});
    void storefrontCatalog.related(productId).catch(() => {});
  } else if (pathname.startsWith("/knowledge/")) {
    const [, , kind, rawSlug] = pathname.split("/");
    if (!["group", "accord", "note"].includes(kind)) return;
    const params = new URLSearchParams(search);
    const name = params.get("name") || "";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const slug = rawSlug && rawSlug !== "entry" ? decodeURIComponent(rawSlug) : "";
    if (slug || name) {
      void storefrontCatalog.library(kind, { ...(slug ? { slug } : { name }), page }).catch(() => {});
    } else {
      void storefrontCatalog.library(kind, { view: "directory" }).catch(() => {});
    }
  }
};
