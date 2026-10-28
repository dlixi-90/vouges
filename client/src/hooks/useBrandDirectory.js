import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import initialDirectory from "../data/brandDirectory.json";

export default function useBrandDirectory() {
  const { publicCatalog } = useAppContext();
  // Navigation can render immediately, even on a cold backend. Intent refreshes
  // this public snapshot through the shared five-minute metadata cache.
  const [state, setState] = useState(() => ({ brands: publicCatalog.peekBrands()?.brands ?? initialDirectory.brands, loading: false, error: "" }));
  const mounted = useRef(true), pending = useRef(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback((force = false) => {
    if (pending.current) return pending.current;
    setState(current => ({ ...current, loading: true, error: "" }));
    pending.current = publicCatalog.brands({ force }).then(data => {
      if (mounted.current) setState({ brands: data.brands, loading: false, error: "" });
    }).catch(error => {
      if (mounted.current) setState(current => ({ ...current, loading: false, error: error.message || "Không thể tải thương hiệu" }));
    }).finally(() => { pending.current = null; });
    return pending.current;
  }, [publicCatalog]);
  return { ...state, load, reload: () => load(true) };
}
