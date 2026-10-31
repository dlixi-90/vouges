import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseLibraryDirectory,parseLibraryArticle} from './library-source-media.mjs';
const dir='.qa-perfume/library-refresh-2026-11-01',terms=JSON.parse(fs.readFileSync(path.join(dir,'terms.json')));
const indexes=[['group','thu-vien-nhom-huong'],['accord','thu-vien-mui-huong'],['note','nguon-goc-note-huong'],['brand','thuong-hieu']];
const directories=indexes.map(([kind,slug])=>parseLibraryDirectory(fs.readFileSync(path.join(dir,`${slug}.html`),'utf8'),kind,`https://apaniche.vn/${slug}`));
fs.writeFileSync(path.join(dir,'directories.json'),JSON.stringify(directories,null,2));
const cards=directories.flatMap(d=>d.cards),all=new Map(terms.map(t=>[t.sourceUrl,{id:String(t._id),kind:t.kind,name:t.name,url:t.sourceUrl,key:t.key,expectedUpdatedAt:t.updatedAt,cover:cards.find(c=>c.url===t.sourceUrl)?.media?.[0]}]));
for(const card of cards)if(!all.has(card.url))all.set(card.url,{id:crypto.createHash('sha256').update(`library:${card.kind}:${card.url}`).digest('hex').slice(0,24),kind:card.kind,name:card.name,url:card.url,key:card.url,isNew:true,cover:card.media?.[0]});
const rows=[...all.values()],cache=path.join(dir,'pages');fs.mkdirSync(cache,{recursive:true});
fs.writeFileSync(path.join(dir,'scope.json'),JSON.stringify(rows,null,2));
let next=0,done=0,stopped=false;
await Promise.all(Array.from({length:3},async()=>{
 while(next<rows.length&&!stopped){const row=rows[next++],file=path.join(cache,`${row.id}.json`);if(fs.existsSync(file)){done++;continue;}
  try{
   const response=await fetch(row.url,{signal:AbortSignal.timeout(30000)});if([401,403,429].includes(response.status)){stopped=true;throw Error(`Collection refused: ${response.status}`);}if(!response.ok)throw Error(`HTTP ${response.status}`);
   if(new URL(response.url).hostname!=='apaniche.vn')throw Error('Cross-origin redirect');
   const reader=response.body.getReader(),decoder=new TextDecoder();let html='',size=0;
   try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8*1024*1024)throw Error('Oversized source');html+=decoder.decode(chunk.value,{stream:true});if(html.includes('</main>')){await reader.cancel();html=html.slice(0,html.indexOf('</main>')+7);break;}}}finally{reader.releaseLock();}
   const result={...row,status:200,fetchedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(html).digest('hex'),content:parseLibraryArticle(html,row.kind,row.url)};
   fs.writeFileSync(path.join(cache,`${row.id}.html`),html);fs.writeFileSync(file,JSON.stringify(result));
  }catch(error){console.log(JSON.stringify({failed:row.url,error:error.message}));}
  done++;if(done%75===0)console.log(JSON.stringify({done,total:rows.length}));await new Promise(r=>setTimeout(r,350));
 }
}));
const result=rows.flatMap(r=>{const file=path.join(cache,`${r.id}.json`);return fs.existsSync(file)?[JSON.parse(fs.readFileSync(file))]:[];});
fs.writeFileSync(path.join(dir,'collected.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({total:rows.length,received:result.length,newTerms:rows.filter(r=>r.isNew).map(r=>({name:r.name,kind:r.kind})),directories:directories.map(d=>({kind:d.kind,cards:d.cards.length,origins:d.origins.length})),media:result.reduce((n,r)=>n+r.content.media.length,0)}));
