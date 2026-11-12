import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useClerk } from "@clerk/react";
import { ArrowUpRight, House, LayoutDashboard, LogOut, Package, Settings, ShoppingBag, Store, Ticket, UserRound, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import Navbar from "./Navbar";
import { prefetchRoute } from "../utils/prefetchRoute";

function MobileSheet({ id, title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const media = window.matchMedia("(max-width: 767px)");
    const overflow = document.body.style.overflow;
    const resize = () => {
      if (media.matches) {
        if (!dialog.open) dialog.showModal();
        document.body.style.overflow = "hidden";
      } else {
        dialog.close();
        document.body.style.overflow = overflow;
        onClose();
      }
    };
    if (media.matches) resize();
    media.addEventListener("change", resize);
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      media.removeEventListener("change", resize);
    };
  }, [onClose]);

  return <dialog ref={ref} id={id} className="mobile-sheet" aria-labelledby={`${id}-title`}
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="mobile-sheet-surface">
      <span className="mobile-sheet-handle" aria-hidden="true" />
      <header className="mobile-sheet-heading"><h2 id={`${id}-title`}>{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Đóng ${title.toLocaleLowerCase("vi-VN")}`}><X size={21} /></button>
      </header>
      {children}
    </div>
  </dialog>;
}

export default function MobileNavigation({ brandDirectory, menuOpened, setMenuOpened, closeMenu }) {
  const { user, isOwner, getCartCount, setSearchQuery } = useAppContext();
  const { openSignIn, openUserProfile, signOut } = useClerk();
  const location = useLocation();
  const [accountOpenedAt, setAccountOpenedAt] = useState(null);
  const accountOpen = accountOpenedAt === location.key;
  const count = getCartCount();
  const closeAccount = useCallback(() => setAccountOpenedAt(null), []);
  const accountActive = accountOpen || ["/membership", "/my-orders"].includes(location.pathname) || location.pathname.startsWith("/order-overview/");
  const warm = path => ({ onPointerEnter: () => prefetchRoute(path), onFocus: () => prefetchRoute(path) });

  return <>
    <nav className="mobile-tab-bar" aria-label="Điều hướng điện thoại">
      <NavLink to="/" end onClick={() => { closeMenu(); setSearchQuery(""); window.scrollTo({ top: 0, behavior: "instant" }); }} {...warm("/")}>
        <span className="mobile-tab-icon"><House size={23} strokeWidth={1.7} aria-hidden="true" /></span><span>Trang chủ</span>
      </NavLink>
      <NavLink to="/collection" onClick={() => { closeMenu(); setSearchQuery(""); }} {...warm("/collection")}>
        <span className="mobile-tab-icon"><Store size={23} strokeWidth={1.7} aria-hidden="true" /></span><span>Cửa hàng</span>
      </NavLink>
      <NavLink to="/cart" onClick={closeMenu} aria-label={`Giỏ hàng, ${count} sản phẩm`} {...warm("/cart")}>
        <span className="mobile-tab-icon" data-cart-target><ShoppingBag size={23} strokeWidth={1.7} aria-hidden="true" />
          {count > 0 && <span className="mobile-cart-count">{count > 99 ? "99+" : count}</span>}
        </span><span>Giỏ hàng</span>
      </NavLink>
      <button type="button" className={accountActive ? "active" : ""} aria-expanded={accountOpen} aria-haspopup="dialog" aria-controls="mobile-account"
        onClick={() => { closeMenu(); setAccountOpenedAt(location.key); }}>
        <span className="mobile-tab-icon"><UserRound size={23} strokeWidth={1.7} aria-hidden="true" /></span><span>Tài khoản</span>
      </button>
    </nav>

    {menuOpened && <MobileSheet id="mobile-menu" title="Khám phá Velours" onClose={closeMenu}>
      <Navbar brandDirectory={brandDirectory} navigationId="mobile-store-navigation" setMenuOpened={setMenuOpened} containerStyles="mobile-sheet-navigation" />
    </MobileSheet>}

    {accountOpen && <MobileSheet id="mobile-account" title="Tài khoản của bạn" onClose={closeAccount}>
      <div className={`mobile-account-identity${user ? "" : " mobile-account-identity--guest"}`}>
        <span className="mobile-account-avatar">{user?.imageUrl ? <img src={user.imageUrl} alt="" /> : <UserRound size={25} />}</span>
        <div><strong>{user?.fullName || user?.firstName || "Chào bạn, khách của Velours"}</strong><p>{user ? "Hương thơm riêng, đặc quyền riêng." : "Đăng nhập để theo dõi đơn và nhận ưu đãi."}</p></div>
      </div>
      {!user && <button type="button" className="mobile-account-signin" onClick={() => { closeAccount(); openSignIn(); }}>Đăng nhập / Đăng ký</button>}
      {user && <div className="mobile-account-links">
        <Link to="/my-orders" onClick={closeAccount} {...warm("/my-orders")}><Package size={20} />Đơn hàng của tôi<ArrowUpRight size={16} /></Link>
        <Link to="/membership" onClick={closeAccount} {...warm("/membership")}><Ticket size={20} />Thành viên & mã giảm giá<ArrowUpRight size={16} /></Link>
        <button type="button" onClick={() => { closeAccount(); openUserProfile(); }}><Settings size={20} />Cài đặt tài khoản<ArrowUpRight size={16} /></button>
        {isOwner && <Link to="/owner" onClick={closeAccount}><LayoutDashboard size={20} />Quản lý cửa hàng<ArrowUpRight size={16} /></Link>}
        <Link to="/contact" onClick={closeAccount}><UserRound size={20} />Liên hệ hỗ trợ<ArrowUpRight size={16} /></Link>
        <button type="button" onClick={() => { closeAccount(); void signOut({ redirectUrl: "/" }); }}><LogOut size={20} />Đăng xuất</button>
      </div>}
    </MobileSheet>}
  </>;
}
