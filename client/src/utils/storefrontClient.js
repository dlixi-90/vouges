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
    void storefrontCatalog.detail(pathname.split("/")[2]).catch(() => {});
  }
};
