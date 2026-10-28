import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import { formatVnd } from "../utils/money";
import { getProductPriceRange } from "../utils/productPrice";
import ProductImage from "./ProductImage";

const Item = ({ product }) => {
  const { currency, storeResources, publicCatalog } = useAppContext();
  const prefetchTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(prefetchTimer.current), []);
  const prefetchProduct = () => {
    void import("../pages/ProductDetail").catch(() => {});
    void publicCatalog.detail(product._id).catch(() => {});
    void storeResources.loadReviews(product._id).catch(() => {});
  };
  const availableSizes = getAvailableSizes(product);
  const isAvailable = availableSizes.length > 0;
  const colors = ["#f2f2f2", "#f6f9f6", "#f6f8fe"];
  const bgcolor =
    colors[parseInt(product._id?.slice(-4) || "0", 16) % colors.length];

  const priceRange = getProductPriceRange(product);

  return (
    <Link
      to={`/collection/${product._id}`}
      aria-label={`Xem chi tiết ${product.title}`}
      onFocus={prefetchProduct}
      onMouseEnter={() => {
        prefetchTimer.current = window.setTimeout(prefetchProduct, 200);
      }}
      onMouseLeave={() => window.clearTimeout(prefetchTimer.current)}
      onClick={(event) => {
        if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }
      }}
      className="net-product-card block relative overflow-hidden"
    >
      {/* Image */}
      <div
        className="net-product-media flexCenter relative w-full"
        style={{ backgroundColor: bgcolor }}
      >
        <ProductImage
          src={product.images[0]}
          alt=""
          height={144}
          width={144}
        />
        {!isAvailable && (
          <p className="absolute left-2 top-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
            Hết hàng
          </p>
        )}
      </div>

      {/* Info */}
      <div className="net-product-info">
        <p className="net-product-category line-clamp-1">{product.category || product.type}</p>
        <h5 className="line-clamp-2 uppercase">{product.title}</h5>
        <p className="net-product-price">{priceRange ? <>
          <span className="whitespace-nowrap">{formatVnd(priceRange.min, currency)}</span>
          {priceRange.min !== priceRange.max && <> - <span className="whitespace-nowrap">{formatVnd(priceRange.max, currency)}</span></>}
        </> : "Chưa có giá"}</p>
      </div>
    </Link>
  );
};

export default Item;
