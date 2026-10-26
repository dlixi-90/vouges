import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import { formatThousandsVnd } from "../utils/money";
import ProductImage from "./ProductImage";

const Item = ({ product }) => {
  const { currency, storeResources } = useAppContext();
  const prefetchTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(prefetchTimer.current), []);
  const prefetchProduct = () => {
    void import("../pages/ProductDetail").catch(() => {});
    void storeResources.loadReviews(product._id).catch(() => {});
  };
  const availableSizes = getAvailableSizes(product);
  const isAvailable = availableSizes.length > 0;
  const size = availableSizes[0] ?? null;
  const colors = ["#f2f2f2", "#f6f9f6", "#f6f8fe"];
  const bgcolor =
    colors[parseInt(product._id?.slice(-4) || "0", 16) % colors.length];

  const displayedPrice = size
    ? product.price?.[size]
    : Math.min(...Object.values(product.price ?? {}).map(Number));

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
        <p className="net-product-price">{formatThousandsVnd(displayedPrice, currency)}</p>
      </div>
    </Link>
  );
};

export default Item;
