import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { getCartItemKey } from "../utils/cartSelection";

export default function useCheckoutQuote(selectedItemKeys, enabled = true) {
  const { cartItems, user, axios, getToken, products } = useAppContext();
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [voucherCode, setVoucherCode] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const items = Object.entries(cartItems).flatMap(([product, sizes]) =>
    Object.entries(sizes).filter(([size, quantity]) => quantity > 0 && selectedItemKeys.has(getCartItemKey(product, size)))
      .map(([size, quantity]) => ({ product, size, quantity: Number(quantity) })));
  // One server quote includes every shipping method for these items and voucher.
  // Switching methods selects a quoted total without invalidating the request.
  const requestBody = JSON.stringify({ items, voucherCode });
  // Refresh the quote after catalog updates, including changed prices and stock.
  const catalogKey = JSON.stringify(items.map((item) => {
    const product = products.find((entry) => entry._id === item.product);
    return [product?.price?.[item.size], product?.stockBySize?.[item.size], product?.inStock,
      product?.inStockBySize?.[item.size], product?.isDeleted, product?.sizes?.includes(item.size)];
  }));
  const key = `${user?.id || ""}:${requestBody}:${catalogKey}:${revision}`;
  useEffect(() => {
    if (!user?.id || !enabled || !JSON.parse(requestBody).items.length) return undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await axios.post("/api/orders/quote", JSON.parse(requestBody), {
          headers: { Authorization: `Bearer ${await getToken()}` }, signal: controller.signal,
        });
        if (!data.success) throw new Error(data.message);
        if (!controller.signal.aborted) setResult({ key, pricing: data.pricing,
          shippingMethods: data.shippingMethods, shippingQuotes: data.shippingQuotes });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: error.response?.data?.message || error.message });
      }
    }, 200);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [axios, getToken, user?.id, requestBody, key, enabled]);
  const current = result?.key === key ? result : null;
  const shippingQuote = current?.shippingQuotes?.[shippingMethod];
  const pricing = current?.pricing && shippingQuote ? { ...current.pricing, ...shippingQuote } : undefined;
  return { shippingMethod, setShippingMethod, voucherCode, setVoucherCode,
    pricing, shippingMethods: current?.shippingMethods, shippingQuotes: current?.shippingQuotes,
    error: current?.error || (current?.pricing && !shippingQuote ? "Không có báo giá cho phương thức giao hàng này. Vui lòng thử lại." : undefined),
    loading: Boolean(enabled && user?.id && items.length && !current),
    ready: Boolean(pricing && enabled), refresh: () => setRevision((value) => value + 1) };
}
