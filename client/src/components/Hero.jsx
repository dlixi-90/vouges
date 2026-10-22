import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
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
              <span className="net-hero-title-lead">Tôn lên vẻ đẹp</span>{" "}
              <span className="net-hero-title-accent">tự nhiên.</span>
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
          <Link to="/collection" className="net-hero-promo">
            <img
              src={assets.hero}
              alt=""
              width={88}
              height={88}
              className="net-hero-promo-image"
            />
            <div className="min-w-0">
              <p className="net-hero-promo-title">Đẹp theo cách của bạn</p>
              <p className="net-hero-promo-text">Khám phá bộ sưu tập mới.</p>
              <span className="net-hero-promo-link">
                Xem ngay <ArrowUpRight size={14} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
