import { useEffect, useRef } from "react";
import { ChevronRight, X } from "lucide-react";

export default function CollectionFilterDrawer({
  onClose, searchQuery, onSearchChange, categories, selectedCategories, onCategoryChange,
  types, selectedTypes, onTypeChange, minPrice, maxPrice, priceCeiling, priceDisabled,
  onMinPriceChange, onMaxPriceChange, formatPrice, resultCount, onReset,
}) {
  const dialogRef = useRef(null);

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
        <h2 id="collection-filter-title" className="sr-only">Bộ lọc sản phẩm</h2>
        <button type="button" onClick={onClose} aria-label="Đóng bộ lọc" className="inessa-filter-close">
          <X size={24} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="inessa-filter-content">
        <form className="inessa-filter-search" role="search" onSubmit={(event) => { event.preventDefault(); onClose(); }}>
          <input type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Tìm kiếm sản phẩm" placeholder="Tìm kiếm sản phẩm…" />
          <button type="submit" aria-label="Tìm kiếm"><ChevronRight size={21} strokeWidth={1.5} aria-hidden="true" /></button>
        </form>

        <section className="inessa-filter-price" aria-labelledby="collection-price-title">
          <h3 id="collection-price-title">Lọc theo<br />giá</h3>
          <div className="inessa-filter-price-range" style={{
            "--range-min": `${minPrice / priceCeiling * 100}%`,
            "--range-max": `${maxPrice / priceCeiling * 100}%`,
          }}>
            <input type="range" min={0} max={priceCeiling} step={1} value={minPrice}
              disabled={priceDisabled} onChange={(event) => onMinPriceChange(Number(event.target.value))}
              aria-label="Mức giá tối thiểu" aria-valuetext={formatPrice(minPrice)}
              style={{ zIndex: minPrice >= priceCeiling - 1 ? 3 : 1 }} />
            <input type="range" min={0} max={priceCeiling} step={1} value={maxPrice}
              disabled={priceDisabled} onChange={(event) => onMaxPriceChange(Number(event.target.value))}
              aria-label="Mức giá tối đa" aria-valuetext={formatPrice(maxPrice)} />
          </div>
          <div className="inessa-filter-price-inputs">
            <label>
              <input type="number" inputMode="numeric" min={0} max={Math.round(maxPrice * 1000)} step={1000}
                value={Math.round(minPrice * 1000)} disabled={priceDisabled}
                onChange={(event) => onMinPriceChange(Number(event.target.value) / 1000)}
                aria-label="Giá tối thiểu (VNĐ)" />
              <span>Giá tối thiểu</span><output>{formatPrice(minPrice)}</output>
            </label>
            <label>
              <input type="number" inputMode="numeric" min={0} max={Math.round(priceCeiling * 1000)} step={1000}
                value={Math.round(maxPrice * 1000)} disabled={priceDisabled}
                onChange={(event) => onMaxPriceChange(Number(event.target.value) / 1000)}
                aria-label="Giá tối đa (VNĐ)" />
              <span>Giá tối đa</span><output>{formatPrice(maxPrice)}</output>
            </label>
          </div>
        </section>

        <section className="inessa-filter-group" aria-labelledby="collection-category-title">
          <h3 id="collection-category-title">Lọc theo danh mục</h3>
          <div className="inessa-filter-options">
            {categories.map((category) => <label key={category}>
              <input type="checkbox" value={category} checked={selectedCategories.includes(category)}
                onChange={() => onCategoryChange(category)} />
              <span>{category}</span>
            </label>)}
          </div>
        </section>

        <section className="inessa-filter-group" aria-labelledby="collection-type-title">
          <h3 id="collection-type-title">Loại sản phẩm</h3>
          <div className="inessa-filter-options">
            {types.map((type) => <label key={type}>
              <input type="checkbox" value={type} checked={selectedTypes.includes(type)} onChange={() => onTypeChange(type)} />
              <span>{type}</span>
            </label>)}
          </div>
        </section>
      </div>

      <footer className="inessa-filter-footer">
        <button type="button" onClick={onClose} className="inessa-filter-view-results">Xem {resultCount} sản phẩm</button>
        <button type="button" onClick={onReset} className="inessa-filter-reset">Xóa bộ lọc</button>
      </footer>
    </dialog>
  );
}
