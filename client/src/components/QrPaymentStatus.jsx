import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { removePurchasedItems } from "../utils/cartSelection";

const getRemainingSeconds = (expiresAt) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));

const formatRemainingTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const QrPaymentStatus = ({ initialOrder, onExpired, onCancelled }) => {
  const {
    axios,
    getToken,
    navigate,
    setCartItems,
    fetchProducts,
    fetchPopularProducts,
  } = useAppContext();

  const [order, setOrder] = useState(initialOrder);
  const [isChecking, setIsChecking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasShownSuccess, setHasShownSuccess] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(initialOrder.paymentExpiresAt),
  );
  const hasSyncedCartRef = useRef(false);
  const cancelRequestRef = useRef(false);
  const qrHistoryEntryRef = useRef(false);
  const isAwaitingPayment = order.status === "Awaiting Payment" && !order.isPaid;

  const checkPayment = useCallback(
    async (showError = false) => {
      try {
        setIsChecking(true);

        const { data } = await axios.get(`/api/orders/${initialOrder._id}`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });

        if (!data.success) {
          if (showError) toast.error(data.message);
          return;
        }

        setOrder((currentOrder) => ({
          ...currentOrder,
          ...data.order,
        }));

        if (data.order.status === "Payment Review") {
          if (!hasShownSuccess) {
            toast("Payment received and awaiting manual confirmation.");
            setHasShownSuccess(true);
          }
        } else if (data.order.isPaid) {
          if (!hasSyncedCartRef.current) {
            setCartItems((currentCart) =>
              removePurchasedItems(currentCart, initialOrder.items),
            );
            hasSyncedCartRef.current = true;
            fetchPopularProducts();
          }

          if (!hasShownSuccess) {
            toast.success("Payment successful!");
            setHasShownSuccess(true);
          }
        } else if (data.order.status === "Payment Expired") {
          await fetchProducts();

          if (showError) {
            toast.error("Payment time expired. Reserved stock was restored.");
          }
        } else if (showError) {
          toast("Payment has not been received yet!");
        }
      } catch (error) {
        if (showError) {
          toast.error(
            error.response?.data?.message ||
              error.message ||
              "Could not check payment.",
          );
        }
      } finally {
        setIsChecking(false);
      }
    },
    [
      axios,
      fetchProducts,
      fetchPopularProducts,
      getToken,
      initialOrder._id,
      initialOrder.items,
      setCartItems,
      hasShownSuccess,
    ],
  );

  useEffect(() => {
    if (
      order.isPaid ||
      order.status === "Payment Expired" ||
      order.status === "Payment Review"
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      checkPayment(false);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkPayment, order.isPaid, order.status]);

  useEffect(() => {
    if (order.status !== "Awaiting Payment" || order.isPaid) return undefined;

    const intervalId = window.setInterval(() => {
      const nextRemainingSeconds = getRemainingSeconds(
        order.paymentExpiresAt,
      );

      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0) {
        window.clearInterval(intervalId);
        checkPayment(false);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [checkPayment, order.isPaid, order.paymentExpiresAt, order.status]);

  const copyPaymentCode = async () => {
    try {
      await navigator.clipboard.writeText(order.paymentCode);
      toast.success("Payment code copied");
    } catch {
      toast.error("Could not copy payment code");
    }
  };

  const cancelPayment = useCallback(async (fromBrowserBack = false) => {
    if (cancelRequestRef.current) return;

    try {
      cancelRequestRef.current = true;
      setIsCancelling(true);
      const { data } = await axios.post(
        `/api/orders/${initialOrder._id}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Could not cancel QR payment");
      }

      await fetchProducts();
      window.history.replaceState(
        { ...window.history.state, qrPayment: null, cartStep: 2 },
        "",
        window.location.href,
      );
      onCancelled();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Could not cancel QR payment",
      );
      await checkPayment(false);

      if (fromBrowserBack && qrHistoryEntryRef.current) {
        window.history.pushState(
          { ...window.history.state, qrPayment: initialOrder._id },
          "",
          window.location.href,
        );
      }
    } finally {
      cancelRequestRef.current = false;
      setIsCancelling(false);
    }
  }, [
    axios,
    checkPayment,
    fetchProducts,
    getToken,
    initialOrder._id,
    onCancelled,
  ]);

  useEffect(() => {
    if (!isAwaitingPayment) return undefined;
    if (!qrHistoryEntryRef.current) {
      window.history.pushState(
        { ...window.history.state, qrPayment: initialOrder._id },
        "",
        window.location.href,
      );
      qrHistoryEntryRef.current = true;
    }

    const handleBrowserBack = () => {
      cancelPayment(true);
    };

    window.addEventListener("popstate", handleBrowserBack);

    return () => window.removeEventListener("popstate", handleBrowserBack);
  }, [cancelPayment, initialOrder._id, isAwaitingPayment, onCancelled]);

  if (order.status === "Payment Review") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">Payment received</h2>

        <p className="mt-3 text-gray-500">
          Your payment arrived after the stock reservation expired. The order
          is awaiting manual confirmation.
        </p>

        <button
          type="button"
          onClick={() => navigate("/my-orders")}
          className="btn-dark mt-8 !rounded-md"
        >
          View My Orders
        </button>
      </div>
    );
  }

  if (order.isPaid) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
          {"\u2713"}
        </div>

        <h2 className="mt-5 text-2xl font-semibold">Payment successful</h2>

        <p className="mt-3 text-gray-500">
          Your payment has been confirmed and the order is being processed.
        </p>

        <p className="mt-2 text-sm text-gray-400">Order ID: {order._id}</p>

        <button
          type="button"
          onClick={() => navigate("/my-orders")}
          className="btn-dark mt-8 !rounded-md"
        >
          View My Orders
        </button>
      </div>
    );
  }

  if (order.status === "Payment Expired") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">Payment time expired</h2>

        <p className="mt-3 text-gray-500">
          The reserved products were returned to stock. Your cart was kept so
          you can try again.
        </p>

        <button
          type="button"
          onClick={onExpired}
          className="btn-dark mt-8 !rounded-md"
        >
          Return to cart
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm md:p-10">
      <div className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Scan QR to pay</h2>

          <p className="mt-2 text-sm text-gray-500">
            Open your banking application and scan this QR code.
          </p>

          <div className="mx-auto mt-6 max-w-72 rounded-xl border border-gray-200 p-3">
            <img src={order.qrUrl} alt="VietQR payment" className="w-full" />
          </div>
        </div>

        <div>
          <div className="rounded-xl  p-5">
            <p className="text-sm text-gray-500">Amount</p>

            <p className="mt-1 text-2xl font-bold text-secondary">
              {Number(order.qrAmount).toLocaleString("vi-VN")} VND
            </p>

            <hr className="my-5 border-gray-200" />

            <p className="text-sm text-gray-500">Transfer content</p>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-lg font-bold tracking-wider">
                {order.paymentCode}
              </p>

              <button
                type="button"
                onClick={copyPaymentCode}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-white"
              >
                Copy
              </button>
            </div>

            <p className="mt-3 text-xs text-red-500">
              Please enter the exact amount and transfer content shown above.
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl bg-yellow-50 p-4">
            <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-500" />

            <div>
              <p className="font-medium">Awaiting payment</p>

              <p className="text-sm text-gray-500">
                QR expires in {formatRemainingTime(remainingSeconds)}. Status is
                checked automatically.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => checkPayment(true)}
            disabled={isChecking || isCancelling}
            className="btn-dark mt-5 w-full !rounded-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isChecking ? "Checking..." : "I Have Paid"}
          </button>

          <button
            type="button"
            onClick={() => cancelPayment(false)}
            disabled={isChecking || isCancelling}
            className="btn-outline mt-3 w-full !rounded-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Back to payment method"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrPaymentStatus;
