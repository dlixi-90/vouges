import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiProduct, parseJsonResponse, parseProductPage } from './product-parser.mjs';

test('reads facts and independent suitability scores without copying editorial text', () => {
  const variation = JSON.stringify([{ variation_id: 12, attributes: { attribute_pa_dung_tich: '50ml' }, display_price: 1250000, display_regular_price: 1500000, is_in_stock: false, image: null, min_qty: 1, max_qty: '' }]).replaceAll('"', '&quot;');
  const page = `<h1>Lotion &amp; Oil</h1><script>throw new Error('never execute')</script>
    <table class="woocommerce-product-attributes shop_attributes"><tr><th>Thương hiệu</th><td><a href="/brand">Brand</a></td></tr></table>
    <form class="variations_form" data-product_variations="${variation}"><select name="attribute_pa_dung_tich"><option value="">Choose</option><option value="50ml">50 ml</option></select></form>
    <div class="perfume-chart"><h4 class="chart-title">Lưu</h4><li class="chart-item"><span class="chart-label">Khá 6-8H</span><span class="chart-value">150</span><div class="chart-bar-fill" style="width:75%"></div></li></div>
    <div class="season-item"><svg><title>Exclude SVG</title></svg>Hạ<div class="value-fill" style="width:100%"></div></div>
    <div class="season-item">Đông<div class="value-fill" style="width:0%"></div></div>
    <div class="time-item">Ngày<div class="value-fill" style="width:96%"></div></div>
    <div class="title-nh">Top Notes</div><div class="nh-phase-notes"><a href="/note"><img alt="Lemon"><p>Lemon</p></a></div>
    <article>Long editorial description must not appear in the export.</article>`;
  const result = parseProductPage(page, 'https://apaniche.vn/item');
  assert.equal(result.pageTitle, 'Lotion & Oil');
  assert.equal(result.specifications['thương hiệu'].links[0].url, 'https://apaniche.vn/brand');
  assert.deepEqual(result.suitability, [{ label: 'Hạ', displayedPercent: 100 }, { label: 'Đông', displayedPercent: 0 }, { label: 'Ngày', displayedPercent: 96 }]);
  assert.deepEqual(result.longevity, [{ label: 'Khá 6-8H', displayedCount: 150, displayedPercent: 75 }]);
  assert.equal(result.variants[0].price, 1250000);
  assert.equal(result.variants[0].inStock, false);
  assert.equal(result.variants[0].imageUrl, null);
  assert.equal(result.variants[0].maxPurchaseQuantity, null);
  assert.deepEqual(result.scentNotes.top, [{ name: 'Lemon', url: 'https://apaniche.vn/note' }]);
  assert.equal(result.assessmentProvenance.methodologyVerified, false);
  assert.equal(JSON.stringify(result).includes('Long editorial'), false);
});

test('recovers API arrays after echoed HTML and safely ignores brackets inside strings', () => {
  const rows = [{ id: 1, name: 'a ] } " quoted', attributes: [] }];
  assert.deepEqual(parseJsonResponse('<style>bad server prefix</style>' + JSON.stringify(rows) + '<!-- footer -->'), rows);
  assert.deepEqual(parseJsonResponse('[]'), []);
  assert.throws(() => parseJsonResponse('<h1>Access denied</h1>'));
});

test('keeps missing prices distinct from zero and respects currency precision', () => {
  const result = normalizeApiProduct({ id: 1, name: 'A &#8211; B', prices: { price: '125', currency_minor_unit: 2, currency_code: 'GBP', regular_price: '', sale_price: '0' }, description: 'Do not retain article', short_description: 'Do not retain prose' }, '2026-10-26');
  assert.equal(result.name, 'A – B');
  assert.equal(result.price, 1.25);
  assert.equal(result.regularPrice, null);
  assert.equal(result.salePrice, 0);
  assert.equal(Object.hasOwn(result, 'description'), false);
  assert.equal(Object.hasOwn(result, 'short_description'), false);
});

test('missing charts remain empty and absent AJAX variations are flagged', () => {
  const result = parseProductPage('<h1>Simple product</h1><form class="variations_form" data-product_variations="false"></form>', 'https://apaniche.vn/item');
  assert.deepEqual(result.suitability, []);
  assert.deepEqual(result.longevity, []);
  assert.equal(result.variants, null);
  assert.deepEqual(result.warnings, ['variation_details_not_embedded']);
});

test('source percentages above 100 are preserved as anomalies instead of invented corrections', () => {
  const result = parseProductPage('<h1>Source typo</h1><div class="season-item">Xuân<div class="value-fill" style="width:1100%"></div></div>', 'https://apaniche.vn/item');
  assert.deepEqual(result.suitability, [{ label: 'Xuân', displayedPercent: null, sourceRawPercent: 1100, sourceValueIssue: 'outside_0_to_100' }]);
});

test('negative counts and bar widths in the source are retained separately from usable values', () => {
  const result = parseProductPage('<h1>Source error</h1><div class="perfume-chart"><h4 class="chart-title">Tỏa</h4><li class="chart-item"><span class="chart-label">Gần</span><span class="chart-value">-13138</span><div class="chart-bar-fill" style="width:-45.5%"></div></li></div>', 'https://apaniche.vn/item');
  assert.equal(result.sillage[0].displayedCount, null);
  assert.equal(result.sillage[0].sourceRawCount, -13138);
  assert.equal(result.sillage[0].displayedPercent, null);
  assert.equal(result.sillage[0].sourceRawPercent, -45.5);
});
