import { useClerk } from "@clerk/react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bot,
  Check,
  Eraser,
  LoaderCircle,
  Package,
  Send,
  Search,
  ShoppingCart,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AI_MESSAGE_MAX_LENGTH } from "../../apis/aiService";
import { useAppContext } from "../../context/AppContext";
import useAIAgent from "../../hooks/useAIAgent";

const suggestedPrompts = [
  "Bạn có thể giúp gì cho tôi?",
  "Hướng dẫn tôi chọn sản phẩm phù hợp",
  "So sánh hai sản phẩm phù hợp với da khô",
  "Đơn hàng gần nhất của tôi đang ở đâu?",
  "Trong giỏ hàng của tôi có gì?",
];

const getMessageStatusLabel = (status) => {
  if (status === "failed") return "Gửi thất bại";
  if (status === "cancelled") return "Đã hủy";
  return null;
};

const getToolActivityLabel = (toolsUsed = []) => {
  if (toolsUsed.some((toolName) => toolName.startsWith("prepare"))) {
    return "Đang chờ bạn xác nhận";
  }

  if (toolsUsed.includes("getMyOrders")) {
    return "Đã tra cứu đơn hàng của bạn";
  }

  if (toolsUsed.includes("getMyCart")) {
    return "Đã đọc giỏ hàng của bạn";
  }

  if (toolsUsed.includes("compareProducts")) {
    return "Đã so sánh dữ liệu sản phẩm";
  }

  return "Đã tra cứu catalog Velours";
};

const CART_ACTION_PRESENTATIONS = {
  addToCart: {
    title: "Xác nhận thêm vào giỏ",
    success: "Đã thêm vào giỏ",
    destructive: false,
  },
  updateCart: {
    title: "Xác nhận cập nhật giỏ",
    success: "Đã cập nhật giỏ",
    destructive: false,
  },
  removeFromCart: {
    title: "Xác nhận xóa khỏi giỏ",
    success: "Đã xóa khỏi giỏ",
    destructive: true,
  },
};

const getCartActionDescription = (action) => {
  if (action.type === "updateCart") {
    return `Size ${action.size} · ${action.currentQuantity} → ${action.quantity}`;
  }

  if (action.type === "removeFromCart") {
    return `Size ${action.size} · Xóa ${action.currentQuantity} sản phẩm`;
  }

  return `Size ${action.size} · Thêm ${action.quantity} sản phẩm`;
};

const ORDER_STATUS_LABELS = {
  "Awaiting Payment": "Chờ thanh toán",
  "Payment Review": "Đang xác minh",
  "Order Placed": "Đã đặt hàng",
  Packing: "Đang đóng gói",
  Shipping: "Đang giao hàng",
  Delivery: "Đã giao hàng",
};

const getOrderStatusStyles = (status) => {
  if (status === "Delivery") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (["Shipping", "Packing"].includes(status)) {
    return "bg-blue-50 text-blue-700";
  }

  if (["Awaiting Payment", "Payment Review"].includes(status)) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
};

const formatMoney = (total) => {
  const amount = Number(total?.amount);
  const currency = total?.currency || "VND";

  if (!Number.isFinite(amount)) return "—";

  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("vi-VN")} ${currency}`.trim();
  }
};

const formatOrderDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatProductPrice = (priceRange) => {
  const minimumPrice = Number(priceRange?.min);
  const maximumPrice = Number(priceRange?.max);
  const currency = priceRange?.currency || "";

  if (!Number.isFinite(minimumPrice)) return "Liên hệ";

  const formattedMinimum = minimumPrice.toLocaleString("vi-VN");

  if (!Number.isFinite(maximumPrice) || maximumPrice === minimumPrice) {
    return `${formattedMinimum} ${currency}`.trim();
  }

  return `${formattedMinimum}–${maximumPrice.toLocaleString("vi-VN")} ${currency}`.trim();
};

const AIChatPanel = ({ isOpen, onClose }) => {
  const { openSignIn } = useClerk();
  const { addToCart, getToken, updateQuantity, user, openCart, requireCartLogin } = useAppContext();
  const {
    messages,
    isSending,
    error,
    sendMessage,
    cancelRequest,
    clearMessages,
    clearError,
  } = useAIAgent({ getToken });

  const [input, setInput] = useState("");
  const [cartActionStates, setCartActionStates] = useState({});
  const cartActionsInFlightRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages, isSending]);

  useEffect(() => {
    if (!isOpen || !user) return;

    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen, user]);

  const handleInputChange = (event) => {
    setInput(event.target.value);
    if (error) clearError();
  };

  const submitMessage = async (content) => {
    const normalizedContent = String(content || "").trim();

    if (!normalizedContent || isSending) return;

    setInput("");
    const response = await sendMessage(normalizedContent);

    if (!response) {
      setInput((currentInput) => currentInput || normalizedContent);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    void submitMessage(input);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  };

  const handleConfirmCartAction = async (action) => {
    if (!requireCartLogin()) return;
    if (!action?.id || !CART_ACTION_PRESENTATIONS[action.type]) return;
    if (cartActionsInFlightRef.current.has(action.id)) return;

    cartActionsInFlightRef.current.add(action.id);

    setCartActionStates((currentStates) => ({
      ...currentStates,
      [action.id]: { status: "confirming", error: null },
    }));

    try {
      const result =
        action.type === "addToCart"
          ? await addToCart(
              action.productId,
              action.size,
              action.quantity,
            )
          : await updateQuantity(
              action.productId,
              action.size,
              action.type === "removeFromCart" ? 0 : action.quantity,
            );

      setCartActionStates((currentStates) => ({
        ...currentStates,
        [action.id]: result?.success
          ? { status: "confirmed", error: null }
          : {
              status: "failed",
              error: result?.message || "Không thể thêm sản phẩm vào giỏ",
            },
      }));
    } catch (actionError) {
      setCartActionStates((currentStates) => ({
        ...currentStates,
        [action.id]: {
          status: "failed",
          error: actionError.message || "Không thể thêm sản phẩm vào giỏ",
        },
      }));
    } finally {
      cartActionsInFlightRef.current.delete(action.id);
    }
  };

  const handleCancelCartAction = (actionId) => {
    if (!actionId) return;

    setCartActionStates((currentStates) => ({
      ...currentStates,
      [actionId]: { status: "cancelled", error: null },
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Đóng trợ lý AI"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/25 sm:hidden"
      />

      <section
        id="vouges-ai-chat-panel"
        role="dialog"
        aria-label="Trợ lý mua sắm Velours"
        className="fixed inset-x-3 top-20 bottom-3 z-50 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[calc(100vh-6rem)] sm:max-h-[680px] sm:w-[420px]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-50 via-orange-50 to-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">
                Velours AI
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Trợ lý mua sắm
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearMessages}
              disabled={messages.length === 0}
              aria-label="Xóa cuộc trò chuyện"
              title="Xóa cuộc trò chuyện"
              className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Eraser className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trợ lý AI"
              title="Đóng"
              className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex-1 overflow-y-auto px-4 py-5"
            aria-live="polite"
          >
            {!user ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <Bot className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Đăng nhập để bắt đầu
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Đăng nhập giúp bảo vệ cuộc trò chuyện và giới hạn quyền truy cập
                  vào trợ lý.
                </p>
                <button
                  type="button"
                  onClick={() => openSignIn()}
                  className="mt-5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-200 transition hover:from-amber-600 hover:to-orange-600"
                >
                  Đăng nhập
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-white shadow-lg shadow-secondary/20">
                  <Bot className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Xin chào! Tôi là Velours AI
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Tôi có thể hỗ trợ bạn tìm hiểu sản phẩm và chăm sóc sắc đẹp.
                </p>

                <div className="mt-5 flex w-full flex-col gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submitMessage(prompt)}
                      disabled={isSending}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const statusLabel = getMessageStatusLabel(message.status);
                  const isUserMessage = message.role === "user";
                  const pendingCartAction = message.pendingCartAction;
                  const cartActionState = pendingCartAction
                    ? cartActionStates[pendingCartAction.id] || {
                        status: "pending",
                        error: null,
                      }
                    : null;
                  const cartActionPresentation = pendingCartAction
                    ? CART_ACTION_PRESENTATIONS[pendingCartAction.type]
                    : null;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2.5 ${
                        isUserMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUserMessage && (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-secondary text-white">
                          <Bot className="h-4 w-4" aria-hidden="true" />
                        </div>
                      )}

                      <div
                        className={`max-w-[82%] ${
                          isUserMessage ? "text-right" : "text-left"
                        }`}
                      >
                        <div
                          className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            isUserMessage
                              ? "rounded-br-md bg-gradient-to-br from-amber-500 to-orange-500 text-white"
                              : "rounded-bl-md bg-slate-100 text-slate-800"
                          }`}
                        >
                          {message.content}
                        </div>
                        {!isUserMessage && message.toolsUsed?.length > 0 && (
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                              <Search
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {getToolActivityLabel(message.toolsUsed)}
                            </div>
                          )}
                        {!isUserMessage && message.products?.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.products.map((product) => (
                              <Link
                                key={product.id}
                                to={product.url}
                                onClick={onClose}
                                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
                              >
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.title}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Sparkles
                                      className="h-5 w-5 text-slate-400"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold text-slate-900">
                                    {product.title}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {product.type} ·{" "}
                                    {formatProductPrice(product.priceRange)}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {product.isAvailable === false ? (
                                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                        Hết hàng
                                      </span>
                                    ) : (
                                      product.availableOptions?.map((option) => (
                                        <span
                                          key={option.size}
                                          className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                                        >
                                          {option.size}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                        {!isUserMessage && message.orders?.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.orders.map((order) => {
                              const items = Array.isArray(order.items)
                                ? order.items
                                : [];

                              return (
                                <Link
                                  key={order.id}
                                  to="/my-orders"
                                  onClick={onClose}
                                  className="block overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
                                    <div className="min-w-0">
                                      <p className="truncate font-mono text-xs font-bold text-slate-800">
                                        Đơn #{String(order.id).slice(-8).toUpperCase()}
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-slate-500">
                                        {formatOrderDate(order.createdAt)}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getOrderStatusStyles(order.status)}`}
                                    >
                                      {ORDER_STATUS_LABELS[order.status] ||
                                        order.status ||
                                        "Chưa xác định"}
                                    </span>
                                  </div>

                                  <div className="space-y-2 px-3 py-2.5">
                                    {items.slice(0, 2).map((item, index) => (
                                      <div
                                        key={`${item.productId || "product"}-${item.size || "size"}-${index}`}
                                        className="flex items-center gap-2.5"
                                      >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                          {item.image ? (
                                            <img
                                              src={item.image}
                                              alt={item.title || "Sản phẩm"}
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <Package
                                              className="h-4 w-4 text-slate-400"
                                              aria-hidden="true"
                                            />
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-semibold text-slate-800">
                                            {item.title || "Sản phẩm"}
                                          </p>
                                          <p className="mt-0.5 text-[10px] text-slate-500">
                                            Size {item.size || "—"} · Số lượng{" "}
                                            {item.quantity || 0}
                                          </p>
                                        </div>
                                      </div>
                                    ))}

                                    {items.length > 2 && (
                                      <p className="text-[10px] font-medium text-slate-500">
                                        +{items.length - 2} sản phẩm khác
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
                                    <span className="text-[10px] font-medium text-slate-500">
                                      Xem trong My Orders
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">
                                      {formatMoney(order.total)}
                                    </span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                        {!isUserMessage && message.cart && (
                          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                  <ShoppingCart
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900">
                                    Giỏ hàng của bạn
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-500">
                                    {message.cart.itemCount || 0} sản phẩm ·{" "}
                                    {message.cart.lineCount || 0} lựa chọn
                                  </p>
                                </div>
                              </div>

                              {message.cart.hasUnavailableItems && (
                                <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                                  Cần kiểm tra
                                </span>
                              )}
                            </div>

                            {message.cart.items?.length > 0 ? (
                              <>
                                <div className="divide-y divide-slate-100 px-3">
                                  {message.cart.items
                                    .slice(0, 3)
                                    .map((item, index) => {
                                      const isReady =
                                        item.isAvailable &&
                                        item.hasEnoughStock;

                                      return (
                                        <div
                                          key={`${item.productId || "product"}-${item.size || "size"}-${index}`}
                                          className="flex items-center gap-2.5 py-2.5"
                                        >
                                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                                            {item.image ? (
                                              <img
                                                src={item.image}
                                                alt={item.title || "Sản phẩm"}
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              <Package
                                                className="h-4 w-4 text-slate-400"
                                                aria-hidden="true"
                                              />
                                            )}
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="truncate text-xs font-semibold text-slate-800">
                                                {item.title || "Sản phẩm"}
                                              </p>
                                              <span className="shrink-0 text-xs font-bold text-slate-900">
                                                {formatMoney(item.lineTotal)}
                                              </span>
                                            </div>
                                            <p className="mt-0.5 text-[10px] text-slate-500">
                                              Size {item.size || "—"} · Số lượng{" "}
                                              {item.quantity || 0}
                                            </p>
                                            <p
                                              className={`mt-1 text-[10px] font-medium ${
                                                isReady
                                                  ? "text-emerald-600"
                                                  : "text-red-600"
                                              }`}
                                            >
                                              {isReady
                                                ? "Sẵn sàng đặt hàng"
                                                : item.isAvailable
                                                  ? "Không đủ số lượng tồn kho"
                                                  : "Hiện không khả dụng"}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>

                                {message.cart.items.length > 3 && (
                                  <p className="border-t border-slate-100 px-3 py-2 text-[10px] font-medium text-slate-500">
                                    +{message.cart.items.length - 3} lựa chọn khác
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5">
                                  <div>
                                    <p className="text-[10px] text-slate-500">
                                      Tạm tính
                                    </p>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900">
                                      {formatMoney(message.cart.subtotal)}
                                    </p>
                                  </div>
                                  <Link
                                    to="/cart"
                                    onClick={(event) => { event.preventDefault(); if (openCart()) onClose(); }}
                                    className="rounded-full bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-700"
                                  >
                                    Mở giỏ hàng
                                  </Link>
                                </div>
                              </>
                            ) : (
                              <div className="px-4 py-5 text-center">
                                <p className="text-xs font-medium text-slate-600">
                                  Giỏ hàng hiện đang trống
                                </p>
                                <Link
                                  to="/collection"
                                  onClick={onClose}
                                  className="mt-3 inline-flex rounded-full bg-amber-500 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-amber-600"
                                >
                                  Khám phá sản phẩm
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                        {!isUserMessage &&
                          cartActionPresentation && (
                            <div
                              className={`mt-2 overflow-hidden rounded-2xl border bg-white text-left shadow-sm ${
                                cartActionPresentation.destructive
                                  ? "border-red-200"
                                  : "border-amber-200"
                              }`}
                            >
                              <div
                                className={`flex items-center gap-2 border-b px-3 py-2.5 ${
                                  cartActionPresentation.destructive
                                    ? "border-red-100 bg-red-50"
                                    : "border-amber-100 bg-amber-50"
                                }`}
                              >
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${
                                    cartActionPresentation.destructive
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                  }`}
                                >
                                  <ShoppingCart
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-slate-900">
                                    {cartActionPresentation.title}
                                  </p>
                                  <p
                                    className={`mt-0.5 text-[10px] ${
                                      cartActionPresentation.destructive
                                        ? "text-red-700"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    Giỏ hàng chưa được thay đổi
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 px-3 py-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                  {pendingCartAction.product?.image ? (
                                    <img
                                      src={pendingCartAction.product.image}
                                      alt={
                                        pendingCartAction.product.title ||
                                        "Sản phẩm"
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Package
                                      className="h-5 w-5 text-slate-400"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold text-slate-900">
                                    {pendingCartAction.product?.title ||
                                      "Sản phẩm"}
                                  </p>
                                  <p className="mt-1 text-[10px] text-slate-500">
                                    {getCartActionDescription(
                                      pendingCartAction,
                                    )}
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatMoney(pendingCartAction.lineTotal)}
                                  </p>
                                </div>
                              </div>

                              <div
                                className="border-t border-slate-100 px-3 py-2.5"
                                aria-live="polite"
                              >
                                {cartActionState.status === "confirmed" ? (
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                                      <Check
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                      />
                                      {cartActionPresentation.success}
                                    </span>
                                    <Link
                                      to="/cart"
                                      onClick={(event) => { event.preventDefault(); if (openCart()) onClose(); }}
                                      className="rounded-full bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-700"
                                    >
                                      Xem giỏ hàng
                                    </Link>
                                  </div>
                                ) : cartActionState.status === "cancelled" ? (
                                  <p className="text-[11px] font-medium text-slate-500">
                                    Đã bỏ qua đề xuất này
                                  </p>
                                ) : cartActionState.status === "confirming" ? (
                                  <div className="flex items-center justify-center gap-2 py-1 text-[11px] font-semibold text-amber-700">
                                    <LoaderCircle
                                      className="h-4 w-4 animate-spin"
                                      aria-hidden="true"
                                    />
                                    Đang kiểm tra và cập nhật giỏ...
                                  </div>
                                ) : (
                                  <>
                                    {cartActionState.error && (
                                      <p className="mb-2 text-[10px] leading-4 text-red-600">
                                        {cartActionState.error}
                                      </p>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCancelCartAction(
                                            pendingCartAction.id,
                                          )
                                        }
                                        className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                                      >
                                        Bỏ qua
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleConfirmCartAction(
                                            pendingCartAction,
                                          )
                                        }
                                        className={`flex-1 rounded-full px-3 py-2 text-[10px] font-semibold text-white transition ${
                                          cartActionPresentation.destructive
                                            ? "bg-red-500 hover:bg-red-600"
                                            : "bg-amber-500 hover:bg-amber-600"
                                        }`}
                                      >
                                        {cartActionState.status === "failed"
                                          ? "Thử lại"
                                          : "Xác nhận"}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        {statusLabel && (
                          <p
                            className={`mt-1 text-[11px] ${
                              message.status === "failed"
                                ? "text-red-500"
                                : "text-slate-400"
                            }`}
                          >
                            {statusLabel}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-secondary text-white">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3.5">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                          style={{ animationDelay: `${dot * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && user && (
            <div
              role="alert"
              className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={clearError}
                aria-label="Đóng thông báo lỗi"
                className="rounded p-0.5 hover:bg-red-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-slate-100 bg-white p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={!user}
                maxLength={AI_MESSAGE_MAX_LENGTH}
                rows={1}
                aria-label="Nhập tin nhắn cho trợ lý AI"
                placeholder={
                  user ? "Nhập câu hỏi của bạn..." : "Vui lòng đăng nhập..."
                }
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
              />

              {isSending ? (
                <button
                  type="button"
                  onClick={cancelRequest}
                  aria-label="Dừng trả lời"
                  title="Dừng trả lời"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition hover:bg-slate-700"
                >
                  <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!user || !input.trim()}
                  aria-label="Gửi tin nhắn"
                  title="Gửi tin nhắn"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm transition hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-400">
              <span>Enter để gửi · Shift + Enter để xuống dòng</span>
              <span>
                {input.length}/{AI_MESSAGE_MAX_LENGTH}
              </span>
            </div>
          </form>
        </div>
      </section>
    </>
  );
};

export default AIChatPanel;
