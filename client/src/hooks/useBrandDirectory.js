import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";

export default function useBrandDirectory() {
  const { axios } = useAppContext();
  const [state, setState] = useState({ brands: [], loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState(current => ({ ...current, loading: true, error: "" }));
      try {
        const { data } = await axios.get("/api/products/brands", { signal: controller.signal });
        if (!data.success || !Array.isArray(data.brands)) throw new Error(data.message || "Không thể tải thương hiệu");
        if (!controller.signal.aborted) setState({ brands: data.brands, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: error.response?.data?.message || "Không thể tải danh sách thương hiệu" }));
      }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [axios, attempt]);
  return { ...state, reload };
}
