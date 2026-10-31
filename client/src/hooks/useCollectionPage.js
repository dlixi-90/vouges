import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import useCachedResource from "./useCachedResource";

export default function useCollectionPage(params, { enabled = true } = {}) {
  const { publicCatalog } = useAppContext();
  const requestKey = JSON.stringify(params);
  const resource = useMemo(() => enabled ? ({
    peek: () => publicCatalog.peekBrowse(JSON.parse(requestKey)),
    load: options => publicCatalog.browse(JSON.parse(requestKey), options),
  }) : null, [publicCatalog, requestKey, enabled]);
  return useCachedResource(resource, { scope: "collection", keepPrevious: true });
}
