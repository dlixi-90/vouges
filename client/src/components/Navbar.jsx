import { NavLink, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import BrandMenu from "./BrandMenu";

const Navbar = ({ containerStyles, setMenuOpened, brandDirectory, group = "all", navigationId = "store-navigation" }) => {
  const { categories } = useAppContext();
  const { pathname, search } = useLocation();
  const selectedCategory = new URLSearchParams(search).get("category");
  const selectedBrand = new URLSearchParams(search).get("brand");
  const shoppingLinks = [
    { path: "/collection", title: "Bộ sưu tập" },
    ...[...categories].sort((a,b)=>{
      const order=["Nước hoa nam","Nước hoa nữ","Nước hoa unisex"];
      const rank=value=>order.indexOf(value)<0?99:order.indexOf(value);
      return rank(a.name)-rank(b.name);
    }).slice(0, 3).map((category) => ({
      path: `/collection?category=${encodeURIComponent(category.name)}`,
      title: category.name,
      category: category.name,
    })),
  ];
  const informationLinks = [
    { path: "/about", title: "Về chúng tôi" },
    { path: "/contact", title: "Liên hệ" },
  ];
  const renderLinks = links => links.map((link) => (
        <NavLink
          onClick={() => setMenuOpened(false)}
          key={link.path}
          to={link.path}
          title={link.title}
          aria-current={link.category ? (selectedCategory === link.category ? "page" : false)
            : link.path === "/collection" && (selectedCategory || selectedBrand) ? false : "page"}
          className={({ isActive }) => {
            const active = link.category
              ? pathname === "/collection" && selectedCategory === link.category
              : isActive && (link.path !== "/collection" || (!selectedCategory && !selectedBrand));
            return `${active ? "active-link" : ""} p-2.5 px-4 rounded-full text-sm font-semibold`;
          }}
        >
          {link.title}
        </NavLink>
      ));

  return (
    <nav id={navigationId} aria-label={group === "shop" ? "Mua sắm" : group === "info" ? "Thông tin cửa hàng" : "Điều hướng chính"} className={containerStyles}>
      {group !== "info" && renderLinks(shoppingLinks)}
      {group !== "info" && <BrandMenu directory={brandDirectory} compact={group === "all"} onNavigate={() => setMenuOpened(false)} />}
      {group !== "shop" && renderLinks(informationLinks)}
    </nav>
  );
};

export default Navbar;
