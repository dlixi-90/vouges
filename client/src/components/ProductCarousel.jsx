import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { Autoplay } from "swiper/modules";
import Item from "./Item";

const ProductCarousel = ({ products, showSoldCount = false }) => (
  <Swiper
    spaceBetween={30}
    autoplay={{ delay: 4000, disableOnInteraction: false }}
    breakpoints={{
      555: { slidesPerView: 1 },
      600: { slidesPerView: 2 },
      1022: { slidesPerView: 3 },
      1350: { slidesPerView: 4 },
    }}
    modules={[Autoplay]}
    className="min-h-[399px]"
  >
    {products.slice(0, 10).map((product) => (
      <SwiperSlide key={product._id}>
        <Item product={product} collectionLayout />
        {showSoldCount && <p className="mt-2 text-center text-sm text-gray-500">{product.soldQuantity} đã bán</p>}
      </SwiperSlide>
    ))}
  </Swiper>
);

export default ProductCarousel;
