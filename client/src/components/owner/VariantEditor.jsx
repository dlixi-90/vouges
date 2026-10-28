import { useState } from "react";
import { Check, Image, Pencil, Plus, Upload, X } from "lucide-react";
import ProductImage from "../ProductImage";
import VndAmountInput from "./VndAmountInput";

export default function VariantEditor({ draft, uploading, onChange, onVariantField, onUpload, newSize, setNewSize, addSize, onRename, onEditingChange }) {
  const [editing, setEditing] = useState(null);
  const locked = uploading || Boolean(editing);
  const cancel = () => { setEditing(null); onEditingChange(false); };
  const confirm = () => {
    try { onRename(editing.size, editing.value); cancel(); }
    catch (error) { setEditing(current => ({ ...current, error: error.message })); }
  };
  const total = draft.sizes.reduce((sum, size) => sum + (Number(draft.stockBySize?.[size]) || 0), 0);
  return <section className="perfume-panel">
    <div className="perfume-section-heading"><div><h2>Dung tích, giá và số lượng</h2><p className="perfume-muted">Nhập giá bằng VND nguyên đồng. Tổng số lượng kho: <strong>{total.toLocaleString("vi-VN")}</strong>.</p></div><label className="perfume-field"><span>Quản lý tồn</span><select value={draft.inventoryMode} onChange={event => onChange("inventoryMode", event.target.value)}><option value="source">Theo trạng thái còn / hết</option><option value="tracked">Theo số lượng trong kho</option></select></label></div>
    <div className="perfume-table-scroll"><table className="perfume-table perfume-variant-table"><thead><tr><th>Ảnh riêng</th><th>Dung tích</th><th>Giá bán VND</th><th>Số lượng kho</th><th>Mở bán</th><th><span className="sr-only">Bỏ dung tích</span></th></tr></thead><tbody>{draft.sizes.map(size => <tr key={size}>
      <td><div className="perfume-variant-image">{draft.sizeImages?.[size] ? <ProductImage src={draft.sizeImages[size]} alt={`Ảnh dung tích ${size}`} imageWidth={160} /> : <span className="perfume-variant-placeholder"><Image size={22} strokeWidth={1.4} /></span>}<label className="perfume-upload-button"><Upload size={13} /><input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" aria-label={`Tải ảnh dung tích ${size}`} disabled={locked} onChange={event => { void onUpload([...event.target.files], { size }); event.target.value = ""; }} /></label></div>{draft.sizeImages?.[size] && <button type="button" className="perfume-inline-link" disabled={locked} aria-label={`Bỏ ảnh dung tích ${size}`} onClick={() => onVariantField("sizeImages", size, null)}>Bỏ ảnh</button>}</td>
      <td>{editing?.size === size ? <div className="perfume-size-edit"><div><input autoFocus aria-label={`Tên dung tích ${size}`} value={editing.value} maxLength={50} aria-invalid={Boolean(editing.error)} onChange={event => setEditing(current => ({ ...current, value: event.target.value, error: "" }))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); confirm(); } else if (event.key === "Escape") { event.preventDefault(); cancel(); } }} /><button type="button" className="perfume-icon-button" aria-label={`Xác nhận dung tích ${size}`} onClick={confirm}><Check size={15} /></button><button type="button" className="perfume-icon-button" aria-label="Hủy sửa dung tích" onClick={cancel}><X size={15} /></button></div>{editing.error && <small role="alert">{editing.error}</small>}</div> : <div className="perfume-size-name"><strong>{size}</strong><button type="button" className="perfume-icon-button" aria-label={`Sửa dung tích ${size}`} disabled={locked} onClick={() => { setEditing({ size, value: size, error: "" }); onEditingChange(true); }}><Pencil size={14} /></button></div>}</td>
      <td><VndAmountInput aria-label={`Giá ${size} VND`} required value={draft.price[size]} onValueChange={value => onVariantField("price", size, value)} /></td>
      <td><input aria-label={`Tồn kho ${size}`} type="number" min={0} step={1} required value={draft.stockBySize?.[size] ?? 0} onChange={event => onVariantField("stockBySize", size, event.target.value === "" ? "" : Number(event.target.value))} /></td>
      <td><label className="perfume-switch"><input type="checkbox" checked={Boolean(draft.inStockBySize?.[size])} onChange={event => onVariantField("inStockBySize", size, event.target.checked)} />{draft.inStockBySize?.[size] ? "Còn hàng" : "Hết hàng"}</label></td>
      <td><button type="button" className="perfume-icon-button" aria-label={`Bỏ dung tích ${size}`} disabled={draft.sizes.length === 1 || locked} onClick={() => onChange("sizes", draft.sizes.filter(item => item !== size))}><X size={15} /></button></td>
    </tr>)}</tbody></table></div>
    <div className="perfume-toolbar-buttons perfume-add-size"><input aria-label="Tên dung tích mới" placeholder="Ví dụ: 30ml" value={newSize} disabled={locked} maxLength={50} onChange={event => setNewSize(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addSize(); } }} /><button type="button" className="perfume-button" disabled={locked} onClick={addSize}><Plus size={15} />Thêm dung tích</button></div>
  </section>;
}
