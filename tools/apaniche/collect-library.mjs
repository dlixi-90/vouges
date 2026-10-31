import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseLibraryPage} from './library-parser.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'.qa-perfume/library-content-2026-10-31');
const terms=JSON.parse(fs.readFileSync(path.join(dir,'audit.json'),'utf8')).terms;
const cacheDir=path.join(dir,'pages');fs.mkdirSync(cacheDir,{recursive:true});
const logFile=path.join(dir,'collected.jsonl');
const old=fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const done=new Set(old.filter(x=>x.status==='ok'||x.status==='not-found').map(x=>x.id));
const pending=terms.filter(t=>!done.has(t.id));let next=0,checked=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
await Promise.all(Array.from({length:3},async()=>{
 while(next<pending.length){
  const term=pending[next++],row={id:term.id,kind:term.kind,name:term.name,url:term.url};
  try{
   const url=new URL(term.url);if(url.protocol!=='https:'||url.hostname!=='apaniche.vn')throw Error('Unexpected source URL');
   const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
   if(response.status===404){row.status='not-found';row.httpStatus=404;}
   else if(!response.ok){row.status='failed';row.httpStatus=response.status;}
   else{
    const final=new URL(response.url);if(final.hostname!=='apaniche.vn')throw Error('Unexpected redirect');
    const html=await response.text();if(html.length>5*1024*1024)throw Error('Oversized page');
    row.status='ok';row.httpStatus=response.status;row.finalUrl=response.url;row.bytes=Buffer.byteLength(html);row.sha256=crypto.createHash('sha256').update(html).digest('hex');
    row.content=parseLibraryPage(html,term.kind);
    fs.writeFileSync(path.join(cacheDir,`${term.id}.html`),html);
   }
  }catch(e){row.status='failed';row.error=e.message;}
  row.fetchedAt=new Date().toISOString();fs.appendFileSync(logFile,JSON.stringify(row)+'\n');checked++;
  if(checked%50===0)console.log(JSON.stringify({checked,total:pending.length,previouslyChecked:done.size}));
  await delay(450);
 }
}));
const latest=new Map(fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(line=>{const r=JSON.parse(line);return[r.id,r];}));
const results=terms.map(t=>latest.get(t.id));
fs.writeFileSync(path.join(dir,'collected.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({total:results.length,status:results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),withDescription:results.filter(r=>r.content?.blocks.length).length,byKind:Object.fromEntries(['brand','group','accord','note'].map(k=>[k,{total:results.filter(r=>r.kind===k).length,descriptions:results.filter(r=>r.kind===k&&r.content?.blocks.length).length}]))}));
