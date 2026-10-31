import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mentionsSourceStore} from './library-parser.mjs';
import {validateRefreshEntry} from './library-refresh-plan.mjs';
const require=createRequire(new URL('../../server/package.json',import.meta.url)),mongoose=require('mongoose');
require('dotenv').config({path:fileURLToPath(new URL('../../server/.env',import.meta.url)),quiet:true});
const manifest=JSON.parse(fs.readFileSync('data/library-refresh-2026-11-01.json','utf8'));
const apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--database=vouges'))throw Error('Explicit target database required');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const mutable=new Set(['description','descriptionContent','contentStatus','contentImport','image','updatedAt']);
const protectedPart=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!mutable.has(key)));
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:20000});
 if(mongoose.connection.name!=='vouges')throw Error('Unexpected database');
 const collection=mongoose.connection.collection('fragranceterms'),before=await collection.find({}).sort({_id:1}).toArray();
 if(before.length!==manifest.audited||manifest.entries.length!==manifest.total)throw Error('Collection count changed; re-audit first');
 const byId=new Map(before.map(row=>[String(row._id),row]));
 for(const entry of manifest.entries)validateRefreshEntry(byId.get(entry.id),entry);
 for(const asset of manifest.assets)if(!fs.existsSync(path.join('client/public',asset.src)))throw Error('Missing local asset');
 const at=new Date(),updates=manifest.entries.filter(e=>!e.isNew),inserts=manifest.entries.filter(e=>e.isNew);
 console.log(JSON.stringify({mode:apply?'apply':'preview',existing:before.length,updates:updates.length,inserts:inserts.length}));
 if(apply){
  const backup=path.join('.backups',`${manifest.runId}-${at.toISOString().replace(/[:.]/g,'-')}`);fs.mkdirSync(backup,{recursive:true});
  fs.writeFileSync(path.join(backup,'terms-before.ejson'),mongoose.mongo.BSON.EJSON.stringify(before,null,2,{relaxed:false}));
  fs.copyFileSync('data/library-refresh-2026-11-01.json',path.join(backup,'manifest.json'));
  const fields=entry=>({description:entry.description,descriptionContent:entry.descriptionContent,image:entry.image,contentStatus:entry.contentStatus,contentImport:{runId:manifest.runId,...entry.evidence,appliedAt:at},updatedAt:at});
  await mongoose.connection.transaction(async session=>{
   const result=await collection.bulkWrite(updates.map(entry=>({updateOne:{filter:{_id:byId.get(entry.id)._id,updatedAt:byId.get(entry.id).updatedAt},update:{$set:fields(entry)}}})),{session});
   if(result.matchedCount!==updates.length)throw Error('Concurrent edits; rolling back');
   await collection.insertMany(inserts.map(entry=>({_id:new mongoose.Types.ObjectId(entry.id),kind:entry.kind,key:entry.key,name:entry.name,sourceUrl:entry.sourceUrl,productCount:0,createdAt:at,...fields(entry)})),{session});
   const after=await collection.find({},{session}).toArray();if(after.length!==manifest.total)throw Error('Count verification failed');
   for(const row of after){const entry=manifest.entries.find(e=>e.id===String(row._id)),old=byId.get(String(row._id));
    if(!entry||old&&!same(protectedPart(old),protectedPart(row)))throw Error('Protected fields changed');
    if(row.description!==entry.description||!same(row.descriptionContent,entry.descriptionContent)||row.image!==entry.image||row.contentStatus!==entry.contentStatus)throw Error('Content verification failed');
   }
  });
  const after=await collection.find({}).toArray();
  const report={runId:manifest.runId,at,backup,total:after.length,updated:updates.length,inserted:inserts.length,complete:after.filter(row=>row.contentStatus==='complete').length,withImages:after.filter(row=>row.image).length,
   originalImageUrls:manifest.assets.length,uniqueLocalImages:new Set(manifest.assets.map(a=>a.src)).size,sourceStoreMentions:after.filter(row=>mentionsSourceStore(row.description)).length,
   missing:manifest.entries.filter(row=>row.contentStatus==='linked').map(({id,kind,name,sourceUrl})=>({id,kind,name,url:sourceUrl}))};
  fs.writeFileSync('data/library-refresh-2026-11-01-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
}finally{await mongoose.disconnect();}
