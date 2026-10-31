import test from 'node:test';
import assert from 'node:assert/strict';
import { planApanicheRefresh } from '../../services/apanicheRefresh.js';
import { isSizeAvailable, getPurchaseLimit } from '../../utils/productStock.js';

const product = () => ({ source: { provider: 'apaniche', id: 10 }, inventoryMode: 'tracked', sizes: ['100ml'], price: { '100ml': 0 }, stockBySize: { '100ml': 0 }, inStockBySize: { '100ml': false }, variantMetadata: { '100ml': { sourceId: 10 } }, sizeImages: { '100ml': '/optimized.webp' }, qualityIssues: ['missing_brand', 'zero_source_price'], images: ['/main.webp'], description: 'Edited article', isPublished: true });
const fresh = () => ({ status: 'ok', sourceId: 10, fetchedAt: '2026-10-31T07:00:00.000Z', parent: { sourceId: 10, currency: 'VND', productType: 'variable', inStock: true, sourceUrl: 'https://apaniche.vn/example' }, data: { variants: [{ sourceId: 11, sizeLabel: '100ml', price: 1500000, regularPrice: 1800000, inStock: true, purchasable: true, active: true, visible: true }] } });

test('source capacities and prices replace placeholders, preserving optimized media and editorial fields', () => {
  const before = product(), original = structuredClone(before);
  const result = planApanicheRefresh(before, fresh(), () => 7);
  const after = { ...before, ...result.update };
  assert.deepEqual(before, original);
  assert.equal(after.price['100ml'], 1500000);
  assert.equal(after.variantMetadata['100ml'].sourceId, 11);
  assert.equal(after.sizeImages['100ml'], '/optimized.webp');
  assert.equal(after.description, before.description);
  assert.deepEqual(after.images, before.images);
  assert.deepEqual(after.qualityIssues, ['missing_brand']);
  assert.equal(isSizeAvailable(after, '100ml'), true);
  assert.equal(getPurchaseLimit(after, '100ml'), 7);
});
test('out-of-stock, unpurchasable, inactive, invisible, and zero-price variants never receive generated stock', () => {
  for (const patch of [{ inStock: false }, { purchasable: false }, { active: false }, { visible: false }, { price: 0 }]) {
    const source = fresh(); Object.assign(source.data.variants[0], patch);
    const { update, createdQuantity } = planApanicheRefresh(product(), source, () => { throw new Error('Should not generate stock'); });
    assert.equal(update.inStock, false);
    assert.equal(update.stockBySize['100ml'], 0);
    assert.equal(createdQuantity, 0);
  }
});
test('existing source IDs preserve renamed capacities and their quantities', () => {
  const before = product(); before.variantMetadata['100ml'].sourceId = 11; before.stockBySize['100ml'] = 5;
  const source = fresh(); source.data.variants[0].sizeLabel = '100 ml';
  const result = planApanicheRefresh(before, source, () => { throw new Error('Do not replace stock'); });
  assert.deepEqual(result.update.sizes, ['100ml']);
  assert.equal(result.update.stockBySize['100ml'], 5);
  assert.equal(result.createdQuantity, 0);
});
test('new capacities use source option labels and discard only empty unmatched placeholders', () => {
  const source = fresh(); source.data.variants.push({ sourceId: 12, attributes: { attribute_pa_size: '10-ml' }, price: 250000, inStock: true, purchasable: true });
  source.data.variantOptions = [{ attribute: 'attribute_pa_size', options: [{ value: '10-ml', label: '10ml Dùng Thử' }] }];
  const before = product(); before.sizes = ['Tiêu chuẩn']; before.stockBySize = { 'Tiêu chuẩn': 0 };
  const result = planApanicheRefresh(before, source, () => 3);
  assert.deepEqual(result.update.sizes, ['100ml', '10ml Dùng Thử']);
  assert.deepEqual(result.removedSizes, ['Tiêu chuẩn']);
  assert.equal(result.createdQuantity, 6);
});
test('unverified identities, missing variable details, duplicate IDs, and invalid generated stock abort the plan', () => {
  const wrong = fresh(); wrong.sourceId = 99;
  assert.throws(() => planApanicheRefresh(product(), wrong));
  const missing = fresh(); missing.data.variants = [];
  assert.throws(() => planApanicheRefresh(product(), missing));
  const duplicate = fresh(); duplicate.data.variants.push({ ...duplicate.data.variants[0] });
  assert.throws(() => planApanicheRefresh(product(), duplicate));
  assert.throws(() => planApanicheRefresh(product(), fresh(), () => 31));
});
test('source listings with no variations and no price remain unavailable without fabricating stock or prices', () => {
  const source = fresh(); source.data.variants = []; source.parent.price = 0; source.parent.purchasable = false;
  const before = product();
  const result = planApanicheRefresh(before, source, () => { throw new Error('No stock for incomplete source'); });
  const after = { ...before, ...result.update };
  assert.equal(after.price['100ml'], 0);
  assert.equal(after.stockBySize['100ml'], 0);
  assert.equal(isSizeAvailable(after, '100ml'), false);
  assert.equal(result.createdQuantity, 0);
  assert.ok(result.unresolved);
});
test('public API supplements use the source taxonomy label when the HTML options are absent', () => {
  const source = fresh(); source.data.variants[0].sizeLabel = undefined;
  source.data.variants[0].attributes = { attribute_pa_dung_tich: '100-ml' };
  source.parent.attributes = [{ taxonomy: 'pa_dung_tich', terms: [{ slug: '100-ml', name: '100ml' }] }];
  assert.deepEqual(planApanicheRefresh(product(), source, () => 1).update.sizes, ['100ml']);
});
