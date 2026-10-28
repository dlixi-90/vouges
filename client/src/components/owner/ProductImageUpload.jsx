import { useEffect, useId, useRef } from "react";
import { ImagePlus, X } from "lucide-react";

const ProductImageUpload = ({ file, label, onChange, onRemove, disabled = false }) => {
  const id = useId();
  const imageRef = useRef(null);
  useEffect(() => {
    if (!file || typeof file === "string") return;
    const url = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative aspect-square">
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={label}
        disabled={disabled}
        className="peer sr-only"
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          if (next) onChange(next);
        }}
      />
      <label htmlFor={id} className={`flex h-full flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#cfd9d2] bg-white text-center peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${disabled ? "opacity-50" : "cursor-pointer hover:border-[#777]"}`}>
        {file ? <img ref={imageRef} src={typeof file === "string" ? file : undefined} alt={label} className="h-full w-full object-contain p-1" /> : (
          <span className="flex flex-col items-center gap-2 px-2 text-gray-500">
            <ImagePlus size={20} />
            <span className="text-xs">{label}</span>
          </span>
        )}
      </label>
      {file && <button type="button" disabled={disabled} onClick={onRemove} aria-label={`Xóa ${label.toLowerCase()}`} className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-50"><X size={14} /></button>}
    </div>
  );
};

export default ProductImageUpload;
