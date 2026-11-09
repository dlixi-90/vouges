import { Link } from "react-router-dom";

import { useAppContext } from "../context/AppContext";
import { prefetchCollection } from "../utils/prefetchCollection";

const Hero = () => {
  const { publicCatalog, setSearchQuery } = useAppContext();
  return (
    <section className="inessa-hero" aria-labelledby="hero-title">
      <img
        className="inessa-hero-image"
        src="/images/inessa/bg-01.jpg"
        alt="Chai nước hoa trên bàn tay trong ánh sáng dịu nhẹ"
        fetchPriority="high"
        width="1920"
        height="1080"
      />
      <div className="max-padd-container inessa-hero-inner">
        <div className="inessa-hero-copy">
          <p className="inessa-eyebrow">Vẻ đẹp mang dấu ấn riêng</p>
          <h1 id="hero-title">
            Đánh thức
            <br />
            vẻ đẹp
            <br />
            <span>của bạn.</span>
          </h1>
          <Link
            to="/collection"
            className="inessa-button"
            onClick={() => setSearchQuery("")}
            onPointerEnter={() =>
              prefetchCollection(publicCatalog, "/collection")
            }
            onFocus={() =>
              prefetchCollection(publicCatalog, "/collection")
            }
          >
            Khám phá bộ sưu tập
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
