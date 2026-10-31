import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {productArticleUpdate} from './product-article-import-plan.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
const require=createRequire(new URL('../../server/package.json',import.meta.url)),mongoose=require('mongoose');
require('dotenv').config({path:fileURLToPath(new URL('../../server/.env',import.meta.url)),quiet:true});
const manifest=JSON.parse(fs.readFileSync('data/product-article-media-2026-11-01.json','utf8')),apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--database=vouges'))throw Error('Explicit target database required');
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:20000});
 if(mongoose.connection.name!=='vouges')throw Error('Unexpected database');
 const collection=mongoose.connection.collection('products'),sources=mongoose.connection.collection('catalogsources');
 const before=await collection.find({}).sort({_id:1}).toArray(),sourceBefore=await sources.find({}).sort({_id:1}).toArray();
 const byId=new Map(before.map(row=>[String(row._id),row]));
 if(before.filter(row=>!row.isDeleted).length!==manifest.entries.length||new Set(manifest.entries.map(row=>row.id)).size!==manifest.entries.length)throw Error('Product scope changed');
 const at=new Date(),plans=manifest.entries.map(entry=>({entry,set:productArticleUpdate(byId.get(entry.id),entry,at)})).filter(row=>row.set);
 for(const asset of manifest.assets)if(!fs.existsSync(path.join('client/public',asset.src)))throw Error('Missing local illustration');
 console.log(JSON.stringify({mode:apply?'apply':'preview',products:manifest.entries.length,updates:plans.length,archivedUntouched:before.filter(row=>row.isDeleted).length}));
 if(apply&&plans.length){
  const backup=path.join('.backups',`${manifest.runId}-${at.toISOString().replace(/[:.]/gu,'-')}`);fs.mkdirSync(backup,{recursive:true});
  const save=(name,data)=>fs.writeFileSync(path.join(backup,name),mongoose.mongo.BSON.EJSON.stringify(data,null,2,{relaxed:false}));
  save('products-before.ejson',before);save('sources-before.ejson',sourceBefore);fs.copyFileSync('data/product-article-media-2026-11-01.json',path.join(backup,'manifest.json'));
  await mongoose.connection.transaction(async session=>{
   const result=await collection.bulkWrite(plans.map(({entry,set})=>({updateOne:{filter:{_id:byId.get(entry.id)._id,updatedAt:byId.get(entry.id).updatedAt,isDeleted:{$ne:true}},update:{$set:set}}})),{session});
   if(result.matchedCount!==plans.length||result.modifiedCount!==plans.length)throw Error('Concurrent edits; rolling back');
   const after=await collection.find({},{session}).sort({_id:1}).toArray(),byPlan=new Map(plans.map(plan=>[plan.entry.id,plan]));
   if(before.length!==after.length)throw Error('Product count changed');
   for(const row of after){const old=byId.get(String(row._id)),plan=byPlan.get(String(row._id));if(!isDeepStrictEqual(row,plan?{...old,...plan.set}:old))throw Error(`Unexpected product changes: ${row.title}`);}
   if(!isDeepStrictEqual(await sources.find({},{session}).sort({_id:1}).toArray(),sourceBefore))throw Error('Original source records changed');
  });
  const after=await collection.find({isDeleted:{$ne:true}}).project({description:1,descriptionContent:1}).toArray();
  const report={runId:manifest.runId,appliedAt:at,backupDirectory:backup,updated:plans.length,products:after.length,matchingPrepared:after.filter(product=>manifest.entries.some(entry=>entry.id===String(product._id)&&entry.description===product.description&&isDeepStrictEqual(entry.descriptionContent,product.descriptionContent))).length,
   withArticleImages:manifest.entries.filter(row=>row.imageCount).length,inlineImages:manifest.entries.reduce((n,row)=>n+row.imageCount,0),uniqueImageUrls:manifest.assets.length,uniqueLocalImages:new Set(manifest.assets.map(asset=>asset.src)).size,
   supplementaryDescriptions:manifest.entries.filter(row=>row.evidence.supplementaryUrls.length).length,archivedUntouched:before.filter(row=>row.isDeleted).length,sourceStoreMentions:after.filter(row=>mentionsSourceStore(row.description)).length,
   unavailableImages:manifest.entries.flatMap(row=>row.evidence.unavailableImages.map(image=>({title:row.title,productUrl:row.evidence.originalUrl,reason:image.reason}))),
   changedFields:['description','descriptionContent','updatedAt'],originalSourcesPreserved:true,missingSourceImages:manifest.entries.filter(row=>!row.imageCount).map(row=>({id:row.id,title:row.title,url:row.evidence.originalUrl}))};
  fs.writeFileSync('data/product-article-media-2026-11-01-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
}finally{await mongoose.disconnect();}
