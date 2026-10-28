import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "./CatalogUI";
import { AccordEditor, AssessmentEditor } from "./FragranceEditorFields";

export default function NewProductFragrance({ fragrance, notesText, onChange, onNotes, disabled }) {
  const [tab, setTab] = useState("fragrance");
  const listId = useId();
  const library = useCatalog(tab === "fragrance" ? "/terms?kind=accord&pageSize=100" : null);

  return <section className="perfume-panel lg:col-span-2">
    <nav className="perfume-tabs" aria-label="Hồ sơ nước hoa mới">
      <button type="button" disabled={disabled} className={tab === "fragrance" ? "active" : ""} aria-current={tab === "fragrance" ? "page" : undefined} onClick={() => setTab("fragrance")}>Hồ sơ mùi</button>
      <button type="button" disabled={disabled} className={tab === "assessments" ? "active" : ""} aria-current={tab === "assessments" ? "page" : undefined} onClick={() => setTab("assessments")}>Đánh giá trải nghiệm</button>
    </nav>
    <fieldset disabled={disabled} className="min-w-0">
      {tab === "fragrance" ? <>
        <div className="perfume-section-heading"><h2>Hồ sơ mùi hương</h2><Link className="perfume-button" to="/owner/library?kind=accord">Mở thư viện kiểu mùi</Link></div>
        <div className="perfume-form-grid mb-5">{[{ key: "group", label: "Nhóm hương" }, { key: "style", label: "Phong cách" }].map(({ key, label }) => <label className="perfume-field" key={key}>
          <span>{label}</span><input maxLength={500} value={fragrance[key] || ""} onChange={event => onChange(key, event.target.value)} />
        </label>)}</div>
        <div className="perfume-notes-grid">{[{ phase: "top", label: "Hương đầu" }, { phase: "middle", label: "Hương giữa" }, { phase: "base", label: "Hương cuối" }].map(({ phase, label }) => <label className="perfume-field" key={phase}>
          <span>{label}</span><textarea rows={6} value={notesText[phase] || ""} onChange={event => onNotes(phase, event.target.value)} placeholder="Mỗi note một dòng" />
        </label>)}</div>
        {library.error && <p role="alert" className="perfume-muted">Không tải được gợi ý thư viện. Bạn vẫn có thể nhập tên kiểu mùi.</p>}
        <AccordEditor accords={fragrance.accords} terms={library.data?.terms || []} listId={listId} onChange={rows => onChange("accords", rows)} />
      </> : <><h2>Đánh giá trải nghiệm</h2><AssessmentEditor fragrance={fragrance} onChange={onChange} /></>}
    </fieldset>
  </section>;
}
