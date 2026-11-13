import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { STORE_CATEGORIES } from "../data/storeNavigation";
import { useAppContext } from "../context/AppContext";
import { prefetchCollection } from "../utils/prefetchCollection";

const images = ["men", "women", "unisex"];

export default function MobileDiscover() {
  const { publicCatalog, setSearchQuery } = useAppContext();
  return <section className="mobile-discover" aria-labelledby="mobile-discover-title">
    <header><div><p>Bắt đầu từ điều bạn thích</p><h2 id="mobile-discover-title">Tìm dấu hương riêng</h2></div>
      <Link to="/collection" onClick={() => setSearchQuery("")}>Xem tất cả <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <div className="mobile-discover-grid">
      {STORE_CATEGORIES.map((name, index) => {
        const path = `/collection?category=${encodeURIComponent(name)}`;
        return <Link key={name} to={path} onClick={() => setSearchQuery("")}
          onPointerEnter={() => prefetchCollection(publicCatalog, path)} onFocus={() => prefetchCollection(publicCatalog, path)}>
          <span><img src={`/images/categories/${images[index]}.webp`} width="160" height="160" alt="" loading="lazy" /></span>
          <strong>{name}</strong>
        </Link>;
      })}
    </div>
    <Link className="mobile-discover-guide" to="/knowledge/group"><BookOpen size={20} aria-hidden="true" />
      <span><strong>Bạn chưa biết chọn mùi hương nào?</strong><small>Khám phá thư viện hương cùng Velours</small></span><ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  </section>;
}
