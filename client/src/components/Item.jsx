import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import { formatThousandsVnd } from "../utils/money";
import ProductImage from "./ProductImage";

const Item = ({ product, collectionLayout = false }) => {
  const { navigate, currency } = useAppContext();
  const [hovered, setHovered] = useState(false);
  const availableSizes = getAvailableSizes(product);
  const isAvailable = availableSizes.length > 0;
  const size = availableSizes[0] ?? null;
  const colors = ["#f2f2f2", "#f6f9f6", "#f6f8fe"];
  const bgcolor =
    colors[parseInt(product._id?.slice(-4) || "0", 16) % colors.length];

  const displayedPrice = size
    ? product.price?.[size]
    : Math.min(...Object.values(product.price ?? {}).map(Number));

  return (
    <article
      className={`group relative overflow-hidden ${
        collectionLayout ? "rounded-xl" : ""
      }`}
      style={collectionLayout ? { backgroundColor: bgcolor } : undefined}
    >
      {/* Image */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flexCenter group relative h-[182px] w-full transition-all duration-300 ${
          collectionLayout ? "" : "rounded-xl"
        }`}
        style={collectionLayout ? undefined : { backgroundColor: bgcolor }}
      >
        <ProductImage
          src={
            product.images.length > 1 && hovered
              ? product.images[1]
              : product.images[0]
          }
          alt=""
          height={144}
          width={144}
        />
        {!collectionLayout && (
          <div className="absolute bottom-1 left-1 right-1 hidden group-hover:block">
            <button
              onClick={() => {
                navigate(`/collection/${product._id}`);
                scrollTo(0, 0);
              }}
              className="btn-secondary w-full !px-0 !py-2 !text-xs"
            >
              View
            </button>
          </div>
        )}
        <p className="absolute right-2 top-2 rounded-full bg-white/50 px-5 ring-1 ring-slate-900/10">
          {product.type}
        </p>
        {!isAvailable && (
          <p className="absolute left-2 top-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
            Out of stock
          </p>
        )}
      </div>

      {/* Info */}
      <div
        className={
          collectionLayout
            ? "px-3 pb-4 pt-3 text-center transition duration-300 group-hover:opacity-20 group-hover:blur-[1px]"
            : "p-1 pt-3"
        }
      >
        {collectionLayout ? (
          <>
            <h5 className="line-clamp-1 text-[10px] font-normal uppercase sm:text-xs">
              {product.title}
            </h5>
            <p className="mt-2 font-normal">
              {formatThousandsVnd(displayedPrice, currency)}
            </p>
          </>
        ) : (
          <>
            <div className="flexBetween">
              <h5 className="h5 line-clamp-1 uppercase">{product.title}</h5>
              <p className="font-semibold">
                {formatThousandsVnd(displayedPrice, currency)}
              </p>
            </div>
            <p className="line-clamp-2 pt-1">{product.description}</p>
          </>
        )}
      </div>

      {collectionLayout && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[42%] items-end bg-white/0 p-3 transition-colors duration-300 group-hover:bg-white/30">
          <button
            type="button"
            onClick={() => {
              navigate(`/collection/${product._id}`);
              scrollTo(0, 0);
            }}
            className="pointer-events-auto w-full translate-y-5 rounded-full bg-white px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-[#343434] opacity-0 shadow-lg transition duration-300 hover:bg-[#f5f5f2] group-hover:translate-y-0 group-hover:opacity-100"
          >
            View product
          </button>
        </div>
      )}
    </article>
  );
};

export default Item;
