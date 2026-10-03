import { useAppContext } from "../../context/AppContext";
import { assets } from "../../assets/data";
import { Link, NavLink, Outlet, Navigate } from "react-router-dom";
import { UserButton } from "@clerk/react";

const Sidebar = () => {
  const { isOwner, user, profileError, retryUserProfile } = useAppContext();

  const navItems = [
    {
      path: "/owner",
      label: "Dashboard",
      icon: assets.dashboard,
    },
    {
      path: "/owner/add-product",
      label: "Add Product",
      icon: assets.squarePlus,
    },
    {
      path: "/owner/add-category",
      label: "Add Category",
      icon: assets.squarePlus,
    },
    {
      path: "/owner/list-product",
      label: "List Product",
      icon: assets.list,
    },
    { path: "/owner/vouchers", label: "Vouchers", icon: assets.list },
  ];

  if (isOwner === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {profileError ? (
          <div role="alert" className="text-center">
            <p>{profileError}</p>
            <button
              type="button"
              onClick={retryUserProfile}
              className="btn-outline mt-4"
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            role="status"
            aria-label="Verifying account"
            className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin"
          />
        )}
      </div>
    );
  }

  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="mx-auto max-w-[1440px] flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="max-md:flexCenter flex flex-col justify-between bg-primary sm:m-3 md:min-w-[20%] md:min-h-[97vh] rotate-xl shadow">
          <div className="flex flex-col gap-y-6 max-md:items-center md:flex-col md:pt-5">
            <div className="w-full flex justify-between md:flex-col">
              {/* Logo */}
              <div className="flex flex-1 p-3 lg:pl-12">
                <Link to={"/"} className="flex items-end">
                  <img src={assets.logoImg} alt="logoImg" className="h-11" />
                  <span className="bold-24 relative top-1 right-2">elours</span>
                </Link>
              </div>
              <div className="md:hidden flex items-center gap-3 md:bg-primary rounded-b-xl p-2 pl-5 lg:pl-10 md:mt-10">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: {
                        width: "42px",
                        height: "42px",
                      },
                    },
                  }}
                />
                <div className="text-sm font-semibold text-gray-800 capitalize">
                  {user?.firstName} {user?.lastName}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center md:flex-col md:gap-x-5 gap-y-4 md:gap-y-8 md:mt-4">
              {navItems.map((link) => (
                <NavLink
                  key={link.label}
                  to={link.path}
                  end={link.path === "/owner"}
                  className={({ isActive }) =>
                    isActive
                      ? "flexStart gap-x-2 p-5 lg:pl-12 bold-13 sm:!text-sm cursor-pointer h-10 bg-secondary/10 max-md:border-b-4 md:border-r-4 border-secondary"
                      : "flexStart gap-x-2 lg:pl-12 p-5 bold-13 sm:!text-sm cursor-pointer h-10 rounded-xl"
                  }
                >
                  <img
                    src={link.icon}
                    alt={link.label}
                    className="hidden md:block"
                    width={18}
                  />
                  <div>{link.label}</div>
                </NavLink>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 md:bg-primary border-t border-slate-900/15 rounded-b-xl p-2 pl-5 lg:pl-10 md:mt-10">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: {
                    width: "42px",
                    height: "42px",
                  },
                },
              }}
            />
            <div className="text-sm font-semibold text-gray-800 capitalize">
              {user?.firstName} {user?.lastName}
            </div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default Sidebar;
