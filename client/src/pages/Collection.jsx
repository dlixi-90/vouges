import { useLayoutEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Item from "../components/Item";
import { useAppContext } from "../context/AppContext";
import CollectionFilterDrawer from "../components/CollectionFilterDrawer";
import { ArrowRight, Search, SearchX, SlidersHorizontal } from "lucide-react";
import { formatVnd } from "../utils/money";
import Pagination from "../components/Pagination";
import usePaginationScroll from "../hooks/usePaginationScroll";
import {
  getAvailableSizes,
  hasAnyAvailableSize,
} from "../utils/productStock";

const getDisplayedPrice = (product) => {
  const firstAvailableSize = getAvailableSizes(product)[0];
  const price = Number(product.price?.[firstAvailableSize]);

  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
};

const brandKey = value => (value || "").normalize("NFC").trim().toLocaleLowerCase("vi-VN");

const Collection = () => {
  useLayoutEffect(() => {
    // Reset when the lazy-loaded page mounts, before its first paint.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const { products, productsLoading, searchQuery, setSearchQuery, categories, currency, navigate } = useAppContext();
  const [searchParams] = useSearchParams();
  const selectedBrand = searchParams.get("brand") || "";
  const selectedBrandKey = brandKey(selectedBrand);
  const allCategories = [...new Set([
    ...categories.map((item) => item.name),
    ...products.map((item) => item.category).filter(Boolean),
  ])];
  const [category, setCategory] = useState(() => {
    const selected = searchParams.get("category");
    return selected ? [selected] : [];
  });
  const [type, setType] = useState([]);
  const [selectedSort, setSelectedSort] = useState("relevant");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 16;
  const maxProductPrice = useMemo(() => products.reduce((highest, product) => {
    const price = getDisplayedPrice(product);
    return Number.isFinite(price) ? Math.max(highest, price) : highest;
  }, 0), [products]);
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
    setCategory([]);
    setType([]);
    setMinPrice(0);
    setMaxPrice(null);
    setSearchQuery("");
    setCurrentPage(1);
    if (selectedBrand) navigate("/collection", { replace: true });
  };

  const toggleFilter = (value, setState) => {
    setState((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
    setCurrentPage(1);
  };

  const availableTypes = useMemo(() => {
    const filteredProds = products.filter((p) =>
      (category.length === 0 || category.includes(p.category)) && (!selectedBrandKey || brandKey(p.brand) === selectedBrandKey),
    );
    return [...new Set(filteredProds.map((p) => p.type))].sort();
  }, [category, products, selectedBrandKey]);

  const filteredProducts = useMemo(() => {
    const availableTypeSet = new Set(availableTypes);
    const activeTypes = type.filter((item) => availableTypeSet.has(item));
    let filtered = products.filter(hasAnyAvailableSize);

    if (selectedBrandKey) filtered = filtered.filter(product => brandKey(product.brand) === selectedBrandKey);

    if (searchQuery) {
      const normalizedSearch = searchQuery.toLowerCase();
      filtered = filtered.filter((product) =>
        product.title.toLowerCase().includes(normalizedSearch),
      );
    }

    if (category.length > 0) {
      filtered = filtered.filter((product) =>
        category.includes(product.category),
      );
    }

    if (activeTypes.length > 0) {
      filtered = filtered.filter((product) =>
        activeTypes.includes(product.type),
      );
    }

    if (isPriceFiltered) {
      filtered = filtered.filter((product) => {
        const price = getDisplayedPrice(product);
        return price >= priceFloor && price <= priceLimit;
      });
    }

    if (selectedSort === "low") {
      return [...filtered].sort(
        (a, b) => getDisplayedPrice(a) - getDisplayedPrice(b),
      );
    }

    if (selectedSort === "high") {
      return [...filtered].sort(
        (a, b) => getDisplayedPrice(b) - getDisplayedPrice(a),
      );
    }

    return filtered;
  }, [availableTypes, category, products, searchQuery, selectedBrandKey, selectedSort, type, isPriceFiltered, priceFloor, priceLimit]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const activePage = Math.min(currentPage, Math.max(totalPages, 1));
  const { listRef, changePage } = usePaginationScroll({ page: activePage, onPageChange: setCurrentPage });
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + itemsPerPage,
  );
  const filterCount = category.length + type.filter((item) => availableTypes.includes(item)).length
    + Number(isPriceFiltered) + Number(Boolean(searchQuery)) + Number(Boolean(selectedBrand));

  return (
    <div className="net-collection max-padd-container">
      <header className="inessa-collection-heading">
        <nav aria-label="Đường dẫn" className="inessa-collection-breadcrumb">
          <Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Bộ sưu tập</span>
        </nav>
        <h1>Bộ sưu tập</h1>
        {selectedBrand && <p className="store-collection-brand">Thương hiệu: <strong>{selectedBrand}</strong><Link to="/collection" onClick={() => setSearchQuery("")}>Xem tất cả</Link></p>}
      </header>

      <div className="inessa-collection-toolbar">
        <div className="inessa-collection-filter-tools">
          <button type="button" onClick={() => setIsFilterOpen(true)} className="inessa-collection-filter-trigger"
            aria-haspopup="dialog" aria-expanded={isFilterOpen} aria-controls="collection-filter-drawer">
            <SlidersHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
            Lọc sản phẩm
            {filterCount > 0 && <span className="inessa-collection-filter-count">{filterCount}</span>}
          </button>
          {filterCount > 0 && <button type="button" onClick={resetFilters} className="inessa-collection-reset">Xóa bộ lọc</button>}
        </div>
        <form className="inessa-collection-search" role="search" onSubmit={event => { event.preventDefault(); setCurrentPage(1); }}>
          <Search size={17} strokeWidth={1.5} aria-hidden="true" />
          <input type="search" value={searchQuery} aria-label="Tìm kiếm sản phẩm" placeholder="Tìm kiếm sản phẩm…"
            onChange={event => { setSearchQuery(event.target.value); setCurrentPage(1); }} />
          <button type="submit" aria-label="Tìm kiếm"><ArrowRight size={17} strokeWidth={1.5} aria-hidden="true" /></button>
        </form>
        <div className="inessa-collection-sort-tools">
          <p className="inessa-collection-results" role="status" aria-live="polite">
            {productsLoading ? "Đang tải sản phẩm…" : filteredProducts.length
              ? `${startIndex + 1}–${Math.min(startIndex + itemsPerPage, filteredProducts.length)} / ${filteredProducts.length} sản phẩm`
              : "0 sản phẩm"}
          </p>
          <select aria-label="Sắp xếp sản phẩm" value={selectedSort}
            onChange={(event) => { setSelectedSort(event.target.value); setCurrentPage(1); }}>
            <option value="relevant">Sắp xếp mặc định</option>
            <option value="low">Giá: thấp đến cao</option>
            <option value="high">Giá: cao đến thấp</option>
          </select>
          <Pagination arrowsOnly className="inessa-collection-page-arrows" label="Chuyển trang sản phẩm" page={activePage} totalPages={totalPages} onPageChange={changePage} disabled={productsLoading} />
        </div>
      </div>

      {isFilterOpen && <CollectionFilterDrawer
        onClose={() => setIsFilterOpen(false)}
        categories={allCategories} selectedCategories={category}
        onCategoryChange={(value) => toggleFilter(value, setCategory)}
        types={availableTypes} selectedTypes={type}
        onTypeChange={(value) => toggleFilter(value, setType)}
        minPrice={priceFloor} maxPrice={priceLimit} priceCeiling={priceCeiling}
        priceDisabled={maxProductPrice <= 0}
        onMinPriceChange={changeMinPrice} onMaxPriceChange={changeMaxPrice}
        formatPrice={formatPrice} resultCount={filteredProducts.length} onReset={resetFilters}
      />}

      <div ref={listRef} tabIndex={-1} className="inessa-collection-grid pagination-list-start" aria-busy={productsLoading}>
        {paginatedProducts.map((product) => <Item product={product} key={product._id} />)}
        {!productsLoading && paginatedProducts.length === 0 && <div className="inessa-collection-empty">
          <SearchX size={32} strokeWidth={1.2} aria-hidden="true" />
          <h2>Không tìm thấy sản phẩm</h2>
          <p>Thử thay đổi từ khóa hoặc bộ lọc để tìm sản phẩm phù hợp.</p>
          {filterCount > 0 && <button type="button" onClick={resetFilters} className="inessa-button">Xóa bộ lọc</button>}
        </div>}
      </div>

      <Pagination className="inessa-collection-pagination" label="Phân trang sản phẩm" page={activePage} totalPages={totalPages} onPageChange={changePage} disabled={productsLoading} />
    </div>
  );
};

export default Collection;
