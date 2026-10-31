import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {parseJsonResponse,parseTree,text} from './product-parser.mjs';
import {parseProductArticle} from './product-article-parser.mjs';
const dir='.qa-perfume/product-article-media-2026-11-01',require=createRequire(new URL('../../server/package.json',import.meta.url));
const mongoose=require('mongoose');require('dotenv').config({path:fileURLToPath(new URL('../../server/.env',import.meta.url)),quiet:true});
fs.mkdirSync(path.join(dir,'api'),{recursive:true});
if(!fs.existsSync(path.join(dir,'products-before.ejson'))){
 try{
  await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:20000});
  if(mongoose.connection.name!=='vouges')throw Error('Unexpected database');
  const products=await mongoose.connection.collection('products').find({}).sort({_id:1}).toArray();
  fs.writeFileSync(path.join(dir,'products-before.ejson'),mongoose.mongo.BSON.EJSON.stringify(products,null,2,{relaxed:false}));
  fs.writeFileSync(path.join(dir,'products.json'),JSON.stringify(products,null,2));
 }finally{await mongoose.disconnect();}
}
const products=JSON.parse(fs.readFileSync(path.join(dir,'products.json'),'utf8')).filter(p=>!p.isDeleted);
if(products.some(p=>!p.source?.id||!p.source?.url))throw Error('Missing product source');
// Verify that the API description is the actual article below the product facts,
// rather than the short introduction shown alongside the purchase controls.
const probe=products.find(p=>p.source.id===50121);if(!probe)throw Error('Missing requested sample');
if(!fs.existsSync(path.join(dir,'adone-page.html'))){
 const response=await fetch(probe.source.url,{signal:AbortSignal.timeout(45000)});
 if(!response.ok||new URL(response.url).hostname!=='apaniche.vn')throw Error(`Page probe failed: ${response.status}`);
 fs.writeFileSync(path.join(dir,'adone-page.html'),await response.text());
}
const receipts=[];
for(let i=0;i<products.length;i+=80){
 const chunk=products.slice(i,i+80),file=path.join(dir,'api',`${i}.json`);
 if(fs.existsSync(file)){receipts.push(JSON.parse(fs.readFileSync(file,'utf8')));continue;}
 const url=`https://apaniche.vn/wp-json/wc/store/v1/products?per_page=100&include=${chunk.map(p=>p.source.id).join(',')}&_fields=id,name,permalink,description,short_description`;
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if([401,403,429].includes(response.status))throw Error(`Source refused: ${response.status}`);
 if(!response.ok||new URL(response.url).hostname!=='apaniche.vn')throw Error(`Collection failed: ${response.status}`);
 const raw=await response.text(),accept=rows=>Array.isArray(rows)&&rows.every(r=>Number.isInteger(r.id));
 let rows;try{rows=parseJsonResponse(raw,accept);}catch{fs.writeFileSync(file+'.raw',raw);rows=parseJsonResponse(raw.replace(/\\>/g,'>'),accept);}
 if(rows.length!==chunk.length||rows.some(row=>!chunk.some(p=>p.source.id===row.id)))throw Error(`Incomplete batch: ${i}`);
 const receipt={url,fetchedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(raw).digest('hex'),rows};
 fs.writeFileSync(file,JSON.stringify(receipt,null,2));receipts.push(receipt);
 console.log(JSON.stringify({collected:Math.min(i+80,products.length),total:products.length}));await new Promise(r=>setTimeout(r,500));
}
const rows=receipts.flatMap(receipt=>receipt.rows.map(row=>({...row,evidence:{apiUrl:receipt.url,fetchedAt:receipt.fetchedAt,sha256:receipt.sha256}})));
const adone=rows.find(row=>row.id===50121),html=fs.readFileSync(path.join(dir,'adone-page.html'),'utf8');
const walk=node=>[node,...(node.children||[]).filter(c=>typeof c==='object').flatMap(walk)];
const main=walk(parseTree(html)).find(n=>n.attrs?.id==='tab-description');
if(!main)throw Error('Actual lower-page description container missing');
const visible=text(main).replace(/\s+/gu,' '),api=text(parseTree(adone.description)).replace(/\s+/gu,' ');
const expected='Giới thiệu chung về nước hoa Agatho Parfum Adone';
if(!visible.includes(expected)||!api.includes(expected)||!visible.includes('Maurizio Cerizza')||!api.includes('Maurizio Cerizza'))throw Error('Detailed article mismatch');
const articlePhotos=parseProductArticle(adone.description,adone.permalink).images.map(image=>image.sourceUrl);
const visiblePhotos=new Set(walk(main).filter(node=>node.tag==='img').map(node=>new URL(node.attrs['data-lazy-src']||node.attrs['data-src']||node.attrs.src,adone.permalink).href));
if(articlePhotos.length!==3||articlePhotos.some(url=>!visiblePhotos.has(url)))throw Error('Lower-page article illustrations mismatch');
fs.writeFileSync(path.join(dir,'source-descriptions.json'),JSON.stringify(rows,null,2));
fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({url:probe.source.url,selector:'#tab-description',matchedHeading:expected,matchedArticlePhotos:articlePhotos.length,apiIsLowerPageArticle:true,sourceProducts:rows.length},null,2));
console.log(JSON.stringify({received:rows.length,verifiedLowerPage:true}));
