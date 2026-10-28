import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Package, Plus, ShoppingBag, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { getCartItemKey, getAvailableCartItems, sortCartItemsByAvailability } from "../utils/cartSelection";
import { getCartRowKey, getOrderedCartItems } from "../utils/cartOrder";
import { getPurchaseLimit } from "../utils/productStock";
import { formatVnd } from "../utils/money";
import ProductImage from "./ProductImage";
import { getSizeImage } from "../utils/productImage";

export default function CartDrawer() {
  const {
    products, productsLoading, productsError, fetchProducts, cartItems, cartAddedAt, currency, closeCart, navigate,
    updateQuantity, pendingCartKeys, hasPendingCartUpdates,
  } = useAppContext();
  const dialogRef = useRef(null);
  const [updateError, setUpdateError] = useState("");
  const items = useMemo(() => sortCartItemsByAvailability(
    getOrderedCartItems(cartItems, cartAddedAt), products,
  ), [cartItems, cartAddedAt, products]);
  const availableItems = useMemo(() => getAvailableCartItems(items, products), [items, products]);
  const availableKeys = new Set(availableItems.map((item) => getCartItemKey(item._id, item.size)));
  const productsById = new Map(products.map((product) => [product._id, product]));
  const subtotal = availableItems.reduce((total, item) => total
    + Number(productsById.get(item._id)?.price?.[item.size] || 0)
      * Number(cartItems[item._id]?.[item.size] || 0), 0);
  const updating = hasPendingCartUpdates();
  const loading = productsLoading && items.length > 0;
  const formatPrice = (value) => formatVnd(value, currency);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const changeQuantity = async (itemId, size, quantity) => {
    setUpdateError("");
    const result = await updateQuantity(itemId, size, quantity);
    if (!result.success && !result.cancelled) {
      setUpdateError(result.message || "Không thể cập nhật giỏ hàng. Vui lòng thử lại.");
    }
  };

  const checkout = () => {
    if (loading || !availableItems.length || hasPendingCartUpdates()) return;
    closeCart();
    navigate("/cart", { state: { checkoutRequest: crypto.randomUUID() } });
    window.scrollTo(0, 0);
  };

  return (
    <dialog
      ref={dialogRef}
      id="velours-cart-drawer"
      className="inessa-cart-drawer"
      aria-labelledby="cart-drawer-title"
      onCancel={(event) => { event.preventDefault(); closeCart(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) closeCart();
      }}
    >
      <header className="inessa-cart-drawer-header">
        <h2 id="cart-drawer-title">Giỏ hàng của bạn</h2>
        <button type="button" onClick={closeCart} className="inessa-cart-drawer-close" aria-label="Đóng giỏ hàng">
          <X size={24} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      {updateError && <p role="alert" className="inessa-cart-drawer-error">{updateError}</p>}
      {productsError && <p role="alert" className="inessa-cart-drawer-error">{productsError} <button type="button" onClick={fetchProducts} className="underline">Thử lại</button></p>}

      <div className="inessa-cart-drawer-items" aria-label="Sản phẩm trong giỏ hàng">
        {loading ? <p role="status" className="inessa-cart-drawer-loading">Đang tải giỏ hàng…</p> : items.length ? items.map((item) => {
          const product = productsById.get(item._id);
          const quantity = Number(cartItems[item._id]?.[item.size] || 0);
          const key = getCartItemKey(item._id, item.size);
          const available = availableKeys.has(key);
          const title = product?.title || "Sản phẩm không còn bán";
          const price = Number(product?.price?.[item.size] || 0);
          const image = getSizeImage(product, item.size);
          return (
            <article key={getCartRowKey(item)} className="inessa-cart-drawer-item" aria-busy={pendingCartKeys.includes(key)}>
              <div className="inessa-cart-drawer-thumbnail">
                {image ? <ProductImage src={image} imageWidth={160} alt={title} /> : <Package size={26} strokeWidth={1.2} aria-hidden="true" />}
              </div>
              <div className="inessa-cart-drawer-item-info">
                <div className="inessa-cart-drawer-item-title">
                  {product && !product.isDeleted
                    ? <Link to={`/collection/${item._id}`} onClick={closeCart}>{title}</Link>
                    : <span>{title}</span>}
                  <button type="button" onClick={() => changeQuantity(item._id, item.size, 0)} className="inessa-cart-drawer-remove" aria-label={`Xóa ${title}, ${item.size}`}>
                    <X size={15} strokeWidth={1.4} aria-hidden="true" />
                  </button>
                </div>
                <p className="inessa-cart-drawer-size">Dung tích: {item.size}</p>
                {!available && <p className="inessa-cart-drawer-unavailable">Sản phẩm hoặc dung tích không còn hàng</p>}
                <div className="inessa-cart-drawer-item-bottom">
                  <div className="inessa-cart-drawer-quantity" role="group" aria-label={`Số lượng ${title}, ${item.size}`}>
                    <button type="button" disabled={!available || quantity <= 1} onClick={() => changeQuantity(item._id, item.size, quantity - 1)} aria-label={`Giảm số lượng ${title}, ${item.size}`}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <output aria-live="polite" aria-label={`Số lượng ${title}, ${item.size}`}>{quantity}</output>
                    <button type="button" disabled={!available || quantity >= getPurchaseLimit(product, item.size)} onClick={() => changeQuantity(item._id, item.size, quantity + 1)} aria-label={`Tăng số lượng ${title}, ${item.size}`}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <span className="inessa-cart-drawer-line-total">{formatPrice(price * quantity)}</span>
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="inessa-cart-drawer-empty">
            <ShoppingBag size={45} strokeWidth={1} aria-hidden="true" />
            <h3>Giỏ hàng đang trống</h3>
            <p>Khám phá bộ sưu tập và tìm sản phẩm yêu thích của bạn.</p>
            <Link to="/collection" onClick={closeCart} className="inessa-button">Tiếp tục mua sắm</Link>
          </div>
        )}
      </div>

      {items.length > 0 && <footer className="inessa-cart-drawer-footer">
        <div className="inessa-cart-drawer-subtotal">
          <span>Tạm tính</span><strong aria-live="polite">{loading ? "—" : formatPrice(subtotal)}</strong>
        </div>
        {!loading && availableItems.length < items.length && <p className="inessa-cart-drawer-note">Tạm tính chỉ gồm sản phẩm còn hàng.</p>}
        <div className="inessa-cart-drawer-actions">
          <Link to="/cart" onClick={closeCart} className="inessa-cart-drawer-button">Xem giỏ hàng</Link>
          <button type="button" onClick={checkout} disabled={loading || !availableItems.length || updating} className="inessa-cart-drawer-button">{loading ? "Đang tải…" : updating ? "Đang cập nhật…" : "Thanh toán"}</button>
        </div>
      </footer>}
    </dialog>
  );
}
