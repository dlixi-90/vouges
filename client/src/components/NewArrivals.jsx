import Title from "./Title";
import useProductFeed from "../hooks/useProductFeed";
import ProductCarousel from "./ProductCarousel";

const NewArrivals = () => {
  const { products, error, reload } = useProductFeed();

  return (
    <section className="net-new-arrivals max-padd-container mt-28">
      <p className="inessa-eyebrow inessa-section-eyebrow">Những lựa chọn mới</p>
      <Title title1={"Sản phẩm"} title2={"mới"} titleStyles={"pb-10"} />
      {error && <p role="alert">{error} <button type="button" onClick={reload} className="underline">Thử lại</button></p>}
      <ProductCarousel products={products.slice(0, 12)} />
    </section>
  );
};

export default NewArrivals;
