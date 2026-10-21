import { useEffect, useRef } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export default function DeleteVoucherDialog({ voucher, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby="delete-voucher-title" aria-describedby="delete-voucher-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-[#e2e7e4] bg-white p-6 text-[#263b4a] shadow-xl backdrop:bg-[#172733]/40">
      <span className="mb-4 inline-flex rounded-full bg-red-50 p-3 text-red-600"><Trash2 size={22} aria-hidden="true" /></span>
      <h2 id="delete-voucher-title" className="text-xl font-semibold">Xóa mã giảm giá?</h2>
      <p id="delete-voucher-description" className="mt-3 break-words text-sm leading-6 text-[#71808a]">
        Mã <strong className="font-mono text-[#263b4a]">{voucher.code}</strong> sẽ bị xóa khỏi danh sách và không thể áp dụng cho đơn hàng mới.
        {" "}Các đơn hàng đã dùng mã vẫn giữ nguyên ưu đãi. Mã đã xóa không thể tạo lại.
      </p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" autoFocus disabled={busy} onClick={onCancel}
          className="cursor-pointer rounded-lg border border-[#dfe5e8] px-4 py-2.5 text-sm font-medium hover:bg-[#f7f9f8] disabled:cursor-not-allowed disabled:opacity-60">Hủy</button>
        <button type="button" disabled={busy} onClick={onConfirm}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
          {busy ? "Đang xóa…" : "Xóa mã giảm giá"}
        </button>
      </div>
    </dialog>
  );
}
