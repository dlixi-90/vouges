// Clear current product articles without changing product facts or media.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apply = process.argv.includes('--apply');
if (apply && !process.argv.includes('--database=vouges')) throw new Error('Applying requires --database=vouges');
const { EJSON } = mongoose.mongo.BSON;
const needsClear = row => row.description !== '' || row.descriptionContent !== null;
const facts = ({ description, descriptionContent, updatedAt, ...rest }) => rest;
const counts = rows => ({ totalProducts: rows.length, textDescriptions: rows.filter(row => typeof row.description === 'string' && row.description.trim()).length, richDescriptions: rows.filter(row => row.descriptionContent != null).length, productsToChange: rows.filter(needsClear).length });
const durableWrite = async (filename, value) => {
  const handle = await fs.open(filename, 'w');
  try { await handle.writeFile(EJSON.stringify(value, null, 2, { relaxed: false }) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
};

try {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vouges') throw new Error('Unexpected database');
  const products = db.collection('products');
  const preview = counts(await products.find({}).toArray());
  console.log(JSON.stringify({ phase: 'preview', database: db.databaseName, ...preview }));
  if (apply && preview.productsToChange) {
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const backupDirectory = path.join(root, '.backups', `product-descriptions-${stamp}`);
    await fs.mkdir(backupDirectory, { recursive: true });
    let report;
    await mongoose.connection.transaction(async session => {
      const before = await products.find({}, { session }).toArray();
      const changes = before.filter(needsClear);
      await durableWrite(path.join(backupDirectory, 'descriptions.ejson'), changes.map(row => ({ _id: row._id, description: row.description, descriptionContent: row.descriptionContent, updatedAt: row.updatedAt, hadDescription: Object.hasOwn(row, 'description'), hadDescriptionContent: Object.hasOwn(row, 'descriptionContent') })));
      await durableWrite(path.join(backupDirectory, 'manifest.json'), { status: 'prepared', database: db.databaseName, ...counts(before) });
      const updatedAt = new Date();
      for (let offset = 0; offset < changes.length; offset += 100) {
        const operations = changes.slice(offset, offset + 100).map(row => ({ updateOne: {
          filter: { _id: row._id, updatedAt: row.updatedAt ?? { $exists: false } },
          update: { $set: { description: '', descriptionContent: null, updatedAt } },
        } }));
        const result = await products.bulkWrite(operations, { session, ordered: true });
        if (result.matchedCount !== operations.length) throw new Error('A product changed concurrently; transaction cancelled');
      }
      const after = await products.find({}, { session }).toArray();
      const previous = new Map(before.map(row => [String(row._id), facts(row)]));
      if (after.length !== before.length || after.some(row => needsClear(row) || !isDeepStrictEqual(previous.get(String(row._id)), facts(row)))) throw new Error('Product verification failed; transaction cancelled');
      report = { status: 'applied', database: db.databaseName, ...counts(after), changedProducts: changes.length, otherProductFieldsUnchanged: true, appliedAt: updatedAt.toISOString(), backup: path.relative(root, backupDirectory).replaceAll('\\', '/') };
    });
    await durableWrite(path.join(backupDirectory, 'manifest.json'), report);
    console.log(JSON.stringify({ phase: 'committed', ...report }));
  }
  if (apply) {
    const verification = counts(await products.find({}, { projection: { description: 1, descriptionContent: 1 } }).toArray());
    if (verification.productsToChange) throw new Error('Post-commit verification failed');
    console.log(JSON.stringify({ phase: 'verified', ...verification }));
  }
} finally { await mongoose.disconnect(); }
