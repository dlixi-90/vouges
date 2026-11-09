import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "./CatalogUI";
import {
  AccordEditor,
  AssessmentEditor,
  MultiGroupSelect,
  MultiNoteSelect,
} from "./FragranceEditorFields";
import {
  ACCORD_OPTIONS_PATH,
  GROUP_OPTIONS_PATH,
  NOTE_OPTIONS_PATH,
} from "../../utils/ownerPrefetch";

const NOTE_PHASES = [
  { phase: "top", label: "Hương đầu" },
  { phase: "middle", label: "Hương giữa" },
  { phase: "base", label: "Hương cuối" },
];

export default function NewProductFragrance({
  fragrance,
  notesText,
  onChange,
  onNotes,
  disabled,
}) {
  const [tab, setTab] = useState("fragrance");
  const listId = useId();
  const isFragranceTab = tab === "fragrance";
  const groupLibrary = useCatalog(isFragranceTab ? GROUP_OPTIONS_PATH : null);
  const noteLibrary = useCatalog(isFragranceTab ? NOTE_OPTIONS_PATH : null);
  const accordLibrary = useCatalog(isFragranceTab ? ACCORD_OPTIONS_PATH : null);

  const resolvePhaseNotes = (phase) => {
    const raw = fragrance?.notes?.[phase];
    if (Array.isArray(raw) && raw.length > 0) return raw;
    const text = notesText?.[phase];
    if (typeof text === "string" && text.trim()) {
      return text
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name, url: null }));
    }
    return [];
  };

  return (
    <section className="perfume-panel">
      <nav className="perfume-tabs" aria-label="Hồ sơ nước hoa mới">
        <button
          type="button"
          disabled={disabled}
          className={tab === "fragrance" ? "active" : ""}
          aria-current={tab === "fragrance" ? "page" : undefined}
          onClick={() => setTab("fragrance")}
        >
          Hồ sơ mùi
        </button>
        <button
          type="button"
          disabled={disabled}
          className={tab === "assessments" ? "active" : ""}
          aria-current={tab === "assessments" ? "page" : undefined}
          onClick={() => setTab("assessments")}
        >
          Đánh giá trải nghiệm
        </button>
      </nav>
      <fieldset disabled={disabled} className="min-w-0">
        {tab === "fragrance" ? (
          <>
            <div className="perfume-section-heading">
              <div>
                <h2>Hồ sơ mùi hương</h2>
                <p className="perfume-muted">
                  Chọn nhóm hương, phong cách và các note hương theo từng tầng hương từ thư viện.
                </p>
              </div>
              <Link className="perfume-button" to="/owner/library?kind=group">
                Mở thư viện hương
              </Link>
            </div>

            <div className="perfume-form-grid mb-5">
              <MultiGroupSelect
                label="Nhóm hương"
                value={fragrance?.group || ""}
                terms={groupLibrary.data?.terms || []}
                loading={groupLibrary.loading}
                disabled={disabled}
                onChange={(value) => onChange("group", value)}
              />

              <label className="perfume-field">
                <span>Phong cách</span>
                <input
                  maxLength={500}
                  value={fragrance?.style || ""}
                  placeholder="Ví dụ: Sang trọng, Thanh lịch, Tươi mát…"
                  onChange={(event) => onChange("style", event.target.value)}
                />
              </label>
            </div>

            <div className="perfume-notes-grid">
              {NOTE_PHASES.map(({ phase, label }) => (
                <MultiNoteSelect
                  key={phase}
                  label={label}
                  selectedNotes={resolvePhaseNotes(phase)}
                  terms={noteLibrary.data?.terms || []}
                  loading={noteLibrary.loading}
                  disabled={disabled}
                  onChange={(nextNotes) => onNotes(phase, nextNotes)}
                />
              ))}
            </div>

            {(groupLibrary.error || noteLibrary.error || accordLibrary.error) && (
              <p role="alert" className="perfume-muted">
                Không tải được đầy đủ gợi ý thư viện. Bạn vẫn có thể thêm trực tiếp nhóm hương, note hương hoặc kiểu mùi.
              </p>
            )}

            <AccordEditor
              accords={fragrance.accords}
              terms={accordLibrary.data?.terms || []}
              listId={listId}
              onChange={(rows) => onChange("accords", rows)}
            />
          </>
        ) : (
          <>
            <div className="perfume-section-heading">
              <h2>Đánh giá trải nghiệm</h2>
            </div>
            <AssessmentEditor fragrance={fragrance} onChange={onChange} />
          </>
        )}
      </fieldset>
    </section>
  );
}
