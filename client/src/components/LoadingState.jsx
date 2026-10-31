import "./loading-state.css";

export function LoadingStatus({ active = true, label = "Đang tải…", className = "" }) {
  if (!active) return null;
  return <span role="status" aria-live="polite" className={`loading-status ${className}`}><span className="loading-status-dot" aria-hidden="true" />{label}</span>;
}

export function ProductCardSkeleton() {
  return <div className="net-product-card product-card-skeleton" aria-hidden="true">
    <div className="net-product-media skeleton-surface" />
    <div className="net-product-info"><p className="net-product-category"><span className="skeleton-line short" /></p><h5><span className="skeleton-line" /><span className="skeleton-line" /></h5><p className="net-product-price"><span className="skeleton-line" /></p></div>
  </div>;
}

export function ProductGridSkeleton({ count = 6, carousel = false }) {
  const cards = Array.from({ length: count }, (_, index) => <ProductCardSkeleton key={index} />);
  return carousel ? <div className="product-loading-carousel" aria-busy="true" aria-label="Đang tải sản phẩm">{cards}</div> : cards;
}

export function PageSkeleton({ compact = false, label = "Đang tải nội dung…" }) {
  return <section className={`page-skeleton ${compact ? "compact" : "max-padd-container"}`} aria-busy="true" aria-label={label}>
    <div aria-hidden="true"><span className="skeleton-line short" /><span className="skeleton-line heading" /><div className="page-skeleton-panels"><div className="skeleton-surface" /><div className="skeleton-surface" /></div></div>
    <LoadingStatus label={label} />
  </section>;
}

export function ProductDetailSkeleton() {
  return <section className="detail-skeleton max-padd-container" aria-busy="true" aria-label="Đang tải sản phẩm">
    <div className="skeleton-surface detail-skeleton-image" aria-hidden="true" />
    <div aria-hidden="true"><span className="skeleton-line short" /><span className="skeleton-line heading" /><span className="skeleton-line" /><span className="skeleton-line price" /><div className="skeleton-surface detail-skeleton-options" /><span className="skeleton-line" /></div>
    <LoadingStatus label="Đang tải sản phẩm…" />
  </section>;
}
