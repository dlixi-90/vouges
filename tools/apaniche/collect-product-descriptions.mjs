import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseJsonResponse} from './product-parser.mjs';

const dir='.qa-perfume/product-descriptions-2026-11-01',products=JSON.parse(fs.readFileSync(path.join(dir,'products.json'))).filter(p=>!p.isDeleted);
const cache=path.join(dir,'api');fs.mkdirSync(cache,{recursive:true});
const receipts=[];
for(let i=0;i<products.length;i+=80){
 const chunk=products.slice(i,i+80),file=path.join(cache,`${i}.json`);
 if(fs.existsSync(file)){receipts.push(JSON.parse(fs.readFileSync(file)));continue;}
 const sourceUrl=`https://apaniche.vn/wp-json/wc/store/v1/products?per_page=100&include=${chunk.map(p=>p.source.id).join(',')}&_fields=id,name,permalink,description,short_description`;
 const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(45000)});
 if([401,403,429].includes(response.status))throw Error(`Source refused collection: ${response.status}`);
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 if(new URL(response.url).hostname!=='apaniche.vn')throw Error('Unexpected redirect');
 const raw=await response.text();
 const accept=v=>Array.isArray(v)&&v.every(p=>Number.isInteger(p.id));
 let rows;try{rows=parseJsonResponse(raw,accept);}catch{
  // A few legacy descriptions contain a literal, invalid JSON escape before >.
  fs.writeFileSync(path.join(cache,`${i}-raw.txt`),raw);
  rows=parseJsonResponse(raw.replace(/\\>/g,'>'),accept);
 }
 if(rows.some(r=>!chunk.some(p=>p.source.id===r.id)))throw Error('Unexpected source ID');
 const receipt={url:sourceUrl,fetchedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(raw).digest('hex'),rows};
 fs.writeFileSync(file,JSON.stringify(receipt,null,2));receipts.push(receipt);
 console.log(JSON.stringify({checked:Math.min(i+80,products.length),total:products.length,received:rows.length}));
 await new Promise(r=>setTimeout(r,650));
}
const rows=receipts.flatMap(r=>r.rows.map(p=>({...p,evidence:{apiUrl:r.url,fetchedAt:r.fetchedAt,sha256:r.sha256}})));
fs.writeFileSync(path.join(dir,'source-descriptions.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify({total:products.length,received:rows.length,missing:products.filter(p=>!rows.some(r=>r.id===p.source.id)).map(p=>({id:String(p._id),title:p.title,url:p.source.url})),empty:rows.filter(r=>!r.description?.trim()).map(r=>({id:r.id,title:r.name,url:r.permalink}))}));
