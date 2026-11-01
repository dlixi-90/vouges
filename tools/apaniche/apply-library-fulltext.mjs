import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {sanitizeArticle,LIBRARY_ARTICLE_LIMITS} from '../../client/src/utils/productArticle.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'data/library-fulltext-2026-11-01');
const require=createRequire(new URL('../../server/package.json',import.meta.url));
const mongoose=require('mongoose');require('dotenv').config({path:path.join(root,'server/.env'),quiet:true});
const apply=process.argv.includes('--apply');if(apply&&!process.argv.includes('--database=vouges'))throw Error('Applying requires --database=vouges');
const read=async file=>JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
const plan=await read('plan.json'),preparation=await read('preparation.json'),permission=await read('authorization.json');
if(!permission.authorization||plan.entries.length!==1049||preparation.failures.length||preparation.missingImages.length)throw Error('Full source preparation is incomplete');
const targets=new Map(plan.entries.map(row=>[row.id,row]));
const mutable=new Set(['description','descriptionContent','contentStatus','contentImport','updatedAt']);
const facts=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!mutable.has(key)));
const digest=doc=>createHash('sha256').update(JSON.stringify(doc)).digest('hex');
const validate=async row=>{
 if(!['group','accord','note'].includes(row.kind))throw Error('Unexpected article kind');
 if(!isDeepStrictEqual(sanitizeArticle(row.descriptionContent,LIBRARY_ARTICLE_LIMITS),row.descriptionContent)||digest(row.descriptionContent)!==row.documentSha256)throw Error('Invalid prepared article');
 const source=await fs.readFile(path.join(directory,'pages',row.id+'.html'));
 if(createHash('sha256').update(source).digest('hex')!==row.sourceSha256)throw Error('Source digest changed');
};
for(const row of plan.entries)await validate(row);
const durableWrite=async(file,value)=>{const handle=await fs.open(file,'w');try{await handle.writeFile(mongoose.mongo.BSON.EJSON.stringify(value,null,2,{relaxed:false})+'\n');await handle.sync();}finally{await handle.close();}};
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db;if(db.databaseName!=='vouges')throw Error('Unexpected database');
 const collection=db.collection('fragranceterms');
 const before=await collection.find({}).toArray();
 const byId=new Map(before.map(row=>[String(row._id),row]));
 for(const row of plan.entries){const current=byId.get(row.id);if(!current||current.kind!==row.kind||current.name!==row.name||current.key!==row.key||current.sourceUrl!==row.url||new Date(current.updatedAt).toISOString()!==row.expectedUpdatedAt)throw Error('Article changed since collection: '+row.name);}
 console.log(JSON.stringify({phase:'preview',articles:plan.entries.length,sourcePages:1049,sourceTextCharacters:preparation.textCharacters,imageInstances:preparation.imageInstances,missingImages:0}));
 if(apply){
  const at=new Date(),backup=path.join(root,'.backups','library-fulltext-'+at.toISOString().replaceAll(/[:.]/gu,'-'));
  await fs.mkdir(backup,{recursive:true});await durableWrite(path.join(backup,'terms-before.ejson'),before);await durableWrite(path.join(backup,'authorization.json'),permission);
  await durableWrite(path.join(backup,'manifest.json'),{status:'prepared',articles:plan.entries.length,planSha256:digest(plan),at});
  await mongoose.connection.transaction(async session=>{
   for(let offset=0;offset<plan.entries.length;offset+=50){
    const batch=plan.entries.slice(offset,offset+50);
    const result=await collection.bulkWrite(batch.map(row=>({updateOne:{filter:{_id:byId.get(row.id)._id,updatedAt:new Date(row.expectedUpdatedAt)},update:{$set:{description:row.description,descriptionContent:row.descriptionContent,contentStatus:row.contentStatus,updatedAt:at,contentImport:{runId:'library-fulltext-2026-11-01',method:'authorized-full-source',url:row.url,sha256:row.sourceSha256,fetchedAt:row.fetchedAt,sourceTitle:row.sourceTitle,sourceTextBlocks:row.sourceTextBlocks,sourceCharacters:row.sourceCharacters,imageCount:row.imageCount,documentSha256:row.documentSha256,relatedHeading:row.relatedHeading,appliedAt:at}}}}})),{session,ordered:true});
    if(result.matchedCount!==batch.length)throw Error('Concurrent article change; transaction cancelled');
   }
   const after=await collection.find({},{session}).toArray();if(after.length!==before.length)throw Error('Term count changed');
   for(const row of after){const old=byId.get(String(row._id)),target=targets.get(String(row._id));if(!old||!isDeepStrictEqual(facts(row),facts(old)))throw Error('Protected term metadata changed');if(target){if(digest(row.descriptionContent)!==target.documentSha256||row.description!==target.description)throw Error('Imported article verification failed');}else if(!isDeepStrictEqual(row,old))throw Error('Unrelated term was changed');}
  });
  const after=await collection.find({kind:{$in:['group','accord','note']}},{projection:{description:1,descriptionContent:1,contentImport:1}}).toArray();
  for(const row of after)if(digest(row.descriptionContent)!==targets.get(String(row._id))?.documentSha256)throw Error('Post-commit verification failed');
  const report={status:'applied',at:at.toISOString(),articles:after.length,sourcePages:1049,sourceTextCharacters:preparation.textCharacters,imageInstances:preparation.imageInstances,documentDigestsVerified:after.length,protectedTermMetadataUnchanged:true,brandArticlesChanged:0,productsChanged:0,newCloudinaryUploads:0,backup:path.relative(root,backup).replaceAll('\\','/')};
  await durableWrite(path.join(backup,'manifest.json'),report);await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase:'verified',...report}));
 }
}finally{await mongoose.disconnect();}
