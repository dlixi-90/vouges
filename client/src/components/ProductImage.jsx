import { getProductImageSrcSet, getProductImageUrl } from "../utils/productImage";

const ProductImage = ({ src, imageWidth = 320, loading = "lazy", sizes, ...props }) => {
  const optimizedSrc = getProductImageUrl(src, imageWidth);
  const srcSet = getProductImageSrcSet(src, imageWidth);
  return (
  <img
    {...props}
    src={optimizedSrc}
    srcSet={srcSet}
    sizes={srcSet ? sizes || `${imageWidth}px` : undefined}
    loading={loading}
    decoding="async"
    onError={(event) => {
      // Support accounts that disallow on-demand image transformations.
      if (src && optimizedSrc !== src && event.currentTarget.src === optimizedSrc) {
        event.currentTarget.removeAttribute("srcset");
        event.currentTarget.removeAttribute("sizes");
        event.currentTarget.src = src;
      }
    }}
  />
  );
};

export default ProductImage;
