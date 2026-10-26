import { useAuth, useClerk, useUser } from "@clerk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { createCartUpdateQueue } from "../utils/cartUpdateQueue";
import { createUserProfileLoader } from "../utils/userProfileLoader";
import { createDashboardCache } from "../utils/dashboardCache";
import { createStoreResources } from "../utils/storeResources";
import { persistCartSizeChange } from "../utils/cartSizeUpdate";
import { getCartItemKey } from "../utils/cartSelection";
import { getOrderedCartItems, setCartLineAddedAt } from "../utils/cartOrder";
import {
  getSizeQuantity,
  isSizeAvailable,
} from "../utils/productStock";

axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

const AppContext = createContext();
const MAX_CART_ADD_QUANTITY = 10;

const setCartItemQuantity = (cartData, itemId, size, quantity) => {
  const nextCartData = structuredClone(cartData);

  if (quantity <= 0) {
    if (!nextCartData[itemId]) return nextCartData;

    delete nextCartData[itemId][size];

    if (Object.keys(nextCartData[itemId]).length === 0) {
      delete nextCartData[itemId];
    }

    return nextCartData;
  }

  nextCartData[itemId] = nextCartData[itemId] || {};
  nextCartData[itemId][size] = quantity;

  return nextCartData;
};

const getRequestErrorMessage = (error, fallbackMessage) => {
  return error.response?.data?.message || error.message || fallbackMessage;
};

export const AppContextProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [dashboardCache] = useState(() => createDashboardCache());
  const [popularProducts, setPopularProducts] = useState([]);
  const [popularProductsLoading, setPopularProductsLoading] = useState(true);
  const [popularProductsError, setPopularProductsError] = useState("");
  const popularRequestRef = useRef(null);
  const productsRequestRef = useRef(null);
  const [categories, setCategories] = useState([]);
  // Preserve File objects as well as text while navigating between admin forms.
  const [productDrafts, setProductDrafts] = useState({});
  const saveProductDraft = useCallback((key, draft) => {
    setProductDrafts((current) => ({ ...current, [key]: draft }));
  }, []);
  const clearProductDraft = useCallback((key) => {
    setProductDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState({});
  const [cartAddedAt, setCartAddedAt] = useState({});
  const [cartDrawer, setCartDrawer] = useState(null);
  const [pendingCartKeys, setPendingCartKeys] = useState([]);
  const [quantityQueue] = useState(() => createCartUpdateQueue({ onPendingChange: setPendingCartKeys }));
  const cartWritesRef = useRef(0);
  const changingSizeRef = useRef(false);
  const sizeRequestRef = useRef(null);
  const [method, setMethod] = useState("COD");
  const [profileResult, setProfileResult] = useState({ userId: null, role: null, error: "" });
  const navigate = useNavigate();
  const { pathname, key: locationKey } = useLocation();
  const isCartPage = Boolean(useMatch("/cart"));
  const needsCatalog = !["/owner", "/owner/messages", "/membership"].includes(pathname.replace(/\/+$/, ""))
    || cartDrawer?.locationKey === locationKey;
  const needsCategories = needsCatalog || !pathname.startsWith("/owner");
  const currency = import.meta.env.VITE_CURRENCY;
  const delivery_charges = 30;

  // Clerk
  const { user } = useUser();
  const { getToken, userId: authUserId, isLoaded } = useAuth();
  const storeResources = useMemo(() => createStoreResources({ axios, userId: authUserId, getToken }), [authUserId, getToken]);
  useEffect(() => () => storeResources.clear(), [storeResources]);
  const isOwner = !isLoaded ? null : !authUserId ? false
    : profileResult.userId === authUserId ? profileResult.role : null;
  const profileError = profileResult.userId === authUserId ? profileResult.error : "";
  const { openSignIn } = useClerk();

  useEffect(() => () => dashboardCache.clear(), [dashboardCache, authUserId, isOwner]);
  useEffect(() => () => setCartDrawer((current) => current?.locationKey === locationKey ? null : current), [locationKey]);

  useEffect(() => () => {
    quantityQueue.cancelAll();
    setCartDrawer(null);
  }, [quantityQueue, user?.id]);
  useEffect(() => () => {
    sizeRequestRef.current?.abort();
    sizeRequestRef.current = null;
    changingSizeRef.current = false;
  }, [authUserId]);

  const requireCartLogin = useCallback(() => {
    if (user) return true;
    openSignIn();
    return false;
  }, [user, openSignIn]);

  const openCart = () => {
    if (isCartPage) return false;
    if (!requireCartLogin()) return false;
    setCartDrawer({ userId: user.id, locationKey });
    return true;
  };
  const closeCart = useCallback(() => setCartDrawer(null), []);
  const isCartOpen = Boolean(!isCartPage && user && cartDrawer?.userId === user.id && cartDrawer?.locationKey === locationKey);

  const [profileLoader] = useState(() => createUserProfileLoader({
    request: async (_userId, signal, readToken) => {
      const token = await readToken();
      signal.throwIfAborted();
      const { data } = await axios.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
        timeout: 15000,
      });
      if (!data.success) throw new Error(data.message || "Không thể tải thông tin người dùng");
      return data;
    },
    onSuccess: (userId, data) => {
      setProfileResult({ userId, role: data.role === "owner", error: "" });
      setCartItems(data.cartData || {});
      setCartAddedAt(data.cartAddedAt || {});
    },
    onError: (userId, error) => {
      const message = getRequestErrorMessage(error, "Không thể xác minh tài khoản");
      setProfileResult({ userId, role: null, error: message });
      toast.error(message);
    },
  }));
  const getUser = useCallback(() => profileLoader.load(authUserId, getToken), [profileLoader, authUserId, getToken]);

  // Fetch all products
  const fetchProducts = useCallback(() => {
    if (productsRequestRef.current) return productsRequestRef.current;
    productsRequestRef.current = (async () => {
      try {
        const { data } = await axios.get("/api/products");
        if (data.success) {
          setProducts(data.products);
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        setProductsLoading(false);
        productsRequestRef.current = null;
      }
    })();
    return productsRequestRef.current;
  }, []);

  const fetchPopularProducts = useCallback(() => {
    if (popularRequestRef.current) return popularRequestRef.current;
    popularRequestRef.current = (async () => {
      try {
        const { data } = await axios.get("/api/products/popular");
        if (!data.success) {
          throw new Error(data.message || "Không thể tải sản phẩm bán chạy");
        }
        setPopularProducts(data.products);
        setPopularProductsError("");
      } catch (error) {
        setPopularProductsError(
          getRequestErrorMessage(error, "Không thể tải sản phẩm bán chạy"),
        );
      } finally {
        setPopularProductsLoading(false);
        popularRequestRef.current = null;
      }
    })();
    return popularRequestRef.current;
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const { data } = await axios.get("/api/categories");
      if (!data.success) throw new Error(data.message || "Không thể tải danh mục");
      setCategories(data.categories);
    } catch (error) {
      setCategoriesError(getRequestErrorMessage(error, "Không thể tải danh mục"));
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const replaceCategory = (category) => {
    setCategories((current) => {
      const exists = current.some((item) => item._id === category._id);
      return exists
        ? current.map((item) => item._id === category._id ? category : item)
        : [category, ...current];
    });
  };

  const removeCategory = (categoryId) => {
    setCategories((current) => current.filter((category) => category._id !== categoryId));
  };

  // Replace only the product returned by an update API.
  // This avoids fetching the complete catalog after every stock toggle.
  const replaceProduct = (updatedProduct) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product._id === updatedProduct._id ? updatedProduct : product,
      ),
    );
  };

  const applyStockUpdates = useCallback((updates = []) => {
    const byId = new Map(updates.map((item) => [item._id, item]));
    setProducts((current) => current.map((product) => byId.has(product._id)
      ? { ...product, ...byId.get(product._id) } : product));
  }, []);

  // Add Product to the cart
  const addToCart = async (
    itemId,
    size,
    quantity = 1,
    onOptimisticSuccess,
  ) => {
    if (!requireCartLogin()) return { success: false, requiresLogin: true };
    if (changingSizeRef.current || quantityQueue.hasPending()) {
      toast.error("Vui lòng chờ giỏ hàng cập nhật xong");
      return { success: false };
    }
    const addedQuantity = Number(quantity);

    if (!size) {
      const message = "Vui lòng chọn dung tích trước";
      toast.error(message);
      return { success: false, message };
    }

    if (
      !Number.isInteger(addedQuantity) ||
      addedQuantity < 1 ||
      addedQuantity > MAX_CART_ADD_QUANTITY
    ) {
      const message = `Số lượng phải từ 1 đến ${MAX_CART_ADD_QUANTITY}`;
      toast.error(message);
      return { success: false, message };
    }

    const product = products.find((item) => item._id === itemId);

    if (!product || !product.sizes?.includes(size)) {
      const message = "Không tìm thấy sản phẩm hoặc dung tích";
      toast.error(message);
      return { success: false, message };
    }

    if (!isSizeAvailable(product, size)) {
      const message = "Sản phẩm có dung tích này đã hết hàng";
      toast.error(message);
      return { success: false, message };
    }

    const currentQuantity = Number(cartItems[itemId]?.[size] ?? 0);
    const nextQuantity = currentQuantity + addedQuantity;
    const stockQuantity = getSizeQuantity(product, size);

    if (nextQuantity > stockQuantity) {
      const message = `Chỉ còn ${stockQuantity} sản phẩm có dung tích ${size}`;
      toast.error(message);
      return { success: false, message };
    }

    setCartItems((currentCart) =>
      setCartItemQuantity(currentCart, itemId, size, nextQuantity),
    );
    const addedAt = currentQuantity > 0
      ? cartAddedAt[itemId]?.[size]
      : Math.max(Date.now(), ...Object.values(cartAddedAt).flatMap((sizes) => Object.values(sizes).map((value) => Number(value) + 1)));
    setCartAddedAt((current) => setCartLineAddedAt(current, itemId, size, addedAt));
    onOptimisticSuccess?.();

    cartWritesRef.current += 1;
    try {
      const { data } = await axios.post(
        "/api/cart/add",
        { itemId, size, quantity: addedQuantity },
        {
          headers: { Authorization: `Bearer ${await getToken()}` },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Không thể thêm sản phẩm vào giỏ hàng");
      }
      if (data.addedAt) {
        setCartAddedAt((current) => setCartLineAddedAt(current, itemId, size, data.addedAt));
      }

      setCartItems((currentCart) =>
        setCartItemQuantity(
          currentCart,
          itemId,
          size,
          Number(data.quantity ?? nextQuantity),
        ),
      );

      return {
        success: true,
        quantity: Number(data.quantity ?? nextQuantity),
      };
    } catch (error) {
      setCartItems((currentCart) => {
        if (currentCart[itemId]?.[size] !== nextQuantity) {
          return currentCart;
        }

        return setCartItemQuantity(
          currentCart,
          itemId,
          size,
          currentQuantity,
        );
      });

      const message = getRequestErrorMessage(
        error,
        "Không thể thêm sản phẩm vào giỏ hàng",
      );
      toast.error(message);
      return { success: false, message };
    } finally {
      cartWritesRef.current -= 1;
    }
  };

  // Get Cart Count
  const getCartCount = () => {
    let count = 0;
    for (const itemId in cartItems) {
      for (const size in cartItems[itemId]) {
        count += cartItems[itemId][size];
      }
    }
    return count;
  };

  // Update Cart Quantity
  const updateQuantity = async (itemId, size, quantity) => {
    if (!requireCartLogin()) return { success: false, requiresLogin: true };
    if (changingSizeRef.current) {
      toast.error("Vui lòng chờ thay đổi dung tích hoàn tất");
      return { success: false };
    }
    const nextQuantity = Number(quantity);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      const message = "Số lượng phải là số nguyên không âm";
      toast.error(message);
      return { success: false, message };
    }

    const currentQuantity = Number(cartItems[itemId]?.[size] ?? 0);

    if (nextQuantity > 0) {
      const product = products.find((item) => item._id === itemId);

      if (!product || !product.sizes?.includes(size)) {
        const message = "Không tìm thấy sản phẩm hoặc dung tích";
        toast.error(message);
        return { success: false, message };
      }

      if (!isSizeAvailable(product, size)) {
        const message = "Sản phẩm có dung tích này đã hết hàng";
        toast.error(message);
        return { success: false, message };
      }

      const stockQuantity = getSizeQuantity(product, size);

      if (nextQuantity > stockQuantity) {
        const message = `Chỉ còn ${stockQuantity} sản phẩm có dung tích ${size}`;
        toast.error(message);
        return { success: false, message };
      }
    }

    if (cartWritesRef.current > 0) {
      return { success: false, message: "Vui lòng chờ giỏ hàng cập nhật xong" };
    }

    return quantityQueue.enqueue({
      key: getCartItemKey(itemId, size),
      quantity: nextQuantity,
      initialQuantity: currentQuantity,
      onChange: (savedQuantity) => setCartItems((current) => setCartItemQuantity(current, itemId, size, savedQuantity)),
      onAcknowledged: (data) => {
        if (data.addedAt) setCartAddedAt((current) => setCartLineAddedAt(current, itemId, size, data.addedAt));
      },
      onError: (error) => toast.error(getRequestErrorMessage(error, "Không thể cập nhật giỏ hàng")),
      send: async (savedQuantity, signal) => {
        const token = await getToken();
        signal.throwIfAborted();
        const { data } = await axios.post(
          "/api/cart/update",
          { itemId, size, quantity: savedQuantity },
          { headers: { Authorization: `Bearer ${token}` }, signal, timeout: 15000 },
        );
        if (!data.success) throw new Error(data.message || "Không thể cập nhật giỏ hàng");
        return data;
      },
    });
  };

  const changeCartSize = async (itemId, fromSize, toSize) => {
    if (!requireCartLogin()) return { success: false, requiresLogin: true };
    if (changingSizeRef.current || cartWritesRef.current > 0 || quantityQueue.hasPending()) {
      toast.error("Vui lòng chờ giỏ hàng cập nhật xong");
      return { success: false };
    }
    const fromQuantity = Number(cartItems[itemId]?.[fromSize] ?? 0);
    const toQuantity = Number(cartItems[itemId]?.[toSize] ?? 0);
    const product = products.find((item) => item._id === itemId);
    if (fromSize === toSize) return { success: true };
    changingSizeRef.current = true;
    const controller = new AbortController();
    sizeRequestRef.current = controller;
    try {
      if (!product?.sizes?.includes(toSize) || !isSizeAvailable(product, toSize)) {
        throw new Error("Dung tích này hiện không có sẵn");
      }
      const quantity = fromQuantity + toQuantity;
      const addedAt = getOrderedCartItems(cartItems, cartAddedAt)
        .find((item) => item._id === itemId && item.size === fromSize)?.addedAt;
      if (fromQuantity < 1 || !Number.isSafeInteger(quantity)) {
        throw new Error("Số lượng trong giỏ hàng không hợp lệ");
      }
      if (quantity > getSizeQuantity(product, toSize)) {
        throw new Error(`Chỉ còn ${getSizeQuantity(product, toSize)} sản phẩm có dung tích ${toSize}`);
      }
      await persistCartSizeChange({
        itemId, fromSize, toSize, cartItems, cartAddedAt, addedAt,
        signal: controller.signal,
        apply: ({ sizes, timestamps }) => {
          setCartItems((current) => ({ ...current, [itemId]: sizes }));
          setCartAddedAt((current) => ({ ...current, [itemId]: timestamps }));
        },
        send: async () => {
          const token = await getToken();
          controller.signal.throwIfAborted();
          const { data } = await axios.post(
            "/api/cart/change-size",
            { itemId, fromSize, toSize, fromQuantity, toQuantity },
            { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, timeout: 15000 },
          );
          if (!data.success) throw new Error(data.message || "Không thể thay đổi dung tích");
          return data;
        },
      });
      return { success: true };
    } catch (error) {
      if (controller.signal.aborted) return { success: false, cancelled: true };
      if (error.response?.status === 409) await getUser();
      toast.error(getRequestErrorMessage(error, "Không thể thay đổi dung tích"));
      return { success: false };
    } finally {
      if (sizeRequestRef.current === controller) {
        sizeRequestRef.current = null;
        changingSizeRef.current = false;
      }
    }
  };

  // Get Cart Amount
  const getCartAmount = () => {
    let total = 0;
    for (const itemId in cartItems) {
      const product = products.find((p) => p._id === itemId);
      if (!product) continue;
      for (const size in cartItems[itemId]) {
        total += product.price[size] * cartItems[itemId][size];
      }
    }
    return total;
  };

  useEffect(() => {
    if (!isLoaded) return;

    if (!authUserId) {
      queueMicrotask(() => {
        setProfileResult({ userId: null, role: null, error: "" });
        setCartItems({});
        setCartAddedAt({});
        setProductDrafts({});
      });
      return undefined;
    }

    const timeoutId = window.setTimeout(getUser, 0);

    return () => {
      window.clearTimeout(timeoutId);
      profileLoader.cancel();
    };
  }, [getUser, isLoaded, authUserId, profileLoader]);

  useEffect(() => {
    if (!needsCatalog) return undefined;
    const timeoutId = window.setTimeout(fetchProducts, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchProducts, needsCatalog]);

  useEffect(() => {
    if (!needsCategories) return undefined;
    const timeoutId = window.setTimeout(fetchCategories, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCategories, needsCategories]);

  const value = {
    storeResources,
    dashboardCache,
    authenticatedUserId: authUserId,
    productDrafts,
    saveProductDraft,
    clearProductDraft,
    popularProducts,
    popularProductsLoading,
    popularProductsError,
    fetchPopularProducts,
    navigate,
    user,
    products,
    productsLoading,
    categories,
    categoriesLoading,
    categoriesError,
    fetchCategories,
    replaceCategory,
    removeCategory,
    fetchProducts,
    replaceProduct,
    applyStockUpdates,
    currency,
    searchQuery,
    setSearchQuery,
    cartItems,
    cartAddedAt,
    setCartItems,
    method,
    setMethod,
    delivery_charges,
    addToCart,
    openCart,
    isCartPage,
    closeCart,
    isCartOpen,
    requireCartLogin,
    getCartCount,
    updateQuantity,
    pendingCartKeys,
    hasPendingCartUpdates: () => quantityQueue.hasPending() || cartWritesRef.current > 0 || changingSizeRef.current,
    changeCartSize,
    getCartAmount,
    isOwner,
    profileError,
    retryUserProfile: getUser,
    axios,
    getToken,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// This colocated hook keeps the existing public context API stable.
// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);
