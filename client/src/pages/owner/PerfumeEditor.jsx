import { useId, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { CatalogPage, CatalogState, Badge, issueLabels, useCatalog } from "../../components/owner/CatalogUI";
import ProductImage from "../../components/ProductImage";
import VariantEditor from "../../components/owner/VariantEditor";
import ProductGalleryEditor from "../../components/owner/ProductGalleryEditor";
import { AccordEditor, AssessmentEditor } from "../../components/owner/FragranceEditorFields";
import { editableFragrance } from "../../utils/fragrance";

const tabs = [{ key: "general", label: "Thông tin chung" }, { key: "variants", label: "Dung tích & giá" }, { key: "fragrance", label: "Hồ sơ mùi" }, { key: "assessments", label: "Đánh giá trải nghiệm" }, { key: "images", label: "Hình ảnh" }, { key: "source", label: "Nguồn dữ liệu" }];

export default function PerfumeEditor() {
  const { productId } = useParams();
  const query = useCatalog(`/products/${productId}`);
  return query.data?.product ? <PerfumeForm key={`${query.data.product._id}:${query.data.product.updatedAt}`} product={query.data.product} source={query.data.source} reload={query.reload} /> : <CatalogPage title="Chi tiết sản phẩm"><CatalogState {...query} /></CatalogPage>;
}

function PerfumeForm({ product, source, reload }) {
  const { axios, getToken, fetchProducts } = useAppContext();
  const [params] = useSearchParams();
  const formId = useId();
  const [draft, setDraft] = useState(() => ({ ...structuredClone(product), fragrance: editableFragrance(structuredClone(product.fragrance || {})) }));
  const [tab, setTab] = useState(params.get("tab") || "general");
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const [newSize, setNewSize] = useState("");
  const [notesText, setNotesText] = useState(() => Object.fromEntries(["top", "middle", "base"].map(phase => [phase, (product.fragrance?.notes?.[phase] || []).map(note => note.name).join("\n")])));
  const accordLibrary = useCatalog(tab === "fragrance" ? "/terms?kind=accord&pageSize=100" : null);
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const fragranceField = (field, value) => setDraft(current => ({ ...current, fragrance: { ...current.fragrance, [field]: value } }));
  const variantField = (field, size, value) => setDraft(current => ({ ...current, [field]: { ...current[field], [size]: value } }));

  const save = async event => {
    event.preventDefault();
    if (busy || uploading) return;
    setBusy(true); setError("");
    const fragrance = draft.fragrance;
    try {
      const { data } = await axios.patch(`/api/catalog/products/${product._id}`, {
        title: draft.title, sizes: draft.sizes, group: fragrance.group || "", style: fragrance.style || "", brand: draft.brand, origin: draft.origin, gender: draft.gender, concentration: draft.concentration, description: draft.description,
        inventoryMode: draft.inventoryMode, price: draft.price, stockBySize: draft.stockBySize, inStockBySize: draft.inStockBySize, sizeImages: draft.sizeImages, images: draft.images, isPublished: draft.isPublished,
        notes: fragrance.notes || {}, accords: fragrance.accords, longevity: fragrance.longevity, sillage: fragrance.sillage, suitability: fragrance.suitability, expectedUpdatedAt: product.updatedAt,
      }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      if (!data.success) throw new Error(data.message);
      toast.success("Đã lưu sản phẩm"); reload(); void fetchProducts();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };

  const upload = async (files, target = {}) => {
    if (!files.length || uploading) return;
    if (files.length > 4) { toast.error("Chọn tối đa 4 ảnh mỗi lượt."); return; }
    if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) { toast.error("Chọn ảnh PNG, JPEG hoặc WebP, tối đa 5 MB mỗi ảnh."); return; }
    const replacing = target.size || Number.isInteger(target.index);
    if (!replacing && draft.images.length + files.length > 30) { toast.error("Bộ ảnh sản phẩm tối đa 30 ảnh."); return; }
    setUploading(true);
    try {
      const form = new FormData(); files.forEach(file => form.append("images", file));
      const { data } = await axios.post("/api/catalog/media", form, { headers: { Authorization: `Bearer ${await getToken()}` } });
      if (!data.success) throw new Error(data.message);
      if (target.size) variantField("sizeImages", target.size, data.images[0]);
      else if (Number.isInteger(target.index)) setDraft(current => ({ ...current, images: current.images.map((image, index) => index === target.index ? data.images[0] : image) }));
      else setDraft(current => ({ ...current, images: [...current.images, ...data.images] }));
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setUploading(false); }
  };

  const addSize = () => {
    const size = newSize.trim();
    if (!size || size.length > 50 || size.includes(".") || size.startsWith("$") || ["__proto__", "constructor", "prototype"].includes(size) || draft.sizes.some(item => item.toLowerCase() === size.toLowerCase())) { toast.error("Tên dung tích không hợp lệ hoặc bị trùng. Dùng dấu phẩy thay cho dấu chấm."); return; }
    if (draft.sizes.length >= 50) { toast.error("Tối đa 50 dung tích cho mỗi sản phẩm."); return; }
    setDraft(current => ({ ...current, sizes: [...current.sizes, size], price: { ...current.price, [size]: 0 }, stockBySize: { ...current.stockBySize, [size]: 0 }, inStockBySize: { ...current.inStockBySize, [size]: false } })); setNewSize("");
  };
  const field = (name, label, options = {}) => <label className="perfume-field"><span>{label}</span><input value={draft[name] || ""} onChange={event => update(name, event.target.value)} maxLength={200} {...options} /></label>;
  const notes = (phase, text) => {
    setNotesText(current => ({ ...current, [phase]: text }));
    const old = draft.fragrance.notes?.[phase] || [];
    const list = text.split("\n").map(name => name.trim()).filter(Boolean).map(name => old.find(note => note.name === name) || { name, url: null });
    setDraft(current => ({ ...current, fragrance: { ...current.fragrance, notes: { ...current.fragrance.notes, [phase]: list } } }));
  };

  return <CatalogPage title={draft.title} description={`${product.brand || "Chưa xác định thương hiệu"} · APA #${product.source?.id || "—"}`} actions={<><Link to="/owner/list-product" className="perfume-button"><ArrowLeft size={15} />Danh sách</Link><button form={formId} type="submit" disabled={busy || uploading} className="perfume-button primary"><Save size={15} />{busy ? "Đang lưu…" : uploading ? "Đang tải ảnh…" : "Lưu thay đổi"}</button></>}>
    {error && <div role="alert" className="perfume-alert">{error}</div>}
    <div className="perfume-editor-summary"><span className="perfume-editor-thumb">{draft.images?.[0] && <ProductImage src={draft.images[0]} alt="" imageWidth={200} />}</span><div><div className="perfume-inline-badges"><Badge tone={draft.isPublished ? "green" : "amber"}>{draft.isPublished ? "Đang hiển thị" : "Đang ẩn"}</Badge><Badge>{draft.sizes.length} dung tích / phân loại</Badge><Badge>VND</Badge></div><p>Giá, số lượng và ảnh được quản lý riêng cho từng phân loại.</p></div><label className="perfume-switch"><input type="checkbox" checked={draft.isPublished} onChange={event => update("isPublished", event.target.checked)} />Hiển thị sản phẩm trên cửa hàng</label></div>
    <nav className="perfume-tabs" aria-label="Các phần sản phẩm">{tabs.map(item => <button type="button" key={item.key} aria-current={tab === item.key ? "page" : undefined} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}</nav>
    <form id={formId} onSubmit={save} className="perfume-editor-body">
      {tab === "general" && <div className="perfume-editor-columns"><section className="perfume-panel"><h2>Thông tin nước hoa</h2><div className="perfume-form-grid">{field("title", "Tên sản phẩm", { required: true })}{field("brand", "Thương hiệu")}{field("origin", "Xuất xứ")}{field("concentration", "Nồng độ")}{field("gender", "Đối tượng sử dụng")}<label className="perfume-field"><span>Danh mục</span><input value={product.category} readOnly /></label></div><label className="perfume-field"><span>Giới thiệu sản phẩm</span><textarea rows={6} maxLength={5000} value={draft.description} onChange={event => update("description", event.target.value)} /></label></section><aside className="perfume-panel"><h2>Hồ sơ cần chú ý</h2>{product.qualityIssues?.length ? <ul className="perfume-issue-list">{product.qualityIssues.map(issue => <li key={issue}>{issueLabels[issue] || issue}</li>)}</ul> : <p>Các trường cơ bản đã được điền.</p>}<p className="perfume-muted">Các thông tin gốc vẫn được giữ trong tab Nguồn dữ liệu để đối chiếu.</p></aside></div>}
      {tab === "variants" && <VariantEditor draft={draft} uploading={uploading} onChange={update} onVariantField={variantField} onUpload={upload} newSize={newSize} setNewSize={setNewSize} addSize={addSize} />}
      {tab === "fragrance" && <section className="perfume-panel"><div className="perfume-section-heading"><div><h2>Hồ sơ mùi hương</h2><p className="perfume-muted">Nhóm hương: {draft.fragrance.group || "Chưa có"}</p></div><Link to="/owner/library?kind=accord" className="perfume-button">Mở thư viện kiểu mùi</Link></div><div className="perfume-form-grid mb-5">{["group", "style"].map(key => <label className="perfume-field" key={key}><span>{key === "group" ? "Nhóm hương" : "Phong cách"}</span><input maxLength={500} value={draft.fragrance[key] || ""} onChange={event => fragranceField(key, event.target.value)} /></label>)}</div><div className="perfume-notes-grid">{[{ phase: "top", label: "Hương đầu" }, { phase: "middle", label: "Hương giữa" }, { phase: "base", label: "Hương cuối" }].map(({ phase, label }) => <label className="perfume-field" key={phase}><span>{label}</span><textarea rows={8} value={notesText[phase]} onChange={event => notes(phase, event.target.value)} placeholder="Mỗi note một dòng" /></label>)}</div>{accordLibrary.error && <p role="alert" className="perfume-muted">Không tải được gợi ý thư viện. Bạn vẫn có thể nhập tên kiểu mùi.</p>}<AccordEditor accords={draft.fragrance.accords} terms={accordLibrary.data?.terms || []} onChange={rows => fragranceField("accords", rows)} listId={`${formId}-accords`} /></section>}
      {tab === "assessments" && <section className="perfume-panel"><div className="perfume-section-heading"><div><h2>Đánh giá trải nghiệm</h2><p className="perfume-muted">Luôn hiển thị trên trang chi tiết sản phẩm. Bạn có thể chỉnh số lượt và tỷ lệ bên dưới; bản ghi nguồn được giữ để đối chiếu.</p></div><Badge>Luôn hiển thị</Badge></div><AssessmentEditor fragrance={draft.fragrance} onChange={fragranceField} /></section>}
      {tab === "images" && <ProductGalleryEditor images={draft.images} uploading={uploading} onChange={images => update("images", images)} onUpload={upload} />}
      {tab === "source" && <section className="perfume-panel"><div className="perfume-section-heading"><div><h2>Bản ghi nguồn</h2><p className="perfume-muted">Được giữ nguyên khi bạn chỉnh sửa catalog Velours.</p></div>{product.source?.url && <a href={product.source.url} target="_blank" rel="noreferrer" className="perfume-button">Xem trang nguồn <ExternalLink size={14} /></a>}</div><dl className="perfume-source-details"><div><dt>Nguồn</dt><dd>{product.source?.provider || "Velours"}</dd></div><div><dt>ID nguồn</dt><dd>{product.source?.id || "—"}</dd></div><div><dt>Thời điểm lấy</dt><dd>{product.source?.fetchedAt ? new Date(product.source.fetchedAt).toLocaleString("vi-VN") : "—"}</dd></div><div><dt>Đơn vị giá</dt><dd>VND nguyên đồng</dd></div></dl><details><summary>Xem bản ghi đầy đủ</summary><pre className="perfume-source-json">{JSON.stringify(source?.data || product.source, null, 2)}</pre></details></section>}
    </form>
  </CatalogPage>;
}
