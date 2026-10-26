import { getSizeImage } from "../../utils/productImage";
import { getOrderStatusLabel, getPaymentMethodLabel } from "../../utils/localization.js";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Banknote, Package, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { formatVnd } from "../../utils/money";
import { usePopularProducts } from "../../hooks/usePopularProducts";
import ProductImage from "../../components/ProductImage";

const RevenueChart = lazy(() => import("../../components/owner/RevenueChart"));
const DASHBOARD_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const ORDER_STATUSES = ["Order Placed", "Packing", "Shipping", "Delivery"];

const Dashboard = () => {
  const { authenticatedUserId: userId, currency, axios, getToken, dashboardCache } = useAppContext();
  const {
    popularProducts,
    popularProductsLoading,
    popularProductsError,
    fetchPopularProducts,
  } = usePopularProducts();
  const [page, setPage] = useState(1);
  const cacheKey = `${userId}:${DASHBOARD_TIMEZONE}:${page}`;
  const [dashboardData, setDashboardData] = useState(() => dashboardCache.peek(cacheKey) || {
    orders: [],
    totalOrders: null,
    totalRevenue: null,
    monthlyData: [],
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(() => !dashboardCache.peek(cacheKey));
  const [loadError, setLoadError] = useState("");
  const requestIdRef = useRef(0);
  const [updatingOrderIds, setUpdatingOrderIds] = useState([]);

  const requestDashboardData = useCallback(async (signal) => {
    const token = await getToken();
    signal.throwIfAborted();
    const { data } = await axios.get("/api/orders/dashboard", {
      params: { page, pageSize: 10, timezone: DASHBOARD_TIMEZONE },
      headers: { Authorization: `Bearer ${token}` },
      signal,
      timeout: 15000,
    });

    if (!data.success) {
      throw new Error(data.message || "Không thể tải dữ liệu tổng quan");
    }

    return data.dashboardData;
  }, [axios, getToken, page]);

  const getDashboardData = useCallback(async ({ background = false, force = false } = {}) => {
    const requestId = ++requestIdRef.current;
    const cached = dashboardCache.peek(cacheKey);
    if (cached) setDashboardData(cached);
    if (!background) setIsLoading(!cached);
    setLoadError("");
    try {
      const data = await dashboardCache.load(cacheKey, requestDashboardData, { force });
      if (requestId === requestIdRef.current) setDashboardData(data);
    } catch (error) {
      if (requestId === requestIdRef.current && error.name !== "AbortError" && error.code !== "ERR_CANCELED") {
        setLoadError(error.response?.data?.message || error.message);
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [requestDashboardData, dashboardCache, cacheKey]);

  const statusHandler = async (event, orderId) => {
    const status = event.target.value;
    const order = dashboardData.orders.find((item) => item._id === orderId);
    const currentStep = ORDER_STATUSES.indexOf(order?.status);
    if (
      updatingOrderIds.includes(orderId) ||
      currentStep < 0 ||
      ORDER_STATUSES.indexOf(status) <= currentStep
    ) return;

    setUpdatingOrderIds((current) => [...current, orderId]);
    try {
      const { data } = await axios.post(
        "/api/orders/status",
        { orderId, status },
        {
          headers: { Authorization: `Bearer ${await getToken()}` },
        },
      );

      if (data.success) {
        dashboardCache.updateOrder({ ...data.order, _id: orderId });
        setDashboardData((current) => ({
          ...current,
          orders: current.orders.map((item) => item._id === orderId
            ? { ...item, status: data.order.status, isPaid: data.order.isPaid, paidAt: data.order.paidAt }
            : item),
        }));
        toast.success(data.message);
        // Keep the confirmed order visible while updating revenue and sales.
        void getDashboardData({ background: true, force: true });
        void fetchPopularProducts();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || error.message);
      if (error.response?.status === 409) await getDashboardData({ background: true, force: true });
    } finally {
      setUpdatingOrderIds((current) => current.filter((id) => id !== orderId));
    }
  };

  useEffect(() => {
    if (!userId) return undefined;
    const timer = window.setTimeout(getDashboardData, 0);
    const refresh = () => {
      if (document.visibilityState === "visible") void getDashboardData({ background: true });
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      requestIdRef.current += 1;
    };
  }, [getDashboardData, userId]);

  const orders = dashboardData.orders || [];

  return (
    <main className="m-1 h-[97vh] overflow-y-auto rounded-xl bg-primary px-3 py-6 shadow sm:m-3 sm:px-5 md:px-8 lg:w-11/12 xl:py-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#e1e6e3] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#6f9a79]">
              Velours / Không gian quản lý
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#263b4a] sm:text-3xl">
              Đơn hàng & doanh thu
            </h1>
          </div>
        </header>

        <div className="inessa-dashboard-metrics">
          <div className="inessa-dashboard-metric">
            <div><p>Tổng doanh thu</p><strong>{dashboardData.totalRevenue === null ? "—" : formatVnd(dashboardData.totalRevenue, currency)}</strong></div>
            <span><Banknote size={21} strokeWidth={1.3} aria-hidden="true" /></span>
          </div>
          <div className="inessa-dashboard-metric">
            <div><p>Tổng đơn hàng</p><strong>{dashboardData.totalOrders ?? "—"}</strong></div>
            <span><ShoppingBag size={21} strokeWidth={1.3} aria-hidden="true" /></span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DashboardCard className="xl:col-span-2">
            <div className="flex w-full items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-[#263b4a]">
                Tổng doanh thu
              </h2>

              <p className="text-xl font-medium text-black">
                {dashboardData.totalRevenue === null ? "—" : formatVnd(dashboardData.totalRevenue, currency)}
              </p>
            </div>
            <div className="mt-4 h-[360px] min-h-[360px] min-w-0 w-full">
              <Suspense fallback={<EmptyState text="Đang tải biểu đồ…" />}>
                <RevenueChart data={dashboardData.monthlyData} currency={currency} />
              </Suspense>
            </div>
          </DashboardCard>

          <DashboardCard>
            <CardTitle title="Sản phẩm bán chạy" />
            {popularProductsError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {popularProductsError}{" "}
                <button type="button" onClick={fetchPopularProducts} className="underline">
                  Thử lại
                </button>
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {popularProducts.slice(0, 4).map((product) => (
                <div
                  key={product._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#edf0f2] p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f2f5f3]">
                      {product.images?.[0] ? (
                        <ProductImage
                          src={product.images[0]}
                          imageWidth={100}
                          alt={product.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Package size={16} className="text-[#8b949c]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#263b4a]">
                        {product.title}
                      </p>
                      <p className="text-xs text-[#8b949c]">
                        {product.soldQuantity} đã bán
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {popularProductsLoading && <p role="status">Đang tải sản phẩm bán chạy…</p>}
              {!popularProductsLoading && !popularProductsError && !popularProducts.length && (
                <EmptyState text="Chưa có sản phẩm nào được bán" />
              )}
            </div>
          </DashboardCard>
        </div>

        <section className="mt-4 rounded-xl border border-[#e2e7eb] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-[#edf0f2] pb-4">
            <div>
              <h2 className="text-lg font-medium text-[#263b4a]">
                Tất cả đơn hàng
              </h2>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-medium text-[#50745a]">
              {dashboardData.totalOrders ?? "—"} đơn hàng
            </span>
          </div>

          <div className="space-y-4">
            {loadError && (
              <p role="alert" className="text-sm text-red-600">
                {loadError} <button type="button" onClick={() => getDashboardData({ force: true })} className="underline">Thử lại</button>
              </p>
            )}
            {isLoading && <p role="status" className="py-8 text-center text-sm text-[#8b949c]">Đang tải đơn hàng…</p>}
            {!isLoading && dashboardData.page === page && orders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                currency={currency}
                onStatusChange={statusHandler}
                updating={updatingOrderIds.includes(order._id)}
              />
            ))}
            {!isLoading && !loadError && !orders.length && <EmptyState text="Chưa có đơn hàng nào" />}
          </div>
          {dashboardData.totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4 text-sm">
              <button type="button" disabled={isLoading || updatingOrderIds.length > 0 || page <= 1} onClick={() => setPage((current) => current - 1)} className="btn-light !px-4 !py-2 disabled:opacity-40">Trước</button>
              <span>Trang {page} / {dashboardData.totalPages}</span>
              <button type="button" disabled={isLoading || updatingOrderIds.length > 0 || page >= dashboardData.totalPages} onClick={() => setPage((current) => current + 1)} className="btn-secondary !px-4 !py-2 disabled:opacity-40">Tiếp</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

const OrderCard = ({ order, currency, onStatusChange, updating }) => {
  const currentStep = ORDER_STATUSES.indexOf(order.status);
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
    <article className="net-order-card overflow-hidden rounded-xl border bg-white">
      <header className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="net-order-label text-[11px] font-semibold uppercase tracking-[0.14em]">
            Đơn hàng
          </p>
          <h3
            className="net-order-number mt-1 truncate font-mono text-sm font-semibold"
            title={order._id}
          >
            #{String(order._id).slice(-8).toUpperCase()}
          </h3>
          <p className="net-order-meta mt-1 text-xs">
            Đặt ngày {formattedDate}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span
            className="net-order-payment rounded-full px-2.5 py-1 text-xs font-medium"
            data-payment-state={order.isPaid ? "paid" : order.paymentMethod === "COD" ? "cod" : "pending"}
          >
            {order.isPaid
              ? "Đã thanh toán"
              : order.paymentMethod === "COD"
                ? "Thanh toán khi nhận hàng"
                : "Chờ thanh toán"}
          </span>
          <div className="text-right">
            <p className="net-order-label text-[11px] uppercase tracking-wide">
              Tổng cộng
            </p>
            <p className="net-order-total mt-0.5 font-semibold">
              {formatVnd(order.amount, currency)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.75fr)]">
        <section className="net-order-products p-4 sm:p-5 lg:border-r">
          <div className="flex items-center justify-between">
            <h4 className="net-order-heading text-sm font-semibold">Sản phẩm</h4>
            <span className="net-order-meta text-xs">
              {items.length} {"sản phẩm"}
            </span>
          </div>

          <div className="net-order-items mt-3 divide-y">
            {items.map((item, index) => {
              const product =
                item.product && typeof item.product === "object"
                  ? item.product
                  : {};
              const productImage = item.image || getSizeImage(product, item.size);
              const productTitle =
                item.title || product.title || "Sản phẩm không còn có sẵn";

              return (
                <div
                  key={item._id || index}
                  className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                >
                  {/* LEFT: Product */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="net-order-thumbnail flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border p-1">
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

                    <div className="min-w-0">
                      <p className="net-order-heading truncate text-sm font-semibold">
                        {productTitle}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#69747e]">
                        <span className="net-order-variant rounded-md px-2 py-1">
                          Dung tích: <b className="text-[#263b4a]">{item.size}</b>
                        </span>

                        <span className="net-order-variant rounded-md px-2 py-1">
                          Số lượng: <b className="text-[#263b4a]">{item.quantity}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Price */}
                  <div className="shrink-0 pt-0.5 text-right">
                    <p className="net-order-heading whitespace-nowrap text-sm font-semibold leading-5">
                      {formatVnd(
                        item.unitPrice ?? product.price?.[item.size] ?? 0,
                        currency,
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="net-order-customer border-t p-4 sm:p-5 lg:border-t-0">
          <h4 className="net-order-heading text-sm font-semibold">
            Thông tin khách hàng
          </h4>

          <dl className="mt-4 space-y-4">
            {order.note && <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">Lời nhắn cho cửa hàng</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-[#52616b]">{order.note}</dd>
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

      <footer className="net-order-actions flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
        <label
          htmlFor={`status-${order._id}`}
          className="net-order-meta text-xs font-medium"
        >
          Trạng thái đơn hàng
        </label>
        <select
          id={`status-${order._id}`}
          onChange={(event) => onStatusChange(event, order._id)}
          value={order.status}
          disabled={updating || currentStep < 0 || currentStep === ORDER_STATUSES.length - 1}
          aria-busy={updating}
          className="net-order-status w-full rounded-md border px-3 py-2 text-xs font-semibold outline-none transition disabled:cursor-not-allowed sm:w-40"
        >
          {!ORDER_STATUSES.includes(order.status) && (
            <option value={order.status}>{getOrderStatusLabel(order.status)}</option>
          )}
          {ORDER_STATUSES.map((status, index) => (
            <option key={status} value={status} disabled={index < currentStep}>
              {getOrderStatusLabel(status)}
            </option>
          ))}
        </select>
      </footer>
    </article>
  );
};

const DashboardCard = ({ children, className = "" }) => (
  <section
    className={`min-w-0 rounded-xl border border-[#e2e7eb] bg-white p-4 shadow-sm sm:p-5 ${className}`}
  >
    {children}
  </section>
);

const CardTitle = ({ title, description }) => (
  <div>
    <h2 className="text-lg font-medium text-[#263b4a]">{title}</h2>
    {description && (
      <p className="mt-1 text-xs font-medium text-[#8b949c]">{description}</p>
    )}
  </div>
);

const EmptyState = ({ text }) => (
  <div className="py-8 text-center text-sm text-[#8b949c]">{text}</div>
);

export default Dashboard;
