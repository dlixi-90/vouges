export const getSizeImage = (product, size) => product?.sizeImages?.[size] || product?.images?.[0] || null;

// The first image belongs to product cards, not the detail gallery.
export const getDetailGallery = (product, size) => {
  const avatar = product?.images?.[0];
  return [...new Set([
    product?.sizeImages?.[size],
    ...(product?.images?.slice(1) || []),
  ].filter((image) => Boolean(image) && image !== avatar))];
};

// Transform only the versioned Cloudinary uploads used by our catalog.
// Local, signed and already transformed image URLs keep their original behavior.
export const getProductImageUrl = (src, width = 320) => {
  if (typeof src !== "string") return src;
  const safeWidth = Math.min(1600, Math.max(80, Math.round(Number(width) || 320)));
  return src.replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)/,
    `$1f_auto,q_auto,c_limit,w_${safeWidth}/$2`,
  );
};
