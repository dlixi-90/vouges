import { getSizeImage } from "../../utils/productImage";
import { getOrderStatusLabel, getPaymentMethodLabel } from "../../utils/localization.js";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Banknote, CalendarDays, Package, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { formatVnd } from "../../utils/money";
import { usePopularProducts } from "../../hooks/usePopularProducts";
import ProductImage from "../../components/ProductImage";
import Pagination from "../../components/Pagination";
import usePaginationScroll from "../../hooks/usePaginationScroll";
import { Badge, CatalogPage, RefreshButton } from "../../components/owner/CatalogUI";
import { OperationsEmptyState, OperationsMetric, OperationsPanel } from "../../components/owner/OperationsUI";

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
  const [months, setMonths] = useState(6);
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
  const { listRef, changePage } = usePaginationScroll({ page, onPageChange: setPage, ready: !isLoading && dashboardData.page === page });

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

  return <CatalogPage className="admin-operations-page admin-orders-page" title="Đơn hàng & doanh thu" actions={<RefreshButton disabled={isLoading} onClick={() => { void getDashboardData({ force: true }); void fetchPopularProducts(); }} />}>
    {loadError && <div role="alert" className="perfume-alert">{loadError}<button type="button" onClick={() => void getDashboardData({ force: true })}>Thử lại</button></div>}
    <div className="admin-metric-grid admin-two-metrics">
      <OperationsMetric primary icon={Banknote} label="Doanh thu đã thanh toán" value={dashboardData.totalRevenue === null ? "—" : formatVnd(dashboardData.totalRevenue, currency)} detail="Tổng tiền từ các đơn đã thanh toán" />
      <OperationsMetric icon={ShoppingBag} label="Tổng đơn hàng" value={dashboardData.totalOrders == null ? "—" : dashboardData.totalOrders.toLocaleString("vi-VN")} detail="Đơn COD và đơn đã thanh toán" />
    </div>
    <div className="admin-overview-grid admin-orders-analytics">
      <OperationsPanel title="Doanh thu theo tháng" description="Giá trị đơn hàng và số tiền đã thanh toán · VND" actions={<label className="admin-period-control"><CalendarDays size={15} /><select aria-label="Khoảng thời gian doanh thu" value={months} onChange={event => setMonths(Number(event.target.value))}><option value={6}>6 tháng</option><option value={3}>3 tháng</option></select></label>}>
        <div className="admin-revenue-chart"><Suspense fallback={<p className="perfume-loading" role="status">Đang tải biểu đồ…</p>}><RevenueChart data={dashboardData.monthlyData.slice(-months)} currency={currency} /></Suspense>{!isLoading && !loadError && !dashboardData.monthlyData.slice(-months).some(month => month.total > 0 || month.successful > 0) && <div className="admin-chart-empty"><Banknote size={23} strokeWidth={1.4} /><strong>Chưa có giao dịch trong kỳ</strong><span>Biểu đồ cập nhật khi có đơn hàng.</span></div>}</div>
      </OperationsPanel>
      <OperationsPanel title="Sản phẩm bán chạy" description="Xếp hạng theo số lượng đã thanh toán">
        {popularProductsError && <p role="alert" className="perfume-alert">{popularProductsError}<button type="button" onClick={fetchPopularProducts}>Thử lại</button></p>}
        {popularProductsLoading && <p role="status" className="perfume-loading">Đang tải sản phẩm bán chạy…</p>}
        <div className="admin-sales-ranking">{popularProducts.slice(0, 4).map((product, index) => <Link key={product._id} to={`/owner/edit-product/${product._id}`}><span className="admin-ranking-number">{index + 1}</span><span className="admin-product-image">{product.images?.[0] ? <ProductImage src={product.images[0]} imageWidth={100} alt="" /> : <Package size={18} />}</span><span><strong>{product.title}</strong><small>{product.category}</small></span><Badge>{product.soldQuantity} đã bán</Badge></Link>)}</div>
        {!popularProductsLoading && !popularProductsError && !popularProducts.length && <OperationsEmptyState icon={Package} title="Chưa có sản phẩm nào được bán" description="Danh sách sẽ xuất hiện sau khi có đơn được thanh toán." />}
      </OperationsPanel>
    </div>
    <section ref={listRef} tabIndex={-1} className="admin-dashboard-panel admin-order-list pagination-list-start" aria-busy={isLoading}>
      <header className="admin-panel-heading"><div><h2>Tất cả đơn hàng</h2><p>Thông tin sản phẩm, khách hàng và trạng thái giao hàng</p></div><Badge>{dashboardData.totalOrders ?? "—"} đơn hàng</Badge></header>
      {isLoading && <p role="status" className="perfume-loading">Đang tải đơn hàng…</p>}
      <div className="admin-order-cards">{!isLoading && dashboardData.page === page && orders.map(order => <OrderCard key={order._id} order={order} currency={currency} onStatusChange={statusHandler} updating={updatingOrderIds.includes(order._id)} />)}</div>
      {!isLoading && !loadError && !orders.length && <OperationsEmptyState icon={ShoppingBag} title="Chưa có đơn hàng nào" description="Các đơn hàng được tiếp nhận sẽ xuất hiện tại đây để bạn theo dõi và xử lý." />}
      <div className="admin-operation-pagination"><span>Trang {page}/{dashboardData.totalPages || 1}</span><Pagination label="Phân trang đơn hàng" page={page} totalPages={dashboardData.totalPages} onPageChange={changePage} disabled={isLoading || updatingOrderIds.length > 0} /></div>
    </section>
  </CatalogPage>;
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

export default Dashboard;
