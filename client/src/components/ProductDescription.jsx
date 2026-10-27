export default function ProductDescription({ product }) {
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients.join(", ") : product.ingredients;
  return <div className="product-description-copy">
    <p>{product.description?.trim() || "N?i dung m? t? s?n ph?m ?ang ???c c?p nh?t."}</p>
    {ingredients?.trim() && <div className="mt-6"><h2 className="mb-3 text-xl">Th?nh ph?n</h2><p>{ingredients}</p></div>}
  </div>;
}
