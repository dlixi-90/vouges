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
  const handleNavLinkClick = (event, link) => {
    setSearchQuery("");
    setMenuOpened(false);
    if (pathname === "/collection") {
      const linkParams = new URLSearchParams(link.path.split("?")[1] || "");
      const linkCategory = linkParams.get("category") || "";
      if (linkCategory && selectedCategory === linkCategory) {
        event.preventDefault();
        const toolbar = document.querySelector(".inessa-collection-toolbar");
        if (toolbar) {
          const header = document.querySelector(".net-header");
          const headerH = header && /^(sticky|fixed)$/.test(window.getComputedStyle(header).position)
            ? header.offsetHeight
            : 97;
          const gap = Number.parseFloat(window.getComputedStyle(toolbar).scrollMarginTop) || 16;
          const target = window.scrollY + toolbar.getBoundingClientRect().top - headerH - gap;
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: Math.max(0, target), behavior: reducedMotion ? "instant" : "smooth" });
        }
      } else if (!linkCategory && !selectedCategory && !selectedBrand) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? "instant" : "smooth" });
      }
    }
  };

  const renderLinks = links => links.map((link) => (
        <NavLink
          onClick={(event) => handleNavLinkClick(event, link)}
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
