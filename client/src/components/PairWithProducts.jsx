import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import { formatVnd } from "../utils/money";

const COMPLEMENTARY_TYPES = {
  Cleanser: ["Serum", "Lotion", "Oil"],
  Serum: ["Cleanser", "Lotion", "Oil"],
  Shampoo: ["Oil", "Serum"],
  Oil: ["Shampoo", "Serum"],
  Lotion: ["Cleanser", "Hand-Wash", "Body-Spray"],
  "Hand-Wash": ["Lotion"],
  "Body-Spray": ["Lotion", "Perfume"],
  Perfume: ["Body-Spray", "Lotion"],
  "Lip-Product": ["Cleanser", "Serum"],
};

const PairWithProducts = ({ product, productId }) => {
  const { products, currency, navigate } = useAppContext();

  const pairedProducts = useMemo(() => {
    const preferredTypes = COMPLEMENTARY_TYPES[product.type] ?? [];

    return products
      .filter(
        (item) =>
          item._id !== productId && getAvailableSizes(item).length > 0,
      )
      .map((item, index) => ({
        item,
        index,
        score:
          (item.category === product.category ? 4 : 0) +
          (preferredTypes.includes(item.type) ? 3 : 0) +
          (item.popular ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2)
      .map(({ item }) => item);
  }, [product.category, product.type, productId, products]);

  if (pairedProducts.length === 0) return null;

  const viewProduct = (id) => {
    navigate(`/collection/${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="mt-6" aria-labelledby="pair-with-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8f8b]">
            Hoàn thiện quy trình chăm sóc
          </p>
          <h2 id="pair-with-title" className="mt-1 text-base font-medium">
            Sản phẩm nên kết hợp
          </h2>
        </div>
        <span className="text-xs text-[#8a8f8b]">Dành riêng cho bạn</span>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#dededb]">
        {pairedProducts.map((item, index) => {
          const firstSize = getAvailableSizes(item)[0];

          return (
            <button
              type="button"
              key={item._id}
              onClick={() => viewProduct(item._id)}
              className={`group min-w-0 bg-white text-left transition hover:bg-[#fafaf8] ${
                index > 0 ? "border-l border-[#dededb]" : ""
              }`}
            >
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#f5f5f0] p-5 sm:p-7">
                <img
                  src={item.images[0]}
                  alt={item.title}
                  className="h-[82%] w-[82%] object-contain transition duration-300 group-hover:scale-105"
                />
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-[#343434]">
                  <ArrowUpRight size={14} />
                </span>
              </div>

              <div className="p-3">
                <h3 className="truncate text-xs font-medium text-[#343434] sm:text-sm">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-[#858585]">
                  {formatVnd(item.price?.[firstSize], currency)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default PairWithProducts;
