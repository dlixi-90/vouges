import { lazy, Suspense } from "react";
import Header from "./components/Header";
import { Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import { Toaster } from "react-hot-toast";

const Home = lazy(() => import("./pages/Home"));
const Collection = lazy(() => import("./pages/Collection"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Blog = lazy(() => import("./pages/Blog"));
const Contact = lazy(() => import("./pages/Contact"));
const Cart = lazy(() => import("./pages/Cart"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Sidebar = lazy(() => import("./components/owner/Sidebar"));
const Dashboard = lazy(() => import("./pages/owner/Dashboard"));
const AddProduct = lazy(() => import("./pages/owner/AddProduct"));
const AddCategory = lazy(() => import("./pages/owner/AddCategory"));
const ListProduct = lazy(() => import("./pages/owner/ListProduct"));

const App = () => {
  const location = useLocation();
  const isOwnerPath = location.pathname.includes("owner");
  return (
    <main className="overflow-hidden text-tertiary">
      {!isOwnerPath && <Header />}
      <Toaster position="bottom-right" />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-primary">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/collection/:productId" element={<ProductDetail />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/owner" element={<Sidebar />}>
            <Route index element={<Dashboard />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="add-category" element={<AddCategory />} />
            <Route path="list-product" element={<ListProduct />} />
            <Route path="edit-product/:productId" element={<AddProduct />} />
          </Route>
        </Routes>
      </Suspense>
      {!isOwnerPath && <Footer />}
    </main>
  );
};

export default App;
