import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, LoaderCircle, Package, Search, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { getProductPriceRange } from "../utils/productPrice";
import { formatVnd } from "../utils/money";
import { getProductImageUrl } from "../utils/productImage";
import "./quick-product-search.css";

export default function QuickProductSearch({
  className = "",
  placeholder = "Tìm sản phẩm...",
  buildItemUrl,
  onSearch,
}) {
  const { pathname } = useLocation();
  const { publicCatalog, currency = "₫" } = useAppContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isComposingRef = useRef(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Clear query and close popup on page navigation
  useEffect(() => {
    setQuery("");
    setResults([]);
    setTotalCount(0);
    setIsOpen(false);
  }, [pathname]);

  // Click outside to dismiss popup
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // Debounced search for popup preview (limit 5 related items)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !publicCatalog) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await publicCatalog.browse(
          {
            q: trimmed,
            page: 1,
            limit: 5,
            availability: "all",
            sort: "relevant",
          },
          { signal: controller.signal }
        );

        if (!controller.signal.aborted) {
          setResults(data.products || []);
          setTotalCount(data.total || 0);
          setLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, publicCatalog]);

  const handleSubmit = (event) => {
    event?.preventDefault();
    const trimmed = query.trim();
    if (trimmed && onSearch) {
      setIsOpen(false);
      onSearch(trimmed);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setTotalCount(0);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleChange = (event) => {
    const next = event.target.value;
    setQuery(next);
    if (next.trim().length >= 1) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    if (query.trim().length >= 1) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    } else if (event.key === "Enter") {
      if (isComposingRef.current) return;
      handleSubmit(event);
    }
  };

  const hasSearch = Boolean(query.trim());

  return (
    <div ref={containerRef} className={`quick-product-search-wrapper ${className}`}>
      <form className="quick-product-search" role="search" onSubmit={handleSubmit}>
        <Search size={17} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          value={query}
          onFocus={handleFocus}
          onChange={handleChange}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            handleChange(event);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={isOpen && hasSearch}
          aria-autocomplete="list"
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

      {isOpen && hasSearch && (
        <div className="quick-search-popup" role="region" aria-label="Gợi ý sản phẩm tìm kiếm">
          <div className="quick-search-popup-header">
            <span>Sản phẩm liên quan</span>
            {totalCount > 0 && <small>{totalCount.toLocaleString("vi-VN")} kết quả</small>}
          </div>

          {loading && !results.length ? (
            <div className="quick-search-popup-loading">
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              <span>Đang tìm kiếm sản phẩm…</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="quick-search-popup-list">
                {results.map((product) => {
                  const itemUrl = buildItemUrl ? buildItemUrl(product) : `/collection/${product._id}`;
                  const imageSrc = product.images?.[0] ? getProductImageUrl(product.images[0], 120) : null;
                  const priceRange = getProductPriceRange(product);
                  const priceText = priceRange
                    ? priceRange.min === priceRange.max
                      ? formatVnd(priceRange.min, currency)
                      : `${formatVnd(priceRange.min, currency)} – ${formatVnd(priceRange.max, currency)}`
                    : "Chưa có giá";
                  const subtitle = [product.brand, product.category || product.type].filter(Boolean).join(" · ");
                  const isAvailable = product.inStock !== false;

                  return (
                    <Link
                      key={product._id}
                      to={itemUrl}
                      className="quick-search-popup-item"
                      onClick={() => {
                        setIsOpen(false);
                        setQuery("");
                      }}
                    >
                      <div className="quick-search-popup-thumb">
                        {imageSrc ? (
                          <img src={imageSrc} alt="" width={44} height={44} loading="lazy" decoding="async" />
                        ) : (
                          <Package size={20} strokeWidth={1.5} color="#a8a29e" aria-hidden="true" />
                        )}
                      </div>
                      <div className="quick-search-popup-info">
                        <strong className="quick-search-popup-title" title={product.title}>
                          {product.title}
                        </strong>
                        {subtitle && <small className="quick-search-popup-subtitle">{subtitle}</small>}
                      </div>
                      <div className="quick-search-popup-meta">
                        <span className="quick-search-popup-price">{priceText}</span>
                        {!isAvailable && <span className="quick-search-popup-stock">Hết hàng</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {onSearch && (
                <button
                  type="button"
                  className="quick-search-popup-all"
                  onClick={handleSubmit}
                >
                  <span>Xem tất cả kết quả cho "<strong>{query.trim()}</strong>"</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <div className="quick-search-popup-empty">
              <p>Không tìm thấy sản phẩm phù hợp với "{query.trim()}".</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
