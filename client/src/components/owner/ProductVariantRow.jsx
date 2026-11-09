import { Check, Pencil, Trash2, X } from "lucide-react";
import ProductImageUpload from "./ProductImageUpload";

const ProductVariantRow = ({ item, draft, loading, onEdit, onChange, onSave, onCancel, onRemove }) => {
  const editing = Boolean(draft);
  const values = draft || item;
  const fields = [
    { name: "size", label: "Dung tích", type: "text", maxLength: 50 },
    { name: "price", label: "Giá (VND)", type: "number", min: "1", step: "1" },
    { name: "quantity", label: "Số lượng", type: "number", min: "0", step: "1" },
  ];

  return (
    <div className={`perfume-variant-card${editing ? " is-editing" : ""}`}>
      <div className="perfume-variant-card-body">
        <div className="perfume-variant-card-media">
          <ProductImageUpload
            file={values.image}
            label={`Ảnh dung tích ${values.size || item.size}`}
            disabled={loading || !editing}
            onChange={(file) => onChange("image", file)}
            onRemove={() => onChange("image", null)}
          />
        </div>
        <div className="perfume-variant-card-fields">
          {fields.map(({ name, label, ...attributes }) => (
            <label key={name} className="perfume-field">
              <span>{label} <i>*</i></span>
              <input
                key={`${name}:${editing}`}
                {...attributes}
                value={values[name]}
                readOnly={!editing}
                disabled={loading}
                autoFocus={editing && name === "size"}
                onChange={(event) => onChange(name, event.target.value)}
                onKeyDown={(event) => {
                  if (!editing) return;
                  if (event.key === "Enter" && event.target.tagName === "INPUT") {
                    event.preventDefault();
                    onSave();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    onCancel();
                  }
                }}
                aria-label={`${label} cho dung tích ${item.size}`}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="perfume-variant-card-footer">
        <span className="perfume-muted">Ảnh riêng của dung tích. Nếu để trống sẽ dùng bộ ảnh chung của sản phẩm.</span>
        <div className="perfume-toolbar-buttons">
          {editing ? (
            <>
              <button type="button" onClick={onCancel} disabled={loading} className="perfume-button">
                <X size={14} /> Hủy
              </button>
              <button type="button" onClick={onSave} disabled={loading} className="perfume-button primary">
                <Check size={14} /> Lưu
              </button>
            </>
          ) : (
            <button type="button" onClick={onEdit} disabled={loading} className="perfume-button">
              <Pencil size={14} /> Chỉnh sửa
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={loading}
            className="perfume-button perfume-library-delete"
            aria-label={`Xóa dung tích ${item.size}`}
          >
            <Trash2 size={14} /> Xóa
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductVariantRow;
