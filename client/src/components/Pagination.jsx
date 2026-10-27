import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationPages } from "../utils/pagination";
import "../pagination.css";

export default function Pagination({ page, totalPages, onPageChange, disabled = false, compact = false, arrowsOnly = false, className = "", label = "Phân trang" }) {
  const total = Number.isFinite(Number(totalPages)) ? Math.max(1, Math.trunc(Number(totalPages)) || 1) : 1;
  const active = Math.max(1, Math.min(total, Math.trunc(Number(page)) || 1));
  if (total <= 1 && !arrowsOnly) return null;
  const select = (value) => {
    if (!disabled && value !== active && value >= 1 && value <= total) onPageChange(value);
  };
  return <nav className={`velours-pagination${compact ? " is-compact" : ""} ${className}`} aria-label={label}>
    <button type="button" aria-label="Trang trước" title="Trang trước" disabled={disabled || active === 1} onClick={() => select(active - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
    {!arrowsOnly && getPaginationPages(active, total).map((value) => typeof value === "number"
      ? <button type="button" key={value} aria-label={`Trang ${value}`} aria-current={value === active ? "page" : undefined} disabled={disabled} onClick={() => select(value)}>{value}</button>
      : <span key={value} className="velours-pagination-gap" aria-hidden="true">…</span>)}
    <button type="button" aria-label="Trang sau" title="Trang sau" disabled={disabled || active === total} onClick={() => select(active + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
  </nav>;
}
