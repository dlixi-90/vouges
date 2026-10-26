import { getSizeImage } from "../utils/productImage";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { ArrowLeft, Check, CheckCircle2, Clock3, Package } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import ProductImage from "../components/ProductImage";
import { formatVnd } from "../utils/money";
import { getOrderStatusLabel, getPaymentMethodLabel } from "../utils/localization";
import { SHIPPING_METHODS, URGENT_SHIPPING_NOTE } from "../utils/orderPricing";

const deliverySteps = ["Order Placed", "Packing", "Shipping", "Delivery"];
const isSavedNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const formatDate = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(date)
    : "—";
};

const OrderOverview = () => {
  const { orderId } = useParams();
  const { user, axios, getToken, currency } = useAppContext();
  const { isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const userId = user?.id;
  const validId = /^[a-f\d]{24}$/i.test(orderId || "");
  const requestKey = `${userId || ""}:${orderId}:${attempt}`;
  const current = result?.key === requestKey ? result : null;

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [orderId]);
  useEffect(() => {
    if (!userId || !validId) return undefined;
    const controller = new AbortController();
    const loadOrder = async () => {
      try {
        const token = await getToken();
        controller.signal.throwIfAborted();
        const { data } = await axios.get(`/api/orders/${orderId}`, {
          params: { overview: "true" },
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        });
        if (!data.success || String(data.order?._id).toLowerCase() !== orderId.toLowerCase()) {
          throw new Error(data.message || "Không tìm thấy đơn hàng.");
        }
        if (!controller.signal.aborted) setResult({ key: requestKey, order: data.order });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: error.response?.data?.message || error.message || "Không thể tải đơn hàng." });
      }
    };
    void loadOrder();
    return () => controller.abort();
  }, [axios, getToken, orderId, requestKey, userId, validId]);

  const shell = (content) => <div className="net-cart inessa-overview-page"><div className="max-padd-container">{content}</div></div>;
  if (!isLoaded) return shell(<div className="inessa-overview-state" role="status">Đang tải tài khoản…</div>);
  if (!user) return shell(<div className="inessa-overview-state">
    <Package size={34} strokeWidth={1.3} aria-hidden="true" /><h1>Xem đơn hàng của bạn</h1>
    <p>Đăng nhập bằng tài khoản đã đặt hàng để xem thông tin đơn hàng.</p>
    <button type="button" onClick={() => openSignIn()} className="btn-dark">Đăng nhập</button>
  </div>);
  if (!validId || current?.error) return shell(<div className="inessa-overview-state" role="alert">
    <h1>Không thể xem đơn hàng</h1><p>{!validId ? "Mã đơn hàng không hợp lệ." : current.error}</p>
    <div>{validId && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="btn-dark">Thử lại</button>}
      <Link to="/my-orders" className="btn-outline">Đơn hàng của tôi</Link></div>
  </div>);
  if (!current?.order) return shell(<div className="inessa-overview-state" role="status">Đang tải thông tin đơn hàng…</div>);

  const order = current.order;
  const address = typeof order.address === "object" && order.address ? order.address : {};
  const items = order.items || [];
  const customerName = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const fullAddress = [address.street, address.state, address.city, address.country].filter(Boolean).join(", ");
  const shippingMethod = SHIPPING_METHODS.find((entry) => entry.id === order.shippingMethod);
  const isUrgent = order.shippingMethod === "urgent";
  const currentStep = deliverySteps.indexOf(order.status);
  const isReview = order.status === "Payment Review";
  const isAwaiting = order.paymentMethod === "QR" && !order.isPaid && order.status === "Awaiting Payment";
  const isClosed = ["Payment Expired", "Payment Cancelled"].includes(order.status);
  const confirmed = currentStep >= 0 && !isReview && !isClosed && !isAwaiting;
  const formatPrice = (value) => isSavedNumber(value) ? formatVnd(value, currency) : "—";
  const paymentLabel = isReview ? "Chờ xác minh" : order.isPaid ? "Đã thanh toán" : isClosed ? getOrderStatusLabel(order.status) : order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng" : "Chờ thanh toán";
  const message = isReview
    ? "Khoản thanh toán đã được ghi nhận và đang chờ nhân viên xác minh."
    : isClosed ? "Phiên thanh toán đã kết thúc. Bạn có thể quay lại giỏ hàng để đặt đơn mới."
      : isAwaiting ? "Đơn hàng đang chờ thanh toán. Hoàn tất chuyển khoản để xác nhận đơn hàng."
        : order.isPaid ? "Thanh toán đã được xác nhận. Cảm ơn bạn đã lựa chọn Velours."
          : "Đơn hàng đã được ghi nhận. Bạn sẽ thanh toán khi nhận hàng.";

  return shell(<div className="inessa-overview-layout">
    <div className="inessa-overview-details">
      <Link to="/my-orders" className="inessa-checkout-back"><ArrowLeft size={15} aria-hidden="true" />Đơn hàng của tôi</Link>
      <header className="inessa-overview-confirmation">
        <span className="inessa-overview-confirmation-icon">{confirmed ? <CheckCircle2 size={42} strokeWidth={1.2} aria-hidden="true" /> : <Clock3 size={38} strokeWidth={1.2} aria-hidden="true" />}</span>
        <div><p title={String(order._id)}>Đơn hàng #{String(order._id).slice(-8).toUpperCase()}</p>
          <h1>{confirmed ? `Cảm ơn bạn${address.firstName ? `, ${address.firstName}` : ""}!` : "Tổng quan đơn hàng"}</h1></div>
      </header>
      <p className="inessa-overview-message">{message}</p>

      <dl className="inessa-overview-meta">
        <div><dt>Ngày đặt hàng</dt><dd>{formatDate(order.createdAt)}</dd></div>
        <div><dt>Trạng thái</dt><dd>{getOrderStatusLabel(order.status)}</dd></div>
        <div><dt>Thanh toán</dt><dd>{paymentLabel}</dd></div>
      </dl>

      <section className="inessa-overview-panel" aria-labelledby="overview-updates-title">
        <h2 id="overview-updates-title">Cập nhật đơn hàng</h2>
        {currentStep >= 0 ? <ol className="inessa-overview-progress" aria-label="Tiến trình giao hàng">
          {deliverySteps.map((step, index) => <li key={step} className={index <= currentStep ? "is-complete" : ""} aria-current={index === currentStep ? "step" : undefined}>
            <span aria-hidden="true">{index <= currentStep ? <Check size={13} /> : index + 1}</span>
            <p>{getOrderStatusLabel(step)}</p>
          </li>)}
        </ol> : <p className="inessa-overview-status-note">{getOrderStatusLabel(order.status)} · {message}</p>}
        {isAwaiting && <Link to="/cart" className="btn-dark inessa-overview-resume">Tiếp tục thanh toán</Link>}
        {isClosed && <Link to="/cart" className="btn-outline inessa-overview-resume">Quay lại giỏ hàng</Link>}
      </section>

      <section className="inessa-overview-panel" aria-labelledby="overview-customer-title">
        <h2 id="overview-customer-title">Thông tin đơn hàng</h2>
        <div className="inessa-overview-customer-grid">
          <div><h3>Thông tin liên hệ</h3><p>{customerName || "—"}</p><p>{address.email || "—"}</p><p>{address.phone || "—"}</p></div>
          <div><h3>Địa chỉ giao hàng</h3><p>{fullAddress || "Không có thông tin địa chỉ."}</p>{(address.zipcode || address.zipCode) && <p>Mã bưu chính: {address.zipcode || address.zipCode}</p>}</div>
          <div><h3>Phương thức thanh toán</h3><p>{getPaymentMethodLabel(order.paymentMethod)}</p>{paymentLabel !== getPaymentMethodLabel(order.paymentMethod) && <p className="inessa-overview-payment-state">{paymentLabel}</p>}{order.isPaid && order.paidAt && <p>Ngày thanh toán: {formatDate(order.paidAt)}</p>}</div>
          <div><h3>Phương thức giao hàng</h3><p>{shippingMethod?.label || "—"}</p><p>{isUrgent ? "Phí giao hàng thanh toán sau" : isSavedNumber(order.shipping) ? Number(order.shipping) === 0 ? "Miễn phí giao hàng" : formatPrice(order.shipping) : "—"}</p></div>
        </div>
        {isUrgent && <p className="inessa-checkout-help">{URGENT_SHIPPING_NOTE}</p>}
        {order.note && <div className="inessa-overview-order-note"><h3>Lời nhắn cho cửa hàng</h3><p>{order.note}</p></div>}
      </section>

      <div className="inessa-overview-actions"><Link to="/collection" className="btn-dark">Tiếp tục mua sắm</Link><Link to="/my-orders" className="btn-outline">Xem tất cả đơn hàng</Link></div>
    </div>

    <aside className="inessa-checkout-order" aria-labelledby="overview-products-title">
      <div className="inessa-checkout-order-content">
        <h2 id="overview-products-title">Tóm tắt đơn hàng</h2>
        <div className="inessa-checkout-products">
          {items.map((item, index) => {
            const product = item.product && typeof item.product === "object" ? item.product : {};
            const productId = product._id || (typeof item.product === "string" ? item.product : "");
            const title = item.title || product.title || "Sản phẩm không còn có sẵn";
            const image = item.image || getSizeImage(product, item.size);
            return <div key={item._id || `${productId}:${item.size}:${index}`} className="inessa-checkout-product">
              <div className="inessa-checkout-product-image">{image ? <ProductImage src={image} imageWidth={160} alt={title} /> : <Package size={24} strokeWidth={1.3} aria-hidden="true" />}<span aria-label={`Số lượng: ${item.quantity}`}>{item.quantity}</span></div>
              <div className="inessa-checkout-product-info"><p>{productId && !product.isDeleted ? <Link to={`/collection/${productId}`}>{title}</Link> : title}</p><span>{item.size} · {formatPrice(item.unitPrice)}</span></div>
              <strong>{isSavedNumber(item.unitPrice) ? formatPrice(Number(item.unitPrice) * Number(item.quantity)) : "—"}</strong>
            </div>;
          })}
        </div>
        <dl className="inessa-checkout-totals inessa-overview-totals">
          <div><dt>Tạm tính</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          <div><dt>Phí giao hàng</dt><dd>{isUrgent ? "Thanh toán sau" : isSavedNumber(order.shipping) && Number(order.shipping) === 0 ? "Miễn phí" : formatPrice(order.shipping)}</dd></div>
          {Number(order.discount) > 0 && <div><dt>Giảm giá {order.voucherCode && <span className="inessa-overview-voucher-code">({order.voucherCode})</span>}</dt><dd className="inessa-checkout-discount">−{formatPrice(order.discount)}</dd></div>}
          <div className="inessa-checkout-total"><dt>Tổng cộng</dt><dd>{formatPrice(order.amount)}</dd></div>
        </dl>
        {isUrgent && <p className="inessa-checkout-help">{URGENT_SHIPPING_NOTE}</p>}
        <p className="inessa-overview-receipt-payment">{getPaymentMethodLabel(order.paymentMethod)}{paymentLabel !== getPaymentMethodLabel(order.paymentMethod) && <span>{paymentLabel}</span>}</p>
      </div>
    </aside>
  </div>);
};

export default OrderOverview;
