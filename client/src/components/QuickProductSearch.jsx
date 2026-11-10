import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import "./quick-product-search.css";

export default function QuickProductSearch({ className = "", placeholder = "Tìm sản phẩm...", onSearch }) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const isComposingRef = useRef(false);
  const inputRef = useRef(null);

  // Clear query on page navigation so search input does not retain stale terms across pages
  useEffect(() => {
    setQuery("");
  }, [pathname]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed && onSearch) {
      onSearch(trimmed);
    }
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <form className={`quick-product-search ${className}`} role="search" onSubmit={handleSubmit}>
      <Search size={17} aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        value={query}
        onChange={event => setQuery(event.target.value)}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={event => {
          isComposingRef.current = false;
          setQuery(event.target.value);
        }}
        onKeyDown={event => {
          if (event.key === "Enter") {
            if (isComposingRef.current) return;
            handleSubmit(event);
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {query && (
        <button
          type="button"
          className="quick-product-search-clear"
          onClick={handleClear}
          aria-label="Xóa từ khóa"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      <button type="submit" aria-label="Tìm kiếm">
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </form>
  );
}