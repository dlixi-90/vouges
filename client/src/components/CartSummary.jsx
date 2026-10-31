import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { formatVnd } from "../utils/money";

const CartSummary = ({
  checkout,
  subtotal,
  selectedCount,
  isUpdatingCart,
  onCheckout,
}) => {
  const { currency } = useAppContext();
  const formatPrice = (value) => formatVnd(value, currency);
  const hasSelection = selectedCount > 0;
  const pricing = hasSelection && checkout.ready ? checkout.pricing : null;

  return (
    <aside className="inessa-cart-summary" aria-labelledby="cart-totals-title">
      <div className="inessa-cart-totals">
        <h2 id="cart-totals-title">Tổng giỏ hàng</h2>
        <div className="inessa-cart-totals-content">
          <dl aria-busy={checkout.loading || isUpdatingCart}>
            <div>
              <dt>Tạm tính</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {pricing?.discount > 0 && (
              <div className="inessa-cart-discount">
                <dt>Giảm giá</dt>
                <dd>−{formatPrice(pricing.discount)}</dd>
              </div>
            )}
            <div className="inessa-cart-grand-total">
              <dt>Tổng cộng</dt>
              <dd>
                {!hasSelection
                  ? formatPrice(0)
                  : pricing
                    ? formatPrice(pricing.amount)
                    : "—"}
              </dd>
            </div>
          </dl>
          {checkout.loading && (
            <p role="status" className="inessa-cart-summary-note">
              Đang cập nhật tổng tiền…
            </p>
          )}
          {checkout.error && (
            <div role="alert" className="inessa-cart-quote-error">
              <p>{checkout.error}</p>
              <button
                type="button"
                onClick={checkout.refresh}
                disabled={isUpdatingCart}
              >
                Thử lại
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onCheckout}
            disabled={!hasSelection || isUpdatingCart}
            className="btn-dark inessa-cart-checkout"
          >
            {isUpdatingCart ? "Đang lưu thay đổi…" : "Tiến hành thanh toán"}
          </button>
        </div>
      </div>
      <Link to="/collection" className="inessa-cart-continue">
        <ArrowLeft size={16} aria-hidden="true" />
        Tiếp tục mua sắm
      </Link>
    </aside>
  );
};

export default CartSummary;
