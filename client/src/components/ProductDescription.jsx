import { translateCatalogText } from "../utils/localization.js";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const getIngredientCopy = (product) => {
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    return product.ingredients.join(", ");
  }

  if (typeof product.ingredients === "string" && product.ingredients.trim()) {
    return product.ingredients;
  }

  return "Danh sách thành phần đầy đủ được in trên bao bì sản phẩm. Nếu bạn có tiền sử dị ứng hoặc nhạy cảm với thành phần nào đó, vui lòng kiểm tra nhãn trước khi sử dụng.";
};

const ProductDescription = ({ product, selectedSize }) => {
  const [openSection, setOpenSection] = useState("description");

  const sections = [
    {
      id: "description",
      label: "Mô tả",
      content: (
        <p className="text-sm leading-6 text-[#697078]">
          {translateCatalogText(product.description)}
        </p>
      ),
    },
    {
      id: "ingredients",
      label: "Thành phần",
      content: (
        <p className="text-sm leading-6 text-[#697078]">
          {getIngredientCopy(product)}
        </p>
      ),
    },
    {
      id: "size-guide",
      label: "Hướng dẫn chọn dung tích",
      content: (
        <div>
          <p className="text-sm leading-6 text-[#697078]">
            Các dung tích hiện có: {product.sizes.join(", ")}.
            {selectedSize ? ` Bạn đang xem dung tích ${selectedSize}.` : ""}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#92989d]">
            Chọn dung tích nhỏ để dùng thử hoặc mang theo khi đi du lịch; chọn dung tích lớn nếu sử dụng thường xuyên.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-[#dededb]">
      {sections.map((section) => {
        const isOpen = openSection === section.id;

        return (
          <div
            key={section.id}
            className="border-b border-[#dededb] last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setOpenSection(isOpen ? null : section.id)}
              className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-medium text-[#343434] transition hover:bg-[#fafaf8]"
              aria-expanded={isOpen}
              aria-controls={`product-${section.id}`}
            >
              {section.label}
              <ChevronDown
                size={16}
                className={`shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div id={`product-${section.id}`} className="px-4 pb-4 pr-8">
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProductDescription;
