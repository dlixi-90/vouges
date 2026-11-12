import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { Autoplay } from "swiper/modules";
import Item from "./Item";

const ProductCarousel = ({ products }) => (
  <Swiper
    slidesPerView={2}
    spaceBetween={20}
    autoplay={{ delay: 4000, disableOnInteraction: false }}
    breakpoints={{
      0: { slidesPerView: 2, spaceBetween: 10 },
      600: { slidesPerView: 2, spaceBetween: 20 },
      1022: { slidesPerView: 4 },
      1350: { slidesPerView: 5 },
    }}
    modules={[Autoplay]}
    className="net-product-carousel"
  >
    {products.slice(0, 10).map((product, index) => (
      <SwiperSlide key={product._id}>
        <Item product={product} priority={index < 2} />
      </SwiperSlide>
    ))}
  </Swiper>
);

export default ProductCarousel;
