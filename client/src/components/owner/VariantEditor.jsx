import { useId } from "react";
import { Image, Plus, Trash2, Upload, X } from "lucide-react";
import ProductImage from "../ProductImage";
import VndAmountInput from "./VndAmountInput";
import { catalogSizeNameErrors } from "../../utils/catalogVariantEdit";

export default function VariantEditor({
  draft,
  uploading,
  onChange,
  onVariantField,
  onUpload,
  newSize,
  setNewSize,
  addSize,
  onRename,
}) {
  const fieldId = useId();
  const locked = uploading;
  const sizeErrors = catalogSizeNameErrors(draft);
  const total = draft.sizes.reduce(
    (sum, size) => sum + (Number(draft.stockBySize?.[size]) || 0),
    0,
  );
  return (
    <section className="perfume-panel">
      <div className="perfume-section-heading">
        <div>
          <h2>Dung tích, giá và số lượng</h2>
          <p className="perfume-muted">
            Tổng số lượng kho: <strong>{total.toLocaleString("vi-VN")}</strong>.
          </p>
        </div>
        <label className="perfume-field">
          <span>Quản lý tồn</span>
          <select
            value={draft.inventoryMode}
            onChange={(event) => onChange("inventoryMode", event.target.value)}
          >
            <option value="source">Theo trạng thái còn / hết</option>
            <option value="tracked">Theo số lượng trong kho</option>
          </select>
        </label>
      </div>
      <div className="perfume-table-scroll">
        <table className="perfume-table perfume-variant-table">
          <thead>
            <tr>
              <th>Ảnh riêng</th>
              <th>Dung tích</th>
              <th>Giá bán VND</th>
              <th>Số lượng kho</th>
              <th>Mở bán</th>
              <th>
                <span className="sr-only">Bỏ dung tích</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.sizes.map((size, index) => (
              <tr key={size}>
                <td>
                  <div className="perfume-variant-media">
                    <div className="perfume-variant-image">
                      {draft.sizeImages?.[size] ? (
                        <ProductImage
                          src={draft.sizeImages[size]}
                          alt={`Ảnh dung tích ${size}`}
                          imageWidth={160}
                        />
                      ) : (
                        <span className="perfume-variant-placeholder">
                          <Image size={22} strokeWidth={1.4} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="perfume-variant-image-actions">
                      <label className="perfume-variant-image-action" title={draft.sizeImages?.[size] ? "Thay ảnh" : "Tải ảnh"} aria-disabled={locked}>
                        <Upload size={15} strokeWidth={1.7} aria-hidden="true" />
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/png,image/jpeg,image/webp"
                          aria-label={`Tải ảnh dung tích ${size}`}
                          disabled={locked}
                          onChange={(event) => {
                            void onUpload([...event.target.files], { size });
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="perfume-variant-image-action is-remove"
                        title="Bỏ ảnh"
                        disabled={locked || !draft.sizeImages?.[size]}
                        aria-label={`Bỏ ảnh dung tích ${size}`}
                        onClick={() => onVariantField("sizeImages", size, null)}
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={15} strokeWidth={1.7} style={{ color: "#ef4444" }} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="perfume-size-field">
                    <input
                      className="perfume-size-input"
                      type="text"
                      aria-label={`Tên dung tích ${size}`}
                      value={draft.sizeNames?.[size] ?? size}
                      required
                      maxLength={50}
                      disabled={locked}
                      aria-invalid={Boolean(sizeErrors[size])}
                      aria-describedby={sizeErrors[size] ? `${fieldId}-${index}` : undefined}
                      onChange={(event) => onRename(size, event.target.value)}
                    />
                    {sizeErrors[size] && <small id={`${fieldId}-${index}`} role="alert">{sizeErrors[size]}</small>}
                  </div>
                </td>
                <td>
                  <VndAmountInput
                    aria-label={`Giá ${size} VND`}
                    required
                    value={draft.price[size]}
                    onValueChange={(value) =>
                      onVariantField("price", size, value)
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Tồn kho ${size}`}
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={draft.stockBySize?.[size] ?? 0}
                    onChange={(event) =>
                      onVariantField(
                        "stockBySize",
                        size,
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                      )
                    }
                  />
                </td>
                <td>
                  <label className="perfume-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.inStockBySize?.[size])}
                      onChange={(event) =>
                        onVariantField(
                          "inStockBySize",
                          size,
                          event.target.checked,
                        )
                      }
                    />
                    {draft.inStockBySize?.[size] ? "Còn hàng" : "Hết hàng"}
                  </label>
                </td>
                <td>
                  <button
                    type="button"
                    className="perfume-icon-button"
                    aria-label={`Bỏ dung tích ${size}`}
                    disabled={draft.sizes.length === 1 || locked}
                    onClick={() =>
                      onChange(
                        "sizes",
                        draft.sizes.filter((item) => item !== size),
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="perfume-toolbar-buttons perfume-add-size">
        <input
          aria-label="Tên dung tích mới"
          placeholder="Ví dụ: 30ml"
          value={newSize}
          disabled={locked}
          maxLength={50}
          onChange={(event) => setNewSize(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addSize();
            }
          }}
        />
        <button
          type="button"
          className="perfume-button"
          disabled={locked}
          onClick={addSize}
        >
          <Plus size={15} />
          Thêm dung tích
        </button>
      </div>
    </section>
  );
}
