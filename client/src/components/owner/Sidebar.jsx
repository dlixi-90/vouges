import { useEffect, useState } from "react";
import { Link, Outlet, Navigate, matchPath, useLocation, useNavigate } from "react-router-dom";
import { UserButton, useClerk } from "@clerk/react";
import { ArrowUpRight, Bell, ChevronRight, Database, FlaskConical, Grid2X2, Layers3, Library, LogOut, Menu, MessagesSquare, Package, Search, ShieldCheck, ShoppingBag, Ticket, Warehouse, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { assets } from "../../assets/data";

const navigation = [
  { label: "Tổng quan", items: [
    { path: "/owner", label: "Dashboard", icon: Grid2X2 },
    { path: "/owner/orders", label: "Đơn hàng & doanh thu", icon: ShoppingBag },
    { path: "/owner/list-product", label: "Sản phẩm nước hoa", icon: Package, activePaths: ["/owner/list-product", "/owner/add-product", "/owner/edit-product/:productId"] },
    { path: "/owner/inventory", label: "Giá & trạng thái hàng", icon: Warehouse },
  ] },
  { label: "Quản lý catalog", items: [
    { path: "/owner/brands", label: "Thương hiệu", icon: FlaskConical },
    { path: "/owner/add-category", label: "Danh mục", icon: Layers3 },
    { path: "/owner/library", label: "Thư viện hương", icon: Library },
    { path: "/owner/quality", label: "Chất lượng dữ liệu", icon: ShieldCheck },
    { path: "/owner/data", label: "Dữ liệu Apaniche", icon: Database },
  ] },
  { label: "Vận hành", items: [
    { path: "/owner/vouchers", label: "Mã giảm giá", icon: Ticket },
    { path: "/owner/messages", label: "Tin nhắn & hỗ trợ", icon: MessagesSquare },
  ] },
];

export default function Sidebar() {
  const { isOwner, user, profileError, retryUserProfile } = useAppContext();
  const { signOut } = useClerk();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState({ path: pathname, open: false });
  const [search, setSearch] = useState("");
  const menuOpen = menu.path === pathname && menu.open;
  const activeItem = navigation.flatMap(group => group.items).find(item => (item.activePaths || [item.path]).some(path => matchPath({ path, end: true }, pathname)));
  const isWorkspacePage = pathname === "/owner/messages";
  const closeMenu = () => setMenu({ path: pathname, open: false });
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    if (!menuOpen || !mobile.matches) return;
    const sidebar = document.querySelector('.admin-sidebar');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...sidebar.querySelectorAll('a,button')];
    // A sliding drawer may still be hidden during its first animation frame.
    let focusFrame;
    const focusMenu = () => {
      const first = focusable()[0];
      first?.focus({ preventScroll: true });
      if (first && document.activeElement !== first) focusFrame = window.requestAnimationFrame(focusMenu);
    };
    focusFrame = window.requestAnimationFrame(focusMenu);
    const close = () => setMenu({ path: pathname, open: false });
    const onKeyDown = event => {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    mobile.addEventListener("change", close);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      mobile.removeEventListener("change", close);
      document.body.style.overflow = previousOverflow;
      document.querySelector('.admin-menu-toggle')?.focus({ preventScroll: true });
    };
  }, [menuOpen, pathname]);

  if (isOwner === null) return <div className="min-h-screen flex items-center justify-center">
    {profileError ? <div role="alert" className="text-center"><p>{profileError}</p><button type="button" onClick={retryUserProfile} className="btn-outline mt-4">Thử lại</button></div>
      : <div role="status" aria-label="Đang xác minh tài khoản" className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />}
  </div>;
  if (!isOwner) return <Navigate to="/" replace />;

  return <div className={`net-admin-layout velours-admin-shell${isWorkspacePage ? " is-workspace" : ""}`}>
    <div className="mx-auto velours-admin-frame">
      {menuOpen && <button type="button" className="admin-menu-backdrop" aria-label="Đóng menu quản trị" onClick={closeMenu} />}
      <aside className={`net-sidebar admin-sidebar${menuOpen ? " is-open" : ""}`} aria-label="Điều hướng quản trị" id="admin-navigation">
        <div className="admin-brand-row">
          <div className="admin-brand-lockup">
            <Link to="/owner" className="admin-brand" aria-label="Velours — Dashboard" onClick={closeMenu}><img src={assets.logoImg} alt="" /><span>elours</span></Link>
            <Link to="/" className="admin-store-link" aria-label="Xem cửa hàng" title="Xem cửa hàng" onClick={closeMenu}><ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          <button type="button" className="admin-mobile-close" aria-label="Đóng menu" onClick={closeMenu}><X size={20} /></button>
        </div>
        <nav className="perfume-admin-nav admin-navigation">
          {navigation.map(group => <div className="admin-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map(({ path, label, icon: Icon, activePaths }) => {
              const active = (activePaths || [path]).some(pattern => matchPath({ path: pattern, end: true }, pathname));
              return <Link to={path} key={path} onClick={closeMenu} aria-current={active ? "page" : undefined}><Icon size={18} strokeWidth={1.65} aria-hidden="true" /><span>{label}</span>{active && <ChevronRight size={14} className="admin-nav-arrow" aria-hidden="true" />}</Link>;
            })}
          </div>)}
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" onClick={() => signOut({ redirectUrl: "/" })}><LogOut size={17} />Đăng xuất</button>
        </div>
      </aside>
      <div className="velours-admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb"><button type="button" className="admin-menu-toggle" onClick={() => setMenu({ path: pathname, open: !menuOpen })} aria-expanded={menuOpen} aria-controls="admin-navigation" aria-label="Mở menu quản trị"><Menu size={21} /></button><Link to="/owner">Quản trị</Link><ChevronRight size={13} aria-hidden="true" /><span>{activeItem?.label || "Quản lý nước hoa"}</span></div>
          <div className="admin-topbar-tools">
            <form className="admin-global-search" role="search" onSubmit={event => { event.preventDefault(); if (search.trim()) navigate(`/owner/list-product?q=${encodeURIComponent(search.trim())}`); }}>
              <Search size={17} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm sản phẩm, thương hiệu…" aria-label="Tìm nhanh sản phẩm" /><button type="submit" aria-label="Tìm kiếm"><ArrowUpRight size={15} /></button>
            </form>
            <Link to="/owner/messages" className="admin-notification" aria-label="Mở tin nhắn hỗ trợ"><Bell size={19} strokeWidth={1.6} /></Link>
            <div className="admin-account"><UserButton appearance={{ elements: { userButtonAvatarBox: { width: "36px", height: "36px" } } }} /><div><strong>{user?.fullName || user?.firstName || "Quản trị viên"}</strong><span>{user?.primaryEmailAddress?.emailAddress || "Quản trị viên Velours"}</span></div></div>
          </div>
        </header>
        <div className="velours-admin-route"><Outlet /></div>
      </div>
    </div>
  </div>;
}
