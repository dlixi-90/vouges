import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import useCachedResource from "./useCachedResource";

export default function useProductFeed({ limit = 12, availability = "all", enabled = true } = {}) {
  const { publicCatalog } = useAppContext();
  const resource = useMemo(() => enabled ? ({
    peek: () => publicCatalog.peekBrowse({ limit, availability }),
    load: options => publicCatalog.browse({ limit, availability }, options),
  }) : null, [publicCatalog, limit, availability, enabled]);
  const result = useCachedResource(resource);
  return { ...result, products: result.data?.products || [] };
}
