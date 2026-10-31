import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {parseProductArticle} from './product-article-parser.mjs';
const require=createRequire(new URL('../../client/package.json',import.meta.url)),sharp=require('sharp');
const dir='.qa-perfume/product-article-media-2026-11-01',output='client/public/images/product-articles';
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(path.join(dir,'originals'),{recursive:true});
const rows=JSON.parse(fs.readFileSync(path.join(dir,'source-descriptions.json'),'utf8')).map(row=>({...row,article:parseProductArticle(row.description,row.permalink)}));
const unique=[...new Map(rows.flatMap(row=>row.article.images).map(image=>[image.sourceUrl,image])).values()];
fs.writeFileSync(path.join(dir,'parsed.json'),JSON.stringify(rows,null,2));
const library=JSON.parse(fs.readFileSync('.qa-perfume/library-refresh-2026-11-01/media.json','utf8'));
const log=path.join(dir,'media.jsonl'),old=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const known=[...library,...old.filter(row=>row.status==='ok')].filter(row=>fs.existsSync(path.join('client/public',row.src)));
const byUrl=new Map(known.map(row=>[row.sourceUrl,row])),byHash=new Map(known.map(row=>[row.sha256,row]));
const saved=new Map();let next=0,done=0,stop=false;
const originalPlan=JSON.parse(fs.readFileSync('data/media-processing/plan.json','utf8'));
const originalCache=new Map(originalPlan.assets.map(asset=>[asset.url,path.join('data/media-processing/originals',`${asset.key}.bin`)]));
console.log(JSON.stringify({products:rows.length,imageReferences:rows.reduce((n,r)=>n+r.article.images.length,0),uniqueUrls:unique.length,reusedUrls:unique.filter(row=>byUrl.has(row.sourceUrl)).length,rejected:rows.flatMap(r=>r.article.rejected)}));
await Promise.all(Array.from({length:4},async()=>{
 while(next<unique.length&&!stop){const image=unique[next++];if(byUrl.has(image.sourceUrl)){saved.set(image.sourceUrl,{...byUrl.get(image.sourceUrl),reused:true});done++;continue;}
  const receipt={sourceUrl:image.sourceUrl};
  try{
   const original=originalCache.get(image.sourceUrl);
   let bytes;
   if(original&&fs.existsSync(original)){
    // Original downloads only; never reuse edited/cleaned product-image outputs.
    bytes=fs.readFileSync(original);receipt.originalCache=original;receipt.fetchedAt=fs.statSync(original).mtime.toISOString();
   }else{
   const response=await fetch(image.sourceUrl,{signal:AbortSignal.timeout(30000)});
   if([401,403,429].includes(response.status)){stop=true;throw Error(`Source refused: ${response.status}`);}
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const host=new URL(response.url).hostname;
   if(!['apaniche.vn','i.ytimg.com','lh3.googleusercontent.com'].includes(host)||!/^image\/(?:png|jpeg|webp|gif|avif)/iu.test(response.headers.get('content-type')||''))throw Error('Unexpected image response');
   const chunks=[];let size=0;
   for await(const chunk of response.body){size+=chunk.length;if(size>15*1024*1024)throw Error('Image exceeds byte limit');chunks.push(chunk);}
    bytes=Buffer.concat(chunks);receipt.fetchedAt=new Date().toISOString();
   }
   const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),stem=sha256.slice(0,24),existing=byHash.get(sha256);
   if(existing)Object.assign(receipt,{...existing,sourceUrl:image.sourceUrl,reused:true});
   else {
    let decoded=bytes;
    if(bytes.subarray(0,2).toString()==='BM'){
     if(process.platform!=='win32'||!receipt.originalCache)throw Error('BMP needs original-preserving decoding');
     const png=path.resolve(dir,'originals',`${stem}-decoded.png`);
     if(!fs.existsSync(png))execFileSync('powershell.exe',['-NoProfile','-File',path.resolve('tools/apaniche/decode-product-bmp.ps1'),'-InputPath',path.resolve(receipt.originalCache),'-OutputPath',png],{windowsHide:true});
     decoded=fs.readFileSync(png);receipt.formatConversion='BMP to PNG';
    }
    const metadata=await sharp(decoded,{limitInputPixels:40000000}).metadata();
    if(!receipt.originalCache)fs.writeFileSync(path.join(dir,'originals',`${stem}.${metadata.format}`),bytes);
    // Preserve the entire original frame, including embedded signatures/credits.
    const info=await sharp(decoded).rotate().resize({width:1440,height:1440,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(path.join(output,`${stem}.webp`));
    Object.assign(receipt,{status:'ok',sha256,src:`/images/product-articles/${stem}.webp`,width:info.width,height:info.height,bytes:bytes.length});
    byHash.set(sha256,receipt);
   }
   saved.set(image.sourceUrl,receipt);
  }catch(error){receipt.status='failed';receipt.error=error.message;}
  fs.appendFileSync(log,JSON.stringify(receipt)+'\n');done++;if(done%200===0)console.log(JSON.stringify({processed:done,total:unique.length}));if(!receipt.originalCache)await new Promise(r=>setTimeout(r,200));
 }
}));
fs.writeFileSync(path.join(dir,'media.json'),JSON.stringify([...saved.values()],null,2));
console.log(JSON.stringify({available:saved.size,expected:unique.length,failed:unique.filter(row=>!saved.has(row.sourceUrl)).map(row=>row.sourceUrl)}));
