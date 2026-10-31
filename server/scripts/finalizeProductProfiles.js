import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import CatalogSource from '../models/CatalogSource.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { prepareProfileFinalization } from '../services/productProfileFinalization.js';
import { productQualityIssues } from '../services/productQuality.js';
import { isSizeAvailable } from '../utils/productStock.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
dotenv.config({path:path.join(root,'server/.env'),quiet:true});
const apply=process.argv.includes('--apply');
assert.ok(process.argv.includes('--database=vouges'),'Explicit --database=vouges required');
const manifestPath=path.join(root,'data/product-profile-finalization-2026-10-31.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
assert.equal(manifest.products.length,14);assert.equal(new Set(manifest.products.map(p=>p.id)).size,14);
const ids=manifest.products.map(p=>new mongoose.Types.ObjectId(p.id));
const visible={isDeleted:{$ne:true},isPublished:{$ne:false}};
const orderable=p=>(p.sizes||[]).some(size=>Number.isSafeInteger(p.price?.[size])&&p.price[size]>0&&isSizeAvailable(p,size));
const writeEjson=(file,rows)=>fs.writeFileSync(file,mongoose.mongo.BSON.EJSON.stringify(rows,null,2,{relaxed:false}));
// Normalize BSON IDs before cloning; structuredClone strips ObjectId.toJSON().
const assign=(p,set)=>{const next=JSON.parse(JSON.stringify(p));for(const[key,value]of Object.entries(set)){const segments=key.split('.');let o=next;for(const s of segments.slice(0,-1))o=o[s]??={};o[segments.at(-1)]=value;}return next;};
async function references(plans,session){
 const changed=plans.filter(p=>p.record.variants?.length);
 const pending=await Order.find({paymentMethod:'QR',isPaid:false,status:{$in:['Awaiting Payment','Payment Review']},'items.product':{$in:changed.map(p=>p.record.id)}}).select('_id').session(session||null).lean();
 assert.equal(pending.length,0,'Pending QR orders reference a commerce update');
 const renamed=changed.filter(p=>p.removedSizes.length);
 const carts=renamed.length?await User.find({$or:renamed.map(p=>({[`cartData.${p.record.id}`]:{$exists:true}}))}).select('_id cartData updatedAt').session(session||null).lean():[];
 for(const plan of renamed)for(const cart of carts)for(const size of plan.removedSizes)assert.ok(!(Number(cart.cartData?.[plan.record.id]?.[size])>0),'Cart references the renamed capacity');
 return {pending,carts};
}
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:20000});
 assert.equal(mongoose.connection.name,'vouges');
 const products=await Product.find({_id:{$in:ids}}).sort({_id:1}).lean();assert.equal(products.length,14);
 if(products.every(p=>p.source?.profileCompletion?.runId===manifest.runId)){
  for(const p of products)assert.deepEqual(productQualityIssues(p),[]);
  console.log(JSON.stringify({alreadyApplied:true,complete:14}));
 }else{
  const now=new Date();
  const plans=manifest.products.map(record=>{const product=products.find(p=>String(p._id)===record.id);return{record,product,...prepareProfileFinalization(product,record,manifest.runId,now)};});
  const refs=await references(plans);
  const sources=await CatalogSource.find({productId:{$in:ids}}).sort({_id:1}).lean();assert.equal(sources.length,14);
  const allBefore=await Product.find(visible).select('_id sizes price stockBySize inStockBySize inStock inventoryMode isPublished isDeleted qualityIssues').lean();
  const summary={database:mongoose.connection.name,applied:false,profiles:14,complete:plans.filter(p=>!p.set.qualityIssues.length).length,priceUpdates:manifest.products.reduce((n,p)=>n+(p.variants?.length||0),0),retailReplacements:manifest.products.flatMap(p=>p.variants||[]).filter(v=>v.kind==='add').length,generatedStock:manifest.products.flatMap(p=>(p.variants||[]).filter(v=>v.generatedQuantity).map(v=>({sourceId:p.sourceId,size:v.size,quantity:v.generatedQuantity}))),pendingQrOrders:refs.pending.length,referencedCarts:refs.carts.length,orderableBefore:allBefore.filter(orderable).length};
  if(apply){
   const backup=path.join(root,'.backups',`finalize-product-profiles-${now.toISOString().replace(/[:.]/g,'-')}`);
   fs.mkdirSync(backup,{recursive:true});
   writeEjson(path.join(backup,'products.ejson'),products);writeEjson(path.join(backup,'catalog-sources.ejson'),sources);writeEjson(path.join(backup,'referenced-carts.ejson'),refs.carts);
   fs.copyFileSync(manifestPath,path.join(backup,'manifest.json'));
   await mongoose.connection.transaction(async session=>{
    await references(plans,session);
    const before=await Product.find({_id:{$in:ids}}).sort({_id:1}).session(session).lean();
    assert.ok(isDeepStrictEqual(before,products),'Product changed after backup');
    for(const plan of plans){const r=await Product.updateOne({_id:plan.product._id,updatedAt:plan.product.updatedAt,...visible},{$set:{...plan.set,updatedAt:now}},{session,timestamps:false,runValidators:true});assert.equal(r.matchedCount,1,'Concurrent product edit');}
    const after=await Product.find({_id:{$in:ids}}).sort({_id:1}).session(session).lean();
    for(const saved of after){
     const plan=plans.find(p=>String(p.product._id)===String(saved._id));
     const expected=assign(plan.product,plan.set);expected.updatedAt=now;
     // Compare the whole document: articles, valid prices, existing stock and media must survive.
     assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(saved)),JSON.parse(JSON.stringify(expected))),`Unexpected field change: ${saved.source.id}`);
     assert.deepEqual(productQualityIssues(saved),[]);
    }
    assert.ok(isDeepStrictEqual(await CatalogSource.find({_id:{$in:sources.map(p=>p._id)}}).sort({_id:1}).session(session).lean(),sources),'Original source records changed');
   });
   const allAfter=await Product.find(visible).select('_id sizes price stockBySize inStockBySize inStock inventoryMode isPublished isDeleted qualityIssues').lean();
   assert.equal(allAfter.length,allBefore.length,'Active catalog count changed');
   const untouched=allBefore.filter(p=>!ids.some(id=>id.equals(p._id)));
   for(const p of untouched)assert.ok(isDeepStrictEqual(allAfter.find(q=>String(q._id)===String(p._id)),p),'Unrelated product changed');
   summary.applied=true;summary.backupDirectory=path.relative(root,backup);summary.activeProducts=allAfter.length;
   summary.orderableAfter=allAfter.filter(orderable).length;summary.remainingReviewProfiles=allAfter.filter(p=>p.qualityIssues?.length).length;
   summary.testVariantsRemaining=allAfter.flatMap(p=>p.sizes||[]).filter(s=>/test(?:er)?\s*$/i.test(s)).length;
   fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify(summary,null,2));
   fs.writeFileSync(path.join(root,'.qa-perfume/profile-finalization-2026-10-31/applied.json'),JSON.stringify(summary,null,2));
  }
  console.log(JSON.stringify(summary));
 }
}finally{await mongoose.disconnect();}
