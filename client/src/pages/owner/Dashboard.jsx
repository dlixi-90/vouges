import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Package } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { formatThousandsVnd } from "../../utils/money";
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
      throw new Error(data.message || "Unable to load dashboard data");
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
              Overview
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#263b4a] sm:text-3xl">
              Dashboard
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DashboardCard className="xl:col-span-2">
            <div className="flex w-full items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-[#263b4a]">
                Total Revenue
              </h2>

              <p className="text-xl font-medium text-black">
                {dashboardData.totalRevenue === null ? "—" : formatThousandsVnd(dashboardData.totalRevenue, currency)}
              </p>
            </div>
            <div className="mt-4 h-[360px] min-h-[360px] min-w-0 w-full">
              <Suspense fallback={<EmptyState text="Loading chart..." />}>
                <RevenueChart data={dashboardData.monthlyData} currency={currency} />
              </Suspense>
            </div>
          </DashboardCard>

          <DashboardCard>
            <CardTitle title="Popular Products" />
            <p className="mt-2 text-xs text-[#8b949c]">Top 4 by units sold · All time</p>
            {popularProductsError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {popularProductsError}{" "}
                <button type="button" onClick={fetchPopularProducts} className="underline">
                  Retry
                </button>
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {popularProducts.map((product) => (
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
                        {product.soldQuantity} sold
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {popularProductsLoading && <p role="status">Loading popular products...</p>}
              {!popularProductsLoading && !popularProductsError && !popularProducts.length && (
                <EmptyState text="No sales yet" />
              )}
            </div>
          </DashboardCard>
        </div>

        <section className="mt-4 rounded-xl border border-[#e2e7eb] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-[#edf0f2] pb-4">
            <div>
              <h2 className="text-lg font-medium text-[#263b4a]">
                All Orders / Sales
              </h2>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-medium text-[#50745a]">
              {dashboardData.totalOrders ?? "—"} total
            </span>
          </div>

          <div className="space-y-4">
            {loadError && (
              <p role="alert" className="text-sm text-red-600">
                {loadError} <button type="button" onClick={() => getDashboardData({ force: true })} className="underline">Retry</button>
              </p>
            )}
            {isLoading && <p role="status" className="py-8 text-center text-sm text-[#8b949c]">Loading orders...</p>}
            {!isLoading && dashboardData.page === page && orders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                currency={currency}
                onStatusChange={statusHandler}
                updating={updatingOrderIds.includes(order._id)}
              />
            ))}
            {!isLoading && !loadError && !orders.length && <EmptyState text="No orders found" />}
          </div>
          {dashboardData.totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4 text-sm">
              <button type="button" disabled={isLoading || updatingOrderIds.length > 0 || page <= 1} onClick={() => setPage((current) => current - 1)} className="btn-light !px-4 !py-2 disabled:opacity-40">Previous</button>
              <span>Page {page} / {dashboardData.totalPages}</span>
              <button type="button" disabled={isLoading || updatingOrderIds.length > 0 || page >= dashboardData.totalPages} onClick={() => setPage((current) => current + 1)} className="btn-secondary !px-4 !py-2 disabled:opacity-40">Next</button>
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
    <article className="overflow-hidden rounded-xl border border-[#e2e7eb] bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-[#edf0f2] bg-[#fafbfb] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b949c]">
            Order
          </p>
          <h3
            className="mt-1 truncate font-mono text-sm font-semibold text-[#263b4a]"
            title={order._id}
          >
            #{String(order._id).slice(-8).toUpperCase()}
          </h3>
          <p className="mt-1 text-xs text-[#8b949c]">
            Placed on {formattedDate}
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
              ? "Paid"
              : order.paymentMethod === "COD"
                ? "Pay on delivery"
                : "Pending"}
          </span>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-[#8b949c]">
              Total
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
            <h4 className="text-sm font-semibold text-[#263b4a]">Products</h4>
            <span className="text-xs text-[#8b949c]">
              {items.length} {items.length === 1 ? "item" : "items"}
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
                item.title || product.title || "Unavailable product";

              return (
                <div
                  key={item._id || index}
                  className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                >
                  {/* LEFT: Product */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#edf0f2] bg-[#f7f9f8] p-1">
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
                      <p className="truncate text-sm font-semibold text-[#263b4a]">
                        {productTitle}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#69747e]">
                        <span className="rounded-md bg-[#f1f4f2] px-2 py-1">
                          Size: <b className="text-[#263b4a]">{item.size}</b>
                        </span>

                        <span className="rounded-md bg-[#f1f4f2] px-2 py-1">
                          Qty: <b className="text-[#263b4a]">{item.quantity}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Price */}
                  <div className="shrink-0 pt-0.5 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold leading-5 text-[#263b4a]">
                      {formatThousandsVnd(
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

        <aside className="border-t border-[#edf0f2] bg-[#fcfdfc] p-4 sm:p-5 lg:border-t-0">
          <h4 className="text-sm font-semibold text-[#263b4a]">
            Customer details
          </h4>

          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Customer
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#263b4a]">
                {customerName || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Phone
              </dt>
              <dd className="mt-1 text-sm text-[#52616b]">
                {address.phone || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Shipping address
              </dt>
              <dd className="mt-1 text-sm leading-5 text-[#52616b]">
                {fullAddress || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                ZIP code
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#263b4a]">
                {zipcode}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9aa3aa]">
                Payment method
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#263b4a]">
                {order.paymentMethod || "—"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[#edf0f2] bg-[#fafbfb] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
        <label
          htmlFor={`status-${order._id}`}
          className="text-xs font-medium text-[#69747e]"
        >
          Order status
        </label>
        <select
          id={`status-${order._id}`}
          onChange={(event) => onStatusChange(event, order._id)}
          value={order.status}
          disabled={updating || currentStep < 0 || currentStep === ORDER_STATUSES.length - 1}
          aria-busy={updating}
          className="w-full rounded-md border border-[#dfe5e8] bg-white px-3 py-2 text-xs font-semibold text-[#263b4a] outline-none transition focus:border-[#9fc4a9] focus:ring-2 focus:ring-[#dcecdf] disabled:cursor-not-allowed disabled:bg-[#f1f4f2] sm:w-40"
        >
          {!ORDER_STATUSES.includes(order.status) && (
            <option value={order.status}>{order.status}</option>
          )}
          {ORDER_STATUSES.map((status, index) => (
            <option key={status} value={status} disabled={index < currentStep}>
              {status === "Delivery" ? "Delivered" : status}
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
