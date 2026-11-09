import { lazy, Suspense } from "react";
import Header from "./components/Header";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import { Toaster } from "react-hot-toast";
import { useAppContext } from "./context/AppContext";

import { PageSkeleton, ProductDetailSkeleton } from "./components/LoadingState";
const Home = lazy(() => import("./pages/Home"));
const Collection = lazy(() => import("./pages/Collection"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Policies = lazy(() => import("./pages/Policies"));
const Cart = lazy(() => import("./pages/Cart"));
const CartDrawer = lazy(() => import("./components/CartDrawer"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderOverview = lazy(() => import("./pages/OrderOverview"));
const Membership = lazy(() => import("./pages/Membership"));
const Vouchers = lazy(() => import("./pages/owner/Vouchers"));
const Loyalty = lazy(() => import("./pages/owner/Loyalty"));
const Messages = lazy(() => import("./pages/owner/Messages"));
const Users = lazy(() => import("./pages/owner/Users"));
const Sidebar = lazy(() => import("./components/owner/Sidebar"));
const Dashboard = lazy(() => import("./pages/owner/Dashboard"));
const PerfumeOverview = lazy(() => import("./pages/owner/PerfumeOverview"));
const PerfumeProducts = lazy(() => import("./pages/owner/PerfumeProducts"));
const PerfumeEditor = lazy(() => import("./pages/owner/PerfumeEditor"));
const FragranceLibrary = lazy(() => import("./pages/owner/FragranceLibrary"));
const AddProduct = lazy(() => import("./pages/owner/AddProduct"));
const AddCategory = lazy(() => import("./pages/owner/AddCategory"));

const App = () => {
  const location = useLocation();
  const { isCartOpen } = useAppContext();
  const isOwnerPath = location.pathname.includes("owner");
  return (
    <main className={`net-theme ${isOwnerPath ? "net-admin overflow-hidden" : "net-storefront overflow-x-clip"} text-tertiary`}>
      {!isOwnerPath && <Header />}
      {isCartOpen && <Suspense fallback={null}><CartDrawer /></Suspense>}
      <Toaster position="bottom-right" />
      <Suspense
        fallback={
          location.pathname.startsWith("/collection/") ? <ProductDetailSkeleton /> : <PageSkeleton />
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collection" element={<Collection key={`${location.search}:${location.state?.headerSearch || ""}`} />} />
          <Route path="/collection/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Navigate to="/about" replace />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/knowledge" element={<Navigate to="/knowledge/group" replace />} />
          <Route path="/knowledge/:kind" element={<Knowledge />} />
          <Route path="/knowledge/:kind/:slug" element={<Knowledge />} />
          <Route path="/cart" element={<Cart key={location.state?.checkoutRequest || "cart"} />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/order-overview/:orderId" element={<OrderOverview />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/owner" element={<Sidebar />}>
            <Route index element={<PerfumeOverview />} />
            <Route path="orders" element={<Dashboard />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="add-category" element={<AddCategory />} />
            <Route path="list-product" element={<PerfumeProducts key={location.search} />} />
            <Route path="inventory" element={<Navigate to={{ pathname: "/owner/list-product", search: location.search }} replace />} />
            <Route path="quality" element={<Navigate to="/owner/list-product?quality=issues" replace />} />
            <Route path="brands" element={<FragranceLibrary key="brands" brands />} />
            <Route path="library" element={<FragranceLibrary key="library" />} />
            <Route path="vouchers" element={<Vouchers />} />
            <Route path="loyalty" element={<Loyalty />} />
            <Route path="messages" element={<Messages />} />
            <Route path="users" element={<Users />} />
            <Route path="customers" element={<Navigate to={{pathname:"/owner/users",search:location.search}} replace />} />
            <Route path="edit-product/:productId" element={<PerfumeEditor />} />
            <Route path="*" element={<Navigate to="/owner" replace />} />
          </Route>
        </Routes>
      </Suspense>
      {!isOwnerPath && <Footer />}
    </main>
  );
};

export default App;
