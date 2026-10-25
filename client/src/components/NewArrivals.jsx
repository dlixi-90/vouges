import Title from "./Title";
import { useAppContext } from "../context/AppContext";
import ProductCarousel from "./ProductCarousel";

const NewArrivals = () => {
  const { products } = useAppContext();

  return (
    <section className="net-new-arrivals max-padd-container mt-28">
      <p className="inessa-eyebrow inessa-section-eyebrow">Những lựa chọn mới</p>
      <Title title1={"Sản phẩm"} title2={"mới"} titleStyles={"pb-10"} />
      <ProductCarousel products={products} />
    </section>
  );
};

export default NewArrivals;
