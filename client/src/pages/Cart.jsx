import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import Title from "../components/Title";
import CartTotal from "../components/CartTotal";
import CartSteps from "../components/CartSteps";
import CartSizePicker from "../components/CartSizePicker";
import QrPaymentStatus from "../components/QrPaymentStatus";
import CheckoutAddressForm from "../components/checkout/CheckoutAddressForm";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/data";
import { formatThousandsVnd } from "../utils/money";
import {
  getCartItemKey,
  changeSizeSelection,
  getAvailableCartItems,
} from "../utils/cartSelection";
import { getSizeQuantity } from "../utils/productStock";
import { initialCheckoutAddress } from "../utils/checkoutAddress";
import { getOrderedCartItems } from "../utils/cartOrder";

const CartCheckbox = ({
  checked,
  onChange,
  label,
  indeterminate = false,
  inputRef,
  disabled = false,
}) => (
  <label
    className={`group flex items-center justify-center rounded-md p-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    title={label}
  >
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-md border-2 transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-secondary/40 peer-focus-visible:ring-offset-2 ${
        checked || indeterminate
          ? "border-secondary bg-secondary text-white shadow-sm"
          : "border-[#c8ccc9] bg-white group-hover:border-secondary"
      }`}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 rounded-full bg-white" />
      ) : checked ? (
        <Check size={15} strokeWidth={3} />
      ) : null}
    </span>
  </label>
);

const Cart = () => {
  const {
    navigate,
    user,
    products,
    currency,
    cartItems,
    cartAddedAt,
    updateQuantity,
    changeCartSize,
    axios,
    getToken,
    fetchProducts,
  } = useAppContext();

  const [currentStep, setCurrentStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingCart, setIsUpdatingCart] = useState(false);
  const cartUpdateRef = useRef(false);
  const [checkoutAddress, setCheckoutAddress] = useState(
    initialCheckoutAddress,
  );
  const [deselectedItemKeys, setDeselectedItemKeys] = useState(() => new Set());
  const selectAllRef = useRef(null);
  const footerSelectAllRef = useRef(null);

  const cartData = useMemo(() => {
    if (products.length === 0) return [];

    return getOrderedCartItems(cartItems, cartAddedAt);
  }, [products, cartItems, cartAddedAt]);

  const availableCartData = useMemo(
    () => getAvailableCartItems(cartData, products),
    [cartData, products],
  );
  const availableItemKeys = useMemo(
    () =>
      new Set(
        availableCartData.map((item) => getCartItemKey(item._id, item.size)),
      ),
    [availableCartData],
  );

  useEffect(() => {
    if (createdOrder) return undefined;
    const refreshStock = () => {
      if (document.visibilityState === "visible") fetchProducts();
    };
    refreshStock();
    window.addEventListener("focus", refreshStock);
    const intervalId = window.setInterval(refreshStock, 30000);
    return () => {
      window.removeEventListener("focus", refreshStock);
      window.clearInterval(intervalId);
    };
  }, [createdOrder, fetchProducts]);

  const selectedItemKeys = useMemo(
    () =>
      new Set(
        availableCartData
          .map((item) => getCartItemKey(item._id, item.size))
          .filter((itemKey) => !deselectedItemKeys.has(itemKey)),
      ),
    [availableCartData, deselectedItemKeys],
  );
  const allItemsSelected =
    availableCartData.length > 0 &&
    selectedItemKeys.size === availableCartData.length;
  const someItemsSelected =
    selectedItemKeys.size > 0 &&
    selectedItemKeys.size < availableCartData.length;

  useEffect(() => {
    for (const ref of [selectAllRef, footerSelectAllRef]) {
      if (ref.current) ref.current.indeterminate = someItemsSelected;
    }
  }, [someItemsSelected, currentStep]);

  const toggleItemSelection = (itemKey) => {
    if (!availableItemKeys.has(itemKey)) return;
    setDeselectedItemKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(itemKey)) {
        nextKeys.delete(itemKey);
      } else {
        nextKeys.add(itemKey);
      }

      return nextKeys;
    });
  };

  const toggleAllItems = () => {
    setDeselectedItemKeys(
      allItemsSelected ? new Set(availableItemKeys) : new Set(),
    );
  };

  useEffect(() => {
    if (!user) return undefined;

    let isActive = true;

    const restorePendingPayment = async () => {
      try {
        const { data } = await axios.get("/api/orders/pending-payment", {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });

        if (isActive && data.success && data.order) {
          setCreatedOrder(data.order);
          setCurrentStep(3);
          setHighestStep(3);
        }
      } catch {
        // The cart remains usable if no pending payment can be restored.
      }
    };

    restorePendingPayment();

    return () => {
      isActive = false;
    };
  }, [axios, getToken, user]);

  const runCartUpdate = async (update) => {
    if (cartUpdateRef.current) return;
    cartUpdateRef.current = true;
    setIsUpdatingCart(true);
    try {
      return await update();
    } finally {
      cartUpdateRef.current = false;
      setIsUpdatingCart(false);
    }
  };

  const handleSizeChange = (productId, fromSize, toSize) =>
    runCartUpdate(async () => {
      const targetExists = Number(cartItems[productId]?.[toSize] ?? 0) > 0;
      const result = await changeCartSize(productId, fromSize, toSize);
      if (!result.success) return result;
      setDeselectedItemKeys((current) =>
        changeSizeSelection(current, productId, fromSize, toSize, targetExists),
      );
      toast.success(
        targetExists
          ? "Size updated and quantities merged. Please check your selection."
          : "Size updated",
      );
      return result;
    });

  const increment = (productId, size) => {
    const quantity = cartItems[productId]?.[size] || 0;

    runCartUpdate(() => updateQuantity(productId, size, quantity + 1));
  };

  const decrement = (productId, size) => {
    const quantity = cartItems[productId]?.[size] || 0;

    if (quantity > 1) {
      runCartUpdate(() => updateQuantity(productId, size, quantity - 1));
    }
  };

  const selectedItems = cartData.filter((item) =>
    selectedItemKeys.has(getCartItemKey(item._id, item.size)),
  );
  const selectedCount = selectedItems.reduce(
    (total, item) => total + Number(cartItems[item._id]?.[item.size] ?? 0),
    0,
  );
  const subtotal = selectedItems.reduce((total, item) => {
    const product = products.find((entry) => entry._id === item._id);
    return (
      total +
      Number(product?.price?.[item.size] ?? 0) *
        Number(cartItems[item._id]?.[item.size] ?? 0)
    );
  }, 0);
  const removeSelectedItems = () =>
    runCartUpdate(async () => {
      for (const item of selectedItems) {
        const result = await updateQuantity(item._id, item.size, 0);
        if (!result.success) break;
      }
    });

  const handleCheckout = () => {
    if (cartUpdateRef.current) return;
    if (selectedItemKeys.size === 0) {
      return toast.error("Please select at least one product");
    }

    if (!user) {
      return toast.error("Please login before checkout");
    }

    setCurrentStep(2);
    setHighestStep(2);
    window.scrollTo(0, 0);
  };

  const handleOrderCreated = (order) => {
    setCreatedOrder(order);
    setCurrentStep(3);
    setHighestStep(3);
    window.scrollTo(0, 0);
  };

  const handleQrExpired = () => {
    setCreatedOrder(null);
    setCurrentStep(1);
    setHighestStep(1);
    window.scrollTo(0, 0);
  };

  const handleQrCancelled = useCallback(() => {
    setCreatedOrder(null);
    setCurrentStep(2);
    setHighestStep(2);
    window.scrollTo(0, 0);
  }, []);

  const handleStepChange = (step) => {
    if (cartUpdateRef.current) return;
    if (createdOrder) return;
    if (step > highestStep) return;
    if (step === 2 && selectedItemKeys.size === 0) {
      return toast.error("Please select at least one available product");
    }

    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  return products && cartItems ? (
    <div className="max-padd-container bg-primary py-16 pt-28">
      <CartSteps
        currentStep={currentStep}
        highestStep={highestStep}
        onStepChange={handleStepChange}
        locked={Boolean(createdOrder) || isUpdatingCart}
      />

      {/* STEP 1 */}
      {currentStep === 1 && (
        <section className="min-w-0 text-[95%]">
          <Title title1="Cart" title2="Overview" title1Styles="pb-5" />
          {cartData.length > 0 ? (
            <>
              <div className="hidden grid-cols-[48px_minmax(0,1fr)_120px_140px_140px_80px] items-center gap-3 rounded-xl bg-white px-4 py-3 lg:grid">
                <CartCheckbox
                  inputRef={selectAllRef}
                  disabled={isUpdatingCart || availableCartData.length === 0}
                  checked={allItemsSelected}
                  onChange={toggleAllItems}
                  indeterminate={someItemsSelected}
                  label="Select all products"
                />
                <h5 className="h5">Product</h5>
                <h5 className="h5 text-center">Unit Price</h5>
                <h5 className="h5 text-center">Quantity</h5>
                <h5 className="h5 text-center">Subtotal</h5>
                <h5 className="h5 text-center">Action</h5>
              </div>

              <div className="mt-3 space-y-3">
                {cartData.map((item) => {
                  const product = products.find(
                    (entry) => entry._id === item._id,
                  );
                  if (!product) return null;
                  const quantity = Number(
                    cartItems[item._id]?.[item.size] ?? 0,
                  );
                  const itemKey = getCartItemKey(item._id, item.size);
                  const isSelected = selectedItemKeys.has(itemKey);
                  const isUnavailable = !availableItemKeys.has(itemKey);
                  if (quantity <= 0) return null;

                  return (
                    <div
                      key={itemKey}
                      className={`grid grid-cols-[32px_minmax(0,1fr)_40px] items-center gap-x-2 gap-y-4 rounded-xl px-3 py-5 transition sm:gap-x-3 sm:px-4 lg:grid-cols-[48px_minmax(0,1fr)_120px_140px_140px_80px] lg:py-6 ${isUnavailable ? "bg-white/40 [&>div]:opacity-50" : isSelected ? "bg-white" : "bg-white/60"}`}
                    >
                      <div className="col-start-1 row-start-1">
                        <CartCheckbox
                          disabled={isUpdatingCart || isUnavailable}
                          checked={isSelected}
                          onChange={() => toggleItemSelection(itemKey)}
                          label={`Select ${product.title}, size ${item.size}`}
                        />
                      </div>
                      <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap xl:gap-5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <img
                            src={product.images[0]}
                            alt={product.title}
                            className="h-20 w-16 shrink-0 rounded-xl bg-primary object-cover sm:h-24 sm:w-20"
                          />
                          <div className="min-w-0">
                            <h5 className="h5 line-clamp-2">{product.title}</h5>
                            {isUnavailable && (
                              <p
                                className="mt-2 text-sm font-medium text-secondary"
                                role="status"
                              >
                                Out of stock - remove from cart
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="w-full pl-[76px] sm:pl-[92px] xl:w-32 xl:shrink-0 xl:pl-0">
                          <CartSizePicker
                            product={product}
                            size={item.size}
                            quantity={quantity}
                            quantities={cartItems[item._id]}
                            disabled={isUpdatingCart || isUnavailable}
                            onConfirm={(size) =>
                              handleSizeChange(item._id, item.size, size)
                            }
                          />
                        </div>
                      </div>
                      <div className="col-start-2 row-start-2 flex items-center justify-between gap-2 text-sm lg:col-start-3 lg:row-start-1 lg:block lg:text-center">
                        <span className="text-gray-500 lg:hidden">
                          Unit Price
                        </span>
                        <span className="whitespace-nowrap">
                          {formatThousandsVnd(
                            product.price[item.size],
                            currency,
                          )}
                        </span>
                      </div>
                      <div className="col-start-2 row-start-3 flex items-center justify-between gap-2 lg:col-start-4 lg:row-start-1 lg:justify-center">
                        <span className="text-sm text-gray-500 lg:hidden">
                          Quantity
                        </span>
                        <div className="inline-flex items-center overflow-hidden rounded-full bg-primary ring-1 ring-slate-900/15">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${product.title}, size ${item.size}`}
                            onClick={() => decrement(item._id, item.size)}
                            disabled={
                              isUpdatingCart || isUnavailable || quantity <= 1
                            }
                            className="cursor-pointer rounded-full bg-secondary p-2 text-white shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <img
                              src={assets.minus}
                              alt=""
                              width={11}
                              className="invert"
                            />
                          </button>
                          <span className="min-w-10 px-2 text-center text-sm">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${product.title}, size ${item.size}`}
                            onClick={() => increment(item._id, item.size)}
                            disabled={
                              isUpdatingCart ||
                              isUnavailable ||
                              quantity >= getSizeQuantity(product, item.size)
                            }
                            className="cursor-pointer rounded-full bg-secondary p-2 text-white shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <img
                              src={assets.plus}
                              alt=""
                              width={11}
                              className="invert"
                            />
                          </button>
                        </div>
                      </div>
                      <div className="col-start-2 row-start-4 flex items-center justify-between gap-2 lg:col-start-5 lg:row-start-1 lg:block lg:text-center">
                        <span className="text-sm text-gray-500 lg:hidden">
                          Subtotal
                        </span>
                        <span className="whitespace-nowrap bold-16 text-secondary">
                          {formatThousandsVnd(
                            product.price[item.size] * quantity,
                            currency,
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${product.title}, size ${item.size}`}
                        onClick={() =>
                          runCartUpdate(() =>
                            updateQuantity(item._id, item.size, 0),
                          )
                        }
                        disabled={isUpdatingCart}
                        className="col-start-3 row-start-1 mx-auto cursor-pointer rounded-md p-2 transition hover:bg-primary disabled:opacity-40 lg:col-start-6"
                      >
                        <img src={assets.cartRemove} alt="" width={22} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-0 z-20 mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-xl border border-secondary/10 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] sm:p-5">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1">
                    <CartCheckbox
                      inputRef={footerSelectAllRef}
                      disabled={
                        isUpdatingCart || availableCartData.length === 0
                      }
                      checked={allItemsSelected}
                      onChange={toggleAllItems}
                      indeterminate={someItemsSelected}
                      label="Select all products"
                    />
                    <span className="text-sm">
                      Select All ({availableCartData.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedItems}
                    disabled={isUpdatingCart || selectedItemKeys.size === 0}
                    className="cursor-pointer rounded-md px-2 py-2 text-sm text-gray-500 transition hover:bg-primary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-4 lg:w-auto lg:justify-end lg:gap-6">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm">
                        Total ({selectedCount} items):
                      </span>
                      <span className="text-xl font-bold text-secondary">
                        {formatThousandsVnd(subtotal, currency)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={selectedItemKeys.size === 0 || isUpdatingCart}
                    className="btn-dark w-full !rounded-md disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-white px-6 py-16 text-center">
              <h2 className="text-xl font-semibold">Your cart is empty</h2>
              <p className="mt-2 text-gray-500">
                Add some products before checking out.
              </p>
              <button
                type="button"
                onClick={() => navigate("/collection")}
                className="btn-dark mt-6 !rounded-md"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </section>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_379px] xl:items-start">
          {/* Address Form bên trái */}
          <CheckoutAddressForm
            onOrderCreated={handleOrderCreated}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            selectedItemKeys={selectedItemKeys}
            address={checkoutAddress}
            setAddress={setCheckoutAddress}
          />

          {/* CartTotal vẫn bên phải */}
          <aside className="w-full xl:w-[379px]">
            <div className="w-full rounded-xl bg-white p-5 py-8 xl:sticky xl:top-28">
              <CartTotal
                currentStep={2}
                isSubmitting={isSubmitting}
                selectedItemKeys={selectedItemKeys}
                onBack={() => {
                  setCurrentStep(1);
                  window.scrollTo(0, 0);
                }}
              />
            </div>
          </aside>
        </div>
      )}

      {/* STEP 3 QR */}
      {currentStep === 3 && createdOrder?.paymentMethod === "QR" && (
        <QrPaymentStatus
          initialOrder={createdOrder}
          onExpired={handleQrExpired}
          onCancelled={handleQrCancelled}
        />
      )}

      {/* STEP 3 COD */}
      {currentStep === 3 && createdOrder?.paymentMethod === "COD" && (
        <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
            {"\u2713"}
          </div>

          <h2 className="mt-5 text-2xl font-semibold">
            Order placed successfully
          </h2>

          <p className="mt-3 text-gray-500">
            Your order has been created. You will pay when it is delivered.
          </p>

          <button
            type="button"
            onClick={() => navigate("/my-orders")}
            className="btn-dark mt-8 !rounded-md"
          >
            View My Orders
          </button>
        </div>
      )}
    </div>
  ) : null;
};

export default Cart;
