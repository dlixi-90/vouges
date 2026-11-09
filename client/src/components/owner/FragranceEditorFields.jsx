import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { assessmentGroups } from "../../utils/fragrance";
import { splitFragranceGroups } from "../../utils/fragranceLibrary";
import FragranceCharts from "../FragranceCharts";
import FragranceAccords from "../FragranceAccords";

const termCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });
const normalizeText = (value) => String(value || "").normalize("NFC").trim().replace(/\s+/gu, " ");
const normalizeKey = (value) => normalizeText(value).toLocaleLowerCase("vi-VN");
const foldSearchText = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

const sessionCreatedTerms = {
  brand: [],
  group: [],
  accord: [],
  note: [],
};
const sessionListeners = new Set();
const notifySessionTerms = () => {
  for (const listener of sessionListeners) listener();
};
const recordSessionTerm = (kind, term) => {
  if (!kind || !term?.name || !sessionCreatedTerms[kind]) return;
  const key = normalizeKey(term.name);
  if (!sessionCreatedTerms[kind].some((item) => normalizeKey(item.name) === key)) {
    sessionCreatedTerms[kind] = [...sessionCreatedTerms[kind], term];
    notifySessionTerms();
  }
};

function useSessionCreatedTerms(kind) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    sessionListeners.add(listener);
    return () => sessionListeners.delete(listener);
  }, []);
  return sessionCreatedTerms[kind] || [];
}

export function LibraryTermSelect({
  kind,
  label,
  placeholder,
  value = "",
  terms = [],
  loading = false,
  disabled = false,
  onChange,
}) {
  const selectId = useId();
  const { axios, getToken, storeResources, publicCatalog, dashboardCache } = useAppContext();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const createdTerms = useSessionCreatedTerms(kind);
  const lowerLabel = label.toLocaleLowerCase("vi-VN");

  const options = useMemo(() => {
    const seen = new Map();
    for (const item of [...terms, ...createdTerms]) {
      const name = normalizeText(item?.name);
      const key = normalizeKey(name);
      if (name && !seen.has(key)) seen.set(key, name);
    }
    const sorted = [...seen.values()].sort((a, b) => termCollator.compare(a, b));
    const currentVal = normalizeText(value);
    if (currentVal && !seen.has(normalizeKey(currentVal))) {
      return [currentVal, ...sorted];
    }
    return sorted;
  }, [terms, createdTerms, value]);

  const matchedValue = useMemo(() => {
    const currentVal = normalizeText(value);
    if (!currentVal) return "";
    const currentKey = normalizeKey(currentVal);
    return options.find((option) => normalizeKey(option) === currentKey) || currentVal;
  }, [options, value]);

  const handleCreate = async () => {
    const trimmed = normalizeText(newName);
    if (!trimmed || creating || disabled) return;

    const existing = options.find((option) => normalizeKey(option) === normalizeKey(trimmed));
    if (existing) {
      onChange(existing);
      setAdding(false);
      setNewName("");
      toast.success(`Đã chọn ${lowerLabel} "${existing}"`);
      return;
    }

    setCreating(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/catalog/terms",
        { kind, name: trimmed, contentStatus: "linked" },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 },
      );
      if (!data.success) throw new Error(data.message || `Không thể thêm ${lowerLabel}`);
      const savedTerm = data.term || { _id: `local:${Date.now()}`, kind, name: trimmed, sourceUrl: "" };
      recordSessionTerm(kind, savedTerm);
      storeResources.invalidateCatalog();
      publicCatalog?.clear?.();
      dashboardCache?.clear?.();
      onChange(savedTerm.name);
      setAdding(false);
      setNewName("");
      toast.success(`Đã thêm ${lowerLabel} "${savedTerm.name}"`);
    } catch (error) {
      if (error.response?.status === 409) {
        recordSessionTerm(kind, { _id: `local:${Date.now()}`, kind, name: trimmed, sourceUrl: "" });
        storeResources.invalidateCatalog();
        onChange(trimmed);
        setAdding(false);
        setNewName("");
        toast.success(`Đã chọn ${lowerLabel} "${trimmed}"`);
      } else {
        toast.error(error.response?.data?.message || error.message || `Không thể thêm ${lowerLabel}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="perfume-field">
      <div className="perfume-field-header">
        <label htmlFor={selectId}>{label}</label>
        <button
          type="button"
          disabled={disabled || creating}
          onClick={() => {
            setAdding((current) => !current);
            setNewName("");
          }}
          className="perfume-inline-add-btn"
        >
          <Plus size={13} aria-hidden="true" />
          {adding ? "Đóng" : `Thêm ${lowerLabel}`}
        </button>
      </div>

      <select
        id={selectId}
        value={matchedValue}
        disabled={disabled || creating}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {loading && !options.length ? `Đang tải ${lowerLabel}…` : placeholder || `Chọn ${lowerLabel}`}
        </option>
        {options.map((optionName) => (
          <option key={optionName} value={optionName}>
            {optionName}
          </option>
        ))}
      </select>

      {adding && (
        <div className="perfume-inline-creator">
          <input
            type="text"
            value={newName}
            disabled={disabled || creating}
            maxLength={200}
            placeholder={`Nhập tên ${lowerLabel} mới…`}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setAdding(false);
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            disabled={disabled || creating || !newName.trim()}
            onClick={() => void handleCreate()}
            className="perfume-button primary"
          >
            {creating ? "Đang thêm…" : "Thêm"}
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
            className="perfume-button"
          >
            Hủy
          </button>
        </div>
      )}
    </div>
  );
}

export function MultiGroupSelect({
  label = "Nhóm hương",
  value = "",
  terms = [],
  loading = false,
  disabled = false,
  onChange,
}) {
  const selectedGroups = useMemo(
    () => splitFragranceGroups(value).map((name) => ({ name, url: null })),
    [value],
  );
  return (
    <MultiNoteSelect
      kind="group"
      unitLabel="nhóm hương"
      label={label}
      selectedNotes={selectedGroups}
      terms={terms}
      loading={loading}
      disabled={disabled}
      onChange={(nextList) =>
        onChange(
          nextList
            .map((item) => (typeof item === "string" ? item : item?.name))
            .filter(Boolean)
            .join(", "),
        )
      }
    />
  );
}

export function MultiNoteSelect({
  kind = "note",
  unitLabel = "note hương",
  label,
  selectedNotes = [],
  terms = [],
  loading = false,
  disabled = false,
  onChange,
}) {
  const { axios, getToken, storeResources, publicCatalog, dashboardCache } = useAppContext();
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(120);
  const [creating, setCreating] = useState(false);
  const createdNotes = useSessionCreatedTerms(kind);

  const normalizedSelected = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const item of selectedNotes || []) {
      const name = normalizeText(typeof item === "string" ? item : item?.name);
      const key = normalizeKey(name);
      if (name && !seen.has(key)) {
        seen.add(key);
        result.push({
          name,
          url: typeof item === "object" && item?.url ? item.url : null,
        });
      }
    }
    return result;
  }, [selectedNotes]);

  const selectedKeySet = useMemo(
    () => new Set(normalizedSelected.map((item) => normalizeKey(item.name))),
    [normalizedSelected],
  );

  const allNoteTerms = useMemo(() => {
    const byKey = new Map();
    for (const term of [...terms, ...createdNotes]) {
      const name = normalizeText(term?.name);
      const key = normalizeKey(name);
      if (name && !byKey.has(key)) {
        byKey.set(key, {
          _id: term._id || key,
          name,
          sourceUrl: term.sourceUrl || null,
          foldName: foldSearchText(name),
        });
      }
    }
    for (const selected of normalizedSelected) {
      const key = normalizeKey(selected.name);
      if (!byKey.has(key)) {
        byKey.set(key, {
          _id: `selected:${key}`,
          name: selected.name,
          sourceUrl: selected.url || null,
          foldName: foldSearchText(selected.name),
        });
      }
    }
    return [...byKey.values()].sort((a, b) => termCollator.compare(a.name, b.name));
  }, [terms, createdNotes, normalizedSelected]);

  const trimmedQuery = normalizeText(query);
  const foldedQuery = foldSearchText(trimmedQuery);
  const exactMatch = useMemo(
    () =>
      trimmedQuery
        ? allNoteTerms.find((term) => normalizeKey(term.name) === normalizeKey(trimmedQuery))
        : null,
    [allNoteTerms, trimmedQuery],
  );

  const filteredTerms = useMemo(() => {
    if (!foldedQuery) return allNoteTerms;
    const normQuery = normalizeKey(trimmedQuery);
    const hasAccent = normQuery !== foldedQuery;
    return allNoteTerms.filter((term) =>
      hasAccent
        ? normalizeKey(term.name).includes(normQuery)
        : term.foldName.includes(foldedQuery),
    );
  }, [allNoteTerms, foldedQuery, trimmedQuery]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  const toggleNote = (term) => {
    if (disabled) return;
    const key = normalizeKey(term.name);
    if (selectedKeySet.has(key)) {
      onChange(normalizedSelected.filter((item) => normalizeKey(item.name) !== key));
    } else {
      onChange([
        ...normalizedSelected,
        { name: term.name, url: term.sourceUrl || null },
      ]);
    }
  };

  const removeNote = (name) => {
    if (disabled) return;
    const key = normalizeKey(name);
    onChange(normalizedSelected.filter((item) => normalizeKey(item.name) !== key));
  };

  const handleCreateNote = async () => {
    if (!trimmedQuery || creating || disabled) return;
    if (exactMatch) {
      if (!selectedKeySet.has(normalizeKey(exactMatch.name))) {
        toggleNote(exactMatch);
      }
      setQuery("");
      return;
    }

    setCreating(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/catalog/terms",
        { kind, name: trimmedQuery, contentStatus: "linked" },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 },
      );
      if (!data.success) throw new Error(data.message || `Không thể thêm ${unitLabel}`);
      const savedTerm = data.term || {
        _id: `local:${Date.now()}`,
        kind,
        name: trimmedQuery,
        sourceUrl: "",
      };
      recordSessionTerm(kind, savedTerm);
      storeResources.invalidateCatalog();
      publicCatalog?.clear?.();
      dashboardCache?.clear?.();
      const createdKey = normalizeKey(savedTerm.name);
      if (!selectedKeySet.has(createdKey)) {
        onChange([
          ...normalizedSelected,
          { name: savedTerm.name, url: savedTerm.sourceUrl || null },
        ]);
      }
      setQuery("");
      toast.success(`Đã thêm ${unitLabel} "${savedTerm.name}"`);
    } catch (error) {
      if (error.response?.status === 409) {
        const fallbackTerm = { _id: `local:${Date.now()}`, kind, name: trimmedQuery, sourceUrl: "" };
        recordSessionTerm(kind, fallbackTerm);
        storeResources.invalidateCatalog();
        if (!selectedKeySet.has(normalizeKey(trimmedQuery))) {
          onChange([...normalizedSelected, { name: trimmedQuery, url: null }]);
        }
        setQuery("");
        toast.success(`Đã chọn ${unitLabel} "${trimmedQuery}"`);
      } else {
        toast.error(error.response?.data?.message || error.message || `Không thể thêm ${unitLabel}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const summaryText =
    loading && !allNoteTerms.length
      ? `Đang tải danh sách ${unitLabel}…`
      : normalizedSelected.length === 0
        ? `Chọn ${unitLabel} từ danh sách…`
        : `Đã chọn ${normalizedSelected.length} ${unitLabel}`;

  return (
    <div ref={containerRef} className="perfume-field perfume-multi-note-field">
      <div className="perfume-field-header">
        <span className="perfume-field-label-text">{label}</span>
        <span className="perfume-note-count">
          {normalizedSelected.length > 0 ? `${normalizedSelected.length} đã chọn` : "Chưa chọn"}
        </span>
      </div>

      <div className="perfume-note-selector">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            setOpen((current) => !current);
            setVisibleLimit(120);
          }}
          className={`perfume-note-trigger${open ? " is-open" : ""}`}
        >
          <span className={normalizedSelected.length === 0 ? "perfume-note-placeholder" : ""}>
            {summaryText}
          </span>
          <ChevronDown size={16} aria-hidden="true" className="perfume-note-chevron" />
        </button>

        {open && (
          <div className="perfume-note-dropdown" role="dialog" aria-label={`Chọn ${label}`}>
            <div className="perfume-note-search-bar">
              <Search size={15} aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                disabled={disabled || creating}
                maxLength={160}
                placeholder={`Tìm kiếm hoặc nhập ${unitLabel} mới…`}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleLimit(120);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (exactMatch) {
                      toggleNote(exactMatch);
                      setQuery("");
                    } else if (trimmedQuery) {
                      void handleCreateNote();
                    }
                  }
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="perfume-note-search-clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {trimmedQuery && !exactMatch && (
              <button
                type="button"
                disabled={creating || disabled}
                onClick={() => void handleCreateNote()}
                className="perfume-note-quick-create"
              >
                <Plus size={14} aria-hidden="true" />
                {creating
                  ? `Đang thêm ${unitLabel}…`
                  : `Thêm ${unitLabel} mới "${trimmedQuery}" vào thư viện`}
              </button>
            )}

            <div
              role="listbox"
              aria-multiselectable="true"
              aria-label={`Danh sách ${label}`}
              className="perfume-note-options"
              onScroll={(event) => {
                const element = event.currentTarget;
                if (
                  element.scrollTop + element.clientHeight >= element.scrollHeight - 80 &&
                  visibleLimit < filteredTerms.length
                ) {
                  setVisibleLimit((current) => Math.min(filteredTerms.length, current + 120));
                }
              }}
            >
              {filteredTerms.length === 0 ? (
                <p className="perfume-note-empty-list">
                  {loading
                    ? `Đang tải thư viện ${unitLabel}…`
                    : `Không tìm thấy ${unitLabel} phù hợp. Nhấn nút phía trên để thêm mới.`}
                </p>
              ) : (
                filteredTerms.slice(0, visibleLimit).map((term) => {
                  const isSelected = selectedKeySet.has(normalizeKey(term.name));
                  return (
                    <button
                      type="button"
                      key={term._id || term.name}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleNote(term)}
                      className={`perfume-note-option${isSelected ? " is-selected" : ""}`}
                    >
                      <span className="perfume-note-checkbox" aria-hidden="true">
                        {isSelected && <Check size={12} strokeWidth={2.5} />}
                      </span>
                      <span className="perfume-note-option-label">{term.name}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="perfume-note-dropdown-footer">
              <span>
                Đã chọn <strong>{normalizedSelected.length}</strong> mục
              </span>
              <div className="perfume-note-footer-actions">
                {normalizedSelected.length > 0 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange([])}
                    className="perfume-inline-clear-btn"
                  >
                    Bỏ chọn hết
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="perfume-button primary perfume-note-done-btn"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {normalizedSelected.length > 0 ? (
        <div className="perfume-note-chips" aria-label={`Các mục đã chọn cho ${label}`}>
          {normalizedSelected.map((note) => (
            <span key={note.name} className="perfume-note-chip">
              <span>{note.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeNote(note.name)}
                aria-label={`Xóa ${note.name} khỏi ${label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="perfume-note-empty-hint">
          Bấm vào danh sách để chọn một hoặc nhiều {unitLabel} cho {label.toLocaleLowerCase("vi-VN")}.
        </p>
      )}
    </div>
  );
}

export function AccordEditor({ accords, terms = [], onChange, listId }) {
  const update = (index, patch) => onChange(accords.map((row, i) => i === index ? { ...row, ...patch } : row));
  const move = (index, direction) => {
    const rows = [...accords];
    [rows[index], rows[index + direction]] = [rows[index + direction], rows[index]];
    onChange(rows);
  };
  return <section className="perfume-accord-editor" aria-label="Chỉnh sửa các kiểu mùi chính">
    <div className="perfume-section-heading"><div><h3>Các kiểu mùi chính</h3><p className="perfume-muted">Chọn từ thư viện hoặc nhập tên riêng. Tỷ lệ mỗi kiểu mùi từ 0–100%, không bắt buộc cộng thành 100%.</p></div><button type="button" className="perfume-button" disabled={accords.length >= 30} onClick={() => onChange([...accords, { label: "", displayedPercent: null, url: null }])}><Plus size={15} />Thêm kiểu mùi</button></div>
    <datalist id={listId}>{terms.map(term => <option key={term._id} value={term.name} />)}</datalist>
    {!accords.length && <p className="perfume-empty">Chưa có kiểu mùi. Chọn “Thêm kiểu mùi” để bổ sung.</p>}
    <div className="perfume-accord-inputs">{accords.map((accord, index) => <div className="perfume-accord-input-row" key={index}>
      <label className="perfume-field"><span>Kiểu mùi {index + 1}</span><input list={listId} required maxLength={160} value={accord.label} aria-label={`Tên kiểu mùi ${index + 1}`} placeholder="Ví dụ: Gỗ, Cam chanh…" onChange={event => update(index, { label: event.target.value, url: terms.find(term => term.name.toLocaleLowerCase("vi-VN") === event.target.value.trim().toLocaleLowerCase("vi-VN"))?.sourceUrl || null })} /></label>
      <label className="perfume-field perfume-percent-input"><span>Tỷ lệ (%)</span><input type="number" min={0} max={100} step="any" value={accord.displayedPercent ?? ""} aria-label={`Tỷ lệ kiểu mùi ${index + 1}`} placeholder="Chưa có" onChange={event => update(index, { displayedPercent: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      <div className="perfume-accord-actions"><button type="button" className="perfume-icon-button" aria-label={`Đưa kiểu mùi ${index + 1} lên`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" className="perfume-icon-button" aria-label={`Đưa kiểu mùi ${index + 1} xuống`} disabled={index === accords.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" className="perfume-icon-button" aria-label={`Xóa kiểu mùi ${index + 1}`} onClick={() => onChange(accords.filter((_, i) => i !== index))}><X size={14} /></button></div>
    </div>)}</div>
    {accords.length > 0 && <div className="perfume-editor-preview"><h4>Xem trước kiểu mùi</h4><FragranceAccords accords={accords.filter(row => row.label.trim())} /></div>}
  </section>;
}

export function AssessmentEditor({ fragrance, onChange }) {
  const update = (key, index, field, value) => onChange(key, fragrance[key].map((row, i) => i === index ? { ...row, [field]: value === "" ? null : Number(value) } : row));
  return <>
    <div className="perfume-assessment-editor">{assessmentGroups.map(group => <section className="perfume-assessment-group" key={group.key}>
      <h3>{group.title}</h3><div className="perfume-table-scroll"><table><thead><tr><th>Mức đánh giá</th>{group.counts && <th>Số lượt</th>}<th>Tỷ lệ (%)</th></tr></thead><tbody>{fragrance[group.key].map((row, index) => <tr key={row.label}><th scope="row">{row.label}</th>{group.counts && <td><input type="number" min={0} step={1} aria-label={`Số lượt ${group.title} ${row.label}`} value={row.displayedCount ?? ""} placeholder="—" onChange={event => update(group.key, index, "displayedCount", event.target.value)} /></td>}<td><input type="number" min={0} max={100} step="any" aria-label={`Tỷ lệ ${group.title} ${row.label}`} value={row.displayedPercent ?? ""} placeholder="—" onChange={event => update(group.key, index, "displayedPercent", event.target.value)} /></td></tr>)}</tbody></table></div>
    </section>)}</div>
    <p className="perfume-muted">Để trống khi chưa có dữ liệu; nhập 0 khi giá trị thực sự bằng 0. Tỷ lệ và số lượt được quản lý riêng, không tự suy ra phương pháp tính của nguồn.</p>
    <div className="perfume-editor-preview"><h3>Xem trước đánh giá trải nghiệm</h3><FragranceCharts fragrance={fragrance} showSourceIssues /></div>
  </>;
}
