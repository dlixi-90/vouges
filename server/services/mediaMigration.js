import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const mediaDigest = (value, algorithm = 'sha256') => crypto.createHash(algorithm).update(value).digest('hex');
export const isLocalContentImage = value => typeof value === 'string' && /^\/images\/(?:library|product-articles|brands)\/[a-zA-Z0-9._-]+\.(?:webp|png|jpg|jpeg)$/u.test(value);
export const isSourceImage = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'apaniche.vn' && !url.username && !url.password && url.pathname.startsWith('/wp-content/'); }
  catch { return false; }
};
export const needsMediaMigration = value => isLocalContentImage(value) || isSourceImage(value);

// Change delivery fields only. Attribution, links, text and source evidence stay intact.
export function mapArticleImages(node, replace) {
  if (!node || typeof node !== 'object') return node;
  const result = { ...node };
  if (node.type === 'image' && typeof node.attrs?.src === 'string') result.attrs = { ...node.attrs, src: replace(node.attrs.src) };
  if (Array.isArray(node.content)) result.content = node.content.map(child => mapArticleImages(child, replace));
  return result;
}

export function mediaFields(document, kind, replace = value => value) {
  const result = {};
  const include = (field, value) => { if (Object.hasOwn(document, field)) result[field] = value; };
  if (kind === 'products') {
    include('images', document.images?.map(replace));
    include('sizeImages', document.sizeImages && Object.fromEntries(Object.entries(document.sizeImages).map(([key, value]) => [key, replace(value)])));
  } else if (kind === 'fragranceterms') include('image', replace(document.image));
  else throw new Error('Unsupported media collection');
  include('descriptionContent', mapArticleImages(document.descriptionContent, replace));
  return result;
}

export function mediaUrls(document, kind) {
  const urls = new Set();
  mediaFields(document, kind, value => { if (needsMediaMigration(value)) urls.add(value); return value; });
  return [...urls];
}

export function mediaPatch(document, kind, mapping) {
  const before = mediaFields(document, kind);
  const after = mediaFields(document, kind, value => mapping.get(value) || value);
  return Object.fromEntries(Object.entries(after).filter(([field, value]) => !isDeepStrictEqual(value, before[field])));
}

export function mapStaticImages(value, replace) {
  if (Array.isArray(value)) return value.map(item => mapStaticImages(item, replace));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ['src', 'thumbnail', 'image'].includes(key) && typeof item === 'string' ? replace(item) : mapStaticImages(item, replace),
  ]));
}

export function migrationUrl(result, cloudName) {
  const url = new URL(result.secure_url);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${cloudName}/image/upload/`) || !result.public_id || !result.bytes || !result.width || !result.height) throw new Error('Unexpected Cloudinary image receipt');
  // Deliver original bytes: no implicit format optimizations or new variants on migration.
  return url.href.replace('/image/upload/', '/image/upload/fl_original/');
}

export function uploadCreditEstimate(bytes) {
  return 0.001 + bytes / (1024 ** 3);
}

export function mediaChange(document, kind, mapping, at) {
  const patch = mediaPatch(document, kind, mapping);
  if (!Object.keys(patch).length) return null;
  const before = Object.fromEntries(Object.keys(patch).map(field => [field, document[field]]));
  return {
    id: String(document._id), before, after: patch,
    beforeAt: document.updatedAt, afterAt: at,
    filter: { _id: document._id, updatedAt: document.updatedAt, ...before },
    update: { $set: { ...patch, updatedAt: at } },
  };
}

export function mediaBudget(previous, reported, receipts, now = Date.now()) {
  let budget = previous;
  // Usage numbers lag uploads. Reset our local reservation epoch only after a full
  // day and a newer provider reporting day; this permits later rolling-window batches.
  if (now - Date.parse(previous.at) >= 86400000 && reported.lastUpdated && previous.providerDay && reported.lastUpdated > previous.providerDay) {
    budget = { at: new Date(now).toISOString(), providerDay: reported.lastUpdated, credits: reported.credits.usage };
  }
  const seen = new Set();
  const reserved = receipts.reduce((sum, row) => {
    if (!row.newUpload || Date.parse(row.verifiedAt) < Date.parse(budget.at) || seen.has(row.publicId)) return sum;
    seen.add(row.publicId); return sum + uploadCreditEstimate(row.bytes);
  }, 0);
  return { budget, estimated: Math.max(reported.credits.usage, budget.credits + reserved) };
}

export function mediaRollback(change, kind, id, at) {
  const allowed = kind === 'products' ? ['images', 'sizeImages', 'descriptionContent'] : kind === 'fragranceterms' ? ['image', 'descriptionContent'] : [];
  const keys = Object.keys(change.before || {}).sort();
  if (!keys.length || !isDeepStrictEqual(keys, Object.keys(change.after || {}).sort()) || keys.some(field => !allowed.includes(field)) || !Number.isFinite(Date.parse(change.afterAt))) throw new Error('Invalid media rollback record');
  return {
    filter: { _id: id, updatedAt: new Date(change.afterAt), ...change.after },
    update: { $set: { ...change.before, updatedAt: at } },
  };
}
