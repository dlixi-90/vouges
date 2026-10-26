import { Check, Pencil, Trash2, X } from "lucide-react";

const ProductVariantRow = ({ item, draft, loading, onEdit, onChange, onSave, onCancel, onRemove }) => {
  const editing = Boolean(draft);
  const values = draft || item;
  const fields = [
    { name: "size", label: "Dung tích", type: "text", maxLength: 50 },
    { name: "price", label: "Giá (nghìn đồng)", type: "number", min: "0.01", step: "0.01" },
    { name: "quantity", label: "Số lượng", type: "number", min: "0", step: "1" },
  ];
  const buttonStyle = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#cfdad2] px-3 py-2 text-sm font-medium text-[#496852] hover:bg-[#f2f7f3] disabled:opacity-50";

  return (
    <div className="rounded-lg border border-[#e0e6e2] bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fields.map(({ name, label, ...attributes }) => (
          <label key={name} className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-[#78868f] sm:min-h-8">
              {label} <span className="text-red-600">*</span>
            </span>
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
              className={`admin-input ${editing ? "" : "!bg-white text-[#52616b]"}`}
              aria-label={`${label} cho dung tích ${item.size}`}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#edf0ee] pt-3">
        {editing ? (
          <>
            <button type="button" onClick={onCancel} disabled={loading} className={buttonStyle}>
              <X size={15} /> Hủy
            </button>
            <button type="button" onClick={onSave} disabled={loading} className="admin-primary-button">
              <Check size={15} /> Lưu
            </button>
          </>
        ) : (
          <button type="button" onClick={onEdit} disabled={loading} className={buttonStyle}>
            <Pencil size={15} /> Chỉnh sửa
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#a85c5c] hover:bg-[#fff0f0] disabled:opacity-50"
          aria-label={`Xóa dung tích ${item.size}`}
        >
          <Trash2 size={15} /> Xóa
        </button>
      </div>
    </div>
  );
};
export default ProductVariantRow;
