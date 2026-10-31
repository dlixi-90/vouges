import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {parseLibraryArticle} from './library-source-media.mjs';
const require=createRequire(new URL('../../client/package.json',import.meta.url)),sharp=require('sharp');
const dir='.qa-perfume/library-refresh-2026-11-01',output='client/public/images/library',originals=path.join(dir,'originals');
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(originals,{recursive:true});
const scope=JSON.parse(fs.readFileSync(path.join(dir,'scope.json'))),directories=JSON.parse(fs.readFileSync(path.join(dir,'directories.json'))),files=fs.readdirSync(path.join(dir,'pages')).filter(f=>f.endsWith('.json'));
const rows=files.map(file=>{const row=JSON.parse(fs.readFileSync(path.join(dir,'pages',file)));row.content=parseLibraryArticle(fs.readFileSync(path.join(dir,'pages',`${row.id}.html`),'utf8'),row.kind,row.url);return row;});
const all=[...rows.flatMap(r=>[...(r.cover?[r.cover]:[]),...r.content.media]),...directories.flatMap(d=>[...d.introMedia,...d.origins.flatMap(o=>o.media)])];
const unique=[...new Map(all.map(m=>[m.sourceUrl,m])).values()],log=path.join(dir,'media.jsonl');
const old=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const saved=new Map(old.filter(r=>r.status==='ok').map(r=>[r.sourceUrl,r]));let next=0,done=0,stop=false;
await Promise.all(Array.from({length:3},async()=>{
 while(next<unique.length&&!stop){const item=unique[next++];if(saved.has(item.sourceUrl)){done++;continue;}
  const receipt={sourceUrl:item.sourceUrl};
  try{
   const url=new URL(item.sourceUrl);if(url.hostname!=='apaniche.vn'||url.protocol!=='https:')throw Error('Unexpected media host');
   const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if([401,403,429].includes(r.status)){stop=true;throw Error(`Source refused: ${r.status}`);}if(!r.ok)throw Error(`HTTP ${r.status}`);
   if(new URL(r.url).hostname!=='apaniche.vn'||!/^image\/(?:png|jpeg|webp|gif|avif)/i.test(r.headers.get('content-type')||''))throw Error('Invalid media response');
   const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>15*1024*1024)throw Error('Oversized image');
   const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),stem=sha256.slice(0,24),metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();
   fs.writeFileSync(path.join(originals,`${stem}.${metadata.format}`),bytes);
   // Resize only; retain the complete frame and every original mark/credit.
   await sharp(bytes).rotate().resize({width:1440,height:1440,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toFile(path.join(output,`${stem}.webp`));
   await sharp(bytes).rotate().resize({width:360,height:360,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(path.join(output,`${stem}-thumb.webp`));
   Object.assign(receipt,{status:'ok',sha256,src:`/images/library/${stem}.webp`,thumbnail:`/images/library/${stem}-thumb.webp`,width:metadata.width,height:metadata.height,bytes:bytes.length});saved.set(item.sourceUrl,receipt);
  }catch(error){receipt.status='failed';receipt.error=error.message;}
  fs.appendFileSync(log,JSON.stringify(receipt)+'\n');done++;if(done%100===0)console.log(JSON.stringify({downloaded:done,total:unique.length}));await new Promise(r=>setTimeout(r,250));
 }
}));
fs.writeFileSync(path.join(dir,'media.json'),JSON.stringify([...saved.values()],null,2));
fs.writeFileSync(path.join(dir,'parsed.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify({termsExpected:scope.length,termsAvailable:rows.length,candidates:unique.length,downloaded:saved.size,failed:unique.filter(m=>!saved.has(m.sourceUrl)).map(m=>m.sourceUrl)}));
