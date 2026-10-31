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

const sizeName = (draft, key) => String(draft.sizeNames?.[key] ?? key).normalize("NFC").trim();

export const catalogSizeNameErrors = draft => {
  const errors = {}, names = new Map();
  for (const key of draft.sizes) {
    const name = sizeName(draft, key), normalized = name.toLocaleLowerCase("vi-VN");
    if (!name || name.length > 50 || name.includes(".") || name.startsWith("$") || ["__proto__", "constructor", "prototype"].includes(name)) {
      errors[key] = "Tên dung tích tối đa 50 ký tự, không để trống, chứa dấu chấm hoặc bắt đầu bằng $.";
    } else if (names.has(normalized)) {
      errors[key] = errors[names.get(normalized)] = "Dung tích này đã tồn tại.";
    } else names.set(normalized, key);
  }
  return errors;
};

// Keep row keys stable while typing, then move every variant field together on save.
// Build maps from the original rows so simultaneous renames/swaps cannot overwrite data.
export const resolveCatalogSizeNames = draft => {
  const errors = catalogSizeNameErrors(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const next = { ...draft, sizes: draft.sizes.map(key => sizeName(draft, key)) };
  for (const field of ["price", "stockBySize", "inStockBySize", "sizeImages", "variantMetadata", "sizeOrigins"]) {
    const original = field === "sizeOrigins" ? draft.sizeOrigins ?? Object.fromEntries(draft.sizes.map(key => [key, key])) : draft[field] ?? {};
    next[field] = Object.fromEntries(draft.sizes.filter(key => Object.hasOwn(original, key)).map(key => [sizeName(draft, key), original[key]]));
  }
  delete next.sizeNames;
  return next;
};
