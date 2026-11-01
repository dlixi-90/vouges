import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { formatVnd } from "../utils/money";
import { getProductPriceRange } from "../utils/productPrice";
import ProductImage from "./ProductImage";

export default function ProductCard({ product, priority = false, currency = "₫", priceRange = getProductPriceRange(product), isAvailable = true, pricePending = false, ...linkProps }) {
  const image = product.images?.[0] || product.image;
  return <Link {...linkProps} to={product.url || `/collection/${product._id || product.id}`}
    aria-label={`Xem chi tiết ${product.title}`} className="net-product-card">
    <div className="net-product-media">
      {image ? <ProductImage src={image} alt="" height={320} width={320}
        loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
        : <Package size={48} strokeWidth={1} aria-hidden="true" />}
      {!isAvailable && <p className="net-product-stock">Hết hàng</p>}
    </div>
    <div className="net-product-info">
      <p className="net-product-category">{product.category || product.type}</p>
      <h5>{product.title}</h5>
      <p className="net-product-price">{pricePending ? "Đang tải giá…" : priceRange ? <>
        <span>{formatVnd(priceRange.min, currency)}</span>
        {priceRange.min !== priceRange.max && <> - <span>{formatVnd(priceRange.max, currency)}</span></>}
      </> : "Chưa có giá"}</p>
    </div>
  </Link>;
}
