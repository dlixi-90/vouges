import { getSizeImage } from "../utils/productImage";
import { getOrderStatusLabel, getPaymentMethodLabel } from "../utils/localization.js";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { prefetchRoute } from "../utils/prefetchRoute";
import { ChevronDown, ChevronUp, Package, Star } from "lucide-react";
import { Link } from "react-router-dom";
import StorePageHeading from "../components/StorePageHeading";
import { useAppContext } from "../context/AppContext";
import { formatVnd } from "../utils/money";
import { SHIPPING_METHODS, URGENT_SHIPPING_NOTE } from "../utils/orderPricing";
import Pagination from "../components/Pagination";
import usePaginationScroll from "../hooks/usePaginationScroll";
import ProductImage from "../components/ProductImage";
import useCachedResource from "../hooks/useCachedResource";
import { LoadingStatus, PageSkeleton } from "../components/LoadingState";

const ProductReviewDialog = lazy(() => import("../components/ProductReviewDialog"));
const ORDER_ITEMS_PREVIEW = 2;

const MyOrders = () => {
  const { currency, user, storeResources, accountLoading } = useAppContext();
  const [page,setPage] = useState(1);
  const userId = user?.id;
  const resource = useMemo(() => userId ? {
    peek: () => storeResources.peekOrders(page),
    load: options => storeResources.loadOrders(page, options),
  } : null, [storeResources, userId, page]);
  const { data, loading: requestLoading, initialLoading, updating, error, reload } = useCachedResource(resource, { scope: `orders:${userId}`, keepPrevious: true });
  const loading = requestLoading || accountLoading;
  const orders = accountLoading ? [] : data?.orders || [];
  const {listRef,changePage} = usePaginationScroll({page,onPageChange:setPage,ready:!loading && data?.page===page});
  const [reviewProduct, setReviewProduct] = useState(null);
  useEffect(() => {
    if (userId && data?.totalPages > page) {
      void storeResources.loadOrders(page + 1).catch(() => {});
    }
  }, [userId, page, data?.totalPages, storeResources]);

  return (
    <main className="net-orders store-account-page store-page-container max-padd-container">
      <StorePageHeading title="Đơn hàng của tôi" />

      <div ref={listRef} tabIndex={-1} className="pagination-list-start store-orders-list" aria-busy={loading}>
        {(initialLoading || accountLoading) && <PageSkeleton compact label="Đang tải đơn hàng…" />}
        <LoadingStatus active={updating} label="Đang cập nhật đơn hàng…" />
        {error && <p role="alert">{error} <button type="button" className="underline" onClick={reload}>Thử lại</button></p>}
        {orders.map((order) => (
          <CustomerOrderCard
            key={order._id}
            order={order}
            currency={currency}
            onReview={setReviewProduct}
          />
        ))}

        {!loading && !error && !orders.length && (
          <div className="store-page-empty">
            <Package size={32} strokeWidth={1.3} aria-hidden="true" />
            <h2>Chưa có đơn hàng nào</h2>
            <Link to="/collection" className="btn-outline">Khám phá bộ sưu tập</Link>
          </div>
        )}
      </div>
      <Pagination className="mt-8" label="Phân trang đơn hàng của tôi" page={page} totalPages={data?.totalPages} onPageChange={changePage} disabled={loading} />
      {reviewProduct && <Suspense fallback={<p role="status" className="mt-4 text-sm">Đang mở form đánh giá…</p>}>
        <ProductReviewDialog key={`${reviewProduct.id}::${user?.id || "guest"}`} product={reviewProduct} onClose={() => setReviewProduct(null)} />
      </Suspense>}
    </main>
  );
};

const CustomerOrderCard = ({ order, currency, onReview }) => {
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const itemsRef = useRef(null);
  const address = order.address || {};
  const items = order.items || [];
  const visibleItems = itemsExpanded ? items : items.slice(0, ORDER_ITEMS_PREVIEW);
  const itemsId = `customer-order-items-${order._id}`;
  const quantity = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  const customerName = [address.firstName, address.lastName]
    .filter(Boolean)
    .join(" ");
  const fullAddress = [
    address.street,
    address.state,
    address.city,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
  const zipcode = address.zipcode || address.zipCode || "—";
  const createdAt = new Date(order.createdAt);
  const formattedDate = Number.isNaN(createdAt.getTime())
    ? "—"
    : createdAt.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return (
    <article className="store-order-card overflow-hidden rounded-xl border border-[#e2e7eb] bg-white shadow-sm">
      <header className="store-order-card-heading flex flex-col gap-3 border-b border-[#edf0f2] bg-[#fafbfb] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="store-order-reference">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b949c]">
            Đơn hàng
          </p>
          <h3
            className="store-order-id mt-1 truncate font-mono text-sm font-semibold text-[#263b4a]"
            title={order._id}
          >
            #{String(order._id).slice(-8).toUpperCase()}
          </h3>
          <p className="mt-1 text-xs text-[#8b949c]">
            Đặt ngày {formattedDate}
          </p>
        </div>

        <div className="store-order-summary">
          <span
            className="store-order-payment-status rounded-full px-2.5 py-1 text-xs font-semibold"
            data-payment-state={order.isPaid ? "paid" : order.paymentMethod === "COD" ? "cod" : "pending"}
          >
            {order.isPaid
              ? "Đã thanh toán"
              : order.paymentMethod === "COD"
                ? "Thanh toán khi nhận hàng"
                : "Chờ thanh toán"}
          </span>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-[#8b949c]">
              Tổng cộng
            </p>
            <p className="mt-0.5 whitespace-nowrap text-base font-semibold text-[#263b4a]">
              {formatVnd(order.amount, currency)}
            </p>
          </div>
        </div>
      </header>

      <div className="store-order-body">
        <section className="store-order-products">
          <div className="store-order-products-heading">
            <h4 className="text-sm font-semibold text-[#263b4a]">Sản phẩm</h4>
            <span className="text-xs text-[#8b949c]">
              {items.length} mặt hàng · {quantity} sản phẩm
            </span>
          </div>

          <div
            id={itemsId}
            ref={itemsRef}
            className={`store-order-items${itemsExpanded ? " is-expanded" : ""}`}
            tabIndex={itemsExpanded ? 0 : undefined}
            role={itemsExpanded ? "region" : undefined}
            aria-label={itemsExpanded ? `Sản phẩm trong đơn hàng #${String(order._id).slice(-8).toUpperCase()}` : undefined}
          >
            {visibleItems.map((item, index) => {
              const product =
                item.product && typeof item.product === "object"
                  ? item.product
                  : {};
              const productImage = item.image || getSizeImage(product, item.size);
              const productTitle =
                item.title || product.title || "Sản phẩm không còn có sẵn";
              const productId = product._id || (typeof item.product === "string" ? item.product : null);

              return (
                <div
                  key={item._id || index}
                  className="store-order-item"
                >
                  <div className="store-order-thumbnail">
                    {productImage ? (
                      <ProductImage
                        src={productImage}
                        imageWidth={160}
                        alt={productTitle}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Package size={19} className="text-[#8b949c]" />
                    )}
                  </div>

                  <div className="store-order-item-info">
                    <p className="store-order-item-title">
                      {productTitle}
                    </p>
                    <div className="store-order-item-meta">
                      <span>
                        Dung tích: <b>{item.size || "—"}</b>
                      </span>
                      <span>
                        Số lượng: <b>{item.quantity}</b>
                      </span>
                    </div>
                  </div>

                  <div className="store-order-item-actions">
                    <p className="store-order-item-price">
                      {formatVnd(
                        item.unitPrice ?? product.price?.[item.size] ?? 0,
                        currency,
                      )}
                    </p>
                    {order.status === "Delivery" && (order.paymentMethod === "COD" || order.isPaid) && productId && !product.isDeleted && (
                      <button type="button" onClick={() => onReview({ id: String(productId), title: productTitle, image: productImage, size: item.size })}
                        className="store-order-review">
                        <Star size={14} aria-hidden="true" />Đánh giá
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {items.length > ORDER_ITEMS_PREVIEW && <div className="store-order-items-footer">
            <span>Hiển thị {visibleItems.length}/{items.length} mặt hàng</span>
            <button type="button" className="store-order-items-toggle" aria-expanded={itemsExpanded} aria-controls={itemsId} onClick={() => {
              if (itemsRef.current) itemsRef.current.scrollTop = 0;
              setItemsExpanded(expanded => !expanded);
            }}>
              {itemsExpanded ? "Thu gọn danh sách" : `Xem thêm ${items.length - ORDER_ITEMS_PREVIEW} mặt hàng`}
              {itemsExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            </button>
          </div>}
        </section>

        <aside className="store-order-customer">
          <h4 className="text-sm font-semibold text-[#263b4a]">
            Thông tin khách hàng
          </h4>

          <dl className="store-order-details">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Khách hàng
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#263b4a]">
                {customerName || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Số điện thoại
              </dt>
              <dd className="mt-1 text-sm text-[#52616b]">
                {address.phone || "—"}
              </dd>
            </div>
            <div className="store-order-detail-full">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Địa chỉ giao hàng
              </dt>
              <dd className="mt-1 text-sm leading-5 text-[#52616b]">
                {fullAddress || "—"}
              </dd>
            </div>
            {order.shipping !== undefined && <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Giao hàng</dt>
              <dd className="mt-1 text-sm">{SHIPPING_METHODS.find((method) => method.id === order.shippingMethod)?.label || "Giao tiêu chuẩn"} · {order.shippingMethod === "urgent" ? "Thanh toán sau" : formatVnd(order.shipping, currency)}</dd>
              {order.shippingMethod === "urgent" && <dd className="mt-1 text-xs text-gray-500">{URGENT_SHIPPING_NOTE}</dd>}
            </div>}
            {order.discount > 0 && <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Mã giảm giá {order.voucherCode}</dt>
              <dd className="mt-1 text-sm text-green-700">−{formatVnd(order.discount, currency)}</dd>
            </div>}
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Mã bưu chính
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#263b4a]">
                {zipcode}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Phương thức thanh toán
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#263b4a]">
                {getPaymentMethodLabel(order.paymentMethod)}
              </dd>
            </div>
            {order.note && <div className="store-order-detail-full">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Lời nhắn cho cửa hàng</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-[#52616b]">{order.note}</dd>
            </div>}
          </dl>
        </aside>
      </div>

      <footer className="store-order-card-footer flex flex-wrap items-center justify-end gap-3 border-t border-[#edf0f2] bg-[#fafbfb] px-4 py-3 sm:px-5">
        <Link to={`/order-overview/${order._id}`} state={{ initialOrder: order }} onPointerEnter={() => prefetchRoute(`/order-overview/${order._id}`)} onFocus={() => prefetchRoute(`/order-overview/${order._id}`)} className="inessa-order-overview-link" aria-label={`Xem tổng quan đơn hàng ${String(order._id).slice(-8).toUpperCase()}`}>Xem tổng quan đơn hàng →</Link>
        <span className="text-xs font-medium text-[#69747e]">Trạng thái đơn hàng</span>
        <span className="store-order-status" data-order-status={order.status}>
          {getOrderStatusLabel(order.status)}
        </span>
      </footer>
    </article>
  );
};

export default MyOrders;
