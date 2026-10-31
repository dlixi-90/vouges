import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import DeliveryAddressFields from "./DeliveryAddressFields";
import { initialCheckoutAddress } from "../../utils/checkoutAddress";
import { validateDeliveryPhone } from "../../utils/deliveryPhone";

const AddressBookDialog = ({ addresses, selectedId, user, onSelect, onSave, onUpdate, onMakeDefault, onDelete, onClose }) => {
  const dialogRef = useRef(null);
  const busyRef = useRef(false);
  const titleId = useId();
  const [mode, setMode] = useState(addresses.length ? "list" : "new");
  const [pendingId, setPendingId] = useState(selectedId || addresses.find((entry) => entry.isDefault)?._id || addresses[0]?._id);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingAddress, setEditingAddress] = useState(null);
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
      if (mode === "edit") {
        const saved = await onUpdate(editingAddress._id, { ...draft, phone: phone.normalized }, makeDefault);
        if (pendingId === editingAddress._id) setPendingId(saved._id);
        setMode("list");
        setEditingAddress(null);
        toast.success("Đã cập nhật địa chỉ");
      } else {
        const saved = await onSave({ ...draft, phone: phone.normalized }, makeDefault);
        onSelect(saved);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Không thể lưu địa chỉ");
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
      toast.error(error.response?.data?.message || error.message || "Không thể cập nhật địa chỉ mặc định");
    } finally {
      busyRef.current = false;
      setIsSaving(false);
    }
  };

  const editAddress = (entry) => {
    setEditingAddress(entry);
    setDraft({ ...initialCheckoutAddress, ...entry, phone: validateDeliveryPhone(entry.phone).normalized || entry.phone });
    setMakeDefault(Boolean(entry.isDefault));
    setDeleteId(null);
    setMode("edit");
  };

  const addNewAddress = () => {
    setEditingAddress(null);
    setDraft({
      ...initialCheckoutAddress,
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.primaryEmailAddress?.emailAddress || "",
    });
    setMakeDefault(addresses.length === 0);
    setDeleteId(null);
    setMode("new");
  };

  const removeAddress = async (entry) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSaving(true);
    try {
      const remaining = await onDelete(entry._id);
      if (pendingId === entry._id) {
        setPendingId(remaining.find((address) => address.isDefault)?._id || remaining[0]?._id || "");
      }
      setDeleteId(null);
      toast.success("Đã xóa địa chỉ");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Không thể xóa địa chỉ");
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
      className="net-form-dialog fixed inset-0 m-auto max-h-[90dvh] w-[640px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-0 text-tertiary shadow-xl backdrop:bg-black/35"
    >
      <div>
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <h3 id={titleId} className="text-xl font-semibold">{mode === "list" ? "Địa chỉ của tôi" : mode === "edit" ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}</h3>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Đóng sổ địa chỉ" className="cursor-pointer rounded-md p-2 hover:bg-primary disabled:opacity-40"><X size={21} /></button>
        </div>
        {mode === "list" ? (
          <>
            <div className="divide-y divide-gray-200 px-6" role="radiogroup" aria-label="Địa chỉ giao hàng">
              {addresses.length === 0 && <p className="py-8 text-center">Bạn chưa lưu địa chỉ nào.</p>}
              {addresses.map((entry) => (
                <div key={entry._id} className="py-5">
                  <div className="flex items-start gap-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input type="radio" name="saved-delivery-address" value={entry._id} checked={pendingId === entry._id} onChange={() => setPendingId(entry._id)} disabled={isSaving} className="mt-1 h-4 w-4 shrink-0 accent-secondary" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-semibold">{entry.firstName} {entry.lastName}</span>
                          <span className="text-sm text-gray-500">{validateDeliveryPhone(entry.phone).normalized || entry.phone}</span>
                        </span>
                        <span className="mt-2 block break-words text-sm leading-relaxed text-gray-500">{[entry.street, entry.state, entry.city, entry.country].filter(Boolean).join(", ")}</span>
                        {entry.isDefault && <span className="mt-2 inline-block rounded border border-secondary/25 bg-secondary/5 px-2 py-0.5 text-xs text-secondary">Mặc định</span>}
                      </span>
                    </label>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" disabled={isSaving} onClick={() => editAddress(entry)} aria-label={`Chỉnh sửa địa chỉ tại ${entry.street}`} title="Chỉnh sửa địa chỉ" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-secondary transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"><Pencil size={17} strokeWidth={1.5} aria-hidden="true" /></button>
                      <button type="button" disabled={isSaving} onClick={() => setDeleteId(entry._id)} aria-label={`Xóa địa chỉ tại ${entry.street}`} title="Xóa địa chỉ" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={17} strokeWidth={1.5} aria-hidden="true" /></button>
                    </div>
                  </div>
                  {!entry.isDefault && <div className="ml-7 mt-3">
                    <button type="button" disabled={isSaving} onClick={() => setDefault(entry)} className="cursor-pointer text-xs font-medium text-secondary underline underline-offset-4 disabled:opacity-40">Đặt làm mặc định</button>
                  </div>}
                  {deleteId === entry._id && (
                    <div className="ml-7 mt-3 rounded-md border border-gray-200 bg-primary p-3">
                      <p className="text-sm">Xóa địa chỉ đã lưu này?</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button type="button" disabled={isSaving} onClick={() => setDeleteId(null)} className="btn-outline !rounded-full !px-4 !py-2 disabled:opacity-40">Hủy</button>
                        <button type="button" disabled={isSaving} onClick={() => removeAddress(entry)} className="btn-dark !rounded-full !px-4 !py-2 disabled:opacity-40">{isSaving ? "Đang xóa…" : "Xóa địa chỉ"}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200 p-6">
              <button type="button" onClick={addNewAddress} disabled={isSaving} className="btn-outline inline-flex items-center gap-2 !rounded-full disabled:opacity-40"><Plus size={17} />Thêm địa chỉ mới</button>
              <button type="button" disabled={isSaving || !addresses.some((entry) => entry._id === pendingId)} onClick={() => {
                const selected = addresses.find((entry) => entry._id === pendingId);
                if (selected) onSelect(selected);
              }} className="btn-dark !rounded-full disabled:opacity-40">Xác nhận</button>
            </div>
          </>
        ) : (
          <form onSubmit={save} className="px-6 pb-6">
            <DeliveryAddressFields key={editingAddress?._id || "new"} address={draft} setAddress={setDraft} disabled={isSaving} />
            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} disabled={isSaving || Boolean(editingAddress?.isDefault)} className="h-4 w-4 accent-secondary" />Đặt làm địa chỉ mặc định</label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isSaving} onClick={() => addresses.length ? setMode("list") : onClose()} className="btn-outline !rounded-full disabled:opacity-40">Quay lại</button>
              <button type="submit" disabled={isSaving} className="btn-dark !rounded-full disabled:opacity-40">{isSaving ? "Đang lưu…" : mode === "edit" ? "Lưu thay đổi" : "Lưu địa chỉ"}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>,
    document.body,
  );
};

export default AddressBookDialog;
