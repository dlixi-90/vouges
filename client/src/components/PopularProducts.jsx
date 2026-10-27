import Title from "./Title";
import { usePopularProducts } from "../hooks/usePopularProducts";
import ProductCarousel from "./ProductCarousel";
import { useAppContext } from "../context/AppContext";
import { hasAnyAvailableSize } from "../utils/productStock";

const PopularProducts = () => {
  const {
    popularProducts,
    popularProductsLoading,
    popularProductsError,
    fetchPopularProducts,
  } = usePopularProducts();
  const { products, productsLoading } = useAppContext();
  const showSuggestions = !popularProductsLoading && !popularProductsError && !popularProducts.length;
  const displayedProducts = showSuggestions
    ? products.filter(hasAnyAvailableSize).slice(0, 10)
    : popularProducts;
  const isLoading = popularProductsLoading || (showSuggestions && productsLoading);

  return (
    <section className="net-popular-products max-padd-container">
      <p className="inessa-eyebrow inessa-section-eyebrow">
        {showSuggestions ? "Khám phá cùng Velours" : "Được yêu thích tại Velours"}
      </p>
      <Title title1={showSuggestions ? "Gợi ý" : "Sản phẩm"} title2={showSuggestions ? "cho bạn" : "bán chạy"} titleStyles={"pb-10"} />
      {popularProductsError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {popularProductsError}{" "}
          <button type="button" onClick={fetchPopularProducts} className="underline">
            Thử lại
          </button>
        </p>
      )}
      {isLoading && <p role="status">{showSuggestions ? "Đang tải sản phẩm…" : "Đang tải sản phẩm bán chạy…"}</p>}
      {!isLoading && !popularProductsError && !displayedProducts.length && (
        <p className="text-sm text-gray-500">Chưa có sản phẩm để hiển thị.</p>
      )}
      {displayedProducts.length > 0 && <ProductCarousel products={displayedProducts} />}
    </section>
  );
};

export default PopularProducts;
