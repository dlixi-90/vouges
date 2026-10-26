import { NavLink, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const Navbar = ({ containerStyles, setMenuOpened, group = "all", navigationId = "store-navigation" }) => {
  const { categories } = useAppContext();
  const { pathname, search } = useLocation();
  const selectedCategory = new URLSearchParams(search).get("category");
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
  const navLinks = group === "shop" ? shoppingLinks
    : group === "info" ? informationLinks : [...shoppingLinks, ...informationLinks];

  return (
    <nav id={navigationId} aria-label={group === "shop" ? "Mua sắm" : group === "info" ? "Thông tin cửa hàng" : "Điều hướng chính"} className={containerStyles}>
      {navLinks.map((link) => (
        <NavLink
          onClick={() => setMenuOpened(false)}
          key={link.path}
          to={link.path}
          title={link.title}
          aria-current={link.category ? (selectedCategory === link.category ? "page" : false)
            : link.path === "/collection" && selectedCategory ? false : "page"}
          className={({ isActive }) => {
            const active = link.category
              ? pathname === "/collection" && selectedCategory === link.category
              : isActive && (link.path !== "/collection" || !selectedCategory);
            return `${active ? "active-link" : ""} p-2.5 px-4 rounded-full text-sm font-semibold`;
          }}
        >
          {link.title}
        </NavLink>
      ))}
    </nav>
  );
};

export default Navbar;
