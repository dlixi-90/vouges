import { Link } from "react-router-dom";
import { assets } from "../assets/data";
import background from "../assets/bg.webp";

const Hero = () => {
  return (
    <section className="net-hero max-padd-container">
      <div className="h-[89vh] w-full mt-18 rounded-2xl relative overflow-hidden">
        <img src={background} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative mx-auto max-w-[1440px] px-4 pt-1 sm:pt-8 flex flex-col justify-between h-full">
          <div className="net-hero-copy">
            <p className="net-hero-eyebrow">Velours · Mỹ phẩm tinh chọn</p>
            <h1 className="net-hero-title">
              <span className="net-hero-title-lead">Tôn lên</span>{" "}
              <span className="net-hero-title-accent">vẻ đẹp tự nhiên.</span>
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
          {/* Card */}
          <div className="bg-white p-3 max-w-[249px] rounded-2xl mb-4">
            <div className="h-32 w-56 overflow-hidden">
              <img
                src={assets.hero}
                alt=""
                className="h-30 object-cover w-full rounded-2xl"
              />
            </div>
            <p className="text-[13px] pt-2">
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
