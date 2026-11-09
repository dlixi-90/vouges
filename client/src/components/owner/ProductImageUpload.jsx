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
    <div className="perfume-upload-tile">
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
      <label htmlFor={id} className={`perfume-upload-label${disabled ? " is-disabled" : ""}`}>
        {file ? <img ref={imageRef} src={typeof file === "string" ? file : undefined} alt={label} /> : (
          <span className="perfume-upload-placeholder">
            <ImagePlus size={18} strokeWidth={1.6} />
            <span>{label}</span>
          </span>
        )}
      </label>
      {file && (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Xóa ${label.toLowerCase()}`}
          className="perfume-upload-remove"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

export default ProductImageUpload;
