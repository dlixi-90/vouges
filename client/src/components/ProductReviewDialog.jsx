import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import ProductImage from "./ProductImage";
import ProductReviewForm from "./ProductReviewForm";

const ProductReviewDialog = ({ product, onClose }) => {
  const { user } = useAppContext();
  const dialogRef = useRef(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);

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

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[600px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-tertiary shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-lg font-semibold">Đánh giá sản phẩm</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Đóng đánh giá" className="cursor-pointer rounded-md p-2 hover:bg-primary disabled:opacity-50"><X size={20} /></button>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-4 rounded-lg bg-primary p-4">
          {product.image && <ProductImage src={product.image} imageWidth={160} alt={product.title} className="h-16 w-14 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold">{product.title}</h3>
            <p className="mt-1 text-xs text-gray-500">Size: {product.size} · Đã mua hàng</p>
          </div>
        </div>
        <ProductReviewForm key={`${product.id}::${user?.id || "guest"}`} productId={product.id} onSaved={onClose} onCancel={onClose} onBusyChange={setBusy} />
      </div>
    </dialog>,
    document.body,
  );
};

export default ProductReviewDialog;
