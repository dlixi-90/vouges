export default function ProductDescription({ product }) {
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients.join(", ") : product.ingredients;
  return <div className="product-description-copy">
    <p>{product.description?.trim() || "Nội dung mô tả sản phẩm đang được cập nhật."}</p>
    {ingredients?.trim() && <div className="mt-6"><h2 className="mb-3 text-xl">Thành phần</h2><p>{ingredients}</p></div>}
  </div>;
}
