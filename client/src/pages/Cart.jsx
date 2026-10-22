import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { useBlocker } from "react-router-dom";
import CartSizePicker from "../components/CartSizePicker";
import CartActionBar from "../components/CartActionBar";
import ProductImage from "../components/ProductImage";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/data";
import { formatThousandsVnd } from "../utils/money";
import { URGENT_SHIPPING_NOTE } from "../utils/orderPricing";
import {
  getCartItemKey,
  changeSizeSelection,
  getAvailableCartItems,
  sortCartItemsByAvailability,
} from "../utils/cartSelection";
import { getSizeQuantity } from "../utils/productStock";
import { initialCheckoutAddress } from "../utils/checkoutAddress";
import { getCartRowKey, getOrderedCartItems } from "../utils/cartOrder";
import useCheckoutQuote from "../hooks/useCheckoutQuote";

const CartTotal = lazy(() => import("../components/CartTotal"));
const QrPaymentStatus = lazy(() => import("../components/QrPaymentStatus"));
const CheckoutAddressForm = lazy(() => import("../components/checkout/CheckoutAddressForm"));

// Mount only during checkout so the QR screen keeps its own cancellation guard.
const CheckoutBackGuard = ({ onBack, isSubmitting }) => {
  const blocker = useBlocker(({ historyAction }) => historyAction === "POP");

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    blocker.reset();
    if (!isSubmitting) onBack();
  }, [blocker, isSubmitting, onBack]);

  return null;
};

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
    pendingCartKeys,
    hasPendingCartUpdates,
    changeCartSize,
    axios,
    getToken,
    fetchProducts,
    storeResources,
  } = useAppContext();
  const userId = user?.id;

  const [currentStep, setCurrentStep] = useState(1);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingSize, setIsChangingSize] = useState(false);
  const isUpdatingCart = isChangingSize || pendingCartKeys.length > 0;
  const cartUpdateRef = useRef(false);
  const [checkoutAddress, setCheckoutAddress] = useState(
    initialCheckoutAddress,
  );
  const [orderNote, setOrderNote] = useState("");
  const [deselectedItemKeys, setDeselectedItemKeys] = useState(() => new Set());
  const selectAllRef = useRef(null);
  const footerSelectAllRef = useRef(null);
  const cartContentRef = useRef(null);
  const checkoutContentRef = useRef(null);

  const cartData = useMemo(() => {
    if (products.length === 0) return [];

    return sortCartItemsByAvailability(
      getOrderedCartItems(cartItems, cartAddedAt),
      products,
    );
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
  const unavailableCartData = useMemo(
    () => cartData.filter((item) => !availableItemKeys.has(getCartItemKey(item._id, item.size))),
    [cartData, availableItemKeys],
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
  const checkout = useCheckoutQuote(selectedItemKeys, currentStep !== 3);
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
    if (!userId) return undefined;

    let isActive = true;
    const controller = new AbortController();

    const restorePendingPayment = async () => {
      try {
        const token = await getToken();
        controller.signal.throwIfAborted();
        const { data } = await axios.get("/api/orders/pending-payment", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        });

        if (isActive && data.success && data.order) {
          setCreatedOrder(data.order);
          setCurrentStep(3);
        }
      } catch {
        // The cart remains usable if no pending payment can be restored.
      }
    };

    restorePendingPayment();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [axios, getToken, userId]);

  const runCartUpdate = async (update) => {
    if (cartUpdateRef.current || hasPendingCartUpdates()) return { success: false };
    cartUpdateRef.current = true;
    setIsChangingSize(true);
    try {
      return await update();
    } finally {
      cartUpdateRef.current = false;
      setIsChangingSize(false);
    }
  };

  const handleSizeChange = (productId, fromSize, toSize) =>
    runCartUpdate(async () => {
      const targetExists = Number(cartItems[productId]?.[toSize] ?? 0) > 0;
      const previousSelection = deselectedItemKeys;
      setDeselectedItemKeys((current) =>
        changeSizeSelection(current, productId, fromSize, toSize, targetExists),
      );
      const result = await changeCartSize(productId, fromSize, toSize);
      if (!result.success) setDeselectedItemKeys(previousSelection);
      return result;
    });

  const increment = (productId, size) => {
    const quantity = cartItems[productId]?.[size] || 0;

    updateQuantity(productId, size, quantity + 1);
  };

  const decrement = (productId, size) => {
    const quantity = cartItems[productId]?.[size] || 0;

    if (quantity > 1) {
      updateQuantity(productId, size, quantity - 1);
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
  const removeSelectedItems = () => {
    if (cartUpdateRef.current) return;
    return Promise.all(selectedItems.map((item) => updateQuantity(item._id, item.size, 0)));
  };
  const removeUnavailableItems = () => {
    if (cartUpdateRef.current || hasPendingCartUpdates()) return;
    return Promise.all(unavailableCartData.map((item) => updateQuantity(item._id, item.size, 0)));
  };

  const handleCheckout = () => {
    if (cartUpdateRef.current || hasPendingCartUpdates()) return;
    if (selectedItemKeys.size === 0) {
      return toast.error("Vui lòng chọn ít nhất một sản phẩm");
    }

    if (!user) {
      return toast.error("Vui lòng đăng nhập trước khi thanh toán");
    }

    setCurrentStep(2);
    window.scrollTo(0, 0);
  };

  const handleOrderCreated = (order) => {
    storeResources.invalidateMembership();
    setCreatedOrder(order);
    setCurrentStep(3);
    window.scrollTo(0, 0);
  };

  const handleQrExpired = () => {
    storeResources.invalidateMembership();
    setCreatedOrder(null);
    setCurrentStep(1);
    window.scrollTo(0, 0);
  };

  const handleQrCancelled = useCallback(() => {
    storeResources.invalidateMembership();
    setCreatedOrder(null);
    setCurrentStep(2);
    window.scrollTo(0, 0);
  }, [storeResources]);

  const handleBackToCart = useCallback(() => {
    setCurrentStep(1);
    window.scrollTo(0, 0);
  }, []);

  return products && cartItems ? (
    <div className="net-cart py-16 pt-28">
      <div className="max-padd-container">
      {/* STEP 1 */}
      {currentStep === 1 && (
        <section className="min-w-0 text-[95%]">
          <header className="net-cart-heading">
            <h1>Giỏ hàng</h1>
          </header>
          {cartData.length > 0 ? (
            <div ref={cartContentRef}>
              <div className="net-cart-table-head hidden shrink-0 grid-cols-[48px_minmax(0,1fr)_120px_140px_140px_80px] items-center gap-3 rounded-xl bg-white px-4 py-3 lg:grid">
                <CartCheckbox
                  inputRef={selectAllRef}
                  disabled={isChangingSize || availableCartData.length === 0}
                  checked={allItemsSelected}
                  onChange={toggleAllItems}
                  indeterminate={someItemsSelected}
                  label="Chọn tất cả sản phẩm"
                />
                <h5 className="h5">Sản phẩm</h5>
                <h5 className="h5 text-center">Đơn giá</h5>
                <h5 className="h5 text-center">Số lượng</h5>
                <h5 className="h5 text-center">Thành tiền</h5>
                <h5 className="h5 text-center">Thao tác</h5>
              </div>

              <div
                role="region"
                aria-label="Sản phẩm trong giỏ hàng"
                className="mt-3 space-y-3"
              >
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
                      key={getCartRowKey(item)}
                      className={`net-cart-item grid grid-cols-[32px_minmax(0,1fr)_40px] items-center gap-x-2 gap-y-4 rounded-xl px-3 py-5 transition sm:gap-x-3 sm:px-4 lg:grid-cols-[48px_minmax(0,1fr)_120px_140px_140px_80px] lg:py-6 ${isUnavailable ? "bg-white/40 [&>div]:opacity-50" : isSelected ? "bg-white" : "bg-white/60"}`}
                    >
                      <div className="col-start-1 row-start-1">
                        <CartCheckbox
                          disabled={isChangingSize || isUnavailable}
                          checked={isSelected}
                          onChange={() => toggleItemSelection(itemKey)}
                          label={`Chọn ${product.title}, dung tích ${item.size}`}
                        />
                      </div>
                      <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap xl:gap-5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <ProductImage
                            src={product.images[0]}
                            imageWidth={200}
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
                                Đã hết hàng — vui lòng xóa khỏi giỏ hàng
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
                          Đơn giá
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
                          Số lượng
                        </span>
                        <div className="inline-flex items-center overflow-hidden rounded-full bg-primary ring-1 ring-slate-900/15">
                          <button
                            type="button"
                            aria-label={`Giảm số lượng ${product.title}, dung tích ${item.size}`}
                            onClick={() => decrement(item._id, item.size)}
                            disabled={
                              isChangingSize || isUnavailable || quantity <= 1
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
                            aria-label={`Tăng số lượng ${product.title}, dung tích ${item.size}`}
                            onClick={() => increment(item._id, item.size)}
                            disabled={
                              isChangingSize ||
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
                          Thành tiền
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
                        aria-label={`Xóa ${product.title}, dung tích ${item.size}`}
                        onClick={() =>
                          updateQuantity(item._id, item.size, 0)
                        }
                        disabled={isChangingSize}
                        className="col-start-3 row-start-1 mx-auto cursor-pointer rounded-md p-2 transition hover:bg-primary disabled:opacity-40 lg:col-start-6"
                      >
                        <img src={assets.cartRemove} alt="" width={22} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <CartActionBar contentRef={cartContentRef}>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1">
                    <CartCheckbox
                      inputRef={footerSelectAllRef}
                      disabled={
                        isChangingSize || availableCartData.length === 0
                      }
                      checked={allItemsSelected}
                      onChange={toggleAllItems}
                      indeterminate={someItemsSelected}
                      label="Chọn tất cả sản phẩm"
                    />
                    <span className="text-sm">
                      Chọn tất cả ({availableCartData.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedItems}
                    disabled={isUpdatingCart || selectedItemKeys.size === 0}
                    className="cursor-pointer rounded-md px-2 py-2 text-sm text-gray-500 transition hover:bg-primary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Xóa tất cả
                  </button>
                  <button
                    type="button"
                    onClick={removeUnavailableItems}
                    disabled={isUpdatingCart || unavailableCartData.length === 0}
                    className="cursor-pointer rounded-md px-2 py-2 text-sm text-gray-500 transition hover:bg-primary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Xóa sản phẩm hết hàng
                  </button>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-4 lg:w-auto lg:justify-end lg:gap-6">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm">
                        Tổng cộng ({selectedCount} sản phẩm):
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
                    className="btn-dark w-full !rounded-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"
                  >
                    {isUpdatingCart ? "Đang lưu thay đổi…" : "Tiến hành thanh toán"}
                  </button>
                </div>
              </CartActionBar>
            </div>
          ) : (
            <div className="rounded-xl bg-white px-6 py-16 text-center">
              <h2 className="text-xl font-semibold">Giỏ hàng của bạn đang trống</h2>
              <p className="mt-2 text-gray-500">
                Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán.
              </p>
              <button
                type="button"
                onClick={() => navigate("/collection")}
                className="btn-dark mt-6 !rounded-full"
              >
                Tiếp tục mua sắm
              </button>
            </div>
          )}
        </section>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && <CheckoutBackGuard onBack={handleBackToCart} isSubmitting={isSubmitting} />}
      {currentStep === 2 && (
        <Suspense fallback={<p role="status" className="py-12 text-center">Đang tải thông tin thanh toán…</p>}>
          <div ref={checkoutContentRef} className="space-y-4 text-[95%]">
            <CheckoutAddressForm
              checkout={checkout}
              onOrderCreated={handleOrderCreated}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              selectedItemKeys={selectedItemKeys}
              address={checkoutAddress}
              setAddress={setCheckoutAddress}
              orderNote={orderNote}
            />
            <CartTotal
              checkout={checkout}
              contentRef={checkoutContentRef}
              isSubmitting={isSubmitting || isUpdatingCart}
              selectedItemKeys={selectedItemKeys}
              orderNote={orderNote}
              setOrderNote={setOrderNote}
              onBack={handleBackToCart}
            />
          </div>
        </Suspense>
      )}

      {/* STEP 3 QR */}
      {currentStep === 3 && createdOrder?.paymentMethod === "QR" && (
        <Suspense fallback={<p role="status" className="py-12 text-center">Đang tải thông tin thanh toán…</p>}>
        <QrPaymentStatus
          initialOrder={createdOrder}
          onExpired={handleQrExpired}
          onCancelled={handleQrCancelled}
        />
        </Suspense>
      )}

      {/* STEP 3 COD */}
      {currentStep === 3 && createdOrder?.paymentMethod === "COD" && (
        <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
            {"\u2713"}
          </div>

          <h2 className="mt-5 text-2xl font-semibold">
            Đặt hàng thành công
          </h2>

          <p className="mt-3 text-gray-500">
            Đơn hàng của bạn đã được tạo. Bạn sẽ thanh toán khi nhận hàng.
          </p>
          {createdOrder.shippingMethod === "urgent" && <p className="mt-3 text-sm text-gray-500">{URGENT_SHIPPING_NOTE}</p>}

          <button
            type="button"
            onClick={() => navigate("/my-orders")}
            className="btn-dark mt-8 !rounded-full"
          >
            Xem đơn hàng của tôi
          </button>
        </div>
      )}
      </div>
    </div>
  ) : null;
};

export default Cart;
