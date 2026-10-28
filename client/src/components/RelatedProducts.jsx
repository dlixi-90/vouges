import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import Title from "./Title";
import Item from "./Item";
import { useAppContext } from "../context/AppContext";

const RelatedProducts = ({ product, productId }) => {
  const { publicCatalog } = useAppContext();
  const id = productId || product._id;
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    publicCatalog.related(id).then(data => { if (active) setResult({ id, ...data }); }).catch(() => {});
    return () => { active = false; };
  }, [publicCatalog, id]);
  const relatedProducts = result?.id === id ? result.products : [];
  const isFallback = result?.isFallback;

  if (relatedProducts.length === 0) return null;

  return (
    <section className="mt-20 sm:mt-24">
      <Title title1={isFallback ? "Có thể bạn" : "Sản phẩm"} title2={isFallback ? "sẽ thích" : "liên quan"} titleStyles="pb-10" />

      <Swiper
        spaceBetween={30}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
        }}
        breakpoints={{
          0: { slidesPerView: 1 },
          600: { slidesPerView: 2 },
          1022: { slidesPerView: 3 },
          1350: { slidesPerView: 4 },
        }}
        modules={[Autoplay]}
        className="min-h-[399px]"
      >
        {relatedProducts.map((item) => (
          <SwiperSlide key={item._id}>
            <Item product={item} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};

export default RelatedProducts;
