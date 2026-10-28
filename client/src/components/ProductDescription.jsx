export default function ProductDescription({ product }) {
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients.join(", ") : product.ingredients;
  const notes = product.fragrance?.notes || {};
  return <div className="product-description-copy">
    <p>{product.description?.trim() || "Nội dung mô tả sản phẩm đang được cập nhật."}</p>
    {ingredients?.trim() && <div className="mt-6"><h2 className="mb-3 text-xl">Thành phần</h2><p>{ingredients}</p></div>}
    {Object.values(notes).some(list => list.length > 0) && (
      <div className="product-description-notes my-8 grid gap-5 sm:grid-cols-3">
        {[["top", "Hương đầu"], ["middle", "Hương giữa"], ["base", "Hương cuối"]].map(([key, label]) => (
          <div className="rounded-lg border border-gray-200 p-5" key={key}>
            <h3 className="mb-3 text-xl">{label}</h3>
            <p className="text-sm leading-7 text-gray-600">{notes[key]?.map(note => note.name).join(", ") || "Chưa có dữ liệu"}</p>
          </div>
        ))}
      </div>
    )}
  </div>;
}
