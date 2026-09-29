import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import DeliveryAddressFields from "./DeliveryAddressFields";
import { initialCheckoutAddress } from "../../utils/checkoutAddress";
import { validateDeliveryPhone } from "../../utils/deliveryPhone";

const AddressBookDialog = ({ addresses, selectedId, user, onSelect, onSave, onMakeDefault, onClose }) => {
  const dialogRef = useRef(null);
  const busyRef = useRef(false);
  const titleId = useId();
  const [mode, setMode] = useState(addresses.length ? "list" : "new");
  const [pendingId, setPendingId] = useState(selectedId || addresses.find((entry) => entry.isDefault)?._id || addresses[0]?._id);
  const [isSaving, setIsSaving] = useState(false);
  const [makeDefault, setMakeDefault] = useState(addresses.length === 0);
  const [draft, setDraft] = useState(() => ({
    ...initialCheckoutAddress,
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.primaryEmailAddress?.emailAddress || "",
  }));

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (busyRef.current) return;
    const phone = validateDeliveryPhone(draft.phone);
    if (!phone.valid) return toast.error(phone.error);
    busyRef.current = true;
    setIsSaving(true);
    try {
      const saved = await onSave({ ...draft, phone: phone.normalized }, makeDefault);
      onSelect(saved);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to save address");
    } finally {
      busyRef.current = false;
      setIsSaving(false);
    }
  };

  const setDefault = async (entry) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSaving(true);
    try {
      await onMakeDefault(entry._id);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to update default address");
    } finally {
      busyRef.current = false;
      setIsSaving(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-busy={isSaving}
      onCancel={(event) => { event.preventDefault(); if (!busyRef.current) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busyRef.current) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[640px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-0 text-tertiary shadow-xl backdrop:bg-black/35"
    >
      <div>
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <h3 id={titleId} className="text-xl font-semibold">{mode === "list" ? "My Addresses" : "Add New Address"}</h3>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close addresses" className="cursor-pointer rounded-md p-2 hover:bg-primary disabled:opacity-40"><X size={21} /></button>
        </div>
        {mode === "list" ? (
          <>
            <div className="divide-y divide-gray-200 px-6" role="radiogroup" aria-label="Delivery address">
              {addresses.map((entry) => (
                <div key={entry._id} className="py-5">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="radio" name="saved-delivery-address" value={entry._id} checked={pendingId === entry._id} onChange={() => setPendingId(entry._id)} disabled={isSaving} className="mt-1 h-4 w-4 shrink-0 accent-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold">{entry.firstName} {entry.lastName}</span>
                        <span className="text-sm text-gray-500">{validateDeliveryPhone(entry.phone).normalized || entry.phone}</span>
                      </span>
                      <span className="mt-2 block break-words text-sm leading-relaxed text-gray-500">{[entry.street, entry.state, entry.city, entry.country].filter(Boolean).join(", ")}</span>
                      {entry.isDefault && <span className="mt-2 inline-block rounded border border-secondary/25 bg-secondary/5 px-2 py-0.5 text-xs text-secondary">Default</span>}
                    </span>
                  </label>
                  {!entry.isDefault && <button type="button" disabled={isSaving} onClick={() => setDefault(entry)} className="ml-7 mt-2 cursor-pointer text-xs font-medium text-secondary underline underline-offset-4 disabled:opacity-40">Set as default</button>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200 p-6">
              <button type="button" onClick={() => setMode("new")} disabled={isSaving} className="btn-outline inline-flex items-center gap-2 !rounded-md disabled:opacity-40"><Plus size={17} />Add New Address</button>
              <button type="button" disabled={isSaving || !pendingId} onClick={() => {
                const selected = addresses.find((entry) => entry._id === pendingId);
                if (selected) onSelect(selected);
              }} className="btn-dark !rounded-md disabled:opacity-40">Confirm</button>
            </div>
          </>
        ) : (
          <form onSubmit={save} className="px-6 pb-6">
            <DeliveryAddressFields address={draft} setAddress={setDraft} disabled={isSaving} />
            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} disabled={isSaving} className="h-4 w-4 accent-secondary" />Set as default address</label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isSaving} onClick={() => addresses.length ? setMode("list") : onClose()} className="btn-outline !rounded-md disabled:opacity-40">Back</button>
              <button type="submit" disabled={isSaving} className="btn-dark !rounded-md disabled:opacity-40">{isSaving ? "Saving..." : "Save Address"}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>,
    document.body,
  );
};

export default AddressBookDialog;
