import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {planLibraryImport} from './library-import-plan.mjs';
import {mentionsSourceStore} from './library-parser.mjs';

const require=createRequire(new URL('../../server/package.json',import.meta.url));
const mongoose=require('mongoose');require('dotenv').config({path:fileURLToPath(new URL('../../server/.env',import.meta.url)),quiet:true});
const manifest=JSON.parse(fs.readFileSync('data/library-content-import-2026-10-31.json'));
const apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--database=vouges'))throw Error('Explicit target database required');
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:20000});
 if(mongoose.connection.name!=='vouges')throw Error('Unexpected database');
 const collection=mongoose.connection.collection('fragranceterms');
 const before=await collection.find({}).toArray();
 if(before.length!==manifest.audited)throw Error('Term count changed; re-audit first');
 const byId=new Map(before.map(t=>[String(t._id),t])),at=new Date();
 const updates=manifest.entries.map(entry=>({entry,update:planLibraryImport(byId.get(entry.id),entry,manifest.runId,at)})).filter(row=>row.update);
 console.log(JSON.stringify({mode:apply?'apply':'preview',total:before.length,updates:updates.length,missing:manifest.missing.length}));
 if(apply&&updates.length){
  const backup=path.join('.backups',`${manifest.runId}-${at.toISOString().replace(/[:.]/g,'-')}`);fs.mkdirSync(backup,{recursive:true});
  fs.writeFileSync(path.join(backup,'terms-before.ejson'),mongoose.mongo.BSON.EJSON.stringify(before,null,2,{relaxed:false}));
  fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
  await mongoose.connection.transaction(async session=>{
   const result=await collection.bulkWrite(updates.map(({entry,update})=>({updateOne:{filter:{_id:byId.get(entry.id)._id,updatedAt:byId.get(entry.id).updatedAt},update:{$set:update}}})),{session});
   if(result.matchedCount!==updates.length||result.modifiedCount!==updates.length)throw Error('Concurrent edits; rolling back');
   const after=await collection.find({},{session}).toArray();
   const mutable=new Set(['description','descriptionContent','contentStatus','name','contentImport','updatedAt']);
   for(const row of after){
    const old=byId.get(String(row._id)),change=updates.find(u=>u.entry.id===String(row._id));
    const protectedPart=obj=>Object.fromEntries(Object.entries(obj).filter(([key])=>!mutable.has(key)));
    if(!old||JSON.stringify(protectedPart(row))!==JSON.stringify(protectedPart(old)))throw Error('Protected fields changed');
    if(!change&&JSON.stringify(row)!==JSON.stringify(old))throw Error('Unexpected term changed');
    if(change&&(row.description!==change.entry.description||mentionsSourceStore(row.description)||JSON.stringify(row.descriptionContent)!==JSON.stringify(change.update.descriptionContent)))throw Error('Content verification failed');
   }
  });
  const verified=await collection.find({}).toArray();
  const report={runId:manifest.runId,at,backup,total:verified.length,updated:updates.length,complete:verified.filter(t=>t.contentStatus==='complete').length,filledNames:updates.filter(u=>u.update.name).length,
   sourceStoreMentions:verified.filter(t=>mentionsSourceStore(t.description||'')).length,missing:manifest.missing};
  fs.writeFileSync('data/library-content-import-2026-10-31-result.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
 }
}finally{await mongoose.disconnect();}
