import { memo, useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import ProductCard from "./ProductCard";

const Item = ({ product, priority = false }) => {
  const { currency, publicCatalog } = useAppContext();
  const prefetchTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(prefetchTimer.current), []);
  const prefetchProduct = () => {
    void import("../pages/ProductDetail").catch(() => {});
    void publicCatalog.detail(product._id).catch(() => {});
    void publicCatalog.related?.(product._id).catch(() => {});
  };
  const availableSizes = getAvailableSizes(product);
  const isAvailable = availableSizes.length > 0;

  return (
    <ProductCard product={product} priority={priority} currency={currency} isAvailable={isAvailable}
      onPointerDown={prefetchProduct}
      onFocus={prefetchProduct}
      onMouseEnter={() => {
        prefetchTimer.current = window.setTimeout(prefetchProduct, 80);
      }}
      onMouseLeave={() => window.clearTimeout(prefetchTimer.current)}
      onClick={(event) => {
        if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }
      }}
    />
  );
};

export default memo(Item);
