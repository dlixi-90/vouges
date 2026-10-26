export const saveVariantEdit = (variants, id, draft) => {
  const size = String(draft.size ?? "").trim();
  const price = Number(draft.price);
  const quantity = Number(draft.quantity);
  if (!size || size.length > 50 || size.includes(".") || size.startsWith("$") ||
      ["__proto__", "constructor", "prototype"].includes(size)) {
    throw new Error("Nhập tên dung tích hợp lệ (tối đa 50 ký tự, không chứa dấu chấm hoặc bắt đầu bằng dấu $).");
  }
  if (variants.some((item) => item.id !== id && item.size.trim().toLowerCase() === size.toLowerCase())) {
    throw new Error("Dung tích này đã tồn tại");
  }
  if (!Number.isSafeInteger(price) || price <= 0 || price > Number.MAX_SAFE_INTEGER) {
    throw new Error("Giá phải lớn hơn 0 và nằm trong phạm vi cho phép");
  }
  if (draft.quantity == null || String(draft.quantity).trim() === "" ||
      !Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("Số lượng phải là số nguyên không âm");
  }
  return variants.map((item) => item.id === id ? {
    ...item, size, price, quantity,
    ...(Object.hasOwn(draft, "image") && { image: draft.image }),
  } : item);
};
