import Title from "./Title";
import { usePopularProducts } from "../hooks/usePopularProducts";
import ProductCarousel from "./ProductCarousel";

const PopularProducts = () => {
  const {
    popularProducts,
    popularProductsLoading,
    popularProductsError,
    fetchPopularProducts,
  } = usePopularProducts();
  return (
    <section className="net-popular-products max-padd-container">
      <p className="inessa-eyebrow inessa-section-eyebrow">Được yêu thích tại Velours</p>
      <Title title1={"Sản phẩm"} title2={"bán chạy"} titleStyles={"pb-10"} />
      {popularProductsError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {popularProductsError}{" "}
          <button type="button" onClick={fetchPopularProducts} className="underline">
            Thử lại
          </button>
        </p>
      )}
      {popularProductsLoading && <p role="status">Đang tải sản phẩm bán chạy…</p>}
      {!popularProductsLoading && !popularProductsError && !popularProducts.length && (
        <p className="text-sm text-gray-500">Chưa có sản phẩm nào được bán.</p>
      )}
      {popularProducts.length > 0 && <ProductCarousel products={popularProducts} showSoldCount />}
    </section>
  );
};

export default PopularProducts;
