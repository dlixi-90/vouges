import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { removePurchasedItems } from "../utils/cartSelection";
import { useBlocker } from "react-router-dom";
import { createQrCancellation, shouldCancelQrNavigation } from "../utils/qrNavigation";

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
    applyStockUpdates,
    dashboardCache,
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
  const checkRequestRef = useRef(null);
  const [cancellation] = useState(createQrCancellation);
  const blocker = useBlocker(useCallback((transition) => shouldCancelQrNavigation(order, transition), [order]));
  const blockerRef = useRef(blocker);
  useEffect(() => { blockerRef.current = blocker; }, [blocker]);

  useEffect(() => () => checkRequestRef.current?.abort(), []);

  const checkPayment = useCallback(
    async (showError = false) => {
      if (checkRequestRef.current || cancelRequestRef.current) return;
      const controller = new AbortController();
      checkRequestRef.current = controller;
      try {
        setIsChecking(true);
        const token = await getToken();
        controller.signal.throwIfAborted();
        const { data } = await axios.get(`/api/orders/${initialOrder._id}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        });
        if (controller.signal.aborted) return;

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
            dashboardCache.invalidate();
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
          void fetchProducts();

          if (showError) {
            toast.error("Payment time expired. Reserved stock was restored.");
          }
        } else if (showError) {
          toast("Payment has not been received yet!");
        }
      } catch (error) {
        if (showError && !controller.signal.aborted) {
          toast.error(
            error.response?.data?.message ||
              error.message ||
              "Could not check payment.",
          );
        }
      } finally {
        if (checkRequestRef.current === controller) {
          checkRequestRef.current = null;
          setIsChecking(false);
        }
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
      dashboardCache,
    ],
  );

  useEffect(() => {
    if (
      order.isPaid ||
      order.status === "Payment Expired" ||
      order.status === "Payment Review" ||
      order.status === "Payment Cancelled" ||
      isCancelling
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      checkPayment(false);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkPayment, order.isPaid, order.status, isCancelling]);

  useEffect(() => {
    if (order.status !== "Awaiting Payment" || order.isPaid) return undefined;

    const intervalId = window.setInterval(() => {
      const nextRemainingSeconds = getRemainingSeconds(order.paymentExpiresAt);

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

  const cancelPayment = useCallback(
    () => cancellation.run(async () => {
      try {
        cancelRequestRef.current = true;
        setIsCancelling(true);
        checkRequestRef.current?.abort();
        checkRequestRef.current = null;
        setIsChecking(false);
        const { data } = await axios.post(
          `/api/orders/${initialOrder._id}/cancel`,
          {},
          {
            timeout: 15000,
            headers: {
              Authorization: `Bearer ${await getToken()}`,
            },
          },
        );

        if (!data.success) {
          throw new Error(data.message || "Could not cancel QR payment");
        }

        applyStockUpdates(data.stockUpdates);
        void fetchProducts();
        return true;
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Could not cancel QR payment",
        );
        cancelRequestRef.current = false;
        void checkPayment(false);
        return false;
      } finally {
        cancelRequestRef.current = false;
        setIsCancelling(false);
      }
    }),
    [
      axios,
      applyStockUpdates,
      checkPayment,
      fetchProducts,
      getToken,
      initialOrder._id,
      cancellation,
    ],
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return undefined;
    let active = true;
    void cancelPayment().then((success) => {
      if (!active) return;
      if (success) blocker.proceed();
      else blocker.reset();
    });
    return () => { active = false; };
  }, [blocker, cancelPayment]);

  const backToPaymentMethod = async () => {
    const success = await cancelPayment();
    if (success && blockerRef.current.state !== "blocked") onCancelled();
  };

  if (order.status === "Payment Review") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">Payment received</h2>

        <p className="mt-3 text-gray-500">
          Your payment arrived after the stock reservation expired. The order is
          awaiting manual confirmation.
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
            onClick={backToPaymentMethod}
            disabled={isCancelling}
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
