import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import connectCloudinary from '../config/cloudinary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'data/cloudinary-migration-2026-11-01');
const cutoff = '2026-09-01T00:00:00+07:00';
const command = process.argv[2] || 'plan';
const filename = path.join(directory, 'old-images-prune-plan.json');
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const save = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
const log = value => console.log(JSON.stringify(value));
const candidatesBefore = asset => asset.resource_type === 'image' && Number.isFinite(Date.parse(asset.created_at)) && Date.parse(asset.created_at) < Date.parse(cutoff);

async function runtimeReferences() {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  if (mongoose.connection.db.databaseName !== 'vouges') throw new Error('Unexpected database');
  const urls = new Set();
  const scan = value => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+/gu)) urls.add(match[0]);
    } else if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === 'object') Object.values(value).forEach(scan);
  };
  const projections = {
    products: { images: 1, sizeImages: 1, descriptionContent: 1, description: 1 },
    fragranceterms: { image: 1, descriptionContent: 1, description: 1 },
    orders: { 'items.image': 1 }, users: { image: 1 },
    catalogsources: { 'data.images': 1, 'data.variants': 1 },
  };
  for (const [name, projection] of Object.entries(projections)) {
    const documents = await mongoose.connection.db.collection(name).find({}, { projection }).toArray();
    documents.forEach(scan);
  }
  async function walk(relative) {
    for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      if (['node_modules', 'dist', '.vercel'].includes(entry.name)) continue;
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (/\.(?:js|jsx|mjs|json|css|html)$/u.test(entry.name) && !entry.name.endsWith('package-lock.json')) scan(await fs.readFile(path.join(root, child), 'utf8'));
    }
  }
  for (const relative of ['client/src', 'server/data', 'server/emails']) await walk(relative);
  // Uploaded migration checkpoints are also live references, even before database application.
  try {
    const receipts = await fs.readFile(path.join(directory, 'receipts.jsonl'), 'utf8');
    for (const line of receipts.split('\n').filter(Boolean)) {
      try { scan(JSON.parse(line).url); } catch { /* Ignore a concurrently appended final partial line. */ }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return urls;
}

function isReferenced(asset, urls) {
  // Match public IDs through version, transformation and extension changes.
  return [...urls].some(value => {
    try {
      const url = new URL(value);
      if (!url.pathname.startsWith(`/${process.env.CLDN_NAME}/image/`)) return false;
      const decoded = decodeURIComponent(url.pathname);
      const escaped = asset.public_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`/${escaped}(?:\\.[a-zA-Z0-9]+)?(?:/|$)`, 'u').test(decoded);
    } catch { return false; }
  });
}

async function plan() {
  const urls = await runtimeReferences();
  const all = [];
  for (const type of ['upload', 'private', 'authenticated', 'fetch']) {
    let cursor;
    do {
      const page = await cloudinary.api.resources({ resource_type: 'image', type, max_results: 500, ...(cursor ? { next_cursor: cursor } : {}) });
      all.push(...page.resources.map(asset => ({ ...asset, resource_type: 'image', type })));
      cursor = page.next_cursor;
    } while (cursor);
  }
  const candidates = all.filter(candidatesBefore).map(asset => ({ ...asset, referenced: isReferenced(asset, urls) }));
  const report = { at: new Date().toISOString(), cloudName: process.env.CLDN_NAME, cutoff, candidates, summary: {
    candidates: candidates.length, protected: candidates.filter(asset => asset.referenced).length,
    deletable: candidates.filter(asset => !asset.referenced).length,
    bytes: candidates.filter(asset => !asset.referenced).reduce((sum, asset) => sum + asset.bytes, 0),
  } };
  await save(filename, report); log({ stage: 'prune-plan', cutoff, ...report.summary });
}

async function apply() {
  if (!process.argv.includes('--apply')) throw new Error('Deletion requires --apply');
  const plan = await read(filename);
  if (plan.cloudName !== process.env.CLDN_NAME || plan.cutoff !== cutoff) throw new Error('Deletion plan scope changed');
  const urls = await runtimeReferences();
  const report = { at: new Date().toISOString(), cutoff, deleted: [], protected: [], notFound: [], failures: [] };
  const journal = path.join(directory, 'old-images-prune-journal.jsonl');
  for (const type of ['upload', 'private', 'authenticated', 'fetch']) {
    const selected = plan.candidates.filter(asset => asset.type === type && !asset.referenced);
    for (let offset = 0; offset < selected.length; offset += 50) {
      const batch = selected.slice(offset, offset + 50);
      const current = await cloudinary.api.resources_by_ids(batch.map(asset => asset.public_id), { resource_type: 'image', type });
      const deletable = [];
      for (const asset of current.resources) {
        if (!candidatesBefore({ ...asset, resource_type: 'image' }) || isReferenced(asset, urls)) { report.protected.push(asset.public_id); continue; }
        deletable.push(asset.public_id);
      }
      if (!deletable.length) continue;
      // The prepared record survives an interruption after Cloudinary commits deletion.
      await fs.appendFile(journal, JSON.stringify({ at: new Date().toISOString(), stage: 'prepared', type, publicIds: deletable }) + '\n');
      const result = await cloudinary.api.delete_resources(deletable, { resource_type: 'image', type, invalidate: true });
      for (const [publicId, status] of Object.entries(result.deleted || {})) {
        if (status === 'deleted') report.deleted.push(publicId);
        else if (status === 'not_found') report.notFound.push(publicId);
        else report.failures.push({ publicId, status });
      }
      await fs.appendFile(journal, JSON.stringify({ at: new Date().toISOString(), stage: 'committed', type, result: result.deleted }) + '\n');
      await save(path.join(directory, 'old-images-prune-result.json'), report);
    }
  }
  await save(path.join(directory, 'old-images-prune-result.json'), report);
  log({ stage: 'pruned', cutoff, deleted: report.deleted.length, protected: report.protected.length, notFound: report.notFound.length, failures: report.failures });
}

async function verify() {
  const plan = await read(filename), remaining = [];
  for (const type of ['upload', 'private', 'authenticated', 'fetch']) {
    const candidates = plan.candidates.filter(asset => asset.type === type && !asset.referenced);
    for (let offset = 0; offset < candidates.length; offset += 50) {
      const response = await cloudinary.api.resources_by_ids(candidates.slice(offset, offset + 50).map(asset => asset.public_id), { resource_type: 'image', type });
      remaining.push(...response.resources.map(asset => asset.public_id));
    }
  }
  const result = { at: new Date().toISOString(), cutoff, checked: plan.summary.deletable, remaining };
  await save(path.join(directory, 'old-images-prune-verification.json'), result);
  log({ stage: 'prune-verified', ...result });
  if (remaining.length) throw new Error('Old image deletion is incomplete');
}

try {
  await connectCloudinary();
  if (command === 'plan') await plan();
  else if (command === 'apply') await apply();
  else if (command === 'verify') await verify();
  else throw new Error('Unknown prune command');
} catch (error) { console.error(JSON.stringify({ error: error.message, status: error.http_code })); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
