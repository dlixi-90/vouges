export function planTrackedInventory(products) {
  const totals = { products: products.length, changedProducts: 0, sourceProducts: 0, variants: 0, availableVariants: 0, zeroVariants: 0, totalQuantity: 0 };
  const changes = products.map(product => {
    if (!product.sizes?.length) throw new Error(`Missing product sizes: ${product._id}`);
    if (product.inventoryMode === "source") totals.sourceProducts++;
    const inStockBySize = {};
    for (const size of product.sizes) {
      const quantity = product.stockBySize?.[size];
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error(`Invalid stored quantity: ${product._id} / ${size}`);
      inStockBySize[size] = product.inStock === true && product.inStockBySize?.[size] === true && quantity > 0 && product.price?.[size] > 0;
      totals.variants++;totals.totalQuantity += quantity;
      if (quantity === 0) totals.zeroVariants++;
      if (inStockBySize[size]) totals.availableVariants++;
    }
    const update = { inventoryMode: "tracked", inStockBySize, inStock: Object.values(inStockBySize).some(Boolean) };
    const changed = product.inventoryMode !== update.inventoryMode || product.inStock !== update.inStock || product.sizes.some(size => product.inStockBySize?.[size] !== inStockBySize[size]);
    if (changed) totals.changedProducts++;
    return { product, update, changed };
  });
  return { totals, changes };
}
