import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { getShippingCharge } from "../utils/orderPricing";
import { formatThousandsVnd } from "../utils/money";
import { getCartItemKey } from "../utils/cartSelection";

const CartTotal = ({
  currentStep,
  onCheckout,
  onBack,
  isSubmitting = false,
  selectedItemKeys,
}) => {
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
  const shipping =
    subtotal > 0 ? getShippingCharge(subtotal, delivery_charges) : 0;
  const total = subtotal + shipping;

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
                <img
                  src={item.product.images[0]}
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

          <p className="font-semibold">{formatPrice(subtotal)}</p>
        </div>

        <div className="flex justify-between gap-4">
          <p className="text-gray-500">Shipping</p>

          <p className="font-semibold">
            {subtotal > 0 && shipping === 0 ? "Free" : formatPrice(shipping)}
          </p>
        </div>

        <hr className="border-gray-200" />

        <div className="flex justify-between gap-4 text-lg">
          <p className="font-semibold">Total</p>

          <p className="font-bold text-secondary">{formatPrice(total)}</p>
        </div>
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
                checked={method === "QR"}
                onChange={() => setMethod("QR")}
                className="mr-2"
              />
              QR Code
            </label>
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
            disabled={isSubmitting || selectedCount === 0}
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
