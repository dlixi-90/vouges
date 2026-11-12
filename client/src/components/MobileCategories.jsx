import { Link } from "react-router-dom";
import { ArrowRight, Droplets, Flower2, Grid2X2, Sparkles } from "lucide-react";
import { STORE_CATEGORIES } from "../data/storeNavigation";
import { useAppContext } from "../context/AppContext";

const icons = [Droplets, Flower2, Sparkles];

export default function MobileCategories() {
  const { setSearchQuery } = useAppContext();
  return <section className="mobile-categories" aria-labelledby="mobile-categories-title">
    <div className="mobile-section-heading"><h2 id="mobile-categories-title">Bạn tìm hương gì?</h2><Link to="/collection" onClick={() => setSearchQuery("")}>Xem tất cả<ArrowRight size={14} /></Link></div>
    <nav aria-label="Danh mục nước hoa" className="mobile-category-shortcuts">
      <Link to="/collection" onClick={() => setSearchQuery("")}><span><Grid2X2 size={23} strokeWidth={1.5} /></span>Tất cả</Link>
      {STORE_CATEGORIES.map((category, index) => {
        const Icon = icons[index];
        return <Link key={category} to={`/collection?category=${encodeURIComponent(category)}`} onClick={() => setSearchQuery("")}><span><Icon size={23} strokeWidth={1.5} /></span>{category.replace("Nước hoa ", "").replace(/^./u, char => char.toUpperCase())}</Link>;
      })}
    </nav>
  </section>;
}
