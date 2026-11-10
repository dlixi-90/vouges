import { LoadingStatus } from "./LoadingState";
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, RefreshCw, Search, X } from "lucide-react";
import { PERFUME_FILTERS } from "../data/perfumeFilters";
import { useAppContext } from "../context/AppContext";
import useCachedResource from "../hooks/useCachedResource";
import { filterOptionSearchKey, sortFilterOptions } from "../utils/filterOptions";

const compactQuery = "(max-width: 1023px)";
const EMPTY_OPTIONS = [];
const subscribeToLayout = callback => {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const getCompactLayout = () => window.matchMedia(compactQuery).matches;

const FilterGroup = memo(function FilterGroup({ field, options = EMPTY_OPTIONS, selected = [], onChange, sidebar, loading }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const initialLimit = sidebar ? 6 : 40;
  const [limit, setLimit] = useState(initialLimit);
  const all = useMemo(() => sortFilterOptions(field.id, [...selected, ...options]), [field.id, options, selected]);
  const queryKey = useMemo(() => filterOptionSearchKey(query), [query]);
  const matching = useMemo(() => queryKey ? all.filter(value => filterOptionSearchKey(value).includes(queryKey)) : all, [all, queryKey]);
  return <details className="inessa-filter-facet" open={field.id === "gender" || (sidebar && ["brands", "sizes"].includes(field.id)) || selected.length > 0 || undefined}>
    <summary><span>{field.label}{selected.length > 0 && <small>{selected.length}</small>}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="inessa-filter-facet-body">
      {field.hint && <p className="inessa-filter-help">{field.hint}</p>}
      {field.searchable && <label className="inessa-filter-facet-search"><Search size={15} aria-hidden="true" /><input type="search" autoComplete="off" autoCorrect="off" spellCheck="false" aria-label={`Tìm ${field.label.toLocaleLowerCase("vi-VN")}`} placeholder={`Tìm ${field.label.toLocaleLowerCase("vi-VN")}…`} value={query} onChange={event => { setQuery(event.target.value); setLimit(initialLimit); }} /></label>}
      <div className="inessa-filter-options" aria-labelledby={id}>
        <span id={id} className="sr-only">{field.label}</span>
        {matching.slice(0, limit).map(value => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(field.id, value)} /><span>{value}</span></label>)}
        {loading && !matching.length && <div aria-hidden="true"><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line short" /></div>}
        {!loading && !matching.length && <p className="inessa-filter-help">Không có lựa chọn phù hợp.</p>}
        {matching.length > limit && <button type="button" onClick={() => setLimit(value => value + 40)} className="inessa-filter-more">Hiện thêm {Math.min(40, matching.length - limit)} lựa chọn</button>}
      </div>
    </div>
  </details>;
});

export default function CollectionFilterDrawer({
  open = false,
  onClose, selectedFilters, onFilterChange, minPrice, maxPrice, priceCeiling, priceDisabled,
  onMinPriceChange, onMaxPriceChange, formatPrice, resultCount, onReset, filtering,
}) {
  const dialogRef = useRef(null);
  const isSidebar = !useSyncExternalStore(subscribeToLayout, getCompactLayout, () => true);
  const { publicCatalog } = useAppContext();
  const visible = isSidebar || open;
  const resource = useMemo(() => visible ? {
    peek: () => publicCatalog.peekFilters(),
    load: settings => publicCatalog.filters(settings),
  } : null, [publicCatalog, visible]);
  const { data, loading, error, reload } = useCachedResource(resource, { scope: "collection-filter-options", keepPrevious: true });
  const options = data?.options || null;
  useEffect(() => {
    if (!visible) return;
    let refreshedAt = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - refreshedAt < 15000) return;
      refreshedAt = Date.now();
      reload();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [visible, reload]);
  const renderGroup = field => <FilterGroup key={field.id} field={field} options={options?.[field.id]} selected={selectedFilters[field.id]} onChange={onFilterChange} sidebar={isSidebar} loading={!options && !error} />;

  useLayoutEffect(() => {
    if (!isSidebar) return;
    const sidebar = dialogRef.current;
    let frame = null;
    const updateHeight = () => {
      frame = null;
      const headerEl = document.querySelector(".net-header");
      const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
      const minTop = Math.max(16, headerBottom + 16);
      const top = Math.max(minTop, sidebar.getBoundingClientRect().top);
      sidebar.style.setProperty("--filter-available-height", `${Math.max(120, window.innerHeight - top - 16)}px`);
    };
    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateHeight);
    };
    updateHeight();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isSidebar]);

  useEffect(() => {
    if (isSidebar || !open) return;
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
  }, [isSidebar, open]);

  if (!isSidebar && !open) return null;
  const Container = isSidebar ? "aside" : "dialog";

  return (
    <Container ref={dialogRef} id={isSidebar ? "collection-filter-sidebar" : "collection-filter-drawer"}
      className={isSidebar ? "collection-filter-sidebar" : "inessa-filter-drawer"}
      aria-labelledby="collection-filter-title"
      onCancel={isSidebar ? undefined : (event) => { event.preventDefault(); onClose(); }}
      onClick={isSidebar ? undefined : (event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <header className="inessa-filter-drawer-header">
        <h2 id="collection-filter-title">Bộ lọc sản phẩm</h2>
        <div className="collection-filter-actions">
        <button type="button" onClick={reload} disabled={loading} aria-label="Cập nhật bộ lọc" title="Cập nhật bộ lọc" className="inessa-filter-close">
          <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {!isSidebar && <button type="button" onClick={onClose} aria-label="Đóng bộ lọc" className="inessa-filter-close">
          <X size={24} strokeWidth={1.5} aria-hidden="true" />
        </button>}
        </div>
      </header>

      <div className="inessa-filter-content" tabIndex={isSidebar ? 0 : undefined}
        role={isSidebar ? "region" : undefined} aria-label={isSidebar ? "Tiêu chí lọc sản phẩm" : undefined}>
        {!options && !error && <LoadingStatus label="Đang tải các tiêu chí…" />}
        {error && <p role="alert" className="inessa-filter-help">{error} <button type="button" onClick={reload} className="underline">Thử lại</button></p>}
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
        {!isSidebar && <button type="button" onClick={onClose} disabled={filtering} className="inessa-filter-view-results">{filtering ? "Đang lọc…" : `Xem ${resultCount} sản phẩm`}</button>}
        <button type="button" onClick={onReset} className="inessa-filter-reset">Xóa bộ lọc</button>
      </footer>
    </Container>
  );
}
