import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

const DeleteCategoryDialog = ({ target, busy, error, onCancel, onConfirm }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const label = target.type ? "loại sản phẩm" : "danh mục";
  const name = target.type?.name || target.category.name;

  return (
    <dialog ref={dialogRef} aria-labelledby="delete-category-title" aria-describedby="delete-category-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-[#e2e7e4] bg-white p-6 text-[#263b4a] shadow-xl backdrop:bg-[#172733]/40">
      <span className="mb-4 inline-flex rounded-full bg-red-50 p-3 text-red-600"><Trash2 size={22} /></span>
      <h2 id="delete-category-title" className="text-xl font-semibold">Xóa {label}?</h2>
      <p id="delete-category-description" className="mt-3 break-words text-sm leading-6 text-[#71808a]">
        {target.type
          ? `Loại sản phẩm “${name}” sẽ bị xóa khỏi danh mục ${target.category.name}.`
          : `Danh mục “${name}” cùng ${target.category.types?.length || 0} loại sản phẩm thuộc danh mục sẽ bị xóa.`}
        {" "}Thao tác này không thể hoàn tác. Cần chuyển các sản phẩm đang sử dụng {label} này sang {label} khác trước khi xóa.
      </p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" autoFocus disabled={busy} onClick={onCancel}
          className="rounded-lg border border-[#dfe5e8] px-4 py-2.5 text-sm font-medium hover:bg-[#f7f9f8] disabled:opacity-60">Hủy</button>
        <button type="button" disabled={busy} onClick={onConfirm}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          <Trash2 size={16} /> {busy ? "Đang xóa…" : `Xóa ${label}`}
        </button>
      </div>
    </dialog>
  );
};

export default DeleteCategoryDialog;
