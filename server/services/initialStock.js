import { createHash } from "node:crypto";

// A store-selected starting quantity, independent of the source's availability flags.
export function planInitialStock(products, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Starting quantity must be a positive integer");
  const totals = { products: products.length, changedProducts: 0, variants: 0, stockedVariants: 0, zeroVariants: 0, totalQuantity: 0 };
  const changes = products.map(product => {
    if (product.inventoryMode !== "source") throw new Error(`Refusing to initialize tracked inventory: ${product._id}`);
    if (!product.sizes?.length || new Set(product.sizes).size !== product.sizes.length) throw new Error(`Invalid sizes: ${product._id}`);
    if (Object.values(product.stockBySize || {}).some(value => value !== 0)) throw new Error(`Existing stock must not be overwritten: ${product._id}`);
    const stock = { ...product.stockBySize };
    for (const size of product.sizes) {
      const available = product.inStock === true && product.inStockBySize?.[size] === true && product.price?.[size] > 0;
      stock[size] = available ? quantity : 0;
      totals.variants++;
      totals[available ? "stockedVariants" : "zeroVariants"]++;
      totals.totalQuantity += stock[size];
    }
    const changed = product.sizes.some(size => stock[size] !== product.stockBySize?.[size]);
    if (changed) totals.changedProducts++;
    return { product, stock, changed };
  });
  return { quantity, totals, changes };
}

const seedForSize = (product, size) => createHash("sha256").update(`${product._id}\0${size}`).digest().readUInt32BE(0);
const priceBasedQuantity = (product, size) => {
  const amount = product.price[size];
  const [minimum, count] = amount >= 5000000 ? [1, 2] : amount >= 1000000 ? [2, 3] : [3, 3];
  return minimum + seedForSize(product, size) % count;
};

function planAdjustedStock(products, previousQuantity, nextQuantity, maximum) {
  const quantities = Object.fromEntries(Array.from({ length: maximum + 1 }, (_, value) => [value, 0]));
  const totals = { products: products.length, changedProducts: 0, variants: 0, stockedVariants: 0, zeroVariants: 0, totalQuantity: 0, quantities };
  const changes = products.map(product => {
    if (product.inventoryMode !== "source") throw new Error(`Refusing to change tracked inventory: ${product._id}`);
    if (!product.sizes?.length || new Set(product.sizes).size !== product.sizes.length) throw new Error(`Invalid sizes: ${product._id}`);
    const stock = { ...product.stockBySize };
    for (const size of product.sizes) {
      const amount = product.price?.[size];
      const available = product.inStock === true && product.inStockBySize?.[size] === true && amount > 0;
      if (stock[size] !== (available ? previousQuantity(product, size) : 0)) throw new Error(`Stock differs from the previous initialization; refusing to overwrite: ${product._id} / ${size}`);
      stock[size] = available ? nextQuantity(product, size) : 0;
      totals.variants++;
      totals[available ? "stockedVariants" : "zeroVariants"]++;
      totals.quantities[stock[size]]++;
      totals.totalQuantity += stock[size];
    }
    const changed = product.sizes.some(size => stock[size] !== product.stockBySize[size]);
    if (changed) totals.changedProducts++;
    return { product, stock, changed };
  });
  return { totals, changes };
}

export function planVariedStock(products, previousQuantity) {
  if (!Number.isSafeInteger(previousQuantity) || previousQuantity < 1) throw new Error("Previous starting quantity is required");
  return planAdjustedStock(products, () => previousQuantity, priceBasedQuantity, 5);
}

export function planRangeStock(products) {
  return planAdjustedStock(products, priceBasedQuantity, (product, size) => 1 + seedForSize(product, size) % 30, 30);
}
