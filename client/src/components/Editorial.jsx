import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { ArrowUpRight } from "lucide-react";
import banner from "../assets/banner.webp";

export function EditorialStories() {
  return (
    <div className="inessa-stories max-padd-container">
      <section className="inessa-story" aria-labelledby="story-original">
        <div className="inessa-story-visual">
          <img
            className="inessa-story-photo"
            src="/images/inessa/bg-03.jpg"
            alt="Nước hoa cùng những cánh hoa trắng tinh tế"
            loading="lazy"
            width="600"
            height="730"
          />
          <img
            className="inessa-story-inset"
            src="/images/inessa/perfume-002.jpg"
            alt="Chi tiết hương nước hoa tuyển chọn"
            loading="lazy"
            width="300"
            height="380"
          />
        </div>
        <div className="inessa-story-copy">
          <p className="inessa-eyebrow">Tinh chọn bởi Velours</p>
          <h2 id="story-original">
            Nét đẹp
            <br />
            từ những
            <br />
            <em>điều tinh tế.</em>
          </h2>
          <p>
            Từ hương thơm yêu thích đến một làn da rạng rỡ. Tìm thấy những sản
            phẩm làm đẹp đồng điệu với phong cách của bạn.
          </p>
          <Link to="/collection" className="inessa-button">
            Mua sắm ngay
          </Link>
        </div>
      </section>
      <section
        className="inessa-story inessa-story-reverse"
        aria-labelledby="story-everyday"
      >
        <div className="inessa-story-copy">
          <p className="inessa-eyebrow">Nghi thức làm đẹp mỗi ngày</p>
          <h2 id="story-everyday">
            Tự nhiên.
            <br />
            Cuốn hút.
            <br />
            <em>Là chính bạn.</em>
          </h2>
          <p>
            Chăm sóc bản thân bắt đầu từ những lựa chọn nhỏ. Để mỗi ngày đều là
            một dịp tận hưởng vẻ đẹp và sự tự tin của riêng mình.
          </p>
          <Link to="/collection" className="inessa-button">
            Tìm cảm hứng của bạn
          </Link>
        </div>
        <div className="inessa-story-visual">
          <img
            className="inessa-story-photo"
            src="/images/inessa/bg-04.jpg"
            alt="Hương nước hoa nổi bật giữa sắc đỏ và ánh sáng"
            loading="lazy"
            width="600"
            height="730"
          />
          <img
            className="inessa-story-inset"
            src="/images/inessa/perfume-003.jpg"
            alt="Thiết kế chai nước hoa thanh lịch"
            loading="lazy"
            width="300"
            height="380"
          />
        </div>
      </section>
    </div>
  );
}

export function EditorialCampaign() {
  return (
    <section
      className="inessa-campaign max-padd-container"
      aria-labelledby="campaign-title"
    >
      <div className="inessa-campaign-image">
        <img
          src="/images/inessa/bg-07.jpg"
          alt="Không gian hương thơm đầy cảm hứng"
          loading="lazy"
          width="800"
          height="800"
        />
      </div>
      <div className="inessa-campaign-copy">
        <span className="inessa-rule" />
        <p className="inessa-eyebrow">Dành một chút thời gian cho mình</p>
        <h2 id="campaign-title">
          Một dấu hương.
          <br />
          Ngàn <em>cảm xúc.</em>
        </h2>
        <p>
          Vẻ đẹp không chỉ được nhìn thấy, mà còn được cảm nhận. Khám phá bộ sưu
          tập và tìm dấu ấn của bạn.
        </p>
        <Link to="/collection" className="inessa-button">
          Khám phá ngay
        </Link>
      </div>
    </section>
  );
}

export function ShopCategories() {
  const { categories } = useAppContext();
  const images = [
    "/images/inessa/bg-03.jpg",
    "/images/inessa/bg-04.jpg",
    banner,
  ];
  const items = categories.slice(0, 3);
  if (!items.length) return null;
  return (
    <section
      className="inessa-categories max-padd-container"
      aria-labelledby="categories-title"
    >
      <header className="inessa-section-heading">
        <p className="inessa-eyebrow">Thế giới làm đẹp của bạn</p>
        <h2 id="categories-title">
          Khám phá <em>danh mục</em>
        </h2>
        <span className="inessa-rule" />
      </header>
      <div className="inessa-category-grid">
        {items.map((category, index) => (
          <Link
            key={category._id || category.name}
            to={`/collection?category=${encodeURIComponent(category.name)}`}
            className="inessa-category"
          >
            <img src={images[index]} alt={category.name} loading="lazy" />
            <span className="inessa-category-label">
              <span>{category.name}</span>
              <ArrowUpRight size={22} strokeWidth={1.2} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
