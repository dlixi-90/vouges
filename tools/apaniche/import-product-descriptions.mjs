import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {productDescriptionUpdate} from './product-description-import-plan.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
const require=createRequire(new URL('../../server/package.json',import.meta.url)),mongoose=require('mongoose');
require('dotenv').config({path:fileURLToPath(new URL('../../server/.env',import.meta.url)),quiet:true});
const manifest=JSON.parse(fs.readFileSync('data/product-descriptions-2026-11-01.json'));
const apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--database=vouges'))throw Error('Explicit target required');
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:20000});
 if(mongoose.connection.name!=='vouges')throw Error('Wrong database');
 const collection=mongoose.connection.collection('products'),sources=mongoose.connection.collection('catalogsources');
 const before=await collection.find({}).sort({_id:1}).toArray(),byId=new Map(before.map(p=>[String(p._id),p]));
 const originalSources=await sources.find({}).sort({_id:1}).toArray();
 if(manifest.entries.length!==before.filter(p=>!p.isDeleted).length||new Set(manifest.entries.map(e=>e.id)).size!==manifest.entries.length)throw Error('Catalog scope changed');
 const at=new Date(),plans=manifest.entries.map(entry=>({entry,set:productDescriptionUpdate(byId.get(entry.id),entry,at)})).filter(p=>p.set);
 console.log(JSON.stringify({mode:apply?'apply':'preview',catalogProducts:manifest.entries.length,updates:plans.length,archivedUntouched:before.filter(p=>p.isDeleted).length}));
 if(apply&&plans.length){
  const backup=path.join('.backups',`${manifest.runId}-${at.toISOString().replace(/[:.]/g,'-')}`);fs.mkdirSync(backup,{recursive:true});
  const save=(name,value)=>fs.writeFileSync(path.join(backup,name),mongoose.mongo.BSON.EJSON.stringify(value,null,2,{relaxed:false}));
  save('products-before.ejson',before);save('sources-before.ejson',originalSources);fs.copyFileSync('data/product-descriptions-2026-11-01.json',path.join(backup,'manifest.json'));
  await mongoose.connection.transaction(async session=>{
   const result=await collection.bulkWrite(plans.map(({entry,set})=>({updateOne:{filter:{_id:byId.get(entry.id)._id,updatedAt:byId.get(entry.id).updatedAt,isDeleted:{$ne:true}},update:{$set:set}}})),{session});
   if(result.matchedCount!==plans.length||result.modifiedCount!==plans.length)throw Error('Concurrent edit; rolling back');
   const after=await collection.find({},{session}).sort({_id:1}).toArray(),changes=new Map(plans.map(p=>[p.entry.id,p]));
   if(after.length!==before.length)throw Error('Product count changed');
   for(const row of after){const old=byId.get(String(row._id)),plan=changes.get(String(row._id));if(!isDeepStrictEqual(row,plan?{...old,...plan.set}:old))throw Error(`Unexpected changes: ${row.title}`);}
   if(!isDeepStrictEqual(await sources.find({},{session}).sort({_id:1}).toArray(),originalSources))throw Error('Original source records changed');
  });
  const verified=await collection.find({isDeleted:{$ne:true}}).project({description:1,descriptionContent:1}).toArray();
  const result={runId:manifest.runId,appliedAt:at,backupDirectory:backup,updated:plans.length,catalogProducts:verified.length,
   matchingPreparedDescriptions:verified.filter(p=>manifest.entries.some(e=>e.id===String(p._id)&&e.description===p.description&&isDeepStrictEqual(e.descriptionContent,p.descriptionContent))).length,
   structuredDescriptions:verified.filter(p=>p.descriptionContent?.type==='doc').length,unchangedArchives:before.filter(p=>p.isDeleted).length,
   supplementarySources:manifest.entries.filter(e=>e.evidence.supplementaryUrls.length).length,storeMentions:verified.filter(p=>mentionsSourceStore(p.description)).length,
   replacedOwnerEdits:true,changedFields:['description','descriptionContent','updatedAt'],originalSourcesPreserved:true};
  if(fs.existsSync('data/product-descriptions-2026-11-01-result.json')){
   const previous=JSON.parse(fs.readFileSync('data/product-descriptions-2026-11-01-result.json'));
   result.previousApplications=[...(previous.previousApplications||[]),{appliedAt:previous.appliedAt,updated:previous.updated,backupDirectory:previous.backupDirectory}];
  }
  fs.writeFileSync('data/product-descriptions-2026-11-01-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }
}finally{await mongoose.disconnect();}
