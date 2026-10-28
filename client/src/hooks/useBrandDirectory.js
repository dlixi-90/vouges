import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";

export default function useBrandDirectory() {
  const { publicCatalog } = useAppContext();
  const [state, setState] = useState({ brands: [], loading: false, error: "" });
  const mounted = useRef(true), loaded = useRef(false), pending = useRef(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback((force = false) => {
    if (pending.current) return pending.current;
    if (loaded.current && !force) return Promise.resolve();
    setState(current => ({ ...current, loading: true, error: "" }));
    pending.current = publicCatalog.brands({ force }).then(data => {
      loaded.current = true;
      if (mounted.current) setState({ brands: data.brands, loading: false, error: "" });
    }).catch(error => {
      if (mounted.current) setState(current => ({ ...current, loading: false, error: error.message || "Không thể tải thương hiệu" }));
    }).finally(() => { pending.current = null; });
    return pending.current;
  }, [publicCatalog]);
  return { ...state, load, reload: () => load(true) };
}
