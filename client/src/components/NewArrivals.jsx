import Title from "./Title";
import { useAppContext } from "../context/AppContext";
import ProductCarousel from "./ProductCarousel";

const NewArrivals = () => {
  const { products } = useAppContext();

  return (
    <section className="net-new-arrivals max-padd-container mt-28">
      <Title title1={"New"} title2={"Arrivals"} titleStyles={"pb-10"} />
      <ProductCarousel products={products} />
    </section>
  );
};

export default NewArrivals;
