import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { useParams } from "react-router-dom";
import ProductDescription from "../components/ProductDescription";
import ProductFeatures from "../components/ProductFeatures";
import PairWithProducts from "../components/PairWithProducts";
import RelatedProducts from "../components/RelatedProducts";
import { useAppContext } from "../context/AppContext";
import {
  getAvailableSizes,
  getSizeQuantity,
  hasAnyAvailableSize,
  isSizeAvailable,
} from "../utils/productStock";
import { FREE_SHIPPING_THRESHOLD } from "../utils/orderPricing";
import { formatThousandsVnd } from "../utils/money";
import { flyProductToCart } from "../utils/cartAnimation";

const MAX_QUANTITY_PER_ADD = 10;

const ProductDetail = () => {
  const { products, currency, addToCart, requireCartLogin } = useAppContext();
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addStatus, setAddStatus] = useState("idle");
  const productImageRef = useRef(null);
  const addedResetTimerRef = useRef(null);

  const { productId } = useParams();
  const product = products.find((item) => item._id === productId);
  const productAvailable = product ? hasAnyAvailableSize(product) : false;
  const availableSizes = product ? getAvailableSizes(product) : [];
  const size = availableSizes.includes(selectedSize)
    ? selectedSize
    : (availableSizes[0] ?? null);
  const image = product?.images?.includes(selectedImage)
    ? selectedImage
    : (product?.images?.[0] ?? null);
  const selectedSizeAvailable = product
    ? isSizeAvailable(product, size)
    : false;
  const selectedStock = product ? getSizeQuantity(product, size) : 0;
  const maxQuantity = Math.max(
    1,
    Math.min(MAX_QUANTITY_PER_ADD, selectedStock),
  );
  const safeQuantity = Math.min(quantity, maxQuantity);

  const selectSize = (nextSize) => {
    setSelectedSize(nextSize);
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (!requireCartLogin()) return;
    if (addStatus === "adding") return;

    setAddStatus("adding");
    const showAddedFeedback = () => {
      flyProductToCart({
        imageSrc: image,
        sourceElement: productImageRef.current,
      });
      setAddStatus("added");
      window.clearTimeout(addedResetTimerRef.current);
      addedResetTimerRef.current = window.setTimeout(
        () => setAddStatus("idle"),
        1500,
      );
    };
    const result = await addToCart(
      product._id,
      size,
      safeQuantity,
      showAddedFeedback,
    );

    if (!result.success) {
      setAddStatus("idle");
    }
  };

  useEffect(
    () => () => window.clearTimeout(addedResetTimerRef.current),
    [],
  );

  if (!product) return null;

  return (
    <div className="max-padd-container pb-14 pt-24 sm:pt-28">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,720px)_minmax(390px,1fr)] xl:gap-14">
        <section
          className="w-full max-w-[720px] lg:sticky lg:top-24"
          aria-label="Product gallery"
        >
          <div className="flex gap-2 sm:gap-3">
            <div className="flex w-16 shrink-0 flex-col gap-2 sm:w-[72px]">
              {product.images.map((item, index) => (
                <button
                  type="button"
                  key={`${item}-${index}`}
                  onClick={() => setSelectedImage(item)}
                  aria-label={`View product image ${index + 1}`}
                  className={`aspect-square overflow-hidden rounded-lg bg-[#f5f5f0] p-1.5 transition ${
                    item === image
                      ? "ring-1 ring-[#343434]"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={item}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>

            <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[#f5f5f0] p-8 sm:min-h-[420px] sm:p-12 lg:min-h-[480px] lg:max-h-[520px]">
              <img
                ref={productImageRef}
                src={image}
                alt={product.title}
                className="h-auto max-h-[470px] w-auto max-w-[82%] object-contain"
              />
            </div>
          </div>
        </section>

        <section
          className="min-w-0 py-1 lg:py-2"
          aria-label="Product information"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#858b87]">
            {product.category} · {product.type.replaceAll("-", " ")}
          </p>
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-[#303030] sm:text-3xl">
            {product.title}
          </h1>
          <p className="mt-2 text-2xl text-[#737373]">
            {formatThousandsVnd(size ? product.price?.[size] : 0, currency)}
          </p>

          <div className="mt-6 border-t border-[#dededb] pt-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4c4c4c]">
                Select size
              </p>
              {size && (
                <span className="text-xs text-[#858585]">
                  {selectedStock} in stock
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {(product.sizes ?? []).map((item) => {
                const available = isSizeAvailable(product, item);

                return (
                  <button
                    key={item}
                    type="button"
                    disabled={!available}
                    onClick={() => selectSize(item)}
                    className={`min-w-20 rounded-lg border px-4 py-2.5 text-xs transition ${
                      item === size
                        ? "border-[#343434] bg-[#343434] text-white"
                        : available
                          ? "border-[#d8d8d4] bg-white hover:border-[#777]"
                          : "cursor-not-allowed border-[#e7e7e4] bg-[#f5f5f2] text-[#b1b1ad] line-through"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {!productAvailable && (
              <p className="mt-3 text-sm font-medium text-red-500">
                Out of stock
              </p>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <div className="flex h-12 shrink-0 items-center overflow-hidden rounded-lg border border-[#cfcfcb]">
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) => Math.max(1, current - 1))
                }
                disabled={!selectedSizeAvailable || safeQuantity <= 1}
                className="flex h-full w-10 items-center justify-center disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-7 text-center text-sm" aria-live="polite">
                {safeQuantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) => Math.min(maxQuantity, current + 1))
                }
                disabled={!selectedSizeAvailable || safeQuantity >= maxQuantity}
                className="flex h-full w-10 items-center justify-center disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!selectedSizeAvailable || addStatus === "adding"}
              className={`h-12 flex-1 rounded-lg px-5 text-xs font-medium uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${
                addStatus === "added"
                  ? "bg-emerald-600"
                  : "bg-[#242424] hover:bg-black"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                {addStatus === "added" && <Check size={16} />}
                {addStatus === "adding"
                  ? "Adding..."
                  : addStatus === "added"
                    ? "Added!"
                    : "Add to cart"}
              </span>
            </button>
          </div>

          <ProductDescription product={product} selectedSize={size} />
          <PairWithProducts product={product} productId={productId} />

          <div className="mt-5 grid gap-2 text-xs text-[#70756f] sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Truck size={16} />
              Free delivery from{" "}
              {(FREE_SHIPPING_THRESHOLD * 1000).toLocaleString("vi-VN")}₫
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <ShieldCheck size={16} />
              Authentic products
            </div>
          </div>
        </section>
      </div>

      <ProductFeatures />
      <RelatedProducts product={product} productId={productId} />
    </div>
  );
};

export default ProductDetail;
