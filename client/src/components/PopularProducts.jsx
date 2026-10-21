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
      <Title title1={"Popular"} title2={"Products"} titleStyles={"pb-10"} />
      <p className="mb-6 text-sm text-gray-500">Best sellers by units sold · All time</p>
      {popularProductsError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {popularProductsError}{" "}
          <button type="button" onClick={fetchPopularProducts} className="underline">
            Retry
          </button>
        </p>
      )}
      {popularProductsLoading && <p role="status">Loading popular products...</p>}
      {!popularProductsLoading && !popularProductsError && !popularProducts.length && (
        <p className="text-sm text-gray-500">No sales yet.</p>
      )}
      {popularProducts.length > 0 && <ProductCarousel products={popularProducts} showSoldCount />}
    </section>
  );
};

export default PopularProducts;
