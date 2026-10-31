import assert from 'node:assert/strict';
import { productQualityIssues } from './productQuality.js';

const allowedProfileFields = new Set(['concentration', 'type', 'fragrance.group', 'fragrance.components', 'fragrance.profileKind', 'fragrance.compositionNote']);
const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 100
  && !/[.$]/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) && !/test(?:er)?\s*$/i.test(key);
const https = value => typeof value === 'string' && /^https:\/\//.test(value);
const validPrice = value => Number.isSafeInteger(value) && value > 0;
const generatedStockSourceIds = new Set([32950, 47416]);

// Separate from the profile-only migration: commercial changes need exact variant evidence.
export function prepareProfileFinalization(product, record, runId, reviewedAt) {
  assert.equal(String(product._id), record.id, 'Product identity changed');
  assert.equal(product.source?.id, record.sourceId, 'Source identity changed');
  assert.notEqual(product.isDeleted, true, 'Product is deleted');
  assert.equal(new Date(product.updatedAt).getTime(), Date.parse(record.expectedUpdatedAt), 'Product changed since review');
  const next = structuredClone(product), set = {}, removedSizes = [];
  for (const [field, value] of Object.entries(record.changes || {})) {
    assert.ok(allowedProfileFields.has(field), `Unsupported profile field: ${field}`);
    assert.ok(Array.isArray(record.evidence?.[field]) && record.evidence[field].some(row => https(row.url)), `Missing evidence: ${field}`);
    if (field === 'concentration') assert.ok(!product.concentration, 'Cannot replace a verified concentration');
    const segments = field.split('.');
    let target = next;
    for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
    target[segments.at(-1)] = structuredClone(value);
    set[field] = value;
  }
  const commerceFields = new Set(), editedSizes = new Set();
  for (const edit of record.variants || []) {
    assert.ok(['add', 'fill', 'rename'].includes(edit.kind), 'Unsupported variant operation');
    assert.ok(safeKey(edit.size) && validPrice(edit.price) && https(edit.evidence?.url), 'Invalid variant or missing price evidence');
    assert.ok(!editedSizes.has(edit.size), 'Duplicate variant edit');
    editedSizes.add(edit.size);
    let previousSize = edit.size;
    if (edit.kind === 'add') {
      assert.equal((product.sizes || []).length, 0, 'Replacement retail variant requires an empty product');
      assert.equal(next.sizes.length, 0, 'Only one replacement retail variant is allowed');
      assert.equal(edit.evidence.condition, 'retail', 'Cannot reclassify a deleted tester as retail');
      assert.ok(!edit.sourceId, 'A new external retail variant cannot inherit a source tester ID');
      next.sizes = [edit.size];
      previousSize = null;
    } else {
      previousSize = edit.oldSize || edit.size;
      assert.ok(product.sizes.includes(previousSize), 'Unknown variant');
      assert.ok(!validPrice(product.price?.[previousSize]), 'Cannot replace a valid existing price');
      if (edit.kind === 'rename') {
        assert.ok(safeKey(previousSize) && previousSize !== edit.size && !product.sizes.includes(edit.size), 'Invalid rename');
        assert.equal(product.stockBySize?.[previousSize] || 0, 0, 'Cannot rename a stocked variant');
        next.sizes = next.sizes.map(size => size === previousSize ? edit.size : size);
        commerceFields.add('sizes');
        for (const field of ['price', 'stockBySize', 'inStockBySize', 'variantMetadata', 'sizeImages']) {
          next[field] ||= {};
          if (Object.hasOwn(next[field], previousSize)) next[field][edit.size] = next[field][previousSize];
          delete next[field][previousSize];
          commerceFields.add(field);
        }
        removedSizes.push(previousSize);
      }
    }
    next.price ||= {}; next.stockBySize ||= {}; next.inStockBySize ||= {}; next.variantMetadata ||= {};
    next.price[edit.size] = edit.price;
    const oldMetadata = previousSize ? product.variantMetadata?.[previousSize] || {} : {};
    next.variantMetadata[edit.size] = {
      ...oldMetadata, ...(previousSize ? {} : { sourceId: null, sku: `RESEARCH-${record.sourceId}-${edit.size}` }),
      label: edit.size, profilePriceReview: { ...edit.evidence, priceVnd: edit.price, reviewedAt, runId },
      ...(previousSize ? {} : { sourceUrl: edit.evidence.url, sourceAvailable: null }),
    };
    if (!previousSize) {
      next.stockBySize[edit.size] = 0; next.inStockBySize[edit.size] = false;
      ['sizes', 'stockBySize', 'inStockBySize'].forEach(field => commerceFields.add(field));
    }
    if (edit.generatedQuantity !== undefined) {
      assert.ok(generatedStockSourceIds.has(record.sourceId) && record.stockAuthorization === 'user-reference-price-and-random-stock-2026-10-31', 'Random stock was not authorized for this product');
      assert.ok(Number.isSafeInteger(edit.generatedQuantity) && edit.generatedQuantity >= 1 && edit.generatedQuantity <= 30, 'Invalid generated stock');
      assert.equal(product.stockBySize?.[previousSize] || 0, 0, 'Cannot overwrite existing stock');
      assert.equal(product.inventoryMode, 'tracked', 'Generated stock requires tracked inventory');
      next.stockBySize[edit.size] = edit.generatedQuantity;
      next.inStockBySize[edit.size] = true;
      next.inStock = true;
      next.variantMetadata[edit.size].stockGeneration = { runId, quantity: edit.generatedQuantity, range: [1, 30], basis: 'User requested random stock; not a supplier count', generatedAt: reviewedAt };
      ['stockBySize', 'inStockBySize', 'inStock'].forEach(field => commerceFields.add(field));
    }
    ['price', 'variantMetadata'].forEach(field => commerceFields.add(field));
  }
  if (record.resolvedConflict) {
    assert.equal(record.sourceId, 38744, 'Unexpected source conflict resolution');
    assert.equal(record.resolvedConflict.code, 'source_profile_conflict');
    assert.ok(record.resolvedConflict.reason && record.resolvedConflict.sources?.length >= 2 && record.resolvedConflict.sources.every(https), 'Conflict needs documented evidence');
    next.qualityIssues = (next.qualityIssues || []).filter(code => code !== 'source_profile_conflict');
  }
  for (const field of commerceFields) set[field] = next[field];
  const issues = productQualityIssues(next);
  assert.deepEqual([...issues].sort(), [...record.afterIssues].sort(), 'Quality outcome changed');
  const previous = product.source?.profileCompletion || {};
  set.qualityIssues = issues;
  set['source.profileCompletion'] = {
    ...previous, runId, reviewedAt,
    previousRunIds: [...new Set([...(previous.previousRunIds || []), previous.runId].filter(Boolean))],
    fieldsUpdated: [...new Set([...(previous.fieldsUpdated || []), ...Object.keys(set).filter(key => key !== 'qualityIssues')])],
    fieldSources: { ...(previous.fieldSources || {}), ...(record.evidence || {}),
      ...(record.variants?.length ? { variants: record.variants.map(edit => ({ size: edit.size, ...edit.evidence })) } : {}) },
    ...(record.resolvedConflict ? { resolvedConflict: record.resolvedConflict } : {}),
    unresolved: issues.map(code => ({ code })),
  };
  next.source.profileCompletion = set['source.profileCompletion'];
  next.qualityIssues = issues;
  return { set, next, removedSizes };
}
