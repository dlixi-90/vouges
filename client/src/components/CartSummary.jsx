import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { formatThousandsVnd } from "../utils/money";
import { URGENT_SHIPPING_NOTE } from "../utils/orderPricing";

const CartSummary = ({ checkout, subtotal, selectedCount, isUpdatingCart, onCheckout }) => {
  const { currency, user } = useAppContext();
  const formatPrice = (value) => formatThousandsVnd(value, currency);
  const hasSelection = selectedCount > 0;
  const pricing = hasSelection && checkout.ready ? checkout.pricing : null;
  const isUrgentShipping = checkout.shippingMethod === "urgent";

  return (
    <aside className="inessa-cart-summary" aria-labelledby="cart-totals-title">
      <div className="inessa-cart-totals">
        <h2 id="cart-totals-title">Tổng giỏ hàng</h2>
        <div className="inessa-cart-totals-content">
          <dl aria-busy={checkout.loading || isUpdatingCart}>
            <div><dt>Tạm tính</dt><dd>{formatPrice(subtotal)}</dd></div>
            <div><dt>Phí giao hàng</dt><dd>{!hasSelection ? formatPrice(0) : pricing ? isUrgentShipping ? "Thanh toán sau" : pricing.shipping === 0 ? "Miễn phí" : formatPrice(pricing.shipping) : "—"}</dd></div>
            {pricing?.discount > 0 && <div className="inessa-cart-discount"><dt>Giảm giá</dt><dd>−{formatPrice(pricing.discount)}</dd></div>}
            <div className="inessa-cart-grand-total"><dt>Tổng cộng</dt><dd>{!hasSelection ? formatPrice(0) : pricing ? formatPrice(pricing.amount) : "—"}</dd></div>
          </dl>
          {checkout.loading && <p role="status" className="inessa-cart-summary-note">Đang cập nhật tổng tiền…</p>}
          {checkout.error && <div role="alert" className="inessa-cart-quote-error">
            <p>{checkout.error}</p>
            <button type="button" onClick={checkout.refresh} disabled={isUpdatingCart}>Thử lại</button>
          </div>}
          <button type="button" onClick={onCheckout} disabled={!hasSelection || isUpdatingCart} className="btn-dark inessa-cart-checkout">
            {isUpdatingCart ? "Đang lưu thay đổi…" : "Tiến hành thanh toán"}
          </button>
          <p className="inessa-cart-summary-note">{selectedCount} sản phẩm được chọn</p>
          {pricing && isUrgentShipping ? <p className="inessa-cart-summary-note">{URGENT_SHIPPING_NOTE}</p>
            : <p className="inessa-cart-summary-note">{user ? "Phí giao hàng được tính theo phương thức bạn chọn khi thanh toán." : "Đăng nhập để xem phí giao hàng và tổng thanh toán."}</p>}
        </div>
      </div>
      <Link to="/collection" className="inessa-cart-continue"><ArrowLeft size={16} aria-hidden="true" />Tiếp tục mua sắm</Link>
    </aside>
  );
};

export default CartSummary;
