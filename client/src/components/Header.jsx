import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { assets } from "../assets/data";
import Navbar from "./Navbar";
import { useClerk, UserButton } from "@clerk/react";
import { useAppContext } from "../context/AppContext";
import { Sparkles } from "lucide-react";
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
  const [menuOpened, setMenuOpened] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [hasOpenedAIChat, setHasOpenedAIChat] = useState(false);
  const { openSignIn } = useClerk();

  const { navigate, openCart, user, getCartCount, isOwner } = useAppContext();

  const toggleMenu = () => {
    setMenuOpened((prev) => !prev);
  };

  const toggleAIChat = () => {
    setHasOpenedAIChat(true);
    setMenuOpened(false);
    setIsAIChatOpen((isOpen) => !isOpen);
  };
  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-50 bg-white py-3">
        <div className="max-padd-container flexBetween">
          {/* Logo */}
          <div className="flex flex-1">
            <Link to={"/"} className="flex items-end">
              <img src={assets.logoImg} alt="logoImg" className="h-11" />
              <span className="hidden sm:block bold-24 relative top-1 right-2">
                elours
              </span>
            </Link>
          </div>
          {/* Navbar */}
          <div className="flex-1">
            <Navbar
              setMenuOpened={setMenuOpened}
              containerStyles={`${
                menuOpened
                  ? "flex items-start flex-col gap-y-8 fixed top-16 right-6 p-5 bg-white rounded-xl shadow-md w-52 z-50"
                  : "hidden lg:flex gap-x-5 xl:gap-x-10 medium-15 bg-secondary/10 rounded-full p-1"
              }`}
            />
          </div>
          {/* Buttons & Profile icon */}
          <div className="flex flex-1 items-center sm:justify-end gap-x-4 sm:gap-x-8">
            <div>
              <button
                type="button"
                onClick={toggleAIChat}
                aria-haspopup="dialog"
                aria-expanded={isAIChatOpen}
                aria-controls="vouges-ai-chat-panel"
                className="btn-outline flex items-center px-2 py-2 gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200/50 transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-lg hover:shadow-amber-300/50 dark:shadow-amber-900/30 dark:hover:shadow-amber-800/40"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold">Ask AI</span>
              </button>
            </div>
            <div>
              {isOwner && (
                <button
                  onClick={() => navigate("/owner")}
                  className="btn-outline px-2 py-2 text-xs font-semibold"
                >
                  Dashboard
                </button>
              )}
            </div>
            {/* Menu Toggle */}
            <div className="relative lg:hidden w-7 h-6">
              <img
                onClick={toggleMenu}
                src={assets.menu}
                alt=""
                className={`absolute inset-0 lg:hidden cursor-pointer transition-opacity duration-700 ${menuOpened ? "opacity-0" : "opacity-100"}`}
              />
              <img
                onClick={toggleMenu}
                src={assets.menuClose}
                alt=""
                className={`absolute inset-0 lg:hidden cursor-pointer transition-opacity duration-700 ${menuOpened ? "opacity-100" : "opacity-0"}`}
              />
            </div>
            {/* Cart */}
            <button
              type="button"
              onClick={openCart}
              data-cart-target
              aria-label={`Shopping cart with ${getCartCount()} items`}
              className="relative cursor-pointer"
            >
              <img src={assets.cartAdded} alt="" className="min-w-7" />
              <span className="absolute bottom-7 right-0 left-0 text-xs font-bold bg-secondary/15 flexCenter rounded-full">
                {getCartCount()}
              </span>
            </button>
            {/* User Profile */}
            <div className="group">
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
                    <UserButton.Action label="Thành viên & voucher" labelIcon={<OrdersIcon />}
                      onClick={() => navigate("/membership")} />
                    <UserButton.Action
                      label="My Orders"
                      labelIcon={<OrdersIcon />}
                      onClick={() => navigate("/my-orders")}
                    />
                  </UserButton.MenuItems>
                </UserButton>
              ) : (
                <button
                  onClick={() => openSignIn()}
                  className="btn-secondary flexCenter gap-2 rofunded-full"
                >
                  Login
                  <img src={assets.user} alt="" className="invert w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {hasOpenedAIChat && (
        <Suspense fallback={isAIChatOpen ? <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-white p-5 shadow-lg">Loading chat...</div> : null}>
          <AIChatPanel
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export default Header;
