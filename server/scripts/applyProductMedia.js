import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import CatalogMigration from "../models/CatalogMigration.js";
import {buildProductMediaUpdate,mediaImageUrl} from "../services/productMediaService.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const directory=path.join(root,"data/media-processing");
const plan=JSON.parse(fs.readFileSync(path.join(directory,"plan.json"),"utf8"));
const avatarsOnly=process.argv.includes("--avatars-only");
const extraFile=path.join(directory,"extra-plan.json");
const extra=!avatarsOnly&&fs.existsSync(extraFile)?JSON.parse(fs.readFileSync(extraFile,"utf8")):{assets:[],products:[]};
const originallyMissing=new Set(plan.products.filter(product=>!product.images?.length).map(product=>String(product._id)));
if(extra.products.some(product=>!originallyMissing.has(String(product._id))))throw new Error("Supplemental photos may only fill originally empty product galleries");
const extraProducts=new Map(extra.products.map(product=>[String(product._id),product.images[0]]));
const allAssets=[...plan.assets,...extra.assets.map(asset=>({...asset,supplemental:true}))];
if(new Set(allAssets.map(asset=>asset.key)).size!==allAssets.length)throw new Error("Duplicate supplemental image keys");
const complete=avatarsOnly?{total:plan.assets.length,failed:0}:JSON.parse(fs.readFileSync(path.join(directory,"processing-complete.json"),"utf8"));
if(complete.total!==plan.assets.length)throw new Error("Image scan has not completed");
const manifest=new Map();let scanned=0,matched=0,cutouts=0,missingUploads=0;
const cutoutByKey=new Map();
if(!avatarsOnly){
  const surface=JSON.parse(fs.readFileSync(path.join(directory,"full-surface-complete.json"),"utf8"));
  if(surface.total!==plan.assets.length||surface.failed.length)throw new Error("Full-surface watermark check has not completed");
}
const readJson=async(file)=>JSON.parse(await fs.promises.readFile(file,"utf8"));
const durableWrite=(file,value)=>{
  const descriptor=fs.openSync(file,"w");
  try{fs.writeFileSync(descriptor,value);fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
};
const inspectAsset=async(asset)=>{
  if(avatarsOnly&&!asset.avatar)return;
  let result;
  try{result=await readJson(path.join(directory,asset.supplemental?"extra-results":"results",`${asset.key}.json`));}
  catch(error){if(error.code==="ENOENT")return;throw error;}
  scanned++;if(result.watermarkMatches.length)matched++;
  if(asset.supplemental&&(!result.humanReviewed||!result.fullSurfaceChecked||!result.cutoutPath))throw new Error("Supplemental image has not been reviewed and processed");
  const row={};
  for(const kind of ["clean","cutout"]){
    if(avatarsOnly&&kind!=="cutout")continue;
    if(!result[`${kind}Path`])continue;
    const file=path.join(directory,"uploads",`${asset.key}-${kind}.json`);
    let uploaded;try{uploaded=await readJson(file);}catch(error){if(error.code==="ENOENT"){missingUploads++;continue;}throw error;}
    const hash=crypto.createHash("sha256").update(await fs.promises.readFile(path.join(directory,result[`${kind}Path`]))).digest("hex").slice(0,12);
    if(hash!==uploaded.hash){missingUploads++;continue;}
    row[`${kind}Url`]=uploaded.url;
    if(kind==="cutout")cutouts++;
  }
  if(Object.keys(row).length)manifest.set(asset.url,row);
  if(row.cutoutUrl)cutoutByKey.set(asset.key,row.cutoutUrl);
  if(row.cutoutUrl)manifest.set(row.cutoutUrl,{cutoutUrl:row.cutoutUrl,cleanUrl:row.cutoutUrl});
};
let assetCursor=0;
await Promise.all(Array.from({length:12},async()=>{while(assetCursor<allAssets.length)await inspectAsset(allAssets[assetCursor++]);}));
if(avatarsOnly&&cutouts!==plan.counts.uniqueAvatars)throw new Error("Not every avatar is ready");
if(!avatarsOnly&&cutouts!==allAssets.filter(asset=>asset.avatar).length)throw new Error("Not every original and supplemental avatar has a valid uploaded cutout");
if(!avatarsOnly&&scanned+complete.failed!==allAssets.length)throw new Error("Media scan results do not cover the full plan");
if(missingUploads)throw new Error(`${missingUploads} edited files are not uploaded yet`);
console.log(JSON.stringify({phase:"preview",scope:avatarsOnly?"avatars":"all",scanned,total:avatarsOnly?plan.counts.uniqueAvatars:allAssets.length,matched,cutouts,sourceErrors:complete.failed}));

if(process.argv.includes("--apply")){
  if(!process.argv.includes("--database=vouges"))throw new Error("Pass --database=vouges");
  try{
    await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
    if(mongoose.connection.db.databaseName!=="vouges")throw new Error("Unexpected database");
    const migrationKey=avatarsOnly?"product-media-avatar-v1":"product-media-v1";
    if(await CatalogMigration.findOne({key:migrationKey}))throw new Error("Media migration already applied");
    const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
    const backupPath=path.resolve(root,".backups",`product-media-${stamp}`);
    if(!backupPath.startsWith(path.join(root,".backups")+path.sep))throw new Error("Invalid backup target");
    fs.mkdirSync(backupPath,{recursive:true});
    let changedProducts=0,changedOrders=0,supplementedProducts=0;
    await mongoose.connection.transaction(async(session)=>{
      changedProducts=0;changedOrders=0;supplementedProducts=0;
      const products=await Product.find({isDeleted:{$ne:true}}).select("images sizeImages updatedAt").session(session).lean();
      // A recheck may improve an avatar already published in the first stage.
      // Match only this pipeline's original asset key, preserving other edits.
      for(const product of products){
        const old=product.images?.[0];const key=old?.match(/\/velours\/catalog-media-v1\/([a-f0-9]{24})-cutout-/)?.[1];
        const url=cutoutByKey.get(key);if(url)manifest.set(old,{cutoutUrl:url,cleanUrl:url});
      }
      const orders=await Order.find({"items.image":{$in:[...manifest.keys()]}}).select("items updatedAt").session(session).lean();
      const {EJSON}=mongoose.mongo.BSON;
      durableWrite(path.join(backupPath,"product-images.ejson"),EJSON.stringify(products,null,2,{relaxed:false}));
      durableWrite(path.join(backupPath,"order-images.ejson"),EJSON.stringify(orders,null,2,{relaxed:false}));
      durableWrite(path.join(backupPath,"manifest.json"),JSON.stringify({database:"vouges",createdAt:new Date().toISOString(),products:products.length,orders:orders.length,reason:"User requested transparent catalog avatars and removal of the Apaniche website/phone text"},null,2));
      const changes=products.flatMap(product=>{
        const supplementalImageUrl=!product.images?.length?extraProducts.get(String(product._id)):undefined;
        const update=buildProductMediaUpdate(product,manifest,{supplementalImageUrl});
        if(update&&supplementalImageUrl)supplementedProducts++;
        return update?[{updateOne:{filter:{_id:product._id,updatedAt:product.updatedAt},update:{$set:{...update,imageProcessing:{version:1,processedAt:new Date(),avatarCutout:Boolean(manifest.get(product.images?.[0]||supplementalImageUrl)?.cutoutUrl),...(supplementalImageUrl?{supplementalSource:supplementalImageUrl}:{})}}}}}]:[];
      });
      for(let offset=0;offset<changes.length;offset+=100){const result=await Product.bulkWrite(changes.slice(offset,offset+100),{session,ordered:true});changedProducts+=result.modifiedCount;}
      for(const order of orders){
        const items=order.items.map(item=>({...item,image:mediaImageUrl(item.image,manifest)}));
        if(JSON.stringify(items)===JSON.stringify(order.items))continue;
        const result=await Order.updateOne({_id:order._id,updatedAt:order.updatedAt},{$set:{items}},{session});changedOrders+=result.modifiedCount;
      }
      await CatalogMigration.create([{key:migrationKey,source:"apaniche",currency:"VND",moneyUnitVersion:2,appliedAt:new Date(),totals:{scanned,matched,cutouts,changedProducts,changedOrders,supplementedProducts,sourceErrors:complete.failed},backupPath}],{session});
    });
    const report={appliedAt:new Date().toISOString(),scope:avatarsOnly?"avatars":"all",database:"vouges",scanned,total:avatarsOnly?plan.counts.uniqueAvatars:allAssets.length,watermarkImages:matched,cutoutAssets:cutouts,changedProducts,changedOrders,supplementedProducts,sourceErrors:complete.failed,backupPath};
    durableWrite(path.join(directory,avatarsOnly?"applied-avatars.json":"applied.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({phase:"committed",scope:avatarsOnly?"avatars":"all",...report}));
  }finally{await mongoose.disconnect();}
}
