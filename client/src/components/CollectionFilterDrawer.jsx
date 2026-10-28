import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { PERFUME_FILTERS } from "../data/perfumeFilters";
import { useAppContext } from "../context/AppContext";

function FilterGroup({ field, options = [], selected = [], onChange }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);
  const all = [...new Set([...selected, ...options])];
  const normalized = value => value.normalize("NFC").toLocaleLowerCase("vi-VN");
  const matching = all.filter(value => normalized(value).includes(normalized(query)));
  return <details className="inessa-filter-facet" open={field.id === "gender" || undefined}>
    <summary><span>{field.label}{selected.length > 0 && <small>{selected.length}</small>}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="inessa-filter-facet-body">
      {field.hint && <p className="inessa-filter-help">{field.hint}</p>}
      {field.searchable && <label className="inessa-filter-facet-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label={`Tìm ${field.label.toLocaleLowerCase("vi-VN")}`} placeholder={`Tìm ${field.label.toLocaleLowerCase("vi-VN")}…`} value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} /></label>}
      <div className="inessa-filter-options" aria-labelledby={id}>
        <span id={id} className="sr-only">{field.label}</span>
        {matching.slice(0, limit).map(value => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(field.id, value)} /><span>{value}</span></label>)}
        {!matching.length && <p className="inessa-filter-help">Không có lựa chọn phù hợp.</p>}
        {matching.length > limit && <button type="button" onClick={() => setLimit(value => value + 40)} className="inessa-filter-more">Hiện thêm {Math.min(40, matching.length - limit)} lựa chọn</button>}
      </div>
    </div>
  </details>;
}

export default function CollectionFilterDrawer({
  onClose, selectedFilters, onFilterChange, minPrice, maxPrice, priceCeiling, priceDisabled,
  onMinPriceChange, onMaxPriceChange, formatPrice, resultCount, onReset, filtering,
}) {
  const dialogRef = useRef(null);
  const { publicCatalog } = useAppContext();
  const [options, setOptions] = useState(() => publicCatalog.peekFilters()?.options || null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    publicCatalog.filters().then(data => { if (active) { setOptions(data.options); setError(""); } })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [publicCatalog, attempt]);
  const renderGroup = field => <FilterGroup key={field.id} field={field} options={options?.[field.id]} selected={selectedFilters[field.id]} onChange={onFilterChange} />;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog ref={dialogRef} id="collection-filter-drawer" className="inessa-filter-drawer"
      aria-labelledby="collection-filter-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <header className="inessa-filter-drawer-header">
        <h2 id="collection-filter-title">Bộ lọc sản phẩm</h2>
        <button type="button" onClick={onClose} aria-label="Đóng bộ lọc" className="inessa-filter-close">
          <X size={24} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="inessa-filter-content">
        {!options && !error && <p role="status" className="inessa-filter-help">Đang tải các tiêu chí…</p>}
        {error && <p role="alert" className="inessa-filter-help">{error} <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Thử lại</button></p>}
        {PERFUME_FILTERS.slice(0, 2).map(renderGroup)}
        <section className="inessa-filter-price" aria-labelledby="collection-price-title">
          <h3 id="collection-price-title">Khoảng giá</h3>
          <div className="inessa-filter-price-range" style={{
            "--range-min": `${minPrice / priceCeiling * 100}%`,
            "--range-max": `${maxPrice / priceCeiling * 100}%`,
          }}>
            <input type="range" min={0} max={priceCeiling} step={1000} value={minPrice}
              disabled={priceDisabled} onChange={(event) => onMinPriceChange(Number(event.target.value))}
              aria-label="Mức giá tối thiểu" aria-valuetext={formatPrice(minPrice)}
              style={{ zIndex: minPrice >= priceCeiling - 1 ? 3 : 1 }} />
            <input type="range" min={0} max={priceCeiling} step={1000} value={maxPrice}
              disabled={priceDisabled} onChange={(event) => onMaxPriceChange(Number(event.target.value))}
              aria-label="Mức giá tối đa" aria-valuetext={formatPrice(maxPrice)} />
          </div>
          <div className="inessa-filter-price-inputs">
            <label>
              <input type="number" inputMode="numeric" min={0} max={Math.round(maxPrice)} step={1000}
                value={Math.round(minPrice)} disabled={priceDisabled}
                onChange={(event) => onMinPriceChange(Number(event.target.value))}
                aria-label="Giá tối thiểu (VNĐ)" />
              <span>Giá tối thiểu</span><output>{formatPrice(minPrice)}</output>
            </label>
            <label>
              <input type="number" inputMode="numeric" min={0} max={Math.round(priceCeiling)} step={1000}
                value={Math.round(maxPrice)} disabled={priceDisabled}
                onChange={(event) => onMaxPriceChange(Number(event.target.value))}
                aria-label="Giá tối đa (VNĐ)" />
              <span>Giá tối đa</span><output>{formatPrice(maxPrice)}</output>
            </label>
          </div>
        </section>

        {PERFUME_FILTERS.slice(2).map(renderGroup)}
      </div>

      <footer className="inessa-filter-footer">
        <button type="button" onClick={onClose} disabled={filtering} className="inessa-filter-view-results">{filtering ? "Đang lọc…" : `Xem ${resultCount} sản phẩm`}</button>
        <button type="button" onClick={onReset} className="inessa-filter-reset">Xóa bộ lọc</button>
      </footer>
    </dialog>
  );
}
