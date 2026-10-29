import { NavLink, useLocation } from "react-router-dom";
import { STORE_SHOP_LINKS } from "../data/storeNavigation";
import BrandMenu from "./BrandMenu";
import { prefetchCollection } from "../utils/prefetchCollection";
import { useAppContext } from "../context/AppContext";

const Navbar = ({ containerStyles, setMenuOpened, brandDirectory, group = "all", navigationId = "store-navigation" }) => {
  const { pathname, search } = useLocation();
  const { publicCatalog, searchQuery } = useAppContext();
  const selectedCategory = new URLSearchParams(search).get("category");
  const selectedBrand = new URLSearchParams(search).get("brand");
  const shoppingLinks = STORE_SHOP_LINKS;
  const informationLinks = [
    { path: "/about", title: "Về chúng tôi" },
    { path: "/contact", title: "Liên hệ" },
  ];
  const renderLinks = links => links.map((link) => (
        <NavLink
          onClick={() => setMenuOpened(false)}
          onPointerEnter={() => prefetchCollection(publicCatalog, link.path, searchQuery)} onFocus={() => prefetchCollection(publicCatalog, link.path, searchQuery)}
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
