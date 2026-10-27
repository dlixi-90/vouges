import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import mongoose from "mongoose";
import Product from "../models/Product.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const directory=path.join(root,"data/media-processing");
fs.mkdirSync(directory,{recursive:true});
try{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
  if(mongoose.connection.db.databaseName!=="vouges")throw new Error("Unexpected database");
  const products=await Product.find({isDeleted:{$ne:true}}).select("title images sizeImages source inventoryMode isPublished updatedAt").sort({_id:1}).lean();
  const assets=new Map();
  const add=(url,role,id)=>{
    if(typeof url!=="string"||!/^https?:\/\//i.test(url))return;
    if(!assets.has(url))assets.set(url,{key:crypto.createHash("sha256").update(url).digest("hex").slice(0,24),url,avatar:false,roles:[],productIds:[]});
    const asset=assets.get(url);asset.avatar ||=role==="avatar";
    if(!asset.roles.includes(role))asset.roles.push(role);
    if(!asset.productIds.includes(String(id)))asset.productIds.push(String(id));
  };
  for(const product of products){product.images.forEach((url,index)=>add(url,index===0?"avatar":"gallery",product._id));for(const url of Object.values(product.sizeImages||{}))add(url,"size",product._id);}
  const rows=[...assets.values()];
  const plan={createdAt:new Date().toISOString(),database:"vouges",targetText:"www.apaniche.vn - 0961596333",counts:{products:products.length,uniqueAssets:rows.length,uniqueAvatars:rows.filter(row=>row.avatar).length},products,assets:rows};
  fs.writeFileSync(path.join(directory,"plan.json"),JSON.stringify(plan,null,2));
  console.log(JSON.stringify(plan.counts));
}finally{await mongoose.disconnect();}
