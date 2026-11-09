import { NavLink, useLocation } from "react-router-dom";
import { STORE_SHOP_LINKS } from "../data/storeNavigation";
import BrandMenu from "./BrandMenu";
import { prefetchCollection } from "../utils/prefetchCollection";
import { useAppContext } from "../context/AppContext";
import NavigationDropdown from "./NavigationDropdown";

const Navbar = ({ containerStyles, setMenuOpened, brandDirectory, group = "all", navigationId = "store-navigation" }) => {
  const { pathname, search } = useLocation();
  const { publicCatalog, setSearchQuery } = useAppContext();
  const selectedCategory = new URLSearchParams(search).get("category");
  const selectedBrand = new URLSearchParams(search).get("brand");
  const shoppingLinks = STORE_SHOP_LINKS;
  const informationLinks = [
    { path: "/about", title: "Về chúng tôi" },
    { path: "/contact", title: "Liên hệ" },
    { path: "/policies", title: "Chính sách" },
  ];
  const knowledgeLinks = [
    { path: "/knowledge/group", title: "Nhóm hương" },
    { path: "/knowledge/accord", title: "Kiểu mùi" },
    { path: "/knowledge/note", title: "Note hương" },
  ];
  const renderLinks = links => links.map((link) => (
        <NavLink
          onClick={() => { setSearchQuery(""); setMenuOpened(false); }}
          onPointerEnter={() => prefetchCollection(publicCatalog, link.path)} onFocus={() => prefetchCollection(publicCatalog, link.path)}
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
      {group !== "shop" && <NavigationDropdown title="Kiến thức" links={knowledgeLinks} compact={group === "all"} onNavigate={() => setMenuOpened(false)} />}
      {group !== "shop" && <NavigationDropdown title="Về Velours" links={informationLinks} compact={group === "all"} onNavigate={() => setMenuOpened(false)} />}
    </nav>
  );
};

export default Navbar;
