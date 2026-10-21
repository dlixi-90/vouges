import { getOrderStatusLabel, getPaymentMethodLabel, translateCatalogText } from "../utils/localization.js";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Package, Star } from "lucide-react";
import Title from "../components/Title";
import { useAppContext } from "../context/AppContext";
import { formatThousandsVnd } from "../utils/money";
import { SHIPPING_METHODS, URGENT_SHIPPING_NOTE } from "../utils/orderPricing";

const ProductReviewDialog = lazy(() => import("../components/ProductReviewDialog"));

const MyOrders = () => {
  const { currency, user, axios, getToken } = useAppContext();
  const [orders, setOrders] = useState([]);
  const [reviewProduct, setReviewProduct] = useState(null);

  const requestOrders = useCallback(
    async () =>
      axios.post(
        "/api/orders/userorders",
        {},
        {
          headers: { Authorization: `Bearer ${await getToken()}` },
        },
      ),
    [axios, getToken],
  );

  useEffect(() => {
    if (!user) return undefined;

    let isActive = true;

    requestOrders()
      .then(({ data }) => {
        if (isActive && data.success) {
          setOrders(data.orders);
        }
      })
      .catch((error) => {
        console.log(error);
      });

    return () => {
      isActive = false;
    };
  }, [requestOrders, user]);

  return (
    <main className="net-orders max-padd-container min-h-screen bg-primary py-16 pt-28">
      <Title title1="Đơn hàng" title2="của tôi" titleStyles="pb-10" />

      <div className="space-y-4">
        {orders.map((order) => (
          <CustomerOrderCard
            key={order._id}
            order={order}
            currency={currency}
            onReview={setReviewProduct}
          />
        ))}

        {!orders.length && (
          <div className="rounded-xl border border-[#e2e7eb] bg-white py-16 text-center text-sm text-[#8b949c] shadow-sm">
            Chưa có đơn hàng nào
          </div>
        )}
      </div>
      {reviewProduct && <Suspense fallback={<p role="status" className="mt-4 text-sm">Đang mở form đánh giá…</p>}>
        <ProductReviewDialog key={`${reviewProduct.id}::${user?.id || "guest"}`} product={reviewProduct} onClose={() => setReviewProduct(null)} />
      </Suspense>}
    </main>
  );
};

const CustomerOrderCard = ({ order, currency, onReview }) => {
  const address = order.address || {};
  const items = order.items || [];
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
    <article className="overflow-hidden rounded-xl border border-[#e2e7eb] bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-[#edf0f2] bg-[#fafbfb] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b949c]">
            Đơn hàng
          </p>
          <h3
            className="mt-1 truncate font-mono text-sm font-semibold text-[#263b4a]"
            title={order._id}
          >
            #{String(order._id).slice(-8).toUpperCase()}
          </h3>
          <p className="mt-1 text-xs text-[#8b949c]">
            Đặt ngày {formattedDate}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              order.isPaid
                ? "bg-[#edf6ee] text-[#4f7f5a]"
                : "bg-[#fff5e5] text-[#a26f2c]"
            }`}
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
            <p className="mt-0.5 text-base font-semibold text-[#263b4a]">
              {formatThousandsVnd(order.amount, currency)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.75fr)]">
        <section className="p-4 sm:p-5 lg:border-r lg:border-[#edf0f2]">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#263b4a]">Sản phẩm</h4>
            <span className="text-xs text-[#8b949c]">
              {items.length} {"sản phẩm"}
            </span>
          </div>

          <div className="mt-3 divide-y divide-[#edf0f2]">
            {items.map((item, index) => {
              const product =
                item.product && typeof item.product === "object"
                  ? item.product
                  : {};
              const productImage = item.image || product.images?.[0];
              const productTitle =
                item.title || product.title || "Sản phẩm không còn có sẵn";
              const productId = product._id || (typeof item.product === "string" ? item.product : null);

              return (
                <div
                  key={item._id || index}
                  className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#edf0f2] bg-[#f7f9f8] p-1">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={productTitle}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Package size={19} className="text-[#8b949c]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#263b4a]">
                        {translateCatalogText(productTitle)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#69747e]">
                        <span className="rounded-md bg-[#f1f4f2] px-2 py-1">
                          Dung tích: <b className="text-[#263b4a]">{item.size}</b>
                        </span>
                        <span className="rounded-md bg-[#f1f4f2] px-2 py-1">
                          Số lượng: <b className="text-[#263b4a]">{item.quantity}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 space-y-3 pt-0.5 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold leading-5 text-[#263b4a]">
                      {formatThousandsVnd(
                        item.unitPrice ?? product.price?.[item.size] ?? 0,
                        currency,
                      )}
                    </p>
                    {order.status === "Delivery" && (order.paymentMethod === "COD" || order.isPaid) && productId && !product.isDeleted && (
                      <button type="button" onClick={() => onReview({ id: String(productId), title: productTitle, image: productImage, size: item.size })}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-secondary/30 bg-white px-3 py-2 text-xs font-semibold text-secondary transition hover:bg-secondary/5">
                        <Star size={14} aria-hidden="true" />Đánh giá
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="border-t border-[#edf0f2] bg-[#fcfdfc] p-4 sm:p-5 lg:border-t-0">
          <h4 className="text-sm font-semibold text-[#263b4a]">
            Thông tin khách hàng
          </h4>

          <dl className="mt-4 space-y-4">
            {order.note && <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Lời nhắn cho cửa hàng</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-[#52616b]">{order.note}</dd>
            </div>}
            {order.shipping !== undefined && <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Giao hàng</dt>
              <dd className="mt-1 text-sm">{SHIPPING_METHODS.find((method) => method.id === order.shippingMethod)?.label || "Giao tiêu chuẩn"} · {order.shippingMethod === "urgent" ? "Thanh toán sau" : formatThousandsVnd(order.shipping, currency)}</dd>
              {order.shippingMethod === "urgent" && <dd className="mt-1 text-xs text-gray-500">{URGENT_SHIPPING_NOTE}</dd>}
            </div>}
            {order.discount > 0 && <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Mã giảm giá {order.voucherCode}</dt>
              <dd className="mt-1 text-sm text-green-700">−{formatThousandsVnd(order.discount, currency)}</dd>
            </div>}
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
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Địa chỉ giao hàng
              </dt>
              <dd className="mt-1 text-sm leading-5 text-[#52616b]">
                {fullAddress || "—"}
              </dd>
            </div>
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
          </dl>
        </aside>
      </div>

      <footer className="flex items-center justify-end gap-3 border-t border-[#edf0f2] bg-[#fafbfb] px-4 py-3 sm:px-5">
        <span className="text-xs font-medium text-[#69747e]">Trạng thái đơn hàng</span>
        <span className="inline-flex items-center gap-2 rounded-md border border-[#dfe5e8] bg-white px-3 py-2 text-xs font-semibold text-[#263b4a]">
          <i className="h-2 w-2 rounded-full bg-[#78a782]" />
          {getOrderStatusLabel(order.status)}
        </span>
      </footer>
    </article>
  );
};

export default MyOrders;
