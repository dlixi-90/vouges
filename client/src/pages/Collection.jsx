import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Item from "../components/Item";
import { useAppContext } from "../context/AppContext";
const CollectionFilterDrawer = lazy(() => import("../components/CollectionFilterDrawer"));
import CollectionSearch from "../components/CollectionSearch";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { formatVnd } from "../utils/money";
import Pagination from "../components/Pagination";
import usePaginationScroll from "../hooks/usePaginationScroll";
import useCollectionPage from "../hooks/useCollectionPage";
import { emptyPerfumeFilters } from "../data/perfumeFilters";
import { COLLECTION_PAGE_SIZE } from "../utils/publicCatalog";
import StorePageHeading from "../components/StorePageHeading";
import { LoadingStatus, ProductGridSkeleton } from "../components/LoadingState";
import "./collection.css";

const Collection = () => {
  useLayoutEffect(() => {
    // Reset when the lazy-loaded page mounts, before its first paint.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const { searchQuery, setSearchQuery, currency, navigate, publicCatalog } = useAppContext();
  const [searchParams] = useSearchParams();
  const routeBrand = searchParams.get("brand") || "";
  const [filters, setFilters] = useState(() => {
    const category = searchParams.get("category");
    const gender = ({ "Nước hoa nam": "Nam", "Nước hoa nữ": "Nữ", "Nước hoa unisex": "Unisex" })[category];
    return { ...emptyPerfumeFilters(), ...(gender ? { gender: [gender] } : {}), ...(routeBrand ? { brands: [routeBrand] } : {}) };
  });
  const [selectedSort, setSelectedSort] = useState("relevant");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = COLLECTION_PAGE_SIZE;
  const criteriaKey = JSON.stringify({ q: searchQuery, facets: JSON.stringify(filters), minPrice, ...(maxPrice !== null ? { maxPrice } : {}) });
  const [settledCriteria, setSettledCriteria] = useState(criteriaKey);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledCriteria(criteriaKey), 180);
    return () => window.clearTimeout(timer);
  }, [criteriaKey]);
  const criteria = JSON.parse(settledCriteria);
  const criteriaPending = settledCriteria !== criteriaKey;
  const { data: collection, loading: pageLoading, error: pageError, reload } = useCollectionPage({
    page: currentPage, limit: itemsPerPage, ...criteria, sort: selectedSort,
  }, { enabled: !criteriaPending });
  const productsLoading = pageLoading || criteriaPending;
  const prefetchKey = JSON.stringify({ ...criteria, limit: itemsPerPage, sort: selectedSort, page: (collection?.page || 1) + 1 });
  useEffect(() => {
    if (productsLoading || !collection || collection.page >= collection.totalPages) return;
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    const timer = window.setTimeout(() => { void publicCatalog.browse(JSON.parse(prefetchKey)).catch(() => {}); }, 400);
    return () => window.clearTimeout(timer);
  }, [publicCatalog, productsLoading, collection, prefetchKey]);
  const maxProductPrice = collection?.filters.maxPrice || 0;
  // Every price and filter value is integer VND.
  const priceCeiling = Math.max(1, Math.ceil(maxProductPrice));
  const priceLimit = maxPrice === null ? priceCeiling : Math.min(maxPrice, priceCeiling);
  const priceFloor = Math.min(minPrice, priceLimit);
  const isPriceFiltered = priceFloor > 0 || (maxPrice !== null && priceLimit < priceCeiling);
  const formatPrice = (price) => formatVnd(price, currency);

  const changeMinPrice = (value) => {
    setMinPrice(Math.max(0, Math.min(value, priceLimit)));
    setCurrentPage(1);
  };
  const changeMaxPrice = (value) => {
    const nextPrice = Math.max(0, Math.min(value, priceCeiling));
    setMaxPrice(nextPrice >= priceCeiling ? null : nextPrice);
    setMinPrice((current) => Math.min(current, nextPrice));
    setCurrentPage(1);
  };
  const resetFilters = () => {
    setFilters(emptyPerfumeFilters());
    setMinPrice(0);
    setMaxPrice(null);
    setSearchQuery("");
    setCurrentPage(1);
    if (routeBrand || searchParams.get("category")) navigate("/collection", { replace: true });
  };

  const toggleFilter = (field, value) => {
    setFilters(current => ({ ...current, [field]: current[field].includes(value)
      ? current[field].filter(item => item !== value) : [...current[field], value] }));
    setCurrentPage(1);
  };

  const total = collection?.total || 0;
  const totalPages = collection?.totalPages || 1;
  const activePage = !productsLoading && collection ? collection.page : currentPage;
  const { listRef, changePage } = usePaginationScroll({ page: activePage, onPageChange: setCurrentPage, ready: !productsLoading });
  const startIndex = ((collection?.page || activePage) - 1) * itemsPerPage;
  const paginatedProducts = collection?.products || [];
  const filterCount = Object.values(filters).reduce((count, values) => count + values.length, 0)
    + Number(isPriceFiltered) + Number(Boolean(searchQuery));

  return (
    <div className="net-collection collection-catalog max-padd-container">
      <section className="collection-banner" aria-labelledby="collection-banner-title">
        <div className="collection-banner-visual">
          <img src="/images/inessa/bg-03.jpg" alt="Nước hoa Chanel bên những cánh hoa trắng" width="534" height="650" fetchPriority="high" />
        </div>
        <div className="collection-banner-copy">
          <p className="collection-banner-eyebrow"><span aria-hidden="true" /> Bộ sưu tập Velours</p>
          <h2 id="collection-banner-title">Khám phá thế giới<br />hương thơm của bạn.</h2>
          <p>Những mùi hương được tuyển chọn, dành cho từng phong cách và mọi khoảnh khắc.</p>
        </div>
      </section>
      <StorePageHeading title="Bộ sưu tập" className="inessa-collection-heading" />

      <div className="collection-catalog-layout">
        <Suspense fallback={<div className="collection-filter-placeholder" aria-hidden="true" />}><CollectionFilterDrawer
          open={isFilterOpen} onClose={() => setIsFilterOpen(false)}
          selectedFilters={filters} onFilterChange={toggleFilter} filtering={productsLoading}
          minPrice={priceFloor} maxPrice={priceLimit} priceCeiling={priceCeiling}
          priceDisabled={maxProductPrice <= 0}
          onMinPriceChange={changeMinPrice} onMaxPriceChange={changeMaxPrice}
          formatPrice={formatPrice} resultCount={total} onReset={resetFilters}
        /></Suspense>

        <div className="collection-catalog-main">
          <div className="inessa-collection-toolbar">
            <div className="inessa-collection-filter-tools">
              <button type="button" onClick={() => setIsFilterOpen(true)} className="inessa-collection-filter-trigger"
                onPointerEnter={() => { void publicCatalog.filters().catch(() => {}); }} onFocus={() => { void publicCatalog.filters().catch(() => {}); }}
                aria-haspopup="dialog" aria-expanded={isFilterOpen} aria-controls="collection-filter-drawer">
                <SlidersHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
                Lọc sản phẩm
                {filterCount > 0 && <span className="inessa-collection-filter-count">{filterCount}</span>}
              </button>
            </div>
            <div className="inessa-collection-sort-tools">
              <div className="inessa-collection-results-tools">
                <p className="inessa-collection-results" role="status" aria-live="polite">
                  {!collection ? productsLoading ? "Đang tải sản phẩm…" : "0 sản phẩm" : total
                    ? `${startIndex + 1}–${Math.min(startIndex + itemsPerPage, total)} / ${total} sản phẩm`
                    : "0 sản phẩm"}
                </p>
                {filterCount > 0 && <button type="button" onClick={resetFilters} className="inessa-collection-reset">Xóa bộ lọc</button>}
              </div>
              <CollectionSearch value={searchQuery} onChange={value => { setSearchQuery(value); setCurrentPage(1); }} />
              <select aria-label="Sắp xếp sản phẩm" value={selectedSort}
                onChange={(event) => { setSelectedSort(event.target.value); setCurrentPage(1); }}>
                <option value="relevant">Sắp xếp mặc định</option>
                <option value="low">Giá: thấp đến cao</option>
                <option value="high">Giá: cao đến thấp</option>
                <option value="name-asc">Tên: A–Z</option>
                <option value="name-desc">Tên: Z–A</option>
              </select>
              <Pagination arrowsOnly className="inessa-collection-page-arrows" label="Chuyển trang sản phẩm" page={activePage} totalPages={totalPages} onPageChange={changePage} disabled={productsLoading} />
            </div>
          </div>

          <div className="collection-loading-area">
          <LoadingStatus active={productsLoading && Boolean(collection)} label="Đang cập nhật sản phẩm…" className="collection-update-status" />
          <div ref={listRef} tabIndex={-1} className={`inessa-collection-grid pagination-list-start ${productsLoading && collection ? "is-updating" : ""}`} aria-busy={productsLoading}>
            {pageError && <div role="alert" className="inessa-collection-empty"><p>{pageError}</p><button type="button" onClick={reload} className="inessa-button">Thử lại</button></div>}
            {!collection && productsLoading && <ProductGridSkeleton count={itemsPerPage} />}
            {paginatedProducts.map((product, index) => <Item product={product} key={product._id} priority={index < 4} />)}
            {!productsLoading && !pageError && paginatedProducts.length === 0 && <div className="inessa-collection-empty">
              <SearchX size={32} strokeWidth={1.2} aria-hidden="true" />
              <h2>Không tìm thấy sản phẩm</h2>
              <p>Thử thay đổi từ khóa hoặc bộ lọc để tìm sản phẩm phù hợp.</p>
              {filterCount > 0 && <button type="button" onClick={resetFilters} className="inessa-button">Xóa bộ lọc</button>}
            </div>}
          </div>
          </div>

          <Pagination className="inessa-collection-pagination" label="Phân trang sản phẩm" page={activePage} totalPages={totalPages} onPageChange={changePage} disabled={productsLoading} />
        </div>
      </div>
    </div>
  );
};

export default Collection;
