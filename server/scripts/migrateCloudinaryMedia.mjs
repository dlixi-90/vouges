import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import connectCloudinary from '../config/cloudinary.js';
import Product from '../models/Product.js';
import FragranceTerm from '../models/FragranceTerm.js';
import {
  mediaDigest, isLocalContentImage, needsMediaMigration, mediaUrls, mediaFields, mediaPatch,
  mapStaticImages, migrationUrl, uploadCreditEstimate, mediaChange, mediaBudget, mediaRollback,
} from '../services/mediaMigration.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'data/cloudinary-migration-2026-11-01');
const cache = path.join(directory, 'cache');
const staticFiles = ['server/data/libraryDirectory.json', 'server/data/brandImages.json', 'client/src/data/brandDirectory.json'];
const command = process.argv[2] || 'status';
const option = (key, fallback) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const concurrency = Number(option('concurrency', '4'));
const maxConcurrency = command === 'verify' ? 32 : 8;
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > maxConcurrency) throw new Error(`Concurrency must be 1..${maxConcurrency}`);
const exists = async file => fs.access(file).then(() => true, () => false);
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = async (file, value) => { const temporary = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`; await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n'); await fs.rename(temporary, file); };
const log = value => console.log(JSON.stringify(value));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let appendQueue = Promise.resolve();
const append = (name, value) => {
  appendQueue = appendQueue.then(() => fs.appendFile(path.join(directory, name), JSON.stringify(value) + '\n'));
  return appendQueue;
};
async function records(name) {
  const file = path.join(directory, name);
  if (!await exists(file)) return [];
  const content = await fs.readFile(file, 'utf8');
  const lines = content.split('\n');
  const result = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    try { result.push(JSON.parse(lines[index])); }
    catch (error) {
      if (index !== lines.length - 1) throw error;
      // A verifier may be reading while upload appends. Never truncate the active journal.
    }
  }
  return result;
}
const connect = () => mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
const retry = async operation => {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) { if (attempt === 3 || error.http_code && error.http_code !== 429 && error.http_code < 500) throw error; await pause(1000 * 2 ** attempt); }
  }
};
async function pool(items, operation) {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (next < items.length) await operation(items[next++]); }));
}
async function usage() {
  const value = await cloudinary.api.usage();
  return { at: new Date().toISOString(), lastUpdated: value.last_updated, plan: value.plan, credits: value.credits, storage: value.storage, transformations: value.transformations, bandwidth: value.bandwidth, resources: value.resources };
}

async function inventory() {
  const file = path.join(directory, 'plan.json');
  if (await exists(file)) throw new Error('Plan already exists; use the existing checkpoint');
  await connect();
  const products = await Product.find({}).select('images sizeImages descriptionContent updatedAt').lean();
  const terms = await FragranceTerm.find({}).select('image descriptionContent updatedAt').lean();
  const snapshot = { createdAt: new Date().toISOString(), database: mongoose.connection.db.databaseName, products, fragranceterms: terms, files: [] };
  if (snapshot.database !== 'vouges') throw new Error('Unexpected database');
  const byUrl = new Map();
  const add = (url, priority) => { if (needsMediaMigration(url)) byUrl.set(url, Math.min(priority, byUrl.get(url) ?? priority)); return url; };
  for (const product of products) for (const url of mediaUrls(product, 'products')) add(url, isLocalContentImage(url) ? 3 : 1);
  for (const term of terms) for (const url of mediaUrls(term, 'fragranceterms')) add(url, 2);
  for (const relative of staticFiles) {
    const text = await fs.readFile(path.join(root, relative), 'utf8');
    snapshot.files.push({ path: relative, digest: mediaDigest(text), content: JSON.parse(text) });
    mapStaticImages(JSON.parse(text), value => add(value, 2));
  }
  // Include retained content illustrations and thumbnails, including historical import fixtures.
  for (const folder of ['library', 'product-articles', 'brands']) for (const name of await fs.readdir(path.join(root, 'client/public/images', folder))) add(`/images/${folder}/${name}`, 4);
  await save(path.join(directory, 'snapshot.json'), snapshot);
  const currentUsage = await usage();
  const resources = [];
  let cursor;
  do {
    const page = await retry(() => cloudinary.api.resources({ resource_type: 'image', type: 'upload', max_results: 500, ...(cursor ? { next_cursor: cursor } : {}) }));
    resources.push(...page.resources); cursor = page.next_cursor;
  } while (cursor);
  await save(path.join(directory, 'cloudinary-inventory.json'), resources);
  const cloudByHash = new Map(resources.filter(r => r.etag && r.bytes).map(r => [`${r.etag}:${r.bytes}`, r]));
  const assets = [];
  for (const [url, priority] of byUrl) {
    const asset = { url, priority, key: mediaDigest(url) };
    if (isLocalContentImage(url)) {
      const file = path.join(root, 'client/public', url);
      const buffer = await fs.readFile(file);
      Object.assign(asset, { file: path.relative(root, file).replaceAll('\\', '/'), bytes: buffer.length, sha256: mediaDigest(buffer), md5: mediaDigest(buffer, 'md5') });
      const previous = cloudByHash.get(`${asset.md5}:${asset.bytes}`);
      if (previous) asset.existing = previous;
    }
    assets.push(asset);
  }
  assets.sort((a, b) => a.priority - b.priority || a.url.localeCompare(b.url));
  const localUnique = new Map(assets.filter(a => a.sha256 && !a.existing).map(a => [a.sha256, a.bytes]));
  const plan = { createdAt: snapshot.createdAt, cloudName: process.env.CLDN_NAME, usage: currentUsage, assets, summary: {
    products: products.length, terms: terms.length, assets: assets.length, remoteUrls: assets.filter(a => !a.file).length,
    localFiles: assets.filter(a => a.file).length, localExisting: assets.filter(a => a.existing).length,
    localUniqueNew: localUnique.size, localNewBytes: [...localUnique.values()].reduce((sum, bytes) => sum + bytes, 0),
    localUploadCredits: [...localUnique.values()].reduce((sum, bytes) => sum + uploadCreditEstimate(bytes), 0),
    cloudinaryAssets: resources.length,
  } };
  await save(file, plan); log({ stage: 'inventory', ...plan.summary, usage: currentUsage.credits });
}

async function verifyDelivery(receipt) {
  const response = await retry(async () => {
    const result = await fetch(receipt.url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    if (!result.ok) throw Object.assign(new Error(`Cloudinary delivery HTTP ${result.status}`), { http_code: result.status });
    return result;
  });
  if (!/^image\//i.test(response.headers.get('content-type') || '')) throw new Error('Delivery is not an image');
  const length = Number(response.headers.get('content-length'));
  if (length && length !== receipt.bytes) throw new Error('Delivered image byte count differs');
  return new Date().toISOString();
}

let nextDownloadAt = 0;
async function sourceBytes(asset) {
  if (asset.file) {
    const filename = path.resolve(root, asset.file);
    if (!filename.startsWith(path.join(root, 'client/public/images') + path.sep)) throw new Error('Image is outside public media directory');
    const bytes = await fs.readFile(filename);
    if (mediaDigest(bytes) !== asset.sha256) throw new Error('Local image changed after inventory');
    return { filename, bytes, sha256: asset.sha256, md5: asset.md5 };
  }
  await fs.mkdir(cache, { recursive: true });
  const filename = path.join(cache, asset.key);
  if (await exists(filename)) {
    const bytes = await fs.readFile(filename);
    return { filename, bytes, sha256: mediaDigest(bytes), md5: mediaDigest(bytes, 'md5') };
  }
  const start = Math.max(Date.now(), nextDownloadAt); nextDownloadAt = start + 180;
  if (start > Date.now()) await pause(start - Date.now());
  const bytes = await retry(async () => {
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'VeloursMediaMigration/1.0' } });
    if (!response.ok) throw Object.assign(new Error(`Source HTTP ${response.status}`), { http_code: response.status });
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'apaniche.vn' || !/^image\//i.test(response.headers.get('content-type') || '')) throw Object.assign(new Error('Unexpected source image response'), { http_code: 400 });
    let length = 0; const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 20 * 1024 * 1024) throw Object.assign(new Error('Source image exceeds 20 MiB'), { http_code: 413 });
      chunks.push(chunk);
    }
    if (!length) throw new Error('Empty source image');
    return Buffer.concat(chunks);
  });
  await fs.writeFile(filename + '.tmp', bytes); await fs.rename(filename + '.tmp', filename);
  return { filename, bytes, sha256: mediaDigest(bytes), md5: mediaDigest(bytes, 'md5') };
}

async function upload() {
  const lock = path.join(directory, 'upload.lock');
  if (await exists(lock)) {
    const previous = await json(lock);
    let alive = true;
    try { process.kill(previous.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
    if (alive) throw new Error('An upload worker is already running');
    await fs.unlink(lock);
  }
  const handle = await fs.open(lock, 'wx');
  await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); await handle.close();
  try { await runUpload(); } finally { await fs.unlink(lock); }
}

async function runUpload() {
  // Only the exclusive uploader can repair a partially written final checkpoint.
  const receiptFile = path.join(directory, 'receipts.jsonl');
  if (await exists(receiptFile)) {
    const text = await fs.readFile(receiptFile, 'utf8');
    if (text && !text.endsWith('\n')) {
      const end = text.lastIndexOf('\n');
      const tail = text.slice(end + 1);
      try { JSON.parse(tail); await fs.appendFile(receiptFile, '\n'); }
      catch { await fs.writeFile(receiptFile, text.slice(0, end + 1)); }
    }
  }
  const plan = await json(path.join(directory, 'plan.json'));
  if (plan.cloudName !== process.env.CLDN_NAME) throw new Error('Cloudinary account differs from inventory');
  const before = await usage();
  const ceiling = Number(option('max-credits', String(before.credits.limit * 0.9)));
  if (!Number.isFinite(ceiling) || ceiling > before.credits.limit || ceiling <= 0) throw new Error('Credit ceiling exceeds current account allocation');
  const old = await records('receipts.jsonl');
  const byUrl = new Map(old.map(row => [row.source, row]));
  const byHash = new Map(old.map(row => [row.sha256, row]));
  const claimedUploads = new Set(old.map(row => row.publicId));
  let cloud = await json(path.join(directory, 'cloudinary-inventory.json'));
  const prunedFile = path.join(directory, 'old-images-prune-result.json');
  if (await exists(prunedFile)) {
    const removed = new Set((await json(prunedFile)).deleted);
    cloud = cloud.filter(asset => !removed.has(asset.public_id));
  }
  const cloudByMd5 = new Map(cloud.filter(row => row.etag && row.bytes).map(row => [`${row.etag}:${row.bytes}`, row]));
  const initialPublicIds = new Set(cloud.map(row => row.public_id));
  const inFlight = new Map();
  const scope = option('scope', 'all');
  if (!['all', 'remote', 'local'].includes(scope)) throw new Error('Unknown upload scope');
  const countLimit = Number(option('limit', 'Infinity'));
  const budgetFile = path.join(directory, 'budget.json');
  const previousBudget = await exists(budgetFile) ? await json(budgetFile) : { at: plan.createdAt, providerDay: plan.usage.lastUpdated || before.lastUpdated, credits: plan.usage.credits.usage };
  const reservation = mediaBudget(previousBudget, before, old);
  await save(budgetFile, reservation.budget);
  let estimated = reservation.estimated;
  let completed = 0, uploaded = 0, reused = 0, failed = 0, quotaStopped = false;
  let refreshAt = 100;
  const tasks = plan.assets.filter(asset => !byUrl.has(asset.url) && (scope === 'all' || (scope === 'local' ? Boolean(asset.file) : !asset.file))).slice(0, countLimit);
  const progress = async () => {
    const report = { stage: 'upload', scope, completed, uploaded, reused, failed, mappedUrls: byUrl.size, totalUrls: plan.assets.length, estimatedCredits: Number(estimated.toFixed(4)), ceiling, quotaStopped, at: new Date().toISOString() };
    await save(path.join(directory, 'progress.json'), report); log(report);
  };
  await pool(tasks, async asset => {
    if (quotaStopped) return;
    try {
      const source = await sourceBytes(asset);
      let shared = byHash.get(source.sha256);
      if (!shared) {
        let pending = inFlight.get(source.sha256);
        if (!pending) {
          pending = (async () => {
            const existing = cloudByMd5.get(`${source.md5}:${source.bytes.length}`);
            let result, newUpload = false;
            if (existing) result = existing;
            else {
              const cost = uploadCreditEstimate(source.bytes.length);
              if (estimated + cost > ceiling) { quotaStopped = true; return null; }
              estimated += cost; // Reserve synchronously before an asynchronous upload.
              result = await retry(() => cloudinary.uploader.upload(source.filename, {
                resource_type: 'image', public_id: `velours/media-v2/${source.sha256}`, overwrite: false,
                unique_filename: false, use_filename: false,
                context: { migration: 'velours-media-v2', sha256: source.sha256 },
              }));
              // A previous interrupted worker may have uploaded this deterministic
              // ID before recording its receipt. Include that asset in reservations.
              newUpload = !result.existing || !initialPublicIds.has(result.public_id);
              if (result.etag !== source.md5 || result.bytes !== source.bytes.length) throw new Error('Cloudinary changed original bytes; mapping withheld');
            }
            const receipt = { sha256: source.sha256, md5: source.md5, url: migrationUrl(result, plan.cloudName), publicId: result.public_id, bytes: result.bytes, width: result.width, height: result.height, newUpload };
            receipt.verifiedAt = await verifyDelivery(receipt);
            byHash.set(source.sha256, receipt);
            return receipt;
          })();
          inFlight.set(source.sha256, pending);
        }
        shared = await pending;
      }
      if (!shared) return;
      const receipt = { ...shared, source: asset.url, newUpload: shared.newUpload && !claimedUploads.has(shared.publicId) };
      claimedUploads.add(shared.publicId);
      await append('receipts.jsonl', receipt);
      byUrl.set(asset.url, receipt);
      if (receipt.newUpload) uploaded++; else reused++;
      completed++;
      if (completed % 50 === 0) await progress();
      if (completed >= refreshAt) {
        refreshAt = completed + 100;
        try { const reported = await usage(); estimated = Math.max(estimated, reported.credits.usage); if (estimated >= ceiling) quotaStopped = true; }
        catch { /* Conservative local reservations remain active if usage reporting is unavailable. */ }
      }
    } catch (error) {
      failed++;
      await append('failures.jsonl', { source: asset.url, at: new Date().toISOString(), error: error.message, status: error.http_code });
      if ([401, 403, 420].includes(error.http_code)) quotaStopped = true;
    }
  });
  await appendQueue;
  await progress();
  await save(path.join(directory, 'url-map.json'), Object.fromEntries([...byUrl].map(([url, row]) => [url, row.url])));
  await save(path.join(directory, 'usage-after-upload.json'), await usage());
}

async function verifiedMapping(checkpointRows) {
  const plan = await json(path.join(directory, 'plan.json'));
  if (plan.cloudName !== process.env.CLDN_NAME) throw new Error('Cloudinary account differs from inventory');
  const rows = checkpointRows || await records('receipts.jsonl');
  const mapping = new Map();
  for (const row of rows) {
    const url = new URL(row.url);
    if (!needsMediaMigration(row.source) || !Number.isFinite(Date.parse(row.verifiedAt)) || !/^[a-f0-9]{64}$/u.test(row.sha256) || !row.bytes || !row.width || !row.height || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${plan.cloudName}/image/upload/fl_original/`)) throw new Error('Unverified or invalid mapping receipt');
    mapping.set(row.source, row.url);
  }
  return mapping;
}

async function verify() {
  const rows = await records('receipts.jsonl');
  const mapping = await verifiedMapping(rows);
  const unique = [...new Map(rows.map(row => [row.publicId, row])).values()];
  let checked = 0; const failures = [];
  await pool(unique, async row => {
    try { await verifyDelivery(row); checked++; }
    catch (error) { failures.push({ publicId: row.publicId, error: error.message }); }
  });
  const frozenMap = Object.fromEntries(mapping);
  const report = { at: new Date().toISOString(), checked, mappedUrls: mapping.size, mappingDigest: mediaDigest(JSON.stringify(frozenMap)), failures };
  if (!failures.length) await save(path.join(directory, 'verified-url-map.json'), frozenMap);
  await save(path.join(directory, 'verification.json'), report); log({ stage: 'verify', ...report });
  if (failures.length) throw new Error('Some uploaded images failed delivery verification');
}

const nonMediaHash = (document, kind) => {
  const { updatedAt, ...other } = document;
  for (const field of Object.keys(mediaFields(document, kind))) delete other[field];
  return mediaDigest(JSON.stringify(other));
};

async function apply() {
  if (!process.argv.includes('--apply') || option('database', '') !== 'vouges') throw new Error('Applying requires --apply --database=vouges');
  const verification = await json(path.join(directory, 'verification.json'));
  const frozenMap = await json(path.join(directory, 'verified-url-map.json'));
  const mapping = new Map(Object.entries(frozenMap));
  const receipts = await verifiedMapping();
  if (verification.failures.length || verification.mappedUrls !== mapping.size || verification.mappingDigest !== mediaDigest(JSON.stringify(frozenMap)) || [...mapping].some(([source, url]) => receipts.get(source) !== url)) throw new Error('Verify every mapped asset before applying');
  await connect();
  if (mongoose.connection.db.databaseName !== 'vouges') throw new Error('Unexpected database');
  const backupDirectory = path.join(root, '.backups/cloudinary-migration-2026-11-01');
  await fs.mkdir(backupDirectory, { recursive: true });
  const report = { at: new Date().toISOString(), mappingUrls: mapping.size, products: 0, fragranceterms: 0, files: [], conflicts: [], backups: [] };
  let remaining = Number(option('limit', 'Infinity'));
  for (const kind of ['products', 'fragranceterms']) {
    const collection = mongoose.connection.db.collection(kind);
    const documents = await collection.find({}).toArray();
    const pending = documents.filter(document => Object.keys(mediaPatch(document, kind, mapping)).length).slice(0, remaining);
    remaining -= pending.length;
    for (let offset = 0; offset < pending.length; offset += 100) {
      const batch = pending.slice(offset, offset + 100);
      const at = new Date();
      const changes = batch.map(document => mediaChange(document, kind, mapping, at));
      const backup = path.join(backupDirectory, `${Date.now()}-${process.pid}-${kind}-${offset}.json`);
      // Durable write-ahead record: even a process interruption after commit can be rolled back.
      await save(backup, { status: 'prepared', kind, changes });
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const operations = changes.map(change => ({ updateOne: { filter: change.filter, update: change.update } }));
          const result = await collection.bulkWrite(operations, { session, ordered: true });
          if (result.matchedCount !== changes.length) throw new Error('Concurrent edit detected; the batch was rolled back');
          const after = await collection.find({ _id: { $in: batch.map(document => document._id) } }, { session }).toArray();
          const byId = new Map(after.map(document => [String(document._id), document]));
          for (const before of batch) {
            const current = byId.get(String(before._id));
            if (!current || nonMediaHash(current, kind) !== nonMediaHash(before, kind)) throw new Error('Non-media data changed; batch was rolled back');
            const expected = { ...before, ...mediaPatch(before, kind, mapping) };
            if (!isDeepStrictEqual(mediaFields(current, kind), mediaFields(expected, kind))) throw new Error('Image fields differ from verified mapping');
          }
        });
        await save(backup, { status: 'applied', kind, changes });
        report[kind] += changes.length; report.backups.push(path.relative(root, backup).replaceAll('\\', '/'));
      } catch (error) {
        // A transport error can leave commit acknowledgement uncertain. Preserve
        // rollback eligibility; its exact before/after checks determine actual state.
        await save(backup, { status: 'unconfirmed', kind, changes, error: error.message });
        report.conflicts.push({ kind, offset, error: error.message });
        // Stop further changes. Committed batches retain their independent rollback records.
        await save(path.join(directory, 'apply-result.json'), report); throw error;
      } finally { await session.endSession(); }
      log({ stage: 'apply', kind, changed: report[kind] });
    }
  }
  for (const relative of staticFiles) {
    const filename = path.join(root, relative);
    const beforeText = await fs.readFile(filename, 'utf8');
    const before = JSON.parse(beforeText);
    const after = mapStaticImages(before, value => mapping.get(value) || value);
    if (isDeepStrictEqual(before, after)) continue;
    const afterText = JSON.stringify(after, null, 2) + '\n';
    const backup = path.join(backupDirectory, `${Date.now()}-${path.basename(filename)}-file.json`);
    await save(backup, { status: 'prepared', kind: 'file', path: relative, beforeText, afterText });
    if (mediaDigest(await fs.readFile(filename, 'utf8')) !== mediaDigest(beforeText)) throw new Error('Static metadata changed concurrently');
    await save(filename, after);
    await save(backup, { status: 'applied', kind: 'file', path: relative, beforeText, afterText });
    report.files.push(relative); report.backups.push(path.relative(root, backup).replaceAll('\\', '/'));
  }
  await save(path.join(directory, `apply-${Date.now()}.json`), report);
  await save(path.join(directory, 'apply-result.json'), report); log({ stage: 'applied', ...report });
}

async function rollback() {
  if (!process.argv.includes('--apply') || option('database', '') !== 'vouges') throw new Error('Rollback requires --apply --database=vouges');
  const batch = option('batch', '');
  if (!/^[a-zA-Z0-9._-]+\.json$/u.test(batch)) throw new Error('Specify a backup filename with --batch');
  const filename = path.join(root, '.backups/cloudinary-migration-2026-11-01', batch);
  const record = await json(filename);
  if (record.status === 'rolled-back') { log({ stage: 'rollback', alreadyRolledBack: true }); return; }
  if (!['prepared', 'applied', 'unconfirmed'].includes(record.status)) throw new Error('Backup does not represent an applied batch');
  if (record.kind === 'file') {
    if (!staticFiles.includes(record.path)) throw new Error('Unexpected metadata backup');
    const target = path.join(root, record.path);
    if (await fs.readFile(target, 'utf8') !== record.afterText) throw new Error('Metadata edited since migration; rollback withheld');
    await fs.writeFile(target + '.tmp', record.beforeText); await fs.rename(target + '.tmp', target);
  } else {
    if (!['products', 'fragranceterms'].includes(record.kind)) throw new Error('Unexpected backup collection');
    await connect();
    if (mongoose.connection.db.databaseName !== 'vouges') throw new Error('Unexpected database');
    const collection = mongoose.connection.db.collection(record.kind), session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const operations = record.changes.map(change => ({ updateOne: mediaRollback(change, record.kind, new mongoose.Types.ObjectId(change.id), new Date()) }));
        const result = await collection.bulkWrite(operations, { session });
        if (result.matchedCount !== operations.length) throw new Error('Documents edited since migration; rollback withheld');
      });
    } finally { await session.endSession(); }
  }
  await save(filename, { ...record, status: 'rolled-back', rolledBackAt: new Date().toISOString() });
  log({ stage: 'rollback', backup: batch });
}

async function audit() {
  await connect();
  const report = { at: new Date().toISOString(), collections: {}, staticFiles: {} };
  for (const kind of ['products', 'fragranceterms']) {
    const documents = await mongoose.connection.db.collection(kind).find({}).toArray();
    const urls = new Set(documents.flatMap(document => mediaUrls(document, kind)));
    report.collections[kind] = { documents: documents.length, remainingRemoteUrls: [...urls].filter(url => !isLocalContentImage(url)).length, remainingLocalUrls: [...urls].filter(isLocalContentImage).length };
  }
  for (const relative of staticFiles) {
    const urls = new Set(); mapStaticImages(await json(path.join(root, relative)), value => { if (needsMediaMigration(value)) urls.add(value); return value; });
    report.staticFiles[relative] = { remainingUrls: urls.size };
  }
  report.usage = await usage();
  await save(path.join(directory, 'audit.json'), report); log({ stage: 'audit', ...report });
}

try {
  await fs.mkdir(directory, { recursive: true });
  await connectCloudinary();
  if (command === 'inventory') await inventory();
  else if (command === 'upload') await upload();
  else if (command === 'verify') await verify();
  else if (command === 'apply') await apply();
  else if (command === 'rollback') await rollback();
  else if (command === 'audit') await audit();
  else if (command === 'status') {
    const report = { usage: await usage() };
    if (await exists(path.join(directory, 'plan.json'))) {
      const plan = await json(path.join(directory, 'plan.json'));
      const completed = new Set((await records('receipts.jsonl')).map(row => row.source));
      const pending = plan.assets.filter(asset => !completed.has(asset.url));
      Object.assign(report, { plan: plan.summary, mappedUrls: completed.size, remainingRemoteUrls: pending.filter(asset => !asset.file).length, remainingLocalFiles: pending.filter(asset => asset.file).length });
    }
    log(report);
  } else throw new Error(`Unknown command: ${command}`);
} catch (error) { console.error(JSON.stringify({ stage: command, error: error.message, status: error.http_code })); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
