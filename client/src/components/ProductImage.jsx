import { getProductImageUrl } from "../utils/productImage";

const ProductImage = ({ src, imageWidth = 320, loading = "lazy", ...props }) => {
  const optimizedSrc = getProductImageUrl(src, imageWidth);
  return (
  <img
    {...props}
    src={optimizedSrc}
    loading={loading}
    decoding="async"
    onError={(event) => {
      // Support accounts that disallow on-demand image transformations.
      if (src && optimizedSrc !== src && event.currentTarget.src === optimizedSrc) {
        event.currentTarget.src = src;
      }
    }}
  />
  );
};

export default ProductImage;
