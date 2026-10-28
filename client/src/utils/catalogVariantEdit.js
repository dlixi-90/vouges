export const renameCatalogSize = (draft, from, value) => {
  const size = String(value ?? "").normalize("NFC").trim();
  if (!size || size.length > 50 || size.includes(".") || size.startsWith("$") || ["__proto__", "constructor", "prototype"].includes(size)) {
    throw new Error("Tên dung tích tối đa 50 ký tự, không để trống, chứa dấu chấm hoặc bắt đầu bằng $.");
  }
  if (!draft.sizes.includes(from)) throw new Error("Không tìm thấy dung tích cần sửa.");
  if (draft.sizes.some(item => item !== from && item.normalize("NFC").toLocaleLowerCase("vi-VN") === size.toLocaleLowerCase("vi-VN"))) {
    throw new Error("Dung tích này đã tồn tại.");
  }
  if (size === from) return draft;
  const next = { ...draft, sizes: draft.sizes.map(item => item === from ? size : item) };
  for (const field of ["price", "stockBySize", "inStockBySize", "sizeImages", "variantMetadata", "sizeOrigins"]) {
    const original = field === "sizeOrigins" ? draft.sizeOrigins ?? Object.fromEntries(draft.sizes.map(item => [item, item])) : draft[field] ?? {};
    const renamed = { ...original };
    delete renamed[from]; delete renamed[size];
    if (Object.hasOwn(original, from)) renamed[size] = original[from];
    next[field] = renamed;
  }
  return next;
};

export const catalogSizeRenames = draft => draft.sizes
  .filter(size => draft.sizeOrigins?.[size] && draft.sizeOrigins[size] !== size)
  .map(size => ({ from: draft.sizeOrigins[size], to: size }));
