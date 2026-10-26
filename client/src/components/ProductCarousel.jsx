import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { Autoplay } from "swiper/modules";
import Item from "./Item";

const ProductCarousel = ({ products }) => (
  <Swiper
    spaceBetween={20}
    autoplay={{ delay: 4000, disableOnInteraction: false }}
    breakpoints={{
      555: { slidesPerView: 1 },
      600: { slidesPerView: 2 },
      1022: { slidesPerView: 4 },
      1350: { slidesPerView: 5 },
    }}
    modules={[Autoplay]}
    className="net-product-carousel"
  >
    {products.slice(0, 10).map((product) => (
      <SwiperSlide key={product._id}>
        <Item product={product} />
      </SwiperSlide>
    ))}
  </Swiper>
);

export default ProductCarousel;
