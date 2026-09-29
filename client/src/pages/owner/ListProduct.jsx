import { useMemo, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { hasAnyEnabledSize } from "../../utils/productStock";
import { formatThousandsVnd } from "../../utils/money";

const PAGE_SIZE = 10;

const getMinimumPrice = (product) => {
  const prices = (product.sizes || [])
    .map((size) => Number(product.price?.[size]))
    .filter(Number.isFinite);

  return prices.length > 0 ? Math.min(...prices) : 0;
};

const formatPrice = formatThousandsVnd;

const getSizeStockStatus = (product, size) => {
  const quantity = Number(product.stockBySize?.[size] ?? 0);

  if (quantity <= 0) {
    return false;
  }

  const savedStatus = product.inStockBySize?.[size];

  return typeof savedStatus === "boolean" ? savedStatus : true;
};

const ListProduct = () => {
  const {
    products,
    currency,
    fetchProducts,
    replaceProduct,
    navigate,
    axios,
    getToken,
  } = useAppContext();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const [page, setPage] = useState(0);
  const [updatingStockId, setUpdatingStockId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [hoveredProductId, setHoveredProductId] = useState(null);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = (products || []).filter((product) =>
      String(product.title || "")
        .toLowerCase()
        .includes(normalizedQuery),
    );

    if (!sort.key) return result;

    return [...result].sort((a, b) => {
      const first =
        sort.key === "price" ? getMinimumPrice(a) : a[sort.key] || "";

      const second =
        sort.key === "price" ? getMinimumPrice(b) : b[sort.key] || "";
      const comparison =
        typeof first === "number"
          ? first - second
          : String(first).localeCompare(String(second));
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [products, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const visibleProducts = filteredProducts.slice(
    activePage * PAGE_SIZE,
    (activePage + 1) * PAGE_SIZE,
  );

  const changeSort = (key) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(0);
  };

  const toggleStock = async ({ productId, size, inStock }) => {
    const updatingKey = size
      ? `size:${productId}:${size}`
      : `product:${productId}`;
    const previousProduct = products.find(
      (product) => product._id === productId,
    );

    if (!previousProduct) return;

    const nextSizeStatuses = size
      ? {
          ...(previousProduct.inStockBySize || {}),
          [size]: inStock,
        }
      : inStock
        ? previousProduct.inStockBySize
        : Object.fromEntries(
            (previousProduct.sizes || []).map((productSize) => [productSize, false]),
          );
    const hasEnabledSize = hasAnyEnabledSize({
      ...previousProduct,
      inStockBySize: nextSizeStatuses,
    });

    const optimisticProduct = size
      ? {
          ...previousProduct,
          inStockBySize: nextSizeStatuses,
          inStock: hasEnabledSize,
        }
      : {
          ...previousProduct,
          inStockBySize: nextSizeStatuses,
          inStock,
        };

    try {
      setUpdatingStockId(updatingKey);
      replaceProduct(optimisticProduct);

      const token = await getToken();

      const { data } = await axios.post(
        "/api/products/toggle-stock",
        {
          productId,
          inStock,
          ...(size && { size }),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Unable to update stock status");
      }

      if (data.product) {
        replaceProduct(data.product);
      }

      toast.success(data.message || "Stock status updated");
    } catch (error) {
      replaceProduct(previousProduct);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to update stock status",
      );
    } finally {
      setUpdatingStockId(null);
    }
  };

  const deleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.title}"?\n\nThis product will be removed from the catalog.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingProductId(product._id);

      const token = await getToken();

      const { data } = await axios.delete(`/api/products/${product._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.success) {
        await fetchProducts();

        toast.success(data.message || "Product deleted successfully");
      } else {
        toast.error(data.message || "Unable to delete product");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to delete product",
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <main className="m-1 h-[97vh] overflow-y-auto rounded-xl bg-primary px-3 py-6 shadow sm:m-3 sm:px-5 md:px-8 lg:w-11/12 xl:py-8">
      <div className="mx-auto w-full max-w-[1120px]">
        {/* Page header */}
        <header className="mb-6 flex flex-col gap-4 border-b border-[#e1e6e3] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#6f9a79]">
              Catalog
            </p>

            <h1 className="mt-2 text-2xl font-semibold text-[#263b4a] sm:text-3xl">
              Product List
            </h1>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d8e5da] bg-[#edf6ee] px-3 py-1.5 text-xs font-medium text-[#557b5e]">
            <Package size={15} />
            {(products || []).length} products
          </div>
        </header>

        <section className="rounded-xl border border-[#e2e7eb] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#edf0f2] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949c]"
              />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Filter products..."
                className="admin-input pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] caption-bottom text-sm">
              <thead>
                <tr className="border-b border-[#edf0f2] text-left text-[#69747e]">
                  <th className="px-4 py-3 font-medium">Image</th>

                  <SortableHeader
                    label="Product"
                    active={sort.key === "title"}
                    direction={sort.direction}
                    onClick={() => changeSort("title")}
                  />

                  <SortableHeader
                    label="Category"
                    active={sort.key === "category"}
                    direction={sort.direction}
                    onClick={() => changeSort("category")}
                  />

                  <th className="px-4 py-3 font-medium">Instock</th>

                  <th className="px-4 py-3 font-medium">Size</th>

                  <th className="px-4 py-3 font-medium">Price</th>

                  <th className="px-4 py-3 font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.length ? (
                  visibleProducts.flatMap((product) => {
                    const hasEnabledSize = hasAnyEnabledSize(product);

                    const productInStock =
                      Boolean(product.inStock) && hasEnabledSize;
                    const variants =
                      product.sizes?.length > 0 ? product.sizes : [null];

                    const rowSpan = variants.length;

                    const productUpdatingKey = `product:${product._id}`;

                    const sizeUpdatingPrefix = `size:${product._id}:`;

                    /*
                     * Kiểm tra xem master switch hoặc một size
                     * của sản phẩm này có đang cập nhật không.
                     */
                    const isProductUpdating =
                      updatingStockId === productUpdatingKey ||
                      updatingStockId?.startsWith(sizeUpdatingPrefix);

                    return variants.map((size, variantIndex) => {
                      /*
                       * variantIndex === 0:
                       * Đây là dòng size đầu tiên của sản phẩm.
                       * Chỉ dòng này hiển thị ảnh, tên, category,
                       * master switch và action.
                       */
                      const isFirstVariant = variantIndex === 0;

                      /*
                       * Dòng size cuối cùng sẽ có border-bottom
                       * để phân cách với sản phẩm tiếp theo.
                       */
                      const isLastVariant =
                        variantIndex === variants.length - 1;

                      const quantity = size
                        ? Number(product.stockBySize?.[size] ?? 0)
                        : 0;

                      const price = size
                        ? Number(product.price?.[size] ?? 0)
                        : 0;

                      const sizeInStock = size
                        ? getSizeStockStatus(product, size)
                        : false;

                      const internalBorder = !isFirstVariant
                        ? "border-t border-[#edf0f2]"
                        : "";

                      return (
                        <tr
                          key={`${product._id}-${size || "no-size"}`}
                          data-product-id={product._id}
                          onMouseEnter={() => setHoveredProductId(product._id)}
                          onMouseLeave={(event) => {
                            const nextProductRow =
                              event.relatedTarget?.closest?.(
                                "tr[data-product-id]",
                              );

                            if (
                              nextProductRow?.dataset.productId !==
                              String(product._id)
                            ) {
                              setHoveredProductId(null);
                            }
                          }}
                          className={`transition-colors [&>td]:transition-colors ${
                            hoveredProductId === product._id
                              ? "bg-[#f1f3f2] [&>td]:bg-[#f1f3f2]"
                              : ""
                          } ${
                            isLastVariant ? "border-b border-[#dfe5e8]" : ""
                          }`}
                        >
                          {/* Ảnh: chỉ xuất hiện một lần */}
                          {isFirstVariant && (
                            <td
                              rowSpan={rowSpan}
                              className="border-b border-[#dfe5e8] px-4 py-4 align-top"
                            >
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-[#f2f5f3]">
                                {product.images?.[0] ? (
                                  <img
                                    src={product.images[0]}
                                    alt={product.title}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <Package
                                    size={16}
                                    className="text-[#8b949c]"
                                  />
                                )}
                              </div>
                            </td>
                          )}

                          {/* Tên sản phẩm: chỉ xuất hiện một lần */}
                          {isFirstVariant && (
                            <td
                              rowSpan={rowSpan}
                              className="max-w-[240px] border-b border-[#dfe5e8] px-4 py-4 align-top font-medium text-[#263b4a]"
                            >
                              <span className="block truncate">
                                {product.title}
                              </span>

                              <span className="mt-1 block text-xs font-normal text-[#8b949c]">
                                {product.type || "Product"}
                              </span>

                              <span className="mt-2 inline-flex rounded-full bg-[#f2f5f3] px-2 py-0.5 text-[11px] font-normal text-[#71808a]">
                                {variants.length}{" "}
                                {variants.length === 1 ? "size" : "sizes"}
                              </span>
                            </td>
                          )}

                          {/* Category: chỉ xuất hiện một lần */}
                          {isFirstVariant && (
                            <td
                              rowSpan={rowSpan}
                              className="border-b border-[#dfe5e8] px-4 py-4 align-top text-[#69747e]"
                            >
                              {product.category || "—"}
                            </td>
                          )}

                          {/* Master switch: chỉ xuất hiện một lần */}
                          {isFirstVariant && (
                            <td
                              rowSpan={rowSpan}
                              className="border-b border-[#dfe5e8] px-4 py-4 align-top"
                            >
                              <label
                                className={`relative inline-flex items-center ${
                                  !hasEnabledSize ||
                                  isProductUpdating ||
                                  deletingProductId === product._id
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer"
                                }`}
                                title={
                                  hasEnabledSize
                                    ? "Toggle product availability"
                                    : "Enable at least one size first"
                                }
                              >
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={productInStock}
                                  disabled={
                                    !hasEnabledSize ||
                                    isProductUpdating ||
                                    deletingProductId === product._id
                                  }
                                  onChange={(event) =>
                                    toggleStock({
                                      productId: product._id,
                                      inStock: event.target.checked,
                                    })
                                  }
                                  aria-label={`Change product status for ${product.title}`}
                                />

                                <span className="h-5 w-9 rounded-full bg-[#d6dde0] transition peer-checked:bg-[#78a782] peer-focus-visible:ring-2 peer-focus-visible:ring-[#b8d2be]" />

                                <span className="absolute left-1 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                              </label>
                            </td>
                          )}

                          {/* Size: xuất hiện ở từng dòng con */}
                          <td
                            className={`${internalBorder} px-4 py-4 align-middle`}
                          >
                            {size ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/owner/edit-product/${product._id}`, { state: { editSize: size } })}
                                disabled={isProductUpdating || deletingProductId === product._id}
                                aria-label={`Edit size ${size} for ${product.title}`}
                                title="Edit size"
                                className="inline-flex items-center gap-2 rounded-md border border-[#dfe5e8] bg-[#f8faf9] px-2.5 py-1 text-xs font-semibold text-[#52616b] hover:bg-[#edf5ef] disabled:opacity-50"
                              >
                                {size}
                                <Pencil size={12} />
                              </button>
                            ) : (
                              <span className="text-xs text-[#9aa3aa]">
                                No size
                              </span>
                            )}
                          </td>

                          {/* Price: riêng từng size */}
                          <td
                            className={`${internalBorder} px-4 py-4 align-middle font-medium text-[#263b4a]`}
                          >
                            {size ? formatPrice(price, currency) : "—"}
                          </td>

                          {/* Quantity: riêng từng size */}
                          <td
                            className={`${internalBorder} px-4 py-4 align-middle`}
                          >
                            {size ? (
                              <span
                                className={`inline-flex min-w-10 justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
                                  quantity > 0
                                    ? "border-[#d4e6d7] bg-[#edf6ee] text-[#557b5e]"
                                    : "border-[#f0dada] bg-[#fff2f2] text-[#a35f5f]"
                                }`}
                              >
                                {quantity}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Switch riêng của từng size */}
                          <td
                            className={`${internalBorder} px-4 py-4 align-middle`}
                          >
                            <label
                              className={`relative inline-flex items-center ${
                                !size ||
                                quantity <= 0 ||
                                isProductUpdating ||
                                deletingProductId === product._id
                                  ? "cursor-not-allowed opacity-60"
                                  : "cursor-pointer"
                              }`}
                              title={
                                quantity <= 0
                                  ? "This size has no stock"
                                  : `Toggle availability for size ${size}`
                              }
                            >
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={Boolean(sizeInStock)}
                                disabled={
                                  !size ||
                                  quantity <= 0 ||
                                  isProductUpdating ||
                                  deletingProductId === product._id
                                }
                                onChange={(event) =>
                                  toggleStock({
                                    productId: product._id,
                                    size,
                                    inStock: event.target.checked,
                                  })
                                }
                                aria-label={
                                  size
                                    ? `Change stock status for ${product.title}, size ${size}`
                                    : `No size available for ${product.title}`
                                }
                              />

                              <span className="h-5 w-9 rounded-full bg-[#d6dde0] transition peer-checked:bg-[#78a782] peer-focus-visible:ring-2 peer-focus-visible:ring-[#b8d2be] peer-disabled:opacity-60" />

                              <span className="absolute left-1 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                            </label>
                          </td>

                          {/* Actions: chỉ xuất hiện một lần */}
                          {isFirstVariant && (
                            <td
                              rowSpan={rowSpan}
                              className="border-b border-[#dfe5e8] px-4 py-4 align-top"
                            >
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/owner/edit-product/${product._id}`,
                                    )
                                  }
                                  disabled={
                                    isProductUpdating ||
                                    deletingProductId === product._id
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#69747e] transition hover:bg-[#edf5ef] hover:text-[#42604a] disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={`Edit ${product.title}`}
                                  title="Edit product"
                                >
                                  <Pencil size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteProduct(product)}
                                  disabled={
                                    isProductUpdating ||
                                    deletingProductId === product._id
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#ac5c] transition hover:bg-[#fff0f0] hover:text-[#8f3f3f] disabled:cursor-wait disabled:opacity-50"
                                  aria-label={`Delete ${product.title}`}
                                  title="Delete product"
                                >
                                  {deletingProductId === product._id ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e4bcbc] border-t-[#a85c5c]" />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="h-32 text-center text-[#8b949c]">
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 px-4 py-4 text-sm text-[#69747e] sm:flex-row">
            <span>Rows per page {PAGE_SIZE}</span>
            <div className="flex items-center gap-2">
              <span>
                Page {activePage + 1} of {pageCount}
              </span>
              <PaginationButton
                label="Go to first page"
                disabled={activePage === 0}
                onClick={() => setPage(0)}
              >
                <ChevronsLeft size={16} />
              </PaginationButton>
              <PaginationButton
                label="Go to previous page"
                disabled={activePage === 0}
                onClick={() => setPage(activePage - 1)}
              >
                <ChevronLeft size={16} />
              </PaginationButton>
              <PaginationButton
                label="Go to next page"
                disabled={activePage >= pageCount - 1}
                onClick={() => setPage(activePage + 1)}
              >
                <ChevronRight size={16} />
              </PaginationButton>
              <PaginationButton
                label="Go to last page"
                disabled={activePage >= pageCount - 1}
                onClick={() => setPage(pageCount - 1)}
              >
                <ChevronsRight size={16} />
              </PaginationButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

const SortableHeader = ({ label, active, direction, onClick }) => (
  <th className="px-4 py-3 font-medium">
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 transition hover:text-[#263b4a]"
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp size={14} />
        ) : (
          <ArrowDown size={14} />
        )
      ) : (
        <ArrowUpDown size={14} />
      )}
    </button>
  </th>
);

const PaginationButton = ({ label, disabled, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#dfe5e8] bg-white text-[#69747e] transition hover:bg-[#f2f7f3] disabled:cursor-not-allowed disabled:opacity-40"
  >
    {children}
  </button>
);

export default ListProduct;
