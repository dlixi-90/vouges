import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { Link, useBlocker, useLocation } from "react-router-dom";
import CartSizePicker from "../components/CartSizePicker";
import CartSummary from "../components/CartSummary";
import CheckoutVoucherPicker from "../components/checkout/CheckoutVoucherPicker";
import ProductImage from "../components/ProductImage";
import { getSizeImage } from "../utils/productImage";
import { useAppContext } from "../context/AppContext";
import { formatVnd } from "../utils/money";
import { URGENT_SHIPPING_NOTE } from "../utils/orderPricing";
import {
  getCartItemKey,
  changeSizeSelection,
  getAvailableCartItems,
  sortCartItemsByAvailability,
} from "../utils/cartSelection";
import { getPurchaseLimit } from "../utils/productStock";
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
  const { state: navigationState } = useLocation();
  const {
    navigate,
    user,
    products,
    productsLoading,
    productsError,
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

  const [currentStep, setCurrentStep] = useState(() => navigationState?.checkoutRequest ? 2 : 1);
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
    if (selectAllRef.current) selectAllRef.current.indeterminate = someItemsSelected;
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
    window.scrollTo(0, 0);
    if (order.paymentMethod === "COD" && order._id) {
      navigate(`/order-overview/${order._id}`, { replace: true });
      return;
    }
    setCreatedOrder(order);
    setCurrentStep(3);
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
    <div className={`net-cart py-16 pt-28 ${currentStep === 1 ? "inessa-cart-page" : currentStep === 2 ? "inessa-checkout-page" : ""}`}>
      <div className="max-padd-container">
      {/* STEP 1 */}
      {currentStep === 1 && (
        <section className="inessa-cart-section" aria-labelledby="cart-page-title">
          <header className="net-cart-heading inessa-cart-heading">
            <h1 id="cart-page-title">Giỏ hàng</h1>
          </header>
          {productsError ? <p role="alert">{productsError} <button type="button" onClick={fetchProducts} className="underline">Thử lại</button></p> : productsLoading && !cartData.length ? <p role="status">Đang tải giỏ hàng…</p> : cartData.length > 0 ? (
            <div className="inessa-cart-layout">
              <div className="inessa-cart-products">
                <div className="inessa-cart-table-wrap">
                  <table className="inessa-cart-table">
                    <caption className="sr-only">Sản phẩm trong giỏ hàng</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="inessa-cart-select-cell">
                          <CartCheckbox inputRef={selectAllRef} disabled={isChangingSize || availableCartData.length === 0}
                            checked={allItemsSelected} onChange={toggleAllItems} indeterminate={someItemsSelected} label="Chọn tất cả sản phẩm" />
                        </th>
                        <th scope="col" className="inessa-cart-remove-cell"><span className="sr-only">Xóa</span></th>
                        <th scope="col" className="inessa-cart-product-cell">Sản phẩm</th>
                        <th scope="col" className="inessa-cart-price-cell">Đơn giá</th>
                        <th scope="col" className="inessa-cart-quantity-cell">Số lượng</th>
                        <th scope="col" className="inessa-cart-subtotal-cell">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartData.map((item) => {
                        const product = products.find((entry) => entry._id === item._id);
                        if (!product) return null;
                        const quantity = Number(cartItems[item._id]?.[item.size] ?? 0);
                        const itemKey = getCartItemKey(item._id, item.size);
                        const isSelected = selectedItemKeys.has(itemKey);
                        const isUnavailable = !availableItemKeys.has(itemKey);
                        if (quantity <= 0) return null;

                        return (
                          <tr key={getCartRowKey(item)} className={`inessa-cart-row ${isUnavailable ? "is-unavailable" : ""}`}>
                            <td className="inessa-cart-select-cell">
                              <CartCheckbox disabled={isChangingSize || isUnavailable} checked={isSelected}
                                onChange={() => toggleItemSelection(itemKey)} label={`Chọn ${product.title}, dung tích ${item.size}`} />
                            </td>
                            <td className="inessa-cart-remove-cell">
                              <button type="button" className="inessa-cart-remove" aria-label={`Xóa ${product.title}, dung tích ${item.size}`}
                                onClick={() => updateQuantity(item._id, item.size, 0)} disabled={isChangingSize}>
                                <X size={14} aria-hidden="true" />
                              </button>
                            </td>
                            <td className="inessa-cart-product-cell">
                              <div className="inessa-cart-product">
                                <Link to={`/collection/${product._id}`} className="inessa-cart-product-image" aria-label={`Xem chi tiết ${product.title}`}>
                                  <ProductImage src={getSizeImage(product, item.size)} imageWidth={160} alt="" />
                                </Link>
                                <div className="inessa-cart-product-info">
                                  <Link to={`/collection/${product._id}`} className="inessa-cart-product-name">{product.title}</Link>
                                  <CartSizePicker product={product} size={item.size} quantity={quantity} quantities={cartItems[item._id]}
                                    disabled={isUpdatingCart || isUnavailable} onConfirm={(size) => handleSizeChange(item._id, item.size, size)} />
                                  {isUnavailable && <p className="inessa-cart-unavailable" role="status">Đã hết hàng — vui lòng xóa khỏi giỏ hàng</p>}
                                </div>
                              </div>
                            </td>
                            <td className="inessa-cart-price-cell">
                              <span className="inessa-cart-mobile-label" aria-hidden="true">Đơn giá</span>
                              <span>{formatVnd(product.price[item.size], currency)}</span>
                            </td>
                            <td className="inessa-cart-quantity-cell">
                              <span className="inessa-cart-mobile-label" aria-hidden="true">Số lượng</span>
                              <div className="inessa-cart-quantity">
                                <button type="button" aria-label={`Giảm số lượng ${product.title}, dung tích ${item.size}`}
                                  onClick={() => decrement(item._id, item.size)} disabled={isChangingSize || isUnavailable || quantity <= 1}>
                                  <Minus size={13} aria-hidden="true" />
                                </button>
                                <span aria-label={`Số lượng ${product.title}, dung tích ${item.size}`}>{quantity}</span>
                                <button type="button" aria-label={`Tăng số lượng ${product.title}, dung tích ${item.size}`}
                                  onClick={() => increment(item._id, item.size)} disabled={isChangingSize || isUnavailable || quantity >= getPurchaseLimit(product, item.size)}>
                                  <Plus size={13} aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                            <td className="inessa-cart-subtotal-cell">
                              <span className="inessa-cart-mobile-label" aria-hidden="true">Thành tiền</span>
                              <span>{formatVnd(product.price[item.size] * quantity, currency)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="inessa-cart-table-actions">
                    <p role="status">{isUpdatingCart ? "Đang lưu thay đổi…" : `Đã chọn ${selectedItemKeys.size}/${availableCartData.length} phân loại sản phẩm`}</p>
                    <div>
                      <button type="button" onClick={toggleAllItems} disabled={isChangingSize || availableCartData.length === 0}>
                        {allItemsSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </button>
                      <button type="button" onClick={removeSelectedItems} disabled={isUpdatingCart || selectedItemKeys.size === 0}>Xóa đã chọn</button>
                      {unavailableCartData.length > 0 && <button type="button" onClick={removeUnavailableItems} disabled={isUpdatingCart}>Xóa sản phẩm hết hàng</button>}
                    </div>
                  </div>
                  <div className="inessa-cart-voucher">
                    <CheckoutVoucherPicker checkout={checkout} subtotal={subtotal} disabled={isUpdatingCart || selectedItemKeys.size === 0} compact />
                  </div>
                </div>
              </div>
              <CartSummary checkout={checkout} subtotal={subtotal} selectedCount={selectedCount} isUpdatingCart={isUpdatingCart} onCheckout={handleCheckout} />
            </div>
          ) : (
            <div className="inessa-cart-empty">
              <div className="inessa-cart-empty-message">
                <ShoppingBag size={20} strokeWidth={1.5} aria-hidden="true" />
                <h2>Giỏ hàng của bạn đang trống</h2>
              </div>
              <p>Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán.</p>
              <Link to="/collection" className="btn-dark">Tiếp tục mua sắm</Link>
            </div>
          )}
        </section>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && <CheckoutBackGuard onBack={handleBackToCart} isSubmitting={isSubmitting} />}
      {currentStep === 2 && (
        <Suspense fallback={<p role="status" className="py-12 text-center">Đang tải thông tin thanh toán…</p>}>
          <CartTotal
            checkout={checkout}
            isSubmitting={isSubmitting || isUpdatingCart}
            selectedItemKeys={selectedItemKeys}
            orderNote={orderNote}
            setOrderNote={setOrderNote}
            onBack={handleBackToCart}
          >
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
          </CartTotal>
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
