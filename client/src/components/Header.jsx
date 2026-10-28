import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { assets } from "../assets/data";
import Navbar from "./Navbar";
import QuickProductSearch from "./QuickProductSearch";
import useBrandDirectory from "../hooks/useBrandDirectory";
import { useClerk, UserButton } from "@clerk/react";
import { useAppContext } from "../context/AppContext";
import { Headset, Ticket, X } from "lucide-react";
const AIChatPanel = lazy(() => import("./ai/AIChatPanel"));

const OrdersIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 36 36"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-scroll-text-icon lucide-scroll-text"
  >
    <path d="M15 12h-5" />
    <path d="M15 8h-5" />
    <path d="M19 17V5a2 2 0 0 0-2-2H4" />
    <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
  </svg>
);

const Header = () => {
  const brandDirectory = useBrandDirectory();
  const [menuOpened, setMenuOpened] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [hasOpenedAIChat, setHasOpenedAIChat] = useState(false);
  const chatLauncherRef = useRef(null);
  const { openSignIn } = useClerk();

  const { navigate, setSearchQuery, openCart, isCartOpen, isCartPage, user, getCartCount, isOwner, storeResources } =
    useAppContext();

  const prefetchMembership = () => {
    if (!user) return;
    void import("../pages/Membership").catch(() => {});
    void storeResources.loadMembership().catch(() => {});
  };

  const toggleMenu = () => {
    setMenuOpened((prev) => !prev);
  };

  const toggleAIChat = () => {
    setHasOpenedAIChat(true);
    setMenuOpened(false);
    setIsAIChatOpen((isOpen) => !isOpen);
  };
  const closeAIChat = useCallback(() => {
    setIsAIChatOpen(false);
  }, []);
  useEffect(() => {
    if (hasOpenedAIChat && !isAIChatOpen) {
      chatLauncherRef.current?.focus({ preventScroll: true });
    }
  }, [hasOpenedAIChat, isAIChatOpen]);
  return (
    <>
      <header className="net-header absolute top-0 left-0 right-0 z-50 bg-white py-3">
        <div className="max-padd-container inessa-header-grid">
          <div className="inessa-navigation-left">
            <button type="button" onClick={toggleMenu} aria-label={menuOpened ? "Đóng menu" : "Mở menu"}
              aria-expanded={menuOpened} aria-controls="store-navigation" className="inessa-menu-toggle">
              <img src={menuOpened ? assets.menuClose : assets.menu} alt="" width={24} height={24} />
            </button>
            <Navbar group="shop" brandDirectory={brandDirectory} navigationId="store-shop-navigation" setMenuOpened={setMenuOpened} containerStyles="inessa-desktop-navigation" />
          </div>
          {/* Logo */}
          <div className="inessa-brand flex">
            <Link to={"/"} onClick={() => setMenuOpened(false)} aria-label="Velours — Trang chủ" className="flex items-end">
              <img
                src={assets.logoImg}
                alt="Biểu trưng Velours"
                className="inessa-logo-mark" height={34}
              />
              <span className="inessa-brand-name">
                elours
              </span>
            </Link>
          </div>
          <div className="inessa-header-right">
            <QuickProductSearch className="store-header-search" onSearch={query => {
              setSearchQuery(query);
              setMenuOpened(false);
              navigate("/collection", { state: { headerSearch: Date.now() } });
            }} />
            <Navbar group="info" navigationId="store-info-navigation" setMenuOpened={setMenuOpened} containerStyles="inessa-desktop-navigation" />
            {/* Buttons & Profile icon */}
            <div className="net-header-actions">
              {isOwner && (
                <div className="inessa-header-tools">
                  <button
                    onClick={() => navigate("/owner")}
                    className="btn-outline px-2 py-2 text-xs font-semibold"
                  >
                    Dashboard
                  </button>
                </div>
              )}
              <div className="inessa-header-account-actions">
                {/* Cart */}
                <button
                  type="button"
                  onClick={() => { setMenuOpened(false); openCart(); }}
                  disabled={isCartPage}
                  data-cart-target
                  aria-label={`Giỏ hàng có ${getCartCount()} sản phẩm`}
                  aria-current={isCartPage ? "page" : undefined}
                  aria-haspopup={isCartPage ? undefined : "dialog"}
                  aria-expanded={isCartOpen}
                  aria-controls="velours-cart-drawer"
                  className={`relative ${isCartPage ? "cursor-default" : "cursor-pointer"}`}
                >
                  <img src={assets.cartAdded} alt="" className="min-w-7" />
                  <span className="absolute bottom-7 right-0 left-0 text-xs font-bold bg-secondary/15 flexCenter rounded-full">
                    {getCartCount()}
                  </span>
                </button>
                {/* User Profile */}
                <div
                  className="group"
                  onPointerEnter={prefetchMembership}
                  onFocus={prefetchMembership}
                >
                  {user ? (
                    <UserButton
                      appearance={{
                        elements: {
                          userButtonAvatarBox: {
                            width: "42px",
                            height: "42px",
                          },
                        },
                      }}
                    >
                      <UserButton.MenuItems>
                        <UserButton.Action
                          label="Đơn hàng của tôi"
                          labelIcon={<OrdersIcon />}
                          onClick={() => navigate("/my-orders")}
                        />
                        <UserButton.Action
                          label="Thành viên & mã giảm giá"
                          labelIcon={<Ticket size={16} aria-hidden="true" />}
                          onClick={() => navigate("/membership")}
                        />
                      </UserButton.MenuItems>
                    </UserButton>
                  ) : (
                    <button
                      aria-label="Đăng nhập"
                      onClick={() => openSignIn()}
                      className="btn-secondary flexCenter gap-2 rounded-full"
                    >
                      <span className="inessa-sign-in-label">Đăng nhập</span>
                      <img src={assets.user} alt="" className="invert w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {menuOpened && <Navbar brandDirectory={brandDirectory} setMenuOpened={setMenuOpened} containerStyles="inessa-mobile-navigation fixed" />}
        </div>
      </header>

      <button
        ref={chatLauncherRef}
        type="button"
        hidden={isAIChatOpen}
        onClick={toggleAIChat}
        aria-label="Hỏi trợ lý AI"
        aria-haspopup="dialog"
        aria-expanded={isAIChatOpen}
        aria-controls="vouges-ai-chat-panel"
        className="inessa-chat-launcher"
      >
        <Headset size={22} strokeWidth={1.7} aria-hidden="true" />
        <span className="inessa-chat-launcher-label" aria-hidden="true">Hỏi trợ lý AI</span>
      </button>

      {hasOpenedAIChat && (
        <Suspense
          fallback={
            isAIChatOpen ? (
              <div
                className="inessa-chat-loading flex items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-lg"
              >
                <p role="status">Đang tải cuộc trò chuyện…</p>
                <button type="button" onClick={closeAIChat} aria-label="Đóng trò chuyện tư vấn" className="cursor-pointer rounded-md p-1"><X size={20} aria-hidden="true" /></button>
              </div>
            ) : null
          }
        >
          <AIChatPanel
            key={user?.id || "guest"}
            isOpen={isAIChatOpen}
            onClose={closeAIChat}
          />
        </Suspense>
      )}
    </>
  );
};

export default Header;
