import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { safeSizeKey } from './apanicheCatalog.js';

const normal = (value) => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const validPrice = (value) => Number.isSafeInteger(value) && value > 0;

// Scope: purchase facts only. Existing editorial content and processed media stay intact.
export function planApanicheRefresh(product, fresh, nextQuantity = () => randomInt(1, 31)) {
  assert.equal(fresh.status, 'ok');
  assert.equal(product.source?.provider, 'apaniche');
  assert.equal(product.source.id, fresh.sourceId);
  assert.equal(fresh.parent.sourceId, fresh.sourceId);
  assert.equal(fresh.parent.currency, 'VND');
  assert.equal(product.inventoryMode, 'tracked');
  assert.ok(!product.isDeleted && product.isPublished !== false);
  const variants = fresh.data.variants || [];
  const source = { ...product.source, url: fresh.parent.sourceUrl, fetchedAt: fresh.fetchedAt };
  if (!variants.length && fresh.parent.productType === 'variable') {
    // Some source listings have neither variations nor a purchasable price.
    // Retain the existing placeholder, explicitly unavailable, until the source is complete.
    assert.equal(fresh.parent.price, 0, 'Variable product has no verified variations');
    assert.equal(fresh.parent.purchasable, false, 'Missing variations on a purchasable source product');
    assert.equal(fresh.parent.variantReferences?.length || 0, 0);
    assert.ok(product.sizes.every((size) => !validPrice(product.price?.[size]) && (product.stockBySize?.[size] ?? 0) === 0));
    return { update: { source, inStock: false, inStockBySize: Object.fromEntries(product.sizes.map((size) => [size, false])) }, removedSizes: [], createdQuantity: 0, unresolved: 'Source has no variations or valid price' };
  }
  // Never use a variable parent's minimum price as the price of a specific capacity.
  assert.ok(variants.length || fresh.parent.productType === 'simple', 'Variable product has no verified variations');
  const options = variants.length ? variants : [{ sourceId: fresh.sourceId, price: fresh.parent.price, regularPrice: fresh.parent.regularPrice, inStock: fresh.parent.inStock, purchasable: fresh.parent.purchasable, sizeLabel: product.sizes.length === 1 ? product.sizes[0] : '', sku: fresh.parent.sku }];
  const sizes = [], price = {}, stockBySize = {}, inStockBySize = {}, variantMetadata = {}, sizeImages = {}, used = new Set(), claimed = new Set();
  let createdQuantity = 0;
  for (const variant of options) {
    assert.ok(Number.isSafeInteger(variant.sourceId) && variant.sourceId > 0);
    assert.ok(!sizes.some((key) => variantMetadata[key].sourceId === variant.sourceId), 'Duplicate source variation');
    const labels = Object.entries(variant.attributes || {}).map(([attribute, value]) => fresh.data.variantOptions?.find((item) => item.attribute === attribute)?.options.find((item) => item.value === value)?.label
      || fresh.parent.attributes?.find((item) => `attribute_${item.taxonomy}` === attribute)?.terms.find((item) => item.slug === value)?.name || value);
    const label = variant.sizeLabel || labels.join(' / ');
    assert.ok(label, `Missing capacity for variation ${variant.sourceId}`);
    let previous = product.sizes.find((key) => product.variantMetadata?.[key]?.sourceId === variant.sourceId);
    if (!previous) previous = product.sizes.find((key) => normal(key) === normal(label));
    if (previous) { assert.ok(!claimed.has(previous), 'Ambiguous variation mapping'); claimed.add(previous); }
    const key = safeSizeKey(previous || label, variant.sourceId, used);
    assert.ok(!previous || key === previous, 'Existing size key changed');
    assert.ok(variant.price === null || variant.price === undefined || Number.isSafeInteger(variant.price) && variant.price >= 0, 'Invalid source price');
    const amount = variant.price ?? 0;
    const available = fresh.parent.inStock === true && variant.inStock === true && variant.purchasable === true && variant.active !== false && variant.visible !== false && validPrice(amount);
    let quantity = previous ? product.stockBySize?.[previous] ?? 0 : 0;
    assert.ok(Number.isSafeInteger(quantity) && quantity >= 0);
    if (available && quantity === 0) {
      quantity = nextQuantity();
      assert.ok(Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 30, 'Initial stock must be between 1 and 30');
      createdQuantity += quantity;
    }
    sizes.push(key);
    price[key] = amount;
    stockBySize[key] = quantity;
    inStockBySize[key] = available && quantity > 0;
    variantMetadata[key] = { ...(previous ? product.variantMetadata?.[previous] : {}), sourceId: variant.sourceId, sku: variant.sku || `APA-${variant.sourceId}`, label, regularPrice: variant.regularPrice ?? null, sourceAvailable: variant.inStock ?? null, sourcePurchasable: variant.purchasable ?? null, sourceUrl: fresh.parent.sourceUrl, verifiedAt: fresh.fetchedAt };
    // Reuse optimized local media. New capacities fall back to the product's main image.
    if (previous && product.sizeImages?.[previous]) sizeImages[key] = product.sizeImages[previous];
  }
  const removedSizes = product.sizes.filter((key) => !claimed.has(key));
  for (const size of removedSizes) assert.equal(product.stockBySize?.[size] ?? 0, 0, 'Cannot remove a capacity with local inventory');
  const qualityIssues = (product.qualityIssues || []).filter((issue) => issue !== 'zero_source_price');
  if (Object.values(price).some((amount) => !validPrice(amount))) qualityIssues.push('zero_source_price');
  return {
    update: { sizes, price, stockBySize, inStockBySize, variantMetadata, sizeImages, inStock: Object.values(inStockBySize).some(Boolean), qualityIssues, source },
    removedSizes, createdQuantity,
  };
}
