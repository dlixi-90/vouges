// A gallery photo and a product-card cutout may originate from the same URL.
// Resolve by role so editorial gallery backgrounds remain intact.
export const mediaImageUrl = (url,manifest,avatar=false) => {
  const row=manifest.get(url);
  return (avatar ? row?.cutoutUrl : null) || row?.cleanUrl || url;
};

export const buildProductMediaUpdate = (product,manifest,{supplementalImageUrl}={}) => {
  const original=product.images||[];
  const input=original.length?original:(supplementalImageUrl?[supplementalImageUrl]:[]);
  const images=input.map((url,index)=>mediaImageUrl(url,manifest,index===0));
  const sizeImages=Object.fromEntries(Object.entries(product.sizeImages||{}).map(([size,url])=>[size,mediaImageUrl(url,manifest)]));
  if(JSON.stringify(images)===JSON.stringify(product.images||[])&&JSON.stringify(sizeImages)===JSON.stringify(product.sizeImages||{}))return null;
  return {images,sizeImages};
};
