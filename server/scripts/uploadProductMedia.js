import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {v2 as cloudinary} from "cloudinary";
import connectCloudinary from "../config/cloudinary.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const directory=path.join(root,"data/media-processing"),uploads=path.join(directory,"uploads");
fs.mkdirSync(uploads,{recursive:true});
await connectCloudinary();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const failed=new Map();const watch=process.argv.includes("--watch");
let total=0,uploaded=0,already=0;
const upload=async task=>{
  const file=path.resolve(directory,task.relative);
  if(!file.startsWith(path.join(directory,"output")+path.sep))throw new Error("Invalid media output path");
  const hash=crypto.createHash("sha256").update(await fs.promises.readFile(file)).digest("hex").slice(0,12);
  const record=path.join(uploads,`${task.key}-${task.kind}.json`);
  try{if(JSON.parse(await fs.promises.readFile(record,"utf8")).hash===hash){already++;return;}}catch(error){if(error.code!=="ENOENT"&&!(error instanceof SyntaxError))throw error;}
  for(let attempt=0;attempt<4;attempt++){
    try{
      const result=await cloudinary.uploader.upload(file,{resource_type:"image",public_id:`velours/catalog-media-v1/${task.key}-${task.kind}-${hash}`,overwrite:false,unique_filename:false});
      fs.writeFileSync(record,JSON.stringify({key:task.key,kind:task.kind,hash,url:result.secure_url,publicId:result.public_id,width:result.width,height:result.height,bytes:result.bytes,uploadedAt:new Date().toISOString()},null,2));
      uploaded++;failed.delete(`${task.key}-${task.kind}`);return;
    }catch(error){
      if(attempt<3&&(!error.http_code||error.http_code===429||error.http_code>=500)){await sleep(1000*2**attempt);continue;}
      failed.set(`${task.key}-${task.kind}`,{key:task.key,kind:task.kind,status:error.http_code||0});return;
    }
  }
};
const completed=new Set();
do{
  const tasks=[];
  const resultFiles=["results","extra-results"].filter(folder=>fs.existsSync(path.join(directory,folder))).flatMap(folder=>fs.readdirSync(path.join(directory,folder)).filter(name=>name.endsWith(".json")).map(name=>({folder,name,id:`${folder}/${name}`})));
  for(const {folder,name,id} of resultFiles){
    if(completed.has(id))continue;
    let row;
    try{row=JSON.parse(fs.readFileSync(path.join(directory,folder,name),"utf8"));}
    catch(error){if(watch&&(error instanceof SyntaxError||error.code==="ENOENT"))continue;throw error;}
    for(const kind of ["cutout","clean"]){const relative=row[`${kind}Path`];if(relative)tasks.push({key:row.key,kind,relative});}
    completed.add(id);
  }
  total+=tasks.length;
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<tasks.length){const task=tasks[cursor++];await upload(task);}}));
  const progress={processedAssets:completed.size,uploadTasks:total,uploaded,alreadyStored:already,failed:failed.size,updatedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(directory,"upload-progress.json"),JSON.stringify(progress));
  fs.writeFileSync(path.join(directory,"upload-failures.json"),JSON.stringify([...failed.values()],null,2));
  if(tasks.length)console.log(JSON.stringify(progress));
  if(!watch||fs.existsSync(path.join(directory,"processing-complete.json")))break;
  await sleep(3000);
}while(true);
console.log(JSON.stringify({finished:true,uploaded,already,failed:failed.size}));
