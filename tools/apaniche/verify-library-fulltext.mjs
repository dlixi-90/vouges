import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {mediaFields} from '../../server/services/mediaMigration.js';
import {articleToPlainText} from '../../client/src/utils/productArticle.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'data/library-fulltext-2026-11-01');
const require=createRequire(new URL('../../server/package.json',import.meta.url)),mongoose=require('mongoose');require('dotenv').config({path:path.join(root,'server/.env'),quiet:true});
const plan=JSON.parse(await fs.readFile(path.join(directory,'plan.json'),'utf8')).entries;
const result=JSON.parse(await fs.readFile(path.join(directory,'result.json'),'utf8'));
const backup=path.resolve(root,result.backup);
if(!backup.startsWith(path.join(root,'.backups')+path.sep))throw Error('Unexpected backup path');
const before=mongoose.mongo.BSON.EJSON.parse(await fs.readFile(path.join(backup,'terms-before.ejson'),'utf8'),{relaxed:true});
const byId=new Map(plan.map(row=>[row.id,row])),previous=new Map(before.map(row=>[String(row._id),row]));
const mutable=new Set(['description','descriptionContent','contentStatus','contentImport','updatedAt']);
const facts=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!mutable.has(key)));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
try{
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000});const db=mongoose.connection.db;if(db.databaseName!=='vouges')throw Error('Unexpected database');
 const terms=await db.collection('fragranceterms').find({kind:{$in:['group','accord','note']}}).toArray();
 if(terms.length!==plan.length)throw Error('Term count differs from source scope');
 const images=new Set();let labels=0;
 for(const term of terms){
  const expected=byId.get(String(term._id));
  if(!expected||digest(term.descriptionContent)!==expected.documentSha256||term.description!==expected.description)throw Error('Full article mismatch: '+term.name);
  if(!isDeepStrictEqual(facts(term),facts(previous.get(String(term._id)))))throw Error('Protected metadata mismatch: '+term.name);
  labels+=term.descriptionContent.content.filter(node=>node.type==='heading'&&articleToPlainText(node)==='Hình ảnh liên quan').length;
  mediaFields(term,'fragranceterms',value=>{if(typeof value==='string'&&value)images.add(value);return value;});
 }
 if(labels)throw Error('Generated image heading remains');
 for(const image of images){if(image.startsWith('/images/'))await fs.access(path.join(root,'client/public',image));else if(!/^https:\/\/res\.cloudinary\.com\//u.test(image))throw Error('Unexpected image delivery: '+image);}
 const downloaded=JSON.parse(await fs.readFile(path.join(directory,'downloaded-images.json'),'utf8'));
 for(const row of Object.values(downloaded)){const bytes=await fs.readFile(path.join(root,'client/public',row.src));if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Downloaded image changed');}
 const productsWithDescriptions=await db.collection('products').countDocuments({$or:[{description:{$nin:['',null]}},{descriptionContent:{$ne:null}}]});
 const report={verifiedAt:new Date().toISOString(),articles:terms.length,documentDigestsMatch:terms.length,sourcePages:plan.length,protectedMetadataUnchanged:true,generatedImageHeadings:labels,uniqueDeliveryImages:images.size,externalApanicheImages:0,newImagesVerified:Object.keys(downloaded).length,productsWithDescriptions};
 await fs.writeFile(path.join(directory,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await mongoose.disconnect();}
