import { useEffect } from "react";
import { useAppContext } from "../context/AppContext";

// Both screens consume the same state and refresh policy.
export const usePopularProducts = () => {
  const {
    popularProducts,
    popularProductsError,
    popularProductsLoading,
    fetchPopularProducts,
  } = useAppContext();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") fetchPopularProducts();
    };
    const initialRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 120000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchPopularProducts]);

  return {
    popularProducts,
    popularProductsError,
    popularProductsLoading,
    fetchPopularProducts,
  };
};
