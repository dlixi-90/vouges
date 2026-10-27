import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import CatalogSource from "../models/CatalogSource.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const directory=path.join(root,"data/media-processing");
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
try{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
  assert.equal(mongoose.connection.db.databaseName,"vouges");
  const products=await Product.find({}).sort({_id:1}).lean();
  const orders=await Order.find({}).sort({_id:1}).lean();
  const sources=await CatalogSource.find({}).select("sourceId data.images").sort({_id:1}).lean();
  const hash={
    products:digest(products.map(({images,sizeImages,imageProcessing,updatedAt,...rest})=>rest)),
    orders:digest(orders.map(({updatedAt,items,...rest})=>({...rest,items:items.map(({image,...item})=>item)}))),
    originalSourceImages:digest(sources),
  };
  const file=path.join(directory,"invariants-before.json");
  if(process.argv.includes("--snapshot")){
    if(fs.existsSync(file))throw new Error("A pre-edit snapshot already exists");
    fs.writeFileSync(file,JSON.stringify({...hash,products:hash.products,productCount:products.length,orderCount:orders.length,createdAt:new Date().toISOString()},null,2));
    console.log(JSON.stringify({snapshotSaved:true,products:products.length,orders:orders.length}));
  }else{
    const before=JSON.parse(fs.readFileSync(file,"utf8"));
    for(const key of Object.keys(hash))assert.equal(hash[key],before[key],`${key} changed outside permitted image fields`);
    const cutouts=products.filter(product=>product.imageProcessing?.avatarCutout).length;
    const missing=products.filter(product=>!product.images?.length).map(({_id,title})=>({id:String(_id),title}));
    const report={verified:true,products:products.length,orders:orders.length,cutoutProducts:cutouts,missingOriginalAvatars:missing,nonImageProductAndOrderDataUnchanged:true,immutableSourceImagesUnchanged:true};
    fs.writeFileSync(path.join(directory,"verification.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }
}finally{await mongoose.disconnect();}
