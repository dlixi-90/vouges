import { useLayoutEffect, useMemo, useState } from "react";
import Item from "../components/Item";
import { useAppContext } from "../context/AppContext";
import SearchInput from "../components/SearchInput";
import { SearchX } from "lucide-react";
import {
  getAvailableSizes,
  hasAnyAvailableSize,
} from "../utils/productStock";

const getDisplayedPrice = (product) => {
  const firstAvailableSize = getAvailableSizes(product)[0];
  const price = Number(product.price?.[firstAvailableSize]);

  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
};

const Collection = () => {
  useLayoutEffect(() => {
    // Reset when the lazy-loaded page mounts, before its first paint.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const { products, searchQuery, categories } = useAppContext();
  const allCategories = [...new Set([
    ...categories.map((item) => item.name),
    ...products.map((item) => item.category).filter(Boolean),
  ])];
  const [category, setCategory] = useState([]);
  const [type, setType] = useState([]);
  const [selectedSort, setSelectedSort] = useState("relevant");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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
      category.length === 0 || category.includes(p.category),
    );
    return [...new Set(filteredProds.map((p) => p.type))].sort();
  }, [category, products]);

  const filteredProducts = useMemo(() => {
    const availableTypeSet = new Set(availableTypes);
    const activeTypes = type.filter((item) => availableTypeSet.has(item));
    let filtered = products.filter(hasAnyAvailableSize);

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
  }, [availableTypes, category, products, searchQuery, selectedSort, type]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const activePage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="max-padd-container !px-0 mt-20">
      <div className="flex flex-col sm:flex-row gap-8 mb-16">
        {/* Filters Option */}
        <div className="min-w-72 bg-primary p-4 pl-6 lg:pl-12 rounded-r-xl">
          <SearchInput />
          <div className="px-4 py-3 mt-4 bg-white rounded-xl">
            <h5 className="h5 mb-4">Sort By Price</h5>
            <select
              onChange={(e) => {
                setSelectedSort(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-900/10 outline-none text-gray-30 medium-14 h-8 w-full px-2 rounded-md"
            >
              <option value="relevant">Relevant</option>
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="pl-5 py-3 mt-4 bg-white rounded-xl">
            <h5 className="h5 mb-4">Categories</h5>
            <div className="flex flex-col gap-2 text-sm font-light">
              {allCategories.map((cat) => (
                <label key={cat} className="flex gap-2 medium-14 text-gray-30">
                  <input
                    onChange={(e) => toggleFilter(e.target.value, setCategory)}
                    type="checkbox"
                    value={cat}
                    checked={category.includes(cat)}
                    className="w-3"
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>
          <div className="pl-5 py-3 mt-4 bg-white rounded-xl">
            <h5 className="h5 mb-4">Types</h5>
            <div className="flex flex-col gap-2 text-sm font-light">
              {availableTypes.map((typ) => (
                <label key={typ} className="flex gap-2 medium-14 text-gray-30">
                  <input
                    onChange={(e) => toggleFilter(e.target.value, setType)}
                    type="checkbox"
                    value={typ}
                    checked={type.includes(typ)}
                    className="w-3"
                  />
                  {typ}
                </label>
              ))}
            </div>
          </div>
        </div>
        {/* Right Side - Filtered Products */}
        <div className="max-sm:px-10 sm:pr-10 flex-1">
          <div className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map((product) => (
                <Item
                  product={product}
                  key={product._id}
                  collectionLayout
                />
              ))
            ) : (
              <div className="col-span-full mx-auto flex min-h-[240px] w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-secondary/20 bg-primary/60 px-5 py-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-secondary shadow-sm ring-1 ring-secondary/10">
                  <SearchX size={24} strokeWidth={1.8} />
                </div>
                <p className="capitalize text-base font-semibold text-secondary">
                  No products found
                </p>
              </div>
            )}
          </div>
          {/* Pagination */}
          {filteredProducts.length > 0 && (
            <div className="flexCenter flex flex-wrap mt-14 mb-10 gap-4">
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className={`btn-secondary !py-1 !px-3 ${
                  activePage === 1 && "opacity-50 cursor-not-allowed"
                }`}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index + 1}
                  onClick={() => setCurrentPage(index + 1)}
                  className={`btn-light !py-1 !px-3 ${
                    activePage === index + 1 && "bg-tertiary text-white"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className={`btn-secondary !py-1 !px-3 ${
                  activePage === totalPages && "opacity-50 cursor-not-allowed"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Collection;
