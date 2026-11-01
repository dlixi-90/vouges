import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../../server/package.json',import.meta.url));
const mongoose=require('mongoose');require('dotenv').config({path:path.join(root,'server/.env'),quiet:true});
const directory=path.join(root,'data/library-fulltext-2026-11-01');
await fs.mkdir(path.join(directory,'pages'),{recursive:true});
const scopeFile=path.join(directory,'scope.json');
let scope;
try{scope=JSON.parse(await fs.readFile(scopeFile,'utf8'));}catch(error){
 if(error.code!=='ENOENT')throw error;
 try{
  await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000});
  const db=mongoose.connection.db;if(db.databaseName!=='vouges')throw Error('Unexpected database');
  const terms=await db.collection('fragranceterms').find({kind:{$in:['group','accord','note']}}).sort({kind:1,_id:1}).toArray();
  const products=await db.collection('products').find({},{projection:{title:1,source:1}}).toArray();
  scope=terms.map(row=>({id:String(row._id),kind:row.kind,name:row.name,key:row.key,url:row.sourceUrl,expectedUpdatedAt:row.updatedAt.toISOString()}));
  await fs.writeFile(scopeFile,JSON.stringify(scope,null,2)+'\n');
  await fs.writeFile(path.join(directory,'product-links.json'),JSON.stringify(products.map(row=>({id:String(row._id),title:row.title,url:row.source?.url||''})),null,2)+'\n');
  await fs.writeFile(path.join(directory,'authorization.json'),JSON.stringify({at:new Date().toISOString(),authorization:'User explicitly confirmed permission to republish full Apaniche articles on Velours in this conversation.',kinds:['group','accord','note']},null,2)+'\n');
 }finally{await mongoose.disconnect();}
}
const journal=path.join(directory,'collection.jsonl');
const archive=path.join(directory,'source-pages.jsonl.gz');
if(await fs.access(archive).then(()=>true,()=>false)){
 const allowed=new Set(scope.map(row=>row.id));let restored=0;
 const lines=createInterface({input:createReadStream(archive).pipe(createGunzip()),crlfDelay:Infinity});
 for await(const line of lines){if(!line)continue;const row=JSON.parse(line);if(!allowed.has(row.id)||!/^[a-f0-9]{24}$/u.test(row.id)||typeof row.html!=='string'||row.html.length>8*1024*1024||createHash('sha256').update(row.html).digest('hex')!==row.sha256)throw Error('Invalid archived source page');const file=path.join(directory,'pages',row.id+'.html');if(!await fs.access(file).then(()=>true,()=>false)){await fs.writeFile(file,row.html);restored++;}}
 if(restored)console.log(JSON.stringify({restoredSourcePages:restored}));
}
let previous=[];try{previous=(await fs.readFile(journal,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(error){if(error.code!=='ENOENT')throw error;}
const latest=new Map(previous.map(row=>[row.id,row]));
const pending=[];
for(const row of scope){const done=latest.get(row.id);if(done?.status==='ok'&&await fs.access(path.join(directory,'pages',row.id+'.html')).then(()=>true,()=>false))continue;pending.push(row);}
let next=0,processed=0,stop=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
console.log(JSON.stringify({total:scope.length,cached:scope.length-pending.length,pending:pending.length}));
await Promise.all(Array.from({length:4},async()=>{
 while(next<pending.length&&!stop){
  const item=pending[next++],url=new URL(item.url);
  if(url.protocol!=='https:'||url.hostname!=='apaniche.vn')throw Error('Unexpected source URL');
  let receipt;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    if([401,403,429].includes(response.status)){stop=true;throw Error('Source refused collection: '+response.status);}
    if(!response.ok){receipt={...item,status:'failed',httpStatus:response.status};if(response.status===404)break;throw Error('Source HTTP '+response.status);}
    const final=new URL(response.url);if(final.hostname!=='apaniche.vn'||final.pathname==='/'||!response.headers.get('content-type')?.includes('text/html'))throw Error('Unexpected source response');
    const html=await response.text();if(html.length>8*1024*1024)throw Error('Oversized source page');
    await fs.writeFile(path.join(directory,'pages',item.id+'.html'),html);
    receipt={...item,status:'ok',finalUrl:response.url,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),fetchedAt:new Date().toISOString()};break;
   }catch(error){receipt={...item,status:'failed',error:error.message};if(stop)break;await pause(800*(attempt+1));}
  }
  latest.set(item.id,receipt);await fs.appendFile(journal,JSON.stringify(receipt)+'\n');processed++;
  if(processed%25===0)console.log(JSON.stringify({processed,total:pending.length,failed:[...latest.values()].filter(row=>row.status!=='ok').length}));
  await pause(200);
 }
}));
const results=scope.map(row=>latest.get(row.id)||{...row,status:'pending'});
await fs.writeFile(path.join(directory,'collection.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({total:results.length,ok:results.filter(row=>row.status==='ok').length,failed:results.filter(row=>row.status!=='ok').map(({id,url,httpStatus,error})=>({id,url,httpStatus,error})),stopped:stop}));
