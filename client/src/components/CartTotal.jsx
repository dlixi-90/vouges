import { useMemo } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { formatVnd } from "../utils/money";
import { getCartItemKey } from "../utils/cartSelection";
import { SHIPPING_METHODS, URGENT_SHIPPING_NOTE } from "../utils/orderPricing";
import ProductImage from "./ProductImage";
import { getSizeImage } from "../utils/productImage";
import CheckoutVoucherPicker from "./checkout/CheckoutVoucherPicker";

const CartTotal = ({
  checkout,
  children,
  onBack,
  isSubmitting = false,
  selectedItemKeys,
  orderNote,
  setOrderNote,
}) => {
  const { products, cartItems, currency, method, setMethod } = useAppContext();
  const orderItems = useMemo(() => {
    const result = [];
    for (const productId in cartItems) {
      const product = products.find((item) => item._id === productId);
      if (!product) continue;
      for (const size in cartItems[productId]) {
        const quantity = Number(cartItems[productId][size]);
        if (
          quantity > 0 &&
          selectedItemKeys.has(getCartItemKey(productId, size))
        ) {
          result.push({ product, size, quantity });
        }
      }
    }
    return result;
  }, [products, cartItems, selectedItemKeys]);
  const selectedCount = orderItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const subtotal = orderItems.reduce(
    (total, item) =>
      total + Number(item.product.price[item.size]) * item.quantity,
    0,
  );
  const shippingMethods = checkout.shippingMethods || SHIPPING_METHODS;
  const isUrgentShipping = checkout.shippingMethod === "urgent";
  const discount = checkout.pricing?.discount || 0;
  const formatPrice = (value) => formatVnd(value, currency);
  const shippingPrice = (option) => {
    if (option.fee === null)
      return "Theo giá đơn vị vận chuyển · Thanh toán sau";
    const quote = checkout.shippingQuotes?.[option.id];
    if (!quote) return "—";
    const fee = quote.shipping;
    return fee === 0 ? "Miễn phí" : formatPrice(fee);
  };

  return (
    <div className="inessa-checkout-layout">
      <div className="inessa-checkout-details">
        <header className="inessa-checkout-heading">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="inessa-checkout-back"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Giỏ hàng
          </button>
          <h1>Thanh toán</h1>
        </header>

        {children}

        <section
          className="inessa-checkout-note"
          aria-labelledby="checkout-note-title"
        >
          <h2 id="checkout-note-title">Ghi chú</h2>
          <label htmlFor="order-note">Lời nhắn cho cửa hàng</label>
          <textarea
            id="order-note"
            name="note"
            form="checkout-address-form"
            rows={3}
            maxLength={500}
            value={orderNote}
            onChange={(event) => setOrderNote(event.target.value)}
            disabled={isSubmitting}
            placeholder="Ghi chú cho đơn hàng, ví dụ: thời gian nhận hàng phù hợp…"
            aria-describedby="order-note-limit"
          />
          <p id="order-note-limit">{orderNote.length}/500</p>
        </section>

        <fieldset disabled={isSubmitting} className="inessa-checkout-shipping">
          <legend>Phương thức giao hàng</legend>
          <p className="inessa-checkout-help">
            Miễn phí giao tiêu chuẩn cho đơn từ 1.000.000đ, tính trước khi áp mã
            giảm giá.
          </p>
          <div className="inessa-checkout-options">
            {shippingMethods.map((option) => (
              <label
                key={option.id}
                className={`inessa-checkout-option ${checkout.shippingMethod === option.id ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={option.id}
                  checked={checkout.shippingMethod === option.id}
                  onChange={() => checkout.setShippingMethod(option.id)}
                />
                <span className="inessa-checkout-option-copy">
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </span>
                <span className="inessa-checkout-shipping-price">
                  {shippingPrice(option)}
                </span>
              </label>
            ))}
          </div>
          {isUrgentShipping && (
            <p className="inessa-checkout-help">{URGENT_SHIPPING_NOTE}</p>
          )}
        </fieldset>

        <fieldset
          disabled={isSubmitting}
          className="inessa-checkout-payment"
          aria-labelledby="checkout-payment-title"
        >
          <legend id="checkout-payment-title">Thanh toán</legend>
          <div className="inessa-checkout-payment-options">
            {[
              {
                id: "COD",
                label: "Thanh toán khi nhận hàng",
                description:
                  "Thanh toán trực tiếp cho đơn vị vận chuyển khi bạn nhận được đơn hàng.",
              },
              {
                id: "QR",
                label: "Chuyển khoản ngân hàng (QR)",
                description:
                  "Mã QR và thông tin chuyển khoản sẽ hiển thị sau khi bạn xác nhận đặt hàng.",
              },
            ].map((option) => (
              <div
                key={option.id}
                className={`inessa-checkout-payment-option ${method === option.id ? "is-selected" : ""}`}
              >
                <label>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.id}
                    checked={method === option.id}
                    disabled={
                      option.id === "QR" && checkout.pricing?.amount === 0
                    }
                    onChange={() => setMethod(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
                {method === option.id && <p>{option.description}</p>}
              </div>
            ))}
          </div>
          {checkout.pricing?.amount === 0 && (
            <p className="inessa-checkout-help">
              Đơn 0đ không cần chuyển khoản. Chọn COD để đặt đơn.
            </p>
          )}
        </fieldset>
      </div>

      <aside
        className="inessa-checkout-order"
        aria-labelledby="checkout-products-title"
      >
        <div className="inessa-checkout-order-content">
          <h2 id="checkout-products-title">
            Đơn hàng của bạn <span>({selectedCount})</span>
          </h2>
          <div className="inessa-checkout-products">
            {orderItems.map((item) => (
              <div
                key={getCartItemKey(item.product._id, item.size)}
                className="inessa-checkout-product"
              >
                <div className="inessa-checkout-product-image">
                  <ProductImage
                    src={getSizeImage(item.product, item.size)}
                    imageWidth={160}
                    alt={item.product.title}
                  />
                  <span aria-label={`Số lượng: ${item.quantity}`}>
                    {item.quantity}
                  </span>
                </div>
                <div className="inessa-checkout-product-info">
                  <p>{item.product.title}</p>
                  <span>
                    {item.size} · {formatPrice(item.product.price[item.size])}
                  </span>
                </div>
                <strong>
                  {formatPrice(item.product.price[item.size] * item.quantity)}
                </strong>
              </div>
            ))}
            {orderItems.length === 0 && (
              <p className="inessa-checkout-help">
                Chưa có sản phẩm được chọn. Quay lại giỏ hàng để chọn sản phẩm.
              </p>
            )}
          </div>

          <section
            className="inessa-checkout-voucher"
            aria-label="Mã giảm giá cửa hàng"
          >
            <CheckoutVoucherPicker
              checkout={checkout}
              subtotal={checkout.pricing?.subtotal ?? subtotal}
              disabled={isSubmitting || selectedCount === 0}
              compact
            />
          </section>

          <dl
            className="inessa-checkout-totals"
            aria-live="polite"
            aria-busy={checkout.loading || isSubmitting}
          >
            <div>
              <dt>Tạm tính</dt>
              <dd>{formatPrice(checkout.pricing?.subtotal ?? subtotal)}</dd>
            </div>
            <div>
              <dt>Phí giao hàng</dt>
              <dd>
                {isUrgentShipping
                  ? "Thanh toán sau"
                  : checkout.ready
                    ? checkout.pricing.shipping === 0
                      ? "Miễn phí"
                      : formatPrice(checkout.pricing.shipping)
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>Giảm giá</dt>
              <dd className={discount > 0 ? "inessa-checkout-discount" : ""}>
                {checkout.ready
                  ? `${discount > 0 ? "−" : ""}${formatPrice(discount)}`
                  : "—"}
              </dd>
            </div>
            <div className="inessa-checkout-total">
              <dt>Tổng cộng</dt>
              <dd>
                {checkout.ready ? formatPrice(checkout.pricing.amount) : "—"}
              </dd>
            </div>
          </dl>
          {isUrgentShipping && (
            <p className="inessa-checkout-help">{URGENT_SHIPPING_NOTE}</p>
          )}
        </div>
      </aside>

      <div className="inessa-checkout-submit">
        <button
          type="submit"
          form="checkout-address-form"
          disabled={
            isSubmitting ||
            selectedCount === 0 ||
            !checkout.ready ||
            (method === "QR" && checkout.pricing.amount === 0)
          }
          className="btn-dark inessa-checkout-place-order"
        >
          <LockKeyhole size={15} aria-hidden="true" />
          {isSubmitting
            ? "Đang xử lý…"
            : method === "QR"
              ? "Tạo mã QR thanh toán"
              : "Đặt hàng"}
          <span>
            {checkout.ready ? formatPrice(checkout.pricing.amount) : "—"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default CartTotal;
