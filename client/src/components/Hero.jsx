import { Link } from "react-router-dom";
import { assets } from "../assets/data";
import background from "../assets/bg.webp";

const Hero = () => {
  return (
    <section className="net-hero max-padd-container">
      <div className="net-hero-frame relative w-full overflow-hidden">
        <img src={background} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        <div className="net-hero-content relative">
          <div className="net-hero-copy">
            <h1 className="net-hero-title">
              Tôn lên <strong>vẻ đẹp</strong> với <strong>mỹ phẩm</strong> tinh chọn
            </h1>
            <p className="net-hero-description">
              Khám phá bộ sưu tập mỹ phẩm chất lượng, đáng tin cậy với mức giá
              hợp lý, giúp tôn lên vẻ đẹp tự nhiên và mang lại sự tự tin,
              rạng rỡ mỗi ngày.
            </p>
            <div className="flex">
              <Link
                to={"/collection"}
                className="bg-secondary text-white text-xs font-medium pl-5 rounded-full flexCenter gap-x-2 mt-7 group"
              >
                Khám phá bộ sưu tập mới
                <img
                  src={assets.forward}
                  alt=""
                  width={41}
                  className="bg-white rounded-full flexCenter p-2 m-1 group-hover:translate-x-3 transition-all duration-500 shadow-lg"
                />
              </Link>
            </div>
          </div>
          <div className="net-hero-promo">
            <img
              src={assets.hero}
              alt=""
              width={224}
              height={104}
              className="net-hero-promo-image"
            />
            <p className="net-hero-promo-text">
              <b className="uppercase">Khơi dậy</b> vẻ đẹp của bạn chỉ với một
              cú nhấp chuột. Khám phá phong cách mới và mua sắm ngay hôm nay!
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
