import { translateCatalogText } from "../utils/localization.js";
import { useMemo } from "react";
import { CreditCard, Package, Truck } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { formatThousandsVnd } from "../utils/money";
import { getCartItemKey } from "../utils/cartSelection";
import { SHIPPING_METHODS, URGENT_SHIPPING_NOTE } from "../utils/orderPricing";
import ProductImage from "./ProductImage";
import CartActionBar from "./CartActionBar";
import CheckoutVoucherPicker from "./checkout/CheckoutVoucherPicker";

const CartTotal = ({ checkout, contentRef, onBack, isSubmitting = false, selectedItemKeys, orderNote, setOrderNote }) => {
  const { products, cartItems, currency, method, setMethod } = useAppContext();
  const orderItems = useMemo(() => {
    const result = [];
    for (const productId in cartItems) {
      const product = products.find((item) => item._id === productId);
      if (!product) continue;
      for (const size in cartItems[productId]) {
        const quantity = Number(cartItems[productId][size]);
        if (quantity > 0 && selectedItemKeys.has(getCartItemKey(productId, size))) {
          result.push({ product, size, quantity });
        }
      }
    }
    return result;
  }, [products, cartItems, selectedItemKeys]);
  const selectedCount = orderItems.reduce((total, item) => total + item.quantity, 0);
  const subtotal = orderItems.reduce(
    (total, item) => total + Number(item.product.price[item.size]) * item.quantity,
    0,
  );
  const shippingMethods = checkout.shippingMethods || SHIPPING_METHODS;
  const isUrgentShipping = checkout.shippingMethod === "urgent";
  const discount = checkout.pricing?.discount || 0;
  const formatPrice = (value) => formatThousandsVnd(value, currency);
  const shippingPrice = (option) => {
    if (option.fee === null) return "Theo giá đơn vị giao hàng · Thanh toán sau";
    const quote = checkout.shippingQuotes?.[option.id];
    if (!quote) return "—";
    const fee = quote.shipping;
    return fee === 0 ? "Miễn phí" : formatPrice(fee);
  };

  return (
    <div className="space-y-4">
      <section aria-labelledby="checkout-products-title" className="overflow-hidden rounded-xl bg-white">
        <div className="grid items-center gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_120px_100px_140px]">
          <h2 id="checkout-products-title" className="flex items-center gap-2 text-lg font-semibold">
            <Package size={20} className="text-secondary" aria-hidden="true" />
            Sản phẩm <span className="text-sm font-normal text-gray-500">({selectedCount})</span>
          </h2>
          <span className="hidden text-center text-sm text-gray-500 lg:block">Đơn giá</span>
          <span className="hidden text-center text-sm text-gray-500 lg:block">Số lượng</span>
          <span className="hidden text-right text-sm text-gray-500 lg:block">Thành tiền</span>
        </div>
        <div className="divide-y divide-gray-100 px-5 sm:px-6">
          {orderItems.map((item) => (
            <div
              key={getCartItemKey(item.product._id, item.size)}
              className="grid items-center gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_120px_100px_140px]"
            >
              <div className="flex min-w-0 items-center gap-4">
                <ProductImage
                  src={item.product.images[0]}
                  imageWidth={160}
                  alt={item.product.title}
                  className="h-20 w-16 shrink-0 rounded-lg bg-primary object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <p className="min-w-0 flex-1 basis-48 font-medium">{translateCatalogText(item.product.title)}</p>
                  <p className="text-sm text-gray-500">Dung tích: {item.size}</p>
                </div>
              </div>
              <div className="flex justify-between gap-3 text-sm lg:block lg:text-center">
                <span className="text-gray-500 lg:hidden">Đơn giá</span>
                <span className="whitespace-nowrap">{formatPrice(item.product.price[item.size])}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm lg:block lg:text-center">
                <span className="text-gray-500 lg:hidden">Số lượng</span>
                <span>{item.quantity}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm lg:block lg:text-right">
                <span className="text-gray-500 lg:hidden">Thành tiền</span>
                <span className="whitespace-nowrap font-semibold">{formatPrice(item.product.price[item.size] * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid border-t border-dashed border-gray-200 bg-primary/40 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="border-b border-dashed border-gray-200 p-5 sm:p-6 lg:border-r lg:border-b-0">
            <label htmlFor="order-note" className="mb-3 block text-sm font-medium">Lời nhắn cho cửa hàng:</label>
            <textarea id="order-note" name="note" form="checkout-address-form" rows={2} maxLength={500}
              value={orderNote} onChange={(event) => setOrderNote(event.target.value)} disabled={isSubmitting}
              placeholder="Lưu ý cho người bán…" aria-describedby="order-note-limit"
              className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-secondary disabled:opacity-50" />
            <p id="order-note-limit" className="mt-2 text-right text-xs text-gray-500">{orderNote.length}/500</p>
          </div>
          <fieldset disabled={isSubmitting} className="p-5 sm:p-6">
            <legend className="sr-only">Phương thức giao hàng</legend>
            <div className="mb-4">
              <h3 className="flex items-center gap-2 font-semibold"><Truck size={19} className="text-secondary" aria-hidden="true" />Phương thức giao hàng</h3>
              <p className="mt-2 text-sm text-gray-500">Miễn phí giao tiêu chuẩn khi tổng tiền hàng trước khi áp mã giảm giá từ 1.000.000đ.</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              {shippingMethods.map((option) => (
                <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 text-sm ${checkout.shippingMethod === option.id ? "border-secondary" : "border-gray-200"} ${isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}>
                  <input type="radio" name="shippingMethod" value={option.id} checked={checkout.shippingMethod === option.id}
                    onChange={() => checkout.setShippingMethod(option.id)} className="mt-1 accent-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs text-gray-500">{translateCatalogText(option.description)}</span>
                    <span className="mt-2 block font-semibold text-secondary">
                      {shippingPrice(option)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {isUrgentShipping && <p className="mt-3 text-sm text-gray-500">{URGENT_SHIPPING_NOTE}</p>}
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-dashed border-gray-200 bg-primary/40 px-5 py-4 sm:px-6">
          <span className="text-sm text-gray-500">Tổng tiền sản phẩm ({selectedCount} sản phẩm):</span>
          <span className="font-semibold text-secondary">{formatPrice(checkout.pricing?.subtotal ?? subtotal)}</span>
        </div>
      </section>

      <section aria-label="Mã giảm giá cửa hàng" className="rounded-xl bg-white p-5 sm:p-6">
        <CheckoutVoucherPicker checkout={checkout} subtotal={checkout.pricing?.subtotal ?? subtotal} disabled={isSubmitting} />
      </section>

      <section aria-labelledby="checkout-payment-title" className="rounded-xl bg-white">
        <fieldset disabled={isSubmitting} className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-gray-100 p-5 sm:p-6">
          <legend className="sr-only">Phương thức thanh toán</legend>
          <h2 id="checkout-payment-title" className="flex items-center gap-2 font-semibold"><CreditCard size={20} className="text-secondary" aria-hidden="true" />Phương thức thanh toán</h2>
          <div className="flex flex-wrap gap-3">
            {[{ id: "COD", label: "Thanh toán khi nhận hàng" }, { id: "QR", label: "Chuyển khoản ngân hàng (QR)" }].map((option) => (
              <label key={option.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-sm ${method === option.id ? "border-secondary bg-secondary/5 text-secondary" : "border-gray-200"} ${isSubmitting || (option.id === "QR" && checkout.pricing?.amount === 0) ? "cursor-not-allowed opacity-50" : ""}`}>
                <input type="radio" name="paymentMethod" value={option.id} checked={method === option.id}
                  disabled={option.id === "QR" && checkout.pricing?.amount === 0} onChange={() => setMethod(option.id)} className="accent-secondary" />
                {option.label}
              </label>
            ))}
          </div>
          {checkout.pricing?.amount === 0 && <p className="w-full text-sm text-gray-500">Đơn 0đ không cần chuyển khoản. Chọn COD để đặt đơn.</p>}
        </fieldset>
        <div className="flex justify-end bg-primary/40 p-5 sm:p-6">
          <dl className="w-full max-w-sm space-y-3 text-sm">
            <div className="flex justify-between gap-6"><dt className="text-gray-500">Tổng tiền sản phẩm</dt><dd className="font-medium">{formatPrice(checkout.pricing?.subtotal ?? subtotal)}</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-gray-500">Phí vận chuyển</dt><dd className="font-medium">{isUrgentShipping ? "Thanh toán sau" : checkout.ready ? checkout.pricing.shipping === 0 ? "Miễn phí" : formatPrice(checkout.pricing.shipping) : "—"}</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-gray-500">Giảm giá</dt><dd className={discount > 0 ? "font-medium text-green-700" : "font-medium"}>{checkout.ready ? `${discount > 0 ? "−" : ""}${formatPrice(discount)}` : "—"}</dd></div>
            <div className="flex items-baseline justify-between gap-6 border-t border-gray-200 pt-3"><dt className="font-semibold">Tổng thanh toán</dt><dd className="text-xl font-bold text-secondary">{checkout.ready ? formatPrice(checkout.pricing.amount) : "—"}</dd></div>
            {isUrgentShipping && <div className="text-xs text-gray-500"><dt className="sr-only">Phí Hỏa tốc</dt><dd>{URGENT_SHIPPING_NOTE}</dd></div>}
          </dl>
        </div>
      </section>

      <CartActionBar contentRef={contentRef}>
        <button type="button" onClick={onBack} disabled={isSubmitting} className="btn-outline !rounded-full !px-4 disabled:opacity-50">Quay lại giỏ hàng</button>
        <div className="flex w-full flex-wrap items-center justify-between gap-4 lg:w-auto lg:justify-end lg:gap-6">
          <div aria-live="polite">
            <p className="text-xs text-gray-500">{selectedCount} sản phẩm · {isUrgentShipping ? "Chưa gồm phí Hỏa tốc (thanh toán sau)" : "Đã tính phí vận chuyển và giảm giá"}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-3"><span className="text-sm">Tổng thanh toán:</span><span className="text-xl font-bold text-secondary">{checkout.ready ? formatPrice(checkout.pricing.amount) : "—"}</span></p>
          </div>
          <button type="submit" form="checkout-address-form" disabled={isSubmitting || selectedCount === 0 || !checkout.ready || (method === "QR" && checkout.pricing.amount === 0)}
            className="btn-dark w-full !rounded-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48">
            {isSubmitting ? "Đang xử lý…" : method === "QR" ? "Tạo mã QR thanh toán" : "Đặt hàng"}
          </button>
        </div>
      </CartActionBar>
    </div>
  );
};

export default CartTotal;
