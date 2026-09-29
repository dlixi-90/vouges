import { useAuth, useClerk, useUser } from "@clerk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { getOrderedCartItems, moveCartSize, setCartLineAddedAt } from "../utils/cartOrder";
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
  const [popularProducts, setPopularProducts] = useState([]);
  const [popularProductsLoading, setPopularProductsLoading] = useState(true);
  const [popularProductsError, setPopularProductsError] = useState("");
  const popularRequestRef = useRef(null);
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
  const cartWritesRef = useRef(0);
  const changingSizeRef = useRef(false);
  const [method, setMethod] = useState("COD");
  const [isOwner, setIsOwner] = useState(null);
  const navigate = useNavigate();
  const currency = import.meta.env.VITE_CURRENCY;
  const delivery_charges = 30;

  // Clerk
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { openSignIn } = useClerk();

  const requireCartLogin = useCallback(() => {
    if (user) return true;
    openSignIn();
    return false;
  }, [user, openSignIn]);

  const openCart = () => {
    if (!requireCartLogin()) return false;
    navigate("/cart");
    return true;
  };

  // Get the user Profile
  const getUser = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/users", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setIsOwner(data.role === "owner");
        setCartItems(data.cartData || {});
        setCartAddedAt(data.cartAddedAt || {});
      } else {
        setIsOwner(false);
        toast.error(data.message);
      }
    } catch (error) {
      setIsOwner(false);
      toast.error(error.message);
    }
  }, [getToken]);

  // Fetch all products
  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/products");
      if (data.success) {
        setProducts(data.products);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  const fetchPopularProducts = useCallback(() => {
    if (popularRequestRef.current) return popularRequestRef.current;
    popularRequestRef.current = (async () => {
      try {
        const { data } = await axios.get("/api/products/popular");
        if (!data.success) {
          throw new Error(data.message || "Unable to load popular products");
        }
        setPopularProducts(data.products);
        setPopularProductsError("");
      } catch (error) {
        setPopularProductsError(
          getRequestErrorMessage(error, "Unable to load popular products"),
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
      if (!data.success) throw new Error(data.message || "Unable to load categories");
      setCategories(data.categories);
    } catch (error) {
      setCategoriesError(getRequestErrorMessage(error, "Unable to load categories"));
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

  // Add Product to the cart
  const addToCart = async (
    itemId,
    size,
    quantity = 1,
    onOptimisticSuccess,
  ) => {
    if (!requireCartLogin()) return { success: false, requiresLogin: true };
    if (changingSizeRef.current) {
      toast.error("Please wait for the size change to finish");
      return { success: false };
    }
    const addedQuantity = Number(quantity);

    if (!size) {
      const message = "Please select a size first";
      toast.error(message);
      return { success: false, message };
    }

    if (
      !Number.isInteger(addedQuantity) ||
      addedQuantity < 1 ||
      addedQuantity > MAX_CART_ADD_QUANTITY
    ) {
      const message = `Quantity must be between 1 and ${MAX_CART_ADD_QUANTITY}`;
      toast.error(message);
      return { success: false, message };
    }

    const product = products.find((item) => item._id === itemId);

    if (!product || !product.sizes?.includes(size)) {
      const message = "Product or size not found";
      toast.error(message);
      return { success: false, message };
    }

    if (!isSizeAvailable(product, size)) {
      const message = "This product size is out of stock";
      toast.error(message);
      return { success: false, message };
    }

    const currentQuantity = Number(cartItems[itemId]?.[size] ?? 0);
    const nextQuantity = currentQuantity + addedQuantity;
    const stockQuantity = getSizeQuantity(product, size);

    if (nextQuantity > stockQuantity) {
      const message = `Only ${stockQuantity} items are available for size ${size}`;
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
        throw new Error(data.message || "Unable to add item to cart");
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
        "Unable to add item to cart",
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
      toast.error("Please wait for the size change to finish");
      return { success: false };
    }
    const nextQuantity = Number(quantity);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      const message = "Quantity must be a non-negative integer";
      toast.error(message);
      return { success: false, message };
    }

    const currentQuantity = Number(cartItems[itemId]?.[size] ?? 0);

    if (nextQuantity > 0) {
      const product = products.find((item) => item._id === itemId);

      if (!product || !product.sizes?.includes(size)) {
        const message = "Product or size not found";
        toast.error(message);
        return { success: false, message };
      }

      if (!isSizeAvailable(product, size)) {
        const message = "This product size is out of stock";
        toast.error(message);
        return { success: false, message };
      }

      const stockQuantity = getSizeQuantity(product, size);

      if (nextQuantity > stockQuantity) {
        const message = `Only ${stockQuantity} items are available for size ${size}`;
        toast.error(message);
        return { success: false, message };
      }
    }

    setCartItems((currentCart) =>
      setCartItemQuantity(currentCart, itemId, size, nextQuantity),
    );

    cartWritesRef.current += 1;
    try {
      const { data } = await axios.post(
        "/api/cart/update",
        { itemId, size, quantity: nextQuantity },
        {
          headers: { Authorization: `Bearer ${await getToken()}` },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Unable to update cart");
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
        const savedQuantity = Number(currentCart[itemId]?.[size] ?? 0);

        if (savedQuantity !== nextQuantity) {
          return currentCart;
        }

        return setCartItemQuantity(
          currentCart,
          itemId,
          size,
          currentQuantity,
        );
      });

      const message = getRequestErrorMessage(error, "Unable to update cart");
      toast.error(message);
      return { success: false, message };
    } finally {
      cartWritesRef.current -= 1;
    }
  };

  const changeCartSize = async (itemId, fromSize, toSize) => {
    if (!requireCartLogin()) return { success: false, requiresLogin: true };
    if (changingSizeRef.current || cartWritesRef.current > 0) {
      toast.error("Please wait for the cart update to finish");
      return { success: false };
    }
    const fromQuantity = Number(cartItems[itemId]?.[fromSize] ?? 0);
    const toQuantity = Number(cartItems[itemId]?.[toSize] ?? 0);
    const product = products.find((item) => item._id === itemId);
    if (fromSize === toSize) return { success: true };
    changingSizeRef.current = true;
    try {
      if (!product?.sizes?.includes(toSize) || !isSizeAvailable(product, toSize)) {
        throw new Error("This product size is unavailable");
      }
      let quantity = fromQuantity + toQuantity;
      let addedAt = getOrderedCartItems(cartItems, cartAddedAt)
        .find((item) => item._id === itemId && item.size === fromSize)?.addedAt;
      if (fromQuantity < 1 || !Number.isSafeInteger(quantity)) {
        throw new Error("Invalid cart quantity");
      }
      if (quantity > getSizeQuantity(product, toSize)) {
        throw new Error(`Only ${getSizeQuantity(product, toSize)} items are available for size ${toSize}`);
      }
      if (user) {
        const { data } = await axios.post(
          "/api/cart/change-size",
          { itemId, fromSize, toSize, fromQuantity, toQuantity },
          { headers: { Authorization: `Bearer ${await getToken()}` } },
        );
        if (!data.success) throw new Error(data.message || "Unable to change size");
        quantity = data.quantity;
        addedAt = data.addedAt ?? addedAt;
      }
      setCartItems((current) => moveCartSize(current, itemId, fromSize, toSize, quantity));
      setCartAddedAt((current) => {
        const next = setCartLineAddedAt(current, itemId, toSize, addedAt);
        delete next[itemId][fromSize];
        return next;
      });
      return { success: true };
    } catch (error) {
      if (error.response?.status === 409) await getUser();
      toast.error(getRequestErrorMessage(error, "Unable to change size"));
      return { success: false };
    } finally {
      changingSizeRef.current = false;
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

    if (!user) {
      queueMicrotask(() => {
        setIsOwner(false);
        setCartItems({});
        setCartAddedAt({});
        setProductDrafts({});
      });
      return undefined;
    }

    const timeoutId = window.setTimeout(getUser, 0);

    return () => window.clearTimeout(timeoutId);
  }, [getUser, isLoaded, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchProducts, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchProducts]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchCategories, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCategories]);

  const value = {
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
    categories,
    categoriesLoading,
    categoriesError,
    fetchCategories,
    replaceCategory,
    removeCategory,
    fetchProducts,
    replaceProduct,
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
    requireCartLogin,
    getCartCount,
    updateQuantity,
    changeCartSize,
    getCartAmount,
    isOwner,
    setIsOwner,
    axios,
    getToken,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// This colocated hook keeps the existing public context API stable.
// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);
