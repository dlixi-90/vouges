const invalid = (message) => {
  throw Object.assign(new Error(message), { statusCode: 400 });
};

export const getSizeImage = (product, size) => product?.sizeImages?.[size] || product?.images?.[0] || null;

export const productImageFiles = (files) => Array.isArray(files)
  ? { images: files, sizeImages: [] }
  : { images: files?.images || [], sizeImages: files?.sizeImages || [] };

// Only retain this product's saved URLs or reference a newly uploaded size photo.
// An omitted field preserves older clients; null explicitly removes a size photo.
export const planProductImages = (raw, current, sizes, renames, files) => {
  const uploads = productImageFiles(files);
  const existing = Array.isArray(raw.existingImages)
    ? raw.existingImages.filter((url) => current?.images?.includes(url)) : [];
  if (existing.length + uploads.images.length === 0) invalid("Cần có ít nhất một ảnh sản phẩm");
  if (existing.length + uploads.images.length > 4) invalid("Chỉ được tải lên tối đa 4 ảnh sản phẩm");
  const supplied = raw.sizeImages;
  if (supplied !== undefined && (!supplied || typeof supplied !== "object" || Array.isArray(supplied))) {
    invalid("Ảnh dung tích không hợp lệ");
  }
  if (supplied && Object.keys(supplied).some((size) => !sizes.includes(size))) {
    invalid("Ảnh phải thuộc một dung tích của sản phẩm");
  }
  const references = {};
  const usedUploads = new Set();
  for (const size of sizes) {
    const original = renames.find(({ to }) => to === size)?.from || size;
    const saved = current?.sizeImages?.[original];
    const value = supplied && Object.hasOwn(supplied, size) ? supplied[size] : saved;
    if (value == null || value === "") continue;
    if (typeof value === "string" && value === saved) {
      references[size] = value;
    } else if (Number.isInteger(value) && value >= 0 && value < uploads.sizeImages.length && !usedUploads.has(value)) {
      references[size] = value;
      usedUploads.add(value);
    } else {
      invalid(`Ảnh không hợp lệ cho dung tích ${size}`);
    }
  }
  if (usedUploads.size !== uploads.sizeImages.length) invalid("Mỗi ảnh tải lên phải ứng với một dung tích");
  return { uploads, existing, references };
};

export const resolveSizeImages = (references, urls) => Object.fromEntries(
  Object.entries(references).map(([size, ref]) => [size, typeof ref === "number" ? urls[ref] : ref]),
);
