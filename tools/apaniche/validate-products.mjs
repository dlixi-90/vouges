import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'data/research/apaniche');
const products = JSON.parse(fs.readFileSync(path.join(output, 'products.json'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(output, 'collection-summary.json'), 'utf8'));
const variants = JSON.parse(fs.readFileSync(path.join(output, 'variants.json'), 'utf8'));
const errors = [], warnings = [], missing = {};
const error = (product, code, data) => errors.push({ sourceId: product.sourceId, sourceUrl: product.sourceUrl, code, ...data });
const warning = (product, code, data) => warnings.push({ sourceId: product.sourceId, sourceUrl: product.sourceUrl, code, ...data });
const absent = (field) => { missing[field] = (missing[field] || 0) + 1; };
const isUrl = (value) => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
assert.equal(products.length, summary.totalProducts);
assert.equal(new Set(products.map((product) => product.sourceId)).size, products.length);
assert.equal(new Set(products.map((product) => product.sourceUrl)).size, products.length);
assert.equal(variants.length, summary.variants);
for (const product of products) {
  if (!product.name || !isUrl(product.sourceUrl)) error(product, 'missing_identity');
  for (const field of ['price','regularPrice','salePrice']) if (product[field] != null && (!Number.isFinite(product[field]) || product[field] < 0)) error(product, 'invalid_price', { field });
  if (!product.images.length) absent('images');
  if (product.images.some((image) => !isUrl(image.url))) error(product, 'invalid_image_url');
  if (Object.hasOwn(product, 'description') || Object.hasOwn(product, 'short_description')) error(product, 'editorial_content_in_export');
  if (product.detailStatus !== 'ok') { absent('detail'); continue; }
  const detail = product.detail.data;
  for (const field of ['thương hiệu','xuất xứ','giới tính','nồng độ','nhóm hương']) if (!detail.specifications[field]?.value) absent(field);
  if (detail.assessmentProvenance.methodologyVerified !== false || detail.assessmentProvenance.originalAssessmentSource !== null) error(product, 'unverified_assessment_marked_verified');
  const expectedName = product.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const pageName = detail.pageTitle.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (expectedName !== pageName) warning(product, 'title_mismatch', { apiName: product.name, pageTitle: detail.pageTitle });
  for (const field of ['longevity','sillage','suitability','accords']) {
    if (!detail[field]?.length) absent(field);
    for (const item of detail[field] || []) {
      if (item.displayedPercent != null && (!Number.isFinite(item.displayedPercent) || item.displayedPercent < 0 || item.displayedPercent > 100)) error(product, 'invalid_chart_percent', { field, item });
      if (item.displayedCount != null && (!Number.isInteger(item.displayedCount) || item.displayedCount < 0)) error(product, 'invalid_chart_count', { field, item });
      if (item.sourceCountIssue) warning(product, 'source_chart_count_invalid', { field, item });
      if (field !== 'suitability' && item.sourceValueIssue) warning(product, 'source_chart_percent_out_of_range', { field, item });
      if (field === 'suitability' && item.displayedPercent === null) warning(product, item.sourceValueIssue ? 'source_suitability_percent_out_of_range' : 'missing_suitability_percent', { item });
    }
  }
  if (!Object.keys(detail.scentNotes || {}).length) absent('scentNotes');
  const references = product.variantReferences.map((variant) => variant.sourceId).sort((a,b) => a-b);
  const actual = (detail.variants || []).map((variant) => variant.sourceId).sort((a,b) => a-b);
  if (references.length && JSON.stringify(references) !== JSON.stringify(actual)) warning(product, 'variant_id_difference', { apiIds: references, pageIds: actual });
  const resolved = [...new Set([...actual, ...(product.variantSupplements || []).map((variant) => variant.sourceId)])].sort((a,b) => a-b);
  if (references.length && JSON.stringify(references) !== JSON.stringify(resolved)) error(product, 'unresolved_variant_ids', { apiIds: references, resolvedIds: resolved });
  if (new Set(actual).size !== actual.length) error(product, 'duplicate_variant_id');
  for (const variant of detail.variants || []) {
    if (variant.price != null && (!Number.isFinite(variant.price) || variant.price < 0)) error(product, 'invalid_variant_price', { variantId: variant.sourceId });
    if (variant.imageUrl != null && !isUrl(variant.imageUrl)) error(product, 'invalid_variant_image', { variantId: variant.sourceId });
  }
  const prices = (detail.variants || []).filter((variant) => variant.inStock && variant.visible !== false).map((variant) => variant.price).filter((amount) => amount != null);
  if (product.priceRange && prices.length && (Math.min(...prices) !== product.priceRange.min || Math.max(...prices) !== product.priceRange.max)) warning(product, 'api_range_differs_from_available_variant_range', { apiRange: product.priceRange, availableVariantRange: { min: Math.min(...prices), max: Math.max(...prices) } });
}
const report = { checkedAt: new Date().toISOString(), products: products.length, variants: variants.length, completeDetails: summary.completeDetails, failedDetails: summary.failedDetails, pendingDetails: summary.pendingDetails, errorCount: errors.length, warningCount: warnings.length, missingFieldsByProduct: missing, errors, warnings };
fs.writeFileSync(path.join(output, 'quality-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ products: report.products, completeDetails: report.completeDetails, variants: report.variants, errorCount: errors.length, warningCount: warnings.length, missingFieldsByProduct: missing }));
if (errors.length) process.exitCode = 1;
