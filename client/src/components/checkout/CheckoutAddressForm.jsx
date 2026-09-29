import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
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
  onOrderCreated,
  isSubmitting,
  setIsSubmitting,
  selectedItemKeys,
  address,
  setAddress,
}) => {
  const {
    user,
    products,
    cartItems,
    method,
    axios,
    getToken,
    setCartItems,
    fetchProducts,
  } = useAppContext();
  const [addresses, setAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [addressLoadError, setAddressLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);
  const submitRef = useRef(false);

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
    if (!user) return undefined;
    const controller = new AbortController();
    const loadAddresses = async () => {
      setIsLoadingAddresses(true);
      setAddressLoadError("");
      try {
        const { data } = await axios.get("/api/addresses", {
          headers: { Authorization: `Bearer ${await getToken()}` },
          signal: controller.signal,
        });
        if (!data.success)
          throw new Error(data.message || "Unable to load addresses");
        if (controller.signal.aborted) return;
        const saved = data.addresses || [];
        setAddresses(saved);
        setAddress((current) => resolveCheckoutAddress(current, saved, user));
      } catch (error) {
        if (!controller.signal.aborted)
          setAddressLoadError(
            error.response?.data?.message ||
              error.message ||
              "Unable to load addresses",
          );
      } finally {
        if (!controller.signal.aborted) setIsLoadingAddresses(false);
      }
    };
    loadAddresses();
    return () => controller.abort();
  }, [axios, getToken, user, setAddress, loadAttempt]);

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
      throw new Error(data.message || "Unable to save address");
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
      throw new Error(data.message || "Unable to update default address");
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
      throw new Error(data.message || "Unable to update address");
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
      throw new Error(data.message || "Unable to delete address");
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
      toast.success("Address saved");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to save address",
      );
    } finally {
      submitRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || submitRef.current) return;
    if (isLoadingAddresses || addressLoadError)
      return toast.error("Please load your saved addresses before checkout.");
    if (isAddressBookOpen) return;

    if (!user) {
      return toast.error("Please login before placing an order");
    }

    if (items.length === 0) {
      return toast.error("Your cart is empty");
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
          "Could not place order",
      );
      await fetchProducts();
    } finally {
      submitRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id="checkout-address-form"
      onSubmit={handleSubmit}
      className="rounded-xl bg-white p-6 md:p-8"
    >
      <p className="text-sm uppercase tracking-wider text-gray-400">Checkout</p>
      <h2 className="mt-1 text-2xl font-semibold">Delivery Information</h2>

      {isLoadingAddresses ? (
        <p className="mt-8" role="status">
          Loading your addresses...
        </p>
      ) : addressLoadError ? (
        <div className="mt-6 rounded-md bg-primary p-4" role="alert">
          <p>{addressLoadError}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((current) => current + 1)}
            className="mt-3 cursor-pointer text-sm font-semibold text-secondary underline"
          >
            Try again
          </button>
        </div>
      ) : address._id ? (
        <div className="mt-6 rounded-xl border border-gray-200 bg-primary/50 p-5">
          <div className="flex items-start gap-3">
            <MapPin size={21} className="mt-0.5 shrink-0 text-secondary" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold">
                  {address.firstName} {address.lastName}
                </span>
                <span className="text-sm font-medium">
                  {validateDeliveryPhone(address.phone).normalized ||
                    address.phone}
                </span>
              </div>
              <p className="mt-2 break-words !leading-relaxed">
                {[address.street, address.state, address.city, address.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {address.isDefault && (
                <span className="mt-3 inline-block rounded border border-secondary/25 bg-secondary/5 px-2 py-0.5 text-xs text-secondary">
                  Default
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setIsAddressBookOpen(true)}
            className="btn-outline mt-5 !rounded-md disabled:opacity-40"
          >
            Change Address
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
            Save as default address
          </label>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={saveInlineAddress}
            className="btn-dark mt-5 !rounded-md disabled:opacity-40"
          >
            {isSubmitting ? "Saving..." : "Save Address"}
          </button>
          {addresses.length > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAddressBookOpen(true)}
              className="btn-outline mt-5 !rounded-md"
            >
              Choose Saved Address
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
