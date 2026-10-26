import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import {
  getCartItemKey,
  removePurchasedItems,
} from "../../utils/cartSelection";
import { validateDeliveryPhone } from "../../utils/deliveryPhone";
import {
  resolveCheckoutAddress,
  removeSavedAddress,
  replaceSavedAddress,
} from "../../utils/checkoutAddress";
import DeliveryAddressFields from "./DeliveryAddressFields";
import AddressBookDialog from "./AddressBookDialog";

const CheckoutAddressForm = ({
  checkout,
  onOrderCreated,
  isSubmitting,
  setIsSubmitting,
  selectedItemKeys,
  address,
  setAddress,
  orderNote,
}) => {
  const {
    user,
    products,
    cartItems,
    method,
    axios,
    getToken,
    hasPendingCartUpdates,
    setCartItems,
    fetchProducts,
    dashboardCache,
  } = useAppContext();
  const [addresses, setAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [addressLoadError, setAddressLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);
  const submitRef = useRef(false);
  const userId = user?.id;
  const addressAuthRef = useRef({ user, getToken });

  useEffect(() => {
    addressAuthRef.current = { user, getToken };
  }, [user, getToken]);

  const items = useMemo(() => {
    const result = [];

    for (const productId in cartItems) {
      const product = products.find((item) => item._id === productId);

      if (!product) continue;

      for (const size in cartItems[productId]) {
        const quantity = Number(cartItems[productId][size]);

        const itemKey = getCartItemKey(productId, size);

        if (quantity > 0 && selectedItemKeys.has(itemKey)) {
          result.push({
            product: productId,
            size,
            quantity,
          });
        }
      }
    }

    return result;
  }, [products, cartItems, selectedItemKeys]);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    const auth = addressAuthRef.current;
    const loadAddresses = async () => {
      setIsLoadingAddresses(true);
      setAddressLoadError("");
      try {
        const { data } = await axios.get("/api/addresses", {
          headers: { Authorization: `Bearer ${await auth.getToken()}` },
          signal: controller.signal,
        });
        if (!data.success)
          throw new Error(data.message || "Không thể tải danh sách địa chỉ");
        if (controller.signal.aborted) return;
        const saved = data.addresses || [];
        setAddresses(saved);
        setAddress((current) => resolveCheckoutAddress(current, saved, auth.user));
      } catch (error) {
        if (!controller.signal.aborted)
          setAddressLoadError(
            error.response?.data?.message ||
              error.message ||
              "Không thể tải danh sách địa chỉ",
          );
      } finally {
        if (!controller.signal.aborted) setIsLoadingAddresses(false);
      }
    };
    loadAddresses();
    return () => controller.abort();
  }, [axios, userId, setAddress, loadAttempt]);

  const saveAddress = async (
    draft,
    defaultRequested,
    saveToAddressBook = true,
  ) => {
    const phone = validateDeliveryPhone(draft.phone);
    if (!phone.valid) throw new Error(phone.error);
    const { data } = await axios.post(
      "/api/addresses/add",
      {
        address: { ...draft, phone: phone.normalized },
        makeDefault: saveToAddressBook && defaultRequested,
        saveToAddressBook,
      },
      { headers: { Authorization: `Bearer ${await getToken()}` } },
    );
    if (!data.success || !data.address?._id)
      throw new Error(data.message || "Không thể lưu địa chỉ");
    const saved = data.address;
    if (!saveToAddressBook) return saved;
    setAddresses((current) => [
      saved,
      ...current
        .filter((entry) => entry._id !== saved._id)
        .map((entry) =>
          saved.isDefault ? { ...entry, isDefault: false } : entry,
        ),
    ]);
    setAddress(saved);
    return saved;
  };

  const makeAddressDefault = async (addressId) => {
    const { data } = await axios.patch(
      `/api/addresses/${addressId}/default`,
      {},
      {
        headers: { Authorization: `Bearer ${await getToken()}` },
      },
    );
    if (!data.success)
      throw new Error(data.message || "Không thể cập nhật địa chỉ mặc định");
    setAddresses((current) =>
      current.map((entry) => ({
        ...entry,
        isDefault: entry._id === addressId,
      })),
    );
    setAddress((current) => ({
      ...current,
      isDefault: current._id === addressId,
    }));
  };

  const updateSavedAddress = async (addressId, draft, makeDefault) => {
    const phone = validateDeliveryPhone(draft.phone);
    if (!phone.valid) throw new Error(phone.error);
    const { data } = await axios.patch(
      `/api/addresses/${addressId}`,
      {
        address: { ...draft, phone: phone.normalized },
        makeDefault,
      },
      { headers: { Authorization: `Bearer ${await getToken()}` } },
    );
    if (!data.success || !data.address?._id)
      throw new Error(data.message || "Không thể cập nhật địa chỉ");
    const updated = data.address;
    setAddresses((current) => replaceSavedAddress(current, addressId, updated));
    setAddress((current) =>
      current._id === addressId
        ? updated
        : updated.isDefault
          ? { ...current, isDefault: false }
          : current,
    );
    return updated;
  };

  const deleteSavedAddress = async (addressId) => {
    const { data } = await axios.delete(`/api/addresses/${addressId}`, {
      headers: { Authorization: `Bearer ${await getToken()}` },
    });
    if (!data.success)
      throw new Error(data.message || "Không thể xóa địa chỉ");
    const remaining = removeSavedAddress(addresses, addressId);
    setAddresses(remaining);
    setAddress((current) => resolveCheckoutAddress(current, remaining, user));
    return remaining;
  };

  const saveInlineAddress = async (event) => {
    if (
      submitRef.current ||
      isSubmitting ||
      !event.currentTarget.form.reportValidity()
    )
      return;
    const phone = validateDeliveryPhone(address.phone);
    if (!phone.valid) return toast.error(phone.error);
    submitRef.current = true;
    setIsSubmitting(true);
    try {
      await saveAddress(address, makeDefault);
      toast.success("Đã lưu địa chỉ");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Không thể lưu địa chỉ",
      );
    } finally {
      submitRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (hasPendingCartUpdates()) return toast.error("Vui lòng chờ lưu xong các thay đổi trong giỏ hàng");

    if (isSubmitting || submitRef.current) return;
    if (!checkout.ready) return toast.error("Vui lòng chờ kiểm tra tổng tiền và mã giảm giá.");
    if (method === "QR" && checkout.pricing.amount === 0) return toast.error("Đơn 0đ: vui lòng chọn COD để đặt đơn.");
    if (isLoadingAddresses || addressLoadError)
      return toast.error("Vui lòng tải danh sách địa chỉ đã lưu trước khi thanh toán.");
    if (isAddressBookOpen) return;

    if (!user) {
      return toast.error("Vui lòng đăng nhập trước khi đặt hàng");
    }

    if (items.length === 0) {
      return toast.error("Giỏ hàng của bạn đang trống");
    }

    const phone = validateDeliveryPhone(address.phone);
    if (!phone.valid) return toast.error(phone.error);

    try {
      submitRef.current = true;
      setIsSubmitting(true);

      const addressId =
        address._id ||
        (
          await saveAddress(
            { ...address, phone: phone.normalized },
            false,
            false,
          )
        )._id;

      // Use the chosen saved address for either payment method.
      const endpoint = method === "QR" ? "/api/orders/qr" : "/api/orders/cod";

      const { data } = await axios.post(
        endpoint,
        {
          items,
          address: addressId,
          shippingMethod: checkout.shippingMethod,
          voucherCode: checkout.voucherCode,
          expectedAmount: checkout.pricing.amount,
          note: orderNote,
        },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (!data.success) {
        await fetchProducts();
        return toast.error(data.message);
      }

      if (method === "COD") {
        dashboardCache.invalidate();
        setCartItems((currentCart) => removePurchasedItems(currentCart, items));
      }

      await fetchProducts();

      toast.success(data.message);

      onOrderCreated(
        data.order || {
          paymentMethod: method,
          isPaid: false,
        },
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Không thể đặt hàng",
      );
      await fetchProducts();
    } finally {
      checkout.refresh();
      submitRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id="checkout-address-form"
      onSubmit={handleSubmit}
      className="inessa-checkout-address"
      aria-labelledby="checkout-address-title"
    >
      <h2 id="checkout-address-title">Thông tin giao hàng</h2>

      {isLoadingAddresses && !address._id ? (
        <p className="mt-8" role="status">
          Đang tải danh sách địa chỉ của bạn…
        </p>
      ) : addressLoadError ? (
        <div className="mt-6 rounded-md bg-primary p-4" role="alert">
          <p>{addressLoadError}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((current) => current + 1)}
            className="mt-3 cursor-pointer text-sm font-semibold text-secondary underline"
          >
            Thử lại
          </button>
        </div>
      ) : address._id ? (
        <div className="inessa-checkout-saved-address mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="break-words font-semibold">
              {address.firstName} {address.lastName}
            </span>
            <span className="text-sm font-medium">
              {validateDeliveryPhone(address.phone).normalized || address.phone}
            </span>
          </div>
          <p className="min-w-0 flex-1 basis-64 break-words !leading-relaxed">
            {[address.street, address.state, address.city, address.country]
              .filter(Boolean)
              .join(", ")}
          </p>
          {address.isDefault && (
            <span className="inline-block rounded border border-secondary/25 bg-secondary/5 px-2 py-0.5 text-xs text-secondary">
              Mặc định
            </span>
          )}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setIsAddressBookOpen(true)}
            className="cursor-pointer rounded-md px-2 py-2 text-sm font-medium text-secondary underline underline-offset-4 disabled:opacity-40"
          >
            Thay đổi địa chỉ
          </button>
        </div>
      ) : (
        <>
          <DeliveryAddressFields
            address={address}
            setAddress={setAddress}
            disabled={isSubmitting}
          />
          <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(event) => setMakeDefault(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 accent-secondary"
            />
            Lưu làm địa chỉ mặc định
          </label>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={saveInlineAddress}
            className="btn-dark mt-5 disabled:opacity-40"
          >
            {isSubmitting ? "Đang lưu…" : "Lưu địa chỉ"}
          </button>
          {addresses.length > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAddressBookOpen(true)}
              className="btn-outline mt-5"
            >
              Chọn địa chỉ đã lưu
            </button>
          )}
        </>
      )}

      {isAddressBookOpen && (
        <AddressBookDialog
          addresses={addresses}
          selectedId={address._id}
          user={user}
          onSave={saveAddress}
          onUpdate={updateSavedAddress}
          onMakeDefault={makeAddressDefault}
          onDelete={deleteSavedAddress}
          onClose={() => setIsAddressBookOpen(false)}
          onSelect={(selected) => {
            setAddress(selected);
            setIsAddressBookOpen(false);
          }}
        />
      )}
    </form>
  );
};

export default CheckoutAddressForm;
