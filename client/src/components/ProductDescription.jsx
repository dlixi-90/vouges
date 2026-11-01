import ProductArticle from "./ProductArticle";
import ScentNotes from "./ScentNotes";

export default function ProductDescription({ product }) {
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients.join(", ") : product.ingredients;
  return <div className="product-description-copy">
    {(product.description?.trim() || product.descriptionContent) && <ProductArticle content={product.descriptionContent} text={product.description?.trim()} />}
    {ingredients?.trim() && <div className="mt-6"><h2 className="mb-3 text-xl">Thành phần</h2><p>{ingredients}</p></div>}
    <ScentNotes fragrance={product.fragrance} />
  </div>;
}
