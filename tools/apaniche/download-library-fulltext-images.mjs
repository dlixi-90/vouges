import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../client/package.json',import.meta.url)),sharp=require('sharp');
const directory='data/library-fulltext-2026-11-01',target='client/public/images/library-source';
const report=JSON.parse(await fs.readFile(path.join(directory,'preparation.json'),'utf8'));
await fs.mkdir(target,{recursive:true});
let images={};try{images=JSON.parse(await fs.readFile(path.join(directory,'downloaded-images.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const failures=[];let index=0;
await Promise.all(Array.from({length:3},async()=>{
 while(index<report.missingImages.length){
  const value=report.missingImages[index++];if(images[value])continue;
  try{
   const url=new URL(value);if(url.hostname!=='apaniche.vn'||url.protocol!=='https:')throw Error('Unexpected image host');
   const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Image HTTP '+response.status);
   if(new URL(response.url).hostname!=='apaniche.vn'||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Unexpected image response');
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>20*1024*1024)throw Error('Oversized image');
   const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();
   if(!['png','jpeg','webp','gif','avif'].includes(metadata.format))throw Error('Unsupported source image format');
   const sha256=createHash('sha256').update(bytes).digest('hex'),name=sha256+'.'+(metadata.format==='jpeg'?'jpg':metadata.format);
   await fs.writeFile(path.join(target,name),bytes);
   images[value]={src:'/images/library-source/'+name,width:metadata.width,height:metadata.height,sha256,bytes:bytes.length};
  }catch(error){failures.push({url:value,error:error.message});}
 }
}));
await fs.writeFile(path.join(directory,'downloaded-images.json'),JSON.stringify(images,null,2)+'\n');
await fs.writeFile(path.join(directory,'image-download-report.json'),JSON.stringify({downloaded:Object.keys(images).length,failures,newCloudinaryUploads:0},null,2)+'\n');
console.log(JSON.stringify({downloaded:Object.keys(images).length,bytes:Object.values(images).reduce((sum,row)=>sum+row.bytes,0),failures,newCloudinaryUploads:0}));
if(failures.length)process.exitCode=1;
