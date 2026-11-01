import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalContentImage, isSourceImage, mediaFields, mediaPatch, mediaUrls, mapStaticImages, migrationUrl, mediaChange, mediaBudget, mediaRollback } from '../../services/mediaMigration.js';

const old = 'https://apaniche.vn/wp-content/uploads/bottle.png';
const local = '/images/product-articles/abc.webp';
const replacement = 'https://res.cloudinary.com/test/image/upload/fl_original/v1/velours/media-v2/hash.webp';
const article = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: old, marks: [{ type: 'link', attrs: { href: old } }] }] }, { type: 'image', attrs: { src: local, alt: 'Full frame', articleWidth: 75, width: 100, height: 200 } }] };

test('migration admits only content assets and exact source hosts, keeping interface artwork and links out', () => {
  assert.equal(isLocalContentImage(local), true);
  for (const value of ['/images/inessa/bg-01.jpg', '/images/categories/men.webp', '/images/library/../secret.webp', '//evil/images/library/a.webp']) assert.equal(isLocalContentImage(value), false);
  assert.equal(isSourceImage(old), true);
  for (const value of ['https://apaniche.vn/product', 'https://apaniche.vn.evil/wp-content/a.png', 'http://apaniche.vn/wp-content/a.png', 'https://user@apaniche.vn/wp-content/a.png']) assert.equal(isSourceImage(value), false);
});

test('product migration preserves all non-delivery fields, article formatting, provenance and original inputs', () => {
  const product = { images: [old, replacement], sizeImages: { '50ml': old }, descriptionContent: article, price: { '50ml': 123 }, stockBySize: { '50ml': 5 }, source: { original: old }, title: old };
  const before = structuredClone(product);
  const mapping = new Map([[old, replacement], [local, replacement]]);
  const patch = mediaPatch(product, 'products', mapping);
  assert.deepEqual(Object.keys(patch).sort(), ['descriptionContent', 'images', 'sizeImages']);
  assert.deepEqual(patch.images, [replacement, replacement]);
  assert.equal(patch.sizeImages['50ml'], replacement);
  assert.deepEqual(patch.descriptionContent.content[0], article.content[0]);
  assert.deepEqual(patch.descriptionContent.content[1].attrs, { ...article.content[1].attrs, src: replacement });
  assert.deepEqual(product, before);
  assert.deepEqual(mediaPatch({ ...product, ...patch }, 'products', mapping), {});
  assert.deepEqual(mediaUrls(product, 'products').sort(), [old, local].sort());
});

test('partial batches change only verified URLs and retain unmigrated images; custom owner replacements survive', () => {
  const product = { images: [old, '/owner-custom.webp'], sizeImages: { a: old }, descriptionContent: article };
  const patch = mediaPatch(product, 'products', new Map([[old, replacement]]));
  assert.deepEqual(patch.images, [replacement, '/owner-custom.webp']);
  assert.equal(Object.hasOwn(patch, 'descriptionContent'), false);
  assert.deepEqual(mediaFields({ image: local, descriptionContent: null }, 'fragranceterms', () => replacement), { image: replacement, descriptionContent: null });
});

test('library card photos join future migration batches while editorial names, text and links remain intact',()=>{
 const image='/images/library-source/photo.png';
 const term={image:local,descriptionContent:{type:'doc',content:[{type:'libraryCards',attrs:{columns:4,items:[{name:image,href:image,description:image,image}]}}]}};
 const patch=mediaPatch(term,'fragranceterms',new Map([[image,replacement]]));
 assert.deepEqual(mediaUrls(term,'fragranceterms').sort(),[local,image].sort());
 assert.deepEqual(patch.descriptionContent.content[0].attrs.items[0],{name:image,href:image,description:image,image:replacement});
 assert.equal(term.descriptionContent.content[0].attrs.items[0].image,image);
});

test('static metadata migration replaces image delivery keys while retaining source URLs and attribution', () => {
  const metadata = { sourceImage: old, sourceUrl: old, downloadedFrom: old, images: [{ src: local, thumbnail: local }], origins: [{ image: local }], text: local };
  const result = mapStaticImages(metadata, value => value === local ? replacement : value);
  assert.deepEqual(result, { ...metadata, images: [{ src: replacement, thumbnail: replacement }], origins: [{ image: replacement }] });
  assert.equal(metadata.images[0].src, local);
});

test('receipts must belong to the configured cloud and represent a nonempty decoded image', () => {
  const receipt = { secure_url: 'https://res.cloudinary.com/test/image/upload/v1/a.webp', public_id: 'a', bytes: 10, width: 20, height: 30 };
  assert.equal(migrationUrl(receipt, 'test'), 'https://res.cloudinary.com/test/image/upload/fl_original/v1/a.webp');
  assert.throws(() => migrationUrl(receipt, 'other'));
  assert.throws(() => migrationUrl({ ...receipt, bytes: 0 }, 'test'));
});

test('database changes compare the original media and version, and update only media plus its version', () => {
  const beforeAt = new Date(1), afterAt = new Date(2);
  const product = { _id: 'product1', images: [old], sizeImages: { a: old }, price: { a: 500 }, stockBySize: { a: 3 }, source: old, updatedAt: beforeAt };
  const change = mediaChange(product, 'products', new Map([[old, replacement]]), afterAt);
  assert.deepEqual(change.filter, { _id: 'product1', updatedAt: beforeAt, images: [old], sizeImages: { a: old } });
  assert.deepEqual(change.update, { $set: { images: [replacement], sizeImages: { a: replacement }, updatedAt: afterAt } });
  assert.deepEqual(change.before, { images: [old], sizeImages: { a: old } });
  assert.deepEqual(change.after, { images: [replacement], sizeImages: { a: replacement } });
  assert.equal(mediaChange({ ...product, ...change.after }, 'products', new Map([[old, replacement]]), afterAt), null);
});

test('quota reservations survive delayed reports and count each uploaded asset only once', () => {
  const budget = { at: '2026-11-01T00:00:00Z', providerDay: '2026-10-31', credits: 10 };
  const receipt = { newUpload: true, publicId: 'same-image', verifiedAt: '2026-11-01T01:00:00Z', bytes: 1024 ** 3 };
  const result = mediaBudget(budget, { credits: { usage: 10 }, lastUpdated: '2026-10-31' }, [receipt, receipt], Date.parse('2026-11-01T02:00:00Z'));
  assert.equal(result.estimated, 11.001);
  assert.deepEqual(result.budget, budget);
});

test('later free-plan batches use refreshed provider usage instead of charging historical uploads forever', () => {
  const budget = { at: '2026-11-01T00:00:00Z', providerDay: '2026-10-31', credits: 10 };
  const receipt = { newUpload: true, publicId: 'old-image', verifiedAt: '2026-11-01T01:00:00Z', bytes: 1024 ** 3 };
  const reported = { credits: { usage: 5 }, lastUpdated: '2026-11-30' };
  const result = mediaBudget(budget, reported, [receipt], Date.parse('2026-12-01T02:00:00Z'));
  assert.equal(result.estimated, 5);
  assert.equal(result.budget.credits, 5);
  assert.equal(mediaBudget(budget, { ...reported, lastUpdated: '2026-10-31' }, [receipt], Date.parse('2026-12-01T02:00:00Z')).estimated, 11.001);
});

test('rollback requires the exact migrated media and version and never admits business-field updates', () => {
  const change = { before: { images: [old] }, after: { images: [replacement] }, afterAt: '2026-11-01T01:00:00.000Z' };
  const now = new Date('2026-11-01T02:00:00.000Z');
  assert.deepEqual(mediaRollback(change, 'products', 'id', now), {
    filter: { _id: 'id', updatedAt: new Date(change.afterAt), images: [replacement] },
    update: { $set: { images: [old], updatedAt: now } },
  });
  assert.throws(() => mediaRollback({ ...change, before: { price: 1 }, after: { price: 2 } }, 'products', 'id', now));
  assert.throws(() => mediaRollback({ ...change, afterAt: 'invalid' }, 'products', 'id', now));
  assert.throws(() => mediaRollback(change, 'orders', 'id', now));
});
