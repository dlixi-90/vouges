import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShieldCheck, Star, Truck } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import ProductDetailTabs from "../components/ProductDetailTabs";
import ProductFeatures from "../components/ProductFeatures";
import RelatedProducts from "../components/RelatedProducts";
import { useAppContext } from "../context/AppContext";
import {
  getAvailableSizes,
  getSizeQuantity,
  getPurchaseLimit,
  isSourceInventory,
  hasAnyAvailableSize,
  isSizeAvailable,
} from "../utils/productStock";
import { FREE_SHIPPING_THRESHOLD } from "../utils/orderPricing";
import { formatVnd } from "../utils/money";
import { flyProductToCart } from "../utils/cartAnimation";
import ProductImage from "../components/ProductImage";
import ProductFacts from "../components/ProductFacts";
import FragranceCharts from "../components/FragranceCharts";
import { getDetailGallery } from "../utils/productImage";

const MAX_QUANTITY_PER_ADD = 10;

const RatingStars = ({ average }) => (
  <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((index) => (
      <span key={index} className="relative block h-[15px] w-[15px]">
        <Star size={15} className="fill-gray-200 text-gray-200" />
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, average - index)) * 100}%` }}>
          <Star size={15} className="fill-amber-400 text-amber-400" />
        </span>
      </span>
    ))}
  </span>
);

const ProductDetail = () => {
  const { products, currency, addToCart, requireCartLogin, storeResources, axios } = useAppContext();
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addStatus, setAddStatus] = useState("idle");
  const [reviewSummary, setReviewSummary] = useState(null);
  const [tabSelection, setTabSelection] = useState(null);
  const productImageRef = useRef(null);
  const addedResetTimerRef = useRef(null);

  const { productId } = useParams();
  const { hash } = useLocation();
  const activeTab = tabSelection?.productId === productId ? tabSelection.tab : hash === "#reviews" ? "reviews" : "description";
  const selectTab = tab => setTabSelection({ productId, tab });
  const openReviews = event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectTab("reviews");
    window.requestAnimationFrame(() => document.getElementById("reviews")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
  };
  useEffect(() => {
    const controller = new AbortController();
    axios.get("/api/products/single", {params:{productId},signal:controller.signal}).then(({data})=>{
      if (!data.success) throw new Error(data.message);
      setDetail(data.product);
    }).catch(error=>{if(!controller.signal.aborted)setDetailError({ productId, message: error.response?.data?.message||"Không thể tải chi tiết sản phẩm." });});
    return ()=>controller.abort();
  }, [axios, productId]);
  const reviewStats = reviewSummary?.productId === productId ? reviewSummary : storeResources.peekReviews(productId);
  // Start independently of the catalog request, including on direct links.
  useEffect(() => {
    void storeResources.loadReviews(productId).catch(() => {});
    void storeResources.loadOwnReview(productId).catch(() => {});
  }, [storeResources, productId]);
  const product = detail?._id === productId ? detail : products.find((item) => item._id === productId);
  const productAvailable = product ? hasAnyAvailableSize(product) : false;
  const availableSizes = product ? getAvailableSizes(product) : [];
  const size = product?.sizes?.includes(selectedSize)
    ? selectedSize
    : (availableSizes[0] ?? product?.sizes?.[0] ?? null);
  const sizeImage = product?.sizeImages?.[size];
  const gallery = getDetailGallery(product, size);
  const image = selectedImage?.productId === productId && selectedImage?.size === size && gallery.includes(selectedImage.url)
    ? selectedImage.url
    : (gallery[0] || null);
  const selectedSizeAvailable = product
    ? isSizeAvailable(product, size)
    : false;
  const selectedStock = product ? getSizeQuantity(product, size) : 0;
  const maxQuantity = Math.max(
    1,
    Math.min(MAX_QUANTITY_PER_ADD, product ? getPurchaseLimit(product, size) : 0),
  );
  const safeQuantity = Math.min(quantity, maxQuantity);

  const selectSize = (nextSize) => {
    setSelectedSize(nextSize);
    setSelectedImage(null);
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

  useEffect(() => {
    if (!product || hash !== "#reviews") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("reviews")?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [hash, product]);

  const loadError = detailError?.productId === productId ? detailError.message : "";
  if (!product) return <div className="max-padd-container py-32" role={loadError?"alert":"status"}>{loadError||"Đang tải sản phẩm…"}</div>;

  return (
    <div className="net-product-detail max-padd-container pb-14 pt-24 sm:pt-28">
      <div className="product-detail-overview">
        <div className="product-detail-visual-column">
        <section
          className="product-detail-gallery"
          aria-label="Thư viện ảnh sản phẩm"
        >
          <div className="product-detail-gallery-layout">
            {gallery.length > 0 && <div className="product-detail-thumbnails">
              {gallery.map((item, index) => (
                <button
                  type="button"
                  key={`${item}-${index}`}
                  onClick={() => setSelectedImage({ productId, size, url: item })}
                  aria-pressed={item === image}
                  aria-label={`Xem ảnh sản phẩm ${index + 1}`}
                  className={`aspect-square overflow-hidden rounded-lg bg-[#f5f5f0] p-1.5 transition ${
                    item === image
                      ? "ring-1 ring-[#343434]"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <ProductImage
                    src={item}
                    imageWidth={160}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>}

            <div className="product-detail-gallery-stage">
              {image ? <ProductImage
                ref={productImageRef}
                src={image}
                imageWidth={960}
                loading="eager"
                fetchPriority="high"
                alt={`${product.title}${sizeImage && image === sizeImage ? ` - ${size}` : ""}`}
                className="product-detail-main-image"
              /> : <p role="status" className="text-center text-sm text-gray-500">Chưa có ảnh chi tiết cho sản phẩm này.</p>}
            </div>
          </div>
        </section>
        </div>

        <section
          className="product-detail-info min-w-0 py-1 lg:py-2"
          aria-label="Thông tin sản phẩm"
        >
          <div className="product-detail-buying">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#858b87]">
            {product.category} · {product.type.replaceAll("-", " ")}
          </p>
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-[#303030] sm:text-3xl">
            {product.title}
          </h1>
          <p className="mt-2 text-2xl text-[#737373]">
            {formatVnd(size ? product.price?.[size] : 0, currency)}
          </p>
          <a href="#reviews" onClick={openReviews}
            aria-label={reviewStats && !reviewStats.error
              ? reviewStats.count > 0 ? `${reviewStats.average.toFixed(1)} trên 5 sao, ${reviewStats.count} đánh giá. Xem hoặc viết đánh giá sản phẩm.` : "Chưa có đánh giá. Viết đánh giá sản phẩm."
              : "Xem hoặc viết đánh giá sản phẩm"}
            className="product-detail-review-link mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md py-1 text-sm text-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
            {reviewStats && !reviewStats.error ? (
              <>
                <span className="border-b border-current leading-5">{reviewStats.count > 0 ? reviewStats.average.toFixed(1) : "Chưa có đánh giá"}</span>
                <RatingStars average={reviewStats.average} />
                <span className="inline-flex items-center gap-1.5 border-l border-gray-200 pl-3">
                  <span className="border-b border-current leading-5">{reviewStats.count.toLocaleString("vi-VN")}</span>
                  <span className="text-gray-500">Đánh giá</span>
                </span>
              </>
            ) : <span className="text-gray-500">{reviewStats?.error ? "Xem đánh giá sản phẩm" : "Đang tải đánh giá…"}</span>}
          </a>

          <div className="product-detail-size-options mt-6 border-t border-[#dededb] pt-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4c4c4c]">
                Chọn dung tích
              </p>
              {size && (
                <span className="text-xs text-[#858585]">
                  {isSourceInventory(product) ? (selectedSizeAvailable ? "Còn hàng" : "Hết hàng") : `${selectedStock} sản phẩm còn trong kho`}
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
                Hết hàng
              </p>
            )}
          </div>

          <div className="product-detail-purchase-actions mt-5 flex gap-2">
            <div className="flex h-12 shrink-0 items-center overflow-hidden rounded-lg border border-[#cfcfcb]">
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) => Math.max(1, current - 1))
                }
                disabled={!selectedSizeAvailable || safeQuantity <= 1}
                className="flex h-full w-10 items-center justify-center disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Giảm số lượng"
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
                aria-label="Tăng số lượng"
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
                  ? "Đang thêm…"
                  : addStatus === "added"
                    ? "Đã thêm!"
                    : "Thêm vào giỏ hàng"}
              </span>
            </button>
          </div>
          </div>

          <div className="product-detail-summary">
            <ProductFacts product={product} />
          </div>
        </section>
      </div>

      <section className="product-detail-experience" aria-label="Lưu hương, tỏa hương và thời điểm sử dụng">
        <FragranceCharts fragrance={product.fragrance || {}} />
      </section>

      <div className="product-detail-assurances mt-5 grid gap-2 text-xs text-[#70756f] sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Truck size={16} />
          Miễn phí giao hàng cho đơn từ{" "}
          {(FREE_SHIPPING_THRESHOLD).toLocaleString("vi-VN")}₫
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <ShieldCheck size={16} />
          Sản phẩm chính hãng
        </div>
      </div>

      <ProductDetailTabs key={productId} product={product} activeTab={activeTab} onTabChange={selectTab} reviewStats={reviewStats} onSummaryChange={setReviewSummary} />
      <RelatedProducts product={product} productId={productId} />
      <ProductFeatures />
    </div>
  );
};

export default ProductDetail;
