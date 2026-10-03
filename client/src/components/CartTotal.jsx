import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getShippingCharge } from "../utils/orderPricing";
import { formatThousandsVnd } from "../utils/money";
import { getCartItemKey } from "../utils/cartSelection";
import ProductImage from "./ProductImage";

const CartTotal = ({
  checkout,
  currentStep,
  onCheckout,
  onBack,
  isSubmitting = false,
  selectedItemKeys,
}) => {
  const [voucherDraft, setVoucherDraft] = useState("");
  const {
    products,
    cartItems,
    currency,
    method,
    setMethod,
    delivery_charges,
  } = useAppContext();

  const orderItems = useMemo(() => {
    const result = [];

    for (const productId in cartItems) {
      const product = products.find((item) => item._id === productId);

      if (!product) continue;

      for (const size in cartItems[productId]) {
        const quantity = Number(cartItems[productId][size]);

        const itemKey = getCartItemKey(productId, size);

        if (quantity > 0 && selectedItemKeys.has(itemKey)) {
          result.push({
            product,
            size,
            quantity,
          });
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
  const shipping = checkout.pricing?.shipping ??
    (subtotal > 0 ? getShippingCharge(subtotal, delivery_charges) : 0);
  const discount = checkout.pricing?.discount || 0;
  const total = checkout.pricing?.amount ?? subtotal + shipping;

  const formatPrice = (value) => formatThousandsVnd(value, currency);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="bold-22">
          {currentStep === 1 ? "Cart Total" : "Order Details"}
        </h3>

        <span className="whitespace-nowrap bold-14 text-secondary">
          ({selectedCount}) Selected
        </span>
      </div>

      <hr className="my-5 border-gray-300" />

      {/* Order items chỉ hiện ở Step 2 */}
      {currentStep === 2 && (
        <>
          <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
            {orderItems.map((item) => (
              <div
                key={`${item.product._id}-${item.size}`}
                className="flex gap-3"
              >
                <ProductImage
                  src={item.product.images[0]}
                  imageWidth={160}
                  alt={item.product.title}
                  className="h-20 w-16 rounded-md bg-primary object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium">
                    {item.product.title}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Size: {item.size}
                  </p>

                  <p className="text-sm text-gray-500">
                    Quantity: {item.quantity}
                  </p>
                </div>

                <p className="whitespace-nowrap text-sm font-semibold">
                  {formatPrice(item.product.price[item.size] * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <hr className="my-5 border-gray-200" />
        </>
      )}

      {/* Total xuất hiện ở cả Step 1 và Step 2 */}
      <div className="space-y-3">
        <div className="flex justify-between gap-4">
          <p className="text-gray-500">Subtotal</p>

          <p className="font-semibold">{formatPrice(checkout.pricing?.subtotal ?? subtotal)}</p>
        </div>

        <div className="flex justify-between gap-4">
          <p className="text-gray-500">Shipping</p>

          <p className="font-semibold">
            {checkout.ready ? shipping === 0 ? "Free" : formatPrice(shipping) : "—"}
          </p>
        </div>

        <hr className="border-gray-200" />

        {discount > 0 && <div className="flex justify-between gap-4 text-green-700">
          <p>Voucher ({checkout.pricing.voucherCode})</p><p>−{formatPrice(discount)}</p>
        </div>}
        <div className="flex justify-between gap-4 text-lg">
          <p className="font-semibold">Total</p>

          <p className="font-bold text-secondary">{checkout.ready ? formatPrice(total) : "—"}</p>
        </div>
      </div>

      <fieldset disabled={isSubmitting} className="mt-6 space-y-3">
        <legend className="mb-3 font-semibold">Phương thức giao hàng</legend>
        {(checkout.shippingMethods || [
          { id: "standard", label: "Giao tiêu chuẩn", description: "Dự kiến 3–5 ngày", fee: 30 },
          { id: "express", label: "Giao nhanh", description: "Dự kiến 1–2 ngày", fee: 50 },
        ]).map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm">
          <input type="radio" name="shippingMethod" checked={checkout.shippingMethod === option.id}
            onChange={() => checkout.setShippingMethod(option.id)} className="mt-1" />
          <span>{option.label} · {formatPrice(option.fee)}<span className="block text-xs text-gray-500">{option.description}
            {option.id === "standard" && " · Miễn phí từ 500.000đ trước giảm giá"}</span></span>
        </label>)}
      </fieldset>
      <div className="mt-5">
        <label htmlFor="voucher-code" className="text-sm font-semibold">Mã giảm giá</label>
        <div className="mt-2 flex gap-2">
          <input id="voucher-code" value={voucherDraft} maxLength={40} disabled={isSubmitting}
            onChange={(event) => setVoucherDraft(event.target.value.toUpperCase())}
            placeholder="Nhập mã voucher" className="min-w-0 flex-1 rounded-md border p-2 text-sm" />
          <button type="button" disabled={isSubmitting || !voucherDraft.trim()} className="btn-outline !rounded-md !px-3"
            onClick={() => { checkout.setVoucherCode(voucherDraft.trim()); checkout.refresh(); }}>Áp dụng</button>
        </div>
        {checkout.voucherCode && <p className="mt-2 break-all text-xs">{checkout.voucherCode}
          <button type="button" disabled={isSubmitting} onClick={() => { checkout.setVoucherCode(""); setVoucherDraft(""); }} className="ml-2 underline">Bỏ mã</button></p>}
        <Link to="/membership" className="mt-2 inline-block text-xs text-secondary underline">Xem voucher của tôi</Link>
        {checkout.loading && <p role="status" className="mt-2 text-sm">Đang tính tổng tiền…</p>}
        {checkout.error && <div role="alert" className="mt-2 text-sm text-red-600">{checkout.error}
          <button type="button" onClick={checkout.refresh} className="ml-2 underline">Thử lại</button></div>}
      </div>

      {/* Payment method chỉ hiện ở Step 2 */}
      {currentStep === 2 && (
        <>
          <hr className="my-5 border-gray-200" />

          <h4 className="font-semibold">Payment Method</h4>

          <div className="mt-4 grid gap-3">
            <label
              className={`cursor-pointer rounded-lg border p-4 ${
                method === "COD"
                  ? "border-secondary bg-secondary/5"
                  : "border-gray-200"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                checked={method === "COD"}
                onChange={() => setMethod("COD")}
                className="mr-2"
              />
              Cash on delivery
            </label>

            <label
              className={`cursor-pointer rounded-lg border p-4 ${
                method === "QR"
                  ? "border-secondary bg-secondary/5"
                  : "border-gray-200"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="QR"
                disabled={checkout.pricing?.amount === 0}
                checked={method === "QR"}
                onChange={() => setMethod("QR")}
                className="mr-2"
              />
              QR Code
            </label>
            {checkout.pricing?.amount === 0 && <p className="text-sm text-gray-500">Đơn 0đ không cần chuyển khoản. Chọn COD để đặt đơn.</p>}
          </div>
        </>
      )}

      {/* Step 1 button */}
      {currentStep === 1 && (
        <button
          type="button"
          onClick={onCheckout}
          disabled={selectedCount === 0 || isSubmitting}
          className="btn-dark mt-8 w-full !rounded-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          Proceed to Checkout
        </button>
      )}

      {/* Step 2 buttons */}
      {currentStep === 2 && (
        <div className="mt-8 grid gap-3">
          <button
            type="submit"
            form="checkout-address-form"
            disabled={isSubmitting || selectedCount === 0 || !checkout.ready}
            className="btn-dark w-full !rounded-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Processing..."
              : method === "QR"
                ? "Create Payment QR"
                : "Place Order"}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="btn-outline w-full !rounded-md disabled:opacity-50"
          >
            Back to Cart
          </button>
        </div>
      )}
    </div>
  );
};

export default CartTotal;
