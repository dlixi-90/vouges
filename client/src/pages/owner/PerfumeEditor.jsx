import { useId, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { CatalogPage, CatalogState, Badge, issueLabels, useCatalog } from "../../components/owner/CatalogUI";
import ProductImage from "../../components/ProductImage";
import VariantEditor from "../../components/owner/VariantEditor";
import ProductGalleryEditor from "../../components/owner/ProductGalleryEditor";
import ProductArticleEditor from "../../components/owner/ProductArticleEditor";
import { sanitizeArticle } from "../../utils/productArticle";
import { AccordEditor, AssessmentEditor } from "../../components/owner/FragranceEditorFields";
import { editableFragrance } from "../../utils/fragrance";
import { resolveCatalogSizeNames, catalogSizeRenames } from "../../utils/catalogVariantEdit";
import ScentNotes from "../../components/ScentNotes";

const tabs = [{ key: "general", label: "Thông tin chung" }, { key: "variants", label: "Dung tích & giá" }, { key: "fragrance", label: "Hồ sơ mùi" }, { key: "assessments", label: "Đánh giá trải nghiệm" }, { key: "images", label: "Hình ảnh" }];

export default function PerfumeEditor() {
  const { productId } = useParams();
  const query = useCatalog(`/products/${productId}`);
  return query.data?.product ? <PerfumeForm key={`${query.data.product._id}:${query.data.product.updatedAt}`} product={query.data.product} reload={query.reload} /> : <CatalogPage title="Chi tiết sản phẩm"><CatalogState {...query} /></CatalogPage>;
}

function PerfumeForm({ product, reload }) {
  const { axios, getToken, fetchProducts } = useAppContext();
  const [params] = useSearchParams();
  const formId = useId();
  const [draft, setDraft] = useState(() => ({ ...structuredClone(product), fragrance: editableFragrance(structuredClone(product.fragrance || {})) }));
  const [tab, setTab] = useState(() => tabs.some(item => item.key === params.get("tab")) ? params.get("tab") : "general");
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const [newSize, setNewSize] = useState("");
  const unresolvedReview = (product.source?.profileCompletion?.unresolved || []).filter(item => product.qualityIssues?.includes(item.code));
  const [notesText, setNotesText] = useState(() => Object.fromEntries(["top", "middle", "base", "general"].map(phase => [phase, (product.fragrance?.notes?.[phase] || []).map(note => note.name).join("\n")])));
  const accordLibrary = useCatalog(tab === "fragrance" ? "/terms?kind=accord&pageSize=100" : null);
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const fragranceField = (field, value) => setDraft(current => ({ ...current, fragrance: { ...current.fragrance, [field]: value } }));
  const variantField = (field, size, value) => setDraft(current => ({ ...current, [field]: { ...current[field], [size]: value } }));
  const renameSize = (from, value) => setDraft(current => ({ ...current, sizeNames: { ...current.sizeNames, [from]: value } }));

  const save = async event => {
    event.preventDefault();
    if (busy || uploading) return;
    setBusy(true); setError("");
    const fragrance = draft.fragrance;
    try {
      const variants = resolveCatalogSizeNames(draft);
      const descriptionContent = sanitizeArticle(draft.descriptionContent ?? null);
      const { data } = await axios.patch(`/api/catalog/products/${product._id}`, {
        title: draft.title, sizes: variants.sizes, sizeRenames: catalogSizeRenames(variants), group: fragrance.group || "", style: fragrance.style || "", brand: draft.brand, origin: draft.origin, gender: draft.gender, concentration: draft.concentration, description: draft.description,
        descriptionContent, inventoryMode: draft.inventoryMode, price: variants.price, stockBySize: variants.stockBySize, inStockBySize: variants.inStockBySize, sizeImages: variants.sizeImages, images: draft.images,
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
    if (!size || size.length > 50 || size.includes(".") || size.startsWith("$") || ["__proto__", "constructor", "prototype"].includes(size) || draft.sizes.some(item => (draft.sizeNames?.[item] ?? item).normalize("NFC").trim().toLocaleLowerCase("vi-VN") === size.normalize("NFC").toLocaleLowerCase("vi-VN"))) { toast.error("Tên dung tích không hợp lệ hoặc bị trùng. Dùng dấu phẩy thay cho dấu chấm."); return; }
    if (draft.sizes.some(item => item.toLocaleLowerCase("vi-VN") === size.toLocaleLowerCase("vi-VN"))) { toast.error("Lưu thay đổi dung tích trước khi thêm lại tên cũ."); return; }
    if (draft.sizes.length >= 50) { toast.error("Tối đa 50 dung tích cho mỗi sản phẩm."); return; }
    setDraft(current => ({ ...current, sizeNames: { ...current.sizeNames, [size]: size }, sizeOrigins: { ...(current.sizeOrigins ?? Object.fromEntries(product.sizes.map(item => [item, item]))), [size]: null }, sizes: [...current.sizes, size], price: { ...current.price, [size]: 0 }, stockBySize: { ...current.stockBySize, [size]: 0 }, inStockBySize: { ...current.inStockBySize, [size]: false } })); setNewSize("");
  };
  const field = (name, label, options = {}) => <label className="perfume-field"><span>{label}</span><input value={draft[name] || ""} onChange={event => update(name, event.target.value)} maxLength={200} {...options} /></label>;
  const notes = (phase, text) => {
    setNotesText(current => ({ ...current, [phase]: text }));
    const old = draft.fragrance.notes?.[phase] || [];
    const list = text.split("\n").map(name => name.trim()).filter(Boolean).map(name => old.find(note => note.name === name) || { name, url: null });
    setDraft(current => ({ ...current, fragrance: { ...current.fragrance, notes: { ...current.fragrance.notes, [phase]: list } } }));
  };

  return <CatalogPage title={draft.title} actions={<><Link to="/owner/list-product" className="perfume-button"><ArrowLeft size={15} />Danh sách</Link><button form={formId} type="submit" disabled={busy || uploading} className="perfume-button primary"><Save size={15} />{busy ? "Đang lưu…" : uploading ? "Đang tải ảnh…" : "Lưu thay đổi"}</button></>}>
    {error && <div role="alert" className="perfume-alert">{error}</div>}
    <div className="perfume-editor-summary"><span className="perfume-editor-thumb">{draft.images?.[0] && <ProductImage src={draft.images[0]} alt="" imageWidth={200} />}</span><div><div className="perfume-inline-badges"><Badge>{draft.sizes.length} dung tích / phân loại</Badge></div></div></div>
    <nav className="perfume-tabs" aria-label="Các phần sản phẩm">{tabs.map(item => <button type="button" key={item.key} disabled={busy || uploading} aria-current={tab === item.key ? "page" : undefined} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}</nav>
    <form id={formId} onSubmit={save} className="perfume-editor-body">
      {tab === "general" && <>
        <div className="perfume-editor-columns"><section className="perfume-panel"><h2>Thông tin nước hoa</h2><div className="perfume-form-grid">{field("title", "Tên sản phẩm", { required: true })}{field("brand", "Thương hiệu")}{field("origin", "Xuất xứ")}{field("concentration", "Nồng độ")}{field("gender", "Đối tượng sử dụng")}<label className="perfume-field"><span>Danh mục</span><input value={product.category} readOnly /></label></div></section><aside className="perfume-panel"><h2>Hồ sơ cần chú ý</h2>{product.qualityIssues?.length ? <ul className="perfume-issue-list">{product.qualityIssues.map(issue => <li key={issue}>{issueLabels[issue] || issue}</li>)}</ul> : <p>Các trường cơ bản đã được điền.</p>}</aside></div>
        <section className="perfume-panel perfume-article-panel"><h2>Mô tả sản phẩm</h2>
          <ProductArticleEditor value={draft.descriptionContent} text={draft.description} disabled={busy} onUploadingChange={setUploading}
            onChange={(descriptionContent, description) => setDraft(current => ({ ...current, descriptionContent, description }))} />
        </section>
      </>}
      {tab === "variants" && <VariantEditor draft={draft} uploading={uploading || busy} onChange={update} onVariantField={variantField} onUpload={upload} newSize={newSize} setNewSize={setNewSize} addSize={addSize} onRename={renameSize} />}
      {tab === "fragrance" && <section className="perfume-panel"><div className="perfume-section-heading"><h2>Hồ sơ mùi hương</h2><Link to="/owner/library?kind=accord" className="perfume-button">Mở thư viện kiểu mùi</Link></div><div className="perfume-form-grid mb-5">{["group", "style"].map(key => <label className="perfume-field" key={key}><span>{key === "group" ? "Nhóm hương" : "Phong cách"}</span><input maxLength={500} value={draft.fragrance[key] || ""} onChange={event => fragranceField(key, event.target.value)} /></label>)}</div><div className="perfume-notes-grid">{[{ phase: "top", label: "Hương đầu" }, { phase: "middle", label: "Hương giữa" }, { phase: "base", label: "Hương cuối" }].map(({ phase, label }) => <label className="perfume-field" key={phase}><span>{label}</span><textarea rows={8} value={notesText[phase]} onChange={event => notes(phase, event.target.value)} placeholder="Mỗi note một dòng" /></label>)}</div>{accordLibrary.error && <p role="alert" className="perfume-muted">Không tải được gợi ý thư viện. Bạn vẫn có thể nhập tên kiểu mùi.</p>}<AccordEditor accords={draft.fragrance.accords} terms={accordLibrary.data?.terms || []} onChange={rows => fragranceField("accords", rows)} listId={`${formId}-accords`} /></section>}
      {tab === "assessments" && <section className="perfume-panel"><div className="perfume-section-heading"><h2>Đánh giá trải nghiệm</h2></div><AssessmentEditor fragrance={draft.fragrance} onChange={fragranceField} /></section>}
      {tab === "fragrance" && <section className="perfume-panel">
        <label className="perfume-field"><span>Các nốt hương chưa được nguồn phân tầng</span><textarea rows={4} value={notesText.general} onChange={event => notes('general', event.target.value)} placeholder="Mỗi note một dòng. Không cần tự gán vào hương đầu, giữa hoặc cuối." /></label>
        {draft.fragrance.components?.length > 0 && <ScentNotes fragrance={{components:draft.fragrance.components}} />}
        {draft.fragrance.profileKind === 'accessory' && <p className="perfume-muted">Phụ kiện không có mùi hương cố định. Mùi và nồng độ phụ thuộc nước hoa hoặc lõi hương đi kèm.</p>}
      </section>}
      {tab === "general" && unresolvedReview.length > 0 && <section className="perfume-panel"><h2>Các mục còn cần đối chiếu</h2><ul className="perfume-issue-list">{unresolvedReview.map(item => <li key={item.code}>{item.reason}</li>)}</ul></section>}
      {tab === "images" && <ProductGalleryEditor images={draft.images} uploading={uploading} onChange={images => update("images", images)} onUpload={upload} />}
    </form>
  </CatalogPage>;
}
