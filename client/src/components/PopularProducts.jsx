import Title from "./Title";
import { usePopularProducts } from "../hooks/usePopularProducts";
import ProductCarousel from "./ProductCarousel";
import useProductFeed from "../hooks/useProductFeed";

const PopularProducts = () => {
  const {
    popularProducts,
    popularProductsLoading,
    popularProductsError,
    fetchPopularProducts,
  } = usePopularProducts();
  const showSuggestions = !popularProductsLoading && !popularProductsError && !popularProducts.length;
  const { products, loading: productsLoading, error: suggestionsError, reload: reloadSuggestions } = useProductFeed({ limit: 10, availability: "available", enabled: popularProductsLoading || showSuggestions });
  const displayedProducts = showSuggestions
    ? products
    : popularProducts;
  const isLoading = popularProductsLoading || (showSuggestions && productsLoading);
  const visibleError = popularProductsError || (showSuggestions ? suggestionsError : "");

  return (
    <section className="net-popular-products max-padd-container">
      <p className="inessa-eyebrow inessa-section-eyebrow">
        {showSuggestions ? "Khám phá cùng Velours" : "Được yêu thích tại Velours"}
      </p>
      <Title title1={showSuggestions ? "Gợi ý" : "Sản phẩm"} title2={showSuggestions ? "cho bạn" : "bán chạy"} titleStyles={"pb-10"} />
      {visibleError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {visibleError}{" "}
          <button type="button" onClick={showSuggestions && suggestionsError ? reloadSuggestions : fetchPopularProducts} className="underline">
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
