import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { prefetchCollection } from "../utils/prefetchCollection";

const normalized = value => value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");

function BrandImage({ brand, eager }) {
  const [failed, setFailed] = useState(null);
  return <span className="store-brand-image">{brand.image && failed !== brand.image ? <img src={brand.image} alt="" loading={eager ? "eager" : "lazy"} decoding="async" width={120} height={64} onError={() => setFailed(brand.image)} /> : <span>{brand.name}</span>}</span>;
}

export default function BrandMenu({ directory, compact = false, onNavigate }) {
  const location = useLocation();
  const { setSearchQuery, publicCatalog } = useAppContext();
  const [openedAt, setOpenedAt] = useState(null), [query, setQuery] = useState("");
  const ref = useRef(null), buttonRef = useRef(null), searchRef = useRef(null);
  const id = useId();
  const open = openedAt === location.key;
  const selectedBrand = new URLSearchParams(location.search).get("brand");
  const active = location.pathname === "/collection" && Boolean(selectedBrand);
  const brands = directory?.brands || [];
  const visible = brands.filter(brand => normalized(brand.name).includes(normalized(query)));
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!ref.current?.contains(event.target)) setOpenedAt(null); };
    const escape = event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpenedAt(null); buttonRef.current?.focus({ preventScroll: true }); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const choose = event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setSearchQuery(""); setOpenedAt(null); onNavigate?.();
  };
  return <div ref={ref} className={`store-brand-menu${compact ? " is-compact" : ""}`}>
    <button ref={buttonRef} type="button" className={`store-brand-trigger${active ? " is-active" : ""}`} aria-expanded={open} aria-controls={id}
      onPointerEnter={() => directory?.load()} onFocus={() => directory?.load()}
      onClick={() => { if (!open) { setQuery(""); void directory?.load(); } setOpenedAt(open ? null : location.key); }}
      onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); void directory?.load(); setOpenedAt(location.key); window.requestAnimationFrame(() => searchRef.current?.focus()); } }}>Thương hiệu<ChevronDown size={13} aria-hidden="true" /></button>
    {open && <div id={id} className="store-brand-dropdown" role="region" aria-label="Danh sách thương hiệu nước hoa">
      <header><div><strong>Thương hiệu nước hoa</strong><span>{brands.length} thương hiệu trong bộ sưu tập</span></div><button type="button" onClick={() => { setOpenedAt(null); buttonRef.current?.focus(); }} aria-label="Đóng danh sách thương hiệu"><X size={17} /></button></header>
      <label className="store-brand-search"><Search size={15} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm thương hiệu…" aria-label="Tìm thương hiệu nước hoa" /></label>
      {directory?.loading && !brands.length && <p role="status" className="store-brand-state">Đang tải thương hiệu…</p>}
      {directory?.error && <p role="alert" className="store-brand-state">{brands.length ? "Chưa thể cập nhật danh sách." : directory.error}<button type="button" onClick={directory.reload}>Thử lại</button></p>}
      {(brands.length > 0 || (!directory?.loading && !directory?.error)) && <div className="store-brand-grid">{visible.map((brand, index) => <Link key={brand.name} to={`/collection?brand=${encodeURIComponent(brand.name)}`} onClick={choose} onPointerEnter={event => prefetchCollection(publicCatalog, event.currentTarget.getAttribute("href"))} onFocus={event => prefetchCollection(publicCatalog, event.currentTarget.getAttribute("href"))} aria-current={active && normalized(selectedBrand) === normalized(brand.name) ? "page" : undefined} className="store-brand-card"><BrandImage brand={brand} eager={index < 10} /><strong>{brand.name}</strong></Link>)}{!visible.length && <p className="store-brand-state">{query ? "Không tìm thấy thương hiệu phù hợp." : "Chưa có thương hiệu trong bộ sưu tập."}</p>}</div>}
      <footer><Link to="/collection" onClick={choose}>Khám phá toàn bộ bộ sưu tập</Link></footer>
    </div>}
  </div>;
}
